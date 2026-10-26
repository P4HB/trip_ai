"""Create the source-order 834--1110 relative Companion audit batch."""
import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT_GLOB = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_*.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_relative_04.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
RULE = "RELATIVE-DIRECT-INTRO-COMPANION-V3"

# These expressions only classify terms actually present in source_excerpt.  They
# deliberately describe the representative visit, not access hard constraints.
POSITIVE = {
    "solo": ("전시", "미술", "박물관", "숲", "산책", "경관", "자연", "조용", "사색", "해설", "정원", "독서", "휴식", "카페"),
    "couple": ("포토존", "사진", "낭만", "야경", "오붓", "데이트", "스파", "풀빌라", "바다", "경관", "휴식", "호텔", "와인"),
    "friends": ("체험", "액티비티", "놀이", "축제", "시장", "쇼핑", "바베큐", "노래", "게임", "사격", "레일", "수영", "테마파크", "카트", "레이싱"),
    "kids": ("어린이", "아이", "가족", "키즈", "놀이", "동물", "목장", "체험", "회전목마", "캐릭터", "포토존", "수영", "테마파크", "카트"),
    "parents": ("휴식", "정원", "전시", "박물관", "산책", "주차", "실내", "온천", "족욕", "해설", "경관", "카페"),
}
FRICTION = {
    "kids": ("성인", "사격", "골프", "야간", "20:00", "해상", "등산", "스릴"),
    "parents": ("등산", "트레킹", "야간", "해상", "스릴", "서핑", "다이빙", "암벽", "경사", "속도", "카트"),
    "solo": (), "couple": (), "friends": (),
}
DEFAULTS = {
    "lodging": {"solo": 1, "couple": 3, "friends": 2, "kids": 1, "parents": 1},
    "shop": {"solo": 1, "couple": 2, "friends": 3, "kids": 1, "parents": 0},
    "nature": {"solo": 3, "couple": 2, "friends": 1, "kids": 0, "parents": 1},
    "culture": {"solo": 3, "couple": 2, "friends": 1, "kids": 0, "parents": 2},
    "activity": {"solo": 1, "couple": 1, "friends": 3, "kids": 2, "parents": 0},
}

def contains(text, words):
    return [word for word in words if word in text]

def kind(text):
    if any(w in text for w in ("객실", "호텔", "리조트", "펜션", "풀빌라", "숙박")):
        return "lodging"
    if any(w in text for w in ("매장", "기념품", "소품", "쇼핑", "문구", "시장")):
        return "shop"
    if any(w in text for w in ("놀이", "체험", "액티비티", "테마파크", "레일", "사격", "수영")):
        return "activity"
    if any(w in text for w in ("전시", "공연", "미술", "박물관", "문화")):
        return "culture"
    return "nature"

def value(score):
    # Scores are relative within the place; 0 is reserved for explicit friction.
    return 1 if score >= 4 else 0.75 if score >= 2 else 0.5 if score >= 0 else 0.25

def axis_label(axis, text, unknowns, place_kind):
    plus = contains(text, POSITIVE[axis])
    minus = contains(text, FRICTION[axis])
    score = DEFAULTS[place_kind][axis] + len(plus) - 2 * len(minus)
    axis_value = 0 if minus and score <= -1 else value(score)
    explicit = bool(plus or minus)
    unknown_note = "; ".join(unknowns)
    comparison = {
        "solo": "함께하는 활동성이 강한 동행보다 혼자 집중해 즐기기 쉬운지",
        "couple": "혼자 관람하거나 단체 활동하는 경우보다 두 사람이 공유할 장면이 있는지",
        "friends": "정적인 개인 감상보다 여러 사람이 함께 참여할 요소가 있는지",
        "kids": "성인 중심·보행 미확인 경험보다 어린이가 즐길 직접 요소가 있는지",
        "parents": "활동성·보행 부담이 있는 동행보다 편안히 머물 수 있는 근거가 있는지",
    }[axis]
    if explicit:
        evidence = ", ".join(plus + minus)
        rationale = f"소개에 ‘{evidence}’가 언급되어 {comparison}를 다른 동행 축과 비교했다."
        level, confidence = "direct_evidence", 0.72 if plus else 0.66
    else:
        rationale = f"소개에는 이 동행의 직접 대상·편의 단서가 없고 {comparison}를 대표 경험의 성격으로만 상대 판정했다. 미확인 사항: {unknown_note}."
        level, confidence = "unknown", 0.38
    if minus:
        rationale += " 소개의 직접 마찰 요소가 있어 이 축은 상대적으로 낮게 두었다."
    elif axis_value >= 0.75:
        rationale += " 소개된 대표 경험이 이 동행에 더 맞아 상대적으로 높게 두었다."
    else:
        rationale += " 직접 강점이 제한적이어서 더 강한 동행 축보다 높게 두지 않았다."
    return {"state": "numeric", "value": axis_value, "confidence": confidence,
            "status": "ai_draft", "inference_level": level, "rationale": rationale,
            "evidence_ids": [], "rule_ids": [RULE], "null_reason": None}

def main():
    rows = []
    for filename in glob.glob(str(INPUT_GLOB)):
        with open(filename, encoding="utf-8") as stream:
            for line in stream:
                record = json.loads(line)
                if 834 <= record["source_order"] <= 1110:
                    rows.append(record)
    rows.sort(key=lambda item: item["source_order"])
    if len(rows) != 277 or [r["source_order"] for r in rows] != list(range(834, 1111)):
        raise ValueError("audit input slice is not exactly source_order 834..1110")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as stream:
        for record in rows:
            # audit excerpts append a generic visit-type line and serialized page
            # metadata after the first newline.  They are not place-specific
            # companion evidence, so only judge the actual introduction paragraph.
            text = record.get("source_excerpt", "").split("\n", 1)[0]
            labels = {axis: axis_label(axis, text, record.get("unknowns", []), kind(text)) for axis in AXES}
            for label in labels.values():
                label["evidence_ids"] = record.get("evidence_ids", [])
            output = {key: record[key] for key in ("contentid", "title", "source_order")}
            output["companion_fit"] = labels
            stream.write(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")

if __name__ == "__main__":
    main()
