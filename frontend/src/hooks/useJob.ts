import { useCallback, useEffect, useRef, useState } from "react";
import { getJob } from "../api";
import type { JobStatus } from "../types";

const POLL_INTERVAL_MS = 2000;

function isActive(status: JobStatus["status"]): boolean {
  return status === "queued" || status === "running";
}

export function useJob(jobId: string | null): {
  job: JobStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [jobState, setJobState] = useState<JobStatus | null>(null);
  const [errorState, setErrorState] = useState<{
    jobId: string;
    message: string;
  } | null>(null);
  const jobIdRef = useRef(jobId);
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchNow = useCallback(
    async function pollJob() {
      const activeJobId = jobIdRef.current;
      if (!activeJobId) {
        return;
      }

      const requestId = ++requestIdRef.current;

      try {
        const next = await getJob(activeJobId);
        if (
          requestId !== requestIdRef.current ||
          jobIdRef.current !== activeJobId
        ) {
          return;
        }

        setJobState(next);
        setErrorState(null);
        clearTimer();

        if (isActive(next.status)) {
          timerRef.current = setTimeout(() => {
            void pollJob();
          }, POLL_INTERVAL_MS);
        }
      } catch (caught) {
        if (
          requestId !== requestIdRef.current ||
          jobIdRef.current !== activeJobId
        ) {
          return;
        }

        clearTimer();
        setErrorState({
          jobId: activeJobId,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
    },
    [clearTimer],
  );

  useEffect(() => {
    jobIdRef.current = jobId;
    requestIdRef.current += 1;
    clearTimer();

    if (jobId) {
      void fetchNow();
    }

    return () => {
      requestIdRef.current += 1;
      clearTimer();
    };
  }, [jobId, fetchNow, clearTimer]);

  const refresh = useCallback(async () => {
    clearTimer();
    await fetchNow();
  }, [clearTimer, fetchNow]);

  const job =
    jobId !== null && jobState?.job_id === jobId ? jobState : null;
  const error =
    jobId !== null && errorState?.jobId === jobId
      ? errorState.message
      : null;

  return { job, error, refresh };
}
