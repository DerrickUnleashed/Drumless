import type {
  AudioFormat,
  AudioVariant,
  CreateJobInput,
  JobStatus,
  RegenInput,
  TrackSummary,
} from "./types";
import { getAccessToken } from "./lib/supabase";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiUrl(path: string): string {
  const base =
    import.meta.env.VITE_API_BASE ??
    import.meta.env.VITE_API_BASE_URL ??
    "";
  return `${base}${path}`;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function errorFrom(response: Response): Promise<ApiError> {
  let message = response.statusText || `Request failed (${response.status})`;

  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      message = body.detail;
    }
  } catch {
    // Keep the status text when the response body is not JSON.
  }

  return new ApiError(message, response.status);
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const body = new FormData();
  if (input.file) {
    body.append("file", input.file);
  }
  const url = input.url.trim();
  if (url) {
    body.append("url", url);
  }
  body.append("model", input.model);

  const response = await fetch(apiUrl("/api/jobs"), {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw await errorFrom(response);
  }

  const data = (await response.json()) as { job_id: string };
  return data.job_id;
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const headers = authHeaders();
  const response = Object.keys(headers).length
    ? await fetch(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}`), { headers })
    : await fetch(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}`));
  if (!response.ok) {
    throw await errorFrom(response);
  }
  return (await response.json()) as JobStatus;
}

export async function regenJob(
  jobId: string,
  input: RegenInput,
): Promise<void> {
  const body: Record<string, number> = {};
  if (input.bpm !== undefined) {
    body.bpm = input.bpm;
  }
  if (input.clickGainDb !== undefined) {
    body.click_gain_db = input.clickGainDb;
  }

  const response = await fetch(
    apiUrl(`/api/jobs/${encodeURIComponent(jobId)}/regen`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw await errorFrom(response);
  }
}

export function audioUrl(
  jobId: string,
  variant: AudioVariant,
  format: AudioFormat,
  version?: number | string,
): string {
  const path = `/api/jobs/${encodeURIComponent(jobId)}/audio/${variant}.${format}`;
  return version === undefined ? apiUrl(path) : apiUrl(`${path}?v=${encodeURIComponent(String(version))}`);
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = { ...authHeaders(), ...(init?.headers ?? {}) };
  const response = await fetch(apiUrl(path), { ...init, headers });
  if (!response.ok) {
    throw await errorFrom(response);
  }
  return response;
}

export async function listTracks(): Promise<TrackSummary[]> {
  const response = await authedFetch("/api/tracks");
  const data = (await response.json()) as { tracks: TrackSummary[] };
  return data.tracks;
}

export async function renameTrack(
  trackId: string,
  customName: string,
): Promise<TrackSummary> {
  const response = await authedFetch(
    `/api/tracks/${encodeURIComponent(trackId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_name: customName }),
    },
  );
  return (await response.json()) as TrackSummary;
}

export async function deleteTrack(trackId: string): Promise<void> {
  await authedFetch(`/api/tracks/${encodeURIComponent(trackId)}`, {
    method: "DELETE",
  });
}

export async function trackUrl(
  trackId: string,
  variant: AudioVariant | "original",
  format: AudioFormat,
  download = false,
): Promise<string> {
  const params = new URLSearchParams({ variant, format });
  if (download) {
    params.set("download", "true");
  }
  const response = await authedFetch(
    `/api/tracks/${encodeURIComponent(trackId)}/url?${params.toString()}`,
  );
  const data = (await response.json()) as { url: string };
  return data.url;
}
