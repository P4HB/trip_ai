"""Generate and validate the source-grounded Companion review for batch 12."""
import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/13_outdoor_nature.jsonl"
OUTPUT = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/reviewed/reviewed_calibrated_batch_12.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# Final values were set after a second boundary pass over the supplied excerpt.
FINAL = {
175:(.5,.5,.5,.5,.5),176:(.5,.75,.75,.5,.5),177:(.5,.5,.5,.5,.5),178:(.5,.5,.5,.5,.5),179:(.5,.5,.5,.5,.5),
180:(.5,.5,.5,.5,.5),181:(.5,.5,.5,.5,.5),183:(.5,.5,.75,.75,.5),184:(.5,.75,.5,.75,.5),185:(.5,.75,.75,.75,.75),
187:(.5,.5,.5,.5,.5),188:(.5,.5,.5,.5,.5),189:(.5,.5,.75,.5,.5),190:(.5,.5,.75,.5,.5),191:(.5,.5,.5,.5,.5),
192:(.5,.5,.5,.5,.5),195:(.5,.5,.5,.5,.5),198:(.5,.75,.5,.5,.5),200:(.5,.5,.5,.5,.5),201:(.5,.5,.5,.5,.5),
203:(.5,.5,.5,.5,.5),205:(.5,.5,.5,.5,.5),207:(.5,.5,.5,.5,.5),208:(.5,.5,.5,.5,.5),209:(.5,.5,.5,.25,.25),
210:(.5,.5,.5,.5,.5),211:(.5,.5,.5,.5,.5),213:(.5,.5,.75,.5,.5),215:(.5,.5,.5,.5,.5),216:(.75,.5,.5,.25,.25),
219:(.5,.5,.5,.5,.5),221:(.5,.5,.5,.5,.5),222:(.5,.75,.75,1,.75),225:(.5,.5,.5,.5,.5),226:(.5,.75,.5,.75,.5),
227:(.5,.5,.5,.5,.5),229:(.5,.5,.75,.75,.5),230:(.5,.5,.5,.5,.5),231:(.75,.5,.5,.75,.5),232:(.5,.5,.5,.5,.5),
233:(.75,.5,.5,0,.25),235:(.5,.5,.5,.75,.5),236:(.5,.5,.5,.75,.5),237:(.5,.5,.5,1,.75),238:(.5,.5,.5,1,.75),
239:(.5,.5,.5,.75,.5),240:(.5,.5,.5,1,.75),243:(.5,.5,.5,.5,.5),244:(.5,.5,.5,.25,.25),245:(.5,.5,.5,.5,.5),
}
# Three first-pass highs were reduced because the second read found no stronger-than-stated social evidence.
FIRST = dict(FINAL)
FIRST[176] = (.5,1,.75,.5,.5)
FIRST[185] = (.5,.75,1,.75,.75)
FIRST[245] = (.75,.5,.5,.5,.5)
DIRECT = {(176,"couple"),(176,"friends"),(183,"friends"),(183,"kids"),(184,"couple"),(184,"kids"),(185,"couple"),(185,"friends"),(185,"kids"),(185,"parents"),(198,"couple"),(222,"couple"),(222,"friends"),(222,"kids"),(222,"parents"),(226,"couple"),(226,"kids"),(229,"friends"),(229,"kids"),(235,"kids"),(236,"kids"),(237,"kids"),(237,"parents"),(238,"kids"),(238,"parents"),(239,"kids"),(240,"kids"),(240,"parents")}

def first_fact(excerpt):
    text = " ".join(excerpt.split())
    for stop in (". ", "다. ", "다."):
        if stop in text:
            return text.split(stop, 1)[0] + ("다." if stop.startswith("다") else ".")
    return text[:180]

def axis_label(row, axis, value):
    fact = first_fact(row["source_excerpt"])
    unknown = row.get("unknowns", ["동행별 이용 조건"])[0]
    direct = (row["source_order"], axis) in DIRECT
    if value == .5:
        judgment = "동행별 직접 우대 또는 불리 근거가 부족하므로 상대적 보통값으로 둔다."
    elif value > .5:
        judgment = "소개에 적힌 활동·대상 근거를 반영한 상대적 상향이며, 소개에 없는 사회성은 추가로 추정하지 않는다."
    else:
        judgment = "소개에 적힌 위험·강도·동선 마찰을 반영한 상대적 하향이며 방문 불가를 뜻하지 않는다."
    return {"state":"numeric", "value":value, "confidence":.82 if direct else (.76 if value != .5 else .55),
            "status":"ai_draft", "inference_level":"direct_evidence" if direct else "contextual_inference",
            "rationale":f"source_excerpt는 ‘{fact}’라고 설명하고, unknowns에는 ‘{unknown}’이 확인되지 않았다고 적혀 있다. {judgment}",
            "evidence_ids":row["evidence_ids"], "rule_ids":["COMPANION-CALIBRATION-V1", "CALIBRATED-BOUNDARY-REVIEW-V2"], "null_reason":None}

def build(rows):
    result=[]
    for row in rows:
        values=FINAL[row["source_order"]]
        result.append({key:row[key] for key in ("contentid","title","source_order","calibration_family")} | {"companion_fit":{axis:axis_label(row, axis, values[i]) for i,axis in enumerate(AXES)}})
    return result

def validate(rows, output):
    assert len(rows) == len(output) == 50
    assert [(r["contentid"],r["title"],r["source_order"],r["calibration_family"]) for r in rows] == [(r["contentid"],r["title"],r["source_order"],r["calibration_family"]) for r in output]
    for row in output:
        assert set(row["companion_fit"]) == set(AXES)
        for label in row["companion_fit"].values():
            assert label["state"] == "numeric" and label["value"] in (0,.25,.5,.75,1)
            assert label["status"] == "ai_draft" and label["null_reason"] is None
            assert label["evidence_ids"] and "CALIBRATED-BOUNDARY-REVIEW-V2" in label["rule_ids"] and label["rationale"]

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--check", action="store_true"); args=parser.parse_args()
    rows=[json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line]
    output=build(rows)
    validate(rows, output)
    if not args.check:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",",":"))+"\n" for row in output), encoding="utf-8")
    changed=sum(a != b for order in FINAL for a,b in zip(FIRST[order], FINAL[order]))
    print(json.dumps({axis:dict(Counter(str(row["companion_fit"][axis]["value"]) for row in output)) for axis in AXES} | {"first_to_review_changed_axes":changed}, ensure_ascii=False))

if __name__ == "__main__": main()
