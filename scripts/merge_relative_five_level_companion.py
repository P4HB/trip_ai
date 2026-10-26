"""Promote the second-pass relative five-level Companion labels safely."""

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09"
OUT = BASE / "place-fit-relabel-v2"
REWORK = OUT / "five_level_rework_v2"
AXES = ("solo", "couple", "friends", "kids", "parents")
VALUES = {0, 0.25, 0.5, 0.75, 1}
EXTREME_INFERENCE = {"direct_evidence", "researched_inference", "climate_heuristic", "unknown"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def normalize(axis: dict) -> None:
    if axis["value"] in (0, 1) and axis["inference_level"] not in EXTREME_INFERENCE:
        axis["inference_level"] = "researched_inference"


def validate_axis(axis: dict, location: str) -> None:
    required = {"state", "value", "confidence", "status", "inference_level", "rationale", "evidence_ids", "rule_ids", "null_reason"}
    missing = required - set(axis)
    if missing:
        raise ValueError(f"{location}: missing {sorted(missing)}")
    if axis["state"] != "numeric" or axis["value"] not in VALUES:
        raise ValueError(f"{location}: invalid score")
    if axis["status"] != "ai_draft" or not 0 <= axis["confidence"] <= 1:
        raise ValueError(f"{location}: invalid status/confidence")
    if not axis["rationale"] or not axis["evidence_ids"] or not axis["rule_ids"]:
        raise ValueError(f"{location}: missing provenance")


def expected_place_ids() -> list[str]:
    non = json.loads((BASE / "non_restaurants.json").read_text(encoding="utf-8"))
    restaurants = json.loads((BASE / "restaurants.json").read_text(encoding="utf-8"))
    cafes = [place for place in restaurants if place.get("lclsSystm2") == "FD05"]
    return [str(place["contentid"]) for place in [*non, *cafes]]


def load_rework() -> tuple[dict[str, dict], list[Path]]:
    records: dict[str, dict] = {}
    paths: list[Path] = []
    for index in range(1, 18):
        audit_path = OUT / "audit_inputs" / f"companion_audit_{index:02d}.jsonl"
        output_path = REWORK / f"reviewed_relative_{index:02d}.jsonl"
        audit = read_jsonl(audit_path)
        output = read_jsonl(output_path)
        expected = [str(row["contentid"]) for row in audit]
        actual = [str(row["contentid"]) for row in output]
        if actual != expected:
            raise ValueError(f"batch {index:02d}: contentid order mismatch ({len(actual)} output / {len(expected)} input)")
        for line_no, record in enumerate(output, start=1):
            if set(record.get("companion_fit", {})) != set(AXES):
                raise ValueError(f"batch {index:02d} line {line_no}: incomplete axes")
            contentid = str(record["contentid"])
            if contentid in records:
                raise ValueError(f"duplicate contentid: {contentid}")
            for name, axis in record["companion_fit"].items():
                normalize(axis)
                validate_axis(axis, f"batch {index:02d} line {line_no} {name}")
            records[contentid] = record
        paths.append(output_path)
    return records, paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true", help="replace the active place_fit_labels.jsonl and manifest after a one-time backup")
    args = parser.parse_args()
    records, paths = load_rework()
    expected = expected_place_ids()
    if set(records) != set(expected):
        raise ValueError(f"global ID mismatch: {len(records)} labels / {len(expected)} expected")
    canonical = OUT / "place_fit_labels.jsonl"
    rows = read_jsonl(canonical)
    if [str(row["contentid"]) for row in rows] != expected:
        raise ValueError("canonical ID order mismatch")
    for row in rows:
        row["companion_fit"] = records[str(row["contentid"])]["companion_fit"]
        row.setdefault("label_meta", {})["companion_method"] = "place-introduction relative five-level scoring; zero is the lowest suitability score, not an exclusion"

    distributions = {axis: Counter(row["companion_fit"][axis]["value"] for row in rows) for axis in AXES}
    for axis, counts in distributions.items():
        if set(counts) != VALUES:
            raise ValueError(f"global {axis}: missing five-level score(s): {sorted(VALUES - set(counts))}")
    merged = OUT / "relative_five_level_place_fit_labels.jsonl"
    merged.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n", encoding="utf-8")
    all_axes = [axis for row in rows for group in ("companion_fit", "month_fit") for axis in row[group].values()]
    counts = {
        "place_count": len(rows), "companion_axes": len(rows) * 5, "month_axes": len(rows) * 12,
        "axis_count": len(all_axes), "numeric_axis_count": sum(axis["state"] == "numeric" for axis in all_axes),
        "not_applicable_axis_count": sum(axis["state"] == "not_applicable" for axis in all_axes),
        "value_distribution": dict(Counter("not_applicable" if axis["state"] == "not_applicable" else str(axis["value"]) for axis in all_axes)),
        "companion_value_distribution_by_axis": {axis: {str(value): count for value, count in sorted(dist.items())} for axis, dist in distributions.items()},
    }
    manifest = {
        "version": "place-fit-relabel-v2-relative-five-level-companion",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "place-introduction review; zero denotes lowest relative suitability, not exclusion; month labels preserved",
        "review_inputs_sha256": {str(path.relative_to(ROOT)): sha256(path) for path in paths},
        "inputs_sha256": {}, "output_sha256": sha256(merged), "counts": counts,
    }
    (OUT / "relative_five_level_coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "relative_five_level_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not args.promote:
        print(f"WROTE {merged.relative_to(ROOT)} for review; rerun with --promote to replace the active labels")
        return
    backup = OUT / "place_fit_labels.before-relative-five-level.jsonl"
    if not backup.exists():
        backup.write_bytes(canonical.read_bytes())
    canonical.write_bytes(merged.read_bytes())
    promoted_manifest = dict(manifest)
    promoted_manifest["output_sha256"] = sha256(canonical)
    (OUT / "coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(promoted_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PROMOTED {len(rows)} places; all five Companion values present on every axis")


if __name__ == "__main__":
    main()
