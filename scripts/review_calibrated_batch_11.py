"""Create source-grounded companion boundary-review labels for batch 11."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/12_outdoor_nature.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_11.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# First-pass values were re-read at every 0.25/0.5/0.75/1 boundary.  Entries
# omitted here remain the source-grounded neutral 0.5 baseline.
VALUES = {
    "129145": {"kids": .75}, "129147": {"kids": .75}, "129148": {"kids": .75},
    "129405": {"kids": .25}, "129617": {"kids": .25, "parents": .25},
    "130088": {"kids": .75}, "130193": {"parents": .75},
    "131107": {"couple": 1, "friends": 1, "kids": .75, "parents": .75},
    "131268": {"solo": .75, "kids": .25, "parents": .25},
    "131269": {"solo": .75, "kids": .25, "parents": .25},
    "131546": {"solo": .75, "kids": .25, "parents": .25},
    "131549": {"solo": .75, "kids": .75},
    "131589": {"solo": .75, "kids": 1, "parents": 1},
    "131596": {"solo": .75, "kids": .75, "parents": .75},
    "131623": {"solo": .75, "kids": 0, "parents": .25},
    "131644": {"kids": .75}, "131708": {"solo": .75, "kids": .25, "parents": .25},
    "131836": {"solo": .75, "kids": .25}, "137476": {"kids": .75},
}

REASONS = {
    ("129145", "kids"): "세계 등대 모형과 세계 전도를 보여 주어 아이들에게도 학습 관람 근거가 있다.",
    ("129147", "kids"): "등대 공원의 홍보 전시실·3D체험관·등대 모형 전시가 안내되어 있다.",
    ("129148", "kids"): "학생들의 등대 탐방 체험 장소로 인기 있다고 직접 소개한다.",
    ("129405", "kids"): "차가운 물을 맞는 물맞이 장소로 소개되어 아동 안전 조건이 확인되지 않는다.",
    ("129617", "kids"): "담수와 해수가 만나는 깊은 웅덩이와 깊은 수심이 소개되어 있다.",
    ("129617", "parents"): "담수와 해수가 만나는 깊은 웅덩이와 깊은 수심이 소개되어 있다.",
    ("130088", "kids"): "학생에게 전통문화 체험 기회를 확대하기 위해 만든 교육 특화 박물관이라고 직접 안내한다.",
    ("130193", "parents"): "어르신동아리와 어르신문화콘텐츠를 운영한다고 직접 안내한다.",
    ("131107", "couple"): "함께 온 친구·연인·가족과 낚시할 수 있다고 직접 소개한다.",
    ("131107", "friends"): "함께 온 친구·연인·가족과 낚시할 수 있다고 직접 소개한다.",
    ("131107", "kids"): "함께 온 가족과의 배낚시와 초보자도 고기가 잘 잡힌다고 직접 소개한다.",
    ("131107", "parents"): "함께 온 가족과의 배낚시와 초보자도 고기가 잘 잡힌다고 직접 소개한다.",
    ("131546", "kids"): "초보자도 교관 도움으로 평보부터 구보까지 경험하지만 아동 연령·안전 조건은 unknown이다.",
    ("131546", "parents"): "초보자도 교관 도움으로 평보부터 구보까지 경험하지만 고령자 이용 마찰은 unknown이다.",
    ("131549", "kids"): "초보자 기본 교육, 기수 동행, 안전하게 즐길 수 있다는 승마체험 근거가 있다.",
    ("131589", "kids"): "아이들이 말 먹이주기와 승마로 자연과 교감하고 초원에서 뛰놀 수 있다고 직접 안내한다.",
    ("131589", "parents"): "부모님이 카페 공간에서 편안하게 여유를 느낄 수 있다고 직접 안내한다.",
    ("131596", "kids"): "남녀노소 모든 연령이 즐기며 초보자도 교관 지도 아래 배운다고 직접 안내한다.",
    ("131596", "parents"): "남녀노소 모든 연령이 즐기며 초보자도 교관 지도 아래 배운다고 직접 안내한다.",
    ("131623", "kids"): "낙하산을 타고 30~200m 상공에서 즐기는 해양레포츠여서 아동 연령·신체 조건이 unknown이다.",
    ("131623", "parents"): "낙하산을 타고 30~200m 상공에서 즐기는 해양레포츠여서 고령자 이용 조건이 unknown이다.",
    ("131644", "kids"): "청소년의 자치활동·문화축제·봉사활동 프로그램과 음악·공연·농구 시설을 직접 안내한다.",
    ("131708", "kids"): "해안절벽을 따른 골프 라운딩이 대표 경험이며 아동 연령·안전 조건은 unknown이다.",
    ("131708", "parents"): "해안절벽을 따른 골프 라운딩이 대표 경험이며 고령자 보행·이용 마찰은 unknown이다.",
    ("131836", "kids"): "바지선에서 하는 관광 낚시이며 아동 안전·보호자 조건은 unknown이다.",
    ("137476", "kids"): "수학여행의 편리한 입지라고 직접 소개하고 객실 최대 인원이 3·5·8명으로 안내된다.",
}


def source_fact(row):
    text = row["source_excerpt"].split("\n{")[0].split("\n")[0]
    return text[:180].rstrip(".…")


def axis_label(row, axis):
    value = VALUES.get(row["contentid"], {}).get(axis, .5)
    fact = REASONS.get((row["contentid"], axis), f"소개는 ‘{source_fact(row)}’라고 안내한다.")
    unknown = "; ".join(row["unknowns"]) or "동행별 추가 조건은 unknown이다"
    if value == .5:
        conclusion = f"{axis} 동행을 직접 대상으로 한 충분한 근거가 없어 보통 적합도로 판정했다."
        level, confidence = "limited_direct_evidence", .6
    elif value >= .75:
        conclusion = "소개에 해당 동행의 활동·대상 근거가 있어 경계 재검토 후 높은 적합도로 유지했다."
        level, confidence = "direct_evidence", .8
    else:
        conclusion = "소개된 활동의 안전·강도 또는 이용 마찰 때문에 경계 재검토 후 낮은 적합도로 판정했다."
        level, confidence = "direct_constraint", .75
    return {
        "state": "numeric", "value": value, "confidence": confidence,
        "status": "ai_draft", "inference_level": level,
        "rationale": f"source_excerpt 사실: {fact} unknown: {unknown}. {conclusion}",
        "evidence_ids": row["evidence_ids"],
        "rule_ids": ["CALIBRATED-DIRECT-COMPANION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"],
        "null_reason": None,
    }


def main():
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line.strip()]
    result = []
    for row in rows:
        result.append({key: row[key] for key in ("contentid", "title", "source_order", "calibration_family")}
                      | {"companion_fit": {axis: axis_label(row, axis) for axis in AXES}})
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in result) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
