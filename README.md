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
pip3 install -r server/requirements.txt
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
  render.yaml           Render blueprint (Free tier evaluation)
supabase/
  migrations/           tracks table, RLS, private drumless-audio bucket
```

## Accounts, storage, and the track library

Authenticated requests (`Authorization: Bearer <supabase access token>`) switch
the backend into persistent mode:

- Track metadata is stored in `public.tracks` (Supabase Postgres, RLS-scoped to
  `auth.uid()`).
- Audio is uploaded to the private `drumless-audio` bucket under
  `{user_id}/{track_id}/` and served through short-lived signed URLs.
- The web studio signs users in with Supabase Auth email + password.

New endpoints:

- `GET /api/tracks` - list the caller's tracks.
- `GET /api/tracks/{id}` - fetch one track.
- `PATCH /api/tracks/{id}` - `{custom_name}` rename.
- `DELETE /api/tracks/{id}` - delete the row and all stored audio.
- `GET /api/tracks/{id}/url?variant=backing|mixed|original&format=wav|mp3&download=bool`
  - signed playback/download URL.

Requests without a bearer token keep using the original in-memory job store, so
existing Android builds continue to work. Authenticated jobs return the track id
as `job_id`, so the same polling endpoints apply.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | backend | Project URL |
| `SUPABASE_ANON_KEY` | backend | Token verification |
| `SUPABASE_SERVICE_ROLE_KEY` | backend **only** | RLS-bypassing DB/storage access |
| `DATA_DIR` | backend | Pipeline scratch space |
| `SIGNED_URL_TTL` | backend | Signed URL lifetime (seconds) |
| `VITE_API_BASE_URL` | frontend | Render API base URL |
| `VITE_SUPABASE_URL` | frontend | Project URL |
| `VITE_SUPABASE_ANON_KEY` | frontend | Public anon key |

See `server/.env.example` and `frontend/.env.example`.

### Free-tier reality check

Deployed on Render Free (512MB RAM, ephemeral filesystem) + Supabase Free +
Vercel Free. Demucs needs roughly 1GB+ for comfortable separation, so on the
free box:

- Keep practice clips short; long tracks can OOM the container.
- Model weights re-download after cold starts (no persistent disk).
- Jobs are serialized to avoid concurrent OOMs.
- **YouTube links usually fail from Render's datacenter IP** (`429` / "Sign in
  to confirm you're not a bot"). Local runs work because of the residential IP.
  Use file upload in production, or set `YTDLP_PROXY` / `YTDLP_COOKIES` in the
  Render environment.
- Upgrade Render to Standard (4GB) with a persistent disk (see comments in
  `server/render.yaml`) for reliable use.
