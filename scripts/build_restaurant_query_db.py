"""Build a compact query DB from preserved restaurant JSONL (SPEC-104)."""
from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

import build_restaurant_catalog as canonical
from validate_restaurant_catalog import read_records, validate_catalog

VERSION = "restaurant-catalog-v2"
SCHEMA = canonical.ROOT / "config/restaurant_catalog.v2.sql"
DEFAULT_CANONICAL = canonical.DEFAULT_OUTPUT
DEFAULT_OUTPUT = DEFAULT_CANONICAL.with_name(VERSION)
TABLES = canonical.TABLES
DB_NAME = canonical.DB_NAME


def schema_digest():
    return hashlib.sha256(SCHEMA.read_text(encoding="utf-8").encode("utf-8")).hexdigest()


def projected_values(columns, record):
    values = {}
    for name in columns:
        if name == "record_sha256":
            values[name] = canonical.digest(record)
        elif name == "schedule_json":
            values[name] = canonical.packed(record["schedule"])
        else:
            values[name] = record[name]
    return values


def database_digest(conn):
    hasher = hashlib.sha256()
    for table in TABLES:
        hasher.update((table + "\n").encode())
        columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
        for row in conn.execute(f"SELECT * FROM {table} ORDER BY source_order"):
            hasher.update((canonical.packed(dict(zip(columns, row))) + "\n").encode("utf-8"))
    return hasher.hexdigest()


def expected_metadata(source_manifest):
    return {
        "contract": canonical.packed(VERSION),
        "schema_sha256": canonical.packed(schema_digest()),
        "source": canonical.packed(source_manifest["source"]),
        "canonical_contract": canonical.packed(source_manifest["contract"]),
        "canonical_manifest_sha256": canonical.packed(canonical.digest(source_manifest)),
        "canonical_logical_sha256": canonical.packed(source_manifest["database_logical_sha256"]),
    }


def build(output=DEFAULT_OUTPUT, *, canonical_dir=DEFAULT_CANONICAL):
    from validate_restaurant_query_db import validate_query_db

    canonical_dir, output = Path(canonical_dir).resolve(), Path(output).resolve()
    source_manifest = validate_catalog(canonical_dir, jsonl_only=True)
    canonical_manifest_hash = canonical.digest(source_manifest)
    if output.exists():
        existing = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
        if existing.get("contract") != VERSION or existing.get("canonical", {}).get("manifest_sha256") != canonical_manifest_hash:
            raise ValueError("Output belongs to a different snapshot or contract; choose a new directory")
        return validate_query_db(output, canonical_dir=canonical_dir)
    # Keep a relocatable bundle reference, never a machine-specific absolute path.
    relative_dir = Path(os.path.relpath(canonical_dir, output)).as_posix()
    records = read_records(canonical_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".restaurant-build-query-", dir=output.parent) as temporary:
        staging = Path(temporary) / "catalog"
        staging.mkdir()
        with closing(sqlite3.connect(staging / DB_NAME)) as conn:
            conn.executescript(SCHEMA.read_text(encoding="utf-8"))
            with conn:
                conn.executemany("INSERT INTO dataset_meta VALUES(?,?)", expected_metadata(source_manifest).items())
                for table in TABLES:
                    columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]
                    statement = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})"
                    conn.executemany(statement, (tuple(projected_values(columns, record).values()) for record in records[table]))
            logical_hash = database_digest(conn)
        database_path = staging / DB_NAME
        manifest = {
            "contract": VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "schema_sha256": schema_digest(),
            "canonical": {
                "contract": source_manifest["contract"], "directory": relative_dir,
                "manifest_sha256": canonical_manifest_hash,
                "logical_sha256": source_manifest["database_logical_sha256"],
                "files": {table + ".jsonl": source_manifest["files"][table + ".jsonl"] for table in TABLES},
            },
            "source": source_manifest["source"],
            "counts": source_manifest["counts"], "coverage": source_manifest["coverage"],
            "database_logical_sha256": logical_hash,
            "files": {DB_NAME: {"sha256": canonical.file_digest(database_path), "bytes": database_path.stat().st_size}},
            "storage": "local_only; preserve canonical JSONL and its manifest separately; raw_json/source_json are not in this query DB",
        }
        (staging / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        validate_query_db(staging, canonical_dir=canonical_dir)
        # Fail before publication if the canonical bundle changed during the build.
        latest_manifest = json.loads((canonical_dir / "manifest.json").read_text(encoding="utf-8"))
        if canonical.digest(latest_manifest) != canonical_manifest_hash:
            raise ValueError("Canonical snapshot changed during build")
        staging.rename(output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical-dir", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    manifest = build(args.output_dir, canonical_dir=args.canonical_dir)
    print(json.dumps({"output": str(args.output_dir), "counts": manifest["counts"], "database": manifest["files"][DB_NAME],
                      "database_logical_sha256": manifest["database_logical_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
