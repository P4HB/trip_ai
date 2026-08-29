#!/usr/bin/env python3
"""Build the evidence-backed SPEC-022 Kakao labeling candidate queue."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


INVENTORY_FIELDS = [
    "place_id",
    "name",
    "url",
    "average_rating_5",
    "visitor_review_count",
    "blog_review_count",
]
CROSSWALK_FIELDS = [
    "place_id",
    "canonical_id",
    "name",
    "url",
    "inventory_source",
    "overlap_status",
    "existing_contentids",
    "match_sources",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SPEC-022 신규 Kakao 라벨링 큐 생성")
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
        "--map-bundle", type=Path, default=Path("map-ui/data/jeju-places.js")
    )
    parser.add_argument(
        "--crosswalk",
        type=Path,
        default=Path(
            "data/kakao/jeju/2026-08-20/db-place-backfill/place_crosswalk.csv"
        ),
    )
    parser.add_argument(
        "--terra-agreed",
        type=Path,
        default=Path(
            "data/kakao/jeju/2026-08-20/db-place-backfill/ai-adjudication/ai_agreed.csv"
        ),
    )
    parser.add_argument(
        "--final-review",
        type=Path,
        default=Path(
            "data/kakao/jeju/2026-08-20/db-place-backfill/ai-adjudication/"
            "sol-review/human-review/final_review_results.csv"
        ),
    )
    parser.add_argument(
        "--fd05-crosswalk",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/"
            "fd05-crosswalk/place_crosswalk.csv"
        ),
    )
    parser.add_argument(
        "--fd05-adjudication-dir",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/"
            "fd05-adjudication/terra"
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/labeling/jeju/2026-08-24/kakao-place-label-v1"),
    )
    parser.add_argument("--expected-count", type=int, default=2374)
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_inventory(path: Path, source: str) -> list[dict[str, str]]:
    rows = read_csv(path)
    if list(rows[0]) != INVENTORY_FIELDS if rows else True:
        raise ValueError(f"인벤토리 필드가 다릅니다: {path}")
    ids = [(row.get("place_id") or "").strip() for row in rows]
    if any(not value for value in ids) or len(ids) != len(set(ids)):
        raise ValueError(f"빈 값 또는 중복 place_id가 있습니다: {path}")
    return [
        {
            **{field: (row.get(field) or "").strip() for field in INVENTORY_FIELDS},
            "inventory_source": source,
        }
        for row in rows
    ]


def load_map_ready_ids(path: Path) -> set[str]:
    prefix = "window.JEJU_PLACES = "
    places: list[dict[str, Any]] | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            places = json.loads(line[len(prefix) :].removesuffix(";"))
            break
    if places is None:
        raise ValueError(f"JEJU_PLACES를 찾을 수 없습니다: {path}")

    ready: set[str] = set()
    for place in places:
        labels = (place.get("v5") or {}).get("labels") or []
        fit = place.get("fit") or {}
        atomic = [
            record
            for record in labels
            if str(record.get("label", "")).startswith(
                ("theme.", "environment.", "style_evidence.")
            )
            and isinstance(record.get("value"), (int, float))
        ]
        if len(atomic) == 18 and len(fit.get("companion") or []) == 5 and len(
            fit.get("month") or []
        ) == 12:
            ready.add(str(place["id"]))
    if len(ready) != 1663:
        raise ValueError(f"추천 가능 장소가 1,663개가 아닙니다: {len(ready)}")
    return ready


def add_relation(
    relations: dict[str, list[tuple[str, str]]],
    place_id: str,
    contentid: str,
    source: str,
    inventory_ids: set[str],
    ready_ids: set[str],
) -> None:
    place_id = (place_id or "").strip()
    contentid = (contentid or "").strip()
    if place_id in inventory_ids and contentid in ready_ids:
        relations[place_id].append((contentid, source))


def load_fd05_adjudications(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for file_path in sorted(path.glob("*.json"), key=lambda item: item.name):
        record = json.loads(file_path.read_text(encoding="utf-8"))
        if str(record.get("contentid")) != file_path.stem:
            raise ValueError(f"FD05 판정 contentid가 파일명과 다릅니다: {file_path}")
        if record.get("decision") not in {
            "same_place",
            "different_place",
            "subordinate_facility",
            "unresolved",
        }:
            raise ValueError(f"FD05 판정값이 잘못됐습니다: {file_path}")
        records.append(record)
    return records


def write_csv(path: Path, fields: list[str], rows: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    initial = load_inventory(args.initial_inventory, "spec-020")
    backfill = load_inventory(args.backfill_inventory, "spec-021")
    inventory = initial + backfill
    inventory_ids = {row["place_id"] for row in inventory}
    if len(inventory_ids) != len(inventory):
        raise ValueError("두 Kakao 인벤토리 사이에 중복 place_id가 있습니다")
    if len(inventory) != 3665:
        raise ValueError(f"Kakao 합집합이 3,665개가 아닙니다: {len(inventory)}")

    ready_ids = load_map_ready_ids(args.map_bundle)
    relations: dict[str, list[tuple[str, str]]] = defaultdict(list)

    for row in read_csv(args.crosswalk):
        if row.get("status") in {"matched_existing", "matched_new"}:
            add_relation(
                relations,
                row.get("kakao_place_id", ""),
                row.get("contentid", ""),
                f"spec-021:{row.get('status')}",
                inventory_ids,
                ready_ids,
            )
    for row in read_csv(args.terra_agreed):
        if row.get("decision") == "same_place":
            add_relation(
                relations,
                row.get("selected_kakao_place_id", ""),
                row.get("contentid", ""),
                "spec-021:terra-same-place",
                inventory_ids,
                ready_ids,
            )
    for row in read_csv(args.final_review):
        if row.get("final_decision") == "same_place":
            add_relation(
                relations,
                row.get("selected_kakao_place_id", ""),
                row.get("contentid", ""),
                "spec-021:final-same-place",
                inventory_ids,
                ready_ids,
            )

    for row in read_csv(args.fd05_crosswalk):
        if row.get("status") == "matched_existing":
            add_relation(
                relations,
                row.get("kakao_place_id", ""),
                row.get("contentid", ""),
                "spec-022:fd05-matched-existing",
                inventory_ids,
                ready_ids,
            )

    fd05_adjudications = load_fd05_adjudications(args.fd05_adjudication_dir)
    for row in fd05_adjudications:
        if row.get("decision") == "same_place":
            add_relation(
                relations,
                str(row.get("selected_kakao_place_id") or ""),
                str(row.get("contentid") or ""),
                "spec-022:fd05-terra-same-place",
                inventory_ids,
                ready_ids,
            )

    candidate_rows: list[dict[str, Any]] = []
    crosswalk_rows: list[dict[str, Any]] = []
    for row in inventory:
        place_id = row["place_id"]
        matches = relations.get(place_id, [])
        contentids = sorted({contentid for contentid, _source in matches}, key=int)
        sources = sorted({source for _contentid, source in matches})
        overlap = bool(matches)
        crosswalk_rows.append(
            {
                "place_id": place_id,
                "canonical_id": f"kakao:{place_id}",
                "name": row["name"],
                "url": row["url"],
                "inventory_source": row["inventory_source"],
                "overlap_status": "existing_ready" if overlap else "candidate_new",
                "existing_contentids": "|".join(contentids),
                "match_sources": "|".join(sources),
            }
        )
        if not overlap:
            candidate_rows.append(
                {
                    "schema_version": "kakao-place-labeling-queue-v1",
                    "canonical_id": f"kakao:{place_id}",
                    "provider": "kakao",
                    "place_id": place_id,
                    "name": row["name"],
                    "url": row["url"],
                    "average_rating_5": row["average_rating_5"],
                    "visitor_review_count": row["visitor_review_count"],
                    "blog_review_count": row["blog_review_count"],
                    "inventory_source": row["inventory_source"],
                    "queue_status": "pending_count_validation",
                }
            )

    actual_count = len(candidate_rows)
    mismatch = actual_count != args.expected_count
    for row in candidate_rows:
        row["queue_status"] = "candidate_count_mismatch" if mismatch else "ready"

    crosswalk_path = args.output_dir / "candidate_crosswalk.csv"
    queue_path = args.output_dir / (
        "provisional_labeling_queue.jsonl" if mismatch else "labeling_queue.jsonl"
    )
    write_csv(crosswalk_path, CROSSWALK_FIELDS, crosswalk_rows)
    write_jsonl(queue_path, candidate_rows)

    report = {
        "contract": "kakao-place-labeling-queue-audit-v1",
        "status": "candidate_count_mismatch" if mismatch else "ready",
        "expected_candidate_count": args.expected_count,
        "actual_candidate_count": actual_count,
        "difference": actual_count - args.expected_count,
        "counts": {
            "initial_inventory": len(initial),
            "backfill_inventory": len(backfill),
            "inventory_union": len(inventory),
            "existing_recommendation_ready": len(ready_ids),
            "approved_overlap_kakao_ids": len(relations),
            "fd05_adjudication_results": len(fd05_adjudications),
        },
        "inputs": {
            str(path): sha256(path)
            for path in [
                args.initial_inventory,
                args.backfill_inventory,
                args.map_bundle,
                args.crosswalk,
                args.terra_agreed,
                args.final_review,
                args.fd05_crosswalk,
            ]
        },
        "outputs": {
            str(crosswalk_path): sha256(crosswalk_path),
            str(queue_path): sha256(queue_path),
        },
        "labeling_allowed": not mismatch,
    }
    report_path = args.output_dir / "candidate_count_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))
    if mismatch:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
