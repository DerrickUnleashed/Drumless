import { Card, Typography, LinearProgress } from "@mui/material";

export function AndroidProgressScreen({
  job,
}: { job: { progress: number; message?: string; status?: string } | null }) {
  if (!job) return null;

  return (
    <Card sx={{ p: 2, mb: 2 }} elevation={1}>
      <Typography variant="h5" gutterBottom>
        Processing track
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This includes AI stem separation, so it can take minutes on CPU.
      </Typography>

      <LinearProgress
        variant="determinate"
        value={(job.progress ?? 0).coerceIn(0, 100)}
        sx={{ mt: 2 }}
      />

      <Typography variant="body2" color="text.secondary" mt={2}>
        {job.message ?? "Queued…"}
      </Typography>

      {job.status && (
        <Typography variant="body1" color="text.secondary" mt={1}>
          Job {job.status}
        </Typography>
      )}
    </Card>
  );
}