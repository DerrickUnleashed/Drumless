# Drumless 🥁 — Drum-Removal + Practice Tempo Tool

Builds a **drum-free backing track** from any song, auto-detects its **tempo (BPM)**,
and generates a **click track** locked to that tempo — great for focused practice reps.

Two clients, one processing engine:

| Layer | Tech | Location |
| --- | --- | --- |
| **Android app** | Kotlin + Jetpack Compose | `android/` |
| **API backend** | FastAPI wrapping the Python pipeline | `server/` |
| **Desktop UI** (optional) | Gradio | `server/app.py` |

The phone can't run Demucs, so the Android app is a thin client: it uploads a file
(or sends a YouTube URL) to the backend, polls for progress, and plays/downloads the
three output variants (backing / click / mixed).

---

## Backend (Python + FastAPI)

Requires Python 3.10+ and `ffmpeg` (Homebrew: `brew install ffmpeg`).

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -U yt-dlp          # YouTube is a moving target
uvicorn api:app --host 0.0.0.0 --port 8000
```

> **First run:** Demucs downloads its model weights (~300MB) automatically.

### API

- `POST /api/jobs` — multipart `file` **or** form `url` (YouTube). Returns `{job_id}`.
- `GET /api/jobs/{id}` — polls status/progress/BPM; `files` maps variants → audio URLs.
- `POST /api/jobs/{id}/regen` — `{bpm?, click_gain_db?, speed?}` re-renders click/mixed.
- `GET /api/jobs/{id}/audio/{variant}.wav` — streams `backing`/`click`/`mixed`.

### Desktop Gradio UI (optional)

```bash
python server/app.py    # Gradio at http://127.0.0.1:7860
```

### Deploy (Render)

`server/render.yaml` + `Dockerfile` are included. Requirements: **Standard instance
(~4GB RAM for Demucs on CPU)**, a **persistent disk** mounted at `/app/data` (job
outputs + `TORCH_HOME` model cache survive restarts). YouTube-from-datacenter-IP is
fragile — the upload path is the dependable one.

---

## Android app

### Run

1. Start the backend, then note your computer's LAN IP (e.g. `192.168.1.20`).
2. Open `android/` in **Android Studio** and run on a device/emulator.
3. In the app's **Backend URL** field enter `http://<your-LAN-IP>:8000/`
   (default `http://10.0.2.2:8000/` works from the emulator).

### Build from the CLI

```bash
cd android
export JAVA_HOME=<jdk17+> ANDROID_HOME=<android-sdk>
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

### What's inside

```
android/app/src/main/java/com/drumless/app/
  data/        Retrofit API + kotlinx.serialization models
  ui/          Home / Progress / Results screens
  MainActivity Kotlin + Compose entry point
  TrackPlayerCard   ExoPlayer playback + Save (MediaStore)
  MainViewModel Job submission + 2s status polling + regen
```

---

## Project structure

```
android/                Kotlin/Compose mobile app (Android Studio project)
server/
  api.py                FastAPI backend (job API + background worker thread)
  app.py                Optional Gradio desktop UI
  drumless/
    input_handler.py    yt-dlp URL download / file validation → 44.1kHz WAV
    separation.py       Demucs stems + backing build (bass+vocals+other)
    tempo.py            librosa BPM + beat detection (drums-stem preferred)
    click_track.py      librosa.clicks metronome + click/backing mix
    time_stretch.py     pyrubberband / librosa time-stretch (no pitch change)
    audio_utils.py      ffmpeg conversion, export, mixing, gain
    pipeline.py         stage orchestrator
  Dockerfile            containerized backend
  render.yaml           Render blueprint (Standard + persistent disk)
```

### Tweaking

- **Model choice:** `htdemucs` (fast) vs `htdemucs_ft` (better, ~4× slower) — swap
  the model argument in the job POST (`model` form field) or edit
  `drumless/separation.py::run_demucs`.
- **Beat detection:** `START_BPM` and other knobs in `tempo.py::detect_tempo`; it
  prefers the drums stem and falls back to the full mix when drums are near-silent.

---

## Known limitations

- **Separation artifacts.** Demucs isn't perfect: bright mixes bleed cymbals into
  "other"; bass-heavy tracks bleed bass into "drums". Model-quality ceiling, not a bug.
- **yt-dlp fragility.** YouTube actively fights downloaders. The upload path always works.
- **Speed-only CPU.** No GPU required, but one speeds separation up dramatically.
- **Max input length.** 10 minutes, to keep CPU processing sane.
- **Downbeat accenting** (louder beat-1 clicks) not implemented — needs a reliable
  time-signature estimate.
- **Cloud deployment**: single-process in-memory job store. For many concurrent users,
  move to a Redis queue + background workers and S3/R2 for outputs (the API contract
  is queue-agnostic).
- **Personal use only.** For tracks you own or have rights to. Downloading YouTube
  audio can run against YouTube's ToS — keep it personal, not redistributed.