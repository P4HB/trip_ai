#!/usr/bin/env python3
"""Persist public review visit insights; unchanged source/model/prompt inputs are reused."""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/travel-feedback"))
from llm_client import OpenAIClient, ProviderError
from visit_insights import (PROMPT_VERSION, SANITIZER_VERSION, SCHEMA_VERSION, analyze_reviews,
                            input_hash, prepared_reviews, unknown_insights, validate_insights)


def load_reviews(database):
    with sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute("SELECT DISTINCT p.contentid, r.review_id, r.content FROM place_links p JOIN reviews r USING(kakao_place_id) ORDER BY p.contentid, r.review_id")
        by_place = {}
        for row in rows:
            by_place.setdefault(row["contentid"], []).append({"review_id": row["review_id"], "content": row["content"]})
    return by_place


def review_metadata(database):
    with sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True) as connection:
        if not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='metadata'").fetchone():
            return {}
        values = dict(connection.execute("SELECT key, value FROM metadata"))
    return {"collectedAt": values.get("collected_at"), "reviewLimitPerPlace": values.get("review_limit_per_place"),
            "schemaVersion": values.get("schema_version")}


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def validate_store(store, by_place, database_hash):
    """Reject stale/forged source links before embedding a persisted analysis in the catalog."""
    if store.get("schemaVersion") != SCHEMA_VERSION or store.get("sourceDatabaseHash") != database_hash:
        raise ValueError("insight_source_version_mismatch")
    records = store.get("places")
    if not isinstance(records, dict):
        raise ValueError("insight_invalid_store")
    for place_id, record in records.items():
        reviews = by_place.get(place_id)
        if reviews is None or not isinstance(record, dict):
            raise ValueError("insight_unauthorized_place")
        if (record.get("schemaVersion") != SCHEMA_VERSION or record.get("promptVersion") != PROMPT_VERSION
                or record.get("sanitizerVersion") != SANITIZER_VERSION or not isinstance(record.get("model"), str)
                or record.get("inputHash") != input_hash(reviews, record.get("model"))):
            raise ValueError("insight_stale_input")
        status = record.get("status")
        if status not in ("unknown", "conflict", "inferred") or record.get("kind") != "review_inference":
            raise ValueError("insight_invalid_status")
        allowed = {r["review_id"] for r in reviews}
        evidence = record.get("evidenceReviewIds", [])
        if not isinstance(evidence, list) or len(evidence) != len(set(evidence)) or set(evidence) - allowed:
            raise ValueError("insight_unauthorized_review")
        if status in ("unknown", "conflict"):
            if record.get("preferredPeriods") != [] or record.get("dwellMinutes") is not None:
                raise ValueError("insight_uncertain_claim")
            if status == "unknown" and evidence:
                raise ValueError("insight_unknown_has_evidence")
        else:
            if not record.get("analyzedAt"):
                raise ValueError("insight_missing_timestamp")
            derived = validate_insights({"preferredPeriods": record.get("preferredPeriods"),
                                         "dwellMinutes": record.get("dwellMinutes"), "conflict": False}, prepared_reviews(reviews))
            if derived["status"] != status or set(derived["evidenceReviewIds"]) != set(evidence):
                raise ValueError("insight_ungrounded_claim")
    expected_version = hashlib.sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    if store.get("version") != expected_version:
        raise ValueError("insight_content_version_mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=ROOT / "server/travel-feedback/data/kakao_reviews.sqlite3")
    parser.add_argument("--output", type=Path, default=ROOT / "server/travel-feedback/data/visit_insights.json")
    parser.add_argument("--prepare-only", action="store_true", help="Create honest unknown records without any API calls")
    parser.add_argument("--validate-only", action="store_true", help="Validate existing analysis and source relationships without external calls")
    parser.add_argument("--limit", type=int, default=30, help="Maximum new paid analysis calls")
    args = parser.parse_args()
    if not 1 <= args.limit <= 2000:
        parser.error("limit must be 1..2000")
    by_place = load_reviews(args.database)
    if args.validate_only:
        try:
            validate_store(json.loads(args.output.read_text(encoding="utf-8")), by_place, hashlib.sha256(args.database.read_bytes()).hexdigest())
        except (ValueError, ProviderError, KeyError, TypeError):
            parser.error("visit insights failed provenance or evidence validation")
        print(json.dumps({"valid": True, "apiCalls": 0}))
        return
    client = OpenAIClient()
    if not args.prepare_only and not client.configured:
        parser.error("OPENAI_API_KEY is required unless --prepare-only is used")
    old = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {}
    cached = old.get("places", {})
    results, errors, calls, reused = {}, [], 0, 0
    checked_at = datetime.now(timezone.utc).isoformat()
    database_hash = hashlib.sha256(args.database.read_bytes()).hexdigest()
    for place_id, reviews in by_place.items():
        digest = input_hash(reviews, client.model)
        previous = cached.get(place_id)
        if previous and previous.get("inputHash") == digest and previous.get("unknownReason") != "pending_llm_analysis":
            # Validate each cached conclusion again, without invalidating unaffected records after another place changes.
            one = {place_id: previous}
            try:
                validate_store({"schemaVersion": SCHEMA_VERSION, "sourceDatabaseHash": database_hash, "places": one,
                                "version": hashlib.sha256(json.dumps(one, sort_keys=True, ensure_ascii=False).encode()).hexdigest()},
                               {place_id: reviews}, database_hash)
            except (ValueError, ProviderError, KeyError, TypeError):
                pass
            else:
                results[place_id] = previous
                reused += 1
                continue
        record = unknown_insights(reviews, client.model)
        if not args.prepare_only and calls < args.limit and record["timeEvidenceReviewCount"]:
            calls += 1
            try:
                record = analyze_reviews(reviews, client)
                record["analyzedAt"] = checked_at
            except ProviderError as error:
                # Old evidence is withdrawn when its input changes, even on a failed replacement call.
                errors.append({"placeId": place_id, "code": error.code})
        results[place_id] = record
    # No source record => no output record, withdrawing evidence from removed reviews.
    version = hashlib.sha256(json.dumps(results, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    output = {"schemaVersion": SCHEMA_VERSION, "version": version, "sourceDatabaseHash": database_hash,
              "sourceMetadata": review_metadata(args.database),
              "places": results, "coverage": dict(Counter(r["status"] for r in results.values()))}
    atomic_write(args.output, output)
    print(json.dumps({"places": len(results), "coverage": output["coverage"], "apiCalls": calls, "reused": reused, "errors": errors}))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
