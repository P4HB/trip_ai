#!/usr/bin/env python3
"""Collect the complete Jeju base-place dataset from KTO TourAPI.

The API key is loaded from .env.local (or KTO_TOUR_API_KEY in the process
environment) and is never written to the output files.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen


API_URL = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
JEJU_LDONG_REGION_CODE = "50"
KST = timezone(timedelta(hours=9))
CONTENT_TYPE_NAMES = {
    "12": "관광지",
    "14": "문화시설",
    "15": "축제공연행사",
    "25": "여행코스",
    "28": "레포츠",
    "32": "숙박",
    "38": "쇼핑",
    "39": "음식점",
}
PREFERRED_COLUMNS = [
    "contentid",
    "contenttypeid",
    "title",
    "addr1",
    "addr2",
    "zipcode",
    "tel",
    "mapx",
    "mapy",
    "mlevel",
    "firstimage",
    "firstimage2",
    "cpyrhtDivCd",
    "createdtime",
    "modifiedtime",
    "areacode",
    "sigungucode",
    "lDongRegnCd",
    "lDongSignguCd",
    "cat1",
    "cat2",
    "cat3",
    "lclsSystm1",
    "lclsSystm2",
    "lclsSystm3",
]
JEJU_COORDINATE_BOUNDS = {
    "min_longitude": 125.0,
    "max_longitude": 127.5,
    "min_latitude": 32.5,
    "max_latitude": 34.5,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(".env.local"),
        help="Path containing KTO_TOUR_API_KEY (default: .env.local)",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("data/tourapi/jeju"),
        help="Root directory for dated snapshots",
    )
    parser.add_argument(
        "--rows-per-page",
        type=int,
        default=1000,
        help="TourAPI page size (default: 1000)",
    )
    return parser.parse_args()


def load_service_key(env_file: Path) -> str:
    key = os.environ.get("KTO_TOUR_API_KEY", "").strip()
    if not key and env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == "KTO_TOUR_API_KEY":
                key = value.strip().strip('"').strip("'")
                break
    if not key:
        raise RuntimeError(
            f"KTO_TOUR_API_KEY was not found in the environment or {env_file}"
        )
    # data.go.kr may show an already URL-encoded key. Decode once, then let
    # urlencode encode the query parameter exactly once.
    return unquote(key)


def request_page(service_key: str, page_no: int, rows_per_page: int) -> dict[str, Any]:
    params = {
        "serviceKey": service_key,
        "MobileOS": "ETC",
        "MobileApp": "TravelDestinationAI",
        "_type": "json",
        "pageNo": page_no,
        "numOfRows": rows_per_page,
        "arrange": "A",
        "lDongRegnCd": JEJU_LDONG_REGION_CODE,
    }
    request = Request(
        f"{API_URL}?{urlencode(params)}",
        headers={"User-Agent": "TravelDestinationAI/0.1"},
    )
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            header = payload.get("response", {}).get("header", {})
            if header.get("resultCode") != "0000":
                raise RuntimeError(
                    f"TourAPI error {header.get('resultCode')}: {header.get('resultMsg')}"
                )
            return payload
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
            if attempt == 3:
                break
            time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Failed to fetch page {page_no}: {last_error}")


def response_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = (
        payload.get("response", {})
        .get("body", {})
        .get("items", {})
        .get("item", [])
    )
    if not raw_items:
        return []
    if isinstance(raw_items, dict):
        return [raw_items]
    return list(raw_items)


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def coordinate_issue(item: dict[str, Any]) -> str | None:
    mapx = item.get("mapx")
    mapy = item.get("mapy")
    if mapx in (None, "") or mapy in (None, ""):
        return "missing_coordinate"
    try:
        longitude = float(mapx)
        latitude = float(mapy)
    except (TypeError, ValueError):
        return "non_numeric_coordinate"
    bounds = JEJU_COORDINATE_BOUNDS
    if not (
        bounds["min_longitude"] <= longitude <= bounds["max_longitude"]
        and bounds["min_latitude"] <= latitude <= bounds["max_latitude"]
    ):
        return "outside_jeju_bounds"
    return None


def main() -> int:
    args = parse_args()
    if args.rows_per_page < 1:
        raise ValueError("--rows-per-page must be positive")

    service_key = load_service_key(args.env_file)
    fetched_at = datetime.now(KST)
    snapshot_dir = args.output_root / fetched_at.date().isoformat()
    raw_dir = snapshot_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    first_payload = request_page(service_key, 1, args.rows_per_page)
    body = first_payload["response"]["body"]
    expected_total = int(body["totalCount"])
    total_pages = max(1, (expected_total + args.rows_per_page - 1) // args.rows_per_page)

    payloads = [first_payload]
    write_json(raw_dir / "area_based_page_001.json", first_payload)
    print(f"Fetched page 1/{total_pages}")
    for page_no in range(2, total_pages + 1):
        payload = request_page(service_key, page_no, args.rows_per_page)
        payloads.append(payload)
        write_json(raw_dir / f"area_based_page_{page_no:03d}.json", payload)
        print(f"Fetched page {page_no}/{total_pages}")

    collected = [item for payload in payloads for item in response_items(payload)]
    content_ids = [str(item.get("contentid", "")) for item in collected]
    id_counts = Counter(content_ids)
    duplicates = sorted(key for key, count in id_counts.items() if key and count > 1)
    missing_ids = sum(1 for value in content_ids if not value)

    if len(collected) != expected_total:
        raise RuntimeError(
            f"Collection incomplete: expected {expected_total}, received {len(collected)}"
        )
    if duplicates or missing_ids:
        raise RuntimeError(
            f"Invalid IDs: {len(duplicates)} duplicates, {missing_ids} missing"
        )

    places = sorted(collected, key=lambda item: int(str(item["contentid"])))
    json_path = snapshot_dir / "jeju_places.json"
    jsonl_path = snapshot_dir / "jeju_places.jsonl"
    csv_path = snapshot_dir / "jeju_places.csv"
    quality_path = snapshot_dir / "quality_issues.csv"
    write_json(json_path, places)

    with jsonl_path.open("w", encoding="utf-8", newline="\n") as stream:
        for item in places:
            stream.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")

    extra_columns = sorted(
        {key for item in places for key in item.keys()} - set(PREFERRED_COLUMNS)
    )
    columns = PREFERRED_COLUMNS + extra_columns
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(places)

    quality_issues = [
        {
            "contentid": item.get("contentid", ""),
            "title": item.get("title", ""),
            "contenttypeid": item.get("contenttypeid", ""),
            "addr1": item.get("addr1", ""),
            "mapx": item.get("mapx", ""),
            "mapy": item.get("mapy", ""),
            "issue": issue,
        }
        for item in places
        if (issue := coordinate_issue(item)) is not None
    ]
    with quality_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=[
                "contentid",
                "title",
                "contenttypeid",
                "addr1",
                "mapx",
                "mapy",
                "issue",
            ],
        )
        writer.writeheader()
        writer.writerows(quality_issues)

    type_counts_raw = Counter(str(item.get("contenttypeid", "")) for item in places)
    type_counts = {
        type_id: {
            "name": CONTENT_TYPE_NAMES.get(type_id, "미분류"),
            "count": type_counts_raw.get(type_id, 0),
        }
        for type_id in sorted(CONTENT_TYPE_NAMES)
    }
    missing_coordinate_count = sum(
        1 for item in places if not item.get("mapx") or not item.get("mapy")
    )
    invalid_coordinate_ids = [
        str(issue["contentid"])
        for issue in quality_issues
        if issue["issue"] != "missing_coordinate"
    ]

    manifest_path = snapshot_dir / "manifest.json"
    manifest = {
        "source": "한국관광공사 국문 관광정보 서비스_GW (KorService2)",
        "endpoint": API_URL,
        "fetched_at": fetched_at.isoformat(),
        "request_filter": {
            "lDongRegnCd": JEJU_LDONG_REGION_CODE,
            "arrange": "A",
            "rows_per_page": args.rows_per_page,
        },
        "expected_total_count": expected_total,
        "collected_count": len(places),
        "unique_contentid_count": len(id_counts),
        "duplicate_contentid_count": len(duplicates),
        "missing_contentid_count": missing_ids,
        "missing_coordinate_count": missing_coordinate_count,
        "invalid_coordinate_count": len(invalid_coordinate_ids),
        "invalid_coordinate_contentids": invalid_coordinate_ids,
        "coordinate_validation_bounds": JEJU_COORDINATE_BOUNDS,
        "content_type_counts": type_counts,
        "files": {},
    }
    for path in [json_path, jsonl_path, csv_path, quality_path]:
        manifest["files"][path.name] = {
            "bytes": path.stat().st_size,
            "sha256": file_sha256(path),
        }
    write_json(manifest_path, manifest)

    print(
        json.dumps(
            {
                "snapshot_dir": str(snapshot_dir),
                "collected_count": len(places),
                "missing_coordinate_count": missing_coordinate_count,
                "invalid_coordinate_count": len(invalid_coordinate_ids),
                "content_type_counts": {
                    value["name"]: value["count"] for value in type_counts.values()
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # Keep CLI errors concise and avoid leaking URLs/keys.
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
