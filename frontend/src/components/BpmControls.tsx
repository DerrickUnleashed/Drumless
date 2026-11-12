import { useState, type ChangeEvent, type FocusEvent } from "react";
import { MAX_BPM, MIN_BPM } from "../types";

function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function BpmControls({
  value,
  detectedBpm,
  tempoSource,
  disabled,
  onChange,
}: {
  value: number;
  detectedBpm: number | null;
  tempoSource: string | null;
  disabled: boolean;
  onChange: (bpm: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    setDraft(event.target.value);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setDraft(next);
    if (next.trim() === "") {
      return;
    }

    const parsed = Number(next);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    const parsed = Number(draft);
    const committed =
      draft.trim() !== "" && Number.isFinite(parsed)
        ? clampBpm(parsed)
        : clampBpm(value);

    setFocused(false);
    onChange(committed);
  }

  return (
    <section className="panel">
      <h2>BPM</h2>

      {detectedBpm !== null ? (
        <p className="detected-tempo">
          Detected: {Math.round(detectedBpm)} BPM
          {tempoSource ? ` (${tempoSource})` : ""}
        </p>
      ) : null}

      <label htmlFor="bpm-input">BPM</label>
      <input
        id="bpm-input"
        type="number"
        inputMode="numeric"
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        value={focused ? draft : String(value)}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
      />

      <div className="button-row">
        <button
          className="button"
          type="button"
          onClick={() => onChange(clampBpm(Math.floor(value / 2)))}
          disabled={disabled}
        >
          ÷2
        </button>
        <button
          className="button"
          type="button"
          onClick={() => onChange(clampBpm(value * 2))}
          disabled={disabled}
        >
          ×2
        </button>
      </div>
    </section>
  );
}
