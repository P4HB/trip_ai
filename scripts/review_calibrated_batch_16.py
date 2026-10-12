"""Generate the source-grounded Companion final review for outdoor batch 16."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2"
INPUT = BASE / "calibration_inputs/17_outdoor_nature.jsonl"
OUTPUT = BASE / "calibration_outputs/reviewed/reviewed_calibrated_batch_16.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")

# First-pass decisions, retained after an independent boundary reread.
SCORES = {
 "1893137":{"solo":.75}, "1895611":{"solo":.75},
 "1896032":{"solo":1,"friends":1},
 "1898484":{"solo":.75,"kids":1,"parents":1}, "1898906":{"solo":.75},
 "1899959":{"solo":.75}, "1905280":{"kids":.75},
 "1905844":{"kids":.75},
 "1918413":{"solo":.75}, "1918417":{"kids":.25,"parents":.25},
 "1918639":{"kids":1}, "1918646":{"solo":.75,"kids":.75,"parents":.75},
 "1918984":{"kids":.25,"parents":.25}, "1923590":{"kids":.25,"parents":.25},
 "1925362":{"kids":.75}, "1926379":{"kids":.25,"parents":.25},
 "1926601":{"solo":.75,"kids":.75},
 "1928421":{"kids":.25,"parents":.25}, "1928430":{"kids":.25,"parents":.25},
 "1932636":{"kids":.75}, "1933208":{"kids":.25,"parents":.25},
 "1939078":{"kids":.75}, "1939093":{"solo":.75,"kids":.75},
 "1941153":{"solo":.75}, "1945394":{"kids":.25,"parents":.25},
 "1945768":{"solo":.75,"parents":.75}, "1952520":{"solo":.75},
}

def label(axis, value, row):
    direct = value != .5
    fact = row["source_excerpt"].split("\n", 1)[0].strip()[:260]
    unknown = "; ".join(row["unknowns"])
    decision = ("소개에 명시된 활동·대상·안전 또는 보행 근거를 경계 재검토해 "
                + ("높은 적합도를 유지했다." if value > .5 else "낮은 적합도로 판정했다.")) if direct else \
               f"{axis} 동행을 직접 대상으로 한 충분한 근거가 없어 보통 적합도로 판정했다."
    return {"state":"numeric", "value":value, "confidence":.8 if value in (1,.25) else (.75 if direct else .6),
            "status":"ai_draft", "inference_level":"direct_evidence" if direct else "limited_direct_evidence",
            "rationale":f"source_excerpt 사실: {fact}. unknown: {unknown}. {decision}",
            "evidence_ids":row["evidence_ids"],
            "rule_ids":["CALIBRATED-DIRECT-COMPANION-V1","CALIBRATED-BOUNDARY-REVIEW-V2"], "null_reason":None}

def main():
    rows = [json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line]
    out = []
    for row in rows:
        values = SCORES.get(row["contentid"], {})
        out.append({key:row[key] for key in ("contentid","title","source_order","calibration_family")} | {"companion_fit": {axis:label(axis, values.get(axis,.5), row) for axis in AXES}})
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",",":")) for row in out) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
