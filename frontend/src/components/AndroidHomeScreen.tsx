import { useState } from "react";
import { OutlinedTextField, Button, OutlinedButton } from "@mui/material";
import { Card, Typography } from "@mui/material";
import { useFilePicker } from "../hooks/useFilePicker";

export function AndroidHomeScreen({ onSubmitUrl, onPickFile, submitting }) {
  const [url, setUrl] = useState("");

  return (
    <Card sx={{ p: 2, mb: 2 }} elevation={1}>
      <Typography variant="h5" gutterBottom>
        Drumless
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Remove the drums, lock a click to the detected tempo, and practice.
      </Typography>

      <OutlinedTextField
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        label="YouTube URL (optional)"
        fullWidth
        variant="outlined"
      />

      <Button
        variant="contained"
        fullWidth
        disabled={submitting || !url.trim()}
        onClick={() => onSubmitUrl(url)}
      >
        Process YouTube URL
      </Button>

      <OutlinedButton
        variant="outlined"
        fullWidth
        disabled={submitting}
        onClick={() => onPickFile()}
      >
        {url.trim() ? "Processing “" + url.trim() + "”…" : "Pick audio file"}
      </OutlinedButton>
    </Card>
  );
}