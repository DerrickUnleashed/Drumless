import numpy as np
from fastapi.testclient import TestClient

import api


def make_wav(path, duration_s=2.0, sr=44100):
    from drumless.audio_utils import save_numpy_as_wav
    samples = np.zeros((int(duration_s * sr), 2), dtype=np.float32)
    save_numpy_as_wav(samples, path, sr)
    return path


def test_audio_mp3_endpoint_converts_and_serves_audio_mpeg(tmp_path):
    wav = make_wav(tmp_path / "backing.wav")
    job = api.Job("job_test")
    job.status = "done"
    job._source_paths = {"backing": wav}
    api.JOBS[job.id] = job

    client = TestClient(api.app)
    response = client.get("/api/jobs/job_test/audio/backing.mp3")

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0
    assert job._source_paths["backing_mp3"].exists()


def test_audio_missing_variant_returns_404(tmp_path):
    wav = make_wav(tmp_path / "backing.wav")
    job = api.Job("job_missing")
    job.status = "done"
    job._source_paths = {"backing": wav}
    api.JOBS[job.id] = job

    client = TestClient(api.app)
    response = client.get("/api/jobs/job_missing/audio/mixed.wav")

    assert response.status_code == 404


def test_regen_uses_detected_phase_and_writes_mixed_mp3(tmp_path, monkeypatch):
    backing = make_wav(tmp_path / "backing.wav", duration_s=2.0)
    click = make_wav(tmp_path / "click.wav", duration_s=2.0)
    job = api.Job("job_regen")
    job.status = "done"
    job.bpm = 120.0
    job.first_beat = 0.3
    job._source_paths = {"backing": backing, "click": click, "mixed": backing}
    api.JOBS[job.id] = job

    calls = {}

    def fake_build_beat_times(duration_s, bpm, first_beat=None):
        calls["args"] = (duration_s, bpm, first_beat)
        return np.array([0.3, 0.8, 1.3, 1.8])

    monkeypatch.setattr(api, "build_beat_times", fake_build_beat_times)

    client = TestClient(api.app)
    response = client.post("/api/jobs/job_regen/regen", json={"bpm": 120})

    assert response.status_code == 200
    assert calls["args"] == (2.0, 120.0, 0.3)
    assert job._source_paths["mixed_mp3"].exists()
