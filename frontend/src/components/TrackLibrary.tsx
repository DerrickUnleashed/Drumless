import type { TrackSummary } from "../types";

function displayName(track: TrackSummary): string {
  return track.custom_name?.trim() || track.original_song_name;
}

export function TrackLibrary({
  tracks,
  selectedId,
  disabled,
  onSelect,
  onRename,
  onDelete,
  onRefresh,
}: {
  tracks: TrackSummary[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (track: TrackSummary) => void;
  onRename: (track: TrackSummary) => void;
  onDelete: (track: TrackSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="panel track-library" aria-label="Your tracks">
      <div className="track-library-head">
        <h2>Your tracks</h2>
        <button
          className="button subtle"
          type="button"
          onClick={onRefresh}
          disabled={disabled}
        >
          Refresh
        </button>
      </div>

      {tracks.length === 0 ? (
        <p className="hint">No saved tracks yet. Process a song to start.</p>
      ) : (
        <ul className="track-list">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={
                track.id === selectedId ? "track-item selected" : "track-item"
              }
            >
              <button
                className="track-open"
                type="button"
                onClick={() => onSelect(track)}
                disabled={disabled}
              >
                <span className="track-name">{displayName(track)}</span>
                <span className="track-meta">
                  {track.status}
                  {track.bpm ? ` · ${Math.round(track.bpm)} BPM` : ""}
                </span>
              </button>
              <div className="track-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => onRename(track)}
                  disabled={disabled}
                >
                  Rename
                </button>
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => onDelete(track)}
                  disabled={disabled}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
