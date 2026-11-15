export function DownloadPanel({
  backing,
  mixed,
}: {
  backing: { mp3: string } | null;
  mixed: { mp3: string } | null;
}) {
  if (backing === null && mixed === null) {
    return null;
  }

  return (
    <section className="panel download-panel">
      <h2>Download</h2>
      <div className="download-links">
        {backing ? (
          <a href={backing.mp3} download>
            Download backing (MP3)
          </a>
        ) : null}
        {mixed ? (
          <a href={mixed.mp3} download>
            Download backing + click (MP3)
          </a>
        ) : null}
      </div>
    </section>
  );
}
