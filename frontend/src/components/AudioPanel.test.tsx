import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioPanel } from "./AudioPanel";

describe("AudioPanel", () => {
  it("renders both players with their URLs", () => {
    const { container } = render(
      <AudioPanel
        mixedUrl="/api/jobs/job_1/audio/mixed.wav"
        backingUrl="/api/jobs/job_1/audio/backing.wav"
      />,
    );

    expect(screen.getByLabelText("Backing + click")).toHaveAttribute(
      "src",
      "/api/jobs/job_1/audio/mixed.wav",
    );
    expect(screen.getByLabelText("Backing only")).toHaveAttribute(
      "src",
      "/api/jobs/job_1/audio/backing.wav",
    );
    expect(container.querySelectorAll("audio")).toHaveLength(2);
  });

  it("renders players without sources when URLs are null", () => {
    render(<AudioPanel mixedUrl={null} backingUrl={null} />);

    expect(screen.getByLabelText("Backing + click")).not.toHaveAttribute("src");
    expect(screen.getByLabelText("Backing only")).not.toHaveAttribute("src");
    expect(screen.getAllByText(/Listen/i)).toHaveLength(1);
  });
});
