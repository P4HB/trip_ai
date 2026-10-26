"""Generate and validate the source-grounded Companion review for outdoor batch 13."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2"
INPUT = BASE / "calibration_inputs/14_outdoor_nature.jsonl"
OUTPUT = BASE / "calibration_outputs/reviewed/reviewed_calibrated_batch_13.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
ALLOWED = {0, 0.25, 0.5, 0.75, 1}

# Omitted axes intentionally remain neutral: social suitability is never inferred.
SPECIAL = {
    "600584": ({"kids": 0.75}, "실내·실외 수영장과 슬라이드의 물놀이 시설"),
    "637398": ({"kids": 1, "parents": 1}, "어린아이부터 노인까지 함께 즐기는 가족형 레저 스포츠"),
    "733422": ({"kids": 0.75}, "페밀리 룸이 준비된 객실"),
    "733622": ({"solo": 0.75}, "정자에 앉아 책을 읽는 활동"),
    "733784": ({"friends": 0.75, "kids": 0.75}, "가족·친구·이웃들과 산책하고 골프연습을 할 수 있음"),
    "733924": ({"kids": 0.75}, "조개 밭 체험과 조개 잡는 도구 대여"),
    "780778": ({"couple": 0.75, "friends": 0.75, "kids": 0.75}, "친구·가족과 함께 방문하기 좋고 연인을 위한 체험도 명시됨"),
    "824619": ({"solo": 0.75, "kids": 0.25, "parents": 0.25}, "기상변화와 강풍 때문에 장비 없이 트레킹하면 위험할 수 있음"),
    "879633": ({"kids": 1}, "체험학습자의 연령별·인지 정도에 따른 염색체험 운영"),
    "905600": ({"kids": 0.75, "parents": 0.75}, "아이들과 어른들이 물놀이할 수 있는 풀장"),
    "976820": ({"kids": 0.75, "parents": 0.75}, "노인을 비롯한 아이들까지 애용하는 시장"),
    "984523": ({"kids": 0.75}, "가족형 휴양 골프 리조트와 키즈룸"),
}

# First-pass-only overcalls retained solely to audit the boundary reread.
FIRST_ONLY = {"780778": {"couple": 1}, "905600": {"couple": 0.75, "friends": 0.75}}


def source_fact(record: dict) -> str:
    return record["source_excerpt"].split("\n{", 1)[0].replace("\n", " ").strip()[:260]


def label(record: dict, value: float, special: str | None) -> dict:
    unknowns = record.get("unknowns") or []
    unknown = unknowns[0] if unknowns else "동행별 이용 조건"
    if value == 0.5:
        rationale = (f"source_excerpt는 ‘{source_fact(record)}’라고 설명하고, unknowns에는 ‘{unknown}’이 확인되지 않았다고 적혀 있다. "
                     "동행별 직접 우대 또는 불리 근거가 부족하므로 상대적 보통값으로 둔다.")
        confidence, level = 0.55, "contextual_inference"
    else:
        direction = "상향" if value > 0.5 else "하향"
        rationale = (f"source_excerpt의 사실은 ‘{special}’이며, unknowns에는 ‘{unknown}’이 확인되지 않았다. "
                     f"이 축에만 해당 사실을 반영해 상대적으로 {direction}했고, 소개에 없는 사회성·접근성은 추가 추정하지 않는다.")
        confidence, level = 0.78, "direct_evidence"
    return {"state": "numeric", "value": value, "confidence": confidence, "status": "ai_draft",
            "inference_level": level, "rationale": rationale, "evidence_ids": record["evidence_ids"],
            "rule_ids": ["COMPANION-CALIBRATION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"], "null_reason": None}


def build(first_pass: bool = False) -> list[dict]:
    rows = []
    for record in map(json.loads, INPUT.read_text(encoding="utf-8").splitlines()):
        scores, fact = SPECIAL.get(record["contentid"], ({}, None))
        scores = dict(scores)
        if first_pass:
            scores.update(FIRST_ONLY.get(record["contentid"], {}))
        rows.append({key: record[key] for key in ("contentid", "title", "source_order", "calibration_family")} |
                    {"companion_fit": {axis: label(record, scores.get(axis, 0.5), fact) for axis in AXES}})
    return rows


def validate(rows: list[dict]) -> None:
    source = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == len(source) == 50
    for row, original in zip(rows, source):
        assert all(row[key] == original[key] for key in ("contentid", "title", "source_order", "calibration_family"))
        assert set(row["companion_fit"]) == set(AXES)
        for axis in AXES:
            item = row["companion_fit"][axis]
            assert item["state"] == "numeric" and item["value"] in ALLOWED
            assert item["status"] == "ai_draft" and item["null_reason"] is None
            assert item["evidence_ids"] == original["evidence_ids"]
            assert "CALIBRATED-BOUNDARY-REVIEW-V2" in item["rule_ids"] and item["rationale"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows = build()
    validate(rows)
    if not args.check:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
    first = build(first_pass=True)
    changed = sum(first[i]["companion_fit"][axis]["value"] != rows[i]["companion_fit"][axis]["value"] for i in range(len(rows)) for axis in AXES)
    print({axis: dict(Counter(row["companion_fit"][axis]["value"] for row in rows)) for axis in AXES})
    print({"same_all_five": sum(len({item["value"] for item in row["companion_fit"].values()}) == 1 for row in rows), "boundary_changes": changed})


if __name__ == "__main__":
    main()
