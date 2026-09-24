#!/usr/bin/env python3
"""Collect resumable, separate TourAPI introduction sidecars (never edits base data)."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import Request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/travel-feedback"))
from llm_client import ProviderError, request_json
from place_time_data import normalize_introduction

ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/detailIntro2"


def atomic_write(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def collect_one(place, api_key, timeout=15):
    place_id, kind = str(place["placeId"]), str(place["contentTypeId"])
    params = {"serviceKey": unquote(api_key), "MobileOS": "ETC", "MobileApp": "TripAI",
              "_type": "json", "contentId": place_id, "contentTypeId": kind, "numOfRows": 10, "pageNo": 1}
    request = Request(ENDPOINT + "?" + urlencode(params), headers={"Accept": "application/json"})
    response = request_json(request, timeout)
    body = response.get("response", {})
    if body.get("header", {}).get("resultCode") not in ("0000", "00"):
        raise ProviderError("tourapi_unsuccessful_response")
    items = body.get("body", {}).get("items", {})
    rows = items.get("item", []) if isinstance(items, dict) else []
    if isinstance(rows, dict):
        rows = [rows]
    if len(rows) != 1 or str(rows[0].get("contentid")) != place_id:
        raise ProviderError("tourapi_missing_or_mismatched_place")
    raw = {**rows[0], "contenttypeid": kind}
    checked_at = datetime.now(timezone.utc).isoformat()
    source_ref = {"provider": "TourAPI", "endpoint": ENDPOINT, "contentId": place_id, "contentTypeId": kind}
    result = {"placeId": place_id, "collectionStatus": "collected", "checkedAt": checked_at,
              "sourceRef": source_ref, "raw": raw, **normalize_introduction(raw, source_ref, checked_at)}
    result["rawHash"] = hashlib.sha256(json.dumps(raw, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "server/travel-feedback/data/itinerary_catalog.json")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/itinerary/operating")
    parser.add_argument("--place-id", action="append", default=[])
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    candidates = [p for p in catalog["places"] if not args.place_id or p["placeId"] in args.place_id]
    if not 1 <= args.limit <= 1000:
        parser.error("limit must be 1..1000")
    pending = [p for p in candidates if args.refresh or not (args.output_dir / (p["placeId"] + ".json")).exists()][:args.limit]
    if args.dry_run:
        print(json.dumps({"mode": "dry_run", "selectedCount": len(pending), "apiCalls": 0}))
        return
    api_key = os.environ.get("KTO_TOUR_API_KEY", "")
    if not api_key:
        parser.error("KTO_TOUR_API_KEY must be configured in the server environment")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    counts = Counter()
    errors = []
    for place in pending:
        try:
            result = collect_one(place, api_key)
            atomic_write(args.output_dir / (place["placeId"] + ".json"), result)
            counts[result["operatingInfo"]["status"]] += 1
        except ProviderError as error:
            errors.append({"placeId": place["placeId"], "code": error.code})
    manifest = {"schemaVersion": "place-operating-collection-v1", "updatedAt": datetime.now(timezone.utc).isoformat(),
                "attempted": len(pending), "counts": dict(counts), "errors": errors,
                "note": "Ambiguous hours, seasonal text and holidays need source-backed curated normalization."}
    atomic_write(args.output_dir / "manifest.json", manifest)
    print(json.dumps({"attempted": len(pending), "counts": dict(counts), "failed": len(errors)}))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
