<img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/79c53604-e543-48d9-a615-13c59f2b97b3" />

Builds a **drum-free backing track** from any song, auto-detects its **tempo (BPM)**,
and generates a **click track** locked to that tempo - great for focused practice reps.

Two clients, one processing engine:

| Layer | Tech | Location |
| --- | --- | --- |
| **Android app** | Kotlin + Jetpack Compose | `android/` |
| **API backend** | FastAPI wrapping the Python pipeline | `server/` |
| **Web UI** | React + TypeScript + Vite | `frontend/` |

---

## How to run

```bash
pip3 install -r requirements.txt
./run.sh
```

> **First run:** Demucs downloads its model weights (~300MB) automatically.

### API

- `POST /api/jobs` - multipart `file` **or** form `url` (YouTube). Returns `{job_id}`.
- `GET /api/jobs/{id}` - polls status/progress/BPM; `files` maps variants → audio URLs.
- `POST /api/jobs/{id}/regen` - `{bpm?, click_gain_db?}` re-renders click/mixed.
- `GET /api/jobs/{id}/audio/{variant}.{wav,mp3}` - streams `backing`/`mixed`.

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
