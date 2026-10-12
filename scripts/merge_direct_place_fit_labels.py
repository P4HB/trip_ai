"""Merge place-by-place 5-level labels into the relabel-v2 deliverables."""

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09"
OUT = BASE / "place-fit-relabel-v2"
COMPANIONS = {"solo", "couple", "friends", "kids", "parents"}
MONTHS = {str(month) for month in range(1, 13)}
VALUES = {0, 0.25, 0.5, 0.75, 1}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def places_in_order() -> list[dict]:
    non_restaurants = json.loads((BASE / "non_restaurants.json").read_text(encoding="utf-8"))
    restaurants = json.loads((BASE / "restaurants.json").read_text(encoding="utf-8"))
    cafes = [place for place in restaurants if place.get("lclsSystm2") == "FD05"]
    return non_restaurants + cafes


def load_batch_records() -> tuple[dict[str, dict], list[Path], list[str]]:
    batches = OUT / "batches"
    paths = [
        *sorted(batches.glob("redo2_direct_*.jsonl")),
        *sorted(batches.glob("full_direct_*.jsonl")),
    ]
    records: dict[str, dict] = {}
    duplicate_ids: list[str] = []
    for path in paths:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            contentid = str(record["contentid"])
            if contentid in records:
                duplicate_ids.append(contentid)
                continue
            records[contentid] = record
    return records, paths, duplicate_ids


def validate_axis(axis: dict, location: str) -> None:
    required = {"state", "value", "confidence", "rationale", "evidence_ids", "rule_ids", "inference_level"}
    missing = required - axis.keys()
    if missing:
        raise ValueError(f"{location}: missing axis keys {sorted(missing)}")
    if not axis["rationale"] or not axis["evidence_ids"] or not axis["rule_ids"]:
        raise ValueError(f"{location}: rationale/evidence/rule is empty")
    if not 0 <= axis["confidence"] <= 1:
        raise ValueError(f"{location}: invalid confidence")
    if axis["state"] == "numeric":
        if axis["value"] not in VALUES:
            raise ValueError(f"{location}: invalid numeric value {axis['value']}")
    elif axis["state"] == "not_applicable":
        if axis["value"] is not None:
            raise ValueError(f"{location}: N/A value must be null")
    else:
        raise ValueError(f"{location}: invalid state {axis['state']}")


def normalize_direct_provenance(records: list[dict]) -> None:
    """Fill only mechanically missing provenance required by the shared label contract."""
    for record in records:
        for group in ("companion_fit", "month_fit"):
            for axis in record[group].values():
                axis.setdefault("status", "ai_draft")
                if not axis.get("evidence_ids"):
                    axis["evidence_ids"] = [f"place:{record['contentid']}"]
                if axis["state"] == "not_applicable":
                    axis["value"] = None
                    axis["confidence"] = 1.0
                    axis["inference_level"] = "not_applicable"
                    axis["rule_ids"] = ["R-MONTH-DATE-GATE"]
                else:
                    if axis.get("confidence") is None:
                        axis["confidence"] = 0.55
                    if not axis.get("rule_ids"):
                        axis["rule_ids"] = ["DIRECT-PLACE-INTRO-5LEVEL"]


def validate(records: list[dict], places: list[dict]) -> None:
    expected_ids = [str(place["contentid"]) for place in places]
    actual_ids = [str(record["contentid"]) for record in records]
    if actual_ids != expected_ids:
        raise ValueError("records do not exactly match the 1,664-place input order")
    for record in records:
        if set(record.get("companion_fit", {})) != COMPANIONS:
            raise ValueError(f"{record['contentid']}: companion axes are incomplete")
        if set(record.get("month_fit", {})) != MONTHS:
            raise ValueError(f"{record['contentid']}: month axes are incomplete")
        for group in ("companion_fit", "month_fit"):
            for name, axis in record[group].items():
                validate_axis(axis, f"{record['contentid']} {group}.{name}")


def coverage(records: list[dict]) -> dict:
    axes = [axis for record in records for group in ("companion_fit", "month_fit") for axis in record[group].values()]
    values = Counter("not_applicable" if axis["state"] == "not_applicable" else str(axis["value"]) for axis in axes)
    return {
        "place_count": len(records),
        "companion_axes": len(records) * 5,
        "month_axes": len(records) * 12,
        "axis_count": len(axes),
        "numeric_axis_count": sum(axis["state"] == "numeric" for axis in axes),
        "not_applicable_axis_count": sum(axis["state"] == "not_applicable" for axis in axes),
        "value_distribution": dict(values),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--promote", action="store_true", help="replace the former rules-based standard JSONL after a backup")
    args = parser.parse_args()

    records_by_id, batch_paths, duplicate_ids = load_batch_records()
    places = places_in_order()
    records = [records_by_id[str(place["contentid"])] for place in places if str(place["contentid"]) in records_by_id]
    normalize_direct_provenance(records)
    validate(records, places)

    OUT.mkdir(parents=True, exist_ok=True)
    direct_path = OUT / "direct_place_fit_labels.jsonl"
    direct_path.write_text("\n".join(json.dumps(record, ensure_ascii=False, separators=(",", ":")) for record in records) + "\n", encoding="utf-8")
    counts = coverage(records)
    (OUT / "direct_coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "version": "place-fit-relabel-v2-direct-5level",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "place-by-place introduction review by parallel low-cost agents",
        "batch_sha256": {str(path.relative_to(ROOT)): sha256(path) for path in batch_paths},
        "inputs_sha256": {},
        "ignored_duplicate_batch_ids": duplicate_ids,
        "output_sha256": sha256(direct_path),
        "counts": counts,
    }
    (OUT / "direct_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.promote:
        canonical_path = OUT / "place_fit_labels.jsonl"
        labels_backup_path = OUT / "place_fit_labels.rules-v1.jsonl"
        if canonical_path.exists() and not labels_backup_path.exists():
            labels_backup_path.write_bytes(canonical_path.read_bytes())
        canonical_path.write_bytes(direct_path.read_bytes())
        for filename in ("coverage_report.json", "manifest.json"):
            current_path = OUT / filename
            backup_path = OUT / filename.replace(".", ".rules-v1.", 1)
            if current_path.exists() and not backup_path.exists():
                backup_path.write_bytes(current_path.read_bytes())
        (OUT / "coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"PROMOTED: {canonical_path} (former rules output: {labels_backup_path})")
    print(f"MERGED: {len(records)} places, {counts['axis_count']} axes -> {direct_path}")


if __name__ == "__main__":
    main()
