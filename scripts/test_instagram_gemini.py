"""SPEC-110 offline API contracts, provenance, failures and matching regression."""
import copy
import io
import json
import sys
import tempfile
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from test_instagram_import import FakeAcquirer, fake_download, fixture_catalog
from app import JobStore
from core import Pipeline, atomic_json, make_extractor
from extractor import extract_model_mentions
from gemini import GeminiError, GeminiExtractor, NoRedirect, rest_request, validate_places


def place(name="숲길공원", address="제주시 공원로 10", uncertain=False):
    return {"observed_name": name, "address_hint": address, "region_hint": "제주",
            "evidence_text": name + " " + (address or ""), "uncertain": uncertain, "bbox": [20, 100, 250, 60]}


def response(places):
    return {"status": "completed", "model": "gemini-3.8-flash",
            "steps": [{"type": "thought", "content": [{"type": "text", "text": "private thought"}]},
                      {"type": "model_output", "content": [{"type": "text", "text": json.dumps({"places": places})}]}],
            "usage": {"total_input_tokens": 100, "total_output_tokens": 30, "total_tokens": 130, "sensitive_extra": "secret"}}


class GeminiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="trip-ai-gemini-test-")
        self.root = Path(self.temp.name)
        self.catalog, _ = fixture_catalog(self.root)
        self.addCleanup(self.temp.cleanup)

    def pipeline(self, transport):
        return Pipeline(self.catalog, FakeAcquirer(), GeminiExtractor(api_key="fixture-secret", transport=transport), fake_download)

    def test_literal_names_labels_and_request_privacy(self):
        calls = []
        def transport(payload, key):
            calls.append(payload)
            self.assertEqual(key, "fixture-secret")
            return response([place()])
        result = self.pipeline(transport).run("https://www.instagram.com/p/fixture/", self.root / "result")
        self.assertEqual(len(calls), 2)
        self.assertFalse(calls[0]["store"])
        self.assertNotIn("tools", calls[0])
        self.assertNotIn("fixture-secret", json.dumps(calls))
        self.assertNotIn("atomic_labels", json.dumps(calls))
        self.assertEqual(result["counts"]["extracted"], 1)
        m = result["mentions"][0]
        self.assertEqual(len(m["evidence"]), 2)
        self.assertEqual(m["evidence"][0]["bbox_source"], "model_estimated")
        self.assertNotIn("ocr_confidence", m["evidence"][0])
        self.assertEqual(m["metadata"], self.catalog.metadata("tourapi:a"))
        self.assertEqual(m["labels"], self.catalog.labels("tourapi:a"))
        self.assertEqual(result["coverage"]["ocr"], "not_used")
        self.assertEqual(result["coverage"]["extraction_processed_image_count"], 2)
        p = result["provenance"]
        self.assertEqual(p["image_extractions"][0]["usage"]["total_tokens"], 130)
        self.assertNotIn("sensitive_extra", json.dumps(p))
        self.assertNotIn("fixture-secret", json.dumps(result))
        self.assertNotIn("private thought", json.dumps(result))

    def test_invalid_shape_literal_hints_and_boxes(self):
        invalid = []
        for key, value in [("uncertain", "false"), ("bbox", [0, 0, float("nan"), 4]),
                           ("bbox", [999, 0, 50, 50]), ("observed_name", "없는장소"),
                           ("address_hint", "제주시 허구로 777"), ("region_hint", "서울")]:
            p = place(); p[key] = value; invalid.append({"places": [p]})
        invalid.extend([{"places": [place()] * 31}, {"places": [], "extra": True}, {"places": "bad"}])
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(GeminiError):
                validate_places(value, "제주 여행")

    def test_empty_result_is_valid_not_api_failure(self):
        r = self.pipeline(lambda p, k: response([])).run("https://www.instagram.com/p/fixture/", self.root / "empty")
        self.assertEqual(r["coverage"]["extraction"], "complete")
        self.assertEqual(r["counts"]["extracted"], 0)
        self.assertNotEqual(r["status"], "partial")

    def test_quota_stops_remaining_calls_without_fallback(self):
        calls = []
        def transport(p, k):
            calls.append(p)
            raise GeminiError("gemini_quota_exceeded")
        r = self.pipeline(transport).run("https://www.instagram.com/p/fixture/", self.root / "quota")
        self.assertEqual(len(calls), 1)
        self.assertEqual(r["status"], "partial")
        self.assertEqual(r["coverage"]["extraction_processed_image_count"], 0)
        self.assertIn("gemini_quota_exceeded", [w["code"] for w in r["warnings"]])
        self.assertEqual(len(r["provenance"]["image_extractions"]), 2)

    def test_partial_results_survive_timeout(self):
        calls = []
        def transport(p, k):
            calls.append(p)
            if len(calls) == 2:
                raise GeminiError("gemini_timeout")
            return response([place()])
        r = self.pipeline(transport).run("https://www.instagram.com/p/fixture/", self.root / "partial")
        self.assertEqual(r["status"], "partial")
        self.assertEqual(r["counts"]["resolved"], 1)
        self.assertEqual(r["coverage"]["extraction_processed_image_count"], 1)

    def test_uncertain_exact_name_cannot_auto_resolve(self):
        r = self.pipeline(lambda p, k: response([place(uncertain=True)])).run("https://www.instagram.com/p/fixture/", self.root / "uncertain")
        self.assertEqual(r["mentions"][0]["resolution"], "needs_review")
        self.assertIsNone(r["mentions"][0]["metadata"])

    def test_conflicting_branch_addresses_remain_separate(self):
        rows = [{"index": 1, "status": "complete", "width": 800, "height": 1000,
                 "places": [place("動名", "제주시 중산간로 30"), place("動名", "서귀포시 중산간로 30")]}]
        m = extract_model_mentions(rows, self.catalog)
        self.assertEqual(len(m), 2)
        self.assertNotEqual(m[0]["mention_id"], m[1]["mention_id"])

    def test_api_errors_hide_body_and_reject_redirects(self):
        for status in [400, 401, 403, 404, 429, 503]:
            error = urllib.error.HTTPError("https://example.com", status, "fixture-secret", {}, io.BytesIO(b'fixture-secret'))
            with patch("gemini.urllib.request.build_opener") as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(GeminiError) as caught: rest_request({}, "fixture-secret")
                self.assertNotIn("fixture-secret", str(caught.exception))
                self.assertIsNone(caught.exception.__cause__)
        with self.assertRaises(GeminiError):
            NoRedirect().redirect_request(None, None, 302, None, None, "https://evil.example")

    def test_different_cities_without_addresses_do_not_merge(self):
        places = []
        for city in ["제주시", "서귀포시"]:
            p = place("동명카페", None); p["region_hint"] = city; places.append(p)
        rows = [{"index": 1, "status": "complete", "width": 800, "height": 1000, "places": places}]
        mentions = extract_model_mentions(rows, self.catalog)
        self.assertEqual(len(mentions), 2)
        self.assertNotEqual(mentions[0]["mention_id"], mentions[1]["mention_id"])
        self.assertEqual({m["metadata"]["canonical_id"] for m in mentions}, {"tourapi:c", "tourapi:d"})

    def test_invalid_output_retains_usage_and_empty_hints_become_null(self):
        def invalid(p, k):
            r = response([]); r["steps"][1]["content"][0]["text"] = "invalid json"
            return r
        r = self.pipeline(invalid).run("https://www.instagram.com/p/fixture/", self.root / "invalid")
        self.assertEqual(r["coverage"]["extraction"], "partial")
        self.assertEqual(r["provenance"]["image_extractions"][0]["usage"]["total_tokens"], 130)
        p = place(); p["address_hint"] = ""
        r = self.pipeline(lambda pld, k: response([p])).run("https://www.instagram.com/p/fixture/", self.root / "hints")
        self.assertIsNone(r["mentions"][0]["address_hint"])

    def test_model_selection_and_missing_key(self):
        with patch("core.setting", return_value="fixture-secret"):
            self.assertEqual(make_extractor().adapter, "gemini")
            self.assertEqual(make_extractor("easyocr").adapter, "easyocr")
        with patch("core.setting", return_value=""):
            self.assertEqual(make_extractor().adapter, "easyocr")
        with self.assertRaises(ValueError): GeminiExtractor(model="https://evil.example", api_key="test")
        assets = [{"index": 1, "status": "downloaded"}]
        self.assertEqual(GeminiExtractor(api_key="").extract(assets, self.root, "")[0]["error"], "gemini_key_missing")

    def test_atomic_json_retries_only_temporary_permission_failure(self):
        path = self.root / "atomic.json"
        atomic_json(path, {"old": True})
        original = Path.replace
        attempts = []
        def briefly_locked(source, target):
            attempts.append(1)
            if len(attempts) == 1: raise PermissionError("fixture locked")
            return original(source, target)
        with patch.object(Path, "replace", briefly_locked), patch("core.time.sleep"):
            atomic_json(path, {"new": True})
        self.assertEqual(len(attempts), 2)
        self.assertEqual(json.loads(path.read_text()), {"new": True})
        with patch.object(Path, "replace", side_effect=PermissionError("fixture locked")) as replace, patch("core.time.sleep"), self.assertRaises(PermissionError):
            atomic_json(path, {"failed": True})
        self.assertEqual(replace.call_count, 3)
        self.assertEqual(json.loads(path.read_text()), {"new": True})

    def test_gemini_raw_file_retention_and_export(self):
        store = JobStore(self.root / "jobs", self.pipeline(lambda p, k: response([place()])))
        self.addCleanup(store.close)
        # Run synchronously without sleeping for a worker.
        with patch.object(store.executor, "submit"):
            j = store.submit("https://www.instagram.com/p/fixture/")
        store._work(j["job_id"])
        path = store.directory / j["job_id"]
        self.assertTrue((path / "extraction.json").exists())
        store.jobs[j["job_id"]]["created_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        store.cleanup()
        self.assertFalse((path / "extraction.json").exists())
        self.assertIsNone(store.get(j["job_id"])["result"]["source"]["caption"])
        store.delete(j["job_id"])
        self.assertFalse(path.exists())

    def test_manual_retry_only_failed_photo_and_preserves_reviews(self):
        calls = []
        def transport(p, k):
            calls.append(1)
            if len(calls) == 2: raise GeminiError("gemini_timeout")
            return response([place()])
        pipeline = self.pipeline(transport)
        store = JobStore(self.root / "retry-jobs", pipeline)
        self.addCleanup(store.close)
        with patch.object(store.executor, "submit"):
            j = store.submit("https://www.instagram.com/p/fixture/")
        jid = j["job_id"]; store._work(jid)
        mention = store.get(jid)["result"]["mentions"][0]
        store.review_name(jid, mention["mention_id"], "숲길공원")
        store.resolve(jid, mention["mention_id"], "tourapi:a")
        with patch.object(store.executor, "submit"):
            self.assertEqual(store.retry_extraction(jid)["state"], "queued")
            with self.assertRaises(ValueError): store.retry_extraction(jid)
        store._work(jid, True)
        job = store.get(jid); r = job["result"]
        self.assertEqual(len(calls), 3)
        self.assertEqual(r["coverage"]["extraction_processed_image_count"], 2)
        self.assertFalse(job["can_retry_extraction"])
        self.assertEqual(r["mentions"][0]["identity_basis"], "user_selected")
        self.assertEqual(r["mentions"][0]["corrected_name"], "숲길공원")
        self.assertEqual(len(r["provenance"]["extraction_attempts"]), 2)
        self.assertEqual(len(r["provenance"]["extraction_attempts"][1]["images"]), 1)
        with self.assertRaises(ValueError): pipeline.can_retry(r)

    def test_retry_rejects_expired_raw_and_different_model(self):
        calls = []
        def transport(p, k):
            calls.append(1); raise GeminiError("gemini_quota_exceeded")
        pipeline = self.pipeline(transport)
        store = JobStore(self.root / "expired-retry", pipeline); self.addCleanup(store.close)
        with patch.object(store.executor, "submit"):
            j = store.submit("https://www.instagram.com/p/fixture/")
        store._work(j["job_id"])
        r = store.get(j["job_id"])["result"]
        r["provenance"]["model"] = "gemini-different-model"
        with self.assertRaises(ValueError): pipeline.can_retry(r)
        store.jobs[j["job_id"]]["created_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        with self.assertRaises(ValueError): store.retry_extraction(j["job_id"])
        self.assertEqual(len(calls), 1)


if __name__ == "__main__": unittest.main(verbosity=2)
