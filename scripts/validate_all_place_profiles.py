#!/usr/bin/env python3
"""Validate the SPEC-007 full non-restaurant research and label dataset.

The validator intentionally uses only the Python standard library.  It treats
the JSONL exports as the canonical interchange representation and SQLite as a
queryable derivative.  A successful run proves that the two representations
agree, but it does *not* treat the physical SQLite file hash as a deterministic
database identity.

Logical database digest algorithm (``trip-ai-sqlite-logical-v1``):

* dump the seven content tables listed in ``LOGICAL_DB_TABLES``;
* retain SQLite column order and sort rows by the declared primary key;
* encode ``{"tables": [{"name", "columns", "rows"}, ...]}`` as UTF-8 JSON
  with lexicographically sorted object keys and no insignificant whitespace;
* hash those bytes with SHA-256.

This file is deliberately independent of the builder so that a builder defect
cannot silently bless its own output.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse


SNAPSHOT_DATE = "2026-08-09"
EXPECTED_PLACE_COUNT = 1_434
EXPECTED_TYPE_COUNTS = {
    "12": 566,
    "14": 97,
    "15": 28,
    "28": 137,
    "32": 209,
    "38": 397,
}
EXPECTED_COMPANION_AXES = 7_170
EXPECTED_NONFESTIVAL_MONTH_AXES = 16_872
EXPECTED_FESTIVAL_MONTH_NA = 336
EXPECTED_TOTAL_AXES = 24_378

COMPANION_KEYS = ("solo", "couple", "friends", "kids", "parents")
MONTH_KEYS = tuple(str(month) for month in range(1, 13))
TARGETED_STAY_COMPANION_REGRESSIONS = {
    "142946": {"kids": 0.75},
    "2623005": {"friends": 0.75, "kids": 0.5, "parents": 0.5},
    "2498637": {"friends": 0.75, "kids": 0.75, "parents": 0.5},
    "2405964": {"kids": 0.75},
    "4017092": {"parents": 0.75},
    "2561909": {"friends": 0.75, "kids": 0.75},
}
TARGETED_INDOOR_MONTH_STAYS = {"142946"}
TARGETED_CULTURE_ENVIRONMENT_REGRESSIONS = {
    "129895": "outdoor",
    "1544730": "mixed",
    "130856": "mixed",
    "130036": "indoor",
    "130088": "indoor",
    "130141": "indoor",
    "130877": "indoor",
    "759595": "indoor",
    "130723": "indoor",
    "130308": "indoor",
    "2791473": "indoor",
}
ENVIRONMENT_MONTH_ARCHETYPES = {
    "outdoor": "outdoor_neutral",
    "mixed": "mixed_neutral",
    "indoor": "indoor_neutral",
}
TARGETED_WATER_INDOOR_REGRESSIONS = {"3031552", "3464225"}
TARGETED_WATER_KIDS_REGRESSIONS = {
    "2864448": 0.75,
    "2798709": 0.75,
    "3031552": 0.75,
    "3563239": 0.75,
    "2738709": 0.5,
    "2751848": 0.5,
    "3066943": 0.5,
    "3464225": 0.5,
}
TARGETED_WEATHER_GATE_REGRESSIONS = {
    "127635",
    "264590",
    "636266",
    "1064572",
    "1952520",
    "2738709",
    "2726675",
    "2718799",
    "3030930",
}
TARGETED_COMPANION_DIRECT_REGRESSIONS = {
    "127479": ("kids", "parents"),
    "128838": ("kids",),
    "130317": ("kids",),
    "637398": ("kids", "parents"),
    "1918646": ("kids", "parents"),
    "2714826": ("kids",),
    "2740133": ("kids",),
    "2785869": ("kids",),
    "2994124": ("kids",),
    "3037623": ("kids", "parents"),
}
DIRECT_COMPANION_RULE = "COMP-DIRECT-WEB-EXPLICIT-COMPANION"
LABEL_VALUES = {0, 0.25, 0.5, 0.75, 1}
RESEARCH_STATUSES = {"matched", "uncertain", "not_found"}
INFERENCE_LEVELS = {
    "pilot_reviewed_anchor",
    "direct_evidence",
    "researched_inference",
    "archetype_prior",
    "climate_heuristic",
    "not_applicable",
}
REVIEW_PRIORITIES = {"low", "medium", "high"}
CONSTRAINT_STATUSES = {"confirmed", "unknown", "stale"}
CONSTRAINT_ACTIONS = {"exclude", "verify"}
SOURCE_TYPES = {
    "official_tourism",
    "public_agency",
    "official_operator",
    "heritage",
    "reputable_secondary",
}

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
KOREAN_RE = re.compile(r"[가-힣]")

OUTPUT_RELATIVE = Path(
    "data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434"
)
SOURCE_RELATIVE = Path(
    "data/labeling/jeju/2026-08-09/non_restaurants.json"
)
PARTITION_MANIFEST_RELATIVE = Path(
    "data/labeling/jeju/2026-08-09/manifest.json"
)
PILOT_V2_RELATIVE = Path(
    "data/labeling/jeju/2026-08-09/pilots/place-profile-v2-100"
)
PILOT_V3_RELATIVE = Path(
    "data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100"
)

REQUIRED_OUTPUT_FILES = (
    Path("research/web_pages.jsonl"),
    Path("place_web_research.jsonl"),
    Path("auto_label_proposals.jsonl"),
    Path("hard_constraints.jsonl"),
    Path("review_queue.jsonl"),
    Path("place_profiles.sqlite3"),
    Path("manifest.json"),
    Path("review_report.md"),
)

# These trees are immutable inputs or previously implemented products under
# SPEC-007.  The digest is SHA-256 of canonical JSON rows
# [{"path": repository-relative path, "sha256": file hash}, ...].
PROTECTED_TREE_DIGESTS = {
    "data/tourapi/jeju": (9, "23757add5ec70f59c0f8b7975157f6a2e27e968685f5b91076d76295ba31d238"),
    "data/labeling/jeju/2026-08-09/pilots": (28, "034ebe4e7a7f8c559a34e6dcdd45389280a776738c7f44d3ae5e28ae0adda93e"),
    "data/climate": (1, "340941328354b755e71baa621ae6ab362fabef9b90103b8b5e3b7e3977ea2e26"),
    "map-ui": (17, "82ce21712a86329f78f6a19f34a4f6a9299876d6d974d7286b24be6f32341c08"),
    "labeling-review": (6, "8df5c65bee2f2e5d57691a4557e7bcf9385f8dc08a203f0fc9ed273cd22e08c0"),
}
PROTECTED_FILE_DIGESTS = {
    "data/labeling/jeju/2026-08-09/restaurants.json": "b9e9253aae337d6f2c4ef42bc32bf97b21fc46a1369c56f97f662775fa7f29f3",
    "data/labeling/jeju/2026-08-09/non_restaurants.json": "c99ff138b63f15653b639b29a9c5e62aa6060494409fbedd4ed4b79855db0e54",
    "data/labeling/jeju/2026-08-09/manifest.json": "51f74e172bec21707f6d0ba66d7cfb616ed744cf48a4bef678cfda4952fa95fc",
}

REQUIRED_TABLE_COLUMNS = {
    "dataset_meta": {"key", "value"},
    "places": {
        "contentid",
        "source_order",
        "contenttypeid",
        "title",
        "address",
        "longitude",
        "latitude",
        "lcls1",
        "lcls2",
        "lcls3",
        "raw_json",
        "record_sha256",
    },
    "web_sources": {
        "source_id",
        "contentid",
        "url",
        "final_url",
        "publisher",
        "source_type",
        "fetched_on",
        "http_status",
        "page_title",
        "page_address",
        "page_sha256",
        "homepage_candidates_json",
        "retrieval_error",
    },
    "research": {
        "contentid",
        "research_status",
        "identity_notes",
        "summary",
        "place_kind",
        "experience_scope",
        "typical_visit",
        "environment",
        "facts_json",
        "unknowns_json",
        "record_sha256",
    },
    "label_runs": {
        "label_run_id",
        "algorithm_version",
        "input_digest",
        "climate_hash",
        "status",
    },
    "label_proposals": {
        "label_run_id",
        "contentid",
        "source_order",
        "experience_scope",
        "research_status",
        "pilot_anchor",
        "review_priority",
        "review_reasons_json",
        "proposal_sha256",
    },
    "label_axes": {
        "label_run_id",
        "contentid",
        "source_order",
        "experience_scope",
        "axis_group",
        "axis_key",
        "state",
        "value",
        "confidence",
        "inference_level",
        "rationale",
        "null_reason",
        "evidence_ids_json",
        "rule_ids_json",
    },
    "hard_constraints": {
        "constraint_id",
        "label_run_id",
        "contentid",
        "source_order",
        "experience_scope",
        "kind",
        "applies_to",
        "condition",
        "status",
        "action",
        "source_url",
        "checked_at",
        "rule_id",
        "record_sha256",
    },
}

EXPECTED_PRIMARY_KEYS = {
    "dataset_meta": ("key",),
    "places": ("contentid",),
    "web_sources": ("source_id",),
    "research": ("contentid",),
    "label_runs": ("label_run_id",),
    "label_proposals": ("label_run_id", "contentid"),
    "label_axes": ("label_run_id", "contentid", "axis_group", "axis_key"),
    "hard_constraints": ("constraint_id",),
}

LOGICAL_DB_TABLES = (
    "places",
    "web_sources",
    "research",
    "label_runs",
    "label_proposals",
    "label_axes",
    "hard_constraints",
)


class ValidationError(RuntimeError):
    """A human-readable contract violation."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value if value is not None else "")).strip()


def require_mapping(value: Any, context: str) -> Mapping[str, Any]:
    require(isinstance(value, dict), f"{context} must be an object")
    return value


def require_list(value: Any, context: str) -> list[Any]:
    require(isinstance(value, list), f"{context} must be an array")
    return value


def require_string(
    value: Any,
    context: str,
    *,
    korean: bool = False,
    max_length: int = 4_000,
) -> str:
    require(isinstance(value, str), f"{context} must be a string")
    require(bool(clean(value)), f"{context} must not be empty")
    require(len(value) <= max_length, f"{context} is too long")
    if korean:
        require(bool(KOREAN_RE.search(value)), f"{context} must contain a Korean explanation")
    return value


def require_string_list(
    value: Any,
    context: str,
    *,
    allow_empty: bool = True,
    korean: bool = False,
) -> list[str]:
    items = require_list(value, context)
    if not allow_empty:
        require(bool(items), f"{context} must not be empty")
    for index, item in enumerate(items):
        require_string(item, f"{context}[{index}]", korean=korean)
    return items


def require_sha256(value: Any, context: str) -> str:
    require(isinstance(value, str) and bool(SHA256_RE.fullmatch(value)), f"{context} must be a lowercase SHA-256")
    return value


def require_date(value: Any, context: str) -> str:
    require(isinstance(value, str) and bool(DATE_RE.fullmatch(value)), f"{context} must be YYYY-MM-DD")
    return value


def require_http_url(value: Any, context: str) -> str:
    url = require_string(value, context)
    parsed = urlparse(url)
    require(parsed.scheme in {"http", "https"} and bool(parsed.netloc), f"{context} must be HTTP(S)")
    return url


def first_present(mapping: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in mapping:
            return mapping[key]
    return None


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def compact_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_hash_candidates(record: Mapping[str, Any], removable_hash_keys: Sequence[str] = ()) -> set[str]:
    candidates: set[str] = set()
    variants: list[Mapping[str, Any]] = [record]
    present_keys = [key for key in removable_hash_keys if key in record]
    # A record may contain both its own hash and a referenced upstream hash
    # (review_queue has record_sha256 + proposal_sha256).  Try every removal
    # subset so the upstream reference is not accidentally discarded.
    for mask in range(1, 1 << len(present_keys)):
        removed = {
            present_keys[index]
            for index in range(len(present_keys))
            if mask & (1 << index)
        }
        variants.append({key: value for key, value in record.items() if key not in removed})
    for variant in variants:
        candidates.add(sha256_bytes(canonical_json_bytes(variant)))
        candidates.add(sha256_bytes(compact_json_bytes(variant)))
    return candidates


def read_json(path: Path) -> Any:
    require(path.is_file(), f"required file is missing: {path.as_posix()}")
    raw = path.read_text(encoding="utf-8")
    require("\ufffd" not in raw, f"UTF-8 replacement character found: {path.as_posix()}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValidationError(f"invalid JSON {path.as_posix()}:{error.lineno}: {error.msg}") from error


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    require(path.is_file(), f"required JSONL is missing: {path.as_posix()}")
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            require("\ufffd" not in line, f"UTF-8 replacement character in {path.as_posix()}:{line_number}")
            require(bool(line.strip()), f"blank JSONL line in {path.as_posix()}:{line_number}")
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValidationError(
                    f"invalid JSONL {path.as_posix()}:{line_number}: {error.msg}"
                ) from error
            require(isinstance(value, dict), f"JSONL line must be an object: {path.as_posix()}:{line_number}")
            records.append(value)
    return records


def parse_json_column(value: Any, context: str) -> Any:
    if isinstance(value, (dict, list)):
        return value
    require(isinstance(value, str), f"{context} must contain JSON text")
    try:
        return json.loads(value)
    except json.JSONDecodeError as error:
        raise ValidationError(f"{context} contains invalid JSON: {error.msg}") from error


def tree_digest(root: Path, relative: str) -> tuple[int, str]:
    directory = root / relative
    require(directory.is_dir(), f"protected directory is missing: {relative}")
    rows: list[dict[str, str]] = []
    for path in sorted(candidate for candidate in directory.rglob("*") if candidate.is_file()):
        rows.append(
            {
                "path": path.relative_to(root).as_posix(),
                "sha256": sha256_file(path),
            }
        )
    return len(rows), sha256_bytes(canonical_json_bytes(rows))


def validate_protected_inputs(root: Path) -> None:
    for relative, expected_digest in PROTECTED_FILE_DIGESTS.items():
        path = root / relative
        require(path.is_file(), f"protected file is missing: {relative}")
        require(sha256_file(path) == expected_digest, f"protected file SHA-256 differs: {relative}")
    for relative, (expected_count, expected_digest) in PROTECTED_TREE_DIGESTS.items():
        count, digest = tree_digest(root, relative)
        require(count == expected_count, f"protected tree file count differs: {relative}")
        require(digest == expected_digest, f"protected tree digest differs: {relative}")


def validate_source_places(root: Path) -> tuple[list[dict[str, Any]], dict[str, int]]:
    source_path = root / SOURCE_RELATIVE
    places = read_json(source_path)
    require(isinstance(places, list), "non_restaurants.json must be an array")
    require(len(places) == EXPECTED_PLACE_COUNT, "non-restaurant count must be 1,434")

    ids: list[str] = []
    type_counts: collections.Counter[str] = collections.Counter()
    for index, raw_place in enumerate(places):
        place = require_mapping(raw_place, f"non_restaurants[{index}]")
        require(place.get("contentid") is not None, f"non_restaurants[{index}].contentid is missing")
        require(place.get("contenttypeid") is not None, f"non_restaurants[{index}].contenttypeid is missing")
        contentid = require_string(str(place["contentid"]), f"non_restaurants[{index}].contentid")
        contenttypeid = require_string(str(place["contenttypeid"]), f"non_restaurants[{index}].contenttypeid")
        require(contenttypeid != "39", f"restaurant leaked into non-restaurants: {contentid}")
        require(contenttypeid in EXPECTED_TYPE_COUNTS, f"unsupported content type {contenttypeid}: {contentid}")
        require_string(place.get("title"), f"non_restaurants[{index}].title")
        ids.append(contentid)
        type_counts[contenttypeid] += 1

    require(len(set(ids)) == EXPECTED_PLACE_COUNT, "source contentids must be unique")
    require(dict(sorted(type_counts.items())) == EXPECTED_TYPE_COUNTS, "source content-type distribution differs")

    partition_manifest = require_mapping(
        read_json(root / PARTITION_MANIFEST_RELATIVE), "partition manifest"
    )
    manifest_files = require_mapping(partition_manifest.get("files"), "partition manifest.files")
    nonrestaurant_file = require_mapping(
        manifest_files.get("non_restaurants.json"),
        "partition manifest.files.non_restaurants.json",
    )
    require(nonrestaurant_file.get("count") == EXPECTED_PLACE_COUNT, "partition manifest count differs")
    require(
        nonrestaurant_file.get("sha256") == sha256_file(source_path),
        "partition manifest non-restaurant hash differs",
    )
    manifest_counts = require_mapping(partition_manifest.get("counts"), "partition manifest.counts")
    require(manifest_counts.get("non_restaurants") == EXPECTED_PLACE_COUNT, "partition count differs")
    require(manifest_counts.get("restaurants") == 720, "partition restaurant count differs")
    return places, dict(type_counts)


def validate_ordered_records(
    records: Sequence[Mapping[str, Any]],
    expected_ids: Sequence[str],
    context: str,
) -> None:
    require(len(records) == len(expected_ids), f"{context} must contain {len(expected_ids)} records")
    actual_ids = [clean(record.get("contentid")) for record in records]
    require(actual_ids == list(expected_ids), f"{context} contentid order differs from source")
    require(len(set(actual_ids)) == len(actual_ids), f"{context} contentids are duplicated")
    source_orders = [record.get("source_order") for record in records]
    zero_based = list(range(len(records)))
    require(
        source_orders == zero_based,
        f"{context} source_order must be the complete zero-based source sequence",
    )


def validate_web_pages(
    pages: Sequence[Mapping[str, Any]],
    source_places: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, Mapping[str, Any]], collections.Counter[str]]:
    expected_ids = [str(place["contentid"]) for place in source_places]
    validate_ordered_records(pages, expected_ids, "research/web_pages.jsonl")
    by_id: dict[str, Mapping[str, Any]] = {}
    outcomes: collections.Counter[str] = collections.Counter()
    for index, page in enumerate(pages):
        context = f"web_pages[{index}] {expected_ids[index]}"
        contentid = expected_ids[index]
        source_place = source_places[index]
        expected_address = " ".join(
            str(source_place.get(key))
            for key in ("addr1", "addr2")
            if source_place.get(key)
        ).strip()
        require(page.get("expected_title") == source_place.get("title"), f"{context}.expected_title differs")
        require(page.get("expected_address") == expected_address, f"{context}.expected_address differs")
        require(
            clean(page.get("contenttypeid")) == clean(source_place.get("contenttypeid")),
            f"{context}.contenttypeid differs",
        )
        url = first_present(page, "source_url", "url")
        require_http_url(url, f"{context}.source_url")
        final_url = page.get("final_url")
        if final_url is not None:
            require_http_url(final_url, f"{context}.final_url")
        redirected = page.get("redirected")
        if redirected is not None:
            require(isinstance(redirected, bool), f"{context}.redirected must be boolean")
        homepage_urls = page.get("homepage_urls", [])
        require(isinstance(homepage_urls, list), f"{context}.homepage_urls must be an array")
        for homepage_index, homepage_url in enumerate(homepage_urls):
            require_http_url(homepage_url, f"{context}.homepage_urls[{homepage_index}]")

        require_string(page.get("publisher"), f"{context}.publisher")
        source_type = require_string(page.get("source_type"), f"{context}.source_type")
        require(source_type in SOURCE_TYPES, f"{context}.source_type is invalid")
        fetched_on = first_present(page, "fetched_on", "checked_at")
        require_date(fetched_on, f"{context}.fetched_on")
        status = page.get("http_status")
        require(status is None or isinstance(status, int), f"{context}.http_status must be integer or null")
        page_hash = page.get("page_sha256")
        error = page.get("retrieval_error")
        # A followed redirect to a different detail URL is deliberately stored
        # as an identity error by the fetcher even when the terminal response is
        # HTTP 200.  It is therefore not a successful evidence page.
        success = isinstance(status, int) and 200 <= status < 300 and not error
        if success:
            require_sha256(page_hash, f"{context}.page_sha256")
            require_string(page.get("page_title"), f"{context}.page_title")
            require_string(page.get("page_address"), f"{context}.page_address")
            require(page.get("address_matches") is True, f"{context}.address_matches must be true")
            require_string(page.get("overview"), f"{context}.overview")
            outcomes["success"] += 1
        else:
            require_string(error, f"{context}.retrieval_error")
            if page_hash is not None:
                require_sha256(page_hash, f"{context}.page_sha256")
            outcomes["error"] += 1
        by_id[contentid] = page
    return by_id, outcomes


def scope_matches_type(contenttypeid: str, scope: str) -> bool:
    normalized = scope.lower()
    if contenttypeid == "15":
        return any(token in normalized for token in ("festival", "event", "축제", "행사"))
    if contenttypeid == "32":
        return any(token in normalized for token in ("stay", "lodging", "accommodation", "숙박"))
    if contenttypeid == "38":
        return any(token in normalized for token in ("shopping", "shop", "쇼핑", "매장", "시장"))
    return any(token in normalized for token in ("visit", "experience", "방문", "관람", "체험", "탐방"))


def source_evidence_ids(source: Mapping[str, Any]) -> set[str]:
    evidence: set[str] = set()
    for key in ("source_id", "id"):
        value = source.get(key)
        if isinstance(value, str) and clean(value):
            evidence.add(value)
            evidence.add(f"source:{value}")
            evidence.add(f"web_source:{value}")
    claims = source.get("claims", [])
    if isinstance(claims, list):
        for claim in claims:
            if isinstance(claim, dict):
                for key in ("claim_id", "id"):
                    value = claim.get(key)
                    if isinstance(value, str) and clean(value):
                        evidence.add(value)
                        evidence.add(f"claim:{value}")
                        evidence.add(f"source_claim:{value}")
    return evidence


def validate_research(
    records: Sequence[Mapping[str, Any]],
    source_places: Sequence[Mapping[str, Any]],
    pages_by_id: Mapping[str, Mapping[str, Any]],
) -> tuple[
    dict[str, Mapping[str, Any]],
    collections.Counter[str],
    dict[str, set[str]],
]:
    expected_ids = [str(place["contentid"]) for place in source_places]
    validate_ordered_records(records, expected_ids, "place_web_research.jsonl")
    by_id: dict[str, Mapping[str, Any]] = {}
    status_counts: collections.Counter[str] = collections.Counter()
    evidence_by_id: dict[str, set[str]] = {}

    for index, record in enumerate(records):
        contentid = expected_ids[index]
        context = f"research[{index}] {contentid}"
        status = require_string(record.get("research_status"), f"{context}.research_status")
        require(status in RESEARCH_STATUSES, f"{context}.research_status is not terminal")
        require_string(record.get("identity_notes"), f"{context}.identity_notes", korean=True)
        summary = require_string(record.get("summary"), f"{context}.summary", korean=True)
        require(len(summary) <= 320, f"{context}.summary exceeds the 320-character review limit")
        require_string(record.get("place_kind"), f"{context}.place_kind")
        scope = require_string(record.get("experience_scope"), f"{context}.experience_scope")
        contenttypeid = str(source_places[index]["contenttypeid"])
        require(scope_matches_type(contenttypeid, scope), f"{context}.experience_scope does not match type {contenttypeid}")
        facts = require_mapping(record.get("facts"), f"{context}.facts")
        require(bool(facts), f"{context}.facts must not be empty")
        environment = require_string(record.get("environment"), f"{context}.environment")
        require(environment in {"indoor", "outdoor", "mixed", "unknown"}, f"{context}.environment is invalid")
        require(
            facts.get("environment") == environment,
            f"{context}.facts.environment differs from top-level environment",
        )
        targeted_environment = TARGETED_CULTURE_ENVIRONMENT_REGRESSIONS.get(contentid)
        if targeted_environment is not None:
            require(contenttypeid == "14", f"{context} targeted culture ID is not content type 14")
            require(
                environment == targeted_environment,
                f"{context} targeted culture environment differs",
            )
        if contentid in TARGETED_WATER_INDOOR_REGRESSIONS:
            require(contenttypeid == "28", f"{context} targeted water ID is not content type 28")
            require(environment == "indoor", f"{context} targeted water environment differs")
        unknowns = require_list(record.get("unknowns"), f"{context}.unknowns")
        for unknown_index, unknown in enumerate(unknowns):
            require_string(unknown, f"{context}.unknowns[{unknown_index}]")
        typical_visit = record.get("typical_visit")

        sources = require_list(record.get("sources"), f"{context}.sources")
        evidence: set[str] = set()
        source_urls: set[str] = set()
        for source_index, raw_source in enumerate(sources):
            source = require_mapping(raw_source, f"{context}.sources[{source_index}]")
            url = require_http_url(source.get("url"), f"{context}.sources[{source_index}].url")
            source_urls.add(url)
            source_type = require_string(
                source.get("source_type"), f"{context}.sources[{source_index}].source_type"
            )
            require(source_type in SOURCE_TYPES, f"{context}.sources[{source_index}].source_type is invalid")
            checked_at = first_present(source, "checked_at", "fetched_on")
            require_date(checked_at, f"{context}.sources[{source_index}].checked_at")
            claims = require_list(source.get("claims"), f"{context}.sources[{source_index}].claims")
            if status == "matched":
                require(bool(claims), f"{context}.sources[{source_index}].claims must not be empty")
            for claim_index, claim in enumerate(claims):
                if isinstance(claim, dict):
                    claim_text = first_present(claim, "summary", "text", "claim")
                    require_string(
                        claim_text,
                        f"{context}.sources[{source_index}].claims[{claim_index}]",
                        korean=True,
                    )
                else:
                    require_string(
                        claim,
                        f"{context}.sources[{source_index}].claims[{claim_index}]",
                        korean=True,
                    )
            evidence.update(source_evidence_ids(source))

        page = pages_by_id[contentid]
        primary_urls = {
            clean(first_present(page, "source_url", "url")),
            clean(page.get("final_url")),
        } - {""}
        page_success = (
            isinstance(page.get("http_status"), int)
            and 200 <= page["http_status"] < 300
            and not page.get("retrieval_error")
        )
        if status == "matched":
            require(page_success, f"{context} matched without a successful opened page")
            require(page.get("address_matches") is True, f"{context} matched without address identity evidence")
            require(bool(sources), f"{context} matched without a source")
            require(bool(source_urls & primary_urls), f"{context} does not cite its opened detail page")
            require_string(typical_visit, f"{context}.typical_visit", korean=True)
            require_sha256(page.get("page_sha256"), f"{context} opened page SHA-256")
            require(
                any(source.get("page_sha256") == page.get("page_sha256") for source in sources),
                f"{context} source does not preserve the opened page SHA-256",
            )

        # Legacy-compatible evidence handles are accepted only when a real
        # opened source exists; new claim/source IDs remain preferable.
        if sources:
            evidence.add(f"web_research:{contentid}")
        evidence_by_id[contentid] = evidence
        candidate_record_matches_hash(
            record,
            record.get("record_sha256"),
            f"{context}.record_sha256",
        )
        by_id[contentid] = record
        status_counts[status] += 1

    require(sum(status_counts.values()) == EXPECTED_PLACE_COUNT, "research terminal coverage differs")
    return by_id, status_counts, evidence_by_id


def validate_axis(
    axis: Mapping[str, Any],
    context: str,
    *,
    festival_month: bool,
    uncertain: bool,
    evidence_registry: set[str],
    pilot: bool,
) -> tuple[str, Any, str]:
    value = axis.get("value")
    confidence = axis.get("confidence")
    inference = require_string(axis.get("inference_level"), f"{context}.inference_level")
    require(inference in INFERENCE_LEVELS, f"{context}.inference_level is invalid")
    require_string(axis.get("rationale"), f"{context}.rationale", korean=True)
    evidence_ids = require_string_list(axis.get("evidence_ids"), f"{context}.evidence_ids")
    rule_ids = require_string_list(
        axis.get("rule_ids"), f"{context}.rule_ids", allow_empty=False
    )
    state = axis.get("state")
    if state is None:
        state = "not_applicable" if value is None else "numeric"
    require(state in {"numeric", "not_applicable"}, f"{context}.state is invalid")

    if festival_month:
        require(value is None, f"{context} festival month value must be null")
        require(confidence is None, f"{context} festival month confidence must be null")
        require(state == "not_applicable", f"{context} festival month state must be not_applicable")
        require(inference == "not_applicable", f"{context} festival month inference must be not_applicable")
        require(
            axis.get("null_reason") == "date_gated_not_applicable",
            f"{context} festival month null_reason differs",
        )
        return state, value, inference

    require(state == "numeric", f"{context} applicable axis must be numeric")
    require(value in LABEL_VALUES and not isinstance(value, bool), f"{context}.value is invalid")
    require(confidence in LABEL_VALUES and not isinstance(confidence, bool), f"{context}.confidence is invalid")
    require(inference != "not_applicable", f"{context} applicable axis cannot be not_applicable")
    if inference not in {"direct_evidence", "pilot_reviewed_anchor"}:
        require(value not in {0, 1}, f"{context} non-direct extreme is forbidden")
    if inference == "pilot_reviewed_anchor":
        require(pilot, f"{context} pilot_reviewed_anchor is only valid for a pilot ID")
    if uncertain:
        require(confidence == 0.25, f"{context} uncertain/not_found prior confidence must be 0.25")
        require(
            inference not in {"direct_evidence", "pilot_reviewed_anchor"},
            f"{context} uncertain/not_found axis cannot claim direct evidence",
        )
    if inference == "direct_evidence" and not pilot:
        require(bool(evidence_ids), f"{context} direct evidence IDs are missing")
        require(
            any(evidence_id in evidence_registry for evidence_id in evidence_ids),
            f"{context} direct evidence does not resolve to a source or claim",
        )
    return state, value, inference


def legacy_proposal_view(proposal: Mapping[str, Any]) -> dict[str, Any]:
    legacy_keys = (
        "contentid",
        "title",
        "algorithm_version",
        "companion_archetype",
        "month_archetype",
        "flags",
        "assignment_rationale",
        "companion_fit",
        "month_fit",
        "hard_constraints",
        "review_priority",
        "review_reasons",
    )
    return {key: proposal.get(key) for key in legacy_keys}


def normalize_constraint(
    raw_constraint: Mapping[str, Any],
    default_contentid: str | None = None,
) -> dict[str, Any]:
    return {
        "contentid": clean(raw_constraint.get("contentid") or default_contentid),
        "kind": clean(raw_constraint.get("kind")),
        "applies_to": clean(raw_constraint.get("applies_to")),
        "condition": clean(raw_constraint.get("condition")),
        "status": clean(raw_constraint.get("status")),
        "action": clean(raw_constraint.get("action")),
        "source_url": clean(first_present(raw_constraint, "source_url", "source")),
        "checked_at": clean(raw_constraint.get("checked_at")),
        "rule_id": clean(raw_constraint.get("rule_id")),
    }


def validate_proposals(
    proposals: Sequence[Mapping[str, Any]],
    source_places: Sequence[Mapping[str, Any]],
    research_by_id: Mapping[str, Mapping[str, Any]],
    evidence_by_id: Mapping[str, set[str]],
    pilot_proposals: Sequence[Mapping[str, Any]],
) -> tuple[
    dict[str, Mapping[str, Any]],
    dict[str, list[dict[str, Any]]],
    collections.Counter[str],
    collections.Counter[str],
]:
    expected_ids = [str(place["contentid"]) for place in source_places]
    validate_ordered_records(proposals, expected_ids, "auto_label_proposals.jsonl")
    pilot_by_id = {str(proposal["contentid"]): proposal for proposal in pilot_proposals}
    by_id: dict[str, Mapping[str, Any]] = {}
    constraints_by_id: dict[str, list[dict[str, Any]]] = {}
    priority_counts: collections.Counter[str] = collections.Counter()
    inference_counts: collections.Counter[str] = collections.Counter()
    companion_numeric = 0
    nonfestival_month_numeric = 0
    festival_month_na = 0
    nonpilot_companion_direct = 0

    for index, proposal in enumerate(proposals):
        contentid = expected_ids[index]
        context = f"proposals[{index}] {contentid}"
        research = research_by_id[contentid]
        contenttypeid = str(source_places[index]["contenttypeid"])
        festival = contenttypeid == "15"
        pilot = contentid in pilot_by_id
        require(
            proposal.get("pilot_anchor") is pilot,
            f"{context}.pilot_anchor differs from frozen pilot membership",
        )
        require_string(proposal.get("title"), f"{context}.title")
        require_string(proposal.get("algorithm_version"), f"{context}.algorithm_version")
        scope = require_string(proposal.get("experience_scope"), f"{context}.experience_scope")
        require(scope == research["experience_scope"], f"{context}.experience_scope differs from research")
        require(
            proposal.get("research_status") == research["research_status"],
            f"{context}.research_status differs from research",
        )
        priority = require_string(proposal.get("review_priority"), f"{context}.review_priority")
        require(priority in REVIEW_PRIORITIES, f"{context}.review_priority is invalid")
        reasons = require_string_list(
            proposal.get("review_reasons"),
            f"{context}.review_reasons",
            allow_empty=False,
            korean=True,
        )
        uncertain = research["research_status"] in {"uncertain", "not_found"}
        if uncertain:
            require(priority == "high", f"{context} uncertain/not_found place must be high priority")
            require(bool(reasons), f"{context} uncertain/not_found reason is missing")

        companions = require_mapping(proposal.get("companion_fit"), f"{context}.companion_fit")
        require(set(companions) == set(COMPANION_KEYS), f"{context}.companion_fit keys differ")
        for key in COMPANION_KEYS:
            axis = require_mapping(companions[key], f"{context}.companion_fit.{key}")
            _, _, inference = validate_axis(
                axis,
                f"{context}.companion_fit.{key}",
                festival_month=False,
                uncertain=uncertain,
                evidence_registry=evidence_by_id[contentid],
                pilot=pilot,
            )
            companion_numeric += 1
            inference_counts[inference] += 1
            if not pilot and inference == "direct_evidence":
                nonpilot_companion_direct += 1

        months = require_mapping(proposal.get("month_fit"), f"{context}.month_fit")
        require(set(months) == set(MONTH_KEYS), f"{context}.month_fit keys differ")
        for month in MONTH_KEYS:
            axis = require_mapping(months[month], f"{context}.month_fit.{month}")
            _, _, inference = validate_axis(
                axis,
                f"{context}.month_fit.{month}",
                festival_month=festival,
                uncertain=uncertain and not festival,
                evidence_registry=evidence_by_id[contentid],
                pilot=pilot,
            )
            inference_counts[inference] += 1
            if festival:
                festival_month_na += 1
            else:
                nonfestival_month_numeric += 1

        raw_constraints = require_list(
            proposal.get("hard_constraints"), f"{context}.hard_constraints"
        )
        constraints_by_id[contentid] = [
            normalize_constraint(require_mapping(item, f"{context}.hard_constraints[{constraint_index}]"), contentid)
            for constraint_index, item in enumerate(raw_constraints)
        ]
        priority_counts[priority] += 1
        candidate_record_matches_hash(
            proposal,
            proposal.get("proposal_sha256"),
            f"{context}.proposal_sha256",
        )
        by_id[contentid] = proposal

        if pilot:
            pilot_proposal = pilot_by_id[contentid]
            full_legacy = legacy_proposal_view(proposal)
            require(
                full_legacy["companion_fit"] == pilot_proposal["companion_fit"],
                f"{context} pilot companion axis/provenance regression",
            )
            require(
                full_legacy["month_fit"] == pilot_proposal["month_fit"],
                f"{context} pilot month axis/provenance regression",
            )
            require(
                full_legacy["hard_constraints"] == pilot_proposal["hard_constraints"],
                f"{context} pilot hard-constraint regression",
            )
            expected_hashes = json_hash_candidates(pilot_proposal)
            pilot_hash = proposal.get("pilot_proposal_sha256")
            require_sha256(pilot_hash, f"{context}.pilot_proposal_sha256")
            require(pilot_hash in expected_hashes, f"{context}.pilot_proposal_sha256 differs")

    require(len(pilot_by_id) == 100, "pilot proposal anchor must contain 100 records")
    require(set(pilot_by_id).issubset(by_id), "all pilot IDs must exist in full proposals")
    require(companion_numeric == EXPECTED_COMPANION_AXES, "companion numeric coverage must be 7,170")
    require(
        nonfestival_month_numeric == EXPECTED_NONFESTIVAL_MONTH_AXES,
        "non-festival month numeric coverage must be 16,872",
    )
    require(festival_month_na == EXPECTED_FESTIVAL_MONTH_NA, "festival N/A coverage must be 336")
    require(
        companion_numeric + nonfestival_month_numeric + festival_month_na == EXPECTED_TOTAL_AXES,
        "total axis coverage must be 24,378",
    )
    require(
        nonpilot_companion_direct > 0,
        "non-pilot companion axes must include direct web evidence",
    )
    for contentid, expected_axes in TARGETED_STAY_COMPANION_REGRESSIONS.items():
        require(contentid in by_id, f"targeted stay regression ID is missing: {contentid}")
        actual_axes = by_id[contentid]["companion_fit"]
        for axis_key, expected_value in expected_axes.items():
            require(
                actual_axes[axis_key]["value"] == expected_value,
                f"targeted stay regression differs: {contentid}/{axis_key}",
            )
    for contentid in TARGETED_INDOOR_MONTH_STAYS:
        proposal = by_id[contentid]
        require(
            proposal.get("month_archetype") == "indoor_neutral",
            f"targeted stay month archetype differs: {contentid}",
        )
        require(
            all(proposal["month_fit"][month]["value"] == 0.5 for month in MONTH_KEYS),
            f"targeted indoor stay month values differ: {contentid}",
        )
    for contentid, environment in TARGETED_CULTURE_ENVIRONMENT_REGRESSIONS.items():
        require(contentid in by_id, f"targeted culture regression ID is missing: {contentid}")
        require(
            by_id[contentid].get("month_archetype") == ENVIRONMENT_MONTH_ARCHETYPES[environment],
            f"targeted culture month archetype differs: {contentid}",
        )
    for contentid in TARGETED_WATER_INDOOR_REGRESSIONS:
        require(contentid in by_id, f"targeted water regression ID is missing: {contentid}")
        proposal = by_id[contentid]
        require(
            proposal.get("month_archetype") == "indoor_neutral",
            f"targeted water month archetype differs: {contentid}",
        )
        require(
            all(proposal["month_fit"][month]["value"] == 0.5 for month in MONTH_KEYS),
            f"targeted indoor water month values differ: {contentid}",
        )
    for contentid, expected_value in TARGETED_WATER_KIDS_REGRESSIONS.items():
        require(contentid in by_id, f"targeted water kids regression ID is missing: {contentid}")
        require(
            by_id[contentid]["companion_fit"]["kids"]["value"] == expected_value,
            f"targeted water kids value differs: {contentid}",
        )
    for contentid, axis_keys in TARGETED_COMPANION_DIRECT_REGRESSIONS.items():
        require(contentid in by_id, f"targeted direct companion ID is missing: {contentid}")
        require(contentid not in pilot_by_id, f"targeted direct companion ID is a pilot: {contentid}")
        sources = require_list(
            research_by_id[contentid].get("sources"),
            f"targeted direct companion sources: {contentid}",
        )
        require(bool(sources), f"targeted direct companion source is missing: {contentid}")
        source_evidence: set[str] = set()
        for source_index, raw_source in enumerate(sources):
            source = require_mapping(raw_source, f"targeted direct companion source[{source_index}]: {contentid}")
            require_http_url(source.get("url"), f"targeted direct companion source URL: {contentid}")
            source_evidence.update(source_evidence_ids(source))
        for axis_key in axis_keys:
            axis = by_id[contentid]["companion_fit"][axis_key]
            require(
                axis["value"] >= 0.75,
                f"targeted direct companion value is below 0.75: {contentid}/{axis_key}",
            )
            require(
                axis["inference_level"] == "direct_evidence",
                f"targeted companion inference is not direct: {contentid}/{axis_key}",
            )
            require(
                axis["confidence"] == 0.75,
                f"targeted direct companion confidence differs: {contentid}/{axis_key}",
            )
            require(
                DIRECT_COMPANION_RULE in axis["rule_ids"],
                f"targeted direct companion rule is missing: {contentid}/{axis_key}",
            )
            require(
                f"rule:{DIRECT_COMPANION_RULE}" in axis["evidence_ids"],
                f"targeted direct companion rule evidence is missing: {contentid}/{axis_key}",
            )
            require(
                any(evidence_id in source_evidence for evidence_id in axis["evidence_ids"]),
                f"targeted direct companion evidence does not resolve to a web source: {contentid}/{axis_key}",
            )
    riding_constraints = constraints_by_id.get("2994124", [])
    require(
        any(
            constraint["kind"] in {"eligibility", "age", "program_eligibility"}
            and any(age in constraint["condition"] for age in ("4세", "5세"))
            for constraint in riding_constraints
        ),
        "2994124 age eligibility gate is missing",
    )
    return by_id, constraints_by_id, priority_counts, inference_counts


def validate_hard_constraint(
    constraint: Mapping[str, Any],
    context: str,
    valid_ids: set[str],
) -> dict[str, Any]:
    normalized = normalize_constraint(constraint)
    require(normalized["contentid"] in valid_ids, f"{context}.contentid is orphaned")
    require_string(normalized["kind"], f"{context}.kind")
    require_string(normalized["applies_to"], f"{context}.applies_to", korean=True)
    require_string(normalized["condition"], f"{context}.condition", korean=True)
    require(normalized["status"] in CONSTRAINT_STATUSES, f"{context}.status is invalid")
    require(normalized["action"] in CONSTRAINT_ACTIONS, f"{context}.action is invalid")
    if normalized["action"] == "exclude":
        require(normalized["status"] == "confirmed", f"{context} exclude requires confirmed status")
    require_http_url(normalized["source_url"], f"{context}.source_url")
    require_date(normalized["checked_at"], f"{context}.checked_at")
    require_string(normalized["rule_id"], f"{context}.rule_id")
    return normalized


def validate_hard_constraints(
    records: Sequence[Mapping[str, Any]],
    expected_constraints: Mapping[str, Sequence[Mapping[str, Any]]],
    valid_ids: set[str],
    research_by_id: Mapping[str, Mapping[str, Any]],
    pilot_ids: set[str],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    constraint_ids: list[str] = []
    source_order_values: list[int] = []
    for index, record in enumerate(records):
        context = f"hard_constraints[{index}]"
        item = validate_hard_constraint(record, context, valid_ids)
        normalized.append(item)
        condition = item["condition"]
        pilot_anchor = item["contentid"] in pilot_ids
        require(
            record.get("pilot_anchor") is pilot_anchor,
            f"{context}.pilot_anchor differs from the frozen pilot membership",
        )
        if not pilot_anchor:
            require(
                "강풍·호우·폭염 등" not in condition,
                f"{context} contains the forbidden generic weather gate",
            )
            require(
                "보행 거리와 계단·경사" not in condition,
                f"{context} contains the forbidden generic mobility gate",
            )
        if item["kind"] == "eligibility":
            compact_condition = re.sub(r"[\s·,.;:()]+", "", condition)
            generic_eligibility = {
                "전연령",
                "전연령가능",
                "제한없음",
                "연령제한없음",
                "이용제한없음",
            }
            require(
                compact_condition not in generic_eligibility,
                f"{context} turns a no-restriction fact into an eligibility gate",
            )
        if item["kind"] == "reservation":
            require(len(condition) <= 200, f"{context} reservation condition exceeds 200 characters")
            research_summary = clean(research_by_id[item["contentid"]].get("summary"))
            require(condition != research_summary, f"{context} reservation condition copies the full summary")
            require(
                not (len(condition) >= 160 and research_summary.startswith(condition)),
                f"{context} reservation condition is a truncated summary",
            )
        if item["kind"] == "weather_control":
            false_gate_phrases = (
                "기상 상황에 관계없이",
                "기상과 관계없이",
                "날씨에 관계없이",
                "날씨와 관계없이",
                "날씨와 상관없이",
                "우천 시에도 정상 운영",
                "비가 와도 정상 운영",
            )
            concrete_control_phrases = (
                "중단",
                "통제",
                "취소",
                "변경",
                "결항",
                "휴장",
                "불가",
                "제한",
                "문의",
                "확인",
            )
            if any(phrase in condition for phrase in false_gate_phrases):
                require(
                    any(phrase in condition for phrase in concrete_control_phrases),
                    f"{context} creates a weather gate from a no-impact statement",
                )
        candidate_record_matches_hash(
            record,
            record.get("record_sha256"),
            f"{context}.record_sha256",
        )
        constraint_id = record.get("constraint_id")
        if constraint_id is not None:
            constraint_ids.append(require_string(constraint_id, f"{context}.constraint_id"))
        source_order = record.get("source_order")
        if source_order is not None:
            require(isinstance(source_order, int), f"{context}.source_order must be an integer")
            source_order_values.append(source_order)
    if constraint_ids:
        require(len(constraint_ids) == len(records), "every hard constraint must have constraint_id")
        require(len(set(constraint_ids)) == len(constraint_ids), "hard constraint IDs must be unique")
    if source_order_values:
        require(len(source_order_values) == len(records), "every hard constraint must have source_order")
        require(source_order_values == sorted(source_order_values), "hard constraints must be source_order sorted")

    actual_by_id: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for item in normalized:
        actual_by_id[item["contentid"]].append(item)
    for contentid in valid_ids:
        expected = list(expected_constraints.get(contentid, []))
        actual = actual_by_id.get(contentid, [])
        require(actual == expected, f"hard_constraints.jsonl differs from proposal for {contentid}")
    for contentid in TARGETED_WEATHER_GATE_REGRESSIONS:
        require(contentid not in pilot_ids, f"targeted weather gate unexpectedly belongs to pilot: {contentid}")
        weather_gates = [
            item for item in actual_by_id.get(contentid, []) if item["kind"] == "weather_control"
        ]
        require(bool(weather_gates), f"targeted weather gate is missing: {contentid}")
        for gate in weather_gates:
            require_http_url(gate["source_url"], f"targeted weather gate source: {contentid}")
            require_date(gate["checked_at"], f"targeted weather gate checked_at: {contentid}")
    return normalized


def validate_review_queue(
    records: Sequence[Mapping[str, Any]],
    expected_ids: Sequence[str],
    proposals_by_id: Mapping[str, Mapping[str, Any]],
) -> None:
    validate_ordered_records(records, expected_ids, "review_queue.jsonl")
    for index, record in enumerate(records):
        contentid = expected_ids[index]
        context = f"review_queue[{index}] {contentid}"
        priority = first_present(record, "review_priority", "priority")
        reasons = first_present(record, "review_reasons", "reasons")
        require(priority == proposals_by_id[contentid]["review_priority"], f"{context} priority differs")
        require(reasons == proposals_by_id[contentid]["review_reasons"], f"{context} reasons differ")
        candidate_record_matches_hash(
            record,
            record.get("record_sha256"),
            f"{context}.record_sha256",
        )


def quote_identifier(name: str) -> str:
    require(bool(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name)), f"unsafe SQL identifier: {name}")
    return f'"{name}"'


def table_info(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(connection.execute(f"PRAGMA table_info({quote_identifier(table)})"))


def primary_key_columns(info: Sequence[sqlite3.Row]) -> tuple[str, ...]:
    return tuple(
        row["name"]
        for row in sorted((row for row in info if row["pk"]), key=lambda row: row["pk"])
    )


def has_unique_source_order(connection: sqlite3.Connection) -> bool:
    for index in connection.execute("PRAGMA index_list('places')"):
        if not index["unique"]:
            continue
        columns = [row["name"] for row in connection.execute(f"PRAGMA index_info({quote_identifier(index['name'])})")]
        if columns == ["source_order"]:
            return True
    return False


def validate_database_schema(connection: sqlite3.Connection) -> None:
    integrity = connection.execute("PRAGMA integrity_check").fetchall()
    require([row[0] for row in integrity] == ["ok"], "SQLite integrity_check failed")
    foreign_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
    require(not foreign_errors, f"SQLite foreign_key_check found {len(foreign_errors)} violation(s)")

    table_names = {
        row["name"]
        for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    missing_tables = set(REQUIRED_TABLE_COLUMNS) - table_names
    require(not missing_tables, f"SQLite required tables are missing: {sorted(missing_tables)}")

    for table, required_columns in REQUIRED_TABLE_COLUMNS.items():
        info = table_info(connection, table)
        actual_columns = {row["name"] for row in info}
        missing_columns = required_columns - actual_columns
        require(not missing_columns, f"SQLite {table} columns are missing: {sorted(missing_columns)}")
        require(
            primary_key_columns(info) == EXPECTED_PRIMARY_KEYS[table],
            f"SQLite {table} primary key differs",
        )

    require(has_unique_source_order(connection), "SQLite places.source_order must have a UNIQUE index")
    for table in ("places", "web_sources", "research", "label_axes", "hard_constraints"):
        sql_row = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        require(sql_row and "CHECK" in (sql_row["sql"] or "").upper(), f"SQLite {table} needs CHECK constraints")

    expected_foreign_targets = {
        "web_sources": {"places"},
        "research": {"places"},
        "label_proposals": {"places", "label_runs"},
        "label_axes": {"label_proposals"},
        "hard_constraints": {"label_proposals"},
    }
    for table, expected_targets in expected_foreign_targets.items():
        actual_targets = {
            row["table"] for row in connection.execute(f"PRAGMA foreign_key_list({quote_identifier(table)})")
        }
        require(
            expected_targets.issubset(actual_targets),
            f"SQLite {table} foreign keys do not cover {sorted(expected_targets)}",
        )


def database_rows(connection: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    return [dict(row) for row in connection.execute(f"SELECT * FROM {quote_identifier(table)}")]


def canonical_database_dump(connection: sqlite3.Connection) -> tuple[dict[str, Any], str]:
    table_dumps: list[dict[str, Any]] = []
    for table in LOGICAL_DB_TABLES:
        info = table_info(connection, table)
        columns = [row["name"] for row in info]
        order_columns = list(primary_key_columns(info)) or columns
        order_sql = ", ".join(quote_identifier(column) for column in order_columns)
        rows: list[list[Any]] = []
        query = f"SELECT * FROM {quote_identifier(table)} ORDER BY {order_sql}"
        for row in connection.execute(query):
            values: list[Any] = []
            for column in columns:
                value = row[column]
                if isinstance(value, bytes):
                    value = {"$bytes_hex": value.hex()}
                values.append(value)
            rows.append(values)
        table_dumps.append({"name": table, "columns": columns, "rows": rows})
    dump = {"tables": table_dumps}
    return dump, sha256_bytes(canonical_json_bytes(dump))


def candidate_record_matches_hash(record: Mapping[str, Any], digest: Any, context: str) -> None:
    require_sha256(digest, context)
    candidates = json_hash_candidates(
        record,
        removable_hash_keys=("record_sha256", "proposal_sha256"),
    )
    require(digest in candidates, f"{context} does not match canonical record JSON")


def resolve_label_run_id(
    label_runs: Sequence[Mapping[str, Any]], proposals: Sequence[Mapping[str, Any]]
) -> str:
    proposal_run_ids = {
        clean(proposal.get("label_run_id"))
        for proposal in proposals
        if clean(proposal.get("label_run_id"))
    }
    if proposal_run_ids:
        require(len(proposal_run_ids) == 1, "JSONL proposals reference multiple label runs")
        label_run_id = next(iter(proposal_run_ids))
    else:
        require(len(label_runs) == 1, "SQLite must contain exactly one label run when JSONL omits label_run_id")
        label_run_id = clean(label_runs[0]["label_run_id"])
    require(
        sum(clean(row["label_run_id"]) == label_run_id for row in label_runs) == 1,
        "active label run is missing or duplicated in SQLite",
    )
    return label_run_id


def compare_database(
    database_path: Path,
    source_places: Sequence[Mapping[str, Any]],
    pages: Sequence[Mapping[str, Any]],
    research_by_id: Mapping[str, Mapping[str, Any]],
    proposals_by_id: Mapping[str, Mapping[str, Any]],
    flat_constraints: Sequence[Mapping[str, Any]],
) -> tuple[str, dict[str, str], collections.Counter[str]]:
    require(database_path.is_file(), f"SQLite database is missing: {database_path.as_posix()}")
    uri = database_path.resolve().as_uri() + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        validate_database_schema(connection)
        place_rows = database_rows(connection, "places")
        require(len(place_rows) == EXPECTED_PLACE_COUNT, "SQLite places count must be 1,434")
        place_rows.sort(key=lambda row: row["source_order"])
        expected_ids = [str(place["contentid"]) for place in source_places]
        source_order_by_id = {contentid: index for index, contentid in enumerate(expected_ids)}
        require([clean(row["contentid"]) for row in place_rows] == expected_ids, "SQLite place order differs")
        for index, row in enumerate(place_rows):
            contentid = expected_ids[index]
            context = f"SQLite places[{index}] {contentid}"
            source = source_places[index]
            require(clean(row["contenttypeid"]) == str(source["contenttypeid"]), f"{context} type differs")
            require(row["title"] == source["title"], f"{context} title differs")
            expected_address = " ".join(
                clean(source.get(key)) for key in ("addr1", "addr2") if clean(source.get(key))
            )
            require(row["address"] == expected_address, f"{context} address differs")
            require(row["longitude"] == float(source["mapx"]), f"{context} longitude differs")
            require(row["latitude"] == float(source["mapy"]), f"{context} latitude differs")
            for db_key, source_key in (("lcls1", "lclsSystm1"), ("lcls2", "lclsSystm2"), ("lcls3", "lclsSystm3")):
                require(row[db_key] == source.get(source_key), f"{context} {db_key} differs")
            raw_record = parse_json_column(row["raw_json"], f"{context}.raw_json")
            require(raw_record == source, f"{context}.raw_json differs from input")
            candidate_record_matches_hash(source, row["record_sha256"], f"{context}.record_sha256")

        web_rows = database_rows(connection, "web_sources")
        require(len(web_rows) == len(pages), "SQLite web_sources count differs from web_pages.jsonl")
        web_by_id = {clean(row["contentid"]): row for row in web_rows}
        require(set(web_by_id) == set(expected_ids), "SQLite web_sources contentid coverage differs")
        for page in pages:
            contentid = clean(page["contentid"])
            row = web_by_id[contentid]
            require(row["source_id"] == f"web:{contentid}", f"SQLite web source ID differs: {contentid}")
            require(
                row["url"] == first_present(page, "source_url", "url"),
                f"SQLite web source URL differs: {contentid}",
            )
            for db_key, page_keys in {
                "final_url": ("final_url",),
                "publisher": ("publisher",),
                "source_type": ("source_type",),
                "fetched_on": ("fetched_on", "checked_at"),
                "http_status": ("http_status",),
                "page_title": ("page_title",),
                "page_address": ("page_address",),
                "page_sha256": ("page_sha256",),
                "retrieval_error": ("retrieval_error",),
            }.items():
                require(row[db_key] == first_present(page, *page_keys), f"SQLite web source {db_key} differs: {contentid}")
            require(
                parse_json_column(
                    row["homepage_candidates_json"],
                    f"SQLite web source homepage candidates {contentid}",
                ) == (page.get("homepage_urls") or []),
                f"SQLite web source homepage candidates differ: {contentid}",
            )

        research_rows = database_rows(connection, "research")
        require(len(research_rows) == EXPECTED_PLACE_COUNT, "SQLite research count must be 1,434")
        research_rows_by_id = {clean(row["contentid"]): row for row in research_rows}
        require(set(research_rows_by_id) == set(expected_ids), "SQLite research ID coverage differs")
        for contentid in expected_ids:
            row = research_rows_by_id[contentid]
            record = research_by_id[contentid]
            for db_key, record_key in {
                "research_status": "research_status",
                "identity_notes": "identity_notes",
                "summary": "summary",
                "place_kind": "place_kind",
                "experience_scope": "experience_scope",
                "typical_visit": "typical_visit",
            }.items():
                require(row[db_key] == record.get(record_key), f"SQLite research {db_key} differs: {contentid}")
            environment = first_present(record.get("facts", {}), "environment")
            require(row["environment"] == environment, f"SQLite research environment differs: {contentid}")
            require(
                parse_json_column(row["facts_json"], f"SQLite research facts {contentid}") == record["facts"],
                f"SQLite research facts differ: {contentid}",
            )
            require(
                parse_json_column(row["unknowns_json"], f"SQLite research unknowns {contentid}") == record["unknowns"],
                f"SQLite research unknowns differ: {contentid}",
            )
            candidate_record_matches_hash(record, row["record_sha256"], f"SQLite research record_sha256 {contentid}")

        label_runs = database_rows(connection, "label_runs")
        label_run_id = resolve_label_run_id(label_runs, list(proposals_by_id.values()))
        active_run = next(row for row in label_runs if clean(row["label_run_id"]) == label_run_id)
        require_string(active_run["algorithm_version"], "SQLite label_runs.algorithm_version")
        require_sha256(active_run["input_digest"], "SQLite label_runs.input_digest")
        require_sha256(active_run["climate_hash"], "SQLite label_runs.climate_hash")
        require(
            clean(active_run["status"]) in {"ai_draft", "complete", "completed", "frozen"},
            "SQLite label run is not terminal",
        )

        proposal_rows = [
            row for row in database_rows(connection, "label_proposals")
            if clean(row["label_run_id"]) == label_run_id
        ]
        require(len(proposal_rows) == EXPECTED_PLACE_COUNT, "SQLite label_proposals count must be 1,434")
        proposal_rows_by_id = {clean(row["contentid"]): row for row in proposal_rows}
        require(set(proposal_rows_by_id) == set(expected_ids), "SQLite label proposal ID coverage differs")
        for contentid in expected_ids:
            row = proposal_rows_by_id[contentid]
            proposal = proposals_by_id[contentid]
            expected_order = source_order_by_id[contentid]
            require(row["source_order"] == expected_order, f"SQLite proposal source_order differs: {contentid}")
            require(
                row["experience_scope"] == proposal["experience_scope"],
                f"SQLite proposal experience_scope differs: {contentid}",
            )
            require(
                row["research_status"] == proposal["research_status"],
                f"SQLite proposal research_status differs: {contentid}",
            )
            require(
                row["pilot_anchor"] == (1 if proposal.get("pilot_anchor") else 0),
                f"SQLite proposal pilot_anchor differs: {contentid}",
            )
            require(row["review_priority"] == proposal["review_priority"], f"SQLite priority differs: {contentid}")
            require(
                parse_json_column(row["review_reasons_json"], f"SQLite review reasons {contentid}")
                == proposal["review_reasons"],
                f"SQLite review reasons differ: {contentid}",
            )
            candidate_record_matches_hash(proposal, row["proposal_sha256"], f"SQLite proposal_sha256 {contentid}")

        axis_rows = [
            row for row in database_rows(connection, "label_axes")
            if clean(row["label_run_id"]) == label_run_id
        ]
        require(len(axis_rows) == EXPECTED_TOTAL_AXES, "SQLite label_axes count must be 24,378")
        axis_by_key = {
            (clean(row["contentid"]), clean(row["axis_group"]), clean(row["axis_key"])): row
            for row in axis_rows
        }
        require(len(axis_by_key) == EXPECTED_TOTAL_AXES, "SQLite label axis keys are duplicated")
        db_inference_counts: collections.Counter[str] = collections.Counter()
        for contentid in expected_ids:
            proposal = proposals_by_id[contentid]
            for group, keys in (("companion", COMPANION_KEYS), ("month", MONTH_KEYS)):
                proposal_group = proposal[f"{group}_fit"]
                for axis_key in keys:
                    row = axis_by_key.get((contentid, group, axis_key))
                    require(row is not None, f"SQLite label axis is missing: {contentid}/{group}/{axis_key}")
                    axis = proposal_group[axis_key]
                    expected_order = source_order_by_id[contentid]
                    require(
                        row["source_order"] == expected_order,
                        f"SQLite axis source_order differs: {contentid}/{group}/{axis_key}",
                    )
                    require(
                        row["experience_scope"] == proposal["experience_scope"],
                        f"SQLite axis experience_scope differs: {contentid}/{group}/{axis_key}",
                    )
                    expected_state = axis.get("state") or (
                        "not_applicable" if axis.get("value") is None else "numeric"
                    )
                    require(row["state"] == expected_state, f"SQLite axis state differs: {contentid}/{group}/{axis_key}")
                    for key in ("value", "confidence", "inference_level", "rationale", "null_reason"):
                        require(row[key] == axis.get(key), f"SQLite axis {key} differs: {contentid}/{group}/{axis_key}")
                    require(
                        parse_json_column(row["evidence_ids_json"], "SQLite axis evidence_ids_json")
                        == axis["evidence_ids"],
                        f"SQLite axis evidence differs: {contentid}/{group}/{axis_key}",
                    )
                    require(
                        parse_json_column(row["rule_ids_json"], "SQLite axis rule_ids_json")
                        == axis["rule_ids"],
                        f"SQLite axis rule IDs differ: {contentid}/{group}/{axis_key}",
                    )
                    db_inference_counts[clean(row["inference_level"])] += 1

        constraint_rows = [
            row for row in database_rows(connection, "hard_constraints")
            if clean(row["label_run_id"]) == label_run_id
        ]
        require(len(constraint_rows) == len(flat_constraints), "SQLite hard constraint count differs")
        flat_by_constraint_id = {
            clean(record.get("constraint_id")): record for record in flat_constraints
        }
        require(
            "" not in flat_by_constraint_id and len(flat_by_constraint_id) == len(flat_constraints),
            "hard_constraints.jsonl constraint IDs are missing or duplicated",
        )
        for row in constraint_rows:
            constraint_id = clean(row["constraint_id"])
            record = flat_by_constraint_id.get(constraint_id)
            require(record is not None, f"SQLite hard constraint ID is absent from JSONL: {constraint_id}")
            contentid = clean(row["contentid"])
            require(
                row["source_order"] == source_order_by_id[contentid],
                f"SQLite hard constraint source_order differs: {constraint_id}",
            )
            require(
                record.get("source_order") == row["source_order"],
                f"SQLite/JSONL hard constraint source_order differs: {constraint_id}",
            )
            require(
                row["experience_scope"] == proposals_by_id[contentid]["experience_scope"]
                == record.get("experience_scope"),
                f"SQLite/JSONL hard constraint experience_scope differs: {constraint_id}",
            )
            require(
                row["record_sha256"] == record.get("record_sha256"),
                f"SQLite hard constraint record SHA-256 differs: {constraint_id}",
            )
        db_constraints = [normalize_constraint(row) for row in constraint_rows]
        expected_constraints = [normalize_constraint(row) for row in flat_constraints]
        sort_key = lambda item: canonical_json_bytes(item)
        require(
            sorted(db_constraints, key=sort_key) == sorted(expected_constraints, key=sort_key),
            "SQLite hard constraints differ from JSONL",
        )

        dataset_meta = {
            clean(row["key"]): clean(row["value"])
            for row in database_rows(connection, "dataset_meta")
        }
        _, logical_digest = canonical_database_dump(connection)
        recorded_logical = first_present(
            dataset_meta,
            "logical_db_digest",
            "logical_digest",
            "database_logical_sha256",
        )
        if recorded_logical is not None:
            require(recorded_logical == logical_digest, "SQLite dataset_meta logical digest differs")
        return logical_digest, dataset_meta, db_inference_counts
    finally:
        connection.close()


def walk_objects(value: Any) -> Iterable[Mapping[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_objects(child)


def manifest_contains_value(manifest: Any, expected: Any) -> bool:
    if manifest == expected:
        return True
    if isinstance(manifest, dict):
        return any(manifest_contains_value(value, expected) for value in manifest.values())
    if isinstance(manifest, list):
        return any(manifest_contains_value(value, expected) for value in manifest)
    return False


def find_values_for_keys(value: Any, keys: set[str]) -> list[Any]:
    results: list[Any] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in keys:
                results.append(child)
            results.extend(find_values_for_keys(child, keys))
    elif isinstance(value, list):
        for child in value:
            results.extend(find_values_for_keys(child, keys))
    return results


def require_manifest_stat(manifest: Mapping[str, Any], keys: set[str], expected: Any, label: str) -> None:
    values = find_values_for_keys(manifest, keys)
    require(bool(values), f"manifest {label} statistic is missing")
    require(any(value == expected for value in values), f"manifest {label} statistic differs")


def resolve_manifest_path(root: Path, output: Path, path_value: str) -> Path | None:
    candidate = Path(path_value)
    if candidate.is_absolute():
        return candidate if candidate.exists() else None
    root_candidate = root / candidate
    if root_candidate.exists():
        return root_candidate
    output_candidate = output / candidate
    if output_candidate.exists():
        return output_candidate
    name_candidate = output / candidate.name
    return name_candidate if name_candidate.exists() else None


def validate_manifest(
    root: Path,
    output: Path,
    manifest: Mapping[str, Any],
    logical_digest: str,
    type_counts: Mapping[str, int],
    research_status_counts: Mapping[str, int],
    priority_counts: Mapping[str, int],
    inference_counts: Mapping[str, int],
) -> None:
    require(clean(manifest.get("status")) == "ai_draft", "manifest status must be ai_draft")
    require(manifest_contains_value(manifest, logical_digest), "manifest logical DB digest differs or is missing")
    algorithm_versions = find_values_for_keys(manifest, {"algorithm_version"})
    require(
        any(isinstance(value, str) and clean(value) for value in algorithm_versions),
        "manifest algorithm_version is missing",
    )
    rule_hashes = find_values_for_keys(
        manifest,
        {"rules_sha256", "rule_sha256", "algorithm_sha256", "builder_sha256"},
    )
    require(
        any(isinstance(value, str) and SHA256_RE.fullmatch(value) for value in rule_hashes),
        "manifest rule/builder SHA-256 is missing",
    )

    # Every declared local path/hash pair must resolve and match.  Conversely,
    # every required output and protected input digest must appear somewhere in
    # the manifest, allowing the builder to group metadata without weakening
    # the contract.
    for object_value in walk_objects(manifest):
        if "path" not in object_value or "sha256" not in object_value:
            continue
        path_value = object_value["path"]
        digest = object_value["sha256"]
        if not isinstance(path_value, str) or not isinstance(digest, str):
            continue
        require_sha256(digest, f"manifest hash for {path_value}")
        resolved = resolve_manifest_path(root, output, path_value)
        require(resolved is not None and resolved.is_file(), f"manifest path is missing: {path_value}")
        require(sha256_file(resolved) == digest, f"manifest file hash differs: {path_value}")

    for relative in REQUIRED_OUTPUT_FILES:
        # A manifest cannot contain its own final byte hash without a
        # self-reference.  Its contents are validated field-by-field instead.
        if relative == Path("manifest.json"):
            continue
        path = output / relative
        digest = sha256_file(path)
        require(manifest_contains_value(manifest, digest), f"manifest omits output SHA-256: {relative.as_posix()}")
    # Only artifacts actually consumed by the full build belong in its input
    # provenance.  restaurants.json is still protected byte-for-byte above,
    # but requiring its hash here would falsely describe it as a build input.
    for relative in (SOURCE_RELATIVE, PARTITION_MANIFEST_RELATIVE):
        digest = PROTECTED_FILE_DIGESTS[relative.as_posix()]
        require(manifest_contains_value(manifest, digest), f"manifest omits build input SHA-256: {relative}")

    pilot_v2_manifest = root / PILOT_V2_RELATIVE / "manifest.json"
    pilot_v3_manifest = root / PILOT_V3_RELATIVE / "manifest.json"
    climate_fixture = root / "data/climate/kma/1991-2020/jeju_four_station_monthly_normals.json"
    for path, label in (
        (pilot_v2_manifest, "pilot v2"),
        (pilot_v3_manifest, "pilot v3"),
        (climate_fixture, "climate fixture"),
    ):
        require(manifest_contains_value(manifest, sha256_file(path)), f"manifest omits {label} SHA-256")

    require_manifest_stat(manifest, {"total", "place_count", "places"}, EXPECTED_PLACE_COUNT, "place count")
    require_manifest_stat(
        manifest,
        {"by_content_type", "content_type_counts", "by_type"},
        dict(type_counts),
        "content types",
    )
    require_manifest_stat(
        manifest,
        {"by_research_status", "research_status", "research_status_counts"},
        dict(research_status_counts),
        "research status",
    )
    require_manifest_stat(
        manifest,
        {"companion_numeric", "companion_axes_numeric"},
        EXPECTED_COMPANION_AXES,
        "companion coverage",
    )
    require_manifest_stat(
        manifest,
        {"nonfestival_month_numeric", "nonfestival_month_axes_numeric"},
        EXPECTED_NONFESTIVAL_MONTH_AXES,
        "non-festival month coverage",
    )
    require_manifest_stat(
        manifest,
        {"festival_month_na", "festival_month_not_applicable"},
        EXPECTED_FESTIVAL_MONTH_NA,
        "festival month N/A coverage",
    )
    require_manifest_stat(
        manifest,
        {"review_priority", "by_review_priority", "review_priority_counts"},
        dict(priority_counts),
        "review priority",
    )
    require_manifest_stat(
        manifest,
        {"inference_level", "by_inference_level", "inference_level_counts"},
        dict(inference_counts),
        "inference levels",
    )


def validate(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.workspace_root).resolve()
    output = Path(args.output_dir).resolve() if args.output_dir else root / OUTPUT_RELATIVE
    require(root.is_dir(), f"workspace root is missing: {root.as_posix()}")
    require(output.is_dir(), f"SPEC-007 output directory is missing: {output.as_posix()}")
    for relative in REQUIRED_OUTPUT_FILES:
        require((output / relative).is_file(), f"required output is missing: {(output / relative).as_posix()}")

    validate_protected_inputs(root)
    source_places, type_counts = validate_source_places(root)
    expected_ids = [str(place["contentid"]) for place in source_places]

    pages = read_jsonl(output / "research/web_pages.jsonl")
    research_records = read_jsonl(output / "place_web_research.jsonl")
    proposals = read_jsonl(output / "auto_label_proposals.jsonl")
    hard_constraints = read_jsonl(output / "hard_constraints.jsonl")
    review_queue = read_jsonl(output / "review_queue.jsonl")

    pages_by_id, fetch_outcomes = validate_web_pages(pages, source_places)
    research_by_id, research_status_counts, evidence_by_id = validate_research(
        research_records, source_places, pages_by_id
    )
    pilot_proposals = read_json(root / PILOT_V3_RELATIVE / "auto_label_proposals.json")
    require(isinstance(pilot_proposals, list), "pilot v3 proposals must be an array")
    proposals_by_id, proposal_constraints, priority_counts, inference_counts = validate_proposals(
        proposals,
        source_places,
        research_by_id,
        evidence_by_id,
        pilot_proposals,
    )
    normalized_constraints = validate_hard_constraints(
        hard_constraints,
        proposal_constraints,
        set(expected_ids),
        research_by_id,
        {clean(proposal.get("contentid")) for proposal in pilot_proposals},
    )
    validate_review_queue(review_queue, expected_ids, proposals_by_id)

    logical_digest, dataset_meta, db_inference_counts = compare_database(
        output / "place_profiles.sqlite3",
        source_places,
        pages,
        research_by_id,
        proposals_by_id,
        hard_constraints,
    )
    require(
        dict(db_inference_counts) == dict(inference_counts),
        "SQLite inference distribution differs from JSONL",
    )

    manifest = require_mapping(read_json(output / "manifest.json"), "full manifest")
    validate_manifest(
        root,
        output,
        manifest,
        logical_digest,
        type_counts,
        research_status_counts,
        priority_counts,
        inference_counts,
    )

    return {
        "valid": True,
        "places": EXPECTED_PLACE_COUNT,
        "content_types": dict(sorted(type_counts.items())),
        "fetch": dict(sorted(fetch_outcomes.items())),
        "research_status": dict(sorted(research_status_counts.items())),
        "axes": {
            "companion_numeric": EXPECTED_COMPANION_AXES,
            "nonfestival_month_numeric": EXPECTED_NONFESTIVAL_MONTH_AXES,
            "festival_month_na": EXPECTED_FESTIVAL_MONTH_NA,
            "total": EXPECTED_TOTAL_AXES,
        },
        "inference_level": dict(sorted(inference_counts.items())),
        "review_priority": dict(sorted(priority_counts.items())),
        "hard_constraints": len(normalized_constraints),
        "logical_db_digest": logical_digest,
        "logical_db_digest_algorithm": "trip-ai-sqlite-logical-v1",
        "database_meta_keys": sorted(dataset_meta),
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate SPEC-007 full-place JSONL and SQLite outputs."
    )
    parser.add_argument(
        "--workspace-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="repository root (default: inferred from this script)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="override the SPEC-007 output directory",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        result = validate(args)
    except (ValidationError, OSError, sqlite3.Error) as error:
        print(f"SPEC-007 validation failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
