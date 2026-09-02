#!/usr/bin/env python3
"""Validate the generated public Kakao review SQLite snapshot."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server/travel-feedback/data/kakao_reviews.sqlite3"
MANIFEST_PATH = ROOT / "server/travel-feedback/data/kakao_reviews_manifest.json"
FORBIDDEN_COLUMNS = {"reviewer", "author", "nickname", "user_name"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest["database"]["sha256"] != sha256_file(DB_PATH):
        raise RuntimeError("database hash does not match manifest")
    uri = f"file:{DB_PATH.as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("SQLite integrity_check failed")
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_schema WHERE type='table'")}
        if tables != {"metadata", "place_links", "reviews"}:
            raise RuntimeError(f"unexpected tables: {sorted(tables)}")
        columns = {
            row[1]
            for table in tables
            for row in connection.execute(f"PRAGMA table_info({table})")
        }
        forbidden = columns & FORBIDDEN_COLUMNS
        if forbidden:
            raise RuntimeError(f"forbidden author columns found: {sorted(forbidden)}")
        counts = {
            "link_rows": connection.execute("SELECT COUNT(*) FROM place_links").fetchone()[0],
            "stored_review_rows": connection.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
            "matched_tourapi_places": connection.execute("SELECT COUNT(DISTINCT contentid) FROM place_links").fetchone()[0],
            "matched_kakao_places": connection.execute("SELECT COUNT(DISTINCT kakao_place_id) FROM place_links").fetchone()[0],
            "matched_kakao_places_with_reviews": connection.execute(
                "SELECT COUNT(DISTINCT r.kakao_place_id) FROM reviews r JOIN place_links p USING(kakao_place_id)"
            ).fetchone()[0],
            "matched_tourapi_places_with_reviews": connection.execute(
                "SELECT COUNT(DISTINCT p.contentid) FROM place_links p JOIN reviews r USING(kakao_place_id)"
            ).fetchone()[0],
        }
        for key, value in counts.items():
            if manifest["counts"].get(key) != value:
                raise RuntimeError(f"count mismatch for {key}: manifest={manifest['counts'].get(key)} db={value}")
        if connection.execute(
            "SELECT COUNT(*) FROM reviews WHERE trim(coalesce(content, '')) = '' AND rating IS NULL AND tags_json = '[]'"
        ).fetchone()[0]:
            raise RuntimeError("review rows without content, rating, or tags found")
        if connection.execute("SELECT COUNT(*) - COUNT(DISTINCT review_hash) FROM reviews").fetchone()[0]:
            raise RuntimeError("duplicate review hashes found")
    print(json.dumps({"ok": True, **counts}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
