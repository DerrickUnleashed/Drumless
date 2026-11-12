import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BpmControls } from "./BpmControls";

function setup(overrides: Partial<Parameters<typeof BpmControls>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <BpmControls
      value={120}
      detectedBpm={128}
      tempoSource="drums-stem"
      disabled={false}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("BpmControls", () => {
  it("shows the detected tempo and source", () => {
    setup();

    expect(
      screen.getByText("Detected: 128 BPM (drums-stem)"),
    ).toBeInTheDocument();
  });

  it("clamps a high value on blur", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const input = screen.getByLabelText(/bpm/i);

    await user.clear(input);
    await user.type(input, "999");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it("clamps a low value on blur", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const input = screen.getByLabelText(/bpm/i);

    await user.clear(input);
    await user.type(input, "1");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(40);
  });

  it("keeps an in-range value without clamping intermediate keystrokes", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const input = screen.getByLabelText(/bpm/i);

    await user.clear(input);
    await user.type(input, "130");
    await user.tab();

    expect(onChange.mock.calls.map(([bpm]) => bpm)).toEqual(
      expect.arrayContaining([1, 13, 130]),
    );
    expect(onChange).toHaveBeenLastCalledWith(130);
  });

  it("halves and doubles the current value", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole("button", { name: "÷2" }));
    expect(onChange).toHaveBeenLastCalledWith(60);

    await user.click(screen.getByRole("button", { name: "×2" }));
    expect(onChange).toHaveBeenLastCalledWith(240);
  });

  it("disables all controls when disabled", () => {
    setup({ disabled: true });

    expect(screen.getByLabelText(/bpm/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "÷2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "×2" })).toBeDisabled();
  });
});
