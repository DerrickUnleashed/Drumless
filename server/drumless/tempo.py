"""Tempo (BPM) and beat detection via librosa.

Strategy: prefer beat tracking on the isolated DRUMS stem — the drum onset
envelope is cleaner and more reliable than the full mix.  Fall back to the
full mix if the drums stem is near-silent (e.g. a drum-less track).

We report three things:
    - bpm        : the BPM number (librosa.feature.tempo)
    - beat_times : timestamps in seconds where beats fall (for click placement)
    - beat_frame : frame indices (for librosa.clicks when given sr)

Tweak the BPM here (start_bpm, etc.) if a given song misdetects — beat
trackers commonly report half or double the "felt" tempo.
"""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np

from .audio_utils import load_audio_as_numpy

# Detection knobs — adjust for your tastes.
START_BPM = 120.0    # beats-per-minute prior used by librosa.beat.beat_track
SILENCE_THRESHOLD = 1e-4   # RMS below this -> treat drums stem as near-silent (RMS handled below)


def _rms(audio: np.ndarray) -> float:
    """Overall RMS of a (possibly stereo) audio array."""
    mono = np.mean(audio, axis=-1) if audio.ndim > 1 else audio
    return float(np.sqrt(np.mean(mono ** 2)))


def detect_tempo(
    full_mix_path: Path,
    drums_stem_path: Path | None,
    sr: int = 44100,
) -> dict:
    """Detect BPM + beat timestamps.  Prefers drums stem, falls back to full mix."""
    precedence = []  # (label, path) tried in order

    if drums_stem_path is not None and Path(drums_stem_path).exists():
        try:
            drums, _ = load_audio_as_numpy(drums_stem_path, sr)
            if _rms(drums) > SILENCE_THRESHOLD:
                precedence.append(("drums-stem", drums_stem_path))
            else:
                print("[tempo] drums stem is near-silent; falling back to full mix")
        except Exception as e:  # noqa: BLE001  — fall through on any load error
            print(f"[tempo] could not load drums stem ({e}); falling back to full mix")

    precedence.append(("full-mix", full_mix_path))

    # Use whichever track came first (drums preferred).
    label, chosen = precedence[0]
    audio, sr_ = load_audio_as_numpy(chosen, sr)
    mono = np.mean(audio, axis=-1)

    # Main beat tracker.  beat_track returns (tempo, beat_frames).
    tempo, beat_frames = librosa.beat.beat_track(
        y=mono, sr=sr_, units="frames", start_bpm=START_BPM, trim=False
    )
    tempo = float(np.atleast_1d(tempo)[0])

    # beat_track can return a degenerate tempo (0 / inf) on very short or
    # atypical audio — clamp to a sane range so downstream math never divides
    # by zero or produces a nonsense click grid.
    if not np.isfinite(tempo) or not (30 <= tempo <= 400):
        tempo = START_BPM

    # Also compute a plain tempo estimate (librosa.feature.tempo) for cross-check.
    hop_length = 512
    tempo_env = librosa.feature.tempo(
        y=mono, sr=sr_, hop_length=hop_length, start_bpm=START_BPM
    )
    tempo_env_val = float(np.atleast_1d(tempo_env)[0])
    if not np.isfinite(tempo_env_val) or not (30 <= tempo_env_val <= 400):
        tempo_env_val = tempo

    # Beat timestamps in seconds for click placement.
    beat_frame_times = librosa.frames_to_time(beat_frames, sr=sr_, hop_length=hop_length)
    beat_times = np.asarray(beat_frame_times)

    # Fallback: if beat tracking returned nothing useful, synthesize a grid.
    if beat_times.size == 0:
        duration_s = len(audio) / sr_
        beat_times = np.arange(0.0, duration_s, 60.0 / tempo)
        beat_times = np.clip(beat_times, 0.0, duration_s)

    return {
        "bpm": tempo,
        "bpm_env": tempo_env_val,
        "beat_times": beat_times,
        "beat_frames": beat_frames,
        "sr": sr_,
        "source": label,
        "duration_s": len(audio) / sr_,
    }
