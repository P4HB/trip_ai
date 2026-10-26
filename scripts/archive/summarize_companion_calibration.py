"""Summarize reviewed calibration labels into a per-family scoring guide."""

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09" / "place-fit-relabel-v2"


def main() -> None:
    rows = []
    for path in sorted((BASE / "calibration_outputs").glob("calibrate_*.jsonl")):
        rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    by_family: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    examples: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        family = row["calibration_family"]
        for axis_key, axis in row["companion_fit"].items():
            score = str(axis["value"])
            by_family[family][axis_key][score] += 1
            if len(examples[family][score]) < 3:
                examples[family][score].append({
                    "contentid": row["contentid"],
                    "title": row["title"],
                    "axis": axis_key,
                    "rationale": axis["rationale"],
                })
    guide = {
        "version": "companion-calibration-v1",
        "purpose": "Use as an anchor distribution and rationale reference; do not force identical score ratios.",
        "family_axis_distribution": {family: {axis: dict(scores) for axis, scores in axes.items()} for family, axes in by_family.items()},
        "examples": examples,
    }
    output = BASE / "calibration_outputs" / "companion_calibration_guide.json"
    output.write_text(json.dumps(guide, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE: {len(rows)} reviewed places -> {output}")


if __name__ == "__main__":
    main()
