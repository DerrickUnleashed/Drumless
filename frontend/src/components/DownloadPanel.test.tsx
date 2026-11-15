import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadPanel } from "./DownloadPanel";

const backing = {
  mp3: "/api/jobs/job_1/audio/backing.mp3",
};
const mixed = {
  mp3: "/api/jobs/job_1/audio/mixed.mp3",
};

describe("DownloadPanel", () => {
  it("renders two download links with their hrefs", () => {
    render(<DownloadPanel backing={backing} mixed={mixed} />);

    expect(screen.getByRole("link", { name: "Download backing (MP3)" })).toHaveAttribute(
      "href",
      backing.mp3,
    );
    expect(
      screen.getByRole("link", { name: "Download backing + click (MP3)" }),
    ).toHaveAttribute("href", mixed.mp3);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("download");
    }
  });

  it("renders no links when both outputs are null", () => {
    const { container } = render(
      <DownloadPanel backing={null} mixed={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
