<img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/79c53604-e543-48d9-a615-13c59f2b97b3" />
<img width="1903" height="958" alt="image" src="https://github.com/user-attachments/assets/e7680c25-ac86-4bda-b9ab-063e8b824cb0" />

Builds a **drum-free backing track** from any song, auto-detects its **tempo (BPM)**,
and generates a **click track** locked to that tempo - great for focused practice reps.
---
### Features
- Drum separation via Demucs AI model
- Auto BPM detection from drum stem
- Click track locked to first beat
- YouTube URL or local audio file input
- WAV & MP3 download options
- Backing (no drums) + Mixed (backing + click) tracks
- BPM halve/double adjustment
- Click volume control (-20 dB to +6 dB)
- Three-client: Android (Kotlin/Compose), Web (React/TS), API (FastAPI/Python)

Two clients, one processing engine:

| Layer | Tech | Location |
| --- | --- | --- |
| **Android app** | Kotlin + Jetpack Compose | `android/` |
| **API backend** | FastAPI wrapping the Python pipeline | `server/` |
| **Web UI** | React + TypeScript + Vite | `frontend/` |
---

## How to run

```bash
pip3 install -r server/requirements.txt
./run.sh
```

> **First run:** Demucs downloads its model weights (~300MB) automatically.

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
  render.yaml           Render blueprint (Free tier evaluation)
supabase/
  migrations/           tracks table, RLS, private drumless-audio bucket
```

> **Note:** Deployed on Render Free (512MB RAM, ephemeral filesystem) + Supabase Free + Vercel Free. Demucs needs roughly 1GB+ for comfortable separation, so on the free box there might be issues with the deployed backend.
