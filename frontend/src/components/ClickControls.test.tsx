import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClickControls } from "./ClickControls";

function setup(overrides: Partial<Parameters<typeof ClickControls>[0]> = {}) {
  const onChange = vi.fn();
  const onApply = vi.fn();
  render(
    <ClickControls
      gainDb={6}
      disabled={false}
      applying={false}
      onChange={onChange}
      onApply={onApply}
      {...overrides}
    />,
  );
  return { onChange, onApply };
}

describe("ClickControls", () => {
  it("renders the gain range and readout", () => {
    setup();

    const slider = screen.getByLabelText(/click volume/i);
    expect(slider).toHaveValue("6");
    expect(slider).toHaveAttribute("min", "-20");
    expect(slider).toHaveAttribute("max", "20");
    expect(screen.getByText("+6 dB")).toBeInTheDocument();
  });

  it("reports slider changes as numbers", () => {
    const { onChange } = setup();
    const slider = screen.getByLabelText(/click volume/i);

    fireEvent.change(slider, { target: { value: "12" } });

    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("calls onApply and disables the button while applying", async () => {
    const user = userEvent.setup();
    const { onApply } = setup();

    await user.click(
      screen.getByRole("button", { name: "Apply BPM + click" }),
    );
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("disables the apply button while applying", () => {
    setup({ applying: true });

    expect(
      screen.getByRole("button", { name: "Apply BPM + click" }),
    ).toBeDisabled();
  });
});
