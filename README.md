<img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/79c53604-e543-48d9-a615-13c59f2b97b3" />

Builds a **drum-free backing track** from any song, auto-detects its **tempo (BPM)**,
and generates a **click track** locked to that tempo - great for focused practice reps.

Two clients, one processing engine:

| Layer | Tech | Location |
| --- | --- | --- |
| **Android app** | Kotlin + Jetpack Compose | `android/` |
| **API backend** | FastAPI wrapping the Python pipeline | `server/` |
| **Web UI** | React + TypeScript + Vite | `frontend/` |

The phone can't run Demucs, so the Android app is a thin client: it uploads a file
(or sends a YouTube URL) to the backend, polls for progress, and plays/downloads the
two output variants (backing only / backing + click).

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

- `POST /api/jobs` - multipart `file` **or** form `url` (YouTube). Returns `{job_id}`.
- `GET /api/jobs/{id}` - polls status/progress/BPM; `files` maps variants → audio URLs.
- `POST /api/jobs/{id}/regen` - `{bpm?, click_gain_db?}` re-renders click/mixed.
- `GET /api/jobs/{id}/audio/{variant}.{wav,mp3}` - streams `backing`/`mixed`.

### Web UI (React + Vite)

```bash
# Terminal 1 - backend
cd server && uvicorn api:app --host 0.0.0.0 --port 8000

# Terminal 2 - frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Or run both with the shortcut:

```bash
./run.sh
```

Production build:

```bash
cd frontend && npm run build
```

The web UI mirrors the Android flow: upload a file or paste a YouTube URL,
watch progress, play both tracks, download WAV or MP3, and re-render the click
at an edited BPM. Regen keeps the detected first-beat phase and covers the full
track.

### Deploy (Render)

`server/render.yaml` + `Dockerfile` are included. The service is currently deployed
on Render's **free tier** at `https://drumless.onrender.com/` (file uploads are the
dependable path - YouTube blocks datacenter IPs).

To deploy/update:

1. Push this repo to GitHub (Render builds from the repo; `rootDir: server` points
   at the backend).
2. Create a web service (or Blueprint from `render.yaml`), branch `master`,
   Docker runtime, health check `/api/health`, env vars `DATA_DIR=/app/data` and
   `TORCH_HOME=/app/data/torch`.
3. Verify: `curl https://<name>.onrender.com/api/health` → `{"status":"ok"}`.
4. In the Android app's **Backend URL** field enter `https://<name>.onrender.com/`
   - no LAN IP needed. (The backend is HTTPS, which Android requires.)

**Free tier reality check** (why the config defaults to it today):
- 512MB RAM: separation can **OOM on long songs** - keep track uploads short.
- No persistent disk: Demucs model weights (~300MB) re-download on every cold
  start (first request after idle can take minutes), and job outputs don't
  survive restarts.
- Deployed backend accepts **one job at a time** (serial guard) so a second
  concurrent Demucs run doesn't blow up the box.

**Upgrade for real use** (`render.yaml` documents this): switch plan to `standard`
(4GB) and attach a persistent disk at `/app/data` - then weights + outputs persist
and any reasonably-sized track works.

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
frontend/               React + TypeScript + Vite web UI
server/
  api.py                FastAPI backend (job API + background worker thread)
  drumless/
    input_handler.py    yt-dlp URL download / file validation → 44.1kHz WAV
    separation.py       Demucs stems + backing build (bass+vocals+other)
    tempo.py            librosa BPM + beat detection (drums-stem preferred)
    click_track.py      librosa.clicks metronome + click/backing mix
    audio_utils.py      ffmpeg conversion, export, mixing, gain
    pipeline.py         stage orchestrator
  Dockerfile            containerized backend
  render.yaml           Render blueprint (Standard + persistent disk)
```
