import { useState, type FormEvent } from "react";
import { JOB_MODELS, type CreateJobInput, type JobModel } from "../types";

const ACCEPTED_AUDIO =
  ".mp3,.wav,.m4a,.flac,.aac,.ogg,.opus,.webm";

export function UploadForm({
  disabled,
  onStart,
}: {
  disabled: boolean;
  onStart: (input: CreateJobInput) => void;
}) {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<JobModel>("htdemucs");
  const [validation, setValidation] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUrl = url.trim();
    if (!file && !trimmedUrl) {
      setValidation("Add a YouTube URL or choose an audio file.");
      return;
    }

    setValidation(null);
    onStart({ file, url: trimmedUrl, model });
  }

  return (
    <form className="panel upload-form" onSubmit={handleSubmit}>
      <h2>Create a track</h2>

      <label htmlFor="youtube-url">YouTube URL</label>
      <input
        id="youtube-url"
        type="url"
        value={url}
        placeholder="https://www.youtube.com/watch?v=..."
        onChange={(event) => setUrl(event.target.value)}
        disabled={disabled}
      />

      <label htmlFor="audio-file">Audio file</label>
      <input
        id="audio-file"
        type="file"
        accept={ACCEPTED_AUDIO}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      <p className="hint">MP3, WAV, M4A, FLAC, AAC, OGG, OPUS, or WEBM.</p>

      {url.trim() && file ? (
        <p className="hint precedence">
          URL takes precedence over the uploaded file.
        </p>
      ) : null}

      <label htmlFor="separation-model">Separation model</label>
      <select
        id="separation-model"
        value={model}
        onChange={(event) => setModel(event.target.value as JobModel)}
        disabled={disabled}
      >
        {JOB_MODELS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <p className="hint">
        htdemucs_ft is higher quality but roughly 4x slower on CPU.
      </p>

      {validation ? (
        <p className="form-error" role="alert">
          {validation}
        </p>
      ) : null}

      <button className="button primary" type="submit" disabled={disabled}>
        Process
      </button>
    </form>
  );
}
