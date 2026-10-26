"""Prepare stratified, source-grounded packs for calibrated Companion labeling."""

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "labeling" / "jeju" / "2026-08-09"
SOURCE = DATA / "place-fit-relabel-v2" / "audit_inputs"
OUT = DATA / "place-fit-relabel-v2" / "calibration_inputs"


def family(row: dict) -> str:
    if row["category"] == "FD05":
        return "cafe_unknown_intro"
    excerpt = row["source_excerpt"]
    if row["contenttypeid"] == "15":
        return "festival_event"
    if any(word in excerpt for word in ("오름", "해수욕장", "해안", "폭포", "동굴", "산", "트레킹", "둘레길", "올레")):
        return "outdoor_nature"
    if any(word in excerpt for word in ("박물관", "미술관", "전시", "문화", "역사", "유적")):
        return "culture_exhibition"
    if any(word in excerpt for word in ("체험", "놀이", "승마", "레저", "공방", "테마파크", "수족관")):
        return "activity_family"
    if any(word in excerpt for word in ("시장", "쇼핑", "문구", "기념품", "상점")):
        return "shopping_market"
    return "other_place"


def main() -> None:
    rows = []
    for path in sorted(SOURCE.glob("companion_audit_*.jsonl")):
        rows.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
    if len(rows) != 1664:
        raise ValueError(f"expected 1664 rows, got {len(rows)}")
    for row in rows:
        row["calibration_family"] = family(row)
    buckets = defaultdict(list)
    for row in rows:
        buckets[row["calibration_family"]].append(row)
    OUT.mkdir(parents=True, exist_ok=True)

    # First pack is stratified: up to 30 from every family. Remaining packs preserve family cohorts.
    sample = []
    remaining = {}
    for key in sorted(buckets):
        take = buckets[key][:30]
        sample.extend(take)
        remaining[key] = buckets[key][30:]
    sample.sort(key=lambda row: row["source_order"])
    (OUT / "calibration_sample.jsonl").write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in sample) + "\n", encoding="utf-8")

    pack_number = 1
    for key in sorted(remaining):
        values = remaining[key]
        for start in range(0, len(values), 50):
            pack = values[start:start + 50]
            path = OUT / f"{pack_number:02}_{key}.jsonl"
            path.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in pack) + "\n", encoding="utf-8")
            pack_number += 1
    report = {
        "total": len(rows),
        "families": dict(Counter(row["calibration_family"] for row in rows)),
        "sample_size": len(sample),
        "sample_families": dict(Counter(row["calibration_family"] for row in sample)),
    }
    (OUT / "calibration_plan.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
