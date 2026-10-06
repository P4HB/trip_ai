"""Refresh exact Kakao place-ID coordinates without modifying the crawl (SPEC-106)."""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from contextlib import closing, contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import build_restaurant_catalog as canonical

VERSION = "restaurant-coordinates-v1"
DEFAULT_CANONICAL = canonical.DEFAULT_OUTPUT
DEFAULT_OUTPUT = canonical.ROOT / "data/kakao/jeju/2026-10-06/restaurant-coordinates"
STATUSES = {"pending", "available", "missing", "unavailable", "identity_mismatch",
            "outside_jeju", "invalid_coordinates", "error"}
BLOCKED_CODES = {401, 403, 429}
KST = timezone(timedelta(hours=9))


def now():
    return datetime.now(KST).isoformat(timespec="seconds")


def endpoint(place_id):
    if not isinstance(place_id, str) or not place_id.isdigit():
        raise ValueError("Place IDs must be numeric strings")
    return "https://place.map.kakao.com/places/panel3/" + place_id


def load_targets(directory):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    path = directory / "places.jsonl"
    if canonical.file_digest(path) != manifest["files"]["places.jsonl"]["sha256"]:
        raise ValueError("Canonical places hash differs")
    targets = []
    with path.open(encoding="utf-8") as stream:
        for order, line in enumerate(stream):
            place = json.loads(line)
            if place["source_order"] != order or place["canonical_id"] != "kakao:" + place["place_id"]:
                raise ValueError("Invalid canonical target identity/order")
            endpoint(place["place_id"])
            targets.append({key: place[key] for key in ("canonical_id", "place_id", "source_order")})
    if len(targets) != manifest["counts"]["places"] or len({p["place_id"] for p in targets}) != len(targets):
        raise ValueError("Canonical target count/uniqueness differs")
    provenance = {"contract": manifest["contract"], "manifest_sha256": canonical.digest(manifest),
                  "places_sha256": canonical.file_digest(path), "targets_sha256": canonical.digest(targets),
                  "target_count": len(targets)}
    return targets, provenance


def pending_record(target):
    return {**target, "longitude": None, "latitude": None, "status": "pending", "observed": None,
            "source_url": endpoint(target["place_id"]), "checked_at": None, "http_status": None,
            "response_sha256": None, "attempts": 0, "error": None}


def finite_number(value):
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        return False


def parse_response(record, body, http_status):
    result = {**record, "longitude": None, "latitude": None, "status": "error", "observed": None,
              "checked_at": now(), "http_status": http_status, "response_sha256": hashlib.sha256(body).hexdigest(),
              "attempts": record["attempts"] + 1, "error": None}
    if http_status in (404, 410):
        result["status"] = "unavailable"
        return result
    if http_status != 200:
        result["error"] = f"HTTP {http_status}"
        return result
    try:
        payload = json.loads(body, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
        summary = payload.get("summary") if isinstance(payload, dict) else None
        if not isinstance(summary, dict):
            raise ValueError("Missing summary object; response contract may have changed")
        point = summary.get("point")
        address = summary.get("address") or {}
        if not isinstance(address, dict):
            raise ValueError("Invalid address object")
        regions = address.get("regions") or summary.get("regions") or []
        if not isinstance(regions, list):
            raise ValueError("Invalid regions list")
        region_names = [r.get("name", "") for r in regions if isinstance(r, dict) and r.get("depth") == 1]
        observed = {"place_id": str(summary.get("confirm_id", "")), "name": summary.get("name"),
                    "address": address.get("road") or address.get("disp") or "",
                    "regions": region_names, "provider_status": summary.get("status"), "point": point}
        result["observed"] = observed
        if observed["place_id"] != record["place_id"]:
            result["status"] = "identity_mismatch"
        elif point is None or (isinstance(point, dict) and (point.get("lon") is None or point.get("lat") is None)):
            result["status"] = "missing"
        elif (not isinstance(point, dict) or not finite_number(point.get("lon")) or not finite_number(point.get("lat"))
              or not -180 <= point["lon"] <= 180 or not -90 <= point["lat"] <= 90):
            result["status"] = "invalid_coordinates"
        elif (not 125 <= point["lon"] <= 127.5 or not 32.8 <= point["lat"] <= 34.2
              or not (str(observed["address"]).startswith("제주") or any(str(r).startswith("제주") for r in region_names))):
            result["status"] = "outside_jeju"
        else:
            result.update(status="available", longitude=float(point["lon"]), latitude=float(point["lat"]))
    except (ValueError, TypeError, AttributeError, UnicodeError) as exc:
        result["error"] = str(exc)[:300]
    return result


def fetch(record, timeout=20):
    request = Request(record["source_url"], headers={"Accept": "application/json", "appVersion": "6.6.0", "pf": "PC"})
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read(10_000_001)
            if len(body) > 10_000_000:
                raise ValueError("Response exceeds 10 MB")
            return parse_response(record, body, response.status)
    except HTTPError as exc:
        return parse_response(record, exc.read(100_000), exc.code)
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        return {**pending_record(record), "status": "error", "checked_at": now(),
                "attempts": record["attempts"] + 1, "error": str(exc)[:300]}


class RateLimiter:
    def __init__(self, interval, stop):
        self.interval, self.stop, self.lock, self.next_request = interval, stop, threading.Lock(), 0.0

    def call(self, record, fetcher):
        with self.lock:
            delay = max(0.0, self.next_request - time.monotonic())
            if self.stop.wait(delay):
                return None
            self.next_request = time.monotonic() + self.interval
        if self.stop.is_set():
            return None
        return fetcher(record)


@contextmanager
def output_lock(directory):
    lock = directory / ".collector.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise ValueError("Collector lock exists; verify the previous process ended before removing it") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(canonical.packed({"pid": os.getpid(), "started_at": now()}))
        yield
    finally:
        lock.unlink()


def atomic_text(path, value):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(value, encoding="utf-8", newline="\n")
    temporary.replace(path)


def initialize(conn, targets, provenance):
    conn.executescript("""CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS coordinates (place_id TEXT PRIMARY KEY, source_order INTEGER UNIQUE NOT NULL,
        status TEXT NOT NULL, attempts INTEGER NOT NULL, record_json TEXT NOT NULL);""")
    existing = dict(conn.execute("SELECT key,value FROM metadata"))
    expected = {"contract": canonical.packed(VERSION), "canonical": canonical.packed(provenance)}
    if existing:
        if existing != expected:
            raise ValueError("Checkpoint belongs to another input snapshot")
        rows = conn.execute("SELECT place_id,source_order FROM coordinates ORDER BY source_order").fetchall()
        if rows != [(r["place_id"], r["source_order"]) for r in targets]:
            raise ValueError("Checkpoint target identities differ")
    else:
        with conn:
            conn.executemany("INSERT INTO metadata VALUES (?,?)", expected.items())
            conn.executemany("INSERT INTO coordinates VALUES (?,?,?,?,?)",
                             ((p["place_id"], p["source_order"], "pending", 0, canonical.packed(pending_record(p))) for p in targets))


def export(conn, directory, provenance, run_state, reason=None):
    path = directory / "coordinates.jsonl"
    records = [json.loads(row[0]) for row in conn.execute("SELECT record_json FROM coordinates ORDER BY source_order")]
    atomic_text(path, "".join(canonical.packed(r) + "\n" for r in records))
    counts = {status: 0 for status in sorted(STATUSES)}
    counts.update(Counter(r["status"] for r in records))
    manifest = {"contract": VERSION, "updated_at": now(), "canonical": provenance,
                "target_count": len(records), "attempted_count": sum(r["attempts"] > 0 for r in records),
                "counts": counts, "run_state": run_state, "stop_reason": reason,
                "coordinates": {"crs": "WGS84", "order": ["longitude", "latitude"], "match": "exact place ID"},
                "files": {path.name: {"sha256": canonical.file_digest(path), "bytes": path.stat().st_size}},
                "storage": "local_only; coordinates.jsonl is the restore source; SQLite is a resume checkpoint"}
    manifest_path = directory / "manifest.json"
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if {k: v for k, v in previous.items() if k != "updated_at"} == {k: v for k, v in manifest.items() if k != "updated_at"}:
            return previous
    atomic_text(directory / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    return manifest


def collect(directory=DEFAULT_OUTPUT, *, canonical_dir=DEFAULT_CANONICAL, workers=4, interval=0.15,
            limit=None, retry_errors=False, fetcher=fetch):
    if not 1 <= workers <= 4 or interval < 0.1 or (limit is not None and limit < 1):
        raise ValueError("Use 1..4 workers, interval >= 0.1 seconds, positive optional limit")
    targets, provenance = load_targets(canonical_dir)
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    with output_lock(directory), closing(sqlite3.connect(directory / "coordinates.sqlite3")) as conn:
        initialize(conn, targets, provenance)
        statuses = ("pending", "error") if retry_errors else ("pending",)
        queue = [json.loads(row[0]) for row in conn.execute(
            f"SELECT record_json FROM coordinates WHERE status IN ({','.join('?' for _ in statuses)}) ORDER BY source_order", statuses)]
        if limit:
            queue = queue[:limit]
        if not queue:
            manifest = export(conn, directory, provenance, "pass_finished")
            print(json.dumps({"run_state": manifest["run_state"], "attempted": manifest["attempted_count"],
                              "total": len(targets), "counts": manifest["counts"]}), flush=True)
            return manifest
        export(conn, directory, provenance, "running")
        stop = threading.Event()
        limiter = RateLimiter(interval, stop)
        reason, completed, consecutive_errors = None, 0, 0
        if (directory / "STOP").exists():
            reason = "STOP file requested"
            stop.set()
        last_report = time.monotonic()
        iterator = iter(queue)
        futures = set()
        try:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                def submit_next():
                    item = next(iterator, None) if not stop.is_set() else None
                    if item is not None:
                        futures.add(pool.submit(limiter.call, item, fetcher))

                for _ in range(workers):
                    submit_next()
                while futures:
                    done, futures = wait(futures, timeout=0.5, return_when=FIRST_COMPLETED)
                    if (directory / "STOP").exists():
                        reason = "STOP file requested"
                        stop.set()
                    for future in done:
                        record = future.result()
                        if record is None:
                            continue
                        with conn:
                            conn.execute("UPDATE coordinates SET status=?,attempts=?,record_json=? WHERE place_id=?",
                                         (record["status"], record["attempts"], canonical.packed(record), record["place_id"]))
                        completed += 1
                        consecutive_errors = consecutive_errors + 1 if record["status"] == "error" else 0
                        if record["http_status"] in BLOCKED_CODES:
                            reason = f"Access restricted: HTTP {record['http_status']}"
                            stop.set()
                        elif consecutive_errors >= 5:
                            reason = "Five consecutive response/network errors"
                            stop.set()
                    if not stop.is_set():
                        for _ in done:
                            submit_next()
                    if time.monotonic() - last_report >= 15:
                        manifest = export(conn, directory, provenance, "running", reason)
                        print(json.dumps({"time": now(), "attempted": manifest["attempted_count"], "total": len(targets),
                                          "counts": manifest["counts"]}), flush=True)
                        last_report = time.monotonic()
        except BaseException:
            stop.set()
            export(conn, directory, provenance, "interrupted", "Unhandled interruption; resume from checkpoint")
            raise
        manifest = export(conn, directory, provenance, "stopped" if reason else "pass_finished", reason)
        print(json.dumps({"time": now(), "run_state": manifest["run_state"], "reason": reason,
                          "attempted": manifest["attempted_count"], "total": len(targets), "counts": manifest["counts"]}), flush=True)
        return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canonical-dir", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--interval", type=float, default=0.15)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--retry-errors", action="store_true")
    args = parser.parse_args()
    result = collect(args.output_dir, canonical_dir=args.canonical_dir, workers=args.workers, interval=args.interval,
                     limit=args.limit, retry_errors=args.retry_errors)
    if result["stop_reason"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
