"""Stem separation via Demucs (Hybrid Transformer).

Runs `demucs` as a subprocess on the canonical input WAV, producing four
stems: drums, bass, vocals, other.  The backing track is the SUM of
bass + vocals + other (we never just discard the drums track - we remix
the remaining three).

Model choice is configurable:
    - "htdemucs"    : default, fast, good quality
    - "htdemucs_ft" : fine-tuned variant, better quality, ~4x slower

NOTE: This deliberately runs demucs as a subprocess so it can run as a
background job with progress in the UI, and so a model change requires
no code restart (just a flag).  To tweak the model, change `model_name`.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable

import numpy as np

from .audio_utils import load_audio_as_numpy, save_numpy_as_wav

# Where demucs writes its output stems.  We clear/rescan this per run.
DEMUCS_OUTPUT_DIR = Path("separated")
DEMUCS_MODEL_DIR = Path.home() / ".cache" / "torch" / "hub"  # model weights live here

STEM_NAMES = ["drums", "bass", "vocals", "other"]


class SeparationError(Exception):
    """Friendly, user-facing separation failure."""


def run_demucs(
    input_wav: Path,
    model: str = "htdemucs",
    progress_cb: Callable[[int], None] | None = None,
    job_id: str = "job",
) -> Path:
    """Run Demucs on input_wav and return the folder containing the four stems
    (drums/bass/vocals/other .wav files).

    Each job is isolated under separated/<job_id>/ - demucs writes stems to
    <out>/<model>/<trackname>/ inside that root, where <trackname> is derived
    from the input filename (sanitized), so we locate it by searching.
    """
    job_root = DEMUCS_OUTPUT_DIR / job_id
    if job_root.exists():
        shutil.rmtree(job_root, ignore_errors=True)
    job_root.mkdir(parents=True, exist_ok=True)

    # The 4-stem htdemucs model produces drums/bass/vocals/other.  We do NOT use
    # --two-stems, which would collapse into just vocals/other and lose the
    # bass + drums isolation we need for the beat-detection fallback.
    cmd = [
        # Run demucs as a module via the current interpreter, mirroring the
        # yt-dlp approach: works even when .venv/bin isn't on PATH.
        sys.executable, "-m", "demucs",
        "-n", model,
        "-o", str(job_root),
        str(input_wav),
    ]

    if progress_cb:
        progress_cb("Starting Demucs separation… (first run downloads model weights, "
                    "which can be several hundred MB)")

    env = dict(os.environ)
    # Cap threads/allocator arenas: PyTorch otherwise reserves one arena per
    # core, which is what pushes a 512 MB container over the edge.
    threads = os.environ.get("DEMUCS_THREADS", "1")
    env["OMP_NUM_THREADS"] = threads
    env["MKL_NUM_THREADS"] = threads
    env["MALLOC_ARENA_MAX"] = "2"
    env["DEMUCS_NUM_THREADS"] = threads

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    except FileNotFoundError:
        raise SeparationError(
            "Demucs CLI not found. Install it with:  pip install demucs"
        )

    if result.returncode != 0:
        raise SeparationError(
            "Demucs separation failed.\n"
            f"Command: {' '.join(cmd)}\n"
            f"Output tail:\n{result.stdout[-1000:]}\n{result.stderr[-1000:]}"
        )

    # Locate the stem dir rather than re-deriving the sanitized trackname.
    stem_dirs = [p.parent for p in job_root.rglob("drums.wav")]
    if not stem_dirs:
        raise SeparationError(
            "Demucs finished but no drums.wav was found. Looked under: " + str(job_root))
    return stem_dirs[0]


def build_backing_track(stem_dir: Path, out_path: Path, sr: int = 44100) -> Path:
    """Sum bass + vocals + other into a single backing (drum-free) track.

    We mix the three stems rather than merely deleting the drums - this
    preserves the full musical content minus percussion.
    """
    loaded = {}
    for name in STEM_NAMES:
        stem_file = stem_dir / f"{name}.wav"
        if not stem_file.exists():
            raise SeparationError(f"Missing stem: {name}.wav in {stem_dir}")
        loaded[name], _ = load_audio_as_numpy(stem_file, sr)

    drums = loaded["drums"]
    bass = loaded["bass"]
    vocals = loaded["vocals"]
    other = loaded["other"]

    # All stems are same length+sr; sum and clamp to non-clipping range.
    backing = bass + vocals + other
    peak = np.abs(backing).max()
    if peak > 1.0:
        backing = backing / peak

    save_numpy_as_wav(backing, out_path, sr)

    # Also save a copy of the isolated drums stem alongside for beat detection.
    save_numpy_as_wav(drums, stem_dir / "drums_stem_44100.wav", sr)

    return out_path
