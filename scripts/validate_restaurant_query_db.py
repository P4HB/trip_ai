"""Verify the compact query projection against every canonical JSONL record."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3

import build_restaurant_catalog as canonical
import build_restaurant_query_db as query
from validate_restaurant_catalog import expected_sql_values, read_records, require, unique_keys, validate_catalog


def validate_query_db(directory=query.DEFAULT_OUTPUT, *, canonical_dir=None):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
    require(manifest["contract"] == query.VERSION, "Unsupported query DB contract")
    require(manifest["schema_sha256"] == query.schema_digest(), "Query schema hash differs")
    location = Path(manifest["canonical"]["directory"])
    require(not location.is_absolute(), "Canonical bundle location must be relative")
    canonical_dir = Path(canonical_dir).resolve() if canonical_dir is not None else (directory / location).resolve()
    source_manifest = validate_catalog(canonical_dir, jsonl_only=True)
    require(manifest["canonical"]["contract"] == source_manifest["contract"], "Canonical contract differs")
    require(manifest["canonical"]["manifest_sha256"] == canonical.digest(source_manifest), "Canonical manifest differs")
    require(manifest["canonical"]["logical_sha256"] == source_manifest["database_logical_sha256"], "Canonical digest differs")
    require(manifest["canonical"]["files"] == {table + ".jsonl": source_manifest["files"][table + ".jsonl"] for table in query.TABLES},
            "Canonical file manifest differs")
    for field in ("source", "counts", "coverage"):
        require(manifest[field] == source_manifest[field], f"{field} differs from canonical bundle")
    require(set(manifest["files"]) == {query.DB_NAME}, "Unexpected query output files")
    path = directory / query.DB_NAME
    require(path.stat().st_size == manifest["files"][query.DB_NAME]["bytes"], "Query DB size differs")
    require(canonical.file_digest(path) == manifest["files"][query.DB_NAME]["sha256"], "Query DB file hash differs")
    records = read_records(canonical_dir)
    hasher = hashlib.sha256()
    with closing(canonical.read_only(path)) as actual, closing(sqlite3.connect(":memory:")) as reference:
        reference.executescript(query.SCHEMA.read_text(encoding="utf-8"))
        require(actual.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Query DB integrity failed")
        require(not actual.execute("PRAGMA foreign_key_check").fetchall(), "Query DB foreign keys failed")
        require(actual.execute("PRAGMA user_version").fetchone()[0] == 2, "Query DB version differs")
        schema_sql = "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"
        require([tuple(row) for row in actual.execute(schema_sql)] == list(reference.execute(schema_sql)), "Query DB schema differs")
        require(dict(actual.execute("SELECT key,value FROM dataset_meta")) == query.expected_metadata(source_manifest), "Query DB metadata differs")
        with reference:
            for table in query.TABLES:
                hasher.update((table + "\n").encode())
                columns = {row[1] for row in reference.execute(f"PRAGMA table_info({table})")}
                require(not columns.intersection({"raw_json", "source_json"}), "Redundant JSON columns remain")
                cursor = actual.execute(f"SELECT * FROM {table} ORDER BY source_order")
                for record in records[table]:
                    # Independent projection: retain all v1 SQL values except the two archive columns.
                    expected = {key: value for key, value in expected_sql_values(record).items()
                                if key not in ("raw_json", "source_json")}
                    require(set(expected) == columns, f"{table}: projection fields differ")
                    row = cursor.fetchone()
                    require(row is not None and dict(row) == expected, f"{table}:{record['source_order']}: query columns differ")
                    reference.execute(f"INSERT INTO {table} ({','.join(expected)}) VALUES ({','.join('?' for _ in expected)})", tuple(expected.values()))
                    hasher.update((canonical.packed(expected) + "\n").encode("utf-8"))
                require(cursor.fetchone() is None, f"{table}: unexpected rows")
        require(not reference.execute("PRAGMA foreign_key_check").fetchall(), "Projected foreign keys differ")
    require(hasher.hexdigest() == manifest["database_logical_sha256"], "Query logical digest differs")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=query.DEFAULT_OUTPUT)
    parser.add_argument("--canonical-dir", type=Path, help="Override the canonical bundle location after moving files")
    args = parser.parse_args()
    manifest = validate_query_db(args.directory, canonical_dir=args.canonical_dir)
    print(json.dumps({"valid": True, "counts": manifest["counts"], "database": manifest["files"][query.DB_NAME],
                      "database_logical_sha256": manifest["database_logical_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
