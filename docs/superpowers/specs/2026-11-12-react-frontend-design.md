# Drumless React Frontend Design

Date: 2026-11-12
Status: Draft for approval
Approach chosen: A — fresh Vite + React + TypeScript + plain CSS frontend with full Gradio parity, including MP3 downloads

## Intent

Replace the optional Gradio desktop UI with a real web frontend that lives in a new
`frontend/` folder. Delete the existing `client/` folder entirely and do not reuse any
of its code. The React app talks to the existing FastAPI backend in `server/api.py`.

The React app must reproduce the Gradio workflow:

1. Paste a YouTube URL or upload an audio file.
2. Choose the Demucs separation model.
3. Start processing and see progress.
4. See the detected BPM, edit it, and use ×2 / ÷2 shortcuts.
5. Adjust click volume and regenerate the mix without re-running Demucs.
6. Play the backing+click mix and the drum-free backing track.
7. Download both outputs as WAV and MP3.

## What Exists Today

- `server/api.py` — FastAPI job API used by the Android app:
  - `POST /api/jobs` — multipart file or form URL, returns `{job_id}`.
  - `GET /api/jobs/{job_id}` — status, stage, progress, BPM, message, files.
  - `POST /api/jobs/{job_id}/regen` — rebuild click/mix at a BPM and gain.
  - `GET /api/jobs/{job_id}/audio/{variant}.{fmt}` — currently serves WAV only.
- `server/drumless/pipeline.py` — already produces WAV **and** MP3 for both final
  outputs, but the API drops the MP3 paths.
- `server/app.py` — Gradio UI, tightly coupled to Python functions in-process.
- `client/` — contains a static HTML client and an unrelated React/Vite demo.
- `run.sh` — starts FastAPI, a static client on port 3000, and Gradio in the
  foreground.

## Goals

- One frontend: a React single-page app in `frontend/` using the FastAPI job API.
- Feature parity with the Gradio UI, including MP3 downloads.
- Simple, dependency-light implementation: Vite, React, TypeScript, plain CSS.
- Clear component split under `frontend/src/components`.
- Gradio removed from runtime, code, dependencies, and docs.
- Existing Android client behavior preserved.

## Non-Goals

- No authentication, accounts, persistence, or multi-user job ownership.
- No job history, library, or saved tracks.
- No waveform editing, trimming, or advanced mixing controls.
- No SSR, Next.js, routing, or global state library.
- No automated end-to-end browser test suite in this change.
- No redesign of the visual identity beyond a clean, usable interface.

## Anti-Goals

- Do not keep Gradio as a fallback or hidden path.
- Do not import or copy code from `client/`.
- Do not change the pipeline's audio processing behavior.
- Do not break the Android app's existing API contract.

## Constraints

- Backend must remain usable by the Android app; additive API changes only.
- Demucs is slow; the frontend must use asynchronous jobs and progress polling,
  never a blocking request.
- The backend may serve only one running job at a time; the UI must show a clear
  409 error when another job is already processing.
- Audio files are served by the same FastAPI origin; Vite dev proxy must forward
  `/api` to `http://localhost:8000`.
- `ffmpeg` is available in production (Docker image installs it) and is used for
  MP3 conversion.
- Job state is in memory and job files are on local disk; a backend restart loses
  jobs. The UI reports unknown jobs as errors.

## Approaches Considered

### A. Fresh Vite + React + TypeScript + plain CSS, full parity — chosen

- New `frontend/` with Vite, React, TypeScript, and hand-written components.
- Plain CSS, no UI framework.
- Vite proxy `/api` to FastAPI.
- Backend gains MP3 serving so downloads match Gradio.

Trades off extra CSS work for a small, understandable dependency tree and no
unneeded framework. Best fit for a single-screen tool.

### B. Same React app, WAV-only

- No backend changes, fewer download buttons.
- Rejected because the user chose full Gradio parity.

### C. Next.js + Tailwind + shadcn

- More framework and generated components than this one-screen app needs.
- Rejected: SSR and routing add no value here.

## Decided With User

- Do not reuse `client/`; delete it.
- Create a new `frontend/` folder with `src` and `components`.
- Use React.
- Reproduce how Gradio presents the workflow.
- Full parity, including MP3 downloads.
- Fix the regen BPM timing bug instead of preserving it.
- Preserve the detected first-beat phase when regenerating at an edited BPM.
- Click volume range is **−20 dB to +20 dB**, default **+6 dB**.

## Architecture

### Request flow

1. User selects a file or enters a YouTube URL, chooses a model, submits.
2. Frontend sends `multipart/form-data` to `POST /api/jobs`.
3. On `{job_id}`, frontend starts polling `GET /api/jobs/{job_id}` every 2 seconds.
4. While `status` is `queued` or `running`, show stage and progress.
5. On `done`, show BPM, audio players, and download links.
6. User edits BPM and/or click gain and applies. Frontend calls
   `POST /api/jobs/{job_id}/regen`. Regen preserves the detected first-beat
   phase, rebuilds a full-length click grid, and regenerates mixed WAV and MP3.
7. On regen success, refresh audio URLs with a cache-busting query parameter so
   the browser reloads the new mix.
8. On `error`, stop polling and show `message`.

### Frontend structure

```text
frontend/
  index.html
  package.json
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    api.ts
    types.ts
    styles.css
    hooks/
      useJob.ts
    components/
      Header.tsx
      UploadForm.tsx
      ProgressPanel.tsx
      BpmControls.tsx
      ClickControls.tsx
      AudioPlayer.tsx
      AudioPanel.tsx
      DownloadPanel.tsx
      ErrorBanner.tsx
```

Builder may merge or rename minor files, but the component responsibilities and
`src` + `src/components` layout are fixed.

### Component responsibilities

- `App` — owns job state, selected file/URL/model, detected BPM, click gain;
  coordinates children.
- `Header` — title and one-line description.
- `UploadForm` — YouTube URL input, file input, model select, Process button,
  client-side validation that at least one source exists.
- `ProgressPanel` — stage label, progress bar, raw backend message, disabled
  controls while running.
- `BpmControls` — editable number input constrained to 40–300, ÷2 and ×2 buttons,
  detected-tempo summary.
- `ClickControls` — click-volume slider and Apply button.
- `AudioPanel` — two labeled players: Backing + click, Backing only.
- `DownloadPanel` — WAV and MP3 download links for both variants.
- `ErrorBanner` — dismissible error message for API/network failures.

### State and polling

- A `useJob(jobId)` hook polls every 2 seconds while an active job exists and
  stops on `done` or `error`.
- Polling uses `AbortController` or an active-job guard so stale responses and
  unmounts cannot overwrite newer state.
- Starting a new job resets previous output state.
- Regen is synchronous from the client's perspective; show an applying state and
  disable the Apply button until the response arrives.

## Backend API Changes

Additive only. Existing Android consumers keep working.

### Regen BPM timing fix

The current regen path treats a beat count as a frame index:

```python
librosa.frames_to_time(
    librosa.util.fix_frames(range(0, int(dur_s * bpm / 60))), sr=SAMPLE_RATE
)
```

At 120 BPM over 3 minutes this asks for 360 frames, so clicks stop after about
4 seconds. Replace it with real beat times in seconds:

```python
period = 60.0 / bpm
phase = job.first_beat % period
beat_times = np.arange(phase, dur_s, period)
```

- `process_track` adds `first_beat` (seconds, from `detection["beat_times"][0]`)
  to its result. This is additive and does not alter existing keys.
- `Job` stores `first_beat` when the pipeline finishes.
- Regen uses `first_beat % period` so the click keeps the detected first-beat
  phase at the new BPM, including ×2 and ÷2 edits.
- If `first_beat` is missing, fall back to 0.

### Job guard race safety

Wrap the "is a job already running" check and the job registration in a
`threading.Lock` so two rapid `POST /api/jobs` calls cannot both pass the guard.
Keep returning HTTP 409 with the existing message when busy.

### MP3 output paths

In `_run_job`, record the MP3 files the pipeline already creates:

- `backing_mp3` — `result["files"]["backing"]["mp3"]`
- `mixed_mp3` — `result["files"]["mixed"]["mp3"]`

Keep the existing `job.files` object unchanged for Android compatibility.

### MP3 endpoint behavior

Extend `GET /api/jobs/{job_id}/audio/{variant}.{fmt}`:

- `variant` remains `backing` or `mixed`.
- `fmt` accepts `wav` and `mp3`.
- For `mp3`, serve the recorded MP3. If it is missing, convert the WAV with
  `wav_to_mp3` and cache the result on disk.
- `Content-Type` is `audio/wav` for WAV and `audio/mpeg` for MP3.
- Unsupported formats or missing variants return 404.

### Regen MP3

`POST /api/jobs/{job_id}/regen` already writes a new mixed WAV. Also generate
`mixed_mp3` from it and update the stored MP3 path. The new filenames already
include a timestamp, so cache-busting on the client is enough.

### Optional response field

Add `downloads` to `GET /api/jobs/{job_id}` and to the create/regen responses if
useful:

```json
{
  "downloads": {
    "backing": {"wav": "/api/jobs/.../audio/backing.wav", "mp3": "/api/jobs/.../audio/backing.mp3"},
    "mixed": {"wav": "/api/jobs/.../audio/mixed.wav", "mp3": "/api/jobs/.../audio/mixed.mp3"}
  }
}
```

The React app may construct these URLs directly from `job_id`; the field is
optional and must not replace `files`.

## Gradio Parity Mapping

| Gradio element | React element |
| --- | --- |
| YouTube URL textbox | `UploadForm` URL input |
| File upload | `UploadForm` file input |
| Model dropdown | `UploadForm` select: `htdemucs`, `htdemucs_ft` |
| Process button + progress | `UploadForm` submit + `ProgressPanel` |
| BPM number, ÷2, ×2 | `BpmControls` |
| Detected tempo summary | `BpmControls` info line |
| Click volume slider, Apply | `ClickControls` |
| Backing+click player | `AudioPanel` first player |
| Backing-only player | `AudioPanel` second player |
| MP3 download files | `DownloadPanel` |

### Behavior decisions

- If both a URL and a file are supplied, the URL wins, matching the pipeline's
  current precedence. The UI shows a note when a URL is present.
- BPM and click controls are disabled until a job finishes, then enabled.
- Click-volume range: **−20 dB to +20 dB**, default **+6 dB**. This matches the
  pipeline's actual initial mix (`DEFAULT_CLICK_GAIN_DB = 6.0`) instead of
  Gradio's inconsistent slider whose default sat above its maximum.
- Regen keeps the detected first-beat phase, so a BPM correction stays aligned to
  the song instead of restarting the click at time zero.
- The detected BPM is rounded for display and clamped to 40–300.
- Audio player keys include a cache-busting value after regen so playback updates.
- Download filenames are set by the browser from the response filename.

## Files To Delete / Update

Delete:

- `client/` entirely.
- `server/app.py`.
- `.gradio/` if present and untracked.

Update:

- `server/api.py` — MP3 serving, regen timing fix, first-beat storage, job guard
  lock.
- `server/drumless/pipeline.py` — add `first_beat` to the pipeline result.
- `requirements.txt` — remove `gradio`, `gradio_client`, and Gradio-only packages
  that nothing else uses (for example `hf-gradio`, `safehttpx` if confirmed
  unused). Keep packages needed by the pipeline.
- `server/requirements.txt` — no Gradio entry exists; verify no change needed.
- `run.sh` — start FastAPI and `npm run dev` in `frontend/`; remove static client
  server and Gradio. Keep backend readiness wait.
- `README.md` — replace Gradio instructions with the React frontend, including
  install, dev, build, and backend start steps.
- `.gitignore` — remove `.gradio` if no longer relevant; add frontend build and
  dependency ignores if not covered by `frontend/.gitignore`.

Keep:

- `android/` untouched.
- `server/api.py` contract for Android; changes are additive.
- `server/Dockerfile`, `server/render.yaml` — backend-only, no change required.

## Dev Workflow

Terminal 1:

```bash
cd server
uvicorn api:app --host 0.0.0.0 --port 8000
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

`vite.config.ts` proxies `/api` to `http://localhost:8000`.

Production build:

```bash
cd frontend
npm run build
```

All API calls go through one `api.ts` helper. It uses `VITE_API_BASE` when set
and relative `/api/...` URLs otherwise. Dev uses the Vite proxy. Production
hosting of the built SPA is out of scope for this change: it can be served by a
static host or reverse proxy on the same origin as FastAPI, or a different
origin with `VITE_API_BASE` set and CORS already allowed by the backend. FastAPI
does not need to serve the built files, and adding that must not break the API
routes.

## Validation

- `cd frontend && npm run build` succeeds.
- `cd frontend && npm run lint` succeeds.
- Manual backend + frontend flow:
  - Upload a short audio file, process, observe progress, get BPM.
  - Play both tracks.
  - Download WAV and MP3 for both variants.
  - Change BPM, apply, confirm the mixed player updates and clicks continue for
    the full track length, not just the first few seconds.
  - Apply ×2 and ÷2, confirm clicks stay phase-aligned to the song.
  - Change click volume across −20 dB to +20 dB, apply, confirm the mixed player
    updates.
  - Submit a YouTube URL path.
  - Trigger the one-job-at-a-time 409 with rapid double submit and confirm a
    readable error.
- `curl` checks against the API for MP3 content type and file size.
- Android app still builds and can complete a job against the updated backend.

## What Is Left To The Builder

- Exact visual design, spacing, colors, and responsive breakpoints.
- Whether to add a small toast or keep errors inline.
- Whether to show a spinner vs. a progress bar for the regen call.
- Exact wording of labels and helper text.
- Whether to keep the optional `downloads` response field or construct URLs in the
  client only.
- How to present the detected tempo source (`librosa`, drums, etc.) beyond a short
  summary line.
- Whether to add a minimal frontend test setup; not required by this design.

## Risks

- **Long jobs and browser timeouts:** mitigated by async jobs and polling.
- **MP3 conversion cost:** conversion happens once and is cached on disk.
- **Cache stale audio after regen:** mitigated by cache-busting query parameters.
- **Backend restart loses job:** UI shows "Unknown job" from the 404.
- **Regen behavior change:** fixing beat timing and phase changes Android regen
  output too. This is intentional and improves the shared API; document it in
  the README.
- **Adding frontend build tooling:** keep it isolated in `frontend/`; do not make
  the Python backend depend on Node.
