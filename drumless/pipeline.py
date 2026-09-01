"""End-to-end pipeline manager.

Orchestrates: input -> separation -> backing -> tempo -> click -> export.
The Gradio app drives this with a progress callback so it can run as a
background job (separation is genuinely slow enough to matter on CPU).

Each call returns a batch of result file paths + metadata the UI renders
into audio players and download buttons.
"""
from __future__ import annotations

import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Callable

import numpy as np

from .audio_utils import (
    convert_to_wav44100_stereo,
    load_audio_as_numpy,
    mix_tracks,
    save_numpy_as_wav,
    wav_to_mp3,
)
from .click_track import build_mixed_track, synthesize_click_track
from .input_handler import (
    DurationError,
    InputError,
    download_youtube,
    process_file_upload,
)
from .separation import (
    DEMUCS_OUTPUT_DIR,
    STEM_NAMES,
    SeparationError,
    build_backing_track,
    run_demucs,
)
from .tempo import detect_tempo
from .time_stretch import time_stretch

DEFAULT_CLICK_GAIN_DB = -6.0


class PipelineError(Exception):
    """Top-level friendly failure wrapping any stage-specific error."""


def process_track(
    uploaded_file: str | None,
    yt_url: str | None,
    workdir: Path,
    model: str = "htdemucs",
    progress_cb: Callable[[str], None] | None = None,
) -> dict:
    """Run the full pipeline. Returns a dict of output file paths + metadata.

    `uploaded_file` and `yt_url` are mutually exclusive — the app passes
    whichever the user provided.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)


    # -- 1. INPUT -----------------------------------------------------------
    if progress_cb:
        progress_cb("(1/6) Preparing input audio…")
    if yt_url and yt_url.strip():
        input_wav = download_youtube(yt_url.strip(), workdir)
    elif uploaded_file:
        input_wav = process_file_upload(uploaded_file, workdir)
    else:
        raise InputError("Provide either a YouTube URL or upload an audio file.")


    # -- 2. STEM SEPARATION -------------------------------------------------
    if progress_cb:
        progress_cb("(2/6) Separating stems (Demucs)…")
    job_id = f"job_{int(time.time())}"
    try:
        stem_dir = run_demucs(input_wav, model=model, progress_cb=progress_cb, job_id=job_id)
    except SeparationError as e:
        raise PipelineError(str(e))

    if progress_cb:
        progress_cb("(3/6) Building drum-free backing track…")
    backing_wav = workdir / f"{job_id}_backing.wav"
    build_backing_track(stem_dir, backing_wav)
    drums_stem_wav = stem_dir / "drums_stem_44100.wav"


    # -- 3. TEMPO DETECTION --------------------------------------------------
    if progress_cb:
        progress_cb("(4/6) Detecting tempo…")
    detection = detect_tempo(backing_wav, drums_stem_wav if drums_stem_wav.exists() else None)
    bpm = detection["bpm"]


    # -- 4. CLICK TRACK ------------------------------------------------------
    if progress_cb:
        progress_cb("(5/6) Building click track…")
    backing_audio, sr = load_audio_as_numpy(backing_wav)
    click_mono = synthesize_click_track(
        detection["beat_times"], sr=sr, length=len(backing_audio)
    )
    click_wav = workdir / f"{job_id}_click.wav"
    save_numpy_as_wav(click_mono, click_wav, sr)


    # -- 5. EXPORT -----------------------------------------------------------
    if progress_cb:
        progress_cb("(6/6) Exporting audio…")
    backing_audio, sr = load_audio_as_numpy(backing_wav)
    click_audio, _ = load_audio_as_numpy(click_wav)
    mixed_audio = build_mixed_track(backing_audio, click_audio, DEFAULT_CLICK_GAIN_DB)

    backing_only_wav = workdir / f"{job_id}_backing_only.wav"
    click_only_wav = workdir / f"{job_id}_click_only.wav"
    mixed_wav = workdir / f"{job_id}_mixed.wav"
    save_numpy_as_wav(backing_audio, backing_only_wav, sr)
    save_numpy_as_wav(click_audio, click_only_wav, sr)
    save_numpy_as_wav(mixed_audio, mixed_wav, sr)

    # MP3 variants
    backing_only_mp3 = wav_to_mp3(backing_only_wav, workdir / f"{job_id}_backing_only.mp3")
    click_only_mp3 = wav_to_mp3(click_only_wav, workdir / f"{job_id}_click_only.mp3")
    mixed_mp3 = wav_to_mp3(mixed_wav, workdir / f"{job_id}_mixed.mp3")

    return {
        "job_id": job_id,
        "bpm": bpm,
        "bpm_env": detection["bpm_env"],
        "tempo_source": detection["source"],
        "model": model,
        "files": {
            "backing": {"wav": str(backing_only_wav), "mp3": str(backing_only_mp3)},
            "click": {"wav": str(click_only_wav), "mp3": str(click_only_mp3)},
            "mixed": {"wav": str(mixed_wav), "mp3": str(mixed_mp3)},
        },
    }


FLASH_MP3_DIR = Path("flash_mp3")


def stretch_and_mix(
    backing_wav: str,
    click_wav: str,
    speed: float,
    click_gain_db: float,
    workdir: Path,
) -> dict:
    """Time-stretch the backing + click, remix at a given speed (stretch goal).

    Returns new file paths for backing-only and mixed clips at that speed.
    """
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    sr = 44100
    backing, _ = load_audio_as_numpy(backing_wav, sr)
    click, _ = load_audio_as_numpy(click_wav, sr)

    # clip speed into usable range handled in UI; here just apply
    backing_st = time_stretch(backing, sr, speed)
    click_st = time_stretch(click, sr, speed)
    mixed = mix_tracks(backing_st, click_st, b_gain_db=click_gain_db)

    tag = f"stretch_{int(round(speed * 100))}_{int(round(click_gain_db))}"
    backing_out = workdir / f"{tag}_backing.wav"
    mixed_out = workdir / f"{tag}_mixed.wav"
    save_numpy_as_wav(backing_st, backing_out, sr)
    save_numpy_as_wav(mixed, mixed_out, sr)

    return {
        "backing": str(backing_out),
        "mixed": str(mixed_out),
        "bpm": None,
    }
