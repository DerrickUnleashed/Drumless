import { AudioPlayer } from "./AudioPlayer";

export function AudioPanel({
  mixedUrl,
  backingUrl,
}: {
  mixedUrl: string | null;
  backingUrl: string | null;
}) {
  return (
    <section className="panel audio-panel">
      <h2>Listen</h2>
      <AudioPlayer label="Backing + click" src={mixedUrl} />
      <AudioPlayer label="Backing only" src={backingUrl} />
    </section>
  );
}
