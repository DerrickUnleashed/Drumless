
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

      <div className="audio-player-controls">
        <audio
          controls
          src={src ?? undefined}
          aria-label={label}
        />

        {src && (
          <a
            href={src}
            download={label === "Backing only" ? "backing" : "mixed"}
            className="button primary small download-button"
            aria-label={`Download ${label}`}
          >
            <svg
              className="button-icon"
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 2v9" />
              <path d="m4.5 7.5 3.5 3.5 3.5-3.5" />
              <path d="M3 13h10" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
