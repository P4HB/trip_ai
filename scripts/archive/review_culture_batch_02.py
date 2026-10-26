"""Create the source-grounded boundary review sidecar for culture batch 02."""

from collections import Counter
from pathlib import Path
import json


ROOT = Path("data/labeling/jeju/2026-08-09/place-fit-relabel-v2")
INPUT = ROOT / "calibration_inputs/07_culture_exhibition.jsonl"
DRAFT = ROOT / "calibration_outputs/batches/calibrated_batch_02.jsonl"
OUTPUT = ROOT / "calibration_outputs/reviewed/reviewed_calibrated_batch_02.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
RULE = "CALIBRATED-BOUNDARY-REVIEW-V2"

# Only deviations from the existing draft.  General observation is not solo
# evidence; child/parent changes below are tied to a stated audience, safety,
# or activity fact in the respective input source excerpt.
OVERRIDES = {
    "741109": {"solo": 0.5},
    "745313": {"solo": 0.5, "kids": 1},
    "759595": {"solo": 0.5},
    "988207": {"solo": 0.5},
    "1329201": {"solo": 0.5, "kids": 1},
    "1737497": {"solo": 0.5, "couple": 0.75, "friends": 0.5, "kids": 1},
    "1874612": {"solo": 0.5, "kids": 1, "parents": 0.5},
    "1883815": {"solo": 0.5, "kids": 0.75, "parents": 0.75},
    "1906211": {"solo": 0.5},
    "1907801": {"solo": 0.5},
    "1911160": {"solo": 0.5, "kids": 0.75},
    "2027203": {"solo": 0.5},
    "2469467": {"solo": 0.5, "friends": 0.5},
    "2472824": {"solo": 0.5, "kids": 1},
    "2479639": {"kids": 0.5},
    "2503694": {"solo": 0.5},
    "2554570": {"solo": 0.5},
    "2562214": {"solo": 0.5},
    "2562239": {"solo": 0.5, "kids": 0.75},
    "2594519": {"kids": 0.5},
    "2633955": {"solo": 0.5, "kids": 1, "parents": 0.75},
    "2638440": {"solo": 0.5, "kids": 0.75},
    "2661407": {"solo": 0.5},
    "2704353": {"kids": 0.5, "parents": 0.5},
    "2710264": {"solo": 0.5, "kids": 1, "parents": 0.75},
    "2713583": {"solo": 0.5},
    "2714241": {"solo": 0.5},
    "2738726": {"solo": 0.5, "kids": 1},
    "2740014": {"solo": 0.5},
    "2751836": {"solo": 0.5},
    "2752816": {"solo": 0.5, "friends": 0.5},
    "2763826": {"solo": 0.5},
    "2767799": {"solo": 0.5, "friends": 0.5, "kids": 0.75},
    "2778915": {"solo": 0.5},
    "2798027": {"solo": 0.5, "kids": 0.75},
    "2852695": {"solo": 0.5},
    "2858467": {"solo": 0.5, "parents": 0.5},
    "2904457": {"solo": 0.5},
    "2931257": {"kids": 0.75, "parents": 0.25},
}


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def fact(excerpt):
    """Use the actual pre-metadata introduction as a compact rationale fact."""
    return excerpt.split("\n{")[0].split("\n운영 참고:")[0].replace("\n", " ").strip().rstrip("…")


def rationale(value, source_fact, axis):
    if value >= 0.75 and axis == "kids":
        verdict = "The source directly supplies a child-targeted activity, audience, or safety fact, so this axis is high."
    elif value >= 0.75 and axis == "parents":
        verdict = "The source supplies a parent-relevant target, safety, or supported participation fact, so this axis is high."
    elif value >= 0.75:
        verdict = "The source directly names this companion or a corresponding shared activity, so this axis is high."
    elif value <= 0.25:
        verdict = "The source gives an age, safety, or suitability limitation, so this is the relative low point rather than a prohibition."
    else:
        verdict = "No companion-specific high-suitability evidence is stated; general observation, nature, or shopping is retained as a neutral score."
    return f"Source fact: {source_fact}. Boundary review: {verdict}"


def confidence(value):
    return 0.86 if value == 1 else 0.76 if value == 0.75 else 0.66 if value <= 0.25 else 0.52


def level(value):
    return "direct_evidence" if value in (0.75, 1) else "conservative"


def main():
    inputs = read_jsonl(INPUT)
    drafts = {row["contentid"]: row for row in read_jsonl(DRAFT)}
    output = []
    for row in inputs:
        draft = drafts[row["contentid"]]
        values = {axis: draft["companion_fit"][axis]["value"] for axis in AXES}
        values.update(OVERRIDES.get(row["contentid"], {}))
        source_fact = fact(row["source_excerpt"])
        companion_fit = {}
        for axis in AXES:
            old = draft["companion_fit"][axis]
            value = values[axis]
            companion_fit[axis] = {
                "state": "numeric",
                "value": value,
                "confidence": confidence(value),
                "status": "ai_draft",
                "inference_level": level(value),
                "rationale": rationale(value, source_fact, axis),
                "evidence_ids": old["evidence_ids"],
                "rule_ids": list(dict.fromkeys(old["rule_ids"] + [RULE])),
                "null_reason": None,
            }
        output.append({key: row[key] for key in ("contentid", "title", "source_order", "calibration_family")} | {"companion_fit": companion_fit})
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in output) + "\n", encoding="utf-8")
    print(f"wrote {len(output)} rows to {OUTPUT}")
    for axis in AXES:
        print(axis, dict(sorted(Counter(row["companion_fit"][axis]["value"] for row in output).items())))


if __name__ == "__main__":
    main()
