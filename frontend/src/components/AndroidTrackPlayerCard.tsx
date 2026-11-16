import { Card, Typography, Slider, Button, Box } from "@mui/material";
import { useRef, useState, useEffect } from "react";

export function AndroidTrackPlayerCard({
  title,
  url,
  filename,
}: { title: string; url: string; filename: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(new Audio(url));

  useEffect(() => {
    audioRef.current.onplay = () => setIsPlaying(true);
    audioRef.current.onpause = () => setIsPlaying(false);
    audioRef.current.onloadeddata = () =>
      setDurationSec(audioRef.current.duration | 0);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setPositionSec(audioRef.current.currentTime | 0);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const format = (s: number) =>
    `${Math.floor(s / 60)}:${s % 60
      .toString()
      .padStart(2, "0")}`;

  return (
    <Card sx={{ p: 1, mb: 1, elevation: 1 }}>
      <Typography variant="h6" sx={{ p: 0 }} component="div">
        {title}
      </Typography>

      <Slider
        min={0}
        max={durationSec}
        value={positionSec}
        onChange={(e) => audioRef.current?.seekTo(Number(e.target.value))}
        sx={{ mt: 1 }}
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <Typography variant="body1">{format(positionSec)}</Typography>
        <Typography variant="body1">{format(durationSec)}</Typography>
      </Box>

      <Button
        variant="contained"
        size="small"
        onClick={togglePlay}
        sx={{ mt: 1 }}
      >
        {isPlaying ? "Pause" : "Play"}
      </Button>

      <Button
        variant="outlined"
        size="small"
        onClick={() => {
          // Simulate Downloads.save
          window.alert(`Saved "${filename}"`);
        }}
        sx={{ mt: 1 }}
      >
        Save
      </Button>
    </Card>
  );
}