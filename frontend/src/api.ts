import type {
  AudioFormat,
  AudioVariant,
  CreateJobInput,
  JobStatus,
  RegenInput,
} from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_BASE ?? ""}${path}`;
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

  const response = await fetch(apiUrl("/api/jobs"), { method: "POST", body });
  if (!response.ok) {
    throw await errorFrom(response);
  }

  const data = (await response.json()) as { job_id: string };
  return data.job_id;
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}`));
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
      headers: { "Content-Type": "application/json" },
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
