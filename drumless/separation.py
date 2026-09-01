"""Stem separation via Demucs (Hybrid Transformer).

Runs `demucs` as a subprocess on the canonical input WAV, producing four
stems: drums, bass, vocals, other.  The backing track is the SUM of
bass + vocals + other (we never just discard the drums track — we remix
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
import tempfile
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
    """Run Demucs on input_wav and return the per-job output folder.

    progress_cb(received_msgs) is called with an opaque message/tick counter;
    because demucs' own progress bar is hard to parse reliably via subprocess,
    we report coarse stage-level progress instead (see app.py usage of itertools).
    """
    # Use a temp dir so concurrent jobs don't collide on demucs' global
    # 'separated/' output directory.
    job_output = DEMUCS_OUTPUT_DIR / job_id
    if job_output.exists():
        shutil.rmtree(job_output, ignore_errors=True)

    # The 4-stem htdemucs model produces drums/bass/vocals/other.  We do NOT use
    # --two-stems, which would collapse into just vocals/other and lose the
    # bass + drums isolation we need for the beat-detection fallback.
    cmd = [
        "demucs",
        "-n", model,
        "-o", str(DEMUCS_OUTPUT_DIR),
        str(input_wav),
    ]

    if progress_cb:
        progress_cb("Starting Demucs separation… (first run downloads model weights, "
                    "which can be several hundred MB)")

    env = dict(os.environ)
    # Cap CPU threads so a long job doesn't starve the Gradio process.
    env["DEMUCS_NUM_THREADS"] = str(max(1, (os.cpu_count() or 4) - 1))

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

    return job_output


def build_backing_track(stem_dir: Path, out_path: Path, sr: int = 44100) -> Path:
    """Sum bass + vocals + other into a single backing (drum-free) track.

    We mix the three stems rather than merely deleting the drums — this
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
