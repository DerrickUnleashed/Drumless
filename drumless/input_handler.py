"""Input handling — turn either a file or a YouTube URL into a 44.1kHz stereo WAV."""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from .audio_utils import convert_to_wav44100_stereo, get_duration_seconds

# Max input duration in seconds (keeps CPU processing time sane)
MAX_DURATION_SECONDS = 10 * 60

# Formats we accept for direct file upload
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".opus", ".webm"}


class InputError(Exception):
    """User-facing input error (shown directly in UI, not a stack trace)."""


class DurationError(InputError):
    """Raised when the input is longer than MAX_DURATION_SECONDS."""


def _validate_duration(path: Path) -> None:
    duration = get_duration_seconds(path)
    if duration > MAX_DURATION_SECONDS:
        raise DurationError(
            f"Input is {duration:.0f}s ({duration / 60:.1f} min) — Drumless caps inputs at "
            f"{MAX_DURATION_SECONDS // 60} minutes to keep CPU processing time reasonable. "
            "Trim the file or choose a shorter track."
        )


def process_file_upload(uploaded_path: str | Path, workdir: Path) -> Path:
    """Convert an uploaded audio file to the canonical analysis WAV.

    Returns the path to a 44.1kHz stereo WAV placed in workdir.
    """
    uploaded_path = Path(uploaded_path)
    if not uploaded_path.exists():
        raise InputError(f"Uploaded file not found: {uploaded_path}")

    ext = uploaded_path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InputError(
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Convert to canonical WAV *first* so the duration cap applies to the actual audio
    wav_out = uploaded_path.with_suffix(".input_44100.wav")
    convert_to_wav44100_stereo(uploaded_path, wav_out)
    _validate_duration(wav_out)
    return wav_out


def download_youtube(url: str, workdir: Path) -> Path:
    """Download best audio from a YouTube URL and convert to 44.1kHz stereo WAV.

    Returns the WAV path.  Raises InputError with a friendly troubleshooting
    message on download failures (yt-dlp/YouTube is a moving target).
    """
    workdir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "yt-dlp",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "wav",
        "--audio-quality", "0",
        "-o", str(workdir / "yt_%(id)s.%(ext)s"),
        "--no-playlist",
        "--max-downloads", "1",
        "--postprocessor-args", "ffmpeg:-ar 44100 -ac 2",
        url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except FileNotFoundError:
        raise InputError(
            "yt-dlp is not installed. Install it with:  pip install yt-dlp"
        )
    except subprocess.TimeoutExpired:
        raise InputError("YouTube download timed out (5 min). The video may be very long or blocked.")

    if result.returncode != 0:
        # Surface a troubleshooting-oriented message rather than a raw stack trace.
        raise InputError(
            "Failed to download from YouTube. This is very often a yt-dlp staleness issue.\n\n"
            "Troubleshooting steps:\n"
            "  1. Update yt-dlp:  pip install -U yt-dlp  (or: yt-dlp -U)\n"
            "  2. If it still fails, YouTube may be requiring browser cookies. Pass your "
            "browser's cookies file, e.g. add:  --cookies-from-browser chrome\n\n"
            f"Last error output:\n{result.stderr[-1500:]}"
        )

    # Find the produced wav (only one download because --max-downloads 1)
    wav_files = sorted(workdir.glob("yt_*.wav"))
    if not wav_files:
        raise InputError("Download succeeded but no WAV was produced (unexpected yt-dlp behavior).")
    wav_path = wav_files[0]

    _validate_duration(wav_path)
    return wav_path
