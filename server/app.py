"""Drumless — drum-removal + practice tempo tool (Gradio UI).

Run with:  python app.py
At the URL Gradio prints (default http://127.0.0.1:7860) you can:
    - paste a YouTube URL or upload an audio file
    - hit Process to run the full pipeline (separation is slow on CPU)
    - read/edit the detected BPM (±x2 / ÷2 buttons for misdetected tempo)
    - adjust click volume and audition the backing and mixed tracks,
      and download WAV or MP3

Outputs are the drum-free **backing** and **backing + click** mixes only.

The heavy stages (Demucs) run as a background job with a progress bar, not
inline in the request/response cycle.
"""
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import gradio as gr

from drumless.pipeline import (
    DEFAULT_CLICK_GAIN_DB,
    PipelineError,
    process_track,
)
from drumless.input_handler import InputError

OUTPUT_DIR = Path("drumless_output")
TEMP_DIR = Path(tempfile.gettempdir()) / "drumless_temp"

# Which demucs model to use.  Swap to "htdemucs_ft" for higher quality but
# ~4x slower separation.  This is the single knob for model choice.
DEMUCS_MODEL = "htdemucs"

BPM_RANGE = (40, 300)


def run_pipeline(uploaded_file, yt_url, model, progress=gr.Progress()):
    """Full pipeline with coarse stage progress. Returns outputs tuple."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    def report(msg):
        progress(0.1, desc=msg)

    try:
        result = process_track(
            uploaded_file=uploaded_file,
            yt_url=yt_url,
            workdir=TEMP_DIR / str(int(time.time() * 1000)),
            model=model,
            progress_cb=report,
        )
    except (InputError, PipelineError) as e:
        raise gr.Error(str(e))

    files = result["files"]

    # BPM + metadata summary shown to the user
    summary = (
        f"Detected tempo: **{result['bpm']:.0f} BPM** "
        f"(source: {result['tempo_source']}, librosa env: {result['bpm_env']:.0f})"
    )

    bpm_int = int(round(result["bpm"]))
    if not (BPM_RANGE[0] <= bpm_int <= BPM_RANGE[1]):
        bpm_int = BPM_RANGE[0]

    return (
        bpm_int,                        # -> bpm_in
        summary,                        # -> bpm_info
        files["mixed"]["wav"],          # -> mixed_player
        files["mixed"]["mp3"],          # -> mixed_mp3
        files["backing"]["wav"],        # -> backing_player
        files["backing"]["mp3"],        # -> backing_mp3
        files["mixed"]["wav"],          # -> mixed_wav_state (regen source update)
        files["backing"]["wav"],        # -> backing_wav_state (regen uses this)
    )


def regen_click(bpm, backing_wav, click_gain_db):
    """Regenerate mixed at a user-edited BPM (place a fresh click over the backing)."""
    import librosa
    from drumless.audio_utils import load_audio_as_numpy, save_numpy_as_wav
    from drumless.click_track import synthesize_click_track, build_mixed_track

    if not backing_wav:
        raise gr.Error("Process a track first.")

    workdir = TEMP_DIR / f"bpm_{int(time.time() * 1000)}"
    workdir.mkdir(parents=True, exist_ok=True)

    backing, sr = load_audio_as_numpy(backing_wav)
    dur_s = len(backing) / sr
    beat_times = librosa.frames_to_time(
        librosa.util.fix_frames(range(0, int(dur_s * bpm / 60))),
        sr=sr,
    )
    click = synthesize_click_track(beat_times, sr=sr, length=len(backing))
    mixed = build_mixed_track(backing, click, click_gain_db)

    mixed_wav_path = workdir / "mixed_edit.wav"
    save_numpy_as_wav(mixed, mixed_wav_path, sr)
    return str(mixed_wav_path)


def build_ui():
    with gr.Blocks(title="Drumless") as demo:
        gr.Markdown(
            "# 🥁 Drumless — Drum-Removal + Practice Tempo\n"
            "Upload a file **or** paste a YouTube URL, then **Process** to get a "
            "drum-free backing track, auto-detected BPM, and a click track."
        )

        with gr.Row():
            with gr.Column(scale=1):
                url_input = gr.Textbox(
                    label="YouTube URL (optional)",
                    placeholder="https://www.youtube.com/watch?v=…",
                )
                file_input = gr.File(
                    label="Or upload audio (mp3/wav/m4a/flac)",
                    file_types=[".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".opus", ".webm"],
                )
                model_dropdown = gr.Dropdown(
                    choices=["htdemucs", "htdemucs_ft"],
                    value=DEMUCS_MODEL,
                    label="Separation model",
                    info="htdemucs_ft is higher quality but ~4x slower on CPU.",
                )
                process_btn = gr.Button("🛠 Process", variant="primary")

                with gr.Accordion("Tap-beat / BPM settings", open=True):
                    bpm_in = gr.Number(label="BPM (editable)", value=120, minimum=BPM_RANGE[0], maximum=BPM_RANGE[1])
                    with gr.Row():
                        half_btn = gr.Button("÷2")
                        dbl_btn = gr.Button("×2")
                    bpm_info = gr.Markdown("")

                with gr.Accordion("Click volume", open=False):
                    click_gain = gr.Slider(
                        label="Click volume (dB relative to backing)",
                        minimum=-20, maximum=0, value=DEFAULT_CLICK_GAIN_DB,
                    )
                    regen_btn = gr.Button("Apply BPM + click volume")

            with gr.Column(scale=1):
                mixed_player = gr.Audio(label="Backing + click", type="filepath")
                backing_player = gr.Audio(label="Backing only (no drums)", type="filepath")

        with gr.Row():
            mixed_mp3 = gr.File(label="Download backing+click (MP3)")
            backing_mp3 = gr.File(label="Download backing (MP3)")

        # wire internal state (hidden) to feed the regen stage
        mixed_wav_state = gr.State()
        backing_wav_state = gr.State()

        def run_handler(uploaded, url, model, prog=gr.Progress()):
            return run_pipeline(uploaded, url, model, prog)

        process_btn.click(
            run_handler,
            inputs=[file_input, url_input, model_dropdown],
            outputs=[
                bpm_in, bpm_info,
                mixed_player, mixed_mp3,
                backing_player, backing_mp3,
                mixed_wav_state, backing_wav_state,
            ],
        )

        def half(h): return max(BPM_RANGE[0], (h or 120) // 2)
        def double(h): return min(BPM_RANGE[1], (h or 120) * 2)
        half_btn.click(half, inputs=bpm_in, outputs=bpm_in)
        dbl_btn.click(double, inputs=bpm_in, outputs=bpm_in)

        regen_btn.click(
            regen_click,
            inputs=[bpm_in, backing_wav_state, click_gain],
            outputs=[mixed_wav_state],
        ).then(
            lambda m: m,
            inputs=[mixed_wav_state],
            outputs=[mixed_player],
        )

    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.launch()
