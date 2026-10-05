"""Independent fixtures for SPEC-102; no Instagram requests or model downloads."""
import copy
import contextlib
import io
import json
import os
import shutil
import socket
import stat
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/instagram-import"))
from core import Pipeline, MAX_BYTES, download_image, normalize_url, validate_media_url
from PIL import Image
from app import JobStore, ThreadingHTTPServer, handler_class
from app import main as cli_main
from catalog import Catalog
from extractor import clean_name, extract_mentions, resolve_mention


def fixture_catalog(root):
    contract = json.loads((ROOT / "config/kakao_place_label_contract.v1.json").read_text(encoding="utf-8"))
    (root / "config").mkdir()
    (root / "config/kakao_place_label_contract.v1.json").write_text(json.dumps(contract), encoding="utf-8")
    preference = [{"label": k, "value": 0.75, "status": "ai_draft", "source_ids": ["source-one"]}
                  for k in [*contract["atomic_labels"], *contract["derived_labels"]]]
    fit = {"companion": [{"key": k, "state": "numeric", "value": 0.5} for k in contract["companion_keys"]],
           "month": [{"key": k, "state": "not_applicable", "value": None} for k in contract["month_keys"]]}
    places = [{"id": "a", "title": "숲길공원", "address": "제주특별자치도 제주시 공원로 10", "lng": 126.5, "lat": 33.5,
               "v5": {"labels": preference, "sources": [{"id": "source-one", "url": "https://example.com/park", "checked_at": "2026-08-01"}]}, "fit": fit},
              {"id": "b", "title": "제주라면집", "address": "제주특별자치도 서귀포시 성산읍 해안로 20", "lng": 126.7, "lat": 33.3, "v5": None, "fit": None},
              {"id": "c", "title": "동명카페", "address": "제주특별자치도 제주시 중산간로 30", "lng": 126.6, "lat": 33.4},
              {"id": "d", "title": "동명카페", "address": "제주특별자치도 서귀포시 중산간로 30", "lng": 126.6, "lat": 33.2}]
    bundle = root / "map-ui/data/jeju-places.js"
    bundle.parent.mkdir(parents=True)
    meta = {"sourceDate": "2026-08-01", "preferenceLabelVersion": "fixture-v5", "fitLabelVersion": "fixture-fit"}
    bundle.write_text("window.JEJU_DATA_META = " + json.dumps(meta) + ";\nwindow.JEJU_PLACES = " + json.dumps(places) + ";\n", encoding="utf-8")
    return Catalog(root, include_kakao=False), places


class FakeAcquirer:
    def acquire(self, url):
        return {"canonical_url": url, "shortcode": "fixture", "caption": "제주 여행", "post_type": "GraphSidecar",
                "reported_media_count": 3, "nodes": [{"index": 1, "is_video": True, "url": None},
                {"index": 2, "is_video": False, "url": "https://cdn.example/image-two"},
                {"index": 3, "is_video": False, "url": "https://cdn.example/image-three"}]}


def fake_download(url, destination):
    Image.new("RGB", (800, 1000), "white").save(destination)
    return {"status": "downloaded", "source_byte_size": 50, "width": 800, "height": 1000,
            "byte_size": destination.stat().st_size, "sha256": "fixture"}


class FakeOCR:
    adapter = "fixture"
    available = True

    def recognize(self, assets, directory, progress=None):
        return [{"index": a["index"], "status": "complete", "width": 800, "height": 1000,
                 "lines": [{"text": "#숲길공원", "bbox": [20, 100, 250, 60], "confidence": 0.99},
                           {"text": "@제주시 공원로 10", "bbox": [20, 170, 250, 20], "confidence": 0.99}]}
                for a in assets if a["status"] == "downloaded"]


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="trip-ai-test-")
        self.root = Path(self.tmp.name)
        self.catalog, self.original = fixture_catalog(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_url_normalization_and_rejection(self):
        canonical, shortcode = normalize_url("https://www.instagram.com/p/DEhnuo1KmAd/?stkn=tracking#fragment")
        self.assertEqual(canonical, "https://www.instagram.com/p/DEhnuo1KmAd/")
        self.assertEqual(shortcode, "DEhnuo1KmAd")
        for url in ["http://www.instagram.com/p/abcdef/", "https://instagram.com.evil/p/abcdef/", "https://user@instagram.com/p/abcdef/",
                    "https://127.0.0.1/p/abcdef/", "https://instagram.com:444/p/abcdef/", "https://instagram.com/p/../../x", "https://instagram.com/p/abc%2Fdef/", None]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                normalize_url(url)

    def test_numeric_names_and_observed_evidence_are_preserved(self):
        self.assertEqual(clean_name("1100고지습지"), "1100고지습지")
        self.assertEqual(clean_name("9.81 파크"), "9.81 파크")
        self.assertEqual(clean_name("2. 숲길공원"), "숲길공원")

    def test_identity_requires_location_and_rejects_conflicts(self):
        mention = {"observed_name": "숲길공원", "region_hint": None, "address_hint": None}
        resolve_mention(mention, self.catalog)
        self.assertEqual(mention["resolution"], "needs_review")
        mention["region_hint"] = "서귀포시"
        resolve_mention(mention, self.catalog)
        self.assertIsNone(mention["metadata"])
        mention["region_hint"] = "제주"
        mention["address_hint"] = "공원로 99"
        resolve_mention(mention, self.catalog)
        self.assertIsNone(mention["metadata"])
        mention["address_hint"] = "공원로 10"
        resolve_mention(mention, self.catalog)
        self.assertEqual(mention["resolution"], "resolved")
        self.assertEqual(mention["metadata"]["coordinates"], [126.5, 33.5])
        self.assertEqual(mention["metadata"]["city"]["name"], "제주시")
        duplicate = {"observed_name": "동명카페", "region_hint": "제주", "address_hint": None}
        resolve_mention(duplicate, self.catalog)
        self.assertEqual(duplicate["resolution"], "needs_review")
        with self.assertRaises(ValueError):
            resolve_mention(duplicate, self.catalog, "tourapi:a")
        resolve_mention(duplicate, self.catalog, "tourapi:d")
        self.assertEqual(duplicate["identity_basis"], "user_selected")
        ids = []
        for index in range(6):
            cid = f"tourapi:duplicate-{index}"
            record = copy.deepcopy(self.catalog.places["tourapi:a"])
            record.update(canonical_id=cid, provider_id=str(index), name="같은이름카페",
                          address=f"제주특별자치도 {'제주시' if index in [0, 5] else '서귀포시'} 공원로 {index}")
            self.catalog.places[cid] = record
            ids.append(cid)
        self.catalog.aliases["같은이름카페"] = ids
        hidden_branch = {"observed_name": "같은이름카페", "region_hint": "제주시", "address_hint": None}
        resolve_mention(hidden_branch, self.catalog)
        self.assertEqual(len(hidden_branch["candidates"]), 5)
        self.assertEqual(hidden_branch["resolution"], "needs_review")

    def test_exact_label_values_na_provenance_and_source_unchanged(self):
        raw = copy.deepcopy(self.catalog.places["tourapi:a"]["raw"])
        labels = self.catalog.labels("tourapi:a")
        self.assertEqual(labels["count"], 41)
        self.assertEqual(labels["status"], "linked")
        self.assertEqual(labels["axes"]["theme.mountain"]["value"], 0.75)
        self.assertEqual(labels["axes"]["month.1"]["state"], "not_applicable")
        self.assertIsNone(labels["axes"]["month.1"]["value"])
        self.assertEqual(labels["versions"]["preference"], "fixture-v5")
        labels["axes"]["theme.mountain"]["value"] = 0
        self.assertEqual(self.catalog.places["tourapi:a"]["raw"], raw)
        self.assertEqual(self.catalog.labels("tourapi:b")["status"], "labels_missing")

    def test_all_photos_video_skipping_and_mention_deduplication(self):
        pipeline = Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download)
        result = pipeline.run("https://instagram.com/p/abcdef/", self.root / "run")
        self.assertEqual(result["coverage"]["downloaded_image_count"], 2)
        self.assertEqual(result["coverage"]["expected_image_count"], 2)
        self.assertEqual(result["coverage"]["video_count"], 1)
        self.assertEqual(result["coverage"]["video"], "not_processed")
        self.assertEqual(result["counts"]["extracted"], 1)
        self.assertEqual(len(result["mentions"][0]["evidence"]), 2)
        self.assertEqual(result["counts"]["labels_linked"], 1)
        self.assertNotIn("cdn.example", json.dumps(result))

    def test_cli_writes_the_same_result_contract(self):
        pipeline = Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download)
        output = self.root / "cli-output"
        args = ["app.py", "import", "https://instagram.com/p/abcdef/", "--output", str(output)]
        with patch("sys.argv", args), patch("app.Catalog", return_value=self.catalog), patch("app.Pipeline", return_value=pipeline), contextlib.redirect_stdout(io.StringIO()):
            cli_main()
        result = json.loads((output / "result.json").read_text(encoding="utf-8"))
        self.assertEqual(result["schema_version"], "instagram-place-import-v1")
        self.assertEqual(result["coverage"]["downloaded_image_count"], 2)
        self.assertEqual(result["mentions"][0]["labels"]["count"], 41)

    def test_partial_download_and_enumeration_mismatch_never_complete(self):
        def fail_second(url, destination):
            if "three" in url:
                raise OSError("sensitive_signed_url")
            return fake_download(url, destination)
        result = Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fail_second).run("https://instagram.com/p/abcdef/", self.root / "run")
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["coverage"]["images"], "partial")
        self.assertNotIn("sensitive_signed_url", json.dumps(result))
        class Mismatch(FakeAcquirer):
            def acquire(self, url):
                post = super().acquire(url); post["reported_media_count"] = 4; return post
        result = Pipeline(self.catalog, Mismatch(), FakeOCR(), fake_download).run("https://instagram.com/p/abcdef/", self.root / "mismatch")
        self.assertEqual(result["coverage"]["enumeration"], "partial")

    def test_caption_claim_count_is_not_extracted_count(self):
        self.assertEqual(extract_mentions("제주 맛집 18곳 총정리", [], self.catalog), [])

    def test_collage_title_fragments_and_body_mentions(self):
        # Independent two-panel geometry: a detached hashtag and overlapping title pieces.
        row = {"index": 1, "status": "complete", "width": 1000, "height": 1000, "lines": [
            {"text": "#", "bbox": [520, 106, 30, 42]},
            {"text": "오른쪽해물", "bbox": [548, 100, 170, 60]},
            {"text": "라면집", "bbox": [715, 101, 100, 59]},
            {"text": "#왼쪽라면", "bbox": [20, 100, 170, 60]},
            {"text": "@제주시 왼쪽로", "bbox": [20, 175, 220, 20]},
            {"text": "10", "bbox": [240, 175, 30, 20]},
            {"text": "@서귀포시 오른쪽로 99", "bbox": [520, 175, 300, 20]},
            {"text": "숲길공원", "bbox": [20, 240, 120, 20]},
            {"text": "제주도", "bbox": [20, 20, 120, 65]},
        ]}
        self.catalog.aliases["제주도"] = ["tourapi:a"]
        mentions = extract_mentions("#제주도", [row], self.catalog)
        by_name = {m["observed_name"]: m for m in mentions}
        self.assertEqual(set(by_name), {"왼쪽라면", "오른쪽해물 라면집"})
        self.assertEqual(by_name["왼쪽라면"]["address_hint"], "제주시 왼쪽로 10")
        self.assertEqual(by_name["오른쪽해물 라면집"]["address_hint"], "서귀포시 오른쪽로 99")
        self.assertEqual(by_name["오른쪽해물 라면집"]["region_hint"], "서귀포시")

    def test_media_url_ssrf_and_payload_decode_limits(self):
        with self.assertRaises(ValueError):
            validate_media_url("https://example.com/image.jpg")
        private = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]
        with patch("core.socket.getaddrinfo", return_value=private), self.assertRaises(ValueError):
            validate_media_url("https://scontent.cdninstagram.com/image")
        class Response(io.BytesIO):
            headers = {}
        class Opener:
            def open(self, *args, **kwargs):
                return Response(b"not_an_image")
        with patch("core.validate_media_url"), patch("core.urllib.request.build_opener", return_value=Opener()), self.assertRaises(Exception):
            download_image("https://scontent.cdninstagram.com/file.heic", self.root / "invalid.jpg")
        self.assertFalse((self.root / "invalid.jpg").exists())
        class LargeOpener:
            def open(self, *args, **kwargs):
                response = Response(b"x"); response.headers = {"Content-Length": str(MAX_BYTES + 1)}; return response
        with patch("core.validate_media_url"), patch("core.urllib.request.build_opener", return_value=LargeOpener()), self.assertRaises(ValueError):
            download_image("https://scontent.cdninstagram.com/file", self.root / "too-large.jpg")

    def test_job_retention_delete_and_restart_interruption(self):
        pipeline = Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download)
        store = JobStore(self.root / "jobs", pipeline)
        try:
            job = store.submit("https://instagram.com/p/abcdef/"); jid = job["job_id"]
            for _ in range(100):
                job = store.get(jid)
                if job["state"] == "finished": break
                time.sleep(0.01)
            self.assertEqual(job["state"], "finished")
            self.assertTrue(store.asset(jid, 2))
            created = datetime.fromisoformat(job["created_at"])
            store.cleanup(created + timedelta(days=2))
            self.assertTrue(store.get(jid)["raw_expired"])
            self.assertIsNone(store.get(jid)["result"]["source"]["caption"])
            with self.assertRaises(KeyError): store.asset(jid, 2)
            store.cleanup(created + timedelta(days=8))
            with self.assertRaises(KeyError): store.get(jid)
            self.assertFalse((self.root / "jobs" / jid).exists())
        finally:
            store.close()

    def test_restart_marks_queued_job_interrupted(self):
        directory = self.root / "restart" / ("a" * 32)
        directory.mkdir(parents=True)
        (directory / "job.json").write_text(json.dumps({"job_id": "a" * 32, "state": "queued", "stage": "queued", "created_at": datetime.now(timezone.utc).isoformat(), "result": None}), encoding="utf-8")
        store = JobStore(self.root / "restart", Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download))
        try:
            self.assertEqual(store.get("a" * 32)["state"], "interrupted")
        finally:
            store.close()

    def test_cancelled_work_does_not_resurrect_deleted_result(self):
        entered = threading.Event(); release = threading.Event()
        class Slow(FakeAcquirer):
            def acquire(self, url):
                entered.set(); release.wait(3); return super().acquire(url)
        store = JobStore(self.root / "cancel", Pipeline(self.catalog, Slow(), FakeOCR(), fake_download))
        jid = store.submit("https://instagram.com/p/abcdef/")["job_id"]
        try:
            self.assertTrue(entered.wait(2))
            store.delete(jid); release.set()
        finally:
            release.set(); store.close()
        self.assertFalse((self.root / "cancel" / jid).exists())
        with self.assertRaises(KeyError): store.get(jid)

    def test_windows_readonly_job_directory_deletion(self):
        store = JobStore(self.root / "readonly", Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download))
        jid = store.submit("https://instagram.com/p/abcdef/")["job_id"]
        try:
            store.close()
            directory = store.directory / jid
            if os.name == "nt":
                directory.chmod(stat.S_IREAD)
                (directory / "job.json").chmod(stat.S_IREAD)
            store.delete(jid)
            self.assertFalse(directory.exists())
        finally:
            store.close()

    def test_failed_deletion_is_retryable_and_worker_stays_cancelled(self):
        entered = threading.Event(); release = threading.Event()
        class Slow(FakeAcquirer):
            def acquire(self, url):
                entered.set(); release.wait(3); return super().acquire(url)
        store = JobStore(self.root / "locked", Pipeline(self.catalog, Slow(), FakeOCR(), fake_download))
        jid = store.submit("https://instagram.com/p/abcdef/")["job_id"]
        directory = store.directory / jid
        original_rmtree = shutil.rmtree
        def locked_only(path, *args, **kwargs):
            if Path(path) == directory:
                raise PermissionError("locked fixture")
            return original_rmtree(path, *args, **kwargs)
        try:
            self.assertTrue(entered.wait(2))
            with patch("app.shutil.rmtree", side_effect=locked_only):
                with self.assertRaisesRegex(RuntimeError, "delete_failed"):
                    store.delete(jid)
                release.set(); store.close()
                self.assertEqual(store.get(jid)["state"], "delete_failed")
                self.assertIsNone(store.get(jid)["result"])
                created = datetime.fromisoformat(store.get(jid)["created_at"])
                store.cleanup(created + timedelta(days=8))
            store.delete(jid)
            self.assertFalse(directory.exists())
        finally:
            release.set(); store.close()

    def test_http_lifecycle_origin_files_and_candidate_choice(self):
        store = JobStore(self.root / "http-jobs", Pipeline(self.catalog, FakeAcquirer(), FakeOCR(), fake_download))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_class(store))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}"
        def request(path, body=None, method=None, headers=None):
            data = json.dumps(body).encode() if body is not None else None
            req = urllib.request.Request(base + path, data=data, method=method, headers=headers or ({"Content-Type": "application/json"} if data else {}))
            return urllib.request.urlopen(req, timeout=5)
        try:
            self.assertEqual(request("/").status, 200)
            with self.assertRaises(urllib.error.HTTPError) as error:
                request("/api/imports", {"url": "https://instagram.com/p/abcdef/"}, headers={"Content-Type":"application/json", "Origin":"https://evil.example"})
            self.assertEqual(error.exception.code, 403)
            jid = json.load(request("/api/imports", {"url":"https://instagram.com/p/abcdef/"}))["job_id"]
            for _ in range(100):
                job = json.load(request(f"/api/imports/{jid}"))
                if job["state"] == "finished": break
                time.sleep(0.01)
            self.assertEqual(job["state"], "finished")
            mention = job["result"]["mentions"][0]
            revised = json.load(request(f"/api/imports/{jid}/review-name", {"mention_id":mention["mention_id"], "name":"제주라면집"}))
            self.assertEqual(revised["result"]["mentions"][0]["observed_name"], "숲길공원")
            self.assertEqual(revised["result"]["mentions"][0]["corrected_name"], "제주라면집")
            self.assertNotIn("identity_basis", revised["result"]["mentions"][0])
            revised = json.load(request(f"/api/imports/{jid}/review-name", {"mention_id":mention["mention_id"], "name":"숲길공원"}))
            updated = json.load(request(f"/api/imports/{jid}/resolve", {"mention_id":mention["mention_id"], "candidate_id":"tourapi:a"}))
            self.assertEqual(updated["result"]["mentions"][0]["identity_basis"], "user_selected")
            self.assertEqual(request(f"/api/imports/{jid}/assets/2").headers["Content-Type"], "image/jpeg")
            self.assertEqual(json.load(request(f"/api/imports/{jid}/export"))["schema_version"], "instagram-place-import-v1")
            with patch("app.shutil.rmtree", side_effect=PermissionError("locked fixture")):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request(f"/api/imports/{jid}", method="DELETE")
                self.assertEqual(error.exception.code, 500)
                self.assertEqual(json.load(error.exception)["error"], "delete_failed")
                self.assertEqual(json.load(request(f"/api/imports/{jid}"))["state"], "delete_failed")
            self.assertTrue(json.load(request(f"/api/imports/{jid}", method="DELETE"))["deleted"])
            with self.assertRaises(urllib.error.HTTPError): request(f"/api/imports/{jid}")
            with self.assertRaises(urllib.error.HTTPError): request("/../../.env")
        finally:
            server.shutdown(); server.server_close(); store.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
