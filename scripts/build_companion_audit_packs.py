"""Create source-text audit packs for deliberate Companion relabeling."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "labeling" / "jeju" / "2026-08-09"
OUT = DATA / "place-fit-relabel-v2" / "audit_inputs"
PACK_SIZE = 100


def compact(value: object, limit: int = 1800) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":")) if isinstance(value, (dict, list)) else str(value or "")
    return text[:limit]


def main() -> None:
    non_restaurants = json.loads((DATA / "non_restaurants.json").read_text(encoding="utf-8"))
    restaurants = json.loads((DATA / "restaurants.json").read_text(encoding="utf-8"))
    places = non_restaurants + [place for place in restaurants if place.get("lclsSystm2") == "FD05"]
    research = {
        str(row["contentid"]): row
        for row in (json.loads(line) for line in (DATA / "full" / "place-profile-v1-all-1434" / "place_web_research.jsonl").read_text(encoding="utf-8").splitlines() if line.strip())
    }
    OUT.mkdir(parents=True, exist_ok=True)
    packs: list[list[dict]] = []
    for index, place in enumerate(places):
        contentid = str(place["contentid"])
        source = research.get(contentid)
        if source:
            claims = [claim for item in source.get("sources", []) for claim in item.get("claims", [])]
            source_excerpt = "\n".join(
                part for part in [
                    source.get("summary", ""),
                    source.get("typical_visit", ""),
                    compact(source.get("facts", {})),
                    "\n".join(claims[:3]),
                ] if part
            )[:6000]
            evidence_ids = [item.get("source_id") for item in source.get("sources", []) if item.get("source_id")] or [f"place:{contentid}"]
            unknowns = source.get("unknowns", [])
            status = source.get("research_status", "unknown")
        else:
            source_excerpt = "소개 원문·웹 조사 facts가 없음. TourAPI 기본 메타데이터만 제공됨."
            evidence_ids = [f"tourapi:{contentid}"]
            unknowns = ["장소 소개 원문 없음", "동행 조건 직접 근거 없음"]
            status = "not_researched"
        packs.append([{
            "source_order": index,
            "contentid": contentid,
            "title": place.get("title", ""),
            "contenttypeid": str(place.get("contenttypeid", "")),
            "category": place.get("lclsSystm2", ""),
            "research_status": status,
            "source_excerpt": source_excerpt,
            "unknowns": unknowns,
            "evidence_ids": evidence_ids,
        }])
    flattened = [row for pack in packs for row in pack]
    for start in range(0, len(flattened), PACK_SIZE):
        number = start // PACK_SIZE + 1
        path = OUT / f"companion_audit_{number:02}.jsonl"
        path.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in flattened[start:start + PACK_SIZE]) + "\n", encoding="utf-8")
    print(f"WROTE: {len(flattened)} places in {(len(flattened) + PACK_SIZE - 1) // PACK_SIZE} audit packs -> {OUT}")


if __name__ == "__main__":
    main()
