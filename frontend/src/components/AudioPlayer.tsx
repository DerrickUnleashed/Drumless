export function AudioPlayer({
  label,
  src,
}: {
  label: string;
  src: string | null;
}) {
  return (
    <div className="audio-player">
      <h3>{label}</h3>
      <audio controls src={src ?? undefined} aria-label={label} />
      {src === null ? (
        <p className="hint">Process a track to listen.</p>
      ) : null}
    </div>
  );
}
