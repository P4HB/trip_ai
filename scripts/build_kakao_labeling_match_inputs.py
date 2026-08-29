#!/usr/bin/env python3
"""Build deterministic inputs for SPEC-022's missing existing-place matches."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any


INVENTORY_FIELDS = [
    "place_id",
    "name",
    "url",
    "average_rating_5",
    "visitor_review_count",
    "blog_review_count",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SPEC-022 Kakao 합집합과 기존 추천 FD05 매칭 DB 생성"
    )
    parser.add_argument(
        "--initial-inventory",
        type=Path,
        default=Path("data/kakao/jeju/2026-08-19/places.csv"),
    )
    parser.add_argument(
        "--backfill-inventory",
        type=Path,
        default=Path(
            "data/kakao/jeju/2026-08-20/db-place-backfill/final_review_queue.csv"
        ),
    )
    parser.add_argument(
        "--map-bundle",
        type=Path,
        default=Path("map-ui/data/jeju-places.js"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/match-inputs"
        ),
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_inventory(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != INVENTORY_FIELDS:
            raise ValueError(f"인벤토리 필드가 다릅니다: {path}: {reader.fieldnames}")
        rows = [{field: (row.get(field) or "").strip() for field in INVENTORY_FIELDS} for row in reader]
    ids = [row["place_id"] for row in rows]
    if any(not place_id for place_id in ids) or len(ids) != len(set(ids)):
        raise ValueError(f"빈 값 또는 중복 place_id가 있습니다: {path}")
    return rows


def load_map_places(path: Path) -> list[dict[str, Any]]:
    prefix = "window.JEJU_PLACES = "
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return json.loads(line[len(prefix) :].removesuffix(";"))
    raise ValueError(f"JEJU_PLACES를 찾을 수 없습니다: {path}")


def is_recommendation_ready(place: dict[str, Any]) -> bool:
    v5 = place.get("v5") or {}
    labels = v5.get("labels") or []
    fit = place.get("fit") or {}
    companion = fit.get("companion") or []
    month = fit.get("month") or []
    atomic_count = sum(
        str(record.get("label", "")).startswith(
            ("theme.", "environment.", "style_evidence.")
        )
        and isinstance(record.get("value"), (int, float))
        for record in labels
    )
    return atomic_count == 18 and len(companion) == 5 and len(month) == 12


def write_inventory(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=INVENTORY_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_match_database(path: Path, places: list[dict[str, Any]]) -> None:
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            CREATE TABLE places (
                contentid TEXT PRIMARY KEY,
                source_order INTEGER NOT NULL,
                contenttypeid TEXT NOT NULL,
                title TEXT NOT NULL,
                address TEXT NOT NULL,
                longitude REAL,
                latitude REAL
            )
            """
        )
        connection.executemany(
            """
            INSERT INTO places (
                contentid, source_order, contenttypeid, title, address,
                longitude, latitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    str(place["id"]),
                    int(place["sourceOrder"]),
                    str(place["type"]),
                    str(place["title"]),
                    str(place.get("address") or ""),
                    place.get("lng"),
                    place.get("lat"),
                )
                for place in places
            ],
        )
        connection.commit()
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    initial = read_inventory(args.initial_inventory)
    backfill = read_inventory(args.backfill_inventory)
    initial_ids = {row["place_id"] for row in initial}
    backfill_ids = {row["place_id"] for row in backfill}
    overlap = initial_ids & backfill_ids
    if overlap:
        raise ValueError(f"두 Kakao 인벤토리에 중복 ID가 있습니다: {len(overlap)}")

    combined = initial + backfill
    combined_path = args.output_dir / "kakao_places_all_3665.csv"
    write_inventory(combined_path, combined)

    recommendation_ready = [
        place for place in load_map_places(args.map_bundle) if is_recommendation_ready(place)
    ]
    cafes = [place for place in recommendation_ready if str(place.get("type")) == "39"]
    if len(recommendation_ready) != 1663:
        raise ValueError(
            f"추천 가능 장소가 1,663개가 아닙니다: {len(recommendation_ready)}"
        )
    if len(cafes) != 230:
        raise ValueError(f"추천 가능 FD05 카페가 230개가 아닙니다: {len(cafes)}")

    database_path = args.output_dir / "existing_ready_fd05_230.sqlite3"
    write_match_database(database_path, cafes)

    manifest = {
        "contract": "kakao-labeling-match-input-v1",
        "inputs": {
            "initial_inventory": str(args.initial_inventory),
            "initial_sha256": sha256(args.initial_inventory),
            "backfill_inventory": str(args.backfill_inventory),
            "backfill_sha256": sha256(args.backfill_inventory),
            "map_bundle": str(args.map_bundle),
            "map_bundle_sha256": sha256(args.map_bundle),
        },
        "counts": {
            "initial": len(initial),
            "backfill": len(backfill),
            "inventory_overlap": len(overlap),
            "combined": len(combined),
            "recommendation_ready": len(recommendation_ready),
            "recommendation_ready_fd05": len(cafes),
        },
        "outputs": {
            "combined_inventory": str(combined_path),
            "combined_inventory_sha256": sha256(combined_path),
            "fd05_database": str(database_path),
            "fd05_database_sha256": sha256(database_path),
        },
    }
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
