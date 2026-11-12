import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("renders an alert and calls onDismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<ErrorBanner message="Job failed" onDismiss={onDismiss} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Job failed");

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when message is null", () => {
    const { container } = render(
      <ErrorBanner message={null} onDismiss={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
