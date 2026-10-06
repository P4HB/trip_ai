"""Exact-ID, missing/blocked, resume and coordinate-catalog regression tests."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import shutil
from tempfile import TemporaryDirectory
import unittest

import build_restaurant_catalog as canonical
import collect_restaurant_coordinates as coordinates
import build_restaurant_coordinate_catalog as coordinate_catalog
import build_restaurant_query_db as query
from test_restaurant_catalog import fixture
from validate_restaurant_coordinates import read_bundle


def body(place_id, point=None, **extra):
    summary = {"confirm_id": place_id, "name": "식당", "address": {"road": "제주특별자치도 제주시 테스트로"},
               "point": {"lon": 126.5, "lat": 33.4} if point is None else point, "status": "Y"}
    summary.update(extra)
    return json.dumps({"summary": summary}, ensure_ascii=False).encode("utf-8")


def successful_fetch(record):
    return coordinates.parse_response(record, body(record["place_id"]), 200)


class CoordinateTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.canonical_dir = self.root / "canonical"
        self.canonical_dir.mkdir()
        path = self.canonical_dir / "places.jsonl"
        path.write_text("".join(canonical.packed({"canonical_id": f"kakao:{i}", "place_id": str(i), "source_order": i - 1}) + "\n"
                                for i in range(1, 5)), encoding="utf-8")
        (self.canonical_dir / "manifest.json").write_text(json.dumps({"contract": canonical.VERSION, "counts": {"places": 4},
            "files": {"places.jsonl": {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size}}}), encoding="utf-8")
        self.output = self.root / "coordinates"
        self.record = coordinates.pending_record({"canonical_id": "kakao:1", "place_id": "1", "source_order": 0})

    def collect(self, **kwargs):
        return coordinates.collect(self.output, canonical_dir=self.canonical_dir, interval=0.1, fetcher=kwargs.pop("fetcher", successful_fetch), **kwargs)

    def test_exact_id_and_longitude_latitude(self):
        result = successful_fetch(self.record)
        self.assertEqual((result["status"], result["longitude"], result["latitude"]), ("available", 126.5, 33.4))
        self.assertEqual(result["source_url"], coordinates.endpoint("1"))
        self.assertTrue(result["checked_at"].endswith("+09:00"))
        self.assertEqual(len(result["response_sha256"]), 64)
        self.assertEqual(coordinates.parse_response(self.record, body("2"), 200)["status"], "identity_mismatch")

    def test_unusable_coordinates_never_become_a_location(self):
        samples = [({"lon": 33.4, "lat": 126.5}, "invalid_coordinates"),
                   ({"lon": True, "lat": 33.4}, "invalid_coordinates"),
                   ({"lon": "126.5", "lat": 33.4}, "invalid_coordinates"),
                   ({"lon": 127.0, "lat": 37.5}, "outside_jeju"),
                   ({"lon": None, "lat": 33.4}, "missing")]
        for point, status in samples:
            with self.subTest(point=point):
                result = coordinates.parse_response(self.record, body("1", point), 200)
                self.assertEqual(result["status"], status)
                self.assertIsNone(result["longitude"])
                self.assertIsNone(result["latitude"])
        for payload in (b"<html>blocked</html>", b"{}", b'{"summary":{"point":{"lon":NaN}}}'):
            self.assertEqual(coordinates.parse_response(self.record, payload, 200)["status"], "error")
        result = coordinates.parse_response(self.record, body("1", address={"road": "서울"}), 200)
        self.assertEqual(result["status"], "outside_jeju")

    def test_unavailable_and_access_restriction(self):
        for code in (404, 410):
            self.assertEqual(coordinates.parse_response(self.record, b"", code)["status"], "unavailable")
        result = self.collect(workers=1, fetcher=lambda r: coordinates.parse_response(r, b"", 429))
        self.assertEqual(result["attempted_count"], 1)
        self.assertEqual(result["counts"]["pending"], 3)
        self.assertIn("HTTP 429", result["stop_reason"])

    def test_resume_keeps_success_and_exactly_one_target_row(self):
        first = self.collect(workers=1, limit=2)
        self.assertEqual(first["counts"]["available"], 2)
        before = (self.output / "coordinates.jsonl").read_text(encoding="utf-8").splitlines()[:2]
        final = self.collect(workers=2)
        self.assertEqual(final["counts"]["available"], 4)
        self.assertEqual(final["attempted_count"], 4)
        rows = (self.output / "coordinates.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual(before, rows[:2])
        self.assertTrue(all(json.loads(row)["attempts"] == 1 for row in rows))
        self.assertEqual(self.collect(), final)

    def test_retry_errors_is_explicit_and_does_not_repeat_success(self):
        def fetcher(record):
            return coordinates.parse_response(record, b"", 500) if record["place_id"] == "2" else successful_fetch(record)
        first = self.collect(workers=1, fetcher=fetcher)
        self.assertEqual(first["counts"]["error"], 1)
        self.assertEqual(self.collect()["counts"]["error"], 1)
        self.assertEqual(self.collect(retry_errors=True)["counts"]["available"], 4)
        rows = [json.loads(line) for line in (self.output / "coordinates.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual([r["attempts"] for r in rows], [1, 2, 1, 1])

    def test_input_mismatch_and_concurrent_lock_are_rejected(self):
        self.collect(limit=1)
        lock = self.output / ".collector.lock"
        lock.write_text("another process", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "lock exists"):
            self.collect()
        lock.unlink()
        path = self.canonical_dir / "manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["changed"] = True
        path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "another input snapshot"):
            self.collect()

    def test_stop_file_prevents_requests_and_jsonl_matches_checkpoint(self):
        self.output.mkdir()
        (self.output / "STOP").touch()
        stopped = self.collect(fetcher=lambda r: self.fail("STOP must prevent requests"))
        self.assertEqual(stopped["attempted_count"], 0)
        (self.output / "STOP").unlink()
        self.collect()
        manifest, records = read_bundle(self.output, self.canonical_dir)
        with closing(canonical.read_only(self.output / "coordinates.sqlite3")) as conn:
            self.assertEqual(records, [json.loads(row[0]) for row in conn.execute("SELECT record_json FROM coordinates ORDER BY source_order")])


class CoordinateCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "collection.sqlite3"
        fixture(self.source).close()
        self.canonical_dir = self.root / "canonical"
        canonical.build(self.canonical_dir, source=self.source)
        self.coordinates_dir = self.root / "coordinates"
        coordinates.collect(self.coordinates_dir, canonical_dir=self.canonical_dir, interval=0.1, fetcher=successful_fetch)
        self.output = self.root / "v3"

    def build(self, output=None):
        return coordinate_catalog.build(output or self.output, canonical_dir=self.canonical_dir, coordinates_dir=self.coordinates_dir)

    def test_v3_preserves_base_data_and_adds_every_coordinate(self):
        query_dir = self.root / "v2"
        query.build(query_dir, canonical_dir=self.canonical_dir)
        inputs = [self.source, *self.canonical_dir.iterdir(), query_dir / canonical.DB_NAME, self.coordinates_dir / "coordinates.jsonl"]
        before = {path: canonical.file_digest(path) for path in inputs}
        manifest = self.build()
        with closing(canonical.read_only(query_dir / canonical.DB_NAME)) as original, closing(canonical.read_only(self.output / canonical.DB_NAME)) as new:
            for table in canonical.TABLES:
                columns = [row[1] for row in original.execute(f"PRAGMA table_info({table})") if table != "places" or row[1] not in ("longitude", "latitude")]
                statement = f"SELECT {','.join(columns)} FROM {table} ORDER BY source_order"
                self.assertEqual([tuple(r) for r in original.execute(statement)], [tuple(r) for r in new.execute(statement)])
            self.assertEqual(new.execute("SELECT COUNT(*) FROM places WHERE longitude=126.5 AND latitude=33.4 AND coordinate_status='available'").fetchone()[0], 4)
        self.assertEqual(before, {path: canonical.file_digest(path) for path in inputs})
        self.assertEqual(manifest["coordinates"]["counts"]["available"], 4)

    def test_repeat_and_restore_from_jsonl_without_databases(self):
        first = self.build()
        self.assertEqual(first, self.build())
        exchange = self.root / "exchange"
        shutil.copytree(self.canonical_dir, exchange / "canonical", ignore=shutil.ignore_patterns(canonical.DB_NAME))
        shutil.copytree(self.coordinates_dir, exchange / "coordinates", ignore=shutil.ignore_patterns("*.sqlite3"))
        rebuilt = coordinate_catalog.build(exchange / "v3", canonical_dir=exchange / "canonical", coordinates_dir=exchange / "coordinates")
        self.assertEqual(first["database_logical_sha256"], rebuilt["database_logical_sha256"])
        self.assertEqual(coordinate_catalog.validate(exchange / "v3"), rebuilt)

    def test_sql_coordinate_tamper_detected_after_file_hash_update(self):
        manifest = self.build()
        path = self.output / canonical.DB_NAME
        with closing(sqlite3.connect(path)) as conn, conn:
            conn.execute("UPDATE places SET longitude=126.7 WHERE source_order=0")
        manifest["files"][canonical.DB_NAME] = {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size}
        (self.output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "query columns differ"):
            coordinate_catalog.validate(self.output)

    def test_observation_identity_tamper_is_detected(self):
        path = self.coordinates_dir / "coordinates.jsonl"
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        rows[0]["observed"]["place_id"] = "99999"
        path.write_text("".join(canonical.packed(r) + "\n" for r in rows), encoding="utf-8")
        manifest_path = self.coordinates_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["files"][path.name] = {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size}
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "observed ID differs"):
            self.build()
        self.assertFalse(self.output.exists())

    def test_partial_input_is_not_published_and_unavailable_stays_null(self):
        partial_dir = self.root / "partial"
        coordinates.collect(partial_dir, canonical_dir=self.canonical_dir, interval=0.1, limit=1, fetcher=successful_fetch)
        with self.assertRaisesRegex(ValueError, "pending targets"):
            coordinate_catalog.build(self.output, canonical_dir=self.canonical_dir, coordinates_dir=partial_dir)
        coordinates.collect(partial_dir, canonical_dir=self.canonical_dir, interval=0.1,
                            fetcher=lambda r: coordinates.parse_response(r, b"", 404))
        manifest = coordinate_catalog.build(self.output, canonical_dir=self.canonical_dir, coordinates_dir=partial_dir)
        self.assertEqual(manifest["coordinates"]["counts"]["available"], 1)
        self.assertEqual(manifest["coordinates"]["counts"]["unavailable"], 3)
        with closing(canonical.read_only(self.output / canonical.DB_NAME)) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM places WHERE longitude IS NULL AND latitude IS NULL AND coordinate_status='unavailable'").fetchone()[0], 3)
        with self.assertRaisesRegex(ValueError, "different snapshot"):
            self.build()


if __name__ == "__main__":
    unittest.main()
