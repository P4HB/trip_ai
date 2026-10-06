"""Validate every coordinate observation against its fixed canonical target list."""
from datetime import datetime
import json
from pathlib import Path
import re

import build_restaurant_catalog as canonical
import collect_restaurant_coordinates as coordinates
from validate_restaurant_catalog import require, unique_keys


def read_bundle(directory, canonical_dir, *, complete=True):
    directory = Path(directory)
    targets, provenance = coordinates.load_targets(canonical_dir)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"), object_pairs_hook=unique_keys)
    require(manifest["contract"] == coordinates.VERSION, "Coordinate contract differs")
    require(manifest["canonical"] == provenance, "Coordinate target provenance differs")
    require(manifest["coordinates"] == {"crs": "WGS84", "order": ["longitude", "latitude"], "match": "exact place ID"},
            "Coordinate reference system differs")
    path = directory / "coordinates.jsonl"
    require(set(manifest["files"]) == {path.name}, "Unexpected coordinate manifest files")
    require(manifest["files"][path.name] == {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size},
            "Coordinate file hash/size differs")
    with path.open(encoding="utf-8") as stream:
        records = [json.loads(line, object_pairs_hook=unique_keys) for line in stream]
    require(len(records) == len(targets) == manifest["target_count"], "Coordinate target count differs")
    counts = {status: 0 for status in sorted(coordinates.STATUSES)}
    for target, record in zip(targets, records):
        prefix = f"Coordinate {target['place_id']}"
        require(set(record) == set(coordinates.pending_record(target)), f"{prefix}: observation fields differ")
        require(all(record[key] == value for key, value in target.items()), f"{prefix}: identity/order differs")
        require(record["source_url"] == coordinates.endpoint(target["place_id"]), f"{prefix}: source URL differs")
        require(record["status"] in coordinates.STATUSES, f"{prefix}: unknown status")
        require(type(record["attempts"]) is int and record["attempts"] >= 0, f"{prefix}: invalid attempts")
        counts[record["status"]] += 1
        if record["status"] == "pending":
            require(record == coordinates.pending_record(target), f"{prefix}: pending observation is not empty")
            continue
        require(record["attempts"] > 0, f"{prefix}: unattempted result")
        require(isinstance(record["checked_at"], str) and datetime.fromisoformat(record["checked_at"]).utcoffset() is not None,
                f"{prefix}: missing timezone")
        code = record["http_status"]
        require(code is None or (type(code) is int and 100 <= code <= 599), f"{prefix}: invalid HTTP code")
        require((code is None and record["response_sha256"] is None) or
                (code is not None and isinstance(record["response_sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", record["response_sha256"])),
                f"{prefix}: response hash missing")
        require(record["error"] is None or isinstance(record["error"], str), f"{prefix}: invalid error")
        if record["status"] == "available":
            observed = record["observed"]
            require(code == 200 and record["error"] is None and isinstance(observed, dict), f"{prefix}: missing successful observation")
            require(observed["place_id"] == target["place_id"], f"{prefix}: observed ID differs")
            lon, lat = record["longitude"], record["latitude"]
            require(coordinates.finite_number(lon) and coordinates.finite_number(lat) and 125 <= lon <= 127.5 and 32.8 <= lat <= 34.2,
                    f"{prefix}: invalid WGS84 coordinates")
            require(observed["point"]["lon"] == lon and observed["point"]["lat"] == lat, f"{prefix}: observed coordinates differ")
            require(str(observed["address"]).startswith("제주") or any(str(r).startswith("제주") for r in observed["regions"]),
                    f"{prefix}: Jeju region missing")
        else:
            require(record["longitude"] is None and record["latitude"] is None, f"{prefix}: unresolved location must be null")
            if record["status"] == "unavailable":
                require(code in (404, 410), f"{prefix}: unavailable without 404/410")
            elif record["status"] == "error":
                require(bool(record["error"]), f"{prefix}: missing error reason")
            else:
                require(code == 200 and isinstance(record["observed"], dict), f"{prefix}: missing provider observation")
                observed = record["observed"]
                # Re-classify only the saved minimal observation, never a reconstructed full response.
                payload = {"summary": {"confirm_id": observed["place_id"], "name": observed["name"],
                    "address": {"road": observed["address"], "regions": [{"depth": 1, "name": r} for r in observed["regions"]]},
                    "status": observed["provider_status"], "point": observed["point"]}}
                parsed = coordinates.parse_response(coordinates.pending_record(target), canonical.packed(payload).encode("utf-8"), 200)
                require(parsed["status"] == record["status"], f"{prefix}: status differs from observation")
    require(counts == manifest["counts"], "Coordinate status counts differ")
    require(sum(record["attempts"] > 0 for record in records) == manifest["attempted_count"], "Coordinate attempted count differs")
    if complete:
        require(counts["pending"] == 0, "Coordinate collection still has pending targets")
    return manifest, records


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=coordinates.DEFAULT_OUTPUT)
    parser.add_argument("--canonical-dir", type=Path, default=coordinates.DEFAULT_CANONICAL)
    parser.add_argument("--allow-pending", action="store_true")
    args = parser.parse_args()
    manifest, _ = read_bundle(args.directory, args.canonical_dir, complete=not args.allow_pending)
    print(json.dumps({"valid": True, "target_count": manifest["target_count"], "counts": manifest["counts"]}, indent=2))
