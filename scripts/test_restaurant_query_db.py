"""Compact DB preservation, restore, relocation and corruption regressions."""
from contextlib import closing
import json
from pathlib import Path
import shutil
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import build_restaurant_catalog as canonical
import build_restaurant_query_db as query
from test_restaurant_catalog import fixture
from validate_restaurant_query_db import validate_query_db


class QueryDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "collection.sqlite3"
        fixture(self.source).close()
        self.canonical_dir = self.root / "canonical"
        self.source_manifest = canonical.build(self.canonical_dir, source=self.source)
        self.output = self.root / "query"

    def build(self, output=None):
        return query.build(output or self.output, canonical_dir=self.canonical_dir)

    def test_every_retained_value_and_original_hash_is_preserved(self):
        inputs = [self.source, *self.canonical_dir.iterdir()]
        before = {path.name: canonical.file_digest(path) for path in inputs}
        manifest = self.build()
        self.assertEqual(manifest["counts"], self.source_manifest["counts"])
        self.assertEqual(manifest["coverage"], self.source_manifest["coverage"])
        self.assertEqual(manifest["canonical"]["logical_sha256"], self.source_manifest["database_logical_sha256"])
        self.assertEqual(set(path.name for path in self.output.iterdir()), {query.DB_NAME, "manifest.json"})
        with closing(canonical.read_only(self.canonical_dir / query.DB_NAME)) as original, closing(canonical.read_only(self.output / query.DB_NAME)) as compact:
            for table in query.TABLES:
                columns = [row[1] for row in compact.execute(f"PRAGMA table_info({table})")]
                old_columns = [row[1] for row in original.execute(f"PRAGMA table_info({table})")]
                self.assertEqual(columns, [name for name in old_columns if name not in ("raw_json", "source_json")])
                statement = f"SELECT {','.join(columns)} FROM {table} ORDER BY source_order"
                self.assertEqual([tuple(r) for r in original.execute(statement)], [tuple(r) for r in compact.execute(statement)])
        self.assertEqual(before, {path.name: canonical.file_digest(path) for path in inputs})

    def test_rebuild_without_v1_database_and_repeat(self):
        original = self.build()
        self.assertEqual(self.build(), original)
        exchange = self.root / "exchange"
        shutil.copytree(self.canonical_dir, exchange, ignore=shutil.ignore_patterns(query.DB_NAME))
        rebuilt = query.build(self.root / "restored", canonical_dir=exchange)
        self.assertEqual(original["database_logical_sha256"], rebuilt["database_logical_sha256"])
        self.assertEqual(original["counts"], rebuilt["counts"])

    def test_relocation_with_relative_bundle_or_explicit_override(self):
        self.build()
        relocated = self.root / "moved"
        shutil.copytree(self.canonical_dir, relocated / "canonical", ignore=shutil.ignore_patterns(query.DB_NAME))
        shutil.copytree(self.output, relocated / "query")
        validate_query_db(relocated / "query")
        isolated = self.root / "isolated" / "copy"
        shutil.copytree(self.output, isolated)
        with self.assertRaises(FileNotFoundError):
            validate_query_db(isolated)
        validate_query_db(isolated, canonical_dir=relocated / "canonical")

    def test_column_corruption_detected_even_after_file_hash_is_updated(self):
        manifest = self.build()
        database_path = self.output / query.DB_NAME
        with closing(sqlite3.connect(database_path)) as conn, conn:
            conn.execute("UPDATE reviews SET content='changed' WHERE source_order=0")
        manifest["files"][query.DB_NAME] = {"sha256": canonical.file_digest(database_path), "bytes": database_path.stat().st_size}
        (self.output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "query columns differ"):
            validate_query_db(self.output)

    def test_corrupt_canonical_input_is_not_published(self):
        path = self.canonical_dir / "places.jsonl"
        path.write_bytes(path.read_bytes() + b"\n")
        with self.assertRaisesRegex(ValueError, "File size differs"):
            self.build()
        self.assertFalse(self.output.exists())

    def test_different_snapshot_never_overwrites(self):
        self.build()
        before = canonical.file_digest(self.output / query.DB_NAME)
        with closing(sqlite3.connect(self.source)) as conn, conn:
            conn.execute("UPDATE queries SET status='done'")
        newer = self.root / "new-canonical"
        canonical.build(newer, source=self.source)
        with self.assertRaisesRegex(ValueError, "different snapshot"):
            query.build(self.output, canonical_dir=newer)
        self.assertEqual(canonical.file_digest(self.output / query.DB_NAME), before)

    def test_crlf_schema_and_manifest_do_not_break_restore(self):
        original = self.build()
        crlf_schema = self.root / "schema.sql"
        crlf_schema.write_bytes(query.SCHEMA.read_text(encoding="utf-8").replace("\n", "\r\n").encode("utf-8"))
        manifest_path = self.canonical_dir / "manifest.json"
        manifest_path.write_bytes(manifest_path.read_text(encoding="utf-8").replace("\n", "\r\n").encode("utf-8"))
        with patch.object(query, "SCHEMA", crlf_schema):
            validate_query_db(self.output)
            rebuilt = self.build(self.root / "windows-query")
        self.assertEqual(original["database_logical_sha256"], rebuilt["database_logical_sha256"])


if __name__ == "__main__":
    unittest.main()
