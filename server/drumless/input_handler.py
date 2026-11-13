"""Input handling - turn either a file or a YouTube URL into a 44.1kHz stereo WAV."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from .audio_utils import convert_to_wav44100_stereo, get_duration_seconds

# Max input duration in seconds (keeps CPU processing time sane)
MAX_DURATION_SECONDS = 10 * 60

# Formats we accept for direct file upload
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".opus", ".webm"}

# Targeted help shown only when yt-dlp reports its missing-JS-runtime warning
# AND we couldn't auto-detect a runtime on PATH (node/deno/bun).
JS_RUNTIME_HINT = (
    "  0. YouTube requires a JS runtime for extraction and none was found on "
    "your PATH. Install one with:\n"
    "       brew install deno     (recommended)\n"
    "     or  brew install node   (Drumless auto-detects either).\n"
)


def _find_js_runtime_args() -> list[str]:
    """Return `--js-runtimes` CLI args if a usable JS runtime is on PATH.

    Newer yt-dlp only enables deno by default, so node/bun need to be passed
    explicitly or extraction fails with "No supported JavaScript runtime".
    Debian's `nodejs` package is often installed as `nodejs`, not `node`.
    """
    explicit = os.environ.get("YTDLP_JS_RUNTIME")
    if explicit:
        return ["--js-runtimes", explicit]

    for runtime in ("deno", "node", "nodejs", "bun"):
        path = shutil.which(runtime)
        if path:
            return ["--js-runtimes", f"{runtime}:{path}"]
    return []


def _network_args(workdir: Path) -> tuple[list[str], Path | None]:
    """Optional proxy / cookie support for datacenter-hosted deployments.

    YouTube blocks many cloud IP ranges (429 + "Sign in to confirm you're not a
    bot"). Two escape hatches, both provided via env:

      YTDLP_PROXY         proxy URL, e.g. http://user:pass@host:port
      YTDLP_COOKIES       Netscape cookies.txt contents (secret env var)
      YTDLP_COOKIES_FILE  path to cookies.txt on disk

    Returns (args, temp_cookie_file_to_cleanup).
    """
    args: list[str] = []
    cleanup: Path | None = None

    proxy = os.environ.get("YTDLP_PROXY")
    if proxy:
        args += ["--proxy", proxy]

    cookie_file = os.environ.get("YTDLP_COOKIES_FILE")
    if cookie_file:
        args += ["--cookies", cookie_file]
    else:
        cookies = os.environ.get("YTDLP_COOKIES")
        if cookies:
            workdir.mkdir(parents=True, exist_ok=True)
            cleanup = workdir / ".yt_cookies.txt"
            cleanup.write_text(cookies)
            cleanup.chmod(0o600)
            args += ["--cookies", str(cleanup)]

    return args, cleanup


class InputError(Exception):
    """User-facing input error (shown directly in UI, not a stack trace)."""


class DurationError(InputError):
    """Raised when the input is longer than MAX_DURATION_SECONDS."""


def _validate_duration(path: Path) -> None:
    duration = get_duration_seconds(path)
    if duration > MAX_DURATION_SECONDS:
        raise DurationError(
            f"Input is {duration:.0f}s ({duration / 60:.1f} min) - Drumless caps inputs at "
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
    js_runtime_args = _find_js_runtime_args()
    network_args, cookies_temp = _network_args(workdir)
    cmd = [
        # Run yt-dlp as a module via the current interpreter so it works even
        # when .venv/bin isn't on PATH.
        sys.executable, "-m", "yt_dlp",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "wav",
        "--audio-quality", "0",
        "-o", str(workdir / "yt_%(id)s.%(ext)s"),
        "--no-playlist",
        "--postprocessor-args", "ffmpeg:-ar 44100 -ac 2",
        *js_runtime_args,
        *network_args,
        # Fetch the EJS challenge-solver script so YouTube's JS/n challenges
        # resolve without manual setup (see wikis/External-Programs).
        "--remote-components", "ejs:github",
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
    finally:
        if cookies_temp is not None:
            cookies_temp.unlink(missing_ok=True)

    # Find the produced wav first: a nonzero exit code can be an *abort*, not a
    # failure (e.g. "Maximum number of downloads reached"), so if the WAV exists
    # we treat the run as a success and only report real failures otherwise.
    wav_files = sorted(workdir.glob("yt_*.wav"))
    if wav_files:
        wav_path = wav_files[0]
        _validate_duration(wav_path)
        return wav_path

    if result.returncode != 0:
        # Surface a troubleshooting-oriented message rather than a raw stack trace.
        raise InputError(
            "Failed to download from YouTube. This is very often a yt-dlp staleness issue.\n\n"
            "Troubleshooting steps:\n"
            + (JS_RUNTIME_HINT if "No supported JavaScript runtime" in result.stderr else "")
            + "  1. Update yt-dlp:  pip install -U yt-dlp  (or: yt-dlp -U)\n"
            "  2. If it still fails, YouTube may be requiring browser cookies. Pass your "
            "browser's cookies file, e.g. add:  --cookies-from-browser chrome\n\n"
            f"Last error output:\n{(result.stderr or '')[-1500:] or (result.stdout or '')[-1500:]}"
        )

    # Exit code 0 but no WAV produced - shouldn't happen with -x/--audio-format wav.
    raise InputError("Download reported success but no WAV was produced (unexpected yt-dlp behavior).")
