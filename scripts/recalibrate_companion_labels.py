"""Apply independently recalibrated Companion labels to the 1,664-place JSONL."""

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09" / "place-fit-relabel-v2"
LABELS = BASE / "place_fit_labels.jsonl"
COMPANIONS = {"solo", "couple", "friends", "kids", "parents"}
VALUES = {0, 0.25, 0.5, 0.75, 1}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_axis(axis: dict, contentid: str, key: str) -> None:
    required = {"state", "value", "confidence", "status", "inference_level", "rationale", "evidence_ids", "rule_ids", "null_reason"}
    missing = required - axis.keys()
    if missing:
        raise ValueError(f"{contentid} {key}: missing {sorted(missing)}")
    if axis["state"] != "numeric" or axis["value"] not in VALUES:
        raise ValueError(f"{contentid} {key}: invalid score")
    if axis["status"] != "ai_draft" or not 0 <= axis["confidence"] <= 1:
        raise ValueError(f"{contentid} {key}: invalid metadata")
    if not axis["rationale"] or not axis["evidence_ids"] or not axis["rule_ids"]:
        raise ValueError(f"{contentid} {key}: empty provenance")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true", help="rewrite the active place_fit_labels.jsonl and manifest in place")
    if not parser.parse_args().promote:
        # This step only rewrites the active labels; an older generation would replace the current one.
        parser.error("refusing to overwrite the active labels without --promote")
    rows = [json.loads(line) for line in LABELS.read_text(encoding="utf-8").splitlines() if line.strip()]
    expected = [str(row["contentid"]) for row in rows]
    recalibrated: dict[str, dict] = {}
    paths = [BASE / "batches" / f"companion_recal_{number:02}.jsonl" for number in range(1, 7)]
    paths.append(BASE / "batches" / "companion_recal_07.jsonl")
    if any(not path.exists() for path in paths):
        raise ValueError("missing Companion recalibration batch")
    for path in paths:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            contentid = str(record["contentid"])
            if contentid in recalibrated:
                raise ValueError(f"duplicate {contentid}: {path}:{line_no}")
            companion = record.get("companion_fit", {})
            if set(companion) != COMPANIONS:
                raise ValueError(f"{contentid}: incomplete Companion axes")
            for key, axis in companion.items():
                validate_axis(axis, contentid, key)
            recalibrated[contentid] = companion
    if set(recalibrated) != set(expected):
        missing = [contentid for contentid in expected if contentid not in recalibrated]
        extra = [contentid for contentid in recalibrated if contentid not in set(expected)]
        raise ValueError(f"recalibration ID/order mismatch; missing={missing[:5]}, extra={extra[:5]}")

    backup = BASE / "place_fit_labels.companion-v1.jsonl"
    if not backup.exists():
        backup.write_bytes(LABELS.read_bytes())
    for row in rows:
        row["companion_fit"] = recalibrated[str(row["contentid"])]
        row.setdefault("label_meta", {})["companion_method"] = "place-by-place direct recalibration with explicit five-level anchors"

    lower_candidates = {
        (str(row["contentid"]), key)
        for row in rows
        for key, axis in row["companion_fit"].items()
        if axis["value"] == 0.25
    }
    lower_paths = [BASE / "batches" / f"zero_split_{number:02}.jsonl" for number in range(1, 7)]
    if any(not path.exists() for path in lower_paths):
        raise ValueError("missing lower-score split batch")
    lower_updates: dict[tuple[str, str], dict] = {}
    for path in lower_paths:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            update = json.loads(line)
            contentid, key, axis = str(update["contentid"]), update["axis_key"], update["axis"]
            pair = (contentid, key)
            if pair in lower_updates:
                raise ValueError(f"duplicate lower-score update {pair}: {path}:{line_no}")
            validate_axis(axis, contentid, key)
            if axis["value"] not in {0, 0.25}:
                raise ValueError(f"{pair}: lower split must be 0 or 0.25")
            lower_updates[pair] = axis
    if set(lower_updates) != lower_candidates:
        missing = sorted(lower_candidates - set(lower_updates))
        extra = sorted(set(lower_updates) - lower_candidates)
        raise ValueError(f"lower-score split mismatch; missing={missing[:5]}, extra={extra[:5]}")
    for row in rows:
        for key in COMPANIONS:
            pair = (str(row["contentid"]), key)
            if pair in lower_updates:
                row["companion_fit"][key] = lower_updates[pair]
            value = row["companion_fit"][key]["value"]
            if value in (0, 1):
                row["companion_fit"][key]["value"] = int(value)

    LABELS.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n", encoding="utf-8")
    axes = [axis for row in rows for group in ("companion_fit", "month_fit") for axis in row[group].values()]
    distribution = Counter("not_applicable" if axis["state"] == "not_applicable" else str(axis["value"]) for axis in axes)
    companion_distribution = Counter(str(axis["value"]) for row in rows for axis in row["companion_fit"].values())
    counts = {
        "place_count": len(rows),
        "companion_axes": len(rows) * 5,
        "month_axes": len(rows) * 12,
        "axis_count": len(axes),
        "numeric_axis_count": sum(axis["state"] == "numeric" for axis in axes),
        "not_applicable_axis_count": sum(axis["state"] == "not_applicable" for axis in axes),
        "value_distribution": dict(distribution),
        "companion_value_distribution": dict(companion_distribution),
    }
    (BASE / "coverage_report.json").write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "version": "place-fit-relabel-v2-direct-5level-companion-recalibrated",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "place-by-place direct companion review with explicit five-level anchors",
        "inputs_sha256": {},
        "companion_batch_sha256": {str(path.relative_to(ROOT)): sha256(path) for path in paths},
        "lower_score_split_sha256": {str(path.relative_to(ROOT)): sha256(path) for path in lower_paths},
        "output_sha256": sha256(LABELS),
        "counts": counts,
    }
    (BASE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"UPDATED: {len(rows)} places; Companion distribution={dict(companion_distribution)}")


if __name__ == "__main__":
    main()
