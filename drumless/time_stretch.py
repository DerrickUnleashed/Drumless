"""Practice-speed control — time-stretch without pitch change.

Uses pyrubberband (high quality; requires the `rubberband` binary, which
bundled wheels provide) with a fallback to librosa.effects.time_stretch
(pure Python/FFT-based, lower quality but zero extra install).

Rate semantics: rate = speed_multiplier.
    - rate > 1.0  -> faster  (e.g. 1.2 = 120%)
    - rate < 1.0  -> slower  (e.g. 0.5 = 50%)
"""
from __future__ import annotations

import io
import tempfile
import wave
from pathlib import Path

import numpy as np

from .audio_utils import save_numpy_as_wav


def _try_pyrubberband(audio: np.ndarray, sr: int, rate: float) -> np.ndarray | None:
    """Try rubberband-based stretch; return None if unavailable, raise on explicit use."""
    try:
        import pyrubberband as pyrb
        # pyrb.time_stretch expects float32 mono-ish arrays; handle stereo by
        # splitting channels (implementation detail — it actually accepts N-d).
        result = pyrb.time_stretch(audio, sr, rate)
        return result.astype(np.float32)
    except ImportError:
        return None


def _librosa_stretch(audio: np.ndarray, rate: float) -> np.ndarray:
    """librosa.effects.time_stretch is mono — handle stereo by stretching each chan."""
    import librosa
    if audio.ndim == 1:
        return librosa.effects.time_stretch(audio, rate=rate).astype(np.float32)
    chans = [librosa.effects.time_stretch(audio[:, c], rate=rate) for c in range(audio.shape[1])]
    return np.stack(chans, axis=-1).astype(np.float32)


def time_stretch(audio: np.ndarray, sr: int, rate: float) -> np.ndarray:
    """Stretch/compress `audio` in time by `rate` without changing pitch.

    Raises RuntimeError if pyrubberband is explicitly desired but unavailable;
    otherwise silently falls back to librosa.
    """
    if abs(rate - 1.0) < 1e-3:
        return audio

    # Prefer rubberband for quality; fallback to librosa.
    stretched = _try_pyrubberband(audio, sr, rate)
    if stretched is None:
        stretched = _librosa_stretch(audio, rate)
    return stretched
