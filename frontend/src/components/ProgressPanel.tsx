import type { JobStatusValue } from "../types";

export function ProgressPanel({
  status,
  stage,
  progress,
  message,
}: {
  status: JobStatusValue | null;
  stage: string | null;
  progress: number;
  message: string;
}) {
  if (status === null) {
    return null;
  }

  const value = Math.min(100, Math.max(0, progress));

  return (
    <section className="panel progress-panel" aria-live="polite">
      <div className="progress-heading">
        <h2>{status === "queued" ? "Queued" : "Processing"}</h2>
        {stage ? <span className="stage">{stage}</span> : null}
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-label="Job progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>

      <p className="progress-message">{message}</p>
    </section>
  );
}
