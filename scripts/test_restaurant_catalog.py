"""Offline data-loss and uncertainty regressions for SPEC-103; no browser needed."""
from contextlib import closing
import json
from pathlib import Path
import shutil
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from build_restaurant_catalog import DB_NAME, SCHEMA, TABLES, build, file_digest, packed
from validate_restaurant_catalog import validate_catalog


def fixture(path):
    conn = sqlite3.connect(path)
    conn.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);
        CREATE TABLE queries(query TEXT PRIMARY KEY,region TEXT,term TEXT,status TEXT,updated_at TEXT);
        CREATE TABLE discoveries(query TEXT,place_id TEXT);
        CREATE TABLE places(place_id TEXT PRIMARY KEY,payload TEXT,classification TEXT,detail_status TEXT,summary TEXT,error TEXT);
        CREATE TABLE reviews(place_id TEXT,position INTEGER,payload TEXT);
        CREATE TABLE business_hours(place_id TEXT,status TEXT,payload TEXT);
    """)
    time = "2026-09-22T01:00:00+09:00"
    with conn:
        conn.executemany("INSERT INTO metadata VALUES(?,?)", [("settings", packed({"max_reviews": 5})), ("started_at", packed(time))])
        conn.execute("INSERT INTO queries VALUES(?,?,?,?,?)", ("Jeju food", "Jeju", "food", "truncated", time))
        for pid, detail_status, review_status, count, total in [
            ("1", "done", "limited", "99", 2), ("2", "done", "not_provided", "", 0),
            ("3", "done", "empty", "0", 0), ("4", "failed", None, "30", 0),
        ]:
            payload = {"place_id": pid, "name": "식당 " + pid, "url": "https://place.map.kakao.com/" + pid,
                       "address": "제주특별자치도 제주시", "category": "한식", "collected_at": time,
                       "visitor_review_count": count, "blog_review_count": "12", "average_rating_5": "4.0"}
            summary = {"place_id": pid, "review_status": review_status, "collected_at": time, "visitor_review_count": count,
                       "average_rating_5": "4.0", "collected_review_count": total} if review_status else None
            conn.execute("INSERT INTO places VALUES(?,?,?,?,?,?)", (pid, packed(payload), "restaurant", detail_status, packed(summary) if summary else None, "timeout" if not summary else ""))
            for position in range(total):
                # Identical bodies are distinct observations at two source positions.
                review = {"place_id": pid, "rating": "5.0", "date": "2026.09.21.", "content": "맛있어요",
                          "tags": "", "likes": "0", "collected_at": time, "reviewer": "must not be exported"}
                conn.execute("INSERT INTO reviews VALUES(?,?,?)", (pid, position, packed(review)))
            if pid != "4":
                status = {"1": "available", "2": "not_provided", "3": "unrecognized"}[pid]
                record = {"place_id": pid, "status": status, "opening_hours": "월 09:00 ~ 18:00" if pid == "1" else "",
                          "hours_text": "월 09:00 ~ 18:00" if pid == "1" else "", "checked_at": time,
                          "schedule_json": '[{"label":"월","details":["09:00 ~ 18:00"]}]' if pid == "1" else "[]"}
                conn.execute("INSERT INTO business_hours VALUES(?,?,?)", (pid, status, packed(record)))
        conn.execute("INSERT INTO places VALUES(?,?,?,?,?,?)", ("5", packed({"place_id": "5", "name": "cafe"}), "excluded", "pending", None, ""))
    return conn


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "collection.sqlite3"
        self.writer = fixture(self.source)
        self.output = self.root / "catalog"

    def tearDown(self):
        self.writer.close()
        self.temp.cleanup()

    def test_wal_snapshot_preserves_uncertainty_and_duplicates(self):
        before = {p.name: file_digest(p) for p in self.root.glob("*.sqlite3*") if not p.name.endswith("-shm")}
        manifest = build(self.output, source=self.source)
        self.assertEqual(manifest["counts"]["places"], 4)
        self.assertEqual(manifest["counts"]["reviews"], 2)
        self.assertEqual(manifest["coverage"]["hours_pending_count"], 2)
        self.assertEqual(before, {p.name: file_digest(p) for p in self.root.glob("*.sqlite3*") if not p.name.endswith("-shm")})
        with closing(sqlite3.connect(self.output / DB_NAME)) as conn:
            self.assertEqual(conn.execute("SELECT visitor_review_count,visitor_review_count_status FROM places ORDER BY source_order").fetchall(),
                             [(99, "observed"), (None, "not_provided"), (0, "observed"), (None, "unverified_legacy")])
            self.assertEqual(conn.execute("SELECT COUNT(DISTINCT review_id) FROM reviews").fetchone()[0], 2)
        self.assertNotIn("must not be exported", (self.output / "reviews.jsonl").read_text(encoding="utf-8"))

    def test_restore_without_original_or_sqlite_and_repeat(self):
        original = build(self.output, source=self.source)
        self.assertEqual(build(self.output, source=self.source), original)
        exchange = self.root / "exchange"
        exchange.mkdir()
        for name in [*(table + ".jsonl" for table in TABLES), "manifest.json"]:
            shutil.copyfile(self.output / name, exchange / name)
        restored = build(self.root / "restored", from_jsonl=exchange)
        self.assertEqual(original["database_logical_sha256"], restored["database_logical_sha256"])
        for table in TABLES:
            self.assertEqual(original["files"][table + ".jsonl"], restored["files"][table + ".jsonl"])

    def test_typed_column_tamper_detected_even_with_updated_file_hash(self):
        manifest = build(self.output, source=self.source)
        with closing(sqlite3.connect(self.output / DB_NAME)) as conn, conn:
            conn.execute("UPDATE places SET title='tampered' WHERE place_id='1'")
        path = self.output / DB_NAME
        manifest["files"][DB_NAME] = {"sha256": file_digest(path), "bytes": path.stat().st_size}
        (self.output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "SQL columns differ"):
            validate_catalog(self.output)

    def test_count_mismatch_does_not_publish_output(self):
        with self.writer:
            self.writer.execute("DELETE FROM reviews WHERE position=1")
        with self.assertRaisesRegex(ValueError, "Review count mismatch"):
            build(self.output, source=self.source)
        self.assertFalse(self.output.exists())

    def test_different_source_does_not_overwrite(self):
        build(self.output, source=self.source)
        before = file_digest(self.output / DB_NAME)
        with self.writer:
            self.writer.execute("UPDATE queries SET status='done'")
        with self.assertRaisesRegex(ValueError, "different snapshot"):
            build(self.output, source=self.source)
        self.assertEqual(file_digest(self.output / DB_NAME), before)

    def test_windows_schema_checkout_preserves_manifest_identity(self):
        original = build(self.output, source=self.source)
        crlf_schema = self.root / "schema.sql"
        crlf_schema.write_bytes(SCHEMA.read_text(encoding="utf-8").replace("\n", "\r\n").encode("utf-8"))
        with patch("build_restaurant_catalog.SCHEMA", crlf_schema), patch("validate_restaurant_catalog.SCHEMA", crlf_schema):
            validate_catalog(self.output)
            restored = build(self.root / "windows-restored", from_jsonl=self.output)
        self.assertEqual(original["database_logical_sha256"], restored["database_logical_sha256"])

    def test_invalid_canonical_fk_and_author_fields_rejected(self):
        from build_restaurant_catalog import read_collector, write_catalog
        for defect in ("orphan", "author"):
            with self.subTest(defect=defect):
                records, provenance = read_collector(self.source)
                if defect == "orphan":
                    records["reviews"][0]["canonical_id"] = "kakao:999"
                else:
                    records["reviews"][0]["source"]["author"] = "unexpected"
                target = self.root / defect
                target.mkdir()
                with self.assertRaises((ValueError, sqlite3.IntegrityError)):
                    write_catalog(target, records, provenance)
                    validate_catalog(target)


if __name__ == "__main__":
    unittest.main()
