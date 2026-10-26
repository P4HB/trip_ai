"""Create the source-grounded Companion boundary review for outdoor batch 04."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2"
INPUT = BASE / "calibration_inputs/11_outdoor_nature.jsonl"
DRAFT = BASE / "calibration_outputs/batches/calibrated_batch_04.jsonl"
OUTPUT = BASE / "calibration_outputs/reviewed/reviewed_calibrated_batch_04.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
RULE_ID = "CALIBRATED-BOUNDARY-REVIEW-V2"


# Generic scenery/observation does not establish a 0.75 solo score. The remaining
# entries are source-excerpt boundary decisions for direct child/family evidence or
# material travel/safety friction.
OVERRIDES = {
    "126471": {"kids": 0.75},
    "126665": {"kids": 0.5},
    "127046": {"kids": 0.5},
    "127053": {"kids": 0.25},
    "127479": {"kids": 0.5},
    "127863": {"kids": 0.25, "parents": 0.25},
    "127857": {"kids": 0.5},
    "128175": {"kids": 0.75},
    "128326": {"kids": 0.5},
    "128838": {"kids": 1, "parents": 0.75},
    "129071": {"kids": 0.75},
    "128793": {"kids": 0.25, "parents": 0.25},
}

EVIDENCE_FACTS = {
    "126471": "체험가능연령은 전 연령이고 제주민요·오메기술·천연염색 체험을 안내한다",
    "127053": "파도가 심하게 일 때 높이 20m 이상 용솟음치는 장관을 연출한다고 소개한다",
    "127863": "제주에서 배로 약 1시간 30분이 걸리며 바다낚시와 추자올레를 경험할 수 있다고 소개한다",
    "128175": "산책로·야영장·어린이놀이터·족구장 등을 갖춘 휴양림으로 소개한다",
    "128838": "단체관광·신혼여행과 어린이를 동반한 가족단위 여행객에게 인기 있다고 소개한다",
    "129071": "가족 단위 관광지로 적합하고 올레 2코스 산책·식산봉 조망·유람선·낚시를 할 수 있다고 소개한다",
    "128793": "무인도이며 낚시 포인트와 다이버들에게 알려진 수중 아치를 소개한다",
}


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def source_fact(row: dict) -> str:
    text = " ".join(row["source_excerpt"].split())
    sentence = text.split(".", 1)[0].strip()
    if len(sentence) < 24:
        sentence = text[:280].strip()
    return sentence[:360]


def rationale(axis: str, value: float, fact: str, unknowns: list[str]) -> str:
    unknown = unknowns[0] if unknowns else "동행별 추가 조건"
    if value == 1:
        decision = f"{axis} 축의 직접 대상·체험 근거가 있어 최고 적합도로 판정했다"
    elif value == 0.75:
        decision = f"{axis} 축에서 실제 이용·체험 또는 대상 근거가 있어 높은 적합도로 판정했다"
    elif value == 0.25:
        decision = f"{axis} 축에는 원문상 이동·안전 또는 이용 마찰이 있어 낮은 적합도로 판정했다"
    elif value == 0:
        decision = f"{axis} 축에는 대표 경험과의 부합이 가장 낮아 상대적 최저점으로 판정했다"
    else:
        decision = f"{axis} 동행을 직접 대상으로 한 근거가 부족해 보통 적합도로 판정했다"
    return f"source_excerpt는 ‘{fact}’라고 소개한다. {decision}. 추가 미확인 사항: {unknown}."


def main() -> None:
    inputs = read_jsonl(INPUT)
    drafts = {row["contentid"]: row for row in read_jsonl(DRAFT)}
    output_rows = []
    for row in inputs:
        draft = drafts[row["contentid"]]
        fact = EVIDENCE_FACTS.get(row["contentid"], source_fact(row))
        values = {axis: draft["companion_fit"][axis]["value"] for axis in AXES}
        values["solo"] = 0.5
        values.update(OVERRIDES.get(row["contentid"], {}))
        companion_fit = {}
        for axis in AXES:
            label = dict(draft["companion_fit"][axis])
            value = values[axis]
            label["value"] = value
            label["confidence"] = 0.9 if value == 1 else 0.8 if value in (0.75, 0.25, 0) else 0.6
            label["inference_level"] = "direct_evidence" if value in (1, 0.75, 0.25, 0) else "limited_direct_evidence"
            label["rationale"] = rationale(axis, value, fact, row.get("unknowns", []))
            label["rule_ids"] = list(dict.fromkeys([*label.get("rule_ids", []), RULE_ID]))
            companion_fit[axis] = label
        output_rows.append({
            "contentid": row["contentid"],
            "title": row["title"],
            "source_order": row["source_order"],
            "calibration_family": row["calibration_family"],
            "companion_fit": companion_fit,
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="\n") as file:
        for row in output_rows:
            file.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
