"""Merge calibrated Companion labels while preserving existing Month labels.

This script intentionally refuses partial inputs.  The canonical JSONL changes only
when every one of the 1,664 expected content IDs has exactly one calibrated result.
"""

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09"
OUT = BASE / "place-fit-relabel-v2"
CALIBRATION = OUT / "calibration_outputs"
REVIEWED = CALIBRATION / "reviewed"
COMPANIONS = ("solo", "couple", "friends", "kids", "parents")
VALUES = {0, 0.25, 0.5, 0.75, 1}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    # Some agent-produced JSONL files include a UTF-8 BOM.  It is harmless
    # content-wise, but json.loads rejects it on the first line.
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def expected_ids() -> list[str]:
    non_restaurants = json.loads((BASE / "non_restaurants.json").read_text(encoding="utf-8"))
    restaurants = json.loads((BASE / "restaurants.json").read_text(encoding="utf-8"))
    cafes = [place for place in restaurants if place.get("lclsSystm2") == "FD05"]
    return [str(place["contentid"]) for place in [*non_restaurants, *cafes]]


def source_paths() -> list[Path]:
    calibration = [
        CALIBRATION / "calibrate_activity.jsonl",
        CALIBRATION / "calibrate_outdoor.jsonl",
        CALIBRATION / "calibrate_culture.jsonl",
        CALIBRATION / "calibrate_market.jsonl",
        CALIBRATION / "calibrate_other_event.jsonl",
        CALIBRATION / "calibrate_cafe.jsonl",
    ]
    return [*calibration, *sorted(REVIEWED.glob("reviewed_calibrated_batch_*.jsonl"))]


def validate_companion(record: dict, path: Path, line_no: int) -> None:
    axes = record.get("companion_fit")
    if set(axes or {}) != set(COMPANIONS):
        raise ValueError(f"{path.name}:{line_no}: incomplete Companion axes")
    for axis_name, axis in axes.items():
        missing = {"state", "value", "confidence", "status", "inference_level", "rationale", "evidence_ids", "rule_ids"} - set(axis)
        if missing:
            raise ValueError(f"{path.name}:{line_no}:{axis_name}: missing {sorted(missing)}")
        if axis["state"] != "numeric" or axis["value"] not in VALUES:
            raise ValueError(f"{path.name}:{line_no}:{axis_name}: Companion must be a permitted numeric score")
        if not 0 <= axis["confidence"] <= 1 or not axis["rationale"] or not axis["evidence_ids"] or not axis["rule_ids"]:
            raise ValueError(f"{path.name}:{line_no}:{axis_name}: invalid provenance")


def load_companion_records(paths: list[Path]) -> dict[str, dict]:
    records: dict[str, dict] = {}
    missing_files = [path for path in paths if not path.exists()]
    if missing_files:
        raise ValueError("missing calibrated inputs: " + ", ".join(path.name for path in missing_files))
    for path in paths:
        for line_no, record in enumerate(load_jsonl(path), start=1):
            validate_companion(record, path, line_no)
            contentid = str(record["contentid"])
            if contentid in records:
                raise ValueError(f"duplicate calibrated contentid {contentid}: {path.name}")
            records[contentid] = record
    return records


def coverage(rows: list[dict], companion_sources: dict[str, dict]) -> dict:
    all_axes = [axis for row in rows for group in ("companion_fit", "month_fit") for axis in row[group].values()]
    value_distribution = Counter("not_applicable" if axis["state"] == "not_applicable" else str(axis["value"]) for axis in all_axes)
    per_axis = {
        axis_name: dict(Counter(str(row["companion_fit"][axis_name]["value"]) for row in rows))
        for axis_name in COMPANIONS
    }
    by_family: dict[str, dict] = {}
    for contentid, source in companion_sources.items():
        family = source.get("calibration_family", "calibration_sample")
        entry = by_family.setdefault(family, {axis: Counter() for axis in COMPANIONS})
        for axis_name in COMPANIONS:
            entry[axis_name][str(source["companion_fit"][axis_name]["value"])] += 1
    return {
        "place_count": len(rows),
        "companion_axes": len(rows) * len(COMPANIONS),
        "month_axes": len(rows) * 12,
        "axis_count": len(all_axes),
        "numeric_axis_count": sum(axis["state"] == "numeric" for axis in all_axes),
        "not_applicable_axis_count": sum(axis["state"] == "not_applicable" for axis in all_axes),
        "value_distribution": dict(value_distribution),
        "companion_value_distribution_by_axis": per_axis,
        "companion_value_distribution_by_family": {
            family: {axis: dict(counter) for axis, counter in axes.items()} for family, axes in by_family.items()
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--promote", action="store_true", help="replace canonical JSONL after a one-time backup")
    args = parser.parse_args()

    paths = source_paths()
    companions = load_companion_records(paths)
    expected = expected_ids()
    expected_set = set(expected)
    actual_set = set(companions)
    if actual_set != expected_set:
        missing = sorted(expected_set - actual_set)
        unexpected = sorted(actual_set - expected_set)
        raise ValueError(f"calibrated inputs are incomplete: {len(missing)} missing, {len(unexpected)} unexpected")

    canonical = OUT / "place_fit_labels.jsonl"
    rows = load_jsonl(canonical)
    if [str(row["contentid"]) for row in rows] != expected:
        raise ValueError("canonical JSONL does not match expected 1,664-place source order")
    for row in rows:
        source = companions[str(row["contentid"])]
        row["companion_fit"] = source["companion_fit"]
        for axis in row["companion_fit"].values():
            # A few review workers used synonymous provenance terms.  The
            # canonical contract has a closed vocabulary for extreme scores.
            if axis["value"] in (0, 1):
                if axis["inference_level"] in {"direct", "direct_constraint"}:
                    axis["inference_level"] = "direct_evidence"
                elif axis["inference_level"] not in {"direct_evidence", "researched_inference", "climate_heuristic", "unknown"}:
                    axis["inference_level"] = "researched_inference"
        meta = row.setdefault("label_meta", {})
        meta["companion_method"] = "calibrated place-introduction review with family-aware range checks and boundary re-review"

    merged_path = OUT / "calibrated_companion_place_fit_labels.jsonl"
    merged_path.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n", encoding="utf-8")
    counts = coverage(rows, companions)
    report_path = OUT / "calibrated_companion_coverage_report.json"
    report_path.write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "version": "place-fit-relabel-v2-calibrated-companion-5level",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "calibration samples plus per-place family-aware review and boundary re-review; month labels preserved",
        "review_inputs_sha256": {str(path.relative_to(ROOT)): sha256(path) for path in paths},
        "inputs_sha256": {},
        "output_sha256": sha256(merged_path),
        "counts": counts,
    }
    manifest_path = OUT / "calibrated_companion_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.promote:
        backup = OUT / "place_fit_labels.companion-fast-v2.jsonl"
        if not backup.exists():
            backup.write_bytes(canonical.read_bytes())
        canonical.write_bytes(merged_path.read_bytes())
        promoted_manifest = dict(manifest)
        promoted_manifest["output_sha256"] = sha256(canonical)
        (OUT / "coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (OUT / "manifest.json").write_text(json.dumps(promoted_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"PROMOTED: {canonical}")
    print(f"MERGED: {len(rows)} places from {len(paths)} calibrated inputs -> {merged_path}")


if __name__ == "__main__":
    main()
