"""Generate and validate the source-grounded outdoor_nature batch 17 review."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/18_outdoor_nature.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_17.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
ALLOWED = {0, 0.25, 0.5, 0.75, 1}

# Every non-neutral final decision is tied to one of these direct source facts.
FACTS = {
    "1965800": "높은 오름의 등성이는 바위가 있고 정상 조망을 위해 오르는 오름으로 소개된다.",
    "1973369": "윗세오름은 영실등산 코스를 따라 이어진 한라산 서쪽 등줄기로 소개된다.",
    "1981890": "베니키아 호텔 제주는 패밀리 트윈·패밀리 트리플 객실을 안내한다.",
    "2048059": "아쿠아플라넷 제주는 해양생물 관찰, 교육적 가치, 공연을 함께 제공한다고 소개한다.",
    "2370834": "지질트레일 A코스 상세 정보는 13.2km·약 3시간 30분으로 제시된다.",
    "2382246": "제이뷰호텔은 어린 자녀 동반 가족과 어르신도 편하게 쉴 수 있는 온돌 한실을 소개한다.",
    "2390111": "동광리농촌체험마을은 눈썰매·연날리기·말 체험 등 농촌 체험 프로그램을 상시 준비한다고 소개한다.",
    "2405964": "팜밸리 풀빌라는 대형수영장과 유아수영장을 마련했다고 안내한다.",
    "2406368": "더럭펜션은 아이와 물놀이할 수 있는 키즈풀과 유아 놀이기구·장난감을 안내한다.",
    "2414812": "신산공원은 운동시설과 놀이터를 이용할 수 있는 공원으로 소개된다.",
    "2418778": "다이나믹 메이즈는 여럿이 협동해 미션을 수행하며 탈출하는 실내 놀이 공간이다.",
    "2498637": "용산 제주유스호스텔은 어린이 놀이공간과 가족·청소년 단체 이용 시설을 안내한다.",
    "2522221": "제주레포츠랜드는 가족·연인·친구와 즐길 수 있는 다양한 액티비티를 명시한다.",
    "2552837": "제주 스카브로호텔은 여름철 성인/키즈 풀장을 운영한다고 소개한다.",
    "2556500": "제주마중은 아이들이 뛰어놀 수 있는 넓은 정원과 물놀이·게잡이 체험을 소개한다.",
    "2561909": "메리어트관은 친구끼리 여행하기 좋은 커넥팅룸과 어린이 전용 수영장·놀이터를 안내한다.",
    "2571240": "제이엠그랑블루요트는 최대 91명 승선, 세일링·낚시·노래방 시설을 안내한다.",
    "2605527": "에코그린리조트는 연인과 가족이 함께 즐기기 좋은 리조트라고 직접 소개한다.",
    "2606214": "윈드1947 카트테마파크는 온 가족, 아이부터 어른까지 즐길 수 있고 코스가 안전하게 구성됐다고 안내한다.",
    "2606690": "왈종미술관은 어린이 미술교육실을 갖추고 있다고 소개한다.",
    "2609373": "9.81 파크는 아이와 함께 탑승할 수 있는 카트와 가족 추억을 명시한다.",
    "2623579": "틸다하우스는 부모와 아이 모두 함께 머물기 좋은 가족 펜션과 가족 구성에 맞는 커넥팅룸을 소개한다.",
}

# First pass; boundary review below changes only unsupported high-boundary candidates.
FIRST = {
    "1965800": {"kids": 0.25, "parents": 0.25},
    "1973369": {"kids": 0.25, "parents": 0.25},
    "1981890": {"kids": 0.75},
    "2048059": {"kids": 0.75},
    "2370834": {"kids": 0.25, "parents": 0.25},
    "2382246": {"kids": 0.75, "parents": 0.75},
    "2390111": {"kids": 0.75},
    "2405964": {"kids": 0.75},
    "2406368": {"kids": 1},
    "2414812": {"kids": 0.75},
    "2418778": {"friends": 0.75},
    "2498637": {"kids": 0.75},
    "2498717": {"couple": 0.75},
    "2516416": {"kids": 0.75},
    "2522221": {"couple": 0.75, "friends": 0.75},
    "2552837": {"kids": 0.75},
    "2556500": {"kids": 0.75},
    "2561909": {"friends": 0.75, "kids": 0.75},
    "2571240": {"friends": 0.75},
    "2605527": {"couple": 0.75, "kids": 0.75},
    "2606214": {"kids": 1},
    "2606690": {"kids": 0.75},
    "2609373": {"kids": 0.75},
    "2621914": {"solo": 0.75},
    "2623579": {"kids": 1, "parents": 1},
}
REVIEW_CHANGES = {
    ("2498717", "couple"): 0.5,  # water view and two-person pet boarding do not support couple suitability
    ("2516416", "kids"): 0.5,  # guide safety is stated, but no child age/eligibility is stated
    ("2621914", "solo"): 0.5,  # safe ferry service is not solo-specific support
}


def score_map(contentid: str, reviewed: bool) -> dict[str, float]:
    scores = {axis: 0.5 for axis in AXES}
    scores.update(FIRST.get(contentid, {}))
    if reviewed:
        for (changed_id, axis), value in REVIEW_CHANGES.items():
            if changed_id == contentid:
                scores[axis] = value
    return scores


def fact_for(row: dict) -> str:
    return FACTS.get(row["contentid"], row["source_excerpt"].split("\n", 1)[0][:180])


def label(row: dict, axis: str, value: float) -> dict:
    fact = fact_for(row)
    unknown = row["unknowns"][0] if row.get("unknowns") else "동행별 이용 조건은 unknown이다"
    if value == 0.5:
        conclusion = "동행별 직접 우대 또는 불리 근거가 부족해 상대적 보통값으로 둔다"
        confidence, level = 0.55, "contextual_inference"
    elif value < 0.5:
        conclusion = "소개된 거리·등산·바위 같은 부담 요인과 확인되지 않은 보행·연령 조건을 반영해 상대적으로 낮춘다"
        confidence, level = 0.72, "direct_evidence"
    else:
        conclusion = "이 축에 해당하는 직접 활동·가족·연령 또는 동행 근거가 있어 높게 둔다"
        confidence, level = 0.85, "direct_evidence"
    return {
        "state": "numeric",
        "value": value,
        "confidence": confidence,
        "status": "ai_draft",
        "inference_level": level,
        "rationale": f"source_excerpt는 ‘{fact}’라고 설명한다. unknowns에는 ‘{unknown}’이 확인되지 않았다고 적혀 있다. {axis} 축은 {conclusion}.",
        "evidence_ids": row["evidence_ids"],
        "rule_ids": ["COMPANION-CALIBRATION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"],
        "null_reason": None,
    }


def build(rows: list[dict]) -> list[dict]:
    return [
        {
            "contentid": row["contentid"],
            "title": row["title"],
            "source_order": row["source_order"],
            "calibration_family": row["calibration_family"],
            "companion_fit": {axis: label(row, axis, value) for axis, value in score_map(row["contentid"], True).items()},
        }
        for row in rows
    ]


def validate(rows: list[dict], output: list[dict]) -> None:
    assert len(rows) == len(output) == 50
    for source, reviewed in zip(rows, output, strict=True):
        assert [reviewed[k] for k in ("contentid", "title", "source_order", "calibration_family")] == [source[k] for k in ("contentid", "title", "source_order", "calibration_family")]
        assert set(reviewed["companion_fit"]) == set(AXES)
        for axis in AXES:
            item = reviewed["companion_fit"][axis]
            assert set(item) == {"state", "value", "confidence", "status", "inference_level", "rationale", "evidence_ids", "rule_ids", "null_reason"}
            assert item["state"] == "numeric" and item["value"] in ALLOWED
            assert item["status"] == "ai_draft" and item["null_reason"] is None
            assert item["evidence_ids"] == source["evidence_ids"]
            assert "CALIBRATED-BOUNDARY-REVIEW-V2" in item["rule_ids"]
            assert "source_excerpt" in item["rationale"] and "unknowns" in item["rationale"]


def main() -> None:
    before_hash = hashlib.sha256(INPUT.read_bytes()).hexdigest()
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line]
    output = build(rows)
    validate(rows, output)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in output) + "\n", encoding="utf-8")
    assert hashlib.sha256(INPUT.read_bytes()).hexdigest() == before_hash
    changed = sum(score_map(r["contentid"], False)[a] != score_map(r["contentid"], True)[a] for r in rows for a in AXES)
    print("input_sha256", before_hash)
    print("first_to_review_changed_axes", changed)
    for axis in AXES:
        print(axis, dict(Counter(r["companion_fit"][axis]["value"] for r in output)))
    print("same_all_five", sum(len({v["value"] for v in r["companion_fit"].values()}) == 1 for r in output))


if __name__ == "__main__":
    main()
