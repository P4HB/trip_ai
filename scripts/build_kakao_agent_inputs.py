#!/usr/bin/env python3
"""Build reviewer-identity-free place packets for SPEC-022 label agents."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kakao 장소별 Terra 라벨링 입력 생성")
    parser.add_argument(
        "--queue",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/labeling_queue.jsonl"
        ),
    )
    parser.add_argument(
        "--reviews",
        type=Path,
        action="append",
        default=None,
        help="반복 지정 가능",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(
            "data/labeling/jeju/2026-08-24/kakao-place-label-v1/agent-inputs"
        ),
    )
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=10)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def load_reviews(paths: list[Path]) -> dict[str, list[dict[str, str]]]:
    by_place: dict[str, list[dict[str, str]]] = defaultdict(list)
    for path in paths:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                place_id = (row.get("place_id") or "").strip()
                content = (row.get("content") or "").strip()
                if not place_id or not content:
                    continue
                by_place[place_id].append(
                    {
                        "date": (row.get("date") or "").strip(),
                        "content": content,
                        "tags": (row.get("tags") or "").strip(),
                    }
                )
    return by_place


def main() -> None:
    args = parse_args()
    review_paths = args.reviews or [
        Path("data/kakao/jeju/2026-08-19/reviews.csv"),
        Path("data/kakao/jeju/2026-08-20/db-place-backfill/reviews.csv"),
    ]
    queue = read_jsonl(args.queue)
    if len(queue) != 2374:
        raise ValueError(f"라벨링 큐가 2,374개가 아닙니다: {len(queue)}")
    if args.offset < 0 or args.limit < 1 or args.offset + args.limit > len(queue):
        raise ValueError("offset/limit 범위가 잘못됐습니다")

    reviews = load_reviews(review_paths)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    selected = queue[args.offset : args.offset + args.limit]
    written: list[dict[str, Any]] = []
    for queue_index, place in enumerate(selected, start=args.offset):
        place_id = str(place["place_id"])
        packet = {
            "schema_version": "kakao-place-label-agent-input-v1",
            "queue_index": queue_index,
            "model": "gpt-5.6-terra",
            "reasoning_effort": "medium",
            "contract_path": "config/kakao_place_label_contract.v1.json",
            "output_path": (
                "data/labeling/jeju/2026-08-24/kakao-place-label-v1/"
                f"agent-results/{place_id}.json"
            ),
            "place": place,
            "kakao_review_evidence": reviews.get(place_id, []),
            "instructions": [
                "장소 한 곳만 판정한다.",
                "먼저 identity와 eligibility를 판정한다.",
                "eligible이면 계약의 원자 18축, companion 5축, month 12축을 생성한다.",
                "companion state는 numeric, month state는 numeric 또는 not_applicable만 사용한다.",
                "derived 6축은 생성하지 않는다. 메인 validator가 재계산한다.",
                "Kakao 평점과 리뷰 수는 라벨값 근거로 사용하지 않는다.",
                "공식·공공 상세 출처를 우선 조사하고 URL, publisher, checked_at, facts를 기록한다.",
                "공개 리뷰 작성자 정체를 출력하지 않는다.",
                "직접 근거 없는 0과 1은 사용하지 않는다.",
                "근거 부족 fallback은 confidence 0.25, status fallback으로 기록한다.",
                "hard constraint는 fit 점수와 분리한다.",
            ],
        }
        output_path = args.output_dir / f"{place_id}.json"
        output_path.write_text(
            json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        written.append(
            {
                "queue_index": queue_index,
                "place_id": place_id,
                "name": place["name"],
                "review_count": len(packet["kakao_review_evidence"]),
                "path": str(output_path),
            }
        )
    print(json.dumps(written, ensure_ascii=False))


if __name__ == "__main__":
    main()
