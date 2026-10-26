#!/usr/bin/env python3
"""Minimal same-origin API for durable travel recommendation feedback."""

from __future__ import annotations
from contextlib import closing

import json
import ipaddress
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


from feedback_contract import (V2_SCHEMA_VERSION, V3_SCHEMA_VERSION, SCHEMA_VERSION, API_PATH, ITINERARY_PATH, MAX_ITINERARY_BODY_BYTES, REVIEW_SCHEMA_VERSION, REVIEW_PATH_PATTERN, MAX_BODY_BYTES, MAX_ENTRIES, MAX_SESSION_ENTRIES, MAX_COMMENT_LENGTH, MAX_PARTICIPANT_NAME_LENGTH, ValidationError, SubmissionConflict, parse_iso_datetime)
from feedback_validation import validate_payload, validate_v3_payload, validate_v2_payload
import settings

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
        with closing(self.connect()) as connection, connection:
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Kakao review database integrity check failed")
            schema_version = connection.execute(
                "SELECT value FROM metadata WHERE key = 'schema_version'"
            ).fetchone()
            if schema_version is None or schema_version[0] != REVIEW_SCHEMA_VERSION:
                raise RuntimeError("Kakao review database schema is unsupported")

    def fetch(self, contentid: str, limit: int, offset: int) -> dict[str, Any]:
        with closing(self.connect()) as connection, connection:
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
        with closing(self.connect()) as connection, connection:
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

    def prune(self, now: datetime | None = None) -> None:
        with closing(self.connect()) as connection, connection:
            self._prune(connection, now or utc_now())

    def save(self, payload: dict[str, Any], now: datetime | None = None) -> tuple[str, bool]:
        received_at = isoformat_utc(now or utc_now())
        canonical_payload = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        with closing(self.connect()) as connection, connection:
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
        with closing(self.connect()) as connection, connection:
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
    def __init__(self, limit: int = 60, window_seconds: int = 60, max_keys: int = 10000):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self.max_keys = max_keys
        self._next_prune = 0.0

    def prune(self, now: float | None = None) -> None:
        current = now if now is not None else time.monotonic()
        with self._lock:
            self._prune(current)

    def _prune(self, current: float) -> None:
        self._events = {key: events for key, events in self._events.items()
                        if events and events[-1] > current - self.window_seconds}
        self._next_prune = current + min(self.window_seconds, 60)

    def allow(self, key: str, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        cutoff = current - self.window_seconds
        with self._lock:
            if current >= self._next_prune:
                self._prune(current)
            if key not in self._events and len(self._events) >= self.max_keys:
                return False
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
    # Exact paths -> handler method; review lookups match REVIEW_PATH_PATTERN (SPEC-113 REQ-008).
    GET_ROUTES = {"/healthz": "get_health"}
    POST_ROUTES = {ITINERARY_PATH: "post_itinerary", API_PATH: "post_feedback"}

    @property
    def feedback_server(self) -> "FeedbackHTTPServer":
        return self.server  # type: ignore[return-value]

    def log_message(self, format_string: str, *args: Any) -> None:
        # Do not persist client IPs or request headers in application logs.
        route = urlsplit(self.path).path
        route = route if route in {*self.POST_ROUTES, *self.GET_ROUTES} else "other"
        print(f"travel-feedback {self.command} {route}", flush=True)

    def send_json(self, status: int, body: dict[str, Any], cache_control: str = "no-store") -> None:
        encoded = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def content_length(self) -> int | None:
        """Declared body size, or None when Content-Length is missing or not an integer."""
        try:
            return int(self.headers.get("Content-Length", ""))
        except ValueError:
            return None

    def read_json(self, length: int) -> Any:
        """Read exactly the declared body as UTF-8 JSON; decode and I/O errors propagate to the route."""
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        route = self.GET_ROUTES.get(parsed.path)
        if route:
            getattr(self, route)()
            return
        match = REVIEW_PATH_PATTERN.fullmatch(parsed.path)
        if not match:
            self.send_json(404, {"ok": False, "error": "not_found"})
            return
        self.get_reviews(parsed, match.group(1))

    def do_POST(self) -> None:
        route = self.POST_ROUTES.get(self.path)
        if route is None:
            self.send_json(404, {"ok": False, "error": "not_found"})
            return
        getattr(self, route)()

    def get_health(self) -> None:
        self.send_json(200, {"ok": True, "review_catalog": self.feedback_server.review_store is not None})

    def get_reviews(self, parsed: Any, contentid: str) -> None:
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

    def post_feedback(self) -> None:
        origin = self.headers.get("Origin")
        if origin and not self.feedback_server.origin_allowed(origin):
            self.send_json(403, {"ok": False, "error": "origin_not_allowed"})
            return
        content_type = self.headers.get("Content-Type", "").partition(";")[0].strip().lower()
        if content_type != "application/json":
            self.send_json(415, {"ok": False, "error": "application_json_required"})
            return
        rate_key = self.feedback_server.client_rate_key(self.client_address[0], self.headers.get("X-Travel-Client-IP", ""))
        if not self.feedback_server.rate_limiter.allow(rate_key):
            self.send_json(429, {"ok": False, "error": "rate_limit_exceeded"})
            return
        content_length = self.content_length()
        if content_length is None:
            self.send_json(411, {"ok": False, "error": "content_length_required"})
            return
        if content_length <= 0:
            self.send_json(400, {"ok": False, "error": "empty_body"})
            return
        if content_length > MAX_BODY_BYTES:
            self.send_json(413, {"ok": False, "error": "payload_too_large"})
            return
        try:
            payload = validate_payload(self.read_json(content_length))
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

    def post_itinerary(self) -> None:
        server = self.feedback_server
        # A public, billable endpoint requires an exact browser Origin. The edge
        # forwards only the explicitly configured Vercel origin for this route.
        if not server.origin_allowed(self.headers.get("Origin")):
            self.send_json(403, {"status": "unavailable", "error": "origin_not_allowed"})
            return
        if self.headers.get("Content-Type", "").partition(";")[0].strip().lower() != "application/json":
            self.send_json(415, {"status": "needs_input", "error": "application_json_required"})
            return
        if self.headers.get("Transfer-Encoding"):
            self.send_json(400, {"status": "needs_input", "error": "transfer_encoding_not_supported"})
            return
        length = self.content_length()
        if length is None:
            self.send_json(411, {"status": "needs_input", "error": "content_length_required"})
            return
        if not 0 < length <= MAX_ITINERARY_BODY_BYTES:
            self.send_json(413 if length > MAX_ITINERARY_BODY_BYTES else 400,
                           {"status": "needs_input", "error": "invalid_body_size"})
            return
        try:
            self.connection.settimeout(10)
            payload = self.read_json(length)
        except (UnicodeDecodeError, json.JSONDecodeError, TimeoutError, OSError):
            self.send_json(400, {"status": "needs_input", "error": "invalid_json"})
            return
        if not isinstance(payload, dict):
            self.send_json(422, {"status": "needs_input", "error": "invalid_itinerary"})
            return
        if server.itinerary_service is None:
            self.send_json(503, {"status": "unavailable", "error": "itinerary_not_configured"})
            return
        try:
            server.itinerary_service.validate_request(payload)
        except ValueError as exc:
            self.send_json(422, {"status": "needs_input", "error": "invalid_itinerary", "detail": str(exc)})
            return
        if not server.itinerary_slots.acquire(blocking=False):
            self.send_json(429, {"status": "unavailable", "error": "itinerary_busy"})
            return
        try:
            # Global counters cannot be bypassed by changing forwarded IPs and
            # retain no user identities. Supplier project budgets remain needed.
            if not server.itinerary_minute_limiter.allow("all") or not server.itinerary_daily_limiter.allow("all"):
                self.send_json(429, {"status": "unavailable", "error": "itinerary_rate_limit"})
                return
            try:
                result = server.itinerary_service.generate(payload)
            except ValueError:
                self.send_json(422, {"status": "needs_input", "error": "invalid_itinerary"})
                return
            except Exception:
                # Supplier exceptions can contain headers, prompts or URLs.
                self.send_json(503, {"status": "unavailable", "error": "itinerary_unavailable"})
                return
            self.send_json(200, result)
        finally:
            server.itinerary_slots.release()


class FeedbackHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        store: FeedbackStore,
        public_origin: str,
        rate_limiter: MemoryRateLimiter | None = None,
        review_store: ReviewStore | None = None,
        itinerary_service: Any = None,
        itinerary_per_minute: int = 10,
        itinerary_per_day: int = 100,
        additional_origins: tuple[str, ...] = (),
        handler_class: Any = None,
        trusted_proxy_ips: tuple[str, ...] = (),
    ):
        self.store = store
        self.trusted_proxy_ips = frozenset(str(ipaddress.ip_address(value)) for value in trusted_proxy_ips)
        self._next_maintenance = time.monotonic() + 60
        self.public_origin = public_origin.rstrip("/")
        # Exact-match extra origins (local runner: localhost and 127.0.0.1 of the same port).
        self.additional_origins = frozenset(origin.rstrip("/") for origin in additional_origins)
        self.rate_limiter = rate_limiter or MemoryRateLimiter()
        self.review_store = review_store
        self.itinerary_service = itinerary_service
        self.itinerary_slots = threading.BoundedSemaphore(2)
        self.itinerary_minute_limiter = MemoryRateLimiter(itinerary_per_minute)
        self.itinerary_daily_limiter = MemoryRateLimiter(itinerary_per_day, 86400)
        super().__init__(server_address, handler_class or FeedbackRequestHandler)

    def origin_allowed(self, origin: str | None) -> bool:
        return bool(origin) and (origin == self.public_origin or origin in self.additional_origins)

    def client_rate_key(self, peer: str, forwarded: str) -> str:
        if peer in self.trusted_proxy_ips:
            try:
                return str(ipaddress.ip_address(forwarded.strip()))
            except ValueError:
                pass
        return peer

    def service_actions(self) -> None:
        # serve_forever calls this even when there are no incoming requests.
        if time.monotonic() < self._next_maintenance:
            return
        self._next_maintenance = time.monotonic() + 60
        try:
            self.store.prune()
        except sqlite3.Error:
            print("travel-feedback retention_cleanup_failed", flush=True)
        self.rate_limiter.prune()


def itinerary_enabled(environ: Any = None) -> bool:
    """`1` on, `0` off; unset/`auto` turns on when the selected LLM provider has a key (SPEC-107 D8, SPEC-108)."""
    environ = os.environ if environ is None else environ
    flag = str(settings.env("ITINERARY_ENABLED", environ)).strip().lower()
    if flag in ("1", "true", "on"):
        return True
    if flag in ("", "auto"):
        from llm_client import llm_key_configured
        return llm_key_configured(environ)
    return False


def load_restaurant_catalog() -> Any:
    """Optional sidecar; when missing the itinerary still works without restaurant candidates."""
    try:
        from restaurant_catalog import RestaurantCatalog
        path = Path(settings.env("ITINERARY_RESTAURANT_CATALOG_PATH"))
        return RestaurantCatalog(path)
    except Exception:
        print("travel-feedback restaurant_catalog_unavailable", flush=True)
        return None


def load_itinerary_service() -> Any:
    """Load public sidecars once. Feature-off/missing data never breaks feedback."""
    if not itinerary_enabled():
        return None
    try:
        from itinerary_service import ItineraryService, load_policy
        from llm_client import create_llm_client
        from route_provider import create_route_provider
        catalog_path = Path(settings.env("ITINERARY_CATALOG_PATH"))
        insights_path = Path(settings.env("ITINERARY_INSIGHTS_PATH"))
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        insights = json.loads(insights_path.read_text(encoding="utf-8")) if insights_path.is_file() else None
        if not isinstance(catalog, dict) or catalog.get("schemaVersion") != "itinerary-catalog-v1" or not isinstance(catalog.get("places"), list):
            raise ValueError("invalid_catalog")
        if insights is not None and (not isinstance(insights, dict) or insights.get("version") != catalog.get("reviewVersion")):
            raise ValueError("rebuild_catalog_after_review_analysis")
        policy = load_policy()
        router = create_route_provider(policy)  # default: estimate (no Kakao key needed)
        restaurants = load_restaurant_catalog()
        restaurant_model = settings.env("RESTAURANT_LLM_MODEL").strip() or None
        restaurant_tokens = settings.env("RESTAURANT_LLM_MAX_OUTPUT_TOKENS").strip() or None
        # LLM_PROVIDER=auto|gemini|openai selects the adapter; keys are read from the environment only.
        return ItineraryService(catalog, create_llm_client(), router, insights=insights, policy=policy, restaurants=restaurants,
                                restaurant_llm=create_llm_client(model=restaurant_model, max_output_tokens=restaurant_tokens))
    except (OSError, ValueError, ImportError, TypeError, KeyError):
        print("travel-feedback itinerary_configuration_unavailable", flush=True)
        return None


def main() -> None:
    port = int(settings.env("TRAVEL_FEEDBACK_PORT"))
    db_path = settings.env("TRAVEL_FEEDBACK_DB_PATH")
    public_origin = settings.env("TRAVEL_PUBLIC_ORIGIN")
    retention_days = int(settings.env("TRAVEL_FEEDBACK_RETENTION_DAYS"))
    review_db_path = settings.env("TRAVEL_REVIEW_DB_PATH")
    server = FeedbackHTTPServer(
        ("0.0.0.0", port),
        FeedbackStore(db_path, retention_days),
        public_origin,
        review_store=ReviewStore(review_db_path),
        itinerary_service=load_itinerary_service(),
        itinerary_per_minute=int(settings.env("ITINERARY_REQUESTS_PER_MINUTE")),
        itinerary_per_day=int(settings.env("ITINERARY_REQUESTS_PER_DAY")),
        trusted_proxy_ips=tuple(value.strip() for value in settings.env("TRAVEL_TRUSTED_PROXY_IPS").split(",") if value.strip()),
    )
    print(f"travel-feedback listening on :{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
