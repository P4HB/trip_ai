"""Generate source-grounded Companion final-review labels for batch 18."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/19_outdoor_nature.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_18.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# First-pass decisions.  The boundary reread retained every listed decision;
# unlisted axes use the neutral 0.5 baseline.  Distribution is a warning only.
VALUES = {
    "2624249": {"solo": .75},
    "2652545": {"solo": .75},
    "2660122": {"solo": .75, "friends": .75},
    "2660763": {"solo": .75}, "2660802": {"solo": .75},
    "2661514": {"kids": 1, "parents": .75}, "2661519": {"solo": .75},
    "2661523": {"solo": .75}, "2661821": {"kids": .75, "parents": .75},
    "2661848": {"solo": .75, "kids": .25, "parents": .25},
    "2662724": {"solo": .75},
    "2674014": {"friends": .75, "kids": 1, "parents": .75},
    "2675039": {"solo": .75, "kids": .25, "parents": .25},
    "2699343": {"solo": .75}, "2704232": {"solo": .75},
    "2704242": {"kids": .75, "parents": .75},
    "2704351": {"solo": .75, "kids": .25, "parents": .25},
    "2704407": {"solo": .75}, "2704412": {"kids": 1, "parents": .75},
    "2704435": {"kids": .75}, "2704703": {"solo": .75},
    "2705296": {"solo": .75}, "2707417": {"kids": 1, "parents": 1},
    "2707930": {"kids": 1, "parents": .75}, "2709579": {"solo": .75},
    "2710029": {"solo": .75}, "2710165": {"solo": .75},
    "2711404": {"solo": .75, "kids": .25, "parents": .25},
    "2713585": {"solo": .75}, "2714826": {"kids": .75, "parents": .75},
    "2715651": {"solo": .75}, "2715650": {"kids": .25},
}

# These source excerpts are the direct evidence for every non-neutral boundary.
REASONS = {
    "2624249": "차·명상·동적명상과 춤 프로그램을 소개한다",
    "2652545": "나무데크 전망대와 산책로에서 한적한 산책과 사진 촬영을 소개한다",
    "2660122": "짚와이어·족욕·예술작품·카페를 운영하는 복합문화예술공간이라고 소개한다",
    "2660763": "자연 속 내면 성찰과 치유 시간을 위한 숲이라고 소개한다",
    "2660802": "차문화와 역사를 선보이고 티클래스를 경험할 수 있다고 소개한다",
    "2661514": "온가족 숲 체험, 유아숲속 놀이터, 캠핑·글램핑 체험을 운영한다고 소개한다",
    "2661519": "생태 하천 옆 자연 탐방로와 곶자왈 숲길을 소개한다",
    "2661523": "4·3의 역사 교육과 인권·평화의 소중함을 되새기는 길이라고 소개한다",
    "2661821": "체험시설과 각종 체험 프로그램을 운영한다고 소개한다",
    "2661848": "한라산 둘레길 1구간이 8.7km라고 소개한다",
    "2662724": "해설사와 동행하는 트레킹을 즐길 수 있다고 소개한다",
    "2674014": "가족 놀이공원이며 카약·카트·미로공원·숲 산책을 소개한다",
    "2675039": "한라산 둘레길 2구간이 8km라고 소개한다",
    "2699343": "모든 객실이 바다를 향하고 1인실과 2인실로 구성된다고 소개한다",
    "2704232": "오름 입구 이후 탐방로가 갈리고 어느 방향도 한 바퀴로 이어진다고 소개한다",
    "2704242": "시기별 감귤 따기 체험프로그램을 운영한다고 소개한다",
    "2704351": "완만하지만 긴 계단이 있고 최대 6.2km·1시간 40분 코스를 안내한다",
    "2704407": "역사적 상륙과 성지의 유래를 소개한다",
    "2704412": "전통놀이·자연친화 놀이터와 송아지 우유주기 체험을 갖춘 온 가족 목장이라고 소개한다",
    "2704435": "수심이 낮아 아이들과 함께 온 가족 단위 피서객이 많고 해양레저체험이 가능하다고 소개한다",
    "2704703": "정상 아래 거북바위와 전망대가 있고 경치를 감상하며 오를 수 있다고 소개한다",
    "2705296": "밭담·계곡 트레킹, 명상, 작물재배, 힐링 푸드 프로그램을 운영한다고 소개한다",
    "2707417": "연령별 아기용품과 장난감이 준비되어 있고 어른과 아이의 편안한 여행을 목표로 한다고 소개한다",
    "2707930": "키즈존에서 아이들과 쉴 수 있고 통통열차로 둘레길을 둘러볼 수 있다고 소개한다",
    "2709579": "동백과 감귤원이 만드는 제주의 정취를 소개한다",
    "2710029": "해안·숲길·바다목장길을 잇는 제주올레 3코스라고 소개한다",
    "2710165": "한담해안산책로를 포함한 제주올레 15코스라고 소개한다",
    "2711404": "암벽을 타고 바위 틈새를 누비는 용암 하천 계곡 트레킹이라고 소개한다",
    "2713585": "오르기 힘들지 않고 숲길과 오름을 만끽할 수 있다고 소개한다",
    "2714826": "계단과 길이 잘 다듬어져 어린 자녀와 함께 오르는 가족 여행객이 많다고 소개한다",
    "2715650": "해수욕은 할 수 없다고 소개한다",
    "2715651": "4·3 사건의 아픔과 일제강점기 시설을 역사 교육 목적으로 찾는다고 소개한다",
}


def source_fact(row):
    return REASONS.get(row["contentid"], row["source_excerpt"].split("\n{")[0].split("\n")[0][:180].rstrip("."))


def axis_label(row, axis):
    value = VALUES.get(row["contentid"], {}).get(axis, .5)
    unknown = "; ".join(row["unknowns"]) or "동행 조건은 unknown"
    if value == .5:
        conclusion = f"{axis} 대상의 직접 적합 근거가 충분하지 않아 사회적 적합성을 추정하지 않고 0.5로 유지한다."
        level, confidence = "limited_direct_evidence", .6
    elif value >= .75:
        conclusion = f"{axis} 축의 직접 활동·연령·가족 또는 개인 이용 근거가 있어 상향한다."
        level, confidence = "direct_evidence", .8
    else:
        conclusion = f"{axis} 축은 거리·계단·위험 가능성 또는 이용 제한의 직접 근거가 있어 상대적으로 낮춘다."
        level, confidence = "direct_constraint", .75
    return {
        "state": "numeric", "value": value, "confidence": confidence,
        "status": "ai_draft", "inference_level": level,
        "rationale": f"source_excerpt 사실: {source_fact(row)}. unknowns: {unknown}. {conclusion}",
        "evidence_ids": row["evidence_ids"],
        "rule_ids": ["CALIBRATED-DIRECT-COMPANION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"],
        "null_reason": None,
    }


def main():
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line.strip()]
    output = [
        {key: row[key] for key in ("contentid", "title", "source_order", "calibration_family")}
        | {"companion_fit": {axis: axis_label(row, axis) for axis in AXES}}
        for row in rows
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in output) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
