"""Check every canonical restaurant record, SQL column, relationship and digest."""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime
import hashlib
import json
from pathlib import Path
import sqlite3

from build_restaurant_catalog import (DB_NAME, DEFAULT_OUTPUT, SCHEMA, TABLES, VERSION,
                                      coverage, file_digest, packed, read_only, schema_digest)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_keys(pairs):
    record = {}
    for key, value in pairs:
        require(key not in record, f"Duplicate JSON key: {key}")
        record[key] = value
    return record


def check_fields(value):
    if isinstance(value, dict):
        for key, child in value.items():
            require(key.lower() not in {"reviewer", "reviewer_name", "author", "author_name", "profile_url", "email"},
                    f"Author/identity field is forbidden: {key}")
            if key.endswith("_at") and child is not None:
                require(isinstance(child, str) and datetime.fromisoformat(child).utcoffset() is not None,
                        f"Missing timezone: {key}")
            check_fields(child)
    elif isinstance(value, list):
        for child in value:
            check_fields(child)


def read_records(directory):
    records = {}
    for table in TABLES:
        records[table] = []
        with (directory / f"{table}.jsonl").open(encoding="utf-8") as stream:
            for order, line in enumerate(stream):
                record = json.loads(line, object_pairs_hook=unique_keys)
                require(isinstance(record, dict), f"{table}:{order}: expected an object")
                require(record.get("source_order") == order and type(record.get("source_order")) is int,
                        f"{table}:{order}: source_order mismatch")
                require(line == packed(record) + "\n", f"{table}:{order}: noncanonical JSON")
                check_fields(record)
                records[table].append(record)
    return records


def expected_sql_values(record):
    # Independently map canonical fields to columns, including every typed value.
    value = {key + "_json" if key in ("source", "schedule") else key:
             packed(child) if key in ("source", "schedule") else child for key, child in record.items()}
    value["raw_json"] = packed(record)
    value["record_sha256"] = hashlib.sha256(value["raw_json"].encode("utf-8")).hexdigest()
    return value


def validate_relationships(records):
    places = {record["canonical_id"]: record for record in records["places"]}
    review_counts = Counter(record["canonical_id"] for record in records["reviews"])
    require(len(places) == len(records["places"]), "Duplicate place ID")
    require({h["canonical_id"] for h in records["business_hours"]} == set(places), "Missing/extra hours record")
    require(len(records["business_hours"]) == len(places), "Duplicate hours record")
    for record in records["places"]:
        require(record["collected_review_count"] == review_counts[record["canonical_id"]], "Collected review count differs")
        if record["review_status"] == "empty":
            require(record["visitor_review_count"] == 0, "Empty reviews require an observed zero")
    for record in records["reviews"]:
        place = places.get(record["canonical_id"])
        require(place is not None and place["source_url"] == record["source_url"], "Review source URL differs")
        require(record["source"].get("place_id") == place["place_id"], "Review source identity differs")
        expected_id = hashlib.sha256(packed([record["canonical_id"], record["source_position"], record["source"]]).encode("utf-8")).hexdigest()
        require(record["review_id"] == expected_id, "Review ID differs")
    for hours in records["business_hours"]:
        require(all(isinstance(row, dict) and set(row) == {"label", "details"}
                    and isinstance(row["label"], str) and isinstance(row["details"], list)
                    and all(isinstance(text, str) for text in row["details"]) for row in hours["schedule"]),
                "Malformed schedule")
        if hours["status"] == "uncollected":
            require(not any(hours[key] for key in ("hours_text", "opening_hours", "closed_days", "break_time", "last_order", "schedule")),
                    "Uncollected hours contain inferred values")
    issue_counts = Counter((r["canonical_id"], r["kind"]) for r in records["collection_issues"])
    for place in records["places"]:
        require(issue_counts[(place["canonical_id"], "detail_incomplete")] == int(place["detail_status"] != "done"), "Detail issue coverage differs")
        require(issue_counts[(place["canonical_id"], "unverified_legacy_count")] == int(place["visitor_review_count_status"] == "unverified_legacy"), "Legacy issue coverage differs")
    for hours in records["business_hours"]:
        for status in ("unrecognized", "uncollected"):
            require(issue_counts[(hours["canonical_id"], "hours_" + status)] == int(hours["status"] == status), "Hours issue coverage differs")


def validate_catalog(directory, *, jsonl_only=False):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
    require(manifest["contract"] == VERSION, "Unsupported catalog contract")
    require(manifest["schema_sha256"] == schema_digest(), "Schema hash differs")
    file_names = {table + ".jsonl" for table in TABLES} | {DB_NAME}
    require(set(manifest["files"]) == file_names, "Unexpected/missing manifest files")
    for name in sorted(file_names):
        if jsonl_only and name == DB_NAME:
            continue
        path = directory / name
        require(path.stat().st_size == manifest["files"][name]["bytes"], f"File size differs: {name}")
        require(file_digest(path) == manifest["files"][name]["sha256"], f"File hash differs: {name}")
    records = read_records(directory)
    require(manifest["counts"] == {table: len(records[table]) for table in TABLES}, "Manifest counts differ")
    require(manifest["coverage"] == coverage(records), "Manifest coverage differs")
    require(manifest["source"]["classification_counts"].get("restaurant", 0) == len(records["places"]), "Source restaurant count differs")
    validate_relationships(records)
    hasher = hashlib.sha256()
    # Fresh schema constraints validate JSONL even when the SQL file is absent.
    with closing(sqlite3.connect(":memory:")) as reference:
        reference.executescript(SCHEMA.read_text(encoding="utf-8"))
        with reference:
            for table in TABLES:
                hasher.update((table + "\n").encode())
                for record in records[table]:
                    value = expected_sql_values(record)
                    expected_columns = {row[1] for row in reference.execute(f"PRAGMA table_info({table})")}
                    require(set(value) == expected_columns, f"Unexpected/missing {table} fields")
                    reference.execute(f"INSERT INTO {table} ({','.join(value)}) VALUES ({','.join('?' for _ in value)})", tuple(value.values()))
                    hasher.update((value["raw_json"] + "\n").encode("utf-8"))
        require(not reference.execute("PRAGMA foreign_key_check").fetchall(), "Canonical foreign keys differ")
        require(manifest["database_logical_sha256"] == hasher.hexdigest(), "Logical database hash differs")
        if not jsonl_only:
            with closing(read_only(directory / DB_NAME)) as actual:
                require(actual.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Database integrity failed")
                require(not actual.execute("PRAGMA foreign_key_check").fetchall(), "Database foreign keys failed")
                schema_query = "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"
                require([tuple(row) for row in actual.execute(schema_query)] == list(reference.execute(schema_query)), "Database schema differs")
                require(actual.execute("PRAGMA user_version").fetchone()[0] == 1, "Database version differs")
                expected_metadata = {"contract": packed(VERSION), "schema_sha256": packed(schema_digest()), "source": packed(manifest["source"])}
                require(dict(actual.execute("SELECT key,value FROM dataset_meta")) == expected_metadata, "Database metadata differs")
                for table in TABLES:
                    cursor = actual.execute(f"SELECT * FROM {table} ORDER BY source_order")
                    for record in records[table]:
                        row = cursor.fetchone()
                        require(row is not None and dict(row) == expected_sql_values(record), f"{table}:{record['source_order']}: SQL columns differ")
                    require(cursor.fetchone() is None, f"Extra rows in {table}")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--jsonl-only", action="store_true", help="Verify canonical files without needing the derived SQLite file")
    args = parser.parse_args()
    manifest = validate_catalog(args.directory, jsonl_only=args.jsonl_only)
    print(json.dumps({"valid": True, "counts": manifest["counts"], "database_logical_sha256": manifest["database_logical_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
