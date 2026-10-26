"""Build/verify the itinerary restaurant meal sidecar from the v3 query DB (SPEC-107).

The v3 restaurant DB is opened read-only (``immutable=1``) and its file hash is checked
before and after. Only restaurants with an available coordinate, available business hours
that ``restaurant_hours`` can fully interpret, and a meal category are included. Review
excerpts are limited to the newest N per restaurant and M characters each; no author data
exists in the source and none is added.

    python scripts/build_restaurant_meal_catalog.py
    python scripts/build_restaurant_meal_catalog.py --validate-only
"""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server/travel-feedback"
sys.path.insert(0, str(SERVER))
import restaurant_hours  # noqa: E402
from restaurant_catalog import (REVIEW_COLUMNS, RESTAURANT_COLUMNS, SCHEMA_SQL, SCHEMA_VERSION,  # noqa: E402
                                compact_hours, logical_digest, read_only_uri)
from lib.data_io import sha256_file as file_sha256  # noqa: E402

KST = timezone(timedelta(hours=9))
DEFAULT_SOURCE = ROOT / "data/catalogs/jeju/2026-10-06/restaurant-catalog-v3/restaurants.sqlite3"
DEFAULT_OUTPUT = SERVER / "data/restaurant_meal_catalog.sqlite3"
DEFAULT_MANIFEST = SERVER / "data/restaurant_meal_catalog_manifest.json"
POLICY = SERVER / "itinerary_policy.json"
DATE_RAW = re.compile(r"(\d{4})\.(\d{1,2})\.(\d{1,2})\.?")




def relative(path):
    path = Path(path).resolve()
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.name


def review_sort_key(row):
    match = DATE_RAW.fullmatch(row["review_date_raw"].strip())
    stamp = tuple(int(part) for part in match.groups()) if match else (0, 0, 0)
    # Newest first; unknown dates last; original page position breaks ties.
    return (-stamp[0], -stamp[1], -stamp[2], row["source_position"])


def load_policy():
    policy = json.loads(POLICY.read_text(encoding="utf-8"))["restaurant"]
    return {"nonMealCategories": sorted(policy["nonMealCategories"]), "maxReviewsPerRestaurant": int(policy["maxReviewsPerRestaurant"]),
            "maxReviewChars": int(policy["maxReviewChars"])}


def collect(source, policy):
    """Return (restaurants, reviews, coverage) from the read-only v3 DB."""
    non_meal = set(policy["nonMealCategories"])
    with closing(sqlite3.connect(read_only_uri(source), uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        places = connection.execute(
            "SELECT p.canonical_id, p.title, p.category, p.longitude, p.latitude, p.coordinate_status, p.average_rating_5,"
            " p.visitor_review_count, p.collected_review_count, p.source_url, b.status AS hours_status, b.schedule_json,"
            " b.hours_text, b.closed_days, b.break_time, b.last_order, b.source_url AS hours_source_url, b.checked_at AS hours_checked_at"
            " FROM places p JOIN business_hours b USING(canonical_id) ORDER BY p.canonical_id").fetchall()
        reviews_by_place = {}
        for row in connection.execute("SELECT review_id, canonical_id, source_position, rating, review_date_raw, content, tags FROM reviews"):
            reviews_by_place.setdefault(row["canonical_id"], []).append(row)
    excluded, weekday_open, weekday_unknown = Counter(), Counter(), Counter()
    restaurants, reviews = [], []
    for place in places:
        if place["coordinate_status"] != "available":
            excluded[f"coordinate_{place['coordinate_status']}"] += 1
            continue
        if place["hours_status"] != "available":
            excluded[f"hours_{place['hours_status']}"] += 1
            continue
        if place["category"] in non_meal:
            excluded["non_meal_category"] += 1
            continue
        hours = restaurant_hours.parse_business_hours(
            status=place["hours_status"], schedule_json=place["schedule_json"], hours_text=place["hours_text"],
            closed_days=place["closed_days"], break_time=place["break_time"], last_order=place["last_order"],
            checked_at=place["hours_checked_at"])
        if hours["status"] != "parsed":
            excluded[f"hours_parse_{hours['reason']}"] += 1
            continue
        for weekday, entry in hours["weekly"].items():
            if entry["status"] == "open":
                weekday_open[weekday] += 1
            elif entry["status"] == "unknown":
                weekday_unknown[entry["reason"]] += 1
        # Kakao ratings are 1..5; a stored 0.0 means "no rating", not a zero-star average.
        rating = place["average_rating_5"] if place["average_rating_5"] else None
        restaurants.append((place["canonical_id"], place["title"], place["category"], place["longitude"], place["latitude"],
                            rating, place["visitor_review_count"], place["collected_review_count"],
                            place["source_url"], json.dumps(compact_hours(hours), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                            place["hours_checked_at"], place["hours_source_url"]))
        ordered = sorted(reviews_by_place.get(place["canonical_id"], []), key=review_sort_key)
        for rank, row in enumerate(ordered[:policy["maxReviewsPerRestaurant"]]):
            content = " ".join(str(row["content"]).split())[:policy["maxReviewChars"]]
            reviews.append((place["canonical_id"], rank, row["review_id"], row["rating"], row["review_date_raw"], content, row["tags"] or ""))
    coverage = {"sourcePlaces": len(places), "included": len(restaurants), "excluded": sum(excluded.values()),
                "excludedByReason": dict(sorted(excluded.items(), key=lambda item: (-item[1], item[0]))),
                "includedOpenByIsoWeekday": {str(day): weekday_open.get(str(day), 0) for day in range(1, 8)},
                "unknownWeekdayReasons": dict(sorted(weekday_unknown.items(), key=lambda item: (-item[1], item[0]))),
                "reviews": len(reviews), "restaurantsWithReviews": len({row[0] for row in reviews})}
    return restaurants, reviews, coverage


def write_database(output, restaurants, reviews, meta):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    if temporary.exists():
        temporary.unlink()
    with closing(sqlite3.connect(temporary)) as connection:
        connection.executescript(SCHEMA_SQL)
        connection.executemany("INSERT INTO meta(key, value) VALUES (?, ?)", sorted(meta.items()))
        connection.executemany(f"INSERT INTO restaurants({', '.join(RESTAURANT_COLUMNS)}) VALUES ({', '.join('?' for _ in RESTAURANT_COLUMNS)})", restaurants)
        connection.executemany(f"INSERT INTO reviews({', '.join(REVIEW_COLUMNS)}) VALUES ({', '.join('?' for _ in REVIEW_COLUMNS)})", reviews)
        connection.commit()
        version = logical_digest(connection)
        connection.execute("INSERT INTO meta(key, value) VALUES ('catalogVersion', ?)", (version,))
        connection.commit()
        if connection.execute("PRAGMA foreign_key_check").fetchall() or connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("restaurant meal catalog integrity check failed")
        connection.execute("VACUUM")
    os.replace(temporary, output)
    return version


def build(source=DEFAULT_SOURCE, output=DEFAULT_OUTPUT, manifest_path=DEFAULT_MANIFEST):
    source = Path(source).resolve()
    before = file_sha256(source)
    policy = load_policy()
    restaurants, reviews, coverage = collect(source, policy)
    meta = {"schemaVersion": SCHEMA_VERSION, "hoursParserVersion": restaurant_hours.VERSION,
            "hoursBasis": "observed_week_projection", "sourceSha256": before,
            "policy": json.dumps(policy, ensure_ascii=False, sort_keys=True, separators=(",", ":"))}
    version = write_database(output, restaurants, reviews, meta)
    after = file_sha256(source)
    if before != after:
        raise RuntimeError("source database changed during build")
    source_manifest = source.parent / "manifest.json"
    source_meta = {}
    if source_manifest.is_file():
        data = json.loads(source_manifest.read_text(encoding="utf-8"))
        source_meta = {"contract": data.get("contract"), "databaseLogicalSha256": data.get("database_logical_sha256")}
    manifest = {"contract": SCHEMA_VERSION, "catalogVersion": version,
                "generatedAt": datetime.now(KST).isoformat(timespec="seconds"),
                "hoursParserVersion": restaurant_hours.VERSION, "hoursBasis": "observed_week_projection",
                "observationHolidays": sorted(restaurant_hours.OBSERVATION_HOLIDAYS),
                "source": {"path": relative(source), "sha256": before, "sha256After": after, "bytes": source.stat().st_size, **source_meta},
                "policy": policy, "coverage": coverage,
                "output": {"path": relative(output), "sha256": file_sha256(output), "bytes": Path(output).stat().st_size}}
    Path(manifest_path).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def validate(output=DEFAULT_OUTPUT, manifest_path=DEFAULT_MANIFEST, source=None):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    problems = []
    if file_sha256(output) != manifest["output"]["sha256"]:
        problems.append("output_sha256_mismatch")
    with closing(sqlite3.connect(read_only_uri(output), uri=True)) as connection:
        meta = dict(connection.execute("SELECT key, value FROM meta"))
        if meta.get("schemaVersion") != SCHEMA_VERSION or meta.get("catalogVersion") != manifest["catalogVersion"]:
            problems.append("meta_mismatch")
        if logical_digest(connection) != manifest["catalogVersion"]:
            problems.append("logical_digest_mismatch")
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or connection.execute("PRAGMA foreign_key_check").fetchall():
            problems.append("integrity_failed")
        count = connection.execute("SELECT COUNT(*) FROM restaurants").fetchone()[0]
        review_count = connection.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
        too_many = connection.execute("SELECT COUNT(*) FROM (SELECT restaurant_id FROM reviews GROUP BY restaurant_id HAVING COUNT(*) > ?)",
                                      (manifest["policy"]["maxReviewsPerRestaurant"],)).fetchone()[0]
        too_long = connection.execute("SELECT COUNT(*) FROM reviews WHERE length(content) > ?", (manifest["policy"]["maxReviewChars"],)).fetchone()[0]
        non_meal = connection.execute(f"SELECT COUNT(*) FROM restaurants WHERE category IN ({','.join('?' for _ in manifest['policy']['nonMealCategories'])})",
                                      manifest["policy"]["nonMealCategories"]).fetchone()[0]
        unparsed = sum(not isinstance(json.loads(row[0]).get("weekly"), dict) for row in connection.execute("SELECT hours_json FROM restaurants"))
        duplicate_ids = connection.execute("SELECT COUNT(*) - COUNT(DISTINCT review_id) FROM reviews").fetchone()[0]
    if count != manifest["coverage"]["included"] or review_count != manifest["coverage"]["reviews"]:
        problems.append("count_mismatch")
    if too_many or too_long or non_meal or unparsed or duplicate_ids:
        problems.append("policy_violation")
    if source is not None and file_sha256(source) != manifest["source"]["sha256"]:
        problems.append("source_changed")
    return {"valid": not problems, "problems": problems, "restaurants": count, "reviews": review_count,
            "catalogVersion": manifest["catalogVersion"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.validate_only:
        result = validate(args.output, args.manifest, args.source if args.source.is_file() else None)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0 if result["valid"] else 1)
    manifest = build(args.source, args.output, args.manifest)
    print(json.dumps({"catalogVersion": manifest["catalogVersion"], "coverage": manifest["coverage"], "output": manifest["output"]},
                     ensure_ascii=False, indent=2))
    result = validate(args.output, args.manifest, args.source)
    if not result["valid"]:
        print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
