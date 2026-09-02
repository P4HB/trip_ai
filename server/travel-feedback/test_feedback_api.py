from __future__ import annotations

import importlib.util
import http.client
import json
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("feedback_api.py")
SPEC = importlib.util.spec_from_file_location("travel_feedback_api", MODULE_PATH)
assert SPEC and SPEC.loader
feedback_api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(feedback_api)


def valid_payload(submission_id: str | None = None) -> dict:
    return {
        "schema_version": feedback_api.SCHEMA_VERSION,
        "submission_id": submission_id or str(uuid.uuid4()),
        "created_at": "2026-08-28T00:00:00.000Z",
        "storage": {
            "method": "server_api",
            "endpoint": feedback_api.API_PATH,
            "server_transmitted": True,
            "web_storage_used": False,
        },
        "source": {"ui_version": "map-ui-feedback-server-v2", "algorithm_version": "test"},
        "user_selections": {"request": {}},
        "recommendation_result": {"items": []},
        "feedback": {
            "required_place_count": 1,
            "completed_place_count": 1,
            "all_scores_completed": True,
            "entries": [{
                "place_id": "123",
                "title": "테스트 장소",
                "contexts": [{"kind": "recommendation", "rank": 1}],
                "score": 5,
                "score_label": "꼭 가고 싶어요",
                "comment": "좋아요",
            }],
        },
    }


def valid_v3_payload(session_id: str | None = None, revision: int = 1) -> dict:
    return {
        "schema_version": feedback_api.V3_SCHEMA_VERSION,
        "participant_name": "테스터01",
        "session_id": session_id or str(uuid.uuid4()),
        "revision": revision,
        "created_at": "2026-08-30T00:00:00.000Z",
        "updated_at": f"2026-08-30T00:00:0{min(revision, 9)}.000Z",
        "storage": {
            "method": "server_autosave",
            "endpoint": feedback_api.API_PATH,
            "server_transmitted": True,
            "web_storage_used": False,
        },
        "source": {"ui_version": "map-ui-feedback-autosave-v3", "algorithm_version": "test"},
        "user_selections": {"request": {}},
        "recommendation_result": {"items": []},
        "feedback": {
            "required_place_count": 2,
            "completed_place_count": 1,
            "all_scores_completed": False,
            "entries": [
                {
                    "place_id": "123",
                    "title": "첫 장소",
                    "contexts": [{"kind": "recommendation", "rank": 1}],
                    "score": 5,
                    "score_label": "꼭 가고 싶어요",
                    "comment": "",
                },
                {
                    "place_id": "456",
                    "title": "둘째 장소",
                    "contexts": [{"kind": "recommendation", "rank": 2}],
                    "score": None,
                    "score_label": None,
                    "comment": "",
                },
            ],
        },
    }


class FeedbackApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.temp_dir.name) / "feedback.sqlite3")
        self.review_db_path = str(Path(self.temp_dir.name) / "reviews.sqlite3")
        with sqlite3.connect(self.review_db_path) as connection:
            connection.executescript(
                """
                CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
                CREATE TABLE place_links (
                    contentid TEXT NOT NULL,
                    kakao_place_id TEXT NOT NULL,
                    kakao_place_name TEXT NOT NULL,
                    kakao_place_url TEXT NOT NULL,
                    PRIMARY KEY (contentid, kakao_place_id)
                ) WITHOUT ROWID;
                CREATE TABLE reviews (
                    review_id TEXT PRIMARY KEY,
                    review_hash TEXT NOT NULL UNIQUE,
                    kakao_place_id TEXT NOT NULL,
                    kakao_place_name TEXT NOT NULL,
                    kakao_place_url TEXT NOT NULL,
                    rating REAL,
                    review_date TEXT,
                    content TEXT,
                    tags_json TEXT NOT NULL,
                    likes INTEGER,
                    source_snapshot TEXT NOT NULL,
                    source_order INTEGER NOT NULL UNIQUE
                ) WITHOUT ROWID;
                INSERT INTO metadata VALUES ('schema_version', 'kakao-place-reviews-v1');
                INSERT INTO metadata VALUES ('collected_at', '2026-08-23T23:55:05+09:00');
                INSERT INTO metadata VALUES ('review_limit_per_place', '5');
                INSERT INTO place_links VALUES ('123', '900', '테스트 카카오 장소', 'https://place.map.kakao.com/900');
                INSERT INTO place_links VALUES ('456', '901', '리뷰 없는 장소', 'https://place.map.kakao.com/901');
                INSERT INTO reviews VALUES (
                    'review-1', 'hash-1', '900', '테스트 카카오 장소', 'https://place.map.kakao.com/900',
                    4.5, '2026.08.01.', '좋은 장소예요', '["뷰","시설"]', 3, '2026-08-19', 1
                );
                """
            )
        self.store = feedback_api.FeedbackStore(self.db_path, retention_days=90)
        self.server = feedback_api.FeedbackHTTPServer(
            ("127.0.0.1", 0),
            self.store,
            "https://example.test",
            feedback_api.MemoryRateLimiter(limit=20),
            feedback_api.ReviewStore(self.review_db_path),
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def post(self, payload: dict, origin: str = "https://example.test") -> tuple[int, dict]:
        request = urllib.request.Request(
            self.base_url + feedback_api.API_PATH,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": origin},
            method="POST",
        )
        try:
            response = urllib.request.urlopen(request, timeout=2)
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc)
        with response:
            return response.status, json.load(response)

    def get(self, path: str) -> tuple[int, dict, dict]:
        request = urllib.request.Request(self.base_url + path, method="GET")
        try:
            response = urllib.request.urlopen(request, timeout=2)
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc), dict(exc.headers)
        with response:
            return response.status, json.load(response), dict(response.headers)

    def record_count(self) -> int:
        with sqlite3.connect(self.db_path) as connection:
            return connection.execute("SELECT COUNT(*) FROM feedback_submissions").fetchone()[0]

    def session_count(self) -> int:
        with sqlite3.connect(self.db_path) as connection:
            return connection.execute("SELECT COUNT(*) FROM feedback_sessions").fetchone()[0]

    def test_create_and_idempotent_retry(self) -> None:
        payload = valid_payload()
        status, body = self.post(payload)
        self.assertEqual(status, 201)
        self.assertFalse(body["duplicate"])
        self.assertEqual(self.record_count(), 1)

        status, body = self.post(payload)
        self.assertEqual(status, 200)
        self.assertTrue(body["duplicate"])
        self.assertEqual(self.record_count(), 1)

    def test_rejects_invalid_score_without_storage(self) -> None:
        payload = valid_payload()
        payload["feedback"]["entries"][0]["score"] = 6
        status, body = self.post(payload)
        self.assertEqual(status, 422)
        self.assertEqual(body["error"], "invalid_feedback")
        self.assertEqual(self.record_count(), 0)

    def test_rejects_long_comment_without_storage(self) -> None:
        payload = valid_payload()
        payload["feedback"]["entries"][0]["comment"] = "x" * 301
        status, body = self.post(payload)
        self.assertEqual(status, 422)
        self.assertEqual(body["error"], "invalid_feedback")
        self.assertEqual(self.record_count(), 0)

    def test_rejects_oversized_body_without_storage(self) -> None:
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        connection.putrequest("POST", feedback_api.API_PATH)
        connection.putheader("Content-Type", "application/json")
        connection.putheader("Origin", "https://example.test")
        connection.putheader("Content-Length", str(feedback_api.MAX_BODY_BYTES + 1))
        connection.endheaders()
        response = connection.getresponse()
        body = json.load(response)
        self.assertEqual(response.status, 413)
        self.assertEqual(body["error"], "payload_too_large")
        self.assertEqual(self.record_count(), 0)
        connection.close()

    def test_rejects_same_id_with_different_payload(self) -> None:
        payload = valid_payload()
        self.assertEqual(self.post(payload)[0], 201)
        payload["feedback"]["entries"][0]["comment"] = "다른 내용"
        status, body = self.post(payload)
        self.assertEqual(status, 409)
        self.assertEqual(body["error"], "submission_id_conflict")
        self.assertEqual(self.record_count(), 1)

    def test_rejects_wrong_origin(self) -> None:
        status, body = self.post(valid_payload(), origin="https://evil.example")
        self.assertEqual(status, 403)
        self.assertEqual(body["error"], "origin_not_allowed")
        self.assertEqual(self.record_count(), 0)

    def test_prunes_expired_records(self) -> None:
        old = datetime.now(timezone.utc) - timedelta(days=91)
        self.store.save(valid_payload(), now=old)
        self.assertEqual(self.record_count(), 1)
        self.store.save(valid_payload(), now=datetime.now(timezone.utc))
        self.assertEqual(self.record_count(), 1)

    def test_v3_creates_and_updates_one_session(self) -> None:
        payload = valid_v3_payload()
        status, body = self.post(payload)
        self.assertEqual(status, 201)
        self.assertTrue(body["created"])
        self.assertEqual(body["revision"], 1)
        self.assertEqual(self.session_count(), 1)

        updated = valid_v3_payload(payload["session_id"], revision=2)
        updated["feedback"]["entries"][1]["score"] = 4
        updated["feedback"]["entries"][1]["score_label"] = "마음에 들어요"
        updated["feedback"]["completed_place_count"] = 2
        updated["feedback"]["all_scores_completed"] = True
        status, body = self.post(updated)
        self.assertEqual(status, 200)
        self.assertFalse(body["created"])
        self.assertFalse(body["stale"])
        self.assertEqual(body["revision"], 2)
        self.assertEqual(self.session_count(), 1)
        with sqlite3.connect(self.db_path) as connection:
            stored_payload = json.loads(connection.execute(
                "SELECT payload_json FROM feedback_sessions WHERE session_id = ?", (payload["session_id"],)
            ).fetchone()[0])
        self.assertEqual(stored_payload["participant_name"], "테스터01")

    def test_v3_accepts_legacy_payload_without_participant_name(self) -> None:
        payload = valid_v3_payload()
        payload.pop("participant_name")
        status, _ = self.post(payload)
        self.assertEqual(status, 201)
        self.assertEqual(self.session_count(), 1)

    def test_v3_accepts_null_participant_name(self) -> None:
        payload = valid_v3_payload()
        payload["participant_name"] = None
        status, _ = self.post(payload)
        self.assertEqual(status, 201)
        self.assertEqual(self.session_count(), 1)

    def test_v3_rejects_invalid_participant_name(self) -> None:
        for invalid_name in ("", " 테스터", "테스터 ", "x" * 31, "테스터\n01"):
            with self.subTest(participant_name=repr(invalid_name)):
                payload = valid_v3_payload()
                payload["participant_name"] = invalid_name
                status, body = self.post(payload)
                self.assertEqual(status, 422)
                self.assertEqual(body["error"], "invalid_feedback")
                self.assertEqual(self.session_count(), 0)

    def test_v3_stale_revision_cannot_overwrite_latest(self) -> None:
        first = valid_v3_payload()
        latest = valid_v3_payload(first["session_id"], revision=2)
        self.assertEqual(self.post(first)[0], 201)
        self.assertEqual(self.post(latest)[0], 200)
        status, body = self.post(first)
        self.assertEqual(status, 200)
        self.assertTrue(body["stale"])
        self.assertEqual(body["revision"], 2)
        with sqlite3.connect(self.db_path) as connection:
            stored_revision = connection.execute(
                "SELECT revision FROM feedback_sessions WHERE session_id = ?", (first["session_id"],)
            ).fetchone()[0]
        self.assertEqual(stored_revision, 2)

    def test_v3_same_revision_different_payload_conflicts(self) -> None:
        payload = valid_v3_payload()
        self.assertEqual(self.post(payload)[0], 201)
        payload["feedback"]["entries"][0]["comment"] = "changed"
        status, body = self.post(payload)
        self.assertEqual(status, 409)
        self.assertEqual(body["error"], "feedback_revision_conflict")
        self.assertEqual(self.session_count(), 1)

    def test_v3_rejects_incorrect_partial_completion(self) -> None:
        payload = valid_v3_payload()
        payload["feedback"]["completed_place_count"] = 2
        status, body = self.post(payload)
        self.assertEqual(status, 422)
        self.assertEqual(body["error"], "invalid_feedback")
        self.assertEqual(self.session_count(), 0)

    def test_v3_prunes_expired_sessions(self) -> None:
        old = datetime.now(timezone.utc) - timedelta(days=91)
        self.store.save_session(valid_v3_payload(), now=old)
        self.assertEqual(self.session_count(), 1)
        self.store.save_session(valid_v3_payload(), now=datetime.now(timezone.utc))
        self.assertEqual(self.session_count(), 1)

    def test_review_api_returns_public_review_without_author(self) -> None:
        status, body, headers = self.get("/travel/api/places/123/reviews?limit=5&offset=0")
        self.assertEqual(status, 200)
        self.assertEqual(body["schema_version"], feedback_api.REVIEW_SCHEMA_VERSION)
        self.assertEqual(body["place_id"], "123")
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["reviews"][0]["content"], "좋은 장소예요")
        self.assertEqual(body["reviews"][0]["tags"], ["뷰", "시설"])
        self.assertNotIn("reviewer", json.dumps(body, ensure_ascii=False))
        self.assertEqual(headers["Cache-Control"], "public, max-age=3600")

    def test_review_api_returns_empty_for_linked_place_without_reviews(self) -> None:
        status, body, _ = self.get("/travel/api/places/456/reviews")
        self.assertEqual(status, 200)
        self.assertEqual(body["total"], 0)
        self.assertEqual(body["reviews"], [])
        self.assertEqual(len(body["kakao_places"]), 1)

    def test_review_api_returns_empty_for_unmatched_place(self) -> None:
        status, body, _ = self.get("/travel/api/places/789/reviews")
        self.assertEqual(status, 200)
        self.assertEqual(body["total"], 0)
        self.assertEqual(body["kakao_places"], [])

    def test_review_api_rejects_invalid_id_and_pagination(self) -> None:
        self.assertEqual(self.get("/travel/api/places/not-a-number/reviews")[0], 400)
        for path in (
            "/travel/api/places/123/reviews?limit=0",
            "/travel/api/places/123/reviews?limit=21",
            "/travel/api/places/123/reviews?offset=-1",
            "/travel/api/places/123/reviews?limit=5%20OR%201=1",
            "/travel/api/places/123/reviews?unknown=1",
        ):
            self.assertEqual(self.get(path)[0], 400, path)


if __name__ == "__main__":
    unittest.main()
