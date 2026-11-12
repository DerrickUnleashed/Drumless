"""Click / metronome track synthesis via librosa.clicks.

Synthesize a metronome aligned to detected beats, at an adjustable gain
relative to the backing mix (default +6dB, so the click plays above the music).

Stretch (not MVP): accenting downbeats louder requires a time-signature /
downbeat guess, which is meaningfully harder.  Left as later polish.
"""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np

from .audio_utils import save_numpy_as_wav, apply_gain_db, load_audio_as_numpy


def synthesize_click_track(
    beat_times: np.ndarray,
    sr: int,
    length: int,
    sound_freq: float = 1500.0,
) -> np.ndarray:
    """Return a mono float32 click track of `length` samples.

    librosa.clicks places tick sounds at each beat time; we render to a
    zero-length buffer sized to the backing track so the click aligns
    sample-exactly with the mix.
    """
    clicks = librosa.clicks(
        times=beat_times,
        sr=sr,
        click_freq=sound_freq,
        length=length,
    )
    clicks = clicks.astype(np.float32)

    # Convert mono click to stereo for mixing with the stereo backing track.
    stereo = np.stack([clicks, clicks], axis=-1)
    return stereo


def build_mixed_track(backing: np.ndarray, click: np.ndarray, click_gain_db: float) -> np.ndarray:
    """Mix backing + click, applying click gain in dB to the click."""
    click_scaled = apply_gain_db(click, click_gain_db)
    mix = backing + click_scaled
    peak = np.abs(mix).max()
    if peak > 1.0:
        mix = mix / peak
    return mix
