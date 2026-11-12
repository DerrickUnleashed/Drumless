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
    vi.mocked(createJob).mockRejectedValue(
      new ApiError("Another job is already processing.", 409),
    );
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByLabelText(/youtube url/i), "https://youtu.be/x");
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Another job is already processing.",
    );
  });
});
