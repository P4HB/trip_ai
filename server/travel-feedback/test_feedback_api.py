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


class FeedbackApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.temp_dir.name) / "feedback.sqlite3")
        self.store = feedback_api.FeedbackStore(self.db_path, retention_days=90)
        self.server = feedback_api.FeedbackHTTPServer(
            ("127.0.0.1", 0),
            self.store,
            "https://example.test",
            feedback_api.MemoryRateLimiter(limit=20),
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

    def record_count(self) -> int:
        with sqlite3.connect(self.db_path) as connection:
            return connection.execute("SELECT COUNT(*) FROM feedback_submissions").fetchone()[0]

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


if __name__ == "__main__":
    unittest.main()
