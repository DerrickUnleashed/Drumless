import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJob } from "../api";
import type { JobStatus } from "../types";
import { useJob } from "./useJob";

vi.mock("../api", () => ({ getJob: vi.fn() }));

const running: JobStatus = {
  job_id: "job_1",
  status: "running",
  stage: "separation",
  progress: 40,
  message: "Working",
  bpm: null,
  tempo_source: null,
  model: "htdemucs",
  files: {},
};
const done: JobStatus = { ...running, status: "done", progress: 100, bpm: 128 };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

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

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.job?.status).toBe("running");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.job?.status).toBe("done");
    expect(getJob).toHaveBeenCalledTimes(2);
  });

  it("sets an error and stops polling when the request fails", async () => {
    vi.mocked(getJob).mockRejectedValue(new Error("Job not found"));
    const { result } = renderHook(() => useJob("job_1"));

    await waitFor(() => expect(result.current.error).toBe("Job not found"));
    expect(getJob).toHaveBeenCalledTimes(1);
  });
});
