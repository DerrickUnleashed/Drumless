import "../styles.css";

import { useCallback, useEffect, useState } from "react";
import {
  audioUrl,
  createJob,
  deleteTrack,
  listTracks,
  regenJob,
  renameTrack,
  trackUrl,
} from "../api";
import { AuthPanel } from "../components/AuthPanel";
import { Link } from "../Link";
import { AudioPanel } from "./AudioPanel";
import { BpmControls } from "./BpmControls";
import { ClickControls } from "./ClickControls";
import { ErrorBanner } from "./ErrorBanner";
import { ProgressPanel } from "./ProgressPanel";
import { TrackLibrary } from "./TrackLibrary";
import { UploadForm } from "./UploadForm";
import { useAuth } from "../hooks/useAuth";
import { useJob } from "../hooks/useJob";
import {
  DEFAULT_CLICK_GAIN_DB,
  MAX_BPM,
  MIN_BPM,
  type CreateJobInput,
  type TrackSummary,
} from "../types";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

function trackName(track: TrackSummary): string {
  return track.custom_name?.trim() || track.original_song_name;
}

interface SignedUrls {
  mixedWav: string;
  backingWav: string;
  mixedMp3: string;
  backingMp3: string;
}

function Studio({
  authed,
  email,
  onSignOut,
}: {
  authed: boolean;
  email: string | null;
  onSignOut: () => Promise<void>;
}) {
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
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [signed, setSigned] = useState<SignedUrls | null>(null);

  const { job, error: jobError, refresh } = useJob(jobId);

  const isDone = job?.status === "done";
  const detectedBpm =
    isDone && job.bpm !== null ? clampBpm(job.bpm) : null;
  const bpm =
    bpmEdit && bpmEdit.jobId === jobId
      ? bpmEdit.value
      : (detectedBpm ?? 120);

  const ready = jobId !== null && isDone;

  const refreshTracks = useCallback(async () => {
    if (!authed) {
      return;
    }
    try {
      setTracks(await listTracks());
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }, [authed]);

  useEffect(() => {
    void refreshTracks();
  }, [refreshTracks]);

  useEffect(() => {
    if (job?.status === "done") {
      void refreshTracks();
    }
  }, [job?.status, refreshTracks]);

  useEffect(() => {
    if (!authed || !ready || jobId === null) {
      setSigned(null);
      return;
    }

    let cancelled = false;
    Promise.all([
      trackUrl(jobId, "mixed", "wav"),
      trackUrl(jobId, "backing", "wav"),
      trackUrl(jobId, "mixed", "mp3", true),
      trackUrl(jobId, "backing", "mp3", true),
    ])
      .then(([mixedWav, backingWav, mixedMp3, backingMp3]) => {
        if (!cancelled) {
          setSigned({ mixedWav, backingWav, mixedMp3, backingMp3 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSigned(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authed, ready, jobId, version]);

  const mixedUrl = ready
    ? authed
      ? (signed?.mixedWav ?? null)
      : audioUrl(jobId, "mixed", "wav", version)
    : null;
  const backingUrl = ready
    ? authed
      ? (signed?.backingWav ?? null)
      : audioUrl(jobId, "backing", "wav", version)
    : null;
  const active = job?.status === "queued" || job?.status === "running";
  const bannerMessage =
    actionError ??
    (jobError !== null && jobError !== dismissedError ? jobError : null);
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

  function handleSelectTrack(track: TrackSummary) {
    setActionError(null);
    setBpmEdit(null);
    setGainDb(
      track.click_gain_db !== null
        ? Math.round(track.click_gain_db)
        : DEFAULT_CLICK_GAIN_DB,
    );
    setVersion((current) => current + 1);
    setJobId(track.id);
  }

  async function handleRenameTrack(track: TrackSummary) {
    const next = window.prompt("Rename track", trackName(track));
    if (next === null) {
      return;
    }
    const name = next.trim();
    if (!name) {
      return;
    }
    try {
      await renameTrack(track.id, name);
      await refreshTracks();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  async function handleDeleteTrack(track: TrackSummary) {
    const confirmed = window.confirm(
      `Delete "${trackName(track)}"? This removes its audio permanently.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteTrack(track.id);
      if (jobId === track.id) {
        setJobId(null);
        setSigned(null);
      }
      await refreshTracks();
    } catch (caught) {
      setActionError(errorMessage(caught));
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
          <img className="brand-logo" src="/drum-set.png" alt="" width={30} height={30} />
          <span className="studio-nav-title">Drumless</span>
        </Link>
        <span className="studio-nav-title">STUDIO</span>
        {authed ? (
          <div className="studio-account">
            {email ? <span className="studio-account-email">{email}</span> : null}
            <button className="button subtle" type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        ) : null}
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

      <TrackLibrary
        tracks={tracks}
        selectedId={jobId}
        disabled={starting || active}
        onSelect={handleSelectTrack}
        onRename={(track) => void handleRenameTrack(track)}
        onDelete={(track) => void handleDeleteTrack(track)}
        onRefresh={() => void refreshTracks()}
      />
      {job?.status === "running" || starting ? (
        <ProgressPanel
          status="running"
          stage={job?.stage ?? null}
          progress={job?.progress ?? 0}
          message={progressMessage}
        />
      ) : null}
      <div className="studio-layout">
        <AudioPanel mixedUrl={mixedUrl} backingUrl={backingUrl} />
        <section className="panel">
          <ClickControls
            gainDb={gainDb}
            disabled={!isDone}
            applying={applying}
            onChange={setGainDb}
            onApply={handleApply}
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
        </section>
        <UploadForm disabled={starting || active} onStart={handleStart} />
      </div>
    </main>
  );
}

export default Studio;
