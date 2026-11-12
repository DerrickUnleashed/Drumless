import type { ChangeEvent } from "react";
import { MAX_CLICK_GAIN_DB, MIN_CLICK_GAIN_DB } from "../types";

export function ClickControls({
  gainDb,
  disabled,
  applying,
  onChange,
  onApply,
}: {
  gainDb: number;
  disabled: boolean;
  applying: boolean;
  onChange: (gainDb: number) => void;
  onApply: () => void;
}) {
  const readout = `${gainDb > 0 ? "+" : ""}${gainDb} dB`;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Number(event.target.value));
  }

  return (
    <section className="panel">
      <h2>Click volume</h2>

      <label htmlFor="click-gain">Click volume (dB)</label>
      <input
        id="click-gain"
        type="range"
        min={MIN_CLICK_GAIN_DB}
        max={MAX_CLICK_GAIN_DB}
        step={1}
        value={gainDb}
        onChange={handleChange}
        disabled={disabled}
      />
      <output className="gain-readout" htmlFor="click-gain">
        {readout}
      </output>

      <button
        className="button primary"
        type="button"
        onClick={onApply}
        disabled={disabled || applying}
      >
        Apply BPM + click
      </button>
    </section>
  );
}
