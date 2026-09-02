"""Drumless backend — FastAPI server for the mobile app.

Exposes the `drumless` pipeline (Demucs separation + BPM + click + export) as a
simple job API:

    POST /api/jobs                 create a job (multipart file OR youtube url)
    GET  /api/jobs/{id}            status/progress/result (poll every ~2s)
    POST /api/jobs/{id}/regen      regenerate the click/mixed at a BPM + gain
    GET  /api/jobs/{id}/audio/{v}  stream an output file (backing or mixed)

Design notes / production caveats:
  - Single-process, in-memory job store + files on disk.  Fine for personal /
    small-team use (or one Render service with a persistent disk).  For many
    concurrent users, swap the in-memory store for Redis + a background worker
    and put output files in S3/R2.  The job contract below is queue-agnostic.
  - Separation is genuinely slow on CPU (1-4x realtime); jobs run in a
    background thread, and clients poll — never run inline in a request.
  - yt-dlp against datacenter IPs is fragile; the upload path always works.

Run with:  uvicorn api:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import io
import os
import shutil
import threading
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from drumless.pipeline import process_track
from drumless.audio_utils import load_audio_as_numpy, save_numpy_as_wav
from drumless.click_track import synthesize_click_track, build_mixed_track

# Job outputs + uploads land here.  Point DATA_DIR at a persistent disk in prod
# (e.g. Render's mount, /app/data) so results survive restarts.
DATA_DIR = Path(os.environ.get("DATA_DIR", "data/jobs"))
SAMPLE_RATE = 44100

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
        self.tempo_source = None
        self.model = "htdemucs"
        self.files: dict = {}           # {"backing": {"wav": url, "mp3": url}, ...}
        self._source_paths: dict = {}   # disk paths for regen
        self.detail_dir: Path | None = None


JOBS: dict[str, Job] = {}


def _dir_for(job: Job) -> Path:
    d = DATA_DIR / job.id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _url_for(job_id: str, variant: str, fmt: str) -> str:
    return f"/api/jobs/{job_id}/audio/{variant}.{fmt}"


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
        job.tempo_source = result["tempo_source"]

        variants = {
            "backing": result["files"]["backing"],
            "mixed": result["files"]["mixed"],
        }
        # Mobile MVP streams WAVs (mp3 transcoding can be added server-side later).
        job.files = {v: _url_for(job.id, v, "wav") for v in variants}
        job._source_paths = {
            "backing": Path(variants["backing"]["wav"]),
            "click": Path(result["files"]["click"]["wav"]),
            "mixed": Path(variants["mixed"]["wav"]),
        }
        job.detail_dir = _dir_for(job)
        job.status = "done"
    except Exception as e:  # noqa: BLE001 — surface any failure to the client
        job.status = "error"
        job.message = str(e)


app = FastAPI(title="Drumless API", version="1.0.0")

# Mobile apps don't send Origin by default (file:// / native), but allow CORS so
# the same backend can serve a web client later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/jobs", status_code=201)
async def create_job(
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    model: str = Form(default="htdemucs"),
):
    if not file and not url:
        raise HTTPException(400, "Provide an audio `file` upload OR a YouTube `url`.")

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

    t = threading.Thread(
        target=_run_job, args=(job, str(uploaded_path) if uploaded_path else None, url), daemon=True
    )
    t.start()
    return JSONResponse({"job_id": job_id}, status_code=201)


class RegenRequest(BaseModel):
    bpm: float | None = None
    click_gain_db: float | None = None


@app.post("/api/jobs/{job_id}/regen")
def regen(job_id: str, req: RegenRequest):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if job.status != "done":
        raise HTTPException(409, "Job not finished")

    d = _dir_for(job)
    backing, click = (job._source_paths["backing"], job._source_paths["click"])

    backing_audio, _ = load_audio_as_numpy(backing, SAMPLE_RATE)
    click_audio, _ = load_audio_as_numpy(click, SAMPLE_RATE)
    bpm = req.bpm or (job.bpm or 120.0)

    # Rebuild the click grid at the (possibly edited) BPM, then remix.
    import numpy as np
    import librosa
    dur_s = len(backing_audio) / SAMPLE_RATE
    beat_times = librosa.frames_to_time(
        librosa.util.fix_frames(range(0, int(dur_s * bpm / 60))), sr=SAMPLE_RATE
    )
    click_new = synthesize_click_track(
        beat_times, sr=SAMPLE_RATE, length=len(backing_audio)
    )
    gain = req.click_gain_db if req.click_gain_db is not None else -6.0
    mixed = build_mixed_track(backing_audio, click_new, gain)

    tag = f"regen_{int(time.time() * 1000)}"
    click_out = d / f"{tag}_click.wav"
    mixed_out = d / f"{tag}_mixed.wav"
    save_numpy_as_wav(click_new, click_out, SAMPLE_RATE)
    save_numpy_as_wav(mixed, mixed_out, SAMPLE_RATE)

    job._source_paths["click"] = click_out
    job._source_paths["mixed"] = mixed_out
    job.files["mixed"] = _url_for(job.id, "mixed", "wav")
    return {"job_id": job_id, "bpm": bpm}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
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


@app.get("/api/jobs/{job_id}/audio/{variant}.{fmt}")
def audio_file(job_id: str, variant: str, fmt: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    if job.status != "done":
        raise HTTPException(409, "Job not finished")

    entry = job._source_paths.get(variant)
    if entry is None:
        raise HTTPException(404, f"No {variant} output for this job")

    # Serve whichever wav exists for this variant.  `fmt` only shapes the URL.
    path = entry
    if not path.exists():
        raise HTTPException(404, "Output file missing on disk")
    return FileResponse(str(path), media_type="audio/wav", filename=f"{variant}.wav")