"""Create the source-grounded Companion boundary review for culture batch 10."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2"
INPUT = BASE / "calibration_inputs/09_culture_exhibition.jsonl"
OUTPUT = BASE / "calibration_outputs/reviewed/reviewed_calibrated_batch_10.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# First-pass values are retained solely to make the same-run boundary review
# auditable.  The final values are the only emitted labels.
FIRST = {
    "4026805": {"kids": .75, "parents": .75},
    "4026808": {"couple": .75, "friends": .75, "kids": 1, "parents": .75},
    "4026828": {"friends": .75},
    "4026840": {"kids": 1, "parents": .75},
    "4057731": {"kids": .75, "parents": .75},
    "4057941": {"solo": .75},
    "4060957": {"couple": .75, "friends": .75, "kids": 1, "parents": .75},
    "4091197": {"solo": .75, "couple": .75, "friends": .75, "kids": .75},
}
FINAL = {
    "4026805": {"kids": .75},
    "4026808": {"kids": 1, "parents": .75},
    "4026840": {"kids": 1, "parents": .75},
    "4057731": {"kids": .75},
    "4060957": {"kids": 1, "parents": .75},
    "4091197": {"solo": .75, "kids": .75},
}
FACTS = {
    "4026797": "트렌디한 아이웨어와 전문적인 검안 서비스, 다양한 안경테 비교를 제공한다고 소개한다.",
    "4026798": "해외 명품 잡화와 액세서리를 소개하는 럭셔리 편집 브랜드라고 소개한다.",
    "4026799": "이탈리아 프리미엄 아우터 브랜드의 패딩 제품을 소개한다.",
    "4026802": "요가복과 레깅스를 통해 편안하고 건강한 라이프스타일을 제안한다고 소개한다.",
    "4026803": "골프웨어와 스포츠용품을 소개하는 프리미엄 브랜드라고 소개한다.",
    "4026804": "컬러 배색과 캐릭터 상품을 갖춘 패션 브랜드라고 소개한다.",
    "4026805": "핸드메이드 곰 인형을 통해 남녀노소에게 동심과 치유의 시간을 선물한다고 소개한다.",
    "4026806": "빈티지 웨어를 현대적으로 재해석한 스트릿 캐주얼 의류 브랜드라고 소개한다.",
    "4026807": "MZ세대를 대상으로 밝고 경쾌한 캐주얼 스타일링을 제안한다고 소개한다.",
    "4026808": "대한민국 대표 가족형 테마파크로서 다채로운 어트랙션과 공연을 제공하고 남녀노소 누구나의 추억을 표방한다.",
    "4026828": "패션 아이템과 문화 콘텐츠를 모아 즐거움을 발견하고 소통하도록 돕는 복합 라이프스타일 체험 공간이라고 소개한다.",
    "4026830": "신진 작가의 소품과 디자인 문구를 큐레이션하는 디자인 편집 브랜드라고 소개한다.",
    "4026840": "인기 교구와 완구를 제공하며 안전하고 유익한 놀이 문화와 육아 파트너를 표방한다고 소개한다.",
    "4057731": "제주 희귀 자료와 그림책을 열람하는 책방이며, 제주 이야기를 담은 그림책이 많아 아이들과 방문하기 좋다고 소개한다.",
    "4057941": "제주의 물 부족 역사와 지하수 이용 변화를 설명하는 홍보관이며 인접 생태공원과 함께 자리한다.",
    "4060957": "하리보 역사·제작 과정을 미디어 아트와 게임으로 만나고 포토존을 이용하는 전시관이며, 어린이에게 상상력과 모험을 선사한다고 소개한다.",
    "4091197": "전시 관람과 사색으로 생각을 정리하는 공간이며, 어린이 전용 디저트 테라리움 만들기 프로그램을 운영한다고 소개한다.",
}

def label(cid, axis, evidence):
    value = FINAL.get(cid, {}).get(axis, .5)
    fact = FACTS[cid]
    if value >= .75:
        why = ("직접 대상·활동 근거가 있어 높은 상대 적합도로 유지한다."
               if value == .75 else "직접 어린이·가족 대상 핵심 활동 근거가 있어 최고 상대 적합도로 유지한다.")
        confidence, level = (.76 if value == .75 else .84), "direct_evidence"
    else:
        why = ("단순 상품 관람·구매, 경관 또는 일반 관람만으로는 사회적 동행 적합도를 높이지 않았으며, "
               "연령·안전·보행·가족 동반의 직접 근거는 unknown이므로 중립값으로 유지한다.")
        confidence, level = .52, "conservative"
    return {
        "state": "numeric", "value": value, "confidence": confidence,
        "status": "ai_draft", "inference_level": level,
        "rationale": f"Source fact: {fact} Boundary review: {why}",
        "evidence_ids": evidence,
        "rule_ids": ["CALIBRATED-DIRECT-COMPANION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"],
        "null_reason": None,
    }

def main():
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines()]
    output = []
    for row in rows:
        cid = row["contentid"]
        output.append({key: row[key] for key in ("contentid", "title", "source_order", "calibration_family")} | {
            "companion_fit": {axis: label(cid, axis, row["evidence_ids"]) for axis in AXES}
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in output) + "\n", encoding="utf-8")
    first_changes = sum(FIRST.get(row["contentid"], {}).get(axis, .5) != row["companion_fit"][axis]["value"] for row in output for axis in AXES)
    print(f"rows={len(output)} axes={len(output)*len(AXES)} first_to_review_changes={first_changes}")
    for axis in AXES:
        print(axis, dict(sorted(Counter(row["companion_fit"][axis]["value"] for row in output).items())))

if __name__ == "__main__":
    main()
