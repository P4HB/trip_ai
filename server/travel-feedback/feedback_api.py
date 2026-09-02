#!/usr/bin/env python3
"""Minimal same-origin API for durable travel recommendation feedback."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit


V2_SCHEMA_VERSION = "travel-recommendation-feedback-log-v2"
V3_SCHEMA_VERSION = "travel-recommendation-feedback-log-v3"
SCHEMA_VERSION = V2_SCHEMA_VERSION
API_PATH = "/travel/api/feedback"
REVIEW_SCHEMA_VERSION = "kakao-place-reviews-v1"
REVIEW_PATH_PATTERN = re.compile(r"^/travel/api/places/([^/]+)/reviews$")
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_ENTRIES = 100
MAX_COMMENT_LENGTH = 300
MAX_PARTICIPANT_NAME_LENGTH = 30


class ValidationError(ValueError):
    pass


class SubmissionConflict(ValueError):
    pass


class ReviewStore:
    def __init__(self, db_path: str):
        self.db_path = str(Path(db_path).resolve(strict=True))
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        uri_path = Path(self.db_path).as_posix()
        connection = sqlite3.connect(f"file:{uri_path}?mode=ro", uri=True, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Kakao review database integrity check failed")
            schema_version = connection.execute(
                "SELECT value FROM metadata WHERE key = 'schema_version'"
            ).fetchone()
            if schema_version is None or schema_version[0] != REVIEW_SCHEMA_VERSION:
                raise RuntimeError("Kakao review database schema is unsupported")

    def fetch(self, contentid: str, limit: int, offset: int) -> dict[str, Any]:
        with self.connect() as connection:
            metadata = dict(connection.execute("SELECT key, value FROM metadata"))
            places = [
                {
                    "place_id": row["kakao_place_id"],
                    "name": row["kakao_place_name"],
                    "url": row["kakao_place_url"],
                }
                for row in connection.execute(
                    """
                    SELECT kakao_place_id, kakao_place_name, kakao_place_url
                    FROM place_links
                    WHERE contentid = ?
                    ORDER BY CAST(kakao_place_id AS INTEGER)
                    """,
                    (contentid,),
                )
            ]
            total = connection.execute(
                """
                SELECT COUNT(*)
                FROM reviews r
                JOIN place_links p ON p.kakao_place_id = r.kakao_place_id
                WHERE p.contentid = ?
                """,
                (contentid,),
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT r.review_id, r.kakao_place_id, r.kakao_place_name, r.kakao_place_url,
                       r.rating, r.review_date, r.content, r.tags_json, r.likes, r.source_snapshot
                FROM reviews r
                JOIN place_links p ON p.kakao_place_id = r.kakao_place_id
                WHERE p.contentid = ?
                ORDER BY r.source_order, r.review_id
                LIMIT ? OFFSET ?
                """,
                (contentid, limit, offset),
            )
            reviews = [
                {
                    "review_id": row["review_id"],
                    "kakao_place_id": row["kakao_place_id"],
                    "place_name": row["kakao_place_name"],
                    "place_url": row["kakao_place_url"],
                    "rating": row["rating"],
                    "date": row["review_date"],
                    "content": row["content"],
                    "tags": json.loads(row["tags_json"]),
                    "likes": row["likes"],
                    "source_snapshot": row["source_snapshot"],
                }
                for row in rows
            ]
        return {
            "schema_version": REVIEW_SCHEMA_VERSION,
            "place_id": contentid,
            "collected_at": metadata.get("collected_at"),
            "collection_limit_per_place": int(metadata.get("review_limit_per_place", "5")),
            "total": total,
            "limit": limit,
            "offset": offset,
            "kakao_places": places,
            "reviews": reviews,
        }


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso_datetime(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be an ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{field} must be an ISO 8601 string") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{field} must include a timezone")
    return parsed


def validate_v2_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") != V2_SCHEMA_VERSION:
        raise ValidationError("unsupported schema_version")

    submission_id = payload.get("submission_id")
    try:
        parsed_id = uuid.UUID(submission_id)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValidationError("submission_id must be a UUID") from exc
    if str(parsed_id) != submission_id.lower():
        raise ValidationError("submission_id must use canonical UUID form")

    parse_iso_datetime(payload.get("created_at"), "created_at")
    storage = payload.get("storage")
    if not isinstance(storage, dict) or storage.get("method") != "server_api":
        raise ValidationError("storage.method must be server_api")
    if storage.get("endpoint") != API_PATH:
        raise ValidationError("storage.endpoint is invalid")
    if storage.get("server_transmitted") is not True or storage.get("web_storage_used") is not False:
        raise ValidationError("storage flags are invalid")

    feedback = payload.get("feedback")
    if not isinstance(feedback, dict):
        raise ValidationError("feedback must be an object")
    entries = feedback.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_ENTRIES:
        raise ValidationError(f"feedback.entries must contain 1..{MAX_ENTRIES} items")
    required = feedback.get("required_place_count")
    completed = feedback.get("completed_place_count")
    if type(required) is not int or type(completed) is not int:
        raise ValidationError("feedback counts must be integers")
    if required != completed or completed != len(entries) or feedback.get("all_scores_completed") is not True:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValidationError(f"feedback.entries[{index}] must be an object")
        place_id = entry.get("place_id")
        if not isinstance(place_id, str) or not place_id or len(place_id) > 100:
            raise ValidationError(f"feedback.entries[{index}].place_id is invalid")
        if place_id in seen_place_ids:
            raise ValidationError("feedback place_id values must be unique")
        seen_place_ids.add(place_id)
        score = entry.get("score")
        if type(score) is not int or not 1 <= score <= 5:
            raise ValidationError(f"feedback.entries[{index}].score must be 1..5")
        comment = entry.get("comment")
        if not isinstance(comment, str) or len(comment) > MAX_COMMENT_LENGTH:
            raise ValidationError(f"feedback.entries[{index}].comment is too long")
        if not isinstance(entry.get("title"), str) or not isinstance(entry.get("contexts"), list):
            raise ValidationError(f"feedback.entries[{index}] metadata is invalid")

    if not isinstance(payload.get("source"), dict):
        raise ValidationError("source must be an object")
    if not isinstance(payload.get("user_selections"), dict):
        raise ValidationError("user_selections must be an object")
    if not isinstance(payload.get("recommendation_result"), dict):
        raise ValidationError("recommendation_result must be an object")
    return payload


def validate_v3_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") != V3_SCHEMA_VERSION:
        raise ValidationError("unsupported schema_version")

    participant_name = payload.get("participant_name")
    if participant_name is not None:
        if not isinstance(participant_name, str) or not 1 <= len(participant_name) <= MAX_PARTICIPANT_NAME_LENGTH:
            raise ValidationError(f"participant_name must contain 1..{MAX_PARTICIPANT_NAME_LENGTH} characters")
        if participant_name != participant_name.strip():
            raise ValidationError("participant_name must not have leading or trailing whitespace")
        if any(ord(character) < 32 or ord(character) == 127 for character in participant_name):
            raise ValidationError("participant_name must not contain control characters")

    session_id = payload.get("session_id")
    try:
        parsed_id = uuid.UUID(session_id)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValidationError("session_id must be a UUID") from exc
    if str(parsed_id) != session_id.lower():
        raise ValidationError("session_id must use canonical UUID form")

    revision = payload.get("revision")
    if type(revision) is not int or revision < 1:
        raise ValidationError("revision must be a positive integer")
    parse_iso_datetime(payload.get("created_at"), "created_at")
    parse_iso_datetime(payload.get("updated_at"), "updated_at")

    storage = payload.get("storage")
    if not isinstance(storage, dict) or storage.get("method") != "server_autosave":
        raise ValidationError("storage.method must be server_autosave")
    if storage.get("endpoint") != API_PATH:
        raise ValidationError("storage.endpoint is invalid")
    if storage.get("server_transmitted") is not True or storage.get("web_storage_used") is not False:
        raise ValidationError("storage flags are invalid")

    feedback = payload.get("feedback")
    if not isinstance(feedback, dict):
        raise ValidationError("feedback must be an object")
    entries = feedback.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_ENTRIES:
        raise ValidationError(f"feedback.entries must contain 1..{MAX_ENTRIES} items")
    required = feedback.get("required_place_count")
    completed = feedback.get("completed_place_count")
    if type(required) is not int or type(completed) is not int:
        raise ValidationError("feedback counts must be integers")
    if required != len(entries) or not 0 <= completed <= required:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    actual_completed = 0
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValidationError(f"feedback.entries[{index}] must be an object")
        place_id = entry.get("place_id")
        if not isinstance(place_id, str) or not place_id or len(place_id) > 100:
            raise ValidationError(f"feedback.entries[{index}].place_id is invalid")
        if place_id in seen_place_ids:
            raise ValidationError("feedback place_id values must be unique")
        seen_place_ids.add(place_id)
        score = entry.get("score")
        score_label = entry.get("score_label")
        if score is None:
            if score_label is not None:
                raise ValidationError(f"feedback.entries[{index}].score_label must be null")
        elif type(score) is int and 1 <= score <= 5:
            if not isinstance(score_label, str) or not score_label:
                raise ValidationError(f"feedback.entries[{index}].score_label is invalid")
            actual_completed += 1
        else:
            raise ValidationError(f"feedback.entries[{index}].score must be null or 1..5")
        comment = entry.get("comment")
        if not isinstance(comment, str) or len(comment) > MAX_COMMENT_LENGTH:
            raise ValidationError(f"feedback.entries[{index}].comment is too long")
        if not isinstance(entry.get("title"), str) or not isinstance(entry.get("contexts"), list):
            raise ValidationError(f"feedback.entries[{index}] metadata is invalid")

    all_completed = completed == required
    if completed != actual_completed or feedback.get("all_scores_completed") is not all_completed:
        raise ValidationError("feedback score completion state is invalid")
    if not isinstance(payload.get("source"), dict):
        raise ValidationError("source must be an object")
    if not isinstance(payload.get("user_selections"), dict):
        raise ValidationError("user_selections must be an object")
    if not isinstance(payload.get("recommendation_result"), dict):
        raise ValidationError("recommendation_result must be an object")
    return payload


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") == V2_SCHEMA_VERSION:
        return validate_v2_payload(payload)
    if payload.get("schema_version") == V3_SCHEMA_VERSION:
        return validate_v3_payload(payload)
    raise ValidationError("unsupported schema_version")


class FeedbackStore:
    def __init__(self, db_path: str, retention_days: int = 90):
        self.db_path = db_path
        self.retention_days = retention_days
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback_submissions (
                    submission_id TEXT PRIMARY KEY,
                    received_at TEXT NOT NULL,
                    client_created_at TEXT NOT NULL,
                    schema_version TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_feedback_received_at ON feedback_submissions(received_at)"
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback_sessions (
                    session_id TEXT PRIMARY KEY,
                    revision INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    schema_version TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_feedback_sessions_updated_at ON feedback_sessions(updated_at)"
            )
            self._prune(connection, utc_now())

    def _prune(self, connection: sqlite3.Connection, now: datetime) -> None:
        cutoff = isoformat_utc(now - timedelta(days=self.retention_days))
        connection.execute("DELETE FROM feedback_submissions WHERE received_at < ?", (cutoff,))
        connection.execute("DELETE FROM feedback_sessions WHERE updated_at < ?", (cutoff,))

    def save(self, payload: dict[str, Any], now: datetime | None = None) -> tuple[str, bool]:
        received_at = isoformat_utc(now or utc_now())
        canonical_payload = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        with self.connect() as connection:
            self._prune(connection, now or utc_now())
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO feedback_submissions
                    (submission_id, received_at, client_created_at, schema_version, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload["submission_id"],
                    received_at,
                    payload["created_at"],
                    payload["schema_version"],
                    canonical_payload,
                ),
            )
            duplicate = cursor.rowcount == 0
            if duplicate:
                row = connection.execute(
                    "SELECT received_at, payload_json FROM feedback_submissions WHERE submission_id = ?",
                    (payload["submission_id"],),
                ).fetchone()
                if row is None:
                    raise sqlite3.IntegrityError("duplicate submission disappeared")
                if row[1] != canonical_payload:
                    raise SubmissionConflict("submission_id already belongs to another payload")
                received_at = row[0]
        return received_at, duplicate

    def save_session(
        self, payload: dict[str, Any], now: datetime | None = None
    ) -> tuple[str, bool, bool, int]:
        received_at = isoformat_utc(now or utc_now())
        canonical_payload = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        with self.connect() as connection:
            self._prune(connection, now or utc_now())
            row = connection.execute(
                "SELECT revision, updated_at, payload_json FROM feedback_sessions WHERE session_id = ?",
                (payload["session_id"],),
            ).fetchone()
            if row is None:
                connection.execute(
                    """
                    INSERT INTO feedback_sessions
                        (session_id, revision, created_at, updated_at, schema_version, payload_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        payload["session_id"],
                        payload["revision"],
                        payload["created_at"],
                        received_at,
                        payload["schema_version"],
                        canonical_payload,
                    ),
                )
                return received_at, True, False, payload["revision"]

            stored_revision, stored_at, stored_payload = int(row[0]), row[1], row[2]
            if payload["revision"] < stored_revision:
                return stored_at, False, True, stored_revision
            if payload["revision"] == stored_revision:
                if stored_payload != canonical_payload:
                    raise SubmissionConflict("session revision already belongs to another payload")
                return stored_at, False, True, stored_revision
            connection.execute(
                """
                UPDATE feedback_sessions
                SET revision = ?, updated_at = ?, schema_version = ?, payload_json = ?
                WHERE session_id = ?
                """,
                (
                    payload["revision"],
                    received_at,
                    payload["schema_version"],
                    canonical_payload,
                    payload["session_id"],
                ),
            )
            return received_at, False, False, payload["revision"]


class MemoryRateLimiter:
    def __init__(self, limit: int = 60, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        cutoff = current - self.window_seconds
        with self._lock:
            events = [event for event in self._events.get(key, []) if event > cutoff]
            allowed = len(events) < self.limit
            if allowed:
                events.append(current)
            if events:
                self._events[key] = events
            else:
                self._events.pop(key, None)
            return allowed


class FeedbackRequestHandler(BaseHTTPRequestHandler):
    server_version = "TravelFeedback/1"

    @property
    def feedback_server(self) -> "FeedbackHTTPServer":
        return self.server  # type: ignore[return-value]

    def log_message(self, format_string: str, *args: Any) -> None:
        # Do not persist client IPs or request headers in application logs.
        print(f"travel-feedback {self.command} {self.path}", flush=True)

    def send_json(self, status: int, body: dict[str, Any], cache_control: str = "no-store") -> None:
        encoded = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/healthz":
            self.send_json(200, {"ok": True, "review_catalog": self.feedback_server.review_store is not None})
            return
        match = REVIEW_PATH_PATTERN.fullmatch(parsed.path)
        if not match:
            self.send_json(404, {"ok": False, "error": "not_found"})
            return
        contentid = match.group(1)
        if not contentid.isascii() or not contentid.isdigit() or len(contentid) > 20:
            self.send_json(400, {"ok": False, "error": "invalid_place_id"})
            return
        if self.feedback_server.review_store is None:
            self.send_json(503, {"ok": False, "error": "review_catalog_unavailable"})
            return
        query = parse_qs(parsed.query, keep_blank_values=True)
        if any(key not in {"limit", "offset"} for key in query) or any(len(values) != 1 for values in query.values()):
            self.send_json(400, {"ok": False, "error": "invalid_pagination"})
            return
        limit_text = query.get("limit", ["5"])[0]
        offset_text = query.get("offset", ["0"])[0]
        if not limit_text.isascii() or not limit_text.isdigit() or not offset_text.isascii() or not offset_text.isdigit():
            self.send_json(400, {"ok": False, "error": "invalid_pagination"})
            return
        limit, offset = int(limit_text), int(offset_text)
        if not 1 <= limit <= 20 or not 0 <= offset <= 1_000_000:
            self.send_json(400, {"ok": False, "error": "invalid_pagination"})
            return
        try:
            body = self.feedback_server.review_store.fetch(contentid, limit, offset)
        except sqlite3.Error:
            self.send_json(503, {"ok": False, "error": "review_catalog_unavailable"})
            return
        self.send_json(200, body, "public, max-age=3600")

    def do_POST(self) -> None:
        if self.path != API_PATH:
            self.send_json(404, {"ok": False, "error": "not_found"})
            return
        origin = self.headers.get("Origin")
        if origin and origin != self.feedback_server.public_origin:
            self.send_json(403, {"ok": False, "error": "origin_not_allowed"})
            return
        content_type = self.headers.get("Content-Type", "").partition(";")[0].strip().lower()
        if content_type != "application/json":
            self.send_json(415, {"ok": False, "error": "application_json_required"})
            return
        trusted_client_ip = self.headers.get("X-Travel-Client-IP", "").strip()
        rate_key = trusted_client_ip or self.client_address[0]
        if not self.feedback_server.rate_limiter.allow(rate_key):
            self.send_json(429, {"ok": False, "error": "rate_limit_exceeded"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_json(411, {"ok": False, "error": "content_length_required"})
            return
        if content_length <= 0:
            self.send_json(400, {"ok": False, "error": "empty_body"})
            return
        if content_length > MAX_BODY_BYTES:
            self.send_json(413, {"ok": False, "error": "payload_too_large"})
            return
        try:
            raw_body = self.rfile.read(content_length)
            payload = validate_payload(json.loads(raw_body.decode("utf-8")))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "error": "invalid_json"})
            return
        except ValidationError as exc:
            self.send_json(422, {"ok": False, "error": "invalid_feedback", "detail": str(exc)})
            return
        try:
            if payload["schema_version"] == V3_SCHEMA_VERSION:
                received_at, created, stale, revision = self.feedback_server.store.save_session(payload)
            else:
                received_at, duplicate = self.feedback_server.store.save(payload)
        except SubmissionConflict:
            conflict_error = "feedback_revision_conflict" if payload["schema_version"] == V3_SCHEMA_VERSION else "submission_id_conflict"
            self.send_json(409, {"ok": False, "error": conflict_error})
            return
        except sqlite3.Error:
            self.send_json(500, {"ok": False, "error": "storage_unavailable"})
            return
        if payload["schema_version"] == V3_SCHEMA_VERSION:
            self.send_json(
                201 if created else 200,
                {
                    "ok": True,
                    "session_id": payload["session_id"],
                    "revision": revision,
                    "received_at": received_at,
                    "created": created,
                    "stale": stale,
                },
            )
        else:
            self.send_json(
                200 if duplicate else 201,
                {
                    "ok": True,
                    "submission_id": payload["submission_id"],
                    "received_at": received_at,
                    "duplicate": duplicate,
                },
            )


class FeedbackHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        store: FeedbackStore,
        public_origin: str,
        rate_limiter: MemoryRateLimiter | None = None,
        review_store: ReviewStore | None = None,
    ):
        self.store = store
        self.public_origin = public_origin.rstrip("/")
        self.rate_limiter = rate_limiter or MemoryRateLimiter()
        self.review_store = review_store
        super().__init__(server_address, FeedbackRequestHandler)


def main() -> None:
    port = int(os.environ.get("TRAVEL_FEEDBACK_PORT", "8200"))
    db_path = os.environ.get("TRAVEL_FEEDBACK_DB_PATH", "/data/feedback.sqlite3")
    public_origin = os.environ.get("TRAVEL_PUBLIC_ORIGIN", "http://127.0.0.1:8080")
    retention_days = int(os.environ.get("TRAVEL_FEEDBACK_RETENTION_DAYS", "90"))
    review_db_path = os.environ.get("TRAVEL_REVIEW_DB_PATH", "/app/data/kakao_reviews.sqlite3")
    server = FeedbackHTTPServer(
        ("0.0.0.0", port),
        FeedbackStore(db_path, retention_days),
        public_origin,
        review_store=ReviewStore(review_db_path),
    )
    print(f"travel-feedback listening on :{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
