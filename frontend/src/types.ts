export const MIN_BPM = 40;
export const MAX_BPM = 300;
export const MIN_CLICK_GAIN_DB = -20;
export const MAX_CLICK_GAIN_DB = 20;
export const DEFAULT_CLICK_GAIN_DB = 6;

export type JobStatusValue = "queued" | "running" | "done" | "error";
export type AudioVariant = "backing" | "mixed";
export type AudioFormat = "wav" | "mp3";
export type JobModel = (typeof JOB_MODELS)[number];

export const JOB_MODELS = ["htdemucs", "htdemucs_ft"] as const;

export interface JobFiles {
  backing?: string;
  mixed?: string;
}

export interface JobStatus {
  job_id: string;
  status: JobStatusValue;
  stage: string | null;
  progress: number;
  message: string;
  bpm: number | null;
  tempo_source: string | null;
  model: JobModel;
  files: JobFiles;
}

export interface CreateJobInput {
  file: File | null;
  url: string;
  model: JobModel;
}

export interface RegenInput {
  bpm?: number;
  clickGainDb?: number;
}

export interface TrackSummary {
  track_id: string;
  id: string;
  user_id: string;
  original_song_name: string;
  custom_name: string | null;
  source_url: string | null;
  bpm: number | null;
  click_gain_db: number | null;
  duration_seconds: number | null;
  status: JobStatusValue;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
  has_backing: boolean;
  has_mixed: boolean;
}
