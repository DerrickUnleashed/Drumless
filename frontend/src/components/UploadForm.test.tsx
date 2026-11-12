import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadForm } from "./UploadForm";

describe("UploadForm", () => {
  it("submits a chosen file and model", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    render(<UploadForm disabled={false} onStart={onStart} />);

    await user.upload(screen.getByLabelText(/audio file/i), file);
    await user.selectOptions(
      screen.getByLabelText(/separation model/i),
      "htdemucs_ft",
    );
    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(onStart).toHaveBeenCalledWith({
      file,
      url: "",
      model: "htdemucs_ft",
    });
  });

  it("shows the URL precedence note when both sources are present", async () => {
    const user = userEvent.setup();
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    render(<UploadForm disabled={false} onStart={vi.fn()} />);

    await user.upload(screen.getByLabelText(/audio file/i), file);
    await user.type(
      screen.getByLabelText(/youtube url/i),
      "https://youtube.com/watch?v=1",
    );

    expect(screen.getByText(/url takes precedence/i)).toBeInTheDocument();
  });

  it("blocks submit when neither source is provided", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();

    render(<UploadForm disabled={false} onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /process/i }));

    expect(
      screen.getByText(/add a youtube url or choose an audio file/i),
    ).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });
});
