"""Minimal Supabase REST client (httpx only).

Avoids pulling the full supabase-py dependency tree. Covers the pieces the
Drumless backend needs:

  - verify a user's access token        (Auth API)
  - CRUD rows in `public.tracks`        (PostgREST, service role)
  - upload / download / sign / delete   (Storage API, service role)

The service-role key bypasses RLS, so every call here is trusted server-side
code. Never expose these keys to the browser.
"""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any

import httpx

BUCKET = "drumless-audio"


class SupabaseError(Exception):
    """Raised when the Supabase REST API returns a non-2xx response."""


class SupabaseRest:
    def __init__(
        self,
        url: str,
        anon_key: str,
        service_role_key: str,
        timeout: float = 60.0,
    ) -> None:
        self.url = url.rstrip("/")
        self.anon_key = anon_key
        self.service_role_key = service_role_key
        self._client = httpx.Client(timeout=timeout)

    # -- auth ---------------------------------------------------------------
    def get_user(self, access_token: str) -> dict[str, Any] | None:
        """Return the auth user for a bearer token, or None if invalid."""
        response = self._client.get(
            f"{self.url}/auth/v1/user",
            headers={
                "apikey": self.anon_key,
                "Authorization": f"Bearer {access_token}",
            },
        )
        if response.status_code != 200:
            return None
        return response.json()

    # -- PostgREST ----------------------------------------------------------
    @property
    def _db_headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    def select_tracks(self, user_id: str) -> list[dict[str, Any]]:
        response = self._client.get(
            f"{self.url}/rest/v1/tracks",
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "select": "*",
            },
            headers=self._db_headers,
        )
        self._raise(response)
        return response.json()

    def get_track(self, track_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        params = {"id": f"eq.{track_id}", "select": "*", "limit": "1"}
        if user_id is not None:
            params["user_id"] = f"eq.{user_id}"
        response = self._client.get(
            f"{self.url}/rest/v1/tracks", params=params, headers=self._db_headers
        )
        self._raise(response)
        rows = response.json()
        return rows[0] if rows else None

    def insert_track(self, row: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(
            f"{self.url}/rest/v1/tracks",
            headers={**self._db_headers, "Prefer": "return=representation"},
            json=row,
        )
        self._raise(response)
        return response.json()[0]

    def update_track(self, track_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        response = self._client.patch(
            f"{self.url}/rest/v1/tracks",
            params={"id": f"eq.{track_id}"},
            headers={**self._db_headers, "Prefer": "return=representation"},
            json=patch,
        )
        self._raise(response)
        rows = response.json()
        return rows[0] if rows else None

    def delete_track(self, track_id: str) -> None:
        response = self._client.delete(
            f"{self.url}/rest/v1/tracks",
            params={"id": f"eq.{track_id}"},
            headers=self._db_headers,
        )
        self._raise(response)

    # -- Storage ------------------------------------------------------------
    @property
    def _storage_headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

    def upload_file(
        self, path: str, file_path: str | Path, content_type: str | None = None
    ) -> None:
        file_path = Path(file_path)
        ctype = content_type or mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        with file_path.open("rb") as fh:
            response = self._client.post(
                f"{self.url}/storage/v1/object/{BUCKET}/{path}",
                headers={**self._storage_headers, "Content-Type": ctype, "x-upsert": "true"},
                content=fh.read(),
            )
        self._raise(response)

    def download_file(self, path: str, dest: str | Path) -> Path:
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        response = self._client.get(
            f"{self.url}/storage/v1/object/{BUCKET}/{path}",
            headers=self._storage_headers,
        )
        self._raise(response)
        dest.write_bytes(response.content)
        return dest

    def signed_url(self, path: str, expires_in: int = 3600, download: bool = False) -> str:
        response = self._client.post(
            f"{self.url}/storage/v1/object/sign/{BUCKET}/{path}",
            headers=self._storage_headers,
            json={"expiresIn": expires_in},
        )
        self._raise(response)
        signed = response.json()["signedURL"]
        url = f"{self.url}/storage/v1{signed}"
        return f"{url}&download=" if download else url

    def delete_files(self, paths: list[str]) -> None:
        if not paths:
            return
        response = self._client.delete(
            f"{self.url}/storage/v1/object/{BUCKET}",
            headers={**self._storage_headers, "Content-Type": "application/json"},
            json={"prefixes": paths},
        )
        self._raise(response)

    # -- helpers ------------------------------------------------------------
    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.status_code >= 400:
            raise SupabaseError(
                f"Supabase {response.request.method} {response.request.url} "
                f"-> {response.status_code}: {response.text[:500]}"
            )


_client: SupabaseRest | None = None


def get_client() -> SupabaseRest | None:
    """Return the configured client, or None when Supabase env vars are absent."""
    global _client
    if _client is not None:
        return _client
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and anon and service):
        return None
    _client = SupabaseRest(url, anon, service)
    return _client


def reset_client() -> None:
    global _client
    _client = None


def track_prefix(user_id: str, track_id: str) -> str:
    return f"{user_id}/{track_id}"
