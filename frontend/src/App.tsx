import { useCallback, useEffect, useState } from "react";
import {
  audioUrl,
  createJob,
  deleteTrack,
  listTracks,
  regenJob,
  renameTrack,
  trackUrl,
} from "./api";
import { AuthPanel } from "./components/AuthPanel";
import { Link } from "./Link";
import { AudioPanel } from "./components/AudioPanel";
import { BpmControls } from "./components/BpmControls";
import Studio from "./components/Studio";
import { ClickControls } from "./components/ClickControls";
import { ErrorBanner } from "./components/ErrorBanner";
import { ProgressPanel } from "./components/ProgressPanel";
import { TrackLibrary } from "./components/TrackLibrary";
import { UploadForm } from "./components/UploadForm";
import { useAuth } from "./hooks/useAuth";
import { useJob } from "./hooks/useJob";
import {
  DEFAULT_CLICK_GAIN_DB,
  MAX_BPM,
  MIN_BPM,
  type CreateJobInput,
  type TrackSummary,
} from "./types";
import "./styles.css";

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

export default function App() {
  const { configured, loading, session, signOut } = useAuth();

  if (configured && loading) {
    return (
      <main className="app auth-screen">
        <p className="hint">Loading…</p>
      </main>
    );
  }

  if (configured && !session) {
    return <AuthPanel />;
  }

  return (
    <Studio
      authed={configured && session !== null}
      email={session?.user.email ?? null}
      onSignOut={signOut}
    />
  );
}

