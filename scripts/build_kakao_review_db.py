#!/usr/bin/env python3
"""Build the read-only Kakao review catalog used by the public travel API."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CROSSWALK_PATH = ROOT / "data/labeling/jeju/2026-08-24/kakao-place-label-v1/candidate_crosswalk.csv"
REVIEW_INPUTS = (
    (
        ROOT / "data/kakao/jeju/2026-08-19/reviews.csv",
        ROOT / "data/kakao/jeju/2026-08-19/manifest.json",
        "2026-08-19",
    ),
    (
        ROOT / "data/kakao/jeju/2026-08-20/db-place-backfill/reviews.csv",
        ROOT / "data/kakao/jeju/2026-08-20/db-place-backfill/review_manifest.json",
        "2026-08-20-db-place-backfill",
    ),
)
OUTPUT_DIR = ROOT / "server/travel-feedback/data"
DB_PATH = OUTPUT_DIR / "kakao_reviews.sqlite3"
MANIFEST_PATH = OUTPUT_DIR / "kakao_reviews_manifest.json"
SCHEMA_VERSION = "kakao-place-reviews-v1"
EXPECTED = {
    "matched_kakao_places": 1291,
    "matched_tourapi_places": 1308,
    "input_review_rows": 8355,
    "matched_kakao_places_with_reviews": 1079,
    "matched_tourapi_places_with_reviews": 1094,
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def parse_optional_float(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    return float(text)


def parse_optional_int(value: str | None) -> int | None:
    text = (value or "").strip()
    if not text:
        return None
    return int(text)


def load_links() -> list[tuple[str, str, str, str]]:
    links: set[tuple[str, str, str, str]] = set()
    with CROSSWALK_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"place_id", "name", "url", "overlap_status", "existing_contentids"}
        if not required.issubset(reader.fieldnames or []):
            raise RuntimeError("candidate crosswalk schema is incomplete")
        for row in reader:
            if row["overlap_status"] != "existing_ready":
                continue
            kakao_id = row["place_id"].strip()
            if not kakao_id.isdigit():
                raise RuntimeError(f"invalid Kakao place_id: {kakao_id!r}")
            for contentid in row["existing_contentids"].split("|"):
                contentid = contentid.strip()
                if not contentid.isdigit():
                    raise RuntimeError(f"invalid TourAPI contentid: {contentid!r}")
                links.add((contentid, kakao_id, normalize_text(row["name"]), row["url"].strip()))
    return sorted(links, key=lambda item: (int(item[0]), int(item[1])))


def review_key(row: dict[str, str]) -> tuple[str, str]:
    fields = (
        row["place_id"].strip(),
        normalize_text(row.get("date")),
        normalize_text(row.get("rating")),
        normalize_text(row.get("content")),
        normalize_text(row.get("tags")),
        normalize_text(row.get("likes")),
    )
    canonical = "\x1f".join(fields)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest(), canonical


def load_reviews(matched_kakao_ids: set[str]) -> tuple[list[dict[str, Any]], int, int, int, int, list[str]]:
    reviews: dict[str, dict[str, Any]] = {}
    input_rows = 0
    excluded_unmatched_rows = 0
    excluded_empty_rows = 0
    duplicate_review_rows = 0
    collected_at: list[str] = []
    source_order = 0
    for review_path, manifest_path, snapshot in REVIEW_INPUTS:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        collected_at.append(manifest["updated_at"])
        with review_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            required = {"place_id", "place_name", "place_url", "rating", "date", "content", "tags", "likes", "reviewer"}
            if not required.issubset(reader.fieldnames or []):
                raise RuntimeError(f"review schema is incomplete: {review_path}")
            for row in reader:
                input_rows += 1
                kakao_id = row["place_id"].strip()
                if kakao_id not in matched_kakao_ids:
                    excluded_unmatched_rows += 1
                    continue
                content = normalize_text(row.get("content"))
                rating = parse_optional_float(row.get("rating"))
                raw_tags = [normalize_text(tag) for tag in (row.get("tags") or "").split("|") if normalize_text(tag)]
                if not content and rating is None and not raw_tags:
                    excluded_empty_rows += 1
                    continue
                digest, _ = review_key(row)
                if digest in reviews:
                    duplicate_review_rows += 1
                    continue
                source_order += 1
                reviews[digest] = {
                    "review_id": digest[:24],
                    "review_hash": digest,
                    "kakao_place_id": kakao_id,
                    "kakao_place_name": normalize_text(row.get("place_name")),
                    "kakao_place_url": row.get("place_url", "").strip(),
                    "rating": rating,
                    "review_date": normalize_text(row.get("date")) or None,
                    "content": content or None,
                    "tags_json": json.dumps(raw_tags, ensure_ascii=False, separators=(",", ":")),
                    "likes": parse_optional_int(row.get("likes")),
                    "source_snapshot": snapshot,
                    "source_order": source_order,
                }
    return (
        sorted(reviews.values(), key=lambda row: row["source_order"]),
        input_rows,
        excluded_unmatched_rows,
        excluded_empty_rows,
        duplicate_review_rows,
        sorted(collected_at),
    )


def create_database(path: Path, links: list[tuple[str, str, str, str]], reviews: list[dict[str, Any]], metadata: dict[str, str]) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA page_size = 4096")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(
            """
            CREATE TABLE metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            ) WITHOUT ROWID;

            CREATE TABLE place_links (
                contentid TEXT NOT NULL,
                kakao_place_id TEXT NOT NULL,
                kakao_place_name TEXT NOT NULL,
                kakao_place_url TEXT NOT NULL,
                PRIMARY KEY (contentid, kakao_place_id)
            ) WITHOUT ROWID;

            CREATE TABLE reviews (
                review_id TEXT PRIMARY KEY,
                review_hash TEXT NOT NULL UNIQUE,
                kakao_place_id TEXT NOT NULL,
                kakao_place_name TEXT NOT NULL,
                kakao_place_url TEXT NOT NULL,
                rating REAL,
                review_date TEXT,
                content TEXT,
                tags_json TEXT NOT NULL,
                likes INTEGER,
                source_snapshot TEXT NOT NULL,
                source_order INTEGER NOT NULL UNIQUE
            ) WITHOUT ROWID;

            CREATE INDEX idx_place_links_kakao ON place_links(kakao_place_id, contentid);
            CREATE INDEX idx_reviews_kakao_order ON reviews(kakao_place_id, source_order);
            PRAGMA user_version = 1;
            """
        )
        connection.executemany("INSERT INTO metadata(key, value) VALUES (?, ?)", sorted(metadata.items()))
        connection.executemany(
            "INSERT INTO place_links(contentid, kakao_place_id, kakao_place_name, kakao_place_url) VALUES (?, ?, ?, ?)",
            links,
        )
        connection.executemany(
            """
            INSERT INTO reviews(
                review_id, review_hash, kakao_place_id, kakao_place_name, kakao_place_url,
                rating, review_date, content, tags_json, likes, source_snapshot, source_order
            ) VALUES (
                :review_id, :review_hash, :kakao_place_id, :kakao_place_name, :kakao_place_url,
                :rating, :review_date, :content, :tags_json, :likes, :source_snapshot, :source_order
            )
            """,
            reviews,
        )
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity check failed: {integrity}")
        connection.commit()
        connection.execute("VACUUM")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    links = load_links()
    matched_kakao_ids = {row[1] for row in links}
    matched_contentids = {row[0] for row in links}
    reviews, input_rows, excluded_unmatched_rows, excluded_empty_rows, duplicate_review_rows, collected_at = load_reviews(matched_kakao_ids)
    reviewed_kakao_ids = {row["kakao_place_id"] for row in reviews}
    reviewed_contentids = {row[0] for row in links if row[1] in reviewed_kakao_ids}
    actual = {
        "matched_kakao_places": len(matched_kakao_ids),
        "matched_tourapi_places": len(matched_contentids),
        "input_review_rows": input_rows,
        "matched_kakao_places_with_reviews": len(reviewed_kakao_ids),
        "matched_tourapi_places_with_reviews": len(reviewed_contentids),
    }
    if actual != EXPECTED:
        raise RuntimeError(f"input coverage changed: expected={EXPECTED}, actual={actual}")

    metadata = {
        "schema_version": SCHEMA_VERSION,
        "collected_at": max(collected_at),
        "review_limit_per_place": "5",
    }
    fd, temp_name = tempfile.mkstemp(prefix="kakao_reviews.", suffix=".sqlite3", dir=OUTPUT_DIR)
    os.close(fd)
    temp_path = Path(temp_name)
    try:
        temp_path.unlink()
        create_database(temp_path, links, reviews, metadata)
        os.replace(temp_path, DB_PATH)
    finally:
        temp_path.unlink(missing_ok=True)

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "collected_at": max(collected_at),
        "inputs": {
            str(CROSSWALK_PATH.relative_to(ROOT)).replace("\\", "/"): sha256_file(CROSSWALK_PATH),
            **{
                str(path.relative_to(ROOT)).replace("\\", "/"): sha256_file(path)
                for review_path, manifest_path, _ in REVIEW_INPUTS
                for path in (review_path, manifest_path)
            },
        },
        "counts": {
            **actual,
            "link_rows": len(links),
            "stored_review_rows": len(reviews),
            "excluded_unmatched_review_rows": excluded_unmatched_rows,
            "excluded_empty_review_rows": excluded_empty_rows,
            "duplicate_review_rows": duplicate_review_rows,
        },
        "privacy": {"reviewer_column_stored": False},
        "database": {
            "path": str(DB_PATH.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(DB_PATH),
            "bytes": DB_PATH.stat().st_size,
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["counts"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
