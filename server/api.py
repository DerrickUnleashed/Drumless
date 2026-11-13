"""Drumless backend — FastAPI server for the mobile app.

Exposes the `drumless` pipeline (Demucs separation + BPM + click + export) as a
simple job API:

    POST /api/jobs                 create a job (multipart file OR youtube url)
    GET  /api/jobs/{id}            status/progress/result (poll every ~2s)
    POST /api/jobs/{id}/regen      regenerate the click/mixed at a BPM + gain
    GET  /api/jobs/{id}/audio/{v}  stream an output file (backing or mixed)

Authenticated clients (web + new Android builds) also get a persistent library:

    GET    /api/tracks                  list the caller's tracks
    GET    /api/tracks/{id}             fetch one track
    PATCH  /api/tracks/{id}             rename (custom_name)
    DELETE /api/tracks/{id}             delete row + stored audio
    GET    /api/tracks/{id}/url         signed playback/download URL

Design notes / production caveats:
  - Authenticated jobs persist metadata in Supabase (`public.tracks`) and audio
    in the private `drumless-audio` bucket. Requests without a bearer token use
    the original in-memory/on-disk job store, so old mobile builds keep working.
  - Separation is genuinely slow on CPU (1-4x realtime); jobs run in a
    background thread, and clients poll — never run inline in a request.
  - yt-dlp against datacenter IPs is fragile; the upload path always works.

Run with:  uvicorn api:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
import shutil
import threading
import time
from pathlib import Path
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from drumless.pipeline import process_track
from drumless.audio_utils import (
    get_duration_seconds,
    load_audio_as_numpy,
    save_numpy_as_wav,
    wav_to_mp3,
)
from drumless.click_track import build_beat_times, synthesize_click_track, build_mixed_track
from drumless.supabase_client import BUCKET, SupabaseError, SupabaseRest, get_client

# Job outputs + uploads land here.  Point DATA_DIR at a persistent disk in prod
# (e.g. Render's mount, /app/data) so results survive restarts.
DATA_DIR = Path(os.environ.get("DATA_DIR", "data/jobs"))
SAMPLE_RATE = 44100
SIGNED_URL_TTL = int(os.environ.get("SIGNED_URL_TTL", "3600"))
DEFAULT_CLICK_GAIN_DB = 6.0

# Render Free has 512 MB; htdemucs peaks ~900 MB and gets OOM-killed. Set
# DEMUCS_MODEL=mdx_q there (quantized, ~370 MB). Local runs keep the default.
_MODEL_OVERRIDE = os.environ.get("DEMUCS_MODEL")

# Map the pipeline's stage strings ("(1/6) Preparing input audio…") to a compact
# stage label + progress fraction, so the app can render a bar + text.
_STAGES = ["input", "separation", "backing", "tempo", "click", "export"]


def _parse_stage(msg: str) -> tuple[str | None, int | None]:
    for idx, name in enumerate(_STAGES, start=1):
        if f"({idx}/6)" in msg:
            return name, idx
    return None, None


class Job:
    """Holds job state shared between the request thread and the worker thread."""

    def __init__(self, job_id: str):
        self.id = job_id
        self.status = "queued"          # queued | running | done | error
        self.stage = None
        self.progress = 0               # 0..6 fraction*100
        self.message = "Queued"
        self.bpm = None
        self.first_beat = None
        self.tempo_source = None
        self.model = "htdemucs"
        self.files: dict = {}           # {"backing": {"wav": url, "mp3": url}, ...}
        self._source_paths: dict = {}   # disk paths for regen
        self.detail_dir: Path | None = None


JOBS: dict[str, Job] = {}
JOB_LOCK = threading.Lock()


def _dir_for(job: Job) -> Path:
    d = DATA_DIR / job.id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _url_for(job_id: str, variant: str, fmt: str) -> str:
    return f"/api/jobs/{job_id}/audio/{variant}.{fmt}"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header[7:].strip()
        return token or None
    return None


def _optional_user(request: Request, client: SupabaseRest | None) -> dict[str, Any] | None:
    if client is None:
        return None
    token = _bearer_token(request)
    if not token:
        return None
    return client.get_user(token)


def _require_user(request: Request, client: SupabaseRest | None) -> dict[str, Any]:
    if client is None:
        raise HTTPException(503, "Storage backend not configured (Supabase env vars missing).")
    token = _bearer_token(request)
    if not token:
        raise HTTPException(401, "Missing bearer token.")
    user = client.get_user(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token.")
    return user


# ---------------------------------------------------------------------------
# Legacy (unauthenticated) job pipeline — kept for existing mobile builds
# ---------------------------------------------------------------------------

def _run_job(job: Job, uploaded_file: str | None, yt_url: str | None) -> None:
    """Background worker: run the full pipeline, updating job state as we go."""
    def report(msg: str) -> None:
        job.message = msg
        stage, idx = _parse_stage(msg)
        if stage:
            job.stage = stage
            job.progress = int(((idx - 1) / 6) * 100)

    job.status = "running"
    job.progress = 0
    try:
        result = process_track(
            uploaded_file=uploaded_file,
            yt_url=yt_url,
            workdir=_dir_for(job),
            model=job.model,
            progress_cb=report,
        )
        job.progress = 100
        job.bpm = result["bpm"]
        job.first_beat = result.get("first_beat", 0.0)
        job.tempo_source = result["tempo_source"]

        variants = {
            "backing": result["files"]["backing"],
            "mixed": result["files"]["mixed"],
        }
        # Mobile MVP streams WAVs (mp3 transcoding can be added server-side later).
        job.files = {v: _url_for(job.id, v, "wav") for v in variants}
        job._source_paths = {
            "backing": Path(variants["backing"]["wav"]),
            "backing_mp3": Path(variants["backing"]["mp3"]),
            "click": Path(result["files"]["click"]["wav"]),
            "mixed": Path(variants["mixed"]["wav"]),
            "mixed_mp3": Path(variants["mixed"]["mp3"]),
        }
        job.detail_dir = _dir_for(job)
        job.status = "done"
    except Exception as e:  # noqa: BLE001 — surface any failure to the client
        job.status = "error"
        job.message = str(e)


# ---------------------------------------------------------------------------
# Authenticated pipeline — persists to Supabase tracks + storage
# ---------------------------------------------------------------------------

def _storage_paths(user_id: str, track_id: str) -> dict[str, str]:
    prefix = f"{user_id}/{track_id}"
    return {
        "original": f"{prefix}/original.wav",
        "backing": f"{prefix}/backing.wav",
        "backing_mp3": f"{prefix}/backing.mp3",
        "click": f"{prefix}/click.wav",
        "mixed": f"{prefix}/mixed.wav",
        "mixed_mp3": f"{prefix}/mixed.mp3",
    }


def _row_to_payload(row: dict[str, Any], client: SupabaseRest | None = None) -> dict[str, Any]:
    payload = {
        "track_id": row["id"],
        "id": row["id"],
        "user_id": row["user_id"],
        "original_song_name": row["original_song_name"],
        "custom_name": row.get("custom_name"),
        "source_url": row.get("source_url"),
        "bpm": float(row["bpm"]) if row.get("bpm") is not None else None,
        "click_gain_db": float(row["click_gain_db"]) if row.get("click_gain_db") is not None else None,
        "duration_seconds": float(row["duration_seconds"]) if row.get("duration_seconds") is not None else None,
        "status": row["status"],
        "error_message": row.get("error_message"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "has_backing": bool(row.get("backing_storage_path")),
        "has_mixed": bool(row.get("mixed_storage_path")),
    }
    return payload


def _upload_outputs(
    client: SupabaseRest,
    user_id: str,
    track_id: str,
    result: dict[str, Any],
) -> dict[str, str]:
    paths = _storage_paths(user_id, track_id)
    files = result["files"]
    client.upload_file(paths["original"], result["input_wav"], "audio/wav")
    client.upload_file(paths["backing"], files["backing"]["wav"], "audio/wav")
    client.upload_file(paths["backing_mp3"], files["backing"]["mp3"], "audio/mpeg")
    client.upload_file(paths["click"], files["click"]["wav"], "audio/wav")
    client.upload_file(paths["mixed"], files["mixed"]["wav"], "audio/wav")
    client.upload_file(paths["mixed_mp3"], files["mixed"]["mp3"], "audio/mpeg")
    return paths


def _run_track_job(
    client: SupabaseRest,
    track_id: str,
    user_id: str,
    uploaded_file: str | None,
    yt_url: str | None,
    model: str,
) -> None:
    job = Job(track_id)
    job.model = model
    with JOB_LOCK:
        JOBS[track_id] = job

    def report(msg: str) -> None:
        job.message = msg
        stage, idx = _parse_stage(msg)
        if stage:
            job.stage = stage
            job.progress = int(((idx - 1) / 6) * 100)

    job.status = "running"
    try:
        client.update_track(track_id, {"status": "running", "error_message": None})

        result = process_track(
            uploaded_file=uploaded_file,
            yt_url=yt_url,
            workdir=_dir_for(job),
            model=model,
            progress_cb=report,
        )
        job.progress = 100
        job.bpm = result["bpm"]
        job.first_beat = result.get("first_beat", 0.0)
        job.tempo_source = result["tempo_source"]

        paths = _upload_outputs(client, user_id, track_id, result)
        try:
            duration = get_duration_seconds(result["input_wav"])
        except Exception:  # noqa: BLE001 — duration is best-effort metadata
            duration = None

        client.update_track(
            track_id,
            {
                "status": "done",
                "error_message": None,
                "original_storage_path": paths["original"],
                "backing_storage_path": paths["backing"],
                "mixed_storage_path": paths["mixed"],
                "bpm": result["bpm"],
                "first_beat": result.get("first_beat", 0.0),
                "click_gain_db": DEFAULT_CLICK_GAIN_DB,
                "duration_seconds": duration,
            },
        )
        job.detail_dir = _dir_for(job)
        job.status = "done"
    except Exception as e:  # noqa: BLE001
        job.status = "error"
        job.message = str(e)
        try:
            client.update_track(track_id, {"status": "error", "error_message": str(e)[:2000]})
        except Exception:  # noqa: BLE001 — never mask the original error
            pass


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Mark tracks abandoned by a previous container as failed."""
    client = get_client()
    if client is not None:
        try:
            client.mark_stale_tracks()
        except Exception:  # noqa: BLE001 — startup must never crash on this
            pass
    yield


app = FastAPI(title="Drumless API", version="2.0.0", lifespan=lifespan)

# Mobile apps don't send Origin by default (file:// / native), but allow CORS so
# the same backend can serve a web client.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "storage": "supabase" if get_client() else "local"}


@app.post("/api/jobs", status_code=201)
async def create_job(
    request: Request,
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    model: str = Form(default="htdemucs"),
):
    if not file and not url:
        raise HTTPException(400, "Provide an audio `file` upload OR a YouTube `url`.")

    if _MODEL_OVERRIDE:
        model = _MODEL_OVERRIDE

    client = get_client()
    user = _optional_user(request, client)

    # Cloud boxes are RAM-tight: a second concurrent Demucs run would OOM the
    # instance, so serialize jobs for now.
    with JOB_LOCK:
        if any(j.status in {"queued", "running"} for j in JOBS.values()):
            raise HTTPException(409, "Another job is already processing. Wait for it to finish, then retry.")

        job_id = f"job_{int(time.time() * 1000)}"
        job = Job(job_id)
        job.model = model
        JOBS[job_id] = job

    d = _dir_for(job)
    uploaded_path = None
    if file is not None:
        upload_dir = d / "upload"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = Path(file.filename or "upload.bin").name
        uploaded_path = upload_dir / safe_name
        with uploaded_path.open("wb") as fh:
            shutil.copyfileobj(file.file, fh)

    if client is not None and user is not None:
        # Authenticated: persist the track row, run against its id.
        original_name = Path(file.filename).name if file and file.filename else (url or "Untitled")
        try:
            row = client.insert_track(
                {
                    "user_id": user["id"],
                    "original_song_name": original_name,
                    "source_url": url,
                    "status": "queued",
                }
            )
        except SupabaseError as e:
            JOBS.pop(job_id, None)
            raise HTTPException(502, f"Could not create track: {e}") from e

        track_id = row["id"]
        # Replace the placeholder in-memory job under the real track id.
        JOBS.pop(job_id, None)
        job.id = track_id
        with JOB_LOCK:
            JOBS[track_id] = job

        t = threading.Thread(
            target=_run_track_job,
            args=(
                client,
                track_id,
                user["id"],
                str(uploaded_path) if uploaded_path else None,
                url,
                model,
            ),
            daemon=True,
        )
        t.start()
        return JSONResponse({"job_id": track_id, "track_id": track_id}, status_code=201)

    t = threading.Thread(
        target=_run_job, args=(job, str(uploaded_path) if uploaded_path else None, url), daemon=True
    )
    t.start()
    return JSONResponse({"job_id": job_id}, status_code=201)


class RegenRequest(BaseModel):
    bpm: float | None = None
    click_gain_db: float | None = None


class RenameRequest(BaseModel):
    custom_name: str


def _regen_legacy(job: Job, req: RegenRequest) -> None:
    d = _dir_for(job)
    backing, click = (job._source_paths["backing"], job._source_paths["click"])

    backing_audio, _ = load_audio_as_numpy(backing, SAMPLE_RATE)
    click_audio, _ = load_audio_as_numpy(click, SAMPLE_RATE)
    bpm = req.bpm or (job.bpm or 120.0)

    # Rebuild the click grid at the (possibly edited) BPM, then remix.
    dur_s = len(backing_audio) / SAMPLE_RATE
    beat_times = build_beat_times(dur_s, bpm, job.first_beat)
    click_new = synthesize_click_track(
        beat_times, sr=SAMPLE_RATE, length=len(backing_audio)
    )
    gain = req.click_gain_db if req.click_gain_db is not None else 6.0
    mixed = build_mixed_track(backing_audio, click_new, gain)

    tag = f"regen_{int(time.time() * 1000)}"
    click_out = d / f"{tag}_click.wav"
    mixed_out = d / f"{tag}_mixed.wav"
    save_numpy_as_wav(click_new, click_out, SAMPLE_RATE)
    save_numpy_as_wav(mixed, mixed_out, SAMPLE_RATE)
    mixed_mp3 = wav_to_mp3(mixed_out, d / f"{tag}_mixed.mp3")

    job._source_paths["click"] = click_out
    job._source_paths["mixed"] = mixed_out
    job._source_paths["mixed_mp3"] = mixed_mp3
    job.files["mixed"] = _url_for(job.id, "mixed", "wav")


def _regen_track(
    client: SupabaseRest, track_id: str, user_id: str, req: RegenRequest
) -> dict[str, Any]:
    row = client.get_track(track_id, user_id)
    if row is None:
        raise HTTPException(404, "Unknown track")
    if row["status"] != "done" or not row.get("backing_storage_path"):
        raise HTTPException(409, "Track not finished")

    paths = _storage_paths(user_id, track_id)
    workdir = DATA_DIR / track_id / f"regen_{int(time.time() * 1000)}"
    workdir.mkdir(parents=True, exist_ok=True)
    backing = client.download_file(row["backing_storage_path"], workdir / "backing.wav")
    click = client.download_file(paths["click"], workdir / "click.wav")

    backing_audio, _ = load_audio_as_numpy(backing, SAMPLE_RATE)
    bpm = req.bpm or (float(row["bpm"]) if row.get("bpm") is not None else 120.0)
    first_beat = float(row["first_beat"]) if row.get("first_beat") is not None else 0.0

    dur_s = len(backing_audio) / SAMPLE_RATE
    beat_times = build_beat_times(dur_s, bpm, first_beat)
    click_new = synthesize_click_track(beat_times, sr=SAMPLE_RATE, length=len(backing_audio))
    gain = req.click_gain_db if req.click_gain_db is not None else DEFAULT_CLICK_GAIN_DB
    mixed = build_mixed_track(backing_audio, click_new, gain)

    mixed_wav = workdir / "mixed.wav"
    save_numpy_as_wav(mixed, mixed_wav, SAMPLE_RATE)
    mixed_mp3 = wav_to_mp3(mixed_wav, workdir / "mixed.mp3")
    client.upload_file(paths["mixed"], mixed_wav, "audio/wav")
    client.upload_file(paths["mixed_mp3"], mixed_mp3, "audio/mpeg")

    client.update_track(track_id, {"bpm": bpm, "click_gain_db": gain})
    return {"track_id": track_id, "job_id": track_id, "bpm": bpm}


@app.post("/api/jobs/{job_id}/regen")
def regen(job_id: str, req: RegenRequest, request: Request):
    job = JOBS.get(job_id)
    if job is not None:
        if job.status != "done":
            raise HTTPException(409, "Job not finished")
        _regen_legacy(job, req)
        return {"job_id": job_id, "bpm": req.bpm or (job.bpm or 120.0)}

    client = get_client()
    user = _optional_user(request, client)
    if client is None or user is None:
        raise HTTPException(404, "Unknown job")
    return _regen_track(client, job_id, user["id"], req)


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str, request: Request):
    job = JOBS.get(job_id)
    if job is not None:
        return {
            "job_id": job.id,
            "status": job.status,
            "stage": job.stage,
            "progress": job.progress,
            "message": job.message,
            "bpm": job.bpm,
            "tempo_source": job.tempo_source,
            "model": job.model,
            "files": job.files,
        }

    client = get_client()
    user = _optional_user(request, client)
    if client is None or user is None:
        raise HTTPException(404, "Unknown job")
    row = client.get_track(job_id, user["id"])
    if row is None:
        raise HTTPException(404, "Unknown job")
    if row["status"] in {"queued", "running"} and job_id not in JOBS:
        updated = client.update_track(
            job_id,
            {
                "status": "error",
                "error_message": "Processing was interrupted. Please retry.",
            },
        )
        row = updated or row
    payload = _row_to_payload(row, client)
    return {
        "job_id": row["id"],
        "status": row["status"],
        "stage": "export" if row["status"] == "done" else None,
        "progress": 100 if row["status"] == "done" else 0,
        "message": row.get("error_message") or ("Done" if row["status"] == "done" else "Queued"),
        "bpm": payload["bpm"],
        "tempo_source": None,
        "model": "htdemucs",
        "files": {},
    }


def _track_storage_path(
    client: SupabaseRest, row: dict[str, Any], variant: str, fmt: str
) -> str | None:
    if variant == "backing" and row.get("backing_storage_path"):
        return row["backing_storage_path"] if fmt == "wav" else str(row["backing_storage_path"]).replace(".wav", ".mp3")
    if variant == "mixed" and row.get("mixed_storage_path"):
        return row["mixed_storage_path"] if fmt == "wav" else str(row["mixed_storage_path"]).replace(".wav", ".mp3")
    if variant == "original" and row.get("original_storage_path"):
        if fmt == "wav":
            return row["original_storage_path"]
    return None


@app.get("/api/jobs/{job_id}/audio/{variant}.{fmt}")
def audio_file(job_id: str, variant: str, fmt: str, request: Request):
    job = JOBS.get(job_id)
    if job is None:
        client = get_client()
        user = _optional_user(request, client)
        if client is None or user is None:
            raise HTTPException(404, "Unknown job")
        row = client.get_track(job_id, user["id"])
        if row is None or row["status"] != "done":
            raise HTTPException(404, "Unknown job")
        if fmt not in {"wav", "mp3"}:
            raise HTTPException(404, f"Unsupported audio format: {fmt}")
        path = _track_storage_path(client, row, variant, fmt)
        if path is None:
            raise HTTPException(404, f"No {fmt} output for {variant}")
        dest = DATA_DIR / job_id / f"{variant}.{fmt}"
        client.download_file(path, dest)
        media_type = "audio/wav" if fmt == "wav" else "audio/mpeg"
        return FileResponse(str(dest), media_type=media_type, filename=f"{variant}.{fmt}")

    if job.status != "done":
        raise HTTPException(409, "Job not finished")

    if fmt not in {"wav", "mp3"}:
        raise HTTPException(404, f"Unsupported audio format: {fmt}")

    key = variant if fmt == "wav" else f"{variant}_{fmt}"
    path = job._source_paths.get(key)
    if path is None and fmt == "mp3":
        wav_path = job._source_paths.get(variant)
        if wav_path is not None and wav_path.exists():
            path = wav_to_mp3(wav_path, wav_path.with_suffix(".mp3"))
            job._source_paths[key] = path
    if path is None:
        raise HTTPException(404, f"No {fmt} output for {variant}")

    path = Path(path)
    if not path.exists():
        raise HTTPException(404, "Output file missing on disk")

    media_type = "audio/wav" if fmt == "wav" else "audio/mpeg"
    return FileResponse(str(path), media_type=media_type, filename=f"{variant}.{fmt}")


# ---------------------------------------------------------------------------
# Track library (authenticated)
# ---------------------------------------------------------------------------

@app.get("/api/tracks")
def list_tracks(request: Request):
    client = get_client()
    user = _require_user(request, client)
    rows = client.select_tracks(user["id"])
    return {"tracks": [_row_to_payload(r) for r in rows]}


@app.get("/api/tracks/{track_id}")
def get_track(track_id: str, request: Request):
    client = get_client()
    user = _require_user(request, client)
    row = client.get_track(track_id, user["id"])
    if row is None:
        raise HTTPException(404, "Unknown track")
    return _row_to_payload(row)


@app.patch("/api/tracks/{track_id}")
def rename_track(track_id: str, req: RenameRequest, request: Request):
    client = get_client()
    user = _require_user(request, client)
    row = client.get_track(track_id, user["id"])
    if row is None:
        raise HTTPException(404, "Unknown track")
    name = req.custom_name.strip()
    if not name:
        raise HTTPException(400, "custom_name cannot be empty")
    updated = client.update_track(track_id, {"custom_name": name[:200]})
    return _row_to_payload(updated)


@app.delete("/api/tracks/{track_id}")
def delete_track(track_id: str, request: Request):
    client = get_client()
    user = _require_user(request, client)
    row = client.get_track(track_id, user["id"])
    if row is None:
        raise HTTPException(404, "Unknown track")

    paths = _storage_paths(user["id"], track_id)
    to_delete = [
        p for p in (
            row.get("original_storage_path"),
            row.get("backing_storage_path"),
            str(row.get("backing_storage_path")).replace(".wav", ".mp3") if row.get("backing_storage_path") else None,
            row.get("mixed_storage_path"),
            str(row.get("mixed_storage_path")).replace(".wav", ".mp3") if row.get("mixed_storage_path") else None,
            paths["click"],
        ) if p
    ]
    try:
        client.delete_files(to_delete)
    except SupabaseError:
        pass  # storage is best-effort; never block metadata deletion
    client.delete_track(track_id)
    JOBS.pop(track_id, None)
    return {"deleted": track_id}


@app.get("/api/tracks/{track_id}/url")
def track_url(
    track_id: str,
    request: Request,
    variant: str = "mixed",
    format: str = "wav",
    download: bool = False,
):
    client = get_client()
    user = _require_user(request, client)
    row = client.get_track(track_id, user["id"])
    if row is None:
        raise HTTPException(404, "Unknown track")
    if variant not in {"backing", "mixed", "original"}:
        raise HTTPException(400, "variant must be backing, mixed, or original")
    if format not in {"wav", "mp3"}:
        raise HTTPException(400, "format must be wav or mp3")
    path = _track_storage_path(client, row, variant, format)
    if path is None:
        raise HTTPException(404, f"No {format} output for {variant}")
    url = client.signed_url(path, SIGNED_URL_TTL, download=download)
    return {"url": url, "expires_in": SIGNED_URL_TTL, "variant": variant, "format": format}
