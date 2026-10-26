"""Generate and validate the source-grounded Companion review for batch 14."""
import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/15_outdoor_nature.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_14.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# Values were set from a first direct reading and then re-read at score boundaries.
FINAL = {
    316:(.75,.5,.5,.5,.5), 317:(.5,.5,.5,.5,.5), 318:(.75,.5,.5,.5,.5), 320:(.75,.5,.5,.5,.5),
    321:(.5,.5,.5,.5,.5), 322:(.5,.5,.5,.5,.5), 323:(.5,.5,.5,.5,.5), 324:(.5,.5,.5,.5,.5),
    325:(.5,.5,.5,.5,.5), 326:(.5,.5,.5,.5,.5), 327:(.5,.5,.5,.5,.5), 330:(.75,.5,.5,.5,.5),
    331:(.5,.5,.5,.5,.5), 332:(.5,.75,.5,.75,.5), 333:(.5,.5,.5,.75,.5), 335:(.5,.5,.5,.5,.5),
    336:(.75,.5,.5,.5,.5), 337:(.5,.5,.5,.25,.25), 338:(.5,.5,.5,.5,.5), 340:(.5,.5,.5,.5,.5),
    341:(.5,.5,.5,.25,.25), 342:(.5,.5,.5,.5,.5), 343:(.5,.5,.5,.5,.5), 344:(.5,.5,.5,.5,.5),
    345:(.5,.5,.5,.75,.5), 346:(.5,.5,.5,.5,.5), 347:(.5,.5,.5,.25,.25), 348:(.5,.5,.5,.5,.5),
    349:(.75,.5,.5,.75,.5), 350:(.5,.5,.5,.5,.5), 351:(.5,.5,.5,.5,.5), 353:(.5,.5,.5,.5,.5),
    354:(.5,.5,.5,.5,.5), 355:(.5,.5,.5,.75,.5), 356:(.5,.5,.5,.75,.5), 359:(.5,.5,.5,.5,.5),
    361:(.5,.5,.5,.75,.5), 364:(.75,.75,.5,.75,.5), 365:(.75,.5,.5,.5,.5), 367:(.5,.5,.5,.75,.5),
    368:(.5,.5,.5,.5,.5), 369:(.5,.5,.5,.5,.5), 370:(.5,.5,.5,.75,.5), 372:(.5,.5,.5,.25,.25),
    373:(.5,.5,.5,.5,.5), 374:(.5,.5,.5,.5,.5), 375:(.5,.5,.5,.5,.5), 376:(.5,.5,.5,.5,.5),
    377:(.5,.5,.5,.5,.5), 378:(.5,.5,.5,.25,.25),
}
FIRST = dict(FINAL)
FIRST[317] = (.75,.5,.5,.5,.5)
FIRST[331] = (.75,.5,.5,.5,.5)
FIRST[345] = (.5,.75,.5,.75,.5)
FIRST[348] = (.5,.5,.75,.5,.5)

# Specific source facts support every non-neutral final decision; other labels use the first source fact.
FACTS = {
    316:"야외 골프 라운드와 클럽하우스 이용", 318:"라운딩을 꿈꾸는 골퍼들을 위한 세 코스를 안내한다",
    320:"정통 골프장의 라운딩 플레이를 소개한다", 330:"세일요트와 돌고래 관찰, 요트 다이닝을 안내한다",
    332:"해안 절벽 장수산책로가 있고 연인과 가족들이 많이 찾는다고 소개한다", 333:"여름철 아이들이 수영하는 모습을 볼 수 있다고 소개한다",
    336:"호흡·명상과 힐링 프로그램, 산책과 전문 지도 국궁 체험을 결합한 공간이다", 337:"고지 1300m 오름이며 물이 차면 데크를 건널 때 신발을 벗어야 한다",
    341:"매우 가파른 분화구이며 안사면 접근이 매우 어렵다고 설명한다", 345:"손으로 만져보고 의상·가면 만들기 등 체험형 전시를 제공한다",
    347:"모래 유실과 돌출 암반으로 안전사고 우려가 높아 해수욕장은 폐장됐다고 안내한다", 349:"초보자도 안전하게 체험하고 가족 단위 여행객까지 이용하기 좋다고 소개한다",
    355:"후세들의 역사·애국 의식 함양을 위한 교육장으로 활용된다고 소개한다", 356:"중학생 선비 체험과 전연령 전패례 재현 체험 프로그램을 안내한다",
    361:"노루를 만져보고 먹이 주기 체험을 할 수 있는 관찰원을 조성했다", 364:"부부 승마 아카데미·어린이 승마 캠프와 안전 관리, 초보자 체험을 안내한다",
    365:"초보자를 위한 승마 프로그램으로 누구나 체험할 수 있다고 안내한다", 367:"4D영상관·VR체험존과 거문오름 탐방 통로를 안내한다",
    370:"개별 수영장이 있어 어린이들이 물놀이를 즐길 수 있다고 소개한다", 372:"15.1km의 오름과 바다 걷기 코스다",
    378:"험해 갈 수 없던 해안 구간을 돌을 고르는 작업으로 새 바닷길로 만들었다고 소개한다",
}


def read_records(path: Path) -> list[dict]:
    """Read JSON records while preserving unescaped physical newlines in strings."""
    text = path.read_text(encoding="utf-8")
    repaired: list[str] = []
    in_string = escaped = False
    for char in text:
        if in_string and char in "\r\n":
            if char == "\n":
                repaired.append("\\n")
            continue
        repaired.append(char)
        if escaped:
            escaped = False
        elif char == "\\\\" and in_string:
            escaped = True
        elif char == '"':
            in_string = not in_string
    decoder = json.JSONDecoder()
    source = "".join(repaired)
    records = []
    offset = 0
    while offset < len(source):
        while offset < len(source) and source[offset].isspace():
            offset += 1
        if offset == len(source):
            break
        record, offset = decoder.raw_decode(source, offset)
        records.append(record)
    return records


def first_fact(row: dict) -> str:
    if row["source_order"] in FACTS:
        return FACTS[row["source_order"]]
    text = row["source_excerpt"].split("\n{", 1)[0].replace("\n", " ").strip()
    return text.split(". ", 1)[0] + ("." if ". " in text else "")


def axis_label(row: dict, axis: str, value: float) -> dict:
    fact = first_fact(row)
    unknown = row.get("unknowns", ["동행별 이용 조건"])[0]
    is_direct = value != .5 and row["source_order"] in FACTS
    if value == .5:
        conclusion = "이 동행을 직접 우대하거나 불리하게 하는 근거가 충분하지 않아 상대적 보통값으로 둔다."
    elif value > .5:
        conclusion = "소개에 적힌 활동·대상 근거만 반영한 상대적 상향이며, 소개에 없는 사회성은 추정하지 않는다."
    else:
        conclusion = "소개에 적힌 강도·안전·동선 마찰을 반영한 상대적 하향이며 방문 불가를 뜻하지 않는다."
    return {
        "state":"numeric", "value":value, "confidence":.82 if is_direct else (.76 if value != .5 else .55),
        "status":"ai_draft", "inference_level":"direct_evidence" if is_direct else "contextual_inference",
        "rationale":f"source_excerpt 사실: ‘{fact}’ unknowns: ‘{unknown}’. {conclusion}",
        "evidence_ids":row["evidence_ids"],
        "rule_ids":["COMPANION-CALIBRATION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"], "null_reason":None,
    }


def build(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        values = FINAL[row["source_order"]]
        result.append({key:row[key] for key in ("contentid", "title", "source_order", "calibration_family")} | {
            "companion_fit":{axis:axis_label(row, axis, values[i]) for i, axis in enumerate(AXES)}
        })
    return result


def validate(rows: list[dict], output: list[dict]) -> None:
    assert len(rows) == len(output) == 50
    identifiers = ("contentid", "title", "source_order", "calibration_family")
    assert [tuple(row[key] for key in identifiers) for row in rows] == [tuple(row[key] for key in identifiers) for row in output]
    for source, reviewed in zip(rows, output):
        assert set(reviewed["companion_fit"]) == set(AXES)
        for label in reviewed["companion_fit"].values():
            assert label["state"] == "numeric" and label["value"] in (0,.25,.5,.75,1)
            assert label["status"] == "ai_draft" and label["null_reason"] is None
            assert label["evidence_ids"] == source["evidence_ids"]
            assert "CALIBRATED-BOUNDARY-REVIEW-V2" in label["rule_ids"] and label["rationale"]


def report(output: list[dict]) -> dict:
    distribution = {axis:dict(sorted(Counter(row["companion_fit"][axis]["value"] for row in output).items())) for axis in AXES}
    same = sum(len({row["companion_fit"][axis]["value"] for axis in AXES}) == 1 for row in output)
    changed = sum(a != b for order in FINAL for a, b in zip(FIRST[order], FINAL[order]))
    return {"axis_distribution":distribution, "same_value_all_five_places":same, "first_to_review_changed_axes":changed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rows = read_records(INPUT)
    generated = build(rows)
    if args.check:
        actual = [json.loads(line) for line in OUTPUT.read_text(encoding="utf-8").splitlines() if line]
        assert actual == generated
        validate(rows, actual)
    else:
        validate(rows, generated)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in generated), encoding="utf-8")
    print(json.dumps(report(generated), ensure_ascii=False, sort_keys=True))
