"""Audio utility helpers — format conversion, mixing, export."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from pydub import AudioSegment


# ---------------------------------------------------------------------------
# Format conversion
# ---------------------------------------------------------------------------

def convert_to_wav44100_stereo(input_path: str | Path, output_path: str | Path) -> Path:
    """Convert any audio file to 44.1 kHz stereo WAV via ffmpeg."""
    output_path = Path(output_path)
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-ar", "44100", "-ac", "2",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def wav_to_mp3(wav_path: str | Path, mp3_path: str | Path) -> Path:
    """Convert WAV to MP3 via ffmpeg."""
    mp3_path = Path(mp3_path)
    cmd = [
        "ffmpeg", "-y", "-i", str(wav_path),
        "-codec:a", "libmp3lame", "-b:a", "192k",
        str(mp3_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return mp3_path


# ---------------------------------------------------------------------------
# Mixing / gain helpers
# ---------------------------------------------------------------------------

def load_audio_as_numpy(path: str | Path, sr: int = 44100) -> tuple[np.ndarray, int]:
    """Load audio file and return (samples, sr).  Mono → stereo if needed."""
    data, file_sr = sf.read(str(path), dtype="float32")
    if file_sr != sr:
        # Resample if needed (basic linear interpolation — fine for practice tool)
        from scipy.signal import resample
        num_samples = int(len(data) * sr / file_sr)
        data = resample(data, num_samples, axis=0)
    if data.ndim == 1:
        data = np.stack([data, data], axis=-1)
    return data, sr


def apply_gain_db(audio: np.ndarray, gain_db: float) -> np.ndarray:
    """Apply gain in dB."""
    return audio * (10 ** (gain_db / 20.0))


def mix_tracks(track_a: np.ndarray, track_b: np.ndarray, b_gain_db: float = -6.0) -> np.ndarray:
    """Mix two equal-length stereo arrays, applying gain to track_b."""
    b = apply_gain_db(track_b, b_gain_db)
    mix = track_a + b
    peak = np.abs(mix).max()
    if peak > 1.0:
        mix = mix / peak
    return mix


def save_numpy_as_wav(audio: np.ndarray, path: str | Path, sr: int = 44100) -> Path:
    """Save a stereo float32 numpy array as WAV."""
    path = Path(path)
    sf.write(str(path), audio, sr, subtype="PCM_16")
    return path


def get_duration_seconds(path: str | Path) -> float:
    """Return duration in seconds for any audio file ffmpeg can read."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return float(result.stdout.strip())
