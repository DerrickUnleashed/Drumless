from fastapi.testclient import TestClient

import api


class FakeSupabase:
    def __init__(self):
        self.rows = [
            {
                "id": "t1",
                "user_id": "u1",
                "original_song_name": "song.wav",
                "custom_name": None,
                "source_url": None,
                "bpm": 120,
                "click_gain_db": 6,
                "duration_seconds": 30,
                "status": "done",
                "error_message": None,
                "original_storage_path": "u1/t1/original.wav",
                "backing_storage_path": "u1/t1/backing.wav",
                "mixed_storage_path": "u1/t1/mixed.wav",
                "first_beat": 0.2,
                "created_at": None,
                "updated_at": None,
            }
        ]
        self.deleted_files = []

    def get_user(self, token):
        return {"id": "u1"} if token == "good" else None

    def select_tracks(self, user_id):
        return [r for r in self.rows if r["user_id"] == user_id]

    def get_track(self, track_id, user_id=None):
        for row in self.rows:
            if row["id"] == track_id and (user_id is None or row["user_id"] == user_id):
                return row
        return None

    def update_track(self, track_id, patch):
        row = self.get_track(track_id)
        row.update(patch)
        return row

    def delete_track(self, track_id):
        self.rows = [r for r in self.rows if r["id"] != track_id]

    def delete_files(self, paths):
        self.deleted_files.extend(paths)

    def signed_url(self, path, expires_in=3600, download=False):
        return f"https://example.test/{path}?expires={expires_in}"


def setup_fake(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(api, "get_client", lambda: fake)
    return fake


def test_tracks_requires_bearer_token(monkeypatch):
    setup_fake(monkeypatch)
    response = TestClient(api.app).get("/api/tracks")
    assert response.status_code == 401


def test_tracks_rejects_invalid_token(monkeypatch):
    setup_fake(monkeypatch)
    response = TestClient(api.app).get(
        "/api/tracks", headers={"Authorization": "Bearer bad"}
    )
    assert response.status_code == 401


def test_tracks_lists_only_own_rows(monkeypatch):
    setup_fake(monkeypatch)
    response = TestClient(api.app).get(
        "/api/tracks", headers={"Authorization": "Bearer good"}
    )
    assert response.status_code == 200
    tracks = response.json()["tracks"]
    assert [t["id"] for t in tracks] == ["t1"]


def test_delete_track_removes_storage_and_row(monkeypatch):
    fake = setup_fake(monkeypatch)
    response = TestClient(api.app).delete(
        "/api/tracks/t1", headers={"Authorization": "Bearer good"}
    )
    assert response.status_code == 200
    assert fake.rows == []
    assert "u1/t1/click.wav" in fake.deleted_files
    assert "u1/t1/backing.mp3" in fake.deleted_files


def test_signed_url_endpoint(monkeypatch):
    setup_fake(monkeypatch)
    response = TestClient(api.app).get(
        "/api/tracks/t1/url?variant=mixed&format=wav",
        headers={"Authorization": "Bearer good"},
    )
    assert response.status_code == 200
    assert "u1/t1/mixed.wav" in response.json()["url"]
