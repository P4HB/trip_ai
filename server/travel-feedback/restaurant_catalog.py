"""Read-only restaurant meal catalog sidecar (SPEC-107).

Restaurant metadata and parsed weekday hours are held in memory (~10k rows); review
excerpts stay in SQLite and are read only for the few sampled candidates so the
container stays inside its memory limit.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA_VERSION = "restaurant-meal-catalog-v1"

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;
CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL) STRICT;
CREATE TABLE restaurants (
  restaurant_id TEXT PRIMARY KEY NOT NULL CHECK(restaurant_id GLOB 'kakao:[0-9]*'),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  lng REAL NOT NULL CHECK(lng BETWEEN 125 AND 127.5),
  lat REAL NOT NULL CHECK(lat BETWEEN 32.8 AND 34.2),
  average_rating REAL CHECK(average_rating BETWEEN 0 AND 5),
  review_count INTEGER CHECK(review_count >= 0),
  collected_review_count INTEGER NOT NULL CHECK(collected_review_count >= 0),
  source_url TEXT NOT NULL,
  hours_json TEXT NOT NULL CHECK(json_valid(hours_json)),
  hours_checked_at TEXT NOT NULL,
  hours_source_url TEXT NOT NULL
) STRICT, WITHOUT ROWID;
CREATE TABLE reviews (
  restaurant_id TEXT NOT NULL REFERENCES restaurants(restaurant_id),
  rank INTEGER NOT NULL CHECK(rank >= 0),
  review_id TEXT NOT NULL CHECK(length(review_id) BETWEEN 1 AND 128),
  rating REAL CHECK(rating BETWEEN 0 AND 5),
  date_raw TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,
  UNIQUE(restaurant_id, rank)
) STRICT;
"""

RESTAURANT_COLUMNS = ("restaurant_id", "title", "category", "lng", "lat", "average_rating", "review_count",
                      "collected_review_count", "source_url", "hours_json", "hours_checked_at", "hours_source_url")
REVIEW_COLUMNS = ("restaurant_id", "rank", "review_id", "rating", "date_raw", "content", "tags")


def compact_hours(hours):
    """Storage form of a parsed schedule (constant parser fields live in ``meta``)."""
    observed = hours.get("observedDates") or []
    return {"weekly": hours["weekly"], "dateClosures": hours.get("dateClosures", []),
            "observedRange": [observed[0], observed[-1]] if observed else []}


def read_only_uri(path):
    # immutable=1: never create -wal/-shm files, safe on a read-only container filesystem.
    return Path(path).resolve().as_uri() + "?mode=ro&immutable=1"


def logical_digest(connection):
    """Order-independent-of-storage SHA-256 over every row (excluding nothing)."""
    digest = hashlib.sha256()
    for table, columns, order in (("meta", ("key", "value"), "key"), ("restaurants", RESTAURANT_COLUMNS, "restaurant_id"),
                                  ("reviews", REVIEW_COLUMNS, "restaurant_id, rank")):
        if table == "meta":
            rows = connection.execute("SELECT key, value FROM meta WHERE key != 'catalogVersion' ORDER BY key")
        else:
            rows = connection.execute(f"SELECT {', '.join(columns)} FROM {table} ORDER BY {order}")
        for row in rows:
            digest.update(json.dumps([table, *row], ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
            digest.update(b"\n")
    return digest.hexdigest()


class RestaurantCatalog:
    def __init__(self, path):
        self.path = Path(path)
        self._uri = read_only_uri(self.path)
        with closing(sqlite3.connect(self._uri, uri=True)) as connection:
            meta = dict(connection.execute("SELECT key, value FROM meta"))
            if meta.get("schemaVersion") != SCHEMA_VERSION or not meta.get("catalogVersion"):
                raise ValueError("invalid_restaurant_catalog")
            rows = connection.execute(f"SELECT {', '.join(RESTAURANT_COLUMNS)} FROM restaurants ORDER BY restaurant_id").fetchall()
        self.meta = meta
        self.version = meta["catalogVersion"]
        self.hours_version = meta.get("hoursParserVersion")
        self.restaurants = []
        for row in rows:
            item = dict(zip(RESTAURANT_COLUMNS, row))
            self.restaurants.append({
                "restaurantId": item["restaurant_id"], "title": item["title"], "category": item["category"],
                "lng": item["lng"], "lat": item["lat"], "averageRating": item["average_rating"],
                "reviewCount": item["review_count"], "collectedReviewCount": item["collected_review_count"],
                "sourceUrl": item["source_url"], "hours": json.loads(item["hours_json"]),
                "hoursCheckedAt": item["hours_checked_at"], "hoursSourceUrl": item["hours_source_url"]})
        if not self.restaurants:
            raise ValueError("empty_restaurant_catalog")
        self.by_id = {item["restaurantId"]: item for item in self.restaurants}

    def reviews(self, restaurant_ids, limit=8, max_chars=400):
        """Most-recent-first review excerpts for the given restaurants (author data never stored)."""
        ids = [rid for rid in dict.fromkeys(restaurant_ids) if rid in self.by_id]
        if not ids:
            return {}
        result = {rid: [] for rid in ids}
        placeholders = ",".join("?" for _ in ids)
        with closing(sqlite3.connect(self._uri, uri=True)) as connection:
            rows = connection.execute(
                f"SELECT {', '.join(REVIEW_COLUMNS)} FROM reviews WHERE restaurant_id IN ({placeholders}) AND rank < ? ORDER BY restaurant_id, rank",
                [*ids, int(limit)]).fetchall()
        for row in rows:
            item = dict(zip(REVIEW_COLUMNS, row))
            result[item["restaurant_id"]].append({"reviewId": item["review_id"], "rating": item["rating"], "date": item["date_raw"],
                                                  "text": item["content"][:max_chars], "tags": item["tags"]})
        return result
