import { useState } from "react";
import { audioUrl, createJob, regenJob } from "./api";
import { Link } from "./Link";
import { AudioPanel } from "./components/AudioPanel";
import { BpmControls } from "./components/BpmControls";
import { ClickControls } from "./components/ClickControls";
import { DownloadPanel } from "./components/DownloadPanel";
import { ErrorBanner } from "./components/ErrorBanner";
import { ProgressPanel } from "./components/ProgressPanel";
import { UploadForm } from "./components/UploadForm";
import { useJob } from "./hooks/useJob";
import {
  DEFAULT_CLICK_GAIN_DB,
  MAX_BPM,
  MIN_BPM,
  type CreateJobInput,
} from "./types";
import "./styles.css";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [bpmEdit, setBpmEdit] = useState<{ jobId: string; value: number } | null>(
    null,
  );
  const [gainDb, setGainDb] = useState(DEFAULT_CLICK_GAIN_DB);
  const [version, setVersion] = useState(0);
  const [starting, setStarting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const { job, error: jobError, refresh } = useJob(jobId);

  const isDone = job?.status === "done";
  const detectedBpm =
    isDone && job.bpm !== null ? clampBpm(job.bpm) : null;
  const bpm =
    bpmEdit && bpmEdit.jobId === jobId
      ? bpmEdit.value
      : (detectedBpm ?? 120);

  const ready = jobId !== null && isDone;
  const mixedUrl = ready ? audioUrl(jobId, "mixed", "wav", version) : null;
  const backingUrl = ready ? audioUrl(jobId, "backing", "wav", version) : null;
  const downloads = ready
    ? {
        backing: {
          wav: audioUrl(jobId, "backing", "wav"),
          mp3: audioUrl(jobId, "backing", "mp3"),
        },
        mixed: {
          wav: audioUrl(jobId, "mixed", "wav"),
          mp3: audioUrl(jobId, "mixed", "mp3"),
        },
      }
    : { backing: null, mixed: null };

  const active = job?.status === "queued" || job?.status === "running";
  const bannerMessage =
    actionError ??
    (jobError !== null && jobError !== dismissedError ? jobError : null);
  const progressStatus = starting ? "queued" : (job?.status ?? null);
  const progressMessage = starting ? "Starting job…" : (job?.message ?? "");

  async function handleStart(input: CreateJobInput) {
    setActionError(null);
    setDismissedError(null);
    setStarting(true);

    try {
      const nextJobId = await createJob(input);
      setVersion(0);
      setBpmEdit(null);
      setJobId(nextJobId);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  }

  async function handleApply() {
    if (jobId === null) {
      return;
    }

    setApplying(true);
    setActionError(null);

    try {
      await regenJob(jobId, { bpm, clickGainDb: gainDb });
      setVersion((current) => current + 1);
      await refresh();
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setApplying(false);
    }
  }

  function handleDismiss() {
    setActionError(null);
    setDismissedError(jobError);
  }

  return (
    <main className="app">
      <nav className="studio-nav" aria-label="Breadcrumb">
        <Link to="/" className="back-link">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Home
        </Link>
        <span className="studio-nav-title">Studio</span>
      </nav>

      <header className="hero">
        <p className="eyebrow">Practice tool</p>
        <h1>Drumless</h1>
        <p className="lede">
          Separate the drums, detect the tempo, and practice with a click that
          keeps the song's feel.
        </p>
      </header>

      <ErrorBanner message={bannerMessage} onDismiss={handleDismiss} />

      <div className="layout">
        <div className="column">
          <UploadForm disabled={starting || active} onStart={handleStart} />
          <ProgressPanel
            status={progressStatus}
            stage={job?.stage ?? null}
            progress={job?.progress ?? 0}
            message={progressMessage}
          />
          <BpmControls
            value={bpm}
            detectedBpm={detectedBpm}
            tempoSource={job?.tempo_source ?? null}
            disabled={!isDone}
            onChange={(next) => {
              if (jobId !== null) {
                setBpmEdit({ jobId, value: next });
              }
            }}
          />
          
        </div>
        <div className="column">
          <AudioPanel mixedUrl={mixedUrl} backingUrl={backingUrl} />
          <ClickControls
            gainDb={gainDb}
            disabled={!isDone}
            applying={applying}
            onChange={setGainDb}
            onApply={handleApply}
          />
          <DownloadPanel backing={downloads.backing} mixed={downloads.mixed} />
        </div>
      </div>
    </main>
  );
}
