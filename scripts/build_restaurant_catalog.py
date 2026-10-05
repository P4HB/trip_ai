"""Build an offline restaurant catalog without modifying the collector (SPEC-103)."""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "config/restaurant_catalog.v1.sql"
VERSION = "restaurant-catalog-v1"
TABLES = ("places", "reviews", "business_hours", "collection_issues")
DB_NAME = "restaurants.sqlite3"
DEFAULT_SOURCE = ROOT / "data/kakao/jeju/2026-09-21/restaurants/collection.sqlite3"
DEFAULT_OUTPUT = ROOT / "data/catalogs/jeju/2026-09-21/restaurant-catalog-v1"
PLACE_FIELDS = ("place_id", "name", "url", "address", "category", "query", "collected_at",
                "average_rating_5", "visitor_review_count", "blog_review_count")
SUMMARY_FIELDS = ("place_id", "place_name", "place_url", "collected_at", "review_status",
                  "average_rating_5", "visitor_review_count", "blog_review_count", "collected_review_count")
REVIEW_FIELDS = ("place_id", "place_name", "place_url", "query", "collected_at", "rating",
                 "date", "content", "tags", "likes")


def packed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(packed(value).encode("utf-8")).hexdigest()


def file_digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def schema_digest():
    # Git's Windows CRLF checkout must not change the schema identity.
    return hashlib.sha256(SCHEMA.read_text(encoding="utf-8").encode("utf-8")).hexdigest()


def read_only(path):
    conn = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only=ON")
    return conn


def number(value, integer=False):
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not a count or rating")
    result = int(value) if integer else float(value)
    if not math.isfinite(result) or result < 0 or (integer and float(value) != result):
        raise ValueError(f"Invalid numeric observation: {value!r}")
    return result


def selected(record, keys):
    # The collector deliberately omits authors; never copy unexpected fields.
    return {key: record[key] for key in keys if key in record}


def snapshot_digest(conn):
    hasher = hashlib.sha256()
    for table, order in (("metadata", "key"), ("queries", "query"), ("places", "place_id"),
                         ("discoveries", "query,place_id"), ("reviews", "place_id,position"),
                         ("business_hours", "place_id")):
        hasher.update((table + "\n").encode())
        for row in conn.execute(f"SELECT * FROM {table} ORDER BY {order}"):
            value = dict(row)
            for field in ("payload", "summary", "value"):
                if value.get(field) is not None:
                    value[field] = json.loads(value[field])
            hasher.update((packed(value) + "\n").encode("utf-8"))
    return hasher.hexdigest()


def read_collector(path):
    with closing(read_only(path)) as original, closing(sqlite3.connect(":memory:")) as conn:
        original.backup(conn)
        conn.row_factory = sqlite3.Row
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or conn.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Collector integrity check failed")
        provenance = {
            "kind": "collector_sqlite", "file_name": Path(path).name,
            "logical_sha256": snapshot_digest(conn),
            "collection_started_at": json.loads(conn.execute("SELECT value FROM metadata WHERE key='started_at'").fetchone()[0]),
            "settings": json.loads(conn.execute("SELECT value FROM metadata WHERE key='settings'").fetchone()[0]),
            "query_status_counts": dict(conn.execute("SELECT status,COUNT(*) FROM queries GROUP BY status")),
            "region_count": conn.execute("SELECT COUNT(DISTINCT region) FROM queries").fetchone()[0],
            "classification_counts": dict(conn.execute("SELECT classification,COUNT(*) FROM places GROUP BY classification")),
        }
        records = {table: [] for table in TABLES}

        def issue(kind, identity, message, url, checked_at=None, canonical_id=None):
            records["collection_issues"].append({
                "issue_id": digest([kind, identity]), "canonical_id": canonical_id,
                "source_order": len(records["collection_issues"]), "kind": kind,
                "message": message, "source_url": url, "checked_at": checked_at,
            })

        for query in conn.execute("SELECT * FROM queries WHERE status != 'done' ORDER BY query"):
            issue("query_truncated" if query["status"] == "truncated" else "query_incomplete", query["query"],
                  packed(dict(query)), "https://map.kakao.com/", query["updated_at"])

        for order, row in enumerate(conn.execute("SELECT * FROM places WHERE classification='restaurant' ORDER BY place_id")):
            place = json.loads(row["payload"])
            summary = json.loads(row["summary"]) if row["summary"] else {}
            place_id = row["place_id"]
            if place.get("place_id") != place_id or (summary and summary.get("place_id") != place_id):
                raise ValueError("Collector place identity mismatch")
            canonical_id = "kakao:" + place_id
            url = "https://place.map.kakao.com/" + place_id
            review_status = summary.get("review_status", "uncollected")
            count_value = summary.get("visitor_review_count") if summary else place.get("visitor_review_count")
            count = number(count_value, integer=True)
            count_status = "observed" if count is not None else "unknown"
            count_at = summary.get("collected_at") if summary else place.get("collected_at")
            rating = number(summary.get("average_rating_5") if summary else place.get("average_rating_5"))
            if review_status == "not_provided":
                count, rating, count_status = None, None, "not_provided"
            elif not summary and count == 30 and place.get("collected_at", "") < "2026-09-29":
                count, rating, count_status = None, None, "unverified_legacy"
                issue("unverified_legacy_count", canonical_id, "Legacy hidden search DOM count requires detail verification", url,
                      place.get("collected_at"), canonical_id)
            stored_reviews = list(conn.execute("SELECT * FROM reviews WHERE place_id=? ORDER BY position", (place_id,)))
            if summary and number(summary.get("collected_review_count"), integer=True) != len(stored_reviews):
                raise ValueError(f"Review count mismatch for {canonical_id}")
            records["places"].append({
                "canonical_id": canonical_id, "place_id": place_id, "source_order": order,
                "title": place["name"], "address": place.get("address", ""),
                "longitude": None, "latitude": None, "category": place.get("category", ""),
                "source_url": url, "first_collected_at": place["collected_at"],
                "detail_checked_at": summary.get("collected_at"), "detail_status": row["detail_status"],
                "review_status": review_status, "average_rating_5": rating,
                "visitor_review_count": count, "visitor_review_count_status": count_status,
                "visitor_review_count_checked_at": count_at if count is not None else None,
                "blog_review_count": number(place.get("blog_review_count"), integer=True),
                "blog_review_count_checked_at": place["collected_at"] if place.get("blog_review_count") not in (None, "") else None,
                "collected_review_count": len(stored_reviews),
                "source": {"inventory": selected(place, PLACE_FIELDS), "detail": selected(summary, SUMMARY_FIELDS)},
            })
            if row["detail_status"] != "done":
                issue("detail_incomplete", canonical_id, row["error"] or row["detail_status"], url,
                      canonical_id=canonical_id)
            for review_row in stored_reviews:
                review = json.loads(review_row["payload"])
                if review.get("place_id") != place_id:
                    raise ValueError("Review place identity mismatch")
                source = selected(review, REVIEW_FIELDS)
                records["reviews"].append({
                    "review_id": digest([canonical_id, review_row["position"], source]),
                    "canonical_id": canonical_id, "source_order": len(records["reviews"]),
                    "source_position": review_row["position"], "rating": number(review.get("rating")),
                    "review_date_raw": review.get("date", ""), "content": review.get("content", ""),
                    "tags": review.get("tags", ""), "likes": number(review.get("likes"), integer=True),
                    "source_url": url, "checked_at": review["collected_at"], "source": source,
                })
            hours_row = conn.execute("SELECT * FROM business_hours WHERE place_id=?", (place_id,)).fetchone()
            hours = json.loads(hours_row["payload"]) if hours_row else {}
            if hours_row and (hours.get("place_id") != place_id or hours.get("status") != hours_row["status"]):
                raise ValueError("Business-hours identity/status mismatch")
            status = hours.get("status", "uncollected")
            records["business_hours"].append({
                "canonical_id": canonical_id, "source_order": order, "status": status,
                **{field: hours.get(field, "") for field in ("hours_text", "opening_hours", "closed_days", "break_time", "last_order", "error")},
                "schedule": json.loads(hours.get("schedule_json") or "[]"),
                "source_url": hours.get("source_url") or url + "?openhour=1", "checked_at": hours.get("checked_at"),
            })
            if status in ("uncollected", "unrecognized"):
                issue("hours_" + status, canonical_id, hours.get("error") or status, url + "?openhour=1",
                      hours.get("checked_at"), canonical_id)
        return records, provenance


def database_values(conn, table, record):
    values = {}
    raw = packed(record)
    for column in conn.execute(f"PRAGMA table_info({table})"):
        name = column[1]
        if name == "raw_json":
            values[name] = raw
        elif name == "record_sha256":
            values[name] = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        elif name.endswith("_json"):
            values[name] = packed(record[name[:-5]])
        else:
            values[name] = record[name]
    expected = {name[:-5] if name.endswith("_json") else name for name in values if name not in ("raw_json", "record_sha256")}
    if set(record) != expected:
        raise ValueError(f"Unexpected fields in {table}: {set(record) ^ expected}")
    return values


def database_digest(conn):
    hasher = hashlib.sha256()
    for table in TABLES:
        hasher.update((table + "\n").encode())
        for row in conn.execute(f"SELECT raw_json FROM {table} ORDER BY source_order"):
            hasher.update((row[0] + "\n").encode("utf-8"))
    return hasher.hexdigest()


def coverage(records):
    places, hours = records["places"], records["business_hours"]
    return {
        "detail_status_counts": dict(sorted(Counter(p["detail_status"] for p in places).items())),
        "review_status_counts": dict(sorted(Counter(p["review_status"] for p in places).items())),
        "visitor_count_status_counts": dict(sorted(Counter(p["visitor_review_count_status"] for p in places).items())),
        "business_hours_status_counts": dict(sorted(Counter(h["status"] for h in hours).items())),
        "hours_checked_count": sum(h["status"] in ("available", "not_provided") for h in hours),
        "hours_pending_count": sum(h["status"] in ("unrecognized", "uncollected") for h in hours),
        "issue_kind_counts": dict(sorted(Counter(i["kind"] for i in records["collection_issues"]).items())),
        "all_jeju_restaurants_guaranteed": False,
    }


def write_catalog(directory, records, provenance):
    for table in TABLES:
        with (directory / (table + ".jsonl")).open("w", encoding="utf-8", newline="\n") as stream:
            for record in records[table]:
                stream.write(packed(record) + "\n")
    with closing(sqlite3.connect(directory / DB_NAME)) as conn:
        conn.executescript(SCHEMA.read_text(encoding="utf-8"))
        with conn:
            for key, value in (("contract", VERSION), ("source", provenance), ("schema_sha256", schema_digest())):
                conn.execute("INSERT INTO dataset_meta VALUES (?,?)", (key, packed(value)))
            for table in TABLES:
                for record in records[table]:
                    values = database_values(conn, table, record)
                    conn.execute(f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))
        logical_hash = database_digest(conn)
    files = {}
    for name in [*(table + ".jsonl" for table in TABLES), DB_NAME]:
        path = directory / name
        files[name] = {"sha256": file_digest(path), "bytes": path.stat().st_size}
    manifest = {
        "contract": VERSION, "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": provenance, "schema_sha256": schema_digest(),
        "counts": {table: len(records[table]) for table in TABLES}, "coverage": coverage(records),
        "database_logical_sha256": logical_hash, "files": files,
        "storage": "local_only; copy the collector DB or all canonical JSONL files and manifest separately to restore",
    }
    (directory / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def build(output, *, source=None, from_jsonl=None):
    from validate_restaurant_catalog import validate_catalog, read_records

    if (source is None) == (from_jsonl is None):
        raise ValueError("Supply exactly one collector or JSONL source")
    if source is not None:
        records, provenance = read_collector(source)
        expected_digest = None
    else:
        source_manifest = validate_catalog(Path(from_jsonl), jsonl_only=True)
        records = read_records(Path(from_jsonl))
        provenance = source_manifest["source"]
        expected_digest = source_manifest["database_logical_sha256"]
    output = Path(output).resolve()
    if output.exists():
        existing = validate_catalog(output)
        if existing["source"] != provenance or (expected_digest and existing["database_logical_sha256"] != expected_digest):
            raise ValueError("Output belongs to a different snapshot; choose a new output directory")
        return existing
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".restaurant-build-", dir=output.parent) as temporary:
        staging = Path(temporary) / "catalog"
        staging.mkdir()
        manifest = write_catalog(staging, records, provenance)
        validate_catalog(staging)
        if expected_digest and expected_digest != manifest["database_logical_sha256"]:
            raise ValueError("Rebuilt DB logical hash differs from the canonical snapshot")
        staging.rename(output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--source-db", type=Path)
    group.add_argument("--from-jsonl", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    manifest = build(args.output_dir, source=None if args.from_jsonl else args.source_db or DEFAULT_SOURCE, from_jsonl=args.from_jsonl)
    print(json.dumps({"output": str(args.output_dir), "counts": manifest["counts"], "coverage": manifest["coverage"],
                      "database_logical_sha256": manifest["database_logical_sha256"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
