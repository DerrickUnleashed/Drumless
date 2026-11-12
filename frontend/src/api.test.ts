import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, audioUrl, createJob, getJob, regenJob } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("createJob", () => {
  it("posts multipart data and returns the job id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: "job_1" }), { status: 201 }),
    );
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    await expect(createJob({ file, url: "", model: "htdemucs" })).resolves.toBe("job_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobs");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body.get("model")).toBe("htdemucs");
    expect((body.get("file") as File).name).toBe("song.wav");
    expect(body.get("url")).toBeNull();
  });

  it("throws ApiError with the backend detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Another job is already processing." }), { status: 409 }),
    );

    const error = await createJob({
      file: null,
      url: "https://example.com",
      model: "htdemucs",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Another job is already processing.",
    });
  });
});

describe("getJob", () => {
  it("fetches the job URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_id: "job_1", status: "done" }), { status: 200 }),
    );

    await getJob("job_1");

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job_1");
  });
});

describe("regenJob", () => {
  it("maps click gain to the backend field", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await regenJob("job_1", { bpm: 128, clickGainDb: 6 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobs/job_1/regen");
    expect(JSON.parse(init?.body as string)).toEqual({ bpm: 128, click_gain_db: 6 });
  });
});

describe("audioUrl", () => {
  it("builds WAV and MP3 URLs with a cache buster", () => {
    expect(audioUrl("job_1", "backing", "wav")).toBe("/api/jobs/job_1/audio/backing.wav");
    expect(audioUrl("job_1", "mixed", "mp3", 3)).toBe("/api/jobs/job_1/audio/mixed.mp3?v=3");
  });
});
