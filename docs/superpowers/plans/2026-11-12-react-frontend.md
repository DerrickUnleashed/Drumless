# Drumless React Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gradio and the old `client/` folder with a new React + TypeScript frontend in `frontend/`, backed by the existing FastAPI job API, with full Gradio feature parity.

**Architecture:** A Vite single-page React app polls the FastAPI job API, renders upload/progress/BPM/click/playback/download controls, and uses a Vite `/api` proxy in development. Backend changes are additive: corrected regen beat timing, detected first-beat phase, MP3 serving, and a race-safe one-job guard.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, plain CSS, FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-11-12-react-frontend-design.md`

**Commit policy:** Do not run `git commit` unless the human explicitly asks. Treat each task's final checkpoint as "leave the working tree ready for review."

## Global Constraints

- New frontend lives in `frontend/`; delete `client/` entirely and do not reuse its code.
- React + TypeScript + Vite + plain CSS. No Next.js, Tailwind, router, or state library.
- All API calls go through `frontend/src/api.ts`.
- Dev API base is relative `/api`; optional `VITE_API_BASE` overrides it for production.
- Poll job status every **2000 ms** while `queued` or `running`; stop on `done` or `error`.
- BPM range is **40–300**; models are exactly `htdemucs` and `htdemucs_ft`.
- Click volume range is **−20 dB to +20 dB**, default **+6 dB**.
- Valid upload extensions: `.mp3`, `.wav`, `.m4a`, `.flac`, `.aac`, `.ogg`, `.opus`, `.webm`.
- MP3 output uses `wav_to_mp3` at 192 kbps.
- If both a YouTube URL and a file are supplied, the URL wins.
- Backend API changes must be additive; Android's existing `{job_id}`, `files`, and audio URL shapes keep working.
- One job runs at a time; busy requests return HTTP 409 with a readable message.
- Deleting `client/`, `server/app.py`, and `.gradio/` happens only after the new frontend builds and its tests pass.
- Do not commit unless explicitly requested.

## Review Focus

1. **Both URL and file supplied:** the URL wins and the UI says so. Covered by `App` integration test in Task 10.
2. **BPM edited to ×2 or ÷2:** click runs for the full track and keeps the detected first-beat phase. Covered by `build_beat_times` tests in Task 1 and API regen test in Task 2.
3. **Busy backend, lost job, or network failure:** user sees a readable error and polling stops. Covered by `useJob` tests in Task 6 and `App` 409 test in Task 10.
4. **MP3 requested when missing:** endpoint converts from WAV and serves `audio/mpeg`; missing variant returns 404. Covered by API tests in Task 2.
5. **Regenerated audio:** players and downloads receive new URLs after regen, so the browser does not serve stale audio. Covered by `audioUrl` test in Task 5 and `App` regen test in Task 10.

---

### Task 1: Backend beat grid and first-beat metadata

**Files:**
- Modify: `server/drumless/click_track.py`
- Modify: `server/drumless/tempo.py`
- Modify: `server/drumless/pipeline.py`
- Create: `server/tests/test_click_track.py`
- Create: `server/tests/test_tempo.py`
- Create: `server/requirements-dev.txt`

**Interfaces:**
- Consumes: `numpy`, existing `detect_tempo` result key `beat_times`.
- Produces:
  - `build_beat_times(duration_s: float, bpm: float, first_beat: float | None = None) -> numpy.ndarray`
  - `first_beat_time(beat_times: numpy.ndarray) -> float`
  - Pipeline result gains `first_beat: float`.

- [ ] **Step 1: Add the dev test dependency**

Create `server/requirements-dev.txt`:

```text
-r requirements.txt
pytest>=8.0
```

Install into the existing virtualenv:

```bash
.venv/bin/pip install -r server/requirements-dev.txt
```

- [ ] **Step 2: Write the failing beat-grid tests**

Create `server/tests/test_click_track.py`:

```python
import numpy as np

from drumless.click_track import build_beat_times


def test_beat_grid_spans_full_duration():
    times = build_beat_times(duration_s=180.0, bpm=120.0, first_beat=0.3)
    assert len(times) > 300
    assert times[0] == 0.3
    assert times[-1] < 180.0
    assert np.allclose(np.diff(times), 0.5)


def test_beat_grid_preserves_phase_for_half_and_double():
    half = build_beat_times(duration_s=10.0, bpm=60.0, first_beat=0.1)
    double = build_beat_times(duration_s=10.0, bpm=240.0, first_beat=0.1)
    assert half[0] == 0.1
    assert double[0] == 0.1


def test_beat_grid_defaults_to_zero_phase():
    times = build_beat_times(duration_s=2.0, bpm=120.0, first_beat=None)
    assert times[0] == 0.0
```

- [ ] **Step 3: Run the beat-grid tests and verify they fail**

Run: `.venv/bin/python -m pytest server/tests/test_click_track.py -v`

Expected: FAIL with `ImportError: cannot import name 'build_beat_times'`.

- [ ] **Step 4: Implement `build_beat_times` in `server/drumless/click_track.py`**

```python
def build_beat_times(
    duration_s: float,
    bpm: float,
    first_beat: float | None = None,
) -> np.ndarray:
    """Return beat timestamps covering the full duration, preserving phase."""
```

Algorithm: period is `60.0 / bpm`; phase is `(first_beat or 0.0) % period`; return `np.arange(phase, duration_s, period)`.

- [ ] **Step 5: Write the failing first-beat tests**

Create `server/tests/test_tempo.py`:

```python
import numpy as np

from drumless.tempo import first_beat_time


def test_first_beat_time_returns_first_timestamp():
    assert first_beat_time(np.array([0.42, 0.92, 1.42])) == 0.42


def test_first_beat_time_returns_zero_when_empty():
    assert first_beat_time(np.array([])) == 0.0
```

- [ ] **Step 6: Run the first-beat tests and verify they fail**

Run: `.venv/bin/python -m pytest server/tests/test_tempo.py -v`

Expected: FAIL with `ImportError: cannot import name 'first_beat_time'`.

- [ ] **Step 7: Implement `first_beat_time` and use it in the pipeline**

Add to `server/drumless/tempo.py`:

```python
def first_beat_time(beat_times: np.ndarray) -> float:
    """Return the first beat timestamp, or 0.0 when no beats were detected."""
```

In `server/drumless/pipeline.py`, import `first_beat_time` and add to the return dict:

```python
"first_beat": first_beat_time(detection["beat_times"]),
```

- [ ] **Step 8: Run the backend tests**

Run: `.venv/bin/python -m pytest server/tests/test_click_track.py server/tests/test_tempo.py -v`

Expected: PASS.

- [ ] **Step 9: Checkpoint**

Run: `git diff -- server/drumless server/tests server/requirements-dev.txt`

Expected: only the intended files changed. Do not commit unless asked.

---

### Task 2: API regen timing, first beat, and MP3 serving

**Files:**
- Modify: `server/api.py`
- Create: `server/tests/test_api_audio.py`

**Interfaces:**
- Consumes: `build_beat_times` from Task 1, `wav_to_mp3` from `drumless.audio_utils`, pipeline result `first_beat`, `mixed`/`backing` MP3 paths.
- Produces:
  - `Job.first_beat: float | None`
  - `Job._source_paths` keys `backing`, `backing_mp3`, `click`, `mixed`, `mixed_mp3`
  - `GET /api/jobs/{job_id}/audio/{variant}.{fmt}` serves WAV and MP3
  - Regen writes `mixed_mp3`.

- [ ] **Step 1: Write the failing API tests**

Create `server/tests/test_api_audio.py`:

```python
import numpy as np
from fastapi.testclient import TestClient

import api


def make_wav(path, duration_s=2.0, sr=44100):
    from drumless.audio_utils import save_numpy_as_wav
    samples = np.zeros((int(duration_s * sr), 2), dtype=np.float32)
    save_numpy_as_wav(samples, path, sr)
    return path


def test_audio_mp3_endpoint_converts_and_serves_audio_mpeg(tmp_path):
    wav = make_wav(tmp_path / "backing.wav")
    job = api.Job("job_test")
    job.status = "done"
    job._source_paths = {"backing": wav}
    api.JOBS[job.id] = job

    client = TestClient(api.app)
    response = client.get("/api/jobs/job_test/audio/backing.mp3")

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0
    assert job._source_paths["backing_mp3"].exists()


def test_audio_missing_variant_returns_404(tmp_path):
    wav = make_wav(tmp_path / "backing.wav")
    job = api.Job("job_missing")
    job.status = "done"
    job._source_paths = {"backing": wav}
    api.JOBS[job.id] = job

    client = TestClient(api.app)
    response = client.get("/api/jobs/job_missing/audio/mixed.wav")

    assert response.status_code == 404


def test_regen_uses_detected_phase_and_writes_mixed_mp3(tmp_path, monkeypatch):
    backing = make_wav(tmp_path / "backing.wav", duration_s=2.0)
    click = make_wav(tmp_path / "click.wav", duration_s=2.0)
    job = api.Job("job_regen")
    job.status = "done"
    job.bpm = 120.0
    job.first_beat = 0.3
    job._source_paths = {"backing": backing, "click": click, "mixed": backing}
    api.JOBS[job.id] = job

    calls = {}

    def fake_build_beat_times(duration_s, bpm, first_beat=None):
        calls["args"] = (duration_s, bpm, first_beat)
        return np.array([0.3, 0.8, 1.3, 1.8])

    monkeypatch.setattr(api, "build_beat_times", fake_build_beat_times)

    client = TestClient(api.app)
    response = client.post("/api/jobs/job_regen/regen", json={"bpm": 120})

    assert response.status_code == 200
    assert calls["args"] == (2.0, 120.0, 0.3)
    assert job._source_paths["mixed_mp3"].exists()
```

- [ ] **Step 2: Run the API tests and verify they fail**

Run: `.venv/bin/python -m pytest server/tests/test_api_audio.py -v`

Expected: FAIL on MP3 format handling, missing `first_beat` argument, and missing `mixed_mp3`.

- [ ] **Step 3: Add first-beat and MP3 paths to jobs**

In `server/api.py`:

- Import `build_beat_times` from `drumless.click_track` and `wav_to_mp3` from `drumless.audio_utils`.
- Add `self.first_beat = None` to `Job.__init__`.
- In `_run_job`, set `job.first_beat = result.get("first_beat", 0.0)`.
- Extend `job._source_paths` with:

```python
"backing_mp3": Path(result["files"]["backing"]["mp3"]),
"mixed_mp3": Path(result["files"]["mixed"]["mp3"]),
```

- [ ] **Step 4: Fix regen beat generation**

In `regen`, replace the `librosa.frames_to_time(fix_frames(range(...)))` block with:

```python
beat_times = build_beat_times(dur_s, bpm, job.first_beat)
```

After writing the new mixed WAV, generate the MP3 and record it:

```python
mixed_mp3 = wav_to_mp3(mixed_out, d / f"{tag}_mixed.mp3")
job._source_paths["mixed_mp3"] = mixed_mp3
```

- [ ] **Step 5: Serve WAV and MP3**

In `audio_file`, map `(variant, fmt)` to the right path key:

- `fmt == "wav"` → `variant`
- `fmt == "mp3"` → `f"{variant}_mp3"`

If the MP3 path is missing, convert from the WAV path with `wav_to_mp3` and cache it in `_source_paths`. Return `audio/wav` for WAV and `audio/mpeg` for MP3. Return 404 for unsupported formats or missing variants.

- [ ] **Step 6: Run the API tests**

Run: `.venv/bin/python -m pytest server/tests/test_api_audio.py -v`

Expected: PASS. This requires `ffmpeg` on PATH.

- [ ] **Step 7: Checkpoint**

Run: `git diff -- server/api.py server/tests/test_api_audio.py`

Expected: only the intended changes. Do not commit unless asked.

---

### Task 3: Race-safe one-job guard

**Files:**
- Modify: `server/api.py`
- Create: `server/tests/test_api_jobs.py`

**Interfaces:**
- Consumes: `api.JOBS`, `api.Job`, `_run_job`.
- Produces: `api.JOB_LOCK` and a guard that treats both `queued` and `running` as busy.

- [ ] **Step 1: Write the failing guard tests**

Create `server/tests/test_api_jobs.py`:

```python
from fastapi.testclient import TestClient

import api


def test_second_job_while_first_is_queued_returns_409(monkeypatch):
    api.JOBS.clear()
    monkeypatch.setattr(api, "_run_job", lambda *args: None)
    client = TestClient(api.app)

    first = client.post("/api/jobs", data={"url": "https://example.com/a"})
    second = client.post("/api/jobs", data={"url": "https://example.com/b"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert "already processing" in second.json()["detail"]


def test_queued_job_blocks_new_job():
    api.JOBS.clear()
    queued = api.Job("job_queued")
    queued.status = "queued"
    api.JOBS[queued.id] = queued
    client = TestClient(api.app)

    response = client.post("/api/jobs", data={"url": "https://example.com/c"})

    assert response.status_code == 409
```

- [ ] **Step 2: Run the guard tests and verify they fail**

Run: `.venv/bin/python -m pytest server/tests/test_api_jobs.py -v`

Expected: FAIL because the current guard only checks `status == "running"` and has no lock.

- [ ] **Step 3: Add the lock and broaden the guard**

In `server/api.py`:

- Add `JOB_LOCK = threading.Lock()` near `JOBS`.
- In `create_job`, hold `JOB_LOCK` while checking whether any job has `status in {"queued", "running"}` and while registering the new `Job`.
- Keep the existing 409 message containing `"already processing"`.
- Start the worker thread after releasing the lock.

- [ ] **Step 4: Run the guard tests**

Run: `.venv/bin/python -m pytest server/tests/test_api_jobs.py -v`

Expected: PASS. If a test leaves jobs behind, clear `api.JOBS` in each test as shown.

- [ ] **Step 5: Run all backend tests**

Run: `.venv/bin/python -m pytest server/tests -v`

Expected: PASS.

- [ ] **Step 6: Checkpoint**

Run: `git diff -- server/api.py server/tests/test_api_jobs.py`

Expected: only the intended changes. Do not commit unless asked.

---

### Task 4: Scaffold the new `frontend/` Vite app

**Files:**
- Create: `frontend/` via Vite scaffold
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.tsx`
- Replace: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`
- Create: `frontend/.gitignore`

**Interfaces:**
- Produces: a Vite React TS app with scripts `dev`, `build`, `test`, `lint`; Vitest jsdom setup; `/api` proxy to `http://localhost:8000`; `VITE_API_BASE` typing.

- [ ] **Step 1: Scaffold the app**

From the repo root:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Write the failing smoke test**

Create `frontend/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the Drumless heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /drumless/i })).toBeInTheDocument();
  });
});
```

Create `frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Configure Vite, tests, and scripts**

In `frontend/vite.config.ts`, add:

```ts
test: {
  environment: "jsdom",
  setupFiles: "./src/test/setup.ts",
},
server: {
  proxy: { "/api": "http://localhost:8000" },
},
```

Use `defineConfig` from `vitest/config` so the `test` key is typed.

In `frontend/package.json`, set:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

Create `frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Run the smoke test and verify it fails**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: FAIL because the scaffolded App does not render a "Drumless" heading.

- [ ] **Step 5: Replace the app shell**

Set `frontend/src/App.tsx` to:

```tsx
import "./styles.css";

export default function App() {
  return (
    <main className="app">
      <h1>Drumless</h1>
      <p>Drum-free backing tracks with a practice click.</p>
    </main>
  );
}
```

Replace `frontend/src/index.css` contents with a minimal reset or delete it and import only `styles.css`. Create `frontend/src/styles.css` with base tokens, layout width, and form/control styles. Visual details are left to the builder.

- [ ] **Step 6: Run build and smoke test**

Run:

```bash
cd frontend
npm test -- src/App.test.tsx
npm run build
```

Expected: test PASS, build succeeds.

- [ ] **Step 7: Checkpoint**

Run: `git status --short frontend`

Expected: new frontend files only. Do not commit unless asked.

---

### Task 5: API client and shared types

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`

**Interfaces:**
- Consumes: `fetch`, `import.meta.env.VITE_API_BASE`.
- Produces:
  - Types: `JobStatusValue`, `AudioVariant`, `AudioFormat`, `JobFiles`, `JobStatus`, `CreateJobInput`, `RegenInput`, `JobModel`.
  - `JOB_MODELS: readonly ["htdemucs", "htdemucs_ft"]`
  - `class ApiError extends Error { status: number }`
  - `apiUrl(path: string): string`
  - `createJob(input: CreateJobInput): Promise<string>`
  - `getJob(jobId: string): Promise<JobStatus>`
  - `regenJob(jobId: string, input: RegenInput): Promise<void>`
  - `audioUrl(jobId: string, variant: AudioVariant, format: AudioFormat, version?: number | string): string`

- [ ] **Step 1: Write the failing API client tests**

Create `frontend/src/api.test.ts` covering:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, audioUrl, createJob, getJob, regenJob } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("createJob", () => {
  it("posts multipart data and returns the job id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: "job_1" }), { status: 201 }),
    );
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    await expect(createJob({ file, url: "", model: "htdemucs" })).resolves.toBe("job_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobs");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body.get("model")).toBe("htdemucs");
    expect((body.get("file") as File).name).toBe("song.wav");
    expect(body.get("url")).toBeNull();
  });

  it("throws ApiError with the backend detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Another job is already processing." }), { status: 409 }),
    );

    const error = await createJob({
      file: null,
      url: "https://example.com",
      model: "htdemucs",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Another job is already processing.",
    });
  });
});

describe("getJob", () => {
  it("fetches the job URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: "job_1", status: "done" }), { status: 200 }),
    );

    await getJob("job_1");

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job_1");
  });
});

describe("regenJob", () => {
  it("maps click gain to the backend field", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await regenJob("job_1", { bpm: 128, clickGainDb: 6 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobs/job_1/regen");
    expect(JSON.parse(init?.body as string)).toEqual({ bpm: 128, click_gain_db: 6 });
  });
});

describe("audioUrl", () => {
  it("builds WAV and MP3 URLs with a cache buster", () => {
    expect(audioUrl("job_1", "backing", "wav")).toBe("/api/jobs/job_1/audio/backing.wav");
    expect(audioUrl("job_1", "mixed", "mp3", 3)).toBe("/api/jobs/job_1/audio/mixed.mp3?v=3");
  });
});
```

The second 409 assertion may be redundant; keep one `ApiError` assertion and one detail/status assertion.

- [ ] **Step 2: Run the API client tests and verify they fail**

Run: `cd frontend && npm test -- src/api.test.ts`

Expected: FAIL because `src/api.ts` does not exist.

- [ ] **Step 3: Implement types and API client**

Create `frontend/src/types.ts` with the exact interfaces listed above.

Implementation notes for `frontend/src/api.ts`:

- `apiUrl(path)` returns `${import.meta.env.VITE_API_BASE ?? ""}${path}`.
- `createJob` builds `FormData`, appends `file` only when non-null, `url` only when non-empty after trim, and always `model`. Parse `{job_id}`.
- `getJob` fetches with `apiUrl(`/api/jobs/${jobId}`)`.
- `regenJob` sends JSON and maps `clickGainDb` to `click_gain_db`; omit undefined fields.
- Error handling: read `{detail}` when JSON, else use status text; throw `ApiError(message, status)`.
- `audioUrl` builds `/api/jobs/{id}/audio/{variant}.{format}` and appends `?v={version}` when `version` is not undefined.

- [ ] **Step 4: Run the API client tests**

Run: `cd frontend && npm test -- src/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short frontend/src`

Expected: only the intended files. Do not commit unless asked.

---

### Task 6: Job polling hook

**Files:**
- Create: `frontend/src/hooks/useJob.ts`
- Create: `frontend/src/hooks/useJob.test.ts`

**Interfaces:**
- Consumes: `getJob` from `../api`, `JobStatus` from `../types`.
- Produces:
  - `useJob(jobId: string | null): { job: JobStatus | null; error: string | null; refresh: () => Promise<void> }`

- [ ] **Step 1: Write the failing hook tests**

Create `frontend/src/hooks/useJob.test.ts` using `renderHook`, `waitFor`, and `vi.mock("../api")`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJob } from "../api";
import type { JobStatus } from "../types";
import { useJob } from "./useJob";

vi.mock("../api", () => ({ getJob: vi.fn() }));

const running: JobStatus = { job_id: "job_1", status: "running", stage: "separation", progress: 40, message: "Working", bpm: null, tempo_source: null, model: "htdemucs", files: {} };
const done: JobStatus = { ...running, status: "done", progress: 100, bpm: 128 };

beforeEach(() => vi.clearAllMocks());

describe("useJob", () => {
  it("fetches immediately and stops polling after done", async () => {
    vi.mocked(getJob).mockResolvedValueOnce(done);
    const { result } = renderHook(() => useJob("job_1"));

    await waitFor(() => expect(result.current.job?.status).toBe("done"));
    expect(getJob).toHaveBeenCalledTimes(1);
  });

  it("polls every two seconds while running", async () => {
    vi.useFakeTimers();
    vi.mocked(getJob).mockResolvedValueOnce(running).mockResolvedValueOnce(done);
    const { result } = renderHook(() => useJob("job_1"));

    await waitFor(() => expect(result.current.job?.status).toBe("running"));
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(result.current.job?.status).toBe("done"));
    expect(getJob).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("sets an error and stops polling when the request fails", async () => {
    vi.mocked(getJob).mockRejectedValue(new Error("Job not found"));
    const { result } = renderHook(() => useJob("job_1"));

    await waitFor(() => expect(result.current.error).toBe("Job not found"));
    expect(getJob).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the hook tests and verify they fail**

Run: `cd frontend && npm test -- src/hooks/useJob.test.ts`

Expected: FAIL because `useJob` does not exist.

- [ ] **Step 3: Implement `useJob`**

Behavior:

- Reset `job` and `error` when `jobId` changes; do nothing when `jobId` is null.
- Fetch immediately on a non-null `jobId`.
- Schedule the next fetch with `setTimeout` 2000 ms only while the latest job status is `queued` or `running`.
- Clear the timeout on cleanup and ignore responses from an old `jobId`.
- `refresh()` fetches immediately and updates state.
- On error, set the error message and stop scheduling.

- [ ] **Step 4: Run the hook tests**

Run: `cd frontend && npm test -- src/hooks/useJob.test.ts`

Expected: PASS. If fake timers hang, ensure the test uses `advanceTimersByTimeAsync` and restores real timers.

- [ ] **Step 5: Checkpoint**

Run: `git status --short frontend/src/hooks`

Expected: only the intended files. Do not commit unless asked.

---

### Task 7: Upload, progress, and error components

**Files:**
- Create: `frontend/src/components/UploadForm.tsx`
- Create: `frontend/src/components/ProgressPanel.tsx`
- Create: `frontend/src/components/ErrorBanner.tsx`
- Create: `frontend/src/components/UploadForm.test.tsx`
- Create: `frontend/src/components/ProgressPanel.test.tsx`
- Create: `frontend/src/components/ErrorBanner.test.tsx`

**Interfaces:**
- Consumes: `JOB_MODELS`, `JobModel`, `JobStatusValue`.
- Produces:
  - `UploadForm({ disabled, onStart }: { disabled: boolean; onStart: (input: { file: File | null; url: string; model: JobModel }) => void })`
  - `ProgressPanel({ status, stage, progress, message }: { status: JobStatusValue | null; stage: string | null; progress: number; message: string })`
  - `ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void })`

- [ ] **Step 1: Write the failing component tests**

Cover:

- `UploadForm` submits a chosen file and model.
- `UploadForm` shows "URL takes precedence" when both URL and file are present.
- `UploadForm` blocks submit with neither file nor URL and shows a validation message.
- `ProgressPanel` renders `role="progressbar"` with `aria-valuenow` and the stage message.
- `ErrorBanner` renders `role="alert"` and calls `onDismiss`.

Use `@testing-library/user-event` and `screen.getByLabelText`.

- [ ] **Step 2: Run the component tests and verify they fail**

Run: `cd frontend && npm test -- src/components/UploadForm.test.tsx src/components/ProgressPanel.test.tsx src/components/ErrorBanner.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the components**

`UploadForm`:

- URL text input labelled "YouTube URL".
- File input labelled "Audio file" with the valid extension list.
- Model select labelled "Separation model" using `JOB_MODELS`.
- Submit button labelled "Process".
- Local validation message when both sources are empty.
- Precedence note when URL is non-empty and a file is selected.
- Disable all controls when `disabled` is true.

`ProgressPanel`:

- Progress bar with `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={progress}`.
- Stage and message text.
- Render nothing meaningful when `status` is null.

`ErrorBanner`:

- `role="alert"`.
- Dismiss button labelled "Dismiss".
- Render nothing when `message` is null.

- [ ] **Step 4: Run the component tests**

Run: `cd frontend && npm test -- src/components/UploadForm.test.tsx src/components/ProgressPanel.test.tsx src/components/ErrorBanner.test.tsx`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short frontend/src/components`

Expected: only the intended files. Do not commit unless asked.

---

### Task 8: BPM and click-volume controls

**Files:**
- Create: `frontend/src/components/BpmControls.tsx`
- Create: `frontend/src/components/ClickControls.tsx`
- Create: `frontend/src/components/BpmControls.test.tsx`
- Create: `frontend/src/components/ClickControls.test.tsx`

**Interfaces:**
- Consumes: constants `MIN_BPM = 40`, `MAX_BPM = 300`, `MIN_CLICK_GAIN_DB = -20`, `MAX_CLICK_GAIN_DB = 20`.
- Produces:
  - `BpmControls({ value, detectedBpm, tempoSource, disabled, onChange }: { value: number; detectedBpm: number | null; tempoSource: string | null; disabled: boolean; onChange: (bpm: number) => void })`
  - `ClickControls({ gainDb, disabled, applying, onChange, onApply }: { gainDb: number; disabled: boolean; applying: boolean; onChange: (gainDb: number) => void; onApply: () => void })`

- [ ] **Step 1: Write the failing tests**

Cover:

- `BpmControls` displays `Detected: 128 BPM (drums-stem)`.
- Typing `999` and blurring clamps to `300`; typing `1` and blurring clamps to `40`.
- Typing `130` and blurring calls `onChange(130)` without clamping intermediate keystrokes.
- `÷2` from `120` calls `onChange(60)`; `×2` from `120` calls `onChange(240)`.
- Buttons and input are disabled when `disabled` is true.
- `ClickControls` renders a range input from `-20` to `20` with value `6`.
- Moving the slider calls `onChange` with the numeric gain.
- Clicking "Apply BPM + click" calls `onApply`; button is disabled while `applying`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd frontend && npm test -- src/components/BpmControls.test.tsx src/components/ClickControls.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the controls**

`BpmControls`:

- Number input labelled "BPM".
- Keep a local draft string so typing does not clamp intermediate keystrokes.
- On each draft change, parse the draft and call `onChange` with the parsed value
  when it is a finite number, so the parent sees the edit before apply.
- On blur, parse the draft, clamp to `40..300`, round to the nearest integer, and
  call `onChange` with the committed value.
- Sync the draft from the `value` prop when the input is not focused.
- `÷2` uses `Math.floor(value / 2)` then clamps; `×2` uses `value * 2` then clamps;
  both commit immediately through `onChange`.
- Detected line uses `detectedBpm` rounded and `tempoSource` when present.

`ClickControls`:

- Range input labelled "Click volume (dB)", `min=-20`, `max=20`, `step=1`, value `gainDb`.
- Value readout showing the dB number.
- Button labelled "Apply BPM + click".
- Button disabled when `disabled` or `applying`.

- [ ] **Step 4: Run the component tests**

Run: `cd frontend && npm test -- src/components/BpmControls.test.tsx src/components/ClickControls.test.tsx`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short frontend/src/components`

Expected: only the intended files. Do not commit unless asked.

---

### Task 9: Audio players and download links

**Files:**
- Create: `frontend/src/components/AudioPlayer.tsx`
- Create: `frontend/src/components/AudioPanel.tsx`
- Create: `frontend/src/components/DownloadPanel.tsx`
- Create: `frontend/src/components/AudioPanel.test.tsx`
- Create: `frontend/src/components/DownloadPanel.test.tsx`

**Interfaces:**
- Consumes: `AudioVariant`, `AudioFormat`.
- Produces:
  - `AudioPlayer({ label, src }: { label: string; src: string | null })`
  - `AudioPanel({ mixedUrl, backingUrl }: { mixedUrl: string | null; backingUrl: string | null })`
  - `DownloadPanel({ backing, mixed }: { backing: { wav: string; mp3: string } | null; mixed: { wav: string; mp3: string } | null })`

- [ ] **Step 1: Write the failing tests**

Cover:

- `AudioPanel` renders two audio elements with labels "Backing + click" and "Backing only", and sets `src` to the supplied URLs.
- `AudioPanel` renders players with no `src` when URLs are null.
- `DownloadPanel` renders four links: backing WAV, backing MP3, mixed WAV, mixed MP3.
- Each download link has a `download` attribute and the expected `href`.
- `DownloadPanel` renders no links when both outputs are null.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd frontend && npm test -- src/components/AudioPanel.test.tsx src/components/DownloadPanel.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the components**

`AudioPlayer`:

- Label text and `<audio controls src={src ?? undefined} aria-label={label} />`.
- Show "Process a track to listen." when `src` is null.

`AudioPanel`:

- Render `AudioPlayer` for "Backing + click" with `mixedUrl`.
- Render `AudioPlayer` for "Backing only" with `backingUrl`.

`DownloadPanel`:

- Render four anchor links with `download` and text:
  - "Download backing (WAV)"
  - "Download backing (MP3)"
  - "Download backing + click (WAV)"
  - "Download backing + click (MP3)"
- Hide the panel when both outputs are null.

- [ ] **Step 4: Run the component tests**

Run: `cd frontend && npm test -- src/components/AudioPanel.test.tsx src/components/DownloadPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `git status --short frontend/src/components`

Expected: only the intended files. Do not commit unless asked.

---

### Task 10: App wiring, end-to-end flow, and styles

**Files:**
- Replace: `frontend/src/App.tsx`
- Replace: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes all components and API functions from Tasks 5–9.
- Produces the complete single-screen workflow.

- [ ] **Step 1: Write the failing integration tests**

Replace `frontend/src/App.test.tsx` with tests that mock `./api`:

```ts
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ApiError, createJob, getJob, regenJob } from "./api";
import type { JobStatus } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    createJob: vi.fn(),
    getJob: vi.fn(),
    regenJob: vi.fn(),
  };
});

const doneJob: JobStatus = {
  job_id: "job_1",
  status: "done",
  stage: "export",
  progress: 100,
  message: "Done",
  bpm: 128,
  tempo_source: "drums-stem",
  model: "htdemucs",
  files: {},
};

beforeEach(() => vi.clearAllMocks());

describe("App flow", () => {
  it("uploads a file, shows the result, and regens at the edited BPM", async () => {
    vi.mocked(createJob).mockResolvedValue("job_1");
    vi.mocked(getJob).mockResolvedValue(doneJob);
    vi.mocked(regenJob).mockResolvedValue();
    const user = userEvent.setup();

    render(<App />);
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });
    await user.upload(screen.getByLabelText(/audio file/i), file);
    await user.click(screen.getByRole("button", { name: /process/i }));

    await waitFor(() => expect(screen.getByLabelText(/bpm/i)).toHaveValue(128));
    expect(screen.getByLabelText("Backing + click")).toHaveAttribute(
      "src",
      "/api/jobs/job_1/audio/mixed.wav?v=0",
    );

    await user.clear(screen.getByLabelText(/bpm/i));
    await user.type(screen.getByLabelText(/bpm/i), "130");
    await user.click(screen.getByRole("button", { name: /apply bpm \+ click/i }));

    await waitFor(() =>
      expect(regenJob).toHaveBeenCalledWith("job_1", { bpm: 130, clickGainDb: 6 }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Backing + click")).toHaveAttribute(
        "src",
        "/api/jobs/job_1/audio/mixed.wav?v=1",
      ),
    );
  });

  it("uses the URL when both a URL and a file are supplied", async () => {
    vi.mocked(createJob).mockResolvedValue("job_1");
    vi.mocked(getJob).mockResolvedValue(doneJob);
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByLabelText(/youtube url/i), "https://youtu.be/x");
    await user.upload(
      screen.getByLabelText(/audio file/i),
      new File(["audio"], "song.wav", { type: "audio/wav" }),
    );
    await user.click(screen.getByRole("button", { name: /process/i }));

    await waitFor(() =>
      expect(createJob).toHaveBeenCalledWith({
        file: expect.any(File),
        url: "https://youtu.be/x",
        model: "htdemucs",
      }),
    );
    expect(screen.getByText(/url takes precedence/i)).toBeInTheDocument();
  });

  it("shows a readable error when the backend is busy", async () => {
    vi.mocked(createJob).mockRejectedValue(new ApiError("Another job is already processing.", 409));
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByLabelText(/youtube url/i), "https://youtu.be/x");
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Another job is already processing.",
    );
  });
});
```

- [ ] **Step 2: Run the integration tests and verify they fail**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: FAIL because App still renders the placeholder.

- [ ] **Step 3: Implement App state and flow**

State and derived values:

- `jobId`, `bpm` (default `120`), `gainDb` (default `6`), `version` (default `0`), `starting`, `applying`, `actionError`.
- `useJob(jobId)` supplies `job`, `error`, and `refresh`.
- On create: choose URL if non-empty, otherwise file; show validation in `UploadForm` if neither. Call `createJob`, set `jobId`, clear old error, set `starting` around the request.
- On `job?.status === "done"`: set `bpm` from `job.bpm` rounded and clamped to `40..300`.
- URLs only when `jobId` and done:
  - `mixedUrl = audioUrl(jobId, "mixed", "wav", version)`
  - `backingUrl = audioUrl(jobId, "backing", "wav", version)`
  - downloads built with `audioUrl(..., "wav")` and `audioUrl(..., "mp3")`.
- Apply: call `regenJob(jobId, { bpm, clickGainDb: gainDb })`, then increment `version`, then `await refresh()`. Disable Apply while `applying`.
- Render errors from create/regen/poll through `ErrorBanner`.
- Layout: header, upload form, progress panel, BPM controls, click controls, audio panel, download panel. Use responsive two-column layout on wide screens.

- [ ] **Step 4: Run the integration tests**

Run: `cd frontend && npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run the full frontend suite and build**

Run:

```bash
cd frontend
npm test
npm run build
```

Expected: all tests PASS and build succeeds.

- [ ] **Step 6: Checkpoint**

Run: `git status --short frontend`

Expected: only the intended frontend changes. Do not commit unless asked.

---

### Task 11: Remove Gradio and the old client, update docs and run script

**Files:**
- Delete: `client/` (entire folder)
- Delete: `server/app.py`
- Delete: `.gradio/` if present
- Modify: `requirements.txt`
- Modify: `run.sh`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: working `frontend/` and updated backend from Tasks 1–10.
- Produces: one documented React frontend, no Gradio runtime or dependencies.

- [ ] **Step 1: Remove the old frontend and Gradio app**

Run:

```bash
git rm -r client
git rm server/app.py
rm -rf .gradio
```

If `.gradio` is untracked, `rm -rf` is enough. Confirm no `client/` or `server/app.py` remains.

- [ ] **Step 2: Remove Gradio dependencies**

Edit `requirements.txt` and remove:

```text
gradio==6.26.0
gradio_client==2.6.1
hf-gradio==0.4.1
safehttpx==0.1.7
```

Then verify no Gradio imports remain:

```bash
rg -n "gradio" --glob '!node_modules' --glob '!.venv' .
```

Expected: no matches.

- [ ] **Step 3: Update `.gitignore`**

Remove the `.gradio/` entry if present. Keep frontend ignores in `frontend/.gitignore`; otherwise add `frontend/node_modules/` and `frontend/dist/` at the root.

- [ ] **Step 4: Update `run.sh`**

New behavior:

- Start `uvicorn api:app --host 0.0.0.0 --port 8000` from `server/`.
- Wait for `/api/health`.
- Run `npm install` in `frontend/` only when `frontend/node_modules` is missing.
- Start `npm run dev` in `frontend/` in the foreground.
- Trap and kill the backend on exit.
- Remove the old static HTTP server on port 3000 and the Gradio process.

- [ ] **Step 5: Update `README.md`**

Replace the Gradio section with:

- Frontend table row: React + Vite at `frontend/`.
- Dev commands:
  - Terminal 1: `cd server && uvicorn api:app --host 0.0.0.0 --port 8000`
  - Terminal 2: `cd frontend && npm install && npm run dev`
- `run.sh` shortcut.
- Production build: `cd frontend && npm run build`.
- Note that MP3 downloads are available.
- Note that BPM regen now keeps detected first-beat phase and runs full length.
- Remove the Gradio URL and `python server/app.py` instructions.

- [ ] **Step 6: Verify cleanup and build**

Run:

```bash
bash -n run.sh
rg -n "gradio|server/app.py|python app.py" --glob '!node_modules' --glob '!.venv' .
cd frontend && npm test && npm run build
cd ../server && ../.venv/bin/python -m pytest tests -v
```

Expected: `run.sh` syntax OK, no Gradio references, frontend tests/build pass, backend tests pass.

- [ ] **Step 7: Manual smoke test**

Start backend and frontend. Then:

1. Process a short uploaded audio file.
2. Confirm progress stages appear and the BPM populates.
3. Play both tracks.
4. Download all four files.
5. Edit BPM, apply, confirm the mixed player reloads and clicks cover the full track.
6. Apply ×2 and ÷2; confirm phase stays aligned.
7. Change gain from −20 to +20 and apply.
8. Submit a YouTube URL.
9. Confirm a second rapid submission shows the 409 message.

- [ ] **Step 8: Final checkpoint**

Run: `git status --short`

Expected: exactly the intended deletions, additions, and edits. Do not commit unless asked.

---

## Self-Review Notes

- Spec coverage: Gradio parity, React app, MP3 downloads, regen timing, phase, click range, Gradio removal, docs, Android compatibility, and frontend deployment assumptions each map to a task.
- Type consistency: `JobStatus`, `CreateJobInput`, `RegenInput`, `JobModel`, `AudioVariant`, and `AudioFormat` are defined once in Task 5 and reused by name in Tasks 6–10.
- Deliberate omission: production static hosting is out of scope; `VITE_API_BASE` provides the escape hatch.
- Commit policy intentionally deviates from the writing-plans default because the human has not asked for commits.
