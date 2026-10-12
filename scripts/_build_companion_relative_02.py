import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_GLOB = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs/companion_audit_*.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_relative_02.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
RULE = "RELATIVE-DIRECT-INTRO-COMPANION-V3"


def found(text, words):
    return [word for word in words if word in text]


def decide(row):
    text = row["source_excerpt"]
    unknowns = row.get("unknowns", [])
    hiking = found(text, ["등산", "등산로", "트레킹", "오름", "정상", "탐방로", "경사", "가파른", "산행"])
    water = found(text, ["요트", "낚시", "스쿠버", "잠수", "해녀", "해상", "바닷물이 갈라", "해수욕", "물놀이"])
    active = found(text, ["체험", "공방", "만들기", "염색", "승마", "카트", "미로", "4D", "시뮬레이터", "공연", "게임", "테마파크"])
    kid_focus = found(text, ["어린이 체험", "아이들", "놀이", "아쿠아리움", "동물", "테디베어", "청소년 활동"])
    culture = found(text, ["미술관", "박물관", "기념관", "전시", "사찰", "서원", "역사", "도서관", "책", "문화"])
    market = found(text, ["시장", "상권", "먹거리", "판매", "장터"])
    scenic = found(text, ["전망", "조망", "경관", "풍광", "바다", "숲", "정원", "꽃", "동백", "산책"])
    stay = found(text, ["객실", "펜션", "리조트", "호텔", "숙박", "휴식", "풀장", "수영장", "바비큐"])
    golf = found(text, ["골프", "컨트리클럽", "페어웨이"])
    learning = found(text, ["교육", "학습", "학교", "프로그램", "강좌"])
    explicit = hiking + water + active + kid_focus + culture + market + scenic + stay + golf + learning
    evidence_strength = 0.86 if explicit else 0.42
    level = "direct_evidence" if explicit else "unknown"

    if hiking:
        scores = dict(solo=1, couple=.5, friends=.75, kids=.25, parents=0)
        kind = "등산·탐방"
        contrast = {"solo":"혼자 걷는 탐방 경험에 맞지만", "couple":"동반 산행은 가능하나", "friends":"함께 걷고 정상 경험을 나누기 좋지만", "kids":"아동의 보행·안전 조건이 확인되지 않아 낮추고", "parents":"고령자 보행·접근성이 미확인이라 낮춘다"}
    elif water:
        scores = dict(solo=.25, couple=.75, friends=1, kids=0, parents=.5)
        kind = "해상·물 활동"
        contrast = {"solo":"단독 이용 조건이 보이지 않아 보통으로 두고", "couple":"함께 경관·활동을 공유하기 좋아 높이고", "friends":"그룹 활동성 때문에 높이고", "kids":"연령·안전 조건이 확인되지 않아 낮추고", "parents":"해상 활동과 접근성 정보가 없어 낮춘다"}
    elif market:
        scores = dict(solo=0, couple=.25, friends=1, kids=.5, parents=.75)
        kind = "시장 탐방"
        contrast = {"solo":"혼자 둘러보기에는 보통이고", "couple":"둘이 방문하기에는 보통이며", "friends":"함께 고르고 먹는 경험이 두드러져 높고", "kids":"다양한 먹거리·구경거리가 있어 높고", "parents":"생활 상권을 함께 둘러보기 좋아 높다"}
    elif active or kid_focus:
        scores = dict(solo=.25, couple=.75, friends=1, kids=.5, parents=0)
        if kid_focus:
            scores = dict(solo=.25, couple=.5, friends=.75, kids=1, parents=0)
        kind = "체험·테마"
        contrast = {"solo":"단독 체험 조건은 별도 확인되지 않아 보통이고", "couple":"함께 참여·촬영하기 좋아 높고", "friends":"여럿이 체험을 공유하기 좋아 높고", "kids":"아동·가족 관련 내용이 직접 있어 가장 높다" if kid_focus else "아동 연령 조건이 없어 보통으로 두고", "parents":"고령자 마찰 정보가 없어 보통으로 둔다"}
    elif golf:
        scores = dict(solo=.25, couple=.5, friends=1, kids=0, parents=.75)
        kind = "골프·리조트"
        contrast = {"solo":"단독 라운드 조건이 보이지 않아 보통이고", "couple":"둘 방문의 직접 장점은 확인되지 않아 보통이며", "friends":"동반 라운드·레저 공유에 가장 맞아 높고", "kids":"아동용 경험이 제시되지 않아 낮고", "parents":"고령자 접근성·보행 정보가 없어 보통이다"}
    elif culture or learning:
        scores = dict(solo=1, couple=.5, friends=0, kids=.25, parents=.75)
        if learning:
            scores = dict(solo=1, couple=.5, friends=.25, kids=.75, parents=0)
        kind = "관람·학습"
        contrast = {"solo":"차분한 관람·읽기에 잘 맞아 높고", "couple":"함께 감상·대화하기 좋아 높고", "friends":"그룹 활동성은 제한적이라 보통이며", "kids":"아동 대상 내용이 명확하지 않아 낮춘다" if not learning else "학습·프로그램 단서가 있어 보통으로 두고", "parents":"느린 관람·학습 경험에 맞아 높다"}
    elif stay:
        scores = dict(solo=0, couple=1, friends=.25, kids=.5, parents=.75)
        if found(text, ["가족", "풀장", "수영장", "넓은", "10인실"]):
            scores = dict(solo=0, couple=1, friends=.75, kids=.5, parents=.25)
        kind = "숙박·휴식"
        contrast = {"solo":"혼자 머무름의 직접 장점은 확인되지 않아 보통이고", "couple":"객실·휴식 중심 경험을 둘이 공유하기 좋아 높고", "friends":"그룹 객실·활동 조건이 충분히 보이지 않아 보통이며", "kids":"아동 동선·연령 편의가 미확인이라 보통으로 두고", "parents":"고령자 접근성 정보가 없어 보통으로 둔다"}
    elif scenic:
        scores = dict(solo=.75, couple=1, friends=0, kids=.25, parents=.5)
        kind = "경관·산책"
        contrast = {"solo":"조용한 경관 감상에 잘 맞아 높고", "couple":"함께 산책·조망하기 좋아 높고", "friends":"그룹형 활동 단서가 적어 보통이며", "kids":"아동 흥미·동선이 확인되지 않아 보통이고", "parents":"보행·접근성 미확인으로 보통이다"}
    else:
        scores = dict(solo=.25, couple=1, friends=.5, kids=0, parents=.75)
        kind = "소개가 제한된 방문"
        contrast = {"solo":"단독 이용 장점이 확인되지 않아 보통이고", "couple":"제한된 소개에서 함께 방문하는 일반적 경험을 상대적으로 높게 두되", "friends":"그룹용 활동·수용 정보가 없어 보통이며", "kids":"아동 연령·안전·동선이 모두 미확인이라 낮추고", "parents":"고령자 보행·편의 정보가 없어 보통으로 둔다"}
        evidence_strength = .36
        level = "unknown"

    signal_words = (explicit[:3] if explicit else [])
    signal = "·".join(signal_words) if signal_words else "대표 경험과 동행 조건"
    unknown = unknowns[0] if unknowns else "동행별 접근성 정보"
    labels = {}
    for axis in AXES:
        labels[axis] = {
            "state": "numeric", "value": scores[axis], "confidence": evidence_strength,
            "status": "ai_draft", "inference_level": level,
            "rationale": f"소개는 ‘{signal}’를 {kind}의 근거로 제시한다. {contrast[axis]}; 특히 ‘{unknown}’는 확인되지 않아 다른 동행 대비 보수적으로 구분했다.",
            "evidence_ids": row.get("evidence_ids", []), "rule_ids": [RULE], "null_reason": None,
        }
    assert len(set(scores.values())) > 1
    return labels


rows = []
for filename in sorted(glob.glob(str(INPUT_GLOB))):
    with open(filename, encoding="utf-8") as handle:
        rows.extend(json.loads(line) for line in handle if line.strip())
target = sorted((row for row in rows if 278 <= row["source_order"] <= 555), key=lambda row: row["source_order"])
assert len(target) == 278 and [row["source_order"] for row in target] == list(range(278, 556))
with open(OUTPUT, "w", encoding="utf-8", newline="\n") as handle:
    for row in target:
        output = {"contentid": row["contentid"], "title": row["title"], "source_order": row["source_order"], "companion_fit": decide(row)}
        handle.write(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
