import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressPanel } from "./ProgressPanel";

describe("ProgressPanel", () => {
  it("renders the progress bar and stage message", () => {
    render(
      <ProgressPanel
        status="running"
        stage="separation"
        progress={40}
        message="Separating stems"
      />,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText(/separation/i)).toBeInTheDocument();
    expect(screen.getByText(/separating stems/i)).toBeInTheDocument();
  });

  it("renders nothing when status is null", () => {
    const { container } = render(
      <ProgressPanel
        status={null}
        stage={null}
        progress={0}
        message=""
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
