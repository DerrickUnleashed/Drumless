from fastapi.testclient import TestClient

import api


def test_second_job_while_first_is_queued_returns_409(monkeypatch):
    api.JOBS.clear()
    monkeypatch.setattr(api, "_run_job", lambda *args: None)
    client = TestClient(api.app)

    first = client.post("/api/jobs", data={"url": "https://example.com/a"})
    second = client.post("/api/jobs", data={"url": "https://example.com/b"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert "already processing" in second.json()["detail"]


def test_queued_job_blocks_new_job():
    api.JOBS.clear()
    queued = api.Job("job_queued")
    queued.status = "queued"
    api.JOBS[queued.id] = queued
    client = TestClient(api.app)

    response = client.post("/api/jobs", data={"url": "https://example.com/c"})

    assert response.status_code == 409
