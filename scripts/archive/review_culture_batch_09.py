"""Build the source-grounded Companion boundary review for culture batch 09."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/08_culture_exhibition.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_09.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# The recorded first pass is only used to calculate audit statistics.  Boundary
# review removes unsupported social highs and accepts direct evidence where it
# exists; only the final scores are emitted.
FIRST_PASS = {
    "2931932": {"friends": 0.75, "kids": 0.75},
    "2933508": {"solo": 0.75, "kids": 0.75},
    "3005374": {"solo": 0.75},
    "3015632": {"couple": 0.75, "friends": 0.75, "kids": 0.75},
    "3037623": {"friends": 0.75},
    "3083715": {"solo": 0.75},
    "3080405": {"kids": 1},
    "3329719": {"kids": 0.75},
    "3439423": {"kids": 1},
    "3546163": {"kids": 1},
    "3559559": {"solo": 0.75},
}

# Values above 0.5 have a direct child/family activity or explicit friends
# statement in the supplied excerpt. All unspecified axes stay neutral.
FINAL_OVERRIDES = {
    "2931932": {"friends": 1, "kids": 0.75},
    "2933508": {"kids": 0.75},
    "3015632": {"kids": 0.75},
    "3080405": {"kids": 1},
    "3329719": {"kids": 0.75},
    "3439423": {"kids": 1},
    "3546163": {"kids": 1},
}

DIRECT_REASONS = {
    ("2931932", "friends"): "소개가 친구와 가족과 함께 전시품을 보며 추억을 남기기 좋다고 직접 명시하므로 friends 최고 적합도로 유지했다.",
    ("2931932", "kids"): "소개가 가족과 함께 전시품을 보며 추억을 남기기 좋다고 명시하므로, 연령·안전 조건은 unknown인 상태에서 kids 높은 적합도로 판정했다.",
    ("2933508", "kids"): "어린이 건축 놀이터가 있다고 직접 안내하므로, 세부 연령·접근 조건은 unknown인 상태에서 kids 높은 적합도로 판정했다.",
    ("3015632", "kids"): "온실·감귤 따기 체험이 대표 경험으로 안내되므로, 연령·접근성은 unknown인 상태에서 kids 높은 적합도로 판정했다.",
    ("3080405", "kids"): "아이들이 캔디체험학습장에서 수제캔디를 자르고 롤리팝을 직접 만든다고 명시하므로 kids 최고 적합도로 판정했다.",
    ("3329719", "kids"): "누구나 재난을 경험하고 극복법을 배우는 다양한 안전체험 프로그램을 갖춘다고 안내하므로, 연령 조건은 unknown인 상태에서 kids 높은 적합도로 판정했다.",
    ("3439423", "kids"): "아이들이 뛰어노는 16가지 놀이와 미디어 체험을 갖춘 공간이라고 직접 명시하므로 kids 최고 적합도로 판정했다.",
    ("3546163", "kids"): "아이들이 책을 가까이하고 상상할 수 있는 공간을 목표로 만든 학교·마을도서관이라고 명시하므로 kids 최고 적합도로 판정했다.",
}


def source_fact(excerpt: str) -> str:
    return excerpt.split("\n{")[0].replace("\n", " ").strip()[:300]


def make_axis(row: dict, axis: str, value: float) -> dict:
    fact = source_fact(row["source_excerpt"])
    unknown = "; ".join(row["unknowns"]) or "동행별 추가 조건"
    if row["calibration_family"] == "cafe_unknown_intro":
        value, confidence, level = 0.5, 0.3, "unknown"
        decision = "소개 원문이 없어 cafe_unknown_intro 예외에 따라 보수적으로 0.5로 유지했다."
    elif (row["contentid"], axis) in DIRECT_REASONS:
        confidence, level = (0.9, "direct") if value == 1 else (0.78, "source_grounded")
        decision = DIRECT_REASONS[(row["contentid"], axis)]
    else:
        confidence, level = 0.62, "source_grounded"
        decision = (
            f"{axis}에 대한 직접 대상·안전·보행·사회 활동 근거가 소개에 없어, "
            "단순 관람·경관·쇼핑만으로 높은 적합도를 추정하지 않고 상대적 보통값 0.5로 판정했다."
        )
    return {
        "state": "numeric",
        "value": value,
        "confidence": confidence,
        "status": "ai_draft",
        "inference_level": level,
        "rationale": f"source_excerpt 사실: {fact} unknowns: {unknown}. {decision}",
        "evidence_ids": row["evidence_ids"],
        "rule_ids": ["CALIBRATED-BOUNDARY-REVIEW-V2", "POLICY-CULTURE-EXHIBITION"],
        "null_reason": None,
    }


def main() -> None:
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines()]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            values = {axis: 0.5 for axis in AXES}
            values.update(FINAL_OVERRIDES.get(row["contentid"], {}))
            output = {key: row[key] for key in ("contentid", "title", "source_order", "calibration_family")}
            output["companion_fit"] = {axis: make_axis(row, axis, values[axis]) for axis in AXES}
            handle.write(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
