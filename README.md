# Drumless 🥁 — Drum-Removal + Practice Tempo Tool

A local, self-hosted (single-user) tool that builds a **drum-free backing track**
from any song, auto-detects its **tempo (BPM)**, and generates a **click track**
locked to that tempo — great for focused practice reps.

Input can be a **YouTube URL** or an **uploaded audio file** (mp3/wav/m4a/flac).
Output is three variants (backing-only, click-only, mixed) in both **WAV and MP3**,
with an optional **practice-speed** control (time-stretch without pitch change).

---

## Setup

Requires Python 3.10+ and `ffmpeg` on your PATH (Homebrew: `brew install ffmpeg`).

```bash
# 1. Create a virtualenv (optional but recommended)
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Recommended) make sure yt-dlp is recent — YouTube is a moving target
pip install -U yt-dlp

# 4. Run
python app.py
```

Open the printed URL (default http://127.0.0.1:7860).

> **First run:** Demucs downloads its model weights (~300MB) the first time you
> process a track. This happens automatically and can take a couple of minutes.

---

## Usage

1. **Paste a YouTube URL** or **upload a file**, pick a separation model, hit **Process**.
2. Progress runs as a background job (separation is slow on CPU — expect roughly
   1–4× realtime depending on hardware/model).
3. Read the **auto-detected BPM**. If it's wrong (half/double is common), use the
   **÷2 / ×2** buttons or edit the number directly, then hit **Apply BPM + click volume**.
4. Adjust **click volume** (default −6dB), optionally use the **speed** slider (50–150%)
   for slow/fast practice reps without pitch change.
5. **Download** any variant as WAV (in-place players) or MP3.

---

## Project structure

```
app.py                  Gradio UI + background job orchestration
drumless/
  __init__.py
  input_handler.py      URL download (yt-dlp) / file validation → canonical 44.1kHz WAV
  separation.py         Demucs stem separation + backing-track build (bass+vocals+other)
  tempo.py              librosa BPM + beat detection (drums-stem preferred)
  click_track.py        librosa.clicks metronome + click/backing mix
  time_stretch.py       pyrubberband / librosa time-stretch (no pitch change)
  audio_utils.py        ffmpeg conversion, WAV/MP3 export, mixing, gain
  pipeline.py           stage orchestrator
requirements.txt
```

### Tweaking

- **Model choice:** `DEMUCS_MODEL` in `app.py` (or the dropdown) — `htdemucs` (fast)
  vs `htdemucs_ft` (higher quality, ~4× slower). Model selection lives in
  `separation.py::run_demucs`.
- **Beat detection:** `START_BPM` and other knobs in `tempo.py::detect_tempo`.
  The function already prefers the isolated drums stem and falls back to the full
  mix when the drums are near-silent.

---

## Known limitations

- **Separation artifacts.** Demucs isn't perfect: bright mixes get some cymbal
  bleed into "other"; bass-heavy tracks bleed a little bass into "drums". This is a
  model-quality ceiling, not a bug — switch to `htdemucs_ft` for the best quality.
- **yt-dlp fragility.** YouTube actively fights downloaders, so yt-dlp breaks
  periodically. The failure message tells you the first troubleshooting steps
  (update yt-dlp, or pass browser cookies). If URL downloads keep failing, the
  **file-upload path always works**.
- **Speed-only on CPU.** No GPU is required (Demucs runs on CPU), but a GPU speeds
  separation up dramatically. If you have a CUDA GPU, install a CUDA build of
  PyTorch before installing Demucs.
- **Max input length.** Inputs are capped at 10 minutes to keep CPU processing sane.
- **Downbeat accenting** (louder clicks on beat 1) is not implemented — it needs a
  reliable time-signature estimate, which is meaningfully harder. Treated as later polish.
- **Personal use only.** This tool is for practicing on tracks you own or have
  rights to. Downloading YouTube audio can run against YouTube's ToS depending on
  the content — scope it to personal use, not redistribution.
