import { useState } from "react";
import { Card, Typography, Slider, Button, OutlinedTextField } from "@mui/material";
import { TrackPlayerCard } from "./AndroidTrackPlayerCard";

export function AndroidResultsScreen({
  job,
  onBpmChange,
  onGainChange,
  onApply,
  onBack,
}: {
  job: { bpm?: number; files: { backing?: string; mixed?: string } } | null;
  onBpmChange: (bpm: number) => void;
  onGainChange: (gain: number) => void;
  onApply: () => void;
  onBack: () => void;
}) {
  const [bpm, setBpm] = useState(job?.bpm ?? 120);
  const [gainDb, setGainDb] = useState(6);

  return (
    <Card sx={{ p: 2, mb: 2 }} elevation={1}>
      <Typography variant="h5" gutterBottom>
        Results
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Detected tempo:{" "}
        {job?.bpm?.toString() ?? "?"} BPM{" "}
        {(job?.tempoSource ?? "source").toString()}
      </Typography>

      <OutlinedTextField
        value={bpm.toString()}
        onChange={(e) => setBpm(Number(e.target.value))}
        label="BPM (editable)"
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <div sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Button
          variant="text"
          onClick={() => onBpmChange(Math.floor(bpm / 2))}
          disabled={bpm < 60}
        >
          ÷2
        </Button>
        <Button
          variant="text"
          onClick={() => onBpmChange(Math.min(bpm * 2, 300))}
          disabled={bpm > 150}
        >
          ×2
        </Button>
      </div>

      <Typography variant="body2" color="text.primary" component="div">
        Click volume:{" "}
        {gainDb > 0 ? `+${gainDb}` : gainDb} dB
      </Typography>

      <Slider
        min={-20}
        max={6}
        step={1}
        value={gainDb}
        onChange={(e) => setGainDb(Number(e.target.value))}
        sx={{ mt: 2, mb: 2 }}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={onApply}
        disabled={!!job?.bpm === false || gainDb === 6}
      >
        Apply BPM + click volume
      </Button>

      {job?.files?.backing && (
        <TrackPlayerCard title="Backing (no drums)" url={job.files.backing} filename="backing" />
      )}

      {job?.files?.mixed && (
        <TrackPlayerCard title="Mixed (backing + click)" url={job.files.mixed} filename="mixed" />
      )}

      {job.error && (
        <Card sx={{ p: 1, mb: 2, elevation: 1 }} colorScheme="error">
          <Typography color="onErrorContainer" variant="body2">
            {job.error}
          </Typography>
        </Card>
      )}

      <Button
        variant="text"
        fullWidth
        onClick={onBack}
        sx={{ mt: 2 }}
      >
        Start another track
      </Button>
    </Card>
  );
}