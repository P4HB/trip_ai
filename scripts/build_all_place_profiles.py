#!/usr/bin/env python3
"""Build SPEC-007 canonical JSONL exports and the derived SQLite database.

The web fetch is intentionally a separate step.  This builder is deterministic:
given the same source snapshot, completed web cache, pilot anchors, climate
fixture, and rule implementation it emits the same logical records.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = "2026-08-09"
FULL_VERSION = "place-profile-v1-all-1434"
ALGORITHM_VERSION = "full-place-autolabel-rules-v1"
LABEL_RUN_ID = f"{FULL_VERSION}:{ALGORITHM_VERSION}"

COMPANION_KEYS = ("solo", "couple", "friends", "kids", "parents")
MONTH_KEYS = tuple(str(month) for month in range(1, 13))
LABEL_VALUES = {0.0, 0.25, 0.5, 0.75, 1.0}
EXPECTED_TYPE_COUNTS = {
    "12": 566,
    "14": 97,
    "15": 28,
    "28": 137,
    "32": 209,
    "38": 397,
}
WATER_KIDS_FACT_OVERRIDES: dict[str, tuple[float, str]] = {
    "2864448": (0.75, "웹 overview의 어린이 안전·유아 공간·가족 안전 직접 단서"),
    "2798709": (0.75, "웹 overview의 어린이 안전·유아 공간·가족 안전 직접 단서"),
    "3031552": (0.75, "웹 overview의 어린이 안전·유아 공간·가족 안전 직접 단서"),
    "3563239": (0.75, "웹 overview의 어린이 안전·유아 공간·가족 안전 직접 단서"),
    "2738709": (0.5, "웹 overview의 가족·남녀노소 이용 직접 단서"),
    "2751848": (0.5, "웹 overview의 가족·남녀노소 이용 직접 단서"),
    "3066943": (0.5, "웹 overview의 가족·남녀노소 이용 직접 단서"),
    "3464225": (0.5, "웹 overview의 가족·남녀노소 이용 직접 단서"),
}
DIRECT_COMPANION_RULE = "COMP-DIRECT-WEB-EXPLICIT-COMPANION"
COMPANION_DIRECT_FACT_OVERRIDES: dict[str, dict[str, tuple[float, str, str]]] = {
    "127479": {
        "kids": (
            0.75,
            "완만하고 계단 없는 산책로를 어린이도 편하게 이용할 수 있다는 설명",
            "산책로는 비교적 완만하고 경사가 낮고 계단이 없어 노약자나 어린이, 장애인도 편하게 이용할 수 있다",
        ),
        "parents": (
            0.75,
            "완만하고 계단 없는 산책로를 노약자도 편하게 이용할 수 있다는 설명",
            "산책로는 비교적 완만하고 경사가 낮고 계단이 없어 노약자나 어린이, 장애인도 편하게 이용할 수 있다",
        ),
    },
    "128838": {
        "kids": (
            0.75,
            "어린이를 동반한 가족 단위 여행객에게 인기 있다는 설명",
            "어린이를 동반한 가족단위 여행객들에게 인기 있는 관광 프로그램",
        ),
    },
    "130317": {
        "kids": (
            0.75,
            "아이부터 어른까지 누구나 좋아할 전시라는 설명",
            "아이에서 어른 할 것 없이 누구나 좋아하고 사랑하는 테디베어",
        ),
    },
    "637398": {
        "kids": (
            0.75,
            "어린아이부터 노인까지 함께 즐기는 가족형 레저라는 설명",
            "어린아이부터 노인에 이르기까지 남녀노소 누구나 함께 즐길 수 있는 가족형 레저 스포츠",
        ),
        "parents": (
            0.75,
            "어린아이부터 노인까지 함께 즐기는 가족형 레저라는 설명",
            "어린아이부터 노인에 이르기까지 남녀노소 누구나 함께 즐길 수 있는 가족형 레저 스포츠",
        ),
    },
    "1918646": {
        "kids": (
            0.75,
            "평탄한 둘레길을 어린아이도 충분히 탐방할 수 있다는 설명",
            "어린아이와 노약자들도 충분히 탐방이 가능할 만큼 평탄한 구간",
        ),
        "parents": (
            0.75,
            "평탄한 둘레길을 노약자도 충분히 탐방할 수 있다는 설명",
            "어린아이와 노약자들도 충분히 탐방이 가능할 만큼 평탄한 구간",
        ),
    },
    "2714826": {
        "kids": (
            0.75,
            "정비된 계단과 길로 어린 자녀 동반 가족이 많이 오른다는 설명",
            "어린 자녀와 함께 오르는 가족단위 여행객도 많다",
        ),
    },
    "2740133": {
        "kids": (
            0.75,
            "가벼운 10분 오름길이라 어린이를 동반해도 좋다는 설명",
            "어린이를 동반해도 좋다",
        ),
    },
    "2785869": {
        "kids": (
            0.75,
            "얕은 수심에서 어린이가 쾌적하고 안전하게 물놀이하기 좋다는 설명",
            "수심도 얕은 편이라 어린이들과 쾌적하고 안전하게 물놀이를 즐기기에도 좋다",
        ),
    },
    "2994124": {
        "kids": (
            0.75,
            "4세 이상 어린이와 초보자도 직원 인솔로 안전하게 체험할 수 있다는 설명",
            "4세 이상 어린이를 포함해 처음 승마하는 사람도 안전하게 체험할 수 있도록 직원 인솔 및 관련 프로그램",
        ),
    },
    "3037623": {
        "kids": (
            0.75,
            "아이 동반 가족과 부모님이 함께 만족하는 공연이라는 설명",
            "아이가 있는 가족여행객뿐 아니라 부모님도 만족하는 공연으로 온 가족이 함께 즐기기 좋은",
        ),
        "parents": (
            0.75,
            "아이 동반 가족과 부모님이 함께 만족하는 공연이라는 설명",
            "아이가 있는 가족여행객뿐 아니라 부모님도 만족하는 공연으로 온 가족이 함께 즐기기 좋은",
        ),
    },
}
PLACE_KIND = {
    "12": "tourist_attraction",
    "14": "cultural_facility",
    "15": "festival_event",
    "25": "travel_course",
    "28": "leisure_sports",
    "32": "accommodation",
    "38": "shopping",
}
EXPERIENCE_SCOPE = {
    "12": "representative_visit",
    "14": "representative_visit",
    "15": "event_participation",
    "25": "course_traversal",
    "28": "representative_visit",
    "32": "stay",
    "38": "shopping_visit",
}
TYPE_LABEL = {
    "12": "관광지",
    "14": "문화시설",
    "15": "축제·행사",
    "25": "여행코스",
    "28": "레포츠",
    "32": "숙박시설",
    "38": "쇼핑 장소",
}

DEFAULT_INPUT = ROOT / "data" / "labeling" / "jeju" / SNAPSHOT / "non_restaurants.json"
DEFAULT_PARTITION_MANIFEST = ROOT / "data" / "labeling" / "jeju" / SNAPSHOT / "manifest.json"
DEFAULT_WEB_CACHE = (
    ROOT
    / "data"
    / "labeling"
    / "jeju"
    / SNAPSHOT
    / "full"
    / FULL_VERSION
    / "research"
    / "web_pages.jsonl"
)
PILOT_V2_DIR = (
    ROOT
    / "data"
    / "labeling"
    / "jeju"
    / SNAPSHOT
    / "pilots"
    / "place-profile-v2-100"
)
PILOT_V3_DIR = (
    ROOT
    / "data"
    / "labeling"
    / "jeju"
    / SNAPSHOT
    / "pilots"
    / "place-profile-v3-auto-100"
)
DEFAULT_CLIMATE = (
    ROOT / "data" / "climate" / "kma" / "1991-2020" / "jeju_four_station_monthly_normals.json"
)
DEFAULT_OUTPUT_DIR = DEFAULT_WEB_CACHE.parents[1]

RULESET_DESCRIPTOR = {
    "algorithm_version": ALGORITHM_VERSION,
    "archetype_inputs": ["contenttypeid", "lclsSystm1", "lclsSystm2", "lclsSystm3", "title", "overview"],
    "classification_priority": ["contenttypeid", "lclsSystm3", "lclsSystm2", "exact_title_keywords"],
    "overview_policy": "summary, direct facts, and explicit environment refinement; never primary archetype",
    "direct_companion_policy": "only curated explicit companion claims in the fetched overview become direct_evidence",
    "hard_constraint_policy": "direct page condition only; generic sensitivity stays in prior/review",
    "inference_priority": [
        "pilot_reviewed_anchor",
        "direct_evidence",
        "researched_inference",
        "archetype_prior",
        "climate_heuristic",
    ],
    "fallback_confidence": 0.25,
    "non_direct_extreme_policy": "0.25..0.75 only",
    "coordinate_bounds": {"longitude": [125.5, 127.5], "latitude": [32.5, 34.2]},
    "special_cases": {"2704351": "retain_coordinate_anomaly_and_high_priority"},
}

TIME_VARYING_INFO_KEYS = (
    "운영",
    "영업",
    "이용시간",
    "휴일",
    "휴무",
    "가격",
    "요금",
    "장서는날",
    "개최",
    "행사기간",
    "체크인",
    "체크아웃",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--partition-manifest", type=Path, default=DEFAULT_PARTITION_MANIFEST)
    parser.add_argument("--web-cache", type=Path, default=DEFAULT_WEB_CACHE)
    parser.add_argument("--pilot-v2-dir", type=Path, default=PILOT_V2_DIR)
    parser.add_argument("--pilot-v3-dir", type=Path, default=PILOT_V3_DIR)
    parser.add_argument("--climate", type=Path, default=DEFAULT_CLIMATE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, 1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSONL at {relative(path)}:{line_number}: {error}") from error
            if not isinstance(value, dict):
                raise ValueError(f"JSONL line must be an object at {relative(path)}:{line_number}")
            records.append(value)
    return records


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temp.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    except BaseException:
        if temp.exists():
            temp.unlink()
        raise


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    body = "".join(f"{canonical_json(record)}\n" for record in records)
    atomic_write_text(path, body)


def clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def short_summary(value: Any, fallback: str, limit: int = 320) -> str:
    text = clean(value)
    if not text:
        return fallback
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return f"{cut or text[: limit - 1]}…"


def excerpt_with_any(value: Any, needles: Iterable[str], limit: int = 260) -> str:
    text = clean(value)
    if not text:
        return ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if has_any(sentence, needles):
            return short_summary(sentence, "", limit)
    positions = [text.find(needle) for needle in needles if needle in text]
    if not positions:
        return ""
    position = min(positions)
    start = max(0, position - limit // 3)
    return short_summary(text[start : start + limit], "", limit)


def excerpt_with_any_excluding(
    value: Any,
    needles: Iterable[str],
    exclusions: Iterable[str],
    limit: int = 180,
) -> str:
    text = clean(value)
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for sentence in sentences:
        if has_any(sentence, needles) and not has_any(sentence, exclusions):
            return short_summary(sentence, "", limit)
    return ""


def first_info(info: dict[str, Any], *needles: str) -> str:
    for key, raw_values in info.items():
        compact_key = clean(key).replace(" ", "")
        if not any(needle.replace(" ", "") in compact_key for needle in needles):
            continue
        values = raw_values if isinstance(raw_values, list) else [raw_values]
        result = " / ".join(clean(value) for value in values if clean(value))
        if result:
            return result
    return ""


def first_labeled_info(info: dict[str, Any], *needles: str) -> str:
    for key, raw_values in info.items():
        compact_key = clean(key).replace(" ", "")
        if not any(needle.replace(" ", "") in compact_key for needle in needles):
            continue
        values = raw_values if isinstance(raw_values, list) else [raw_values]
        result = " / ".join(clean(value) for value in values if clean(value))
        if result:
            return f"{clean(key)}: {result}"
    return ""


def has_any(text: str, needles: Iterable[str]) -> bool:
    return any(needle in text for needle in needles)


def valid_sha256(value: Any) -> bool:
    text = str(value or "")
    return len(text) == 64 and all(character in "0123456789abcdefABCDEF" for character in text)


def float_or_none(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coordinate_anomaly(place: dict[str, Any]) -> bool:
    longitude = float_or_none(place.get("mapx"))
    latitude = float_or_none(place.get("mapy"))
    return not (
        longitude is not None
        and latitude is not None
        and 125.5 <= longitude <= 127.5
        and 32.5 <= latitude <= 34.2
    )


def validate_places(places: Any) -> list[dict[str, Any]]:
    if not isinstance(places, list) or len(places) != 1_434:
        raise ValueError(f"Expected 1,434 non-restaurant places, received {len(places) if isinstance(places, list) else 'non-array'}")
    ids: set[str] = set()
    counts: Counter[str] = Counter()
    for source_order, place in enumerate(places):
        if not isinstance(place, dict):
            raise ValueError(f"Input row {source_order} is not an object")
        contentid = clean(place.get("contentid"))
        contenttypeid = clean(place.get("contenttypeid"))
        if not contentid or contentid in ids:
            raise ValueError(f"Missing or duplicate contentid at source_order {source_order}: {contentid!r}")
        if contenttypeid not in EXPECTED_TYPE_COUNTS:
            raise ValueError(f"Unsupported contenttypeid {contenttypeid!r} for {contentid}")
        if not clean(place.get("title")):
            raise ValueError(f"Missing title for {contentid}")
        ids.add(contentid)
        counts[contenttypeid] += 1
    if dict(counts) != EXPECTED_TYPE_COUNTS:
        raise ValueError(f"Unexpected content type distribution: {dict(counts)}")
    if "2704351" not in ids:
        raise ValueError("Required coordinate-anomaly anchor 2704351 is missing")
    return places


WEB_REQUIRED_FIELDS = {
    "schema_version",
    "source_order",
    "contentid",
    "expected_title",
    "expected_address",
    "contenttypeid",
    "source_url",
    "publisher",
    "source_type",
    "fetched_on",
    "http_status",
    "final_url",
    "redirected",
    "response_content_type",
    "response_bytes",
    "attempt_count",
    "page_title",
    "title_matches",
    "normalized_title_matches",
    "page_address",
    "address_matches",
    "overview",
    "overview_source",
    "meta_description",
    "info",
    "homepage_urls",
    "source_modified",
    "page_sha256",
    "retrieval_error",
    "cache_origin",
}


def validate_web_cache(records: list[dict[str, Any]], places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(records) != len(places):
        raise ValueError(f"Expected 1,434 web cache records, received {len(records)}")
    for source_order, (record, place) in enumerate(zip(records, places, strict=True)):
        missing = WEB_REQUIRED_FIELDS - record.keys()
        if missing:
            raise ValueError(f"Web cache row {source_order} is missing fields: {sorted(missing)}")
        contentid = clean(place["contentid"])
        if record.get("schema_version") != "place-web-page-extract-v2":
            raise ValueError(f"Unexpected web schema for {contentid}: {record.get('schema_version')!r}")
        if record.get("source_order") != source_order or clean(record.get("contentid")) != contentid:
            raise ValueError(f"Web cache order/id mismatch at source_order {source_order}")
        if clean(record.get("contenttypeid")) != clean(place.get("contenttypeid")):
            raise ValueError(f"Web cache content type mismatch for {contentid}")
        if clean(record.get("expected_title")) != clean(place.get("title")):
            raise ValueError(f"Web cache expected title mismatch for {contentid}")
        if not str(record.get("source_url") or "").startswith(("http://", "https://")):
            raise ValueError(f"Web cache source URL is invalid for {contentid}")
        if not isinstance(record.get("info"), dict) or not isinstance(record.get("homepage_urls"), list):
            raise ValueError(f"Web cache info/homepage fields are invalid for {contentid}")
        if record.get("retrieval_error") is None and not valid_sha256(record.get("page_sha256")):
            raise ValueError(f"Successful web cache row has no page hash for {contentid}")
        if record.get("retrieval_error") is not None and not clean(record.get("retrieval_error")):
            raise ValueError(f"Web cache retrieval_error is empty for {contentid}")
    return records


def web_success(record: dict[str, Any]) -> bool:
    status = record.get("http_status")
    return (
        isinstance(status, int)
        and 200 <= status < 300
        and valid_sha256(record.get("page_sha256"))
        and record.get("retrieval_error") is None
        and record.get("final_url") == record.get("source_url")
    )


def research_status(record: dict[str, Any]) -> str:
    if not web_success(record):
        return "not_found"
    identity_supported = any(
        record.get(field) is True
        for field in ("title_matches", "normalized_title_matches", "address_matches")
    )
    if identity_supported and clean(record.get("overview")):
        return "matched"
    return "uncertain"


def assign_archetype(place: dict[str, Any], web: dict[str, Any]) -> dict[str, Any]:
    contenttypeid = clean(place.get("contenttypeid"))
    lcls1 = clean(place.get("lclsSystm1"))
    lcls2 = clean(place.get("lclsSystm2"))
    title = clean(place.get("title"))
    flags: list[str] = []

    def result(companion: str, month: str, environment: str, reason: str, *extra_flags: str) -> dict[str, Any]:
        return {
            "companion_archetype": companion,
            "month_archetype": month,
            "environment": environment,
            "flags": list(dict.fromkeys([*flags, *extra_flags])),
            "assignment_rationale": reason,
            "assignment_rule_id": f"ASSIGN-{companion.upper().replace('_', '-')}",
        }

    lcls3 = clean(place.get("lclsSystm3"))
    title_text = title.lower()

    if contenttypeid == "32":
        structured_stay_text = (
            f"{title_text} {clean(web.get('overview')).lower()} "
            f"{canonical_json(web.get('info') or {}).lower()}"
        )
        stay_flags: list[str] = []
        if has_any(
            structured_stay_text,
            (
                "키즈",
                "어린이 놀이",
                "어린이 전용",
                "유아용",
                "유아수영장",
                "유아 수영장",
                "어린이 수영장",
                "어린이풀",
                "어린이 풀",
                "패밀리룸",
                "패밀리클럽",
                "키즈룸",
                "키즈풀",
            ),
        ):
            stay_flags.append("stay_family_facilities")
        if has_any(
            structured_stay_text,
            ("게스트하우스", "호스텔", "도미토리", "공용객실", "공용 객실", "친구들끼리"),
        ):
            stay_flags.append("stay_shared_social")
        if has_any(structured_stay_text, ("무장애", "배리어프리", "엘리베이터", "장애인 객실", "휠체어")):
            stay_flags.append("stay_accessibility_evidence")
        return result(
            "stay",
            "indoor_neutral",
            "indoor",
            "숙박 유형과 LCLS를 객실에 머무는 숙박 경험으로 분류했다.",
            *stay_flags,
        )
    if contenttypeid == "38":
        market = lcls2 == "SH06"
        return result(
            "shopping_visit",
            "mixed_neutral" if market else "indoor_neutral",
            "mixed" if market else "indoor",
            "쇼핑 LCLS를 관광 중 시장 또는 개별 매장 방문 경험으로 분류했다.",
            *("periodic_or_open_market",) if market else (),
        )
    if contenttypeid == "15":
        return result("festival_or_event", "festival_na", "mixed", "축제·행사 유형은 행사 참여 경험이며 개최일을 month 점수와 분리했다.", "date_gated")
    if contenttypeid == "14":
        if lcls3 in {"VE120100", "VE090300"} or has_any(title_text, ("책방", "도서관")):
            return result("quiet_indoor_reading_or_meditation", "indoor_neutral", "indoor", "문화시설 세부 LCLS 또는 제목의 책방·도서관 단서를 정적 실내 경험으로 분류했다.")
        compact_title = title_text.replace(" ", "")
        if has_any(compact_title, ("해변공연장", "야외공연장", "해녀물질공연장")):
            return result(
                "indoor_culture_or_performance",
                "outdoor_neutral",
                "outdoor",
                "문화시설 제목의 해변·야외·해녀물질 공연장 단서를 야외 관람 경험으로 분류했다.",
                "weather_exposure",
            )
        if "공원" in compact_title:
            return result(
                "indoor_culture_or_performance",
                "mixed_neutral",
                "mixed",
                "문화시설 제목의 공원 단서를 실내 시설과 야외 공간이 섞인 관람 경험으로 분류했다.",
            )
        return result("indoor_culture_or_performance", "indoor_neutral", "indoor", "문화시설 LCLS를 실내 관람·공연 경험으로 분류했다.")
    if contenttypeid == "28":
        if lcls3.startswith("LS011900"):
            return result("hiking_or_trail", "forest_hike", "outdoor", "레포츠 세부 LCLS LS011900을 걷기·트레일 경험으로 분류했다.", "mobility_review", "weather_exposure")
        if lcls3.startswith("LS010400"):
            return result("golf_or_team_play", "camping_outdoor_sport", "outdoor", "레포츠 세부 LCLS LS0104를 골프 경험으로 분류했다.", "weather_exposure")
        if lcls2 == "AC05":
            return result("camping", "camping_outdoor_sport", "outdoor", "레포츠 LCLS AC05를 캠핑·숙영 경험으로 분류했다.", "weather_exposure")
        if lcls2 == "LS02":
            indoor_water = "실내" in title_text
            return result(
                "water_sport_caution",
                "indoor_neutral" if indoor_water else "beach_water",
                "indoor" if indoor_water else "outdoor",
                (
                    "레포츠 LCLS LS02와 제목의 실내 단서를 안전 조건 확인이 필요한 실내 수상 활동으로 분류했다."
                    if indoor_water
                    else "레포츠 LCLS LS02를 안전 조건 확인이 필요한 야외 수상·해양 활동으로 분류했다."
                ),
                *(() if indoor_water else ("weather_exposure",)),
                "water_sport_caution",
            )
        if lcls3.startswith("VE100100"):
            return result("sports_spectator", "mixed_neutral", "mixed", "레포츠 세부 LCLS VE1001을 경기 관람 경험으로 분류했다.")
        return result("active_shared_ride_or_leisure", "camping_outdoor_sport", "outdoor", "레포츠 세부 LCLS를 참여형 야외 활동으로 분류했다.", "weather_exposure")

    if lcls1 == "HS":
        return result("history_or_religion", "mixed_neutral", "mixed", "역사 LCLS를 역사·종교 방문 경험으로 분류했다.")
    if lcls3 == "NA030100":
        return result("scenic_photo_or_light_stroll", "mixed_neutral", "mixed", "자연 세부 LCLS NA030100 동굴을 실내 동굴과 외부 접근이 섞인 경관 경험으로 분류했다.")
    if lcls3.startswith("NA010300"):
        return result("scenic_photo_or_light_stroll", "outdoor_neutral", "outdoor", "자연 세부 LCLS NA0103 폭포를 경관 감상 경험으로 분류했다.", "weather_exposure")
    if lcls2 == "NA01":
        return result("hiking_or_trail", "forest_hike", "outdoor", "자연 LCLS NA01을 걷기·등산 경험으로 분류했다.", "mobility_review", "weather_exposure")
    if lcls3 == "NA020900":
        return result("beach_or_water", "beach_water", "outdoor", "자연 세부 LCLS NA020900을 해수욕장 방문 경험으로 분류했다.", "weather_exposure")
    if lcls2 == "NA02":
        return result("scenic_photo_or_light_stroll", "coast_photo", "outdoor", "자연 LCLS NA02를 해안·포구·섬 경관 경험으로 분류했다.", "weather_exposure")
    if lcls2 in {"NA03", "NA05"}:
        return result("scenic_photo_or_light_stroll", "outdoor_neutral", "outdoor", "자연 LCLS를 경관 감상 경험으로 분류했다.", "weather_exposure")
    if lcls3.startswith("NA0407") or lcls2 == "VE03":
        return result("park_picnic_or_play", "outdoor_neutral", "outdoor", "자연·휴양 LCLS를 정원·수목원·공원 경험으로 분류했다.", "weather_exposure")
    if lcls2 == "EX05":
        return result("spa_or_wellness", "hot_spring", "mixed", "체험 LCLS EX05를 온천·휴식 경험으로 분류했다.")
    if lcls2 in {"EX01", "EX02", "EX03", "EX06"}:
        return result("hands_on_craft_or_education", "mixed_neutral", "mixed", "체험 LCLS를 참여형 공예·교육 경험으로 분류했다.")
    if lcls2 == "EX07":
        return result("transport_or_ferry", "mixed_neutral", "mixed", "체험 LCLS EX07을 이동수단·탑승 경험으로 분류했다.", "operation_gate")
    if lcls2 == "VE07":
        return result("indoor_culture_or_performance", "indoor_neutral", "indoor", "휴양 LCLS VE07을 실내 문화 관람 경험으로 분류했다.")
    if lcls1 == "NA":
        return result("scenic_photo_or_light_stroll", "outdoor_neutral", "outdoor", "자연 LCLS를 경관 감상·가벼운 산책 경험으로 분류했다.", "weather_exposure")
    if lcls1 == "VE":
        return result("park_picnic_or_play", "mixed_neutral", "mixed", "휴양 LCLS를 일반 관람·체류 경험으로 분류했다.")
    if has_any(title_text, ("책방", "도서관", "서점")):
        return result("quiet_indoor_reading_or_meditation", "indoor_neutral", "indoor", "제목의 책방·도서관·서점 단서를 정적 실내 경험으로 분류했다.")
    return result("unresolved_generic", "mixed_neutral", "mixed", "세부 LCLS와 제목 단서가 부족해 보수적 일반 경험으로 분류했다.", "low_confidence_fallback")


def typical_visit(place: dict[str, Any], assignment: dict[str, Any]) -> str:
    title = clean(place.get("title"))
    scope = EXPERIENCE_SCOPE[clean(place.get("contenttypeid"))]
    if scope == "stay":
        return f"{title}에 머물며 객실과 안내된 숙박 부대시설을 이용하는 경험"
    if scope == "shopping_visit":
        return f"{title}의 시장·매장·쇼핑시설을 둘러보고 안내된 품목을 구매하는 경험"
    if scope == "event_participation":
        return f"개최일과 운영 조건을 확인한 뒤 {title} 행사에 참여하는 경험"
    if scope == "course_traversal":
        return f"{title}의 구성 지점을 순서대로 이동하는 코스 경험"
    if clean(place.get("contenttypeid")) == "28":
        return f"{title}에서 안내된 레포츠 활동에 참여하는 경험"
    if clean(place.get("contenttypeid")) == "14":
        return f"{title}의 전시·공연·문화 공간을 관람하는 경험"
    return f"{title}의 대표 경관·시설·체험을 둘러보는 방문 경험"


def identity_notes(web: dict[str, Any], status: str) -> str:
    if status == "not_found":
        return f"상세 페이지를 확정하지 못했다: {clean(web.get('retrieval_error')) or 'HTTP 상세 조회 실패'}"
    matches: list[str] = []
    if web.get("title_matches") is True:
        matches.append("제목 정확 일치")
    elif web.get("normalized_title_matches") is True:
        matches.append("정규화 제목 일치")
    if web.get("address_matches") is True:
        matches.append("주소 일치")
    if status == "matched":
        return f"contentid 상세 URL과 {', '.join(matches)}로 같은 장소를 확인했다."
    return "상세 URL은 열렸으나 제목·주소·overview의 식별 근거가 충분하지 않아 uncertain으로 유지했다."


def build_source_claims(web: dict[str, Any], summary: str) -> list[str]:
    claims = [summary]
    info = web.get("info") or {}
    preferred = ("이용시간", "영업시간", "주차", "휴일", "객실타입", "품목", "장서는날", "코스총거리")
    for needle in preferred:
        value = first_info(info, needle)
        claim = f"{needle}: {value}" if value else ""
        if claim and claim not in claims:
            claims.append(claim)
        if len(claims) >= 4:
            break
    return claims


def build_nonpilot_research(
    place: dict[str, Any], source_order: int, web: dict[str, Any], assignment: dict[str, Any]
) -> dict[str, Any]:
    contentid = clean(place["contentid"])
    status = research_status(web)
    fallback = f"{clean(place['title'])}은(는) TourAPI에 등록된 {TYPE_LABEL[clean(place['contenttypeid'])]}이다."
    summary = short_summary(web.get("overview"), fallback)
    if not any("가" <= character <= "힣" for character in summary):
        summary = f"{fallback} 상세 페이지 설명: {summary}"
    info = copy.deepcopy(web.get("info") or {})
    time_varying = {
        key: values
        for key, values in info.items()
        if any(needle in clean(key).replace(" ", "") for needle in TIME_VARYING_INFO_KEYS)
    }
    unknowns = ["보행·계단·경사와 유모차·휠체어 동선", "아동·고령자 이용 마찰"]
    if not web.get("homepage_urls"):
        unknowns.append("공식 운영자 홈페이지")
    if status != "matched":
        unknowns.insert(0, "장소 상세 식별 또는 현재 운영 여부")
    source = {
        "source_id": f"web:{contentid}",
        "url": web.get("source_url"),
        "final_url": web.get("final_url"),
        "title": clean(web.get("page_title")),
        "publisher": web.get("publisher"),
        "source_type": web.get("source_type"),
        "checked_at": web.get("fetched_on"),
        "page_sha256": web.get("page_sha256"),
        "official_homepage_candidates": list(web.get("homepage_urls") or []),
        "claims": build_source_claims(web, summary) if web_success(web) else [],
        "retrieval_error": web.get("retrieval_error"),
    }
    record: dict[str, Any] = {
        "schema_version": "place-web-research-full-v1",
        "source_order": source_order,
        "contentid": contentid,
        "title": clean(place["title"]),
        "contenttypeid": clean(place["contenttypeid"]),
        "research_status": status,
        "identity_notes": identity_notes(web, status),
        "checked_at": web.get("fetched_on"),
        "summary": summary,
        "place_kind": PLACE_KIND[clean(place["contenttypeid"])],
        "experience_scope": EXPERIENCE_SCOPE[clean(place["contenttypeid"])],
        "typical_visit": typical_visit(place, assignment),
        "environment": assignment["environment"],
        "facts": {
            "environment": assignment["environment"],
            "page_info": info,
            "time_varying": time_varying,
            "official_homepage_candidates": list(web.get("homepage_urls") or []),
            "coordinate_anomaly": coordinate_anomaly(place),
        },
        "sources": [source],
        "unknowns": list(dict.fromkeys(unknowns)),
        "pilot_anchor": False,
        "web_cache_record_sha256": canonical_sha256(web),
    }
    record["record_sha256"] = canonical_sha256(record)
    return record


def build_pilot_research(
    place: dict[str, Any], source_order: int, pilot_record: dict[str, Any], web: dict[str, Any]
) -> dict[str, Any]:
    original = copy.deepcopy(pilot_record)
    record = copy.deepcopy(original)
    facts = record.get("facts") if isinstance(record.get("facts"), dict) else {}
    primary_urls = {clean(web.get("source_url")), clean(web.get("final_url"))} - {""}
    for source in record.get("sources") or []:
        if isinstance(source, dict) and clean(source.get("url")) in primary_urls:
            source.setdefault("source_id", f"web:{clean(place['contentid'])}")
            source["page_sha256"] = web.get("page_sha256")
    record.update(
        {
            "schema_version": "place-web-research-full-v1",
            "source_order": source_order,
            "contenttypeid": clean(place["contenttypeid"]),
            "place_kind": PLACE_KIND[clean(place["contenttypeid"])],
            "experience_scope": EXPERIENCE_SCOPE[clean(place["contenttypeid"])],
            "typical_visit": clean(facts.get("typical_visit")) or f"{clean(place['title'])}의 대표 방문 경험",
            "environment": clean(facts.get("environment")) or "unknown",
            "pilot_anchor": True,
            "pilot_research_sha256": canonical_sha256(original),
        }
    )
    record["record_sha256"] = canonical_sha256(record)
    return record


def companion_profiles(path: Path) -> dict[str, dict[str, float]]:
    payload = load_json(path)
    profiles = copy.deepcopy(payload.get("profiles"))
    if not isinstance(profiles, dict):
        raise ValueError("Companion profile input has no profiles object")
    profiles["stay"] = {"solo": 0.75, "couple": 0.75, "friends": 0.5, "kids": 0.5, "parents": 0.5}
    profiles["shopping_visit"] = {"solo": 0.75, "couple": 0.75, "friends": 0.5, "kids": 0.5, "parents": 0.5}
    profiles["water_sport_caution"] = {
        "solo": 0.5,
        "couple": 0.5,
        "friends": 0.75,
        "kids": 0.25,
        "parents": 0.25,
    }
    for name, profile in profiles.items():
        if set(profile) != set(COMPANION_KEYS) or any(float(value) not in LABEL_VALUES for value in profile.values()):
            raise ValueError(f"Invalid companion profile {name}")
    return profiles


def month_profiles(path: Path) -> dict[str, dict[str, float | None]]:
    payload = load_json(path)
    profiles = payload.get("profiles")
    if not isinstance(profiles, dict):
        raise ValueError("Month profile input has no profiles object")
    for name, profile in profiles.items():
        if set(profile) != set(MONTH_KEYS):
            raise ValueError(f"Invalid month profile keys for {name}")
        for value in profile.values():
            if value is not None and float(value) not in LABEL_VALUES:
                raise ValueError(f"Invalid month profile value for {name}")
    return profiles


def source_evidence(contentid: str, web: dict[str, Any], rule_id: str) -> list[str]:
    evidence: list[str] = []
    if valid_sha256(web.get("page_sha256")) and clean(web.get("overview")):
        evidence.append(f"web:{contentid}")
    evidence.append(f"rule:{rule_id}")
    return evidence


def build_axis(
    *, value: float | None, confidence: float | None, inference_level: str, rationale: str,
    evidence_ids: list[str], rule_ids: list[str], null_reason: str | None = None
) -> dict[str, Any]:
    axis: dict[str, Any] = {
        "state": "not_applicable" if value is None else "numeric",
        "value": value,
        "confidence": confidence,
        "inference_level": inference_level,
        "rationale": rationale,
        "evidence_ids": evidence_ids,
        "rule_ids": rule_ids,
    }
    if null_reason is not None:
        axis["null_reason"] = null_reason
    return axis


def constraint_source(web: dict[str, Any]) -> str:
    return clean(web.get("final_url")) or clean(web.get("source_url")) or "rule:unavailable-web-source"


def derive_constraints(place: dict[str, Any], web: dict[str, Any]) -> list[dict[str, Any]]:
    contenttypeid = clean(place["contenttypeid"])
    info = web.get("info") or {}
    checked_at = clean(web.get("fetched_on")) or SNAPSHOT
    source = constraint_source(web)
    constraints: list[dict[str, Any]] = []

    def add(kind: str, applies_to: str, condition: str, status: str, rule_id: str) -> None:
        condition = clean(condition)
        if not condition:
            return
        if not any("가" <= character <= "힣" for character in condition):
            condition = f"상세 페이지 확인값: {condition}"
        candidate = {
            "kind": kind,
            "applies_to": applies_to,
            "condition": condition,
            "status": status,
            "action": "verify",
            "source": source,
            "checked_at": checked_at,
            "rule_id": rule_id,
        }
        marker = canonical_sha256(candidate)
        if all(canonical_sha256(existing) != marker for existing in constraints):
            constraints.append(candidate)

    reservation = short_summary(first_info(info, "예약"), "", 150)
    if not reservation:
        reservation = excerpt_with_any(web.get("overview"), ("예약",), 150)
    add("reservation", "예약이 필요한 방문·체험", reservation, "confirmed", "GATE-RESERVATION")
    age = first_info(info, "연령", "신장")
    compact_age = clean(age).replace(" ", "")
    if has_any(compact_age, ("전연령", "연령제한없음", "제한없음", "누구나")):
        age = ""
    add("eligibility", "연령·신장 조건이 있는 활동", age, "confirmed", "GATE-ELIGIBILITY")
    capacity = first_info(info, "수용인원", "기준인원", "최대인원")
    if contenttypeid == "32":
        add("capacity", "객실 선택과 숙박 인원", capacity, "confirmed", "GATE-STAY-CAPACITY")
    schedule = first_info(info, "영업시간", "이용시간", "휴일", "휴무", "장서는날")
    add("operating_schedule", "실제 방문 가능 시각·운영일", schedule, "confirmed", "GATE-OPERATING-SCHEDULE")
    if contenttypeid == "15":
        event_start = first_info(info, "행사시작일")
        event_end = first_info(info, "행사종료일")
        event_dates = " / ".join(
            part
            for part in (
                f"행사시작일: {event_start}" if event_start else "",
                f"행사종료일: {event_end}" if event_end else "",
            )
            if part
        )
        end_match = re.search(r"\d{4}-\d{2}-\d{2}", event_end)
        if not event_start or not event_end or not end_match:
            event_status = "unknown"
        else:
            event_status = "stale" if end_match.group(0) < checked_at else "confirmed"
        add(
            "event_date_gate",
            "축제·행사 참여 가능 날짜",
            event_dates or "최신 개최일을 확인한 뒤에만 행사 참여 가능 여부를 판단한다.",
            event_status if event_dates else "unknown",
            "GATE-FESTIVAL-DATE",
        )
    weather_needles = (
        "기상악화",
        "기상 악화",
        "기상상황",
        "기상 상황",
        "기상특보",
        "기상 특보",
        "풍랑",
        "바람·파도",
        "바람과 파도",
        "바람 및 파도",
        "날씨와 바람",
        "바람, 파도",
        "우천 시",
        "우천시",
        "입산 통제",
        "입산통제",
        "전면 통제",
        "전면통제",
        "운항 중단",
        "운항중단",
        "날씨에 따라",
        "날씨에 따른",
    )
    weather_exclusions = (
        "기상 관계없이",
        "기상과 관계없이",
        "기상에 관계없이",
        "기상 상황에 관계없이",
        "날씨에 구애받지",
        "날씨와 관계없이",
        "날씨에 관계없이",
        "날씨와 상관없이",
    )
    weather = ""
    weather_candidates: list[Any] = []
    for raw_values in info.values():
        weather_candidates.extend(raw_values if isinstance(raw_values, list) else [raw_values])
    weather_candidates.append(web.get("overview"))
    for candidate in weather_candidates:
        weather = excerpt_with_any_excluding(candidate, weather_needles, weather_exclusions)
        if weather:
            break
    add("weather_control", "운항·입장·야외 활동 가능 여부", weather, "confirmed", "GATE-WEATHER-CONTROL")
    access = first_labeled_info(
        info,
        "장애인 편의시설",
        "휠체어 접근",
        "무장애 동선",
        "접근성",
        "경사도",
        "보행 난이도",
    )
    if not access:
        access = excerpt_with_any(
            web.get("overview"),
            ("휠체어 접근", "휠체어 이용", "유모차 접근", "유모차 이용", "무장애 동선"),
            180,
        )
    add("access_mobility", "명시된 접근·이동 조건", access, "confirmed", "GATE-ACCESS-MOBILITY")
    if coordinate_anomaly(place):
        add(
            "location_verification",
            "지도 표시·동선 계산과 장소 접근",
            f"원본 좌표 mapx={clean(place.get('mapx'))}, mapy={clean(place.get('mapy'))}가 제주 표시 범위를 벗어나 좌표 기반 판단에서 제외한다.",
            "unknown",
            "QUALITY-COORDINATE-ANOMALY",
        )
    return constraints


def proposal_hash(record: dict[str, Any]) -> str:
    without_hash = {key: value for key, value in record.items() if key != "proposal_sha256"}
    return canonical_sha256(without_hash)


def build_nonpilot_proposal(
    place: dict[str, Any], source_order: int, web: dict[str, Any], research: dict[str, Any],
    assignment: dict[str, Any], companions: dict[str, dict[str, float]], months: dict[str, dict[str, float | None]],
) -> dict[str, Any]:
    contentid = clean(place["contentid"])
    status = research["research_status"]
    confidence = 0.5 if status == "matched" else 0.25
    inference_level = "researched_inference" if status == "matched" else "archetype_prior"
    companion_archetype = assignment["companion_archetype"]
    month_archetype = assignment["month_archetype"]
    assignment_flags = set(assignment.get("flags") or [])
    companion_rule = f"COMP-ARCHETYPE-{companion_archetype.upper().replace('_', '-')}"
    month_rule = f"MONTH-ARCHETYPE-{month_archetype.upper().replace('_', '-')}"
    companion_values = dict(companions[companion_archetype])
    companion_adjustments: dict[str, str] = {}
    if companion_archetype == "stay":
        if "stay_shared_social" in assignment_flags:
            companion_values["friends"] = 0.75
            companion_adjustments["friends"] = "게스트하우스·도미토리·공용 객실 또는 친구 단체 단서"
        if "stay_family_facilities" in assignment_flags:
            companion_values["kids"] = 0.75
            companion_adjustments["kids"] = "키즈·유아·패밀리 시설 단서"
        if "stay_accessibility_evidence" in assignment_flags:
            companion_values["parents"] = 0.75
            companion_adjustments["parents"] = "무장애·엘리베이터·휠체어 단서"
    water_kids_override = WATER_KIDS_FACT_OVERRIDES.get(contentid)
    if companion_archetype == "water_sport_caution" and water_kids_override is not None:
        companion_values["kids"] = water_kids_override[0]
        companion_adjustments["kids"] = water_kids_override[1]
    direct_companion_overrides = copy.deepcopy(
        COMPANION_DIRECT_FACT_OVERRIDES.get(contentid, {}) if status == "matched" else {}
    )
    overview = clean(web.get("overview"))
    for key, (value, reason, evidence_fragment) in direct_companion_overrides.items():
        if clean(evidence_fragment) not in overview:
            raise ValueError(f"Direct companion evidence fragment is missing for {contentid}/{key}")
        companion_values[key] = value
        companion_adjustments[key] = reason
    companion_fit: dict[str, dict[str, Any]] = {}
    for key in COMPANION_KEYS:
        value = float(companion_values[key])
        if companion_archetype == "shopping_visit":
            experience_detail = "시장 탐색" if "periodic_or_open_market" in assignment_flags else "개별 매장 쇼핑"
        elif companion_archetype == "stay":
            experience_detail = "숙박 경험"
        else:
            experience_detail = EXPERIENCE_SCOPE[clean(place["contenttypeid"])]
        adjustment = companion_adjustments.get(key)
        direct_adjustment = direct_companion_overrides.get(key)
        axis_rule_ids = [companion_rule, assignment["assignment_rule_id"]]
        if key == "kids" and water_kids_override is not None:
            axis_rule_ids.append("COMP-WATER-KIDS-DIRECT-FACT-OVERRIDE")
        if direct_adjustment is not None:
            axis_rule_ids.append(DIRECT_COMPANION_RULE)
        companion_fit[key] = build_axis(
            value=value,
            confidence=0.75 if direct_adjustment is not None else confidence,
            inference_level="direct_evidence" if direct_adjustment is not None else inference_level,
            rationale=(
                (
                    f"웹 상세 페이지에서 {direct_adjustment[1]}을 직접 확인해 "
                    f"{key} 적합도를 {value:g}로 제안했다. "
                    "가격·재고·운영 여부와 필수 조건은 점수와 분리한다."
                )
                if direct_adjustment is not None
                else (
                    f"{clean(place['title'])}의 {experience_detail} 범위에 "
                    f"{companion_archetype} 규칙을 적용한 {key} AI 사전값이다. "
                    f"{adjustment + '를 반영했다. ' if adjustment else ''}"
                    "가격·재고·운영 여부와 필수 조건은 점수와 분리하며 웹의 직접 동행 추천으로 표현하지 않는다."
                )
            ),
            evidence_ids=source_evidence(
                contentid,
                web,
                DIRECT_COMPANION_RULE if direct_adjustment is not None else companion_rule,
            ),
            rule_ids=axis_rule_ids,
        )
    month_fit: dict[str, dict[str, Any]] = {}
    contenttypeid = clean(place["contenttypeid"])
    for key in MONTH_KEYS:
        raw_value = months[month_archetype][key]
        if contenttypeid == "15":
            month_fit[key] = build_axis(
                value=None,
                confidence=None,
                inference_level="not_applicable",
                null_reason="date_gated_not_applicable",
                rationale=f"{key}월 점수는 개최일 확인이 우선인 축제 참여 경험에 적용하지 않는다.",
                evidence_ids=source_evidence(contentid=contentid, web=web, rule_id="MONTH-FESTIVAL-DATE-GATED-NA"),
                rule_ids=["MONTH-FESTIVAL-DATE-GATED-NA"],
            )
        else:
            value = float(raw_value) if raw_value is not None else None
            if value is None:
                raise ValueError(f"Non-festival month profile is null for {contentid}/{key}")
            month_fit[key] = build_axis(
                value=value,
                confidence=confidence,
                inference_level="climate_heuristic",
                rationale=(
                    f"{key}월은 {month_archetype} 프로필과 고정된 1991~2020 제주 기후평년 규칙을 적용한 AI 사전값이다. "
                    "실시간 예보·영업·재고·행사일은 반영하지 않았다."
                ),
                evidence_ids=[
                    "climate:kma-jeju-1991-2020",
                    f"rule:{month_rule}",
                    *([f"web:{contentid}"] if status == "matched" else []),
                ],
                rule_ids=[month_rule],
            )
    hard_constraints = derive_constraints(place, web)
    flags = list(assignment["flags"])
    if water_kids_override is not None and "water_kids_direct_fact" not in flags:
        flags.append("water_kids_direct_fact")
    if coordinate_anomaly(place) and "coordinate_anomaly" not in flags:
        flags.append("coordinate_anomaly")
    review_reasons: list[str] = []
    if status != "matched":
        review_reasons.append(f"웹 조사 상태 {status}: 유형 기반 confidence 0.25 fallback")
    if coordinate_anomaly(place):
        review_reasons.append("좌표 품질 이상")
    if clean(place["contenttypeid"]) == "15":
        review_reasons.append("최신 개최일 확인 필요")
    gating_constraints = [
        constraint
        for constraint in hard_constraints
        if constraint.get("kind") not in {"operating_schedule", "capacity"}
    ]
    if gating_constraints:
        review_reasons.append("예약·자격·개최일·통제·접근 hard constraint 확인 필요")
    if "weather_exposure" in assignment_flags:
        review_reasons.append("야외형 month prior의 기상 민감도 표본 검수 필요")
    if "mobility_review" in assignment_flags:
        review_reasons.append("걷기·트레일 이동 부담 표본 검수 필요")
    if "water_sport_caution" in assignment_flags:
        if water_kids_override is not None:
            review_reasons.append("수상 레포츠 kids 직접 fact 보정과 parents 보수 prior 확인 필요")
        else:
            review_reasons.append("수상 레포츠 kids·parents 보수 prior와 안전 조건 확인 필요")
    if "stay_family_facilities" in assignment_flags:
        review_reasons.append("숙박 키즈·패밀리 시설 근거에 따른 kids 보정 확인 필요")
    if "stay_shared_social" in assignment_flags:
        review_reasons.append("공용 숙박·친구 단체 경험의 friends 보정 확인 필요")
    if "stay_accessibility_evidence" in assignment_flags:
        review_reasons.append("숙박 접근성 단서에 따른 parents 보정 확인 필요")
    if direct_companion_overrides:
        review_reasons.append("웹의 명시적 동행 적합 단서와 점수 변환 표본 검수 필요")
    values = companion_values
    if any(
        values[key] != 0.5 and key not in direct_companion_overrides
        for key in ("kids", "parents")
    ):
        review_reasons.append("직접 근거가 아닌 kids·parents 비중립 prior 확인 필요")
    if not review_reasons:
        review_reasons.append("웹 조사와 유형 규칙으로 생성한 AI 초안 표본 검수 필요")
    if status != "matched" or coordinate_anomaly(place) or clean(place["contenttypeid"]) == "15":
        priority = "high"
    elif (
        gating_constraints
        or values["kids"] != 0.5
        or values["parents"] != 0.5
        or bool(assignment_flags & {"weather_exposure", "mobility_review", "water_sport_caution"})
    ):
        priority = "medium"
    else:
        priority = "low"
    proposal: dict[str, Any] = {
        "schema_version": "place-profile-auto-proposal-full-v1",
        "source_order": source_order,
        "contentid": contentid,
        "title": clean(place["title"]),
        "contenttypeid": clean(place["contenttypeid"]),
        "experience_scope": EXPERIENCE_SCOPE[clean(place["contenttypeid"])],
        "research_status": status,
        "algorithm_version": ALGORITHM_VERSION,
        "pilot_anchor": False,
        "pilot_proposal_sha256": None,
        "companion_archetype": companion_archetype,
        "month_archetype": month_archetype,
        "flags": flags,
        "assignment_rationale": assignment["assignment_rationale"],
        "companion_fit": companion_fit,
        "month_fit": month_fit,
        "hard_constraints": hard_constraints,
        "review_priority": priority,
        "review_reasons": list(dict.fromkeys(review_reasons)),
    }
    proposal["proposal_sha256"] = proposal_hash(proposal)
    return proposal


def build_pilot_proposal(
    place: dict[str, Any], source_order: int, original_proposal: dict[str, Any], research: dict[str, Any]
) -> dict[str, Any]:
    original = copy.deepcopy(original_proposal)
    proposal = copy.deepcopy(original)
    proposal.update(
        {
            "schema_version": "place-profile-auto-proposal-full-v1",
            "source_order": source_order,
            "contenttypeid": clean(place["contenttypeid"]),
            "experience_scope": EXPERIENCE_SCOPE[clean(place["contenttypeid"])],
            "research_status": research["research_status"],
            "pilot_anchor": True,
            "pilot_proposal_sha256": canonical_sha256(original),
        }
    )
    if clean(place["contentid"]) == "2704351" and proposal.get("review_priority") != "high":
        raise ValueError("Pilot coordinate anomaly 2704351 must remain high priority")
    proposal["proposal_sha256"] = proposal_hash(proposal)
    return proposal


def validate_axis(axis: dict[str, Any], *, festival: bool, context: str) -> None:
    required = {"value", "confidence", "inference_level", "rationale", "evidence_ids", "rule_ids"}
    if not isinstance(axis, dict) or required - axis.keys():
        raise ValueError(f"Incomplete axis at {context}")
    if not clean(axis.get("rationale")) or not axis.get("rule_ids"):
        raise ValueError(f"Missing rationale/rule provenance at {context}")
    if festival:
        if not (
            axis.get("value") is None
            and axis.get("confidence") is None
            and axis.get("inference_level") == "not_applicable"
            and axis.get("null_reason") == "date_gated_not_applicable"
        ):
            raise ValueError(f"Invalid festival N/A axis at {context}")
        return
    value = float(axis.get("value"))
    confidence = float(axis.get("confidence"))
    if value not in LABEL_VALUES or confidence not in LABEL_VALUES:
        raise ValueError(f"Invalid numeric axis at {context}")
    if axis.get("inference_level") != "direct_evidence" and value in {0.0, 1.0}:
        raise ValueError(f"Non-direct extreme value at {context}")


def validate_proposals(proposals: list[dict[str, Any]], places: list[dict[str, Any]]) -> None:
    if len(proposals) != 1_434:
        raise ValueError("Proposal count is not 1,434")
    for source_order, (proposal, place) in enumerate(zip(proposals, places, strict=True)):
        contentid = clean(place["contentid"])
        if proposal.get("source_order") != source_order or clean(proposal.get("contentid")) != contentid:
            raise ValueError(f"Proposal order/id mismatch for {contentid}")
        if proposal_hash(proposal) != proposal.get("proposal_sha256"):
            raise ValueError(f"Proposal hash mismatch for {contentid}")
        for key in COMPANION_KEYS:
            validate_axis(proposal["companion_fit"][key], festival=False, context=f"{contentid}.companion.{key}")
        festival = clean(place["contenttypeid"]) == "15"
        for key in MONTH_KEYS:
            validate_axis(proposal["month_fit"][key], festival=festival, context=f"{contentid}.month.{key}")


def flatten_constraints(
    proposals: list[dict[str, Any]], places: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for proposal, place in zip(proposals, places, strict=True):
        for index, constraint in enumerate(proposal.get("hard_constraints") or []):
            original = copy.deepcopy(constraint)
            base_hash = canonical_sha256(original)
            record = copy.deepcopy(original)
            source = clean(record.get("source_url")) or clean(record.get("source"))
            record.update(
                {
                    "schema_version": "place-hard-constraint-full-v1",
                    "source_order": proposal["source_order"],
                    "contentid": proposal["contentid"],
                    "title": proposal["title"],
                    "contenttypeid": clean(place["contenttypeid"]),
                    "experience_scope": proposal["experience_scope"],
                    "research_status": proposal["research_status"],
                    "review_priority": proposal["review_priority"],
                    "pilot_anchor": proposal["pilot_anchor"],
                    "constraint_index": index,
                    "constraint_id": f"constraint:{proposal['contentid']}:{index}:{base_hash[:16]}",
                    "source_url": source,
                    "pilot_constraint_sha256": base_hash if proposal["pilot_anchor"] else None,
                }
            )
            record["record_sha256"] = canonical_sha256(record)
            records.append(record)
    return records


def build_review_queue(proposals: list[dict[str, Any]], places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for proposal, place in zip(proposals, places, strict=True):
        record = {
            "schema_version": "place-review-queue-full-v1",
            "source_order": proposal["source_order"],
            "contentid": proposal["contentid"],
            "title": proposal["title"],
            "contenttypeid": clean(place["contenttypeid"]),
            "experience_scope": proposal["experience_scope"],
            "research_status": proposal["research_status"],
            "review_priority": proposal["review_priority"],
            "review_reasons": proposal.get("review_reasons") or [],
            "flags": proposal.get("flags") or [],
            "pilot_anchor": proposal["pilot_anchor"],
            "proposal_sha256": proposal["proposal_sha256"],
            "hard_constraint_count": len(proposal.get("hard_constraints") or []),
            "coordinate_anomaly": coordinate_anomaly(place),
        }
        record["record_sha256"] = canonical_sha256(record)
        records.append(record)
    return records


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;
CREATE TABLE dataset_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE places (
  contentid TEXT PRIMARY KEY,
  source_order INTEGER NOT NULL UNIQUE CHECK(source_order >= 0),
  contenttypeid TEXT NOT NULL CHECK(contenttypeid IN ('12','14','15','25','28','32','38')),
  title TEXT NOT NULL CHECK(length(title) > 0),
  address TEXT NOT NULL,
  longitude REAL,
  latitude REAL,
  lcls1 TEXT NOT NULL,
  lcls2 TEXT NOT NULL,
  lcls3 TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64)
);
CREATE TABLE web_sources (
  source_id TEXT PRIMARY KEY,
  contentid TEXT NOT NULL CHECK(length(contentid) > 0) REFERENCES places(contentid),
  url TEXT NOT NULL CHECK(url GLOB 'http://*' OR url GLOB 'https://*'),
  final_url TEXT,
  publisher TEXT NOT NULL CHECK(length(publisher) > 0),
  source_type TEXT NOT NULL CHECK(source_type IN ('official_tourism','public_agency','official_operator','heritage','reputable_secondary')),
  fetched_on TEXT,
  http_status INTEGER CHECK(http_status IS NULL OR http_status BETWEEN 100 AND 599),
  page_title TEXT NOT NULL,
  page_address TEXT NOT NULL,
  page_sha256 TEXT,
  homepage_candidates_json TEXT NOT NULL,
  retrieval_error TEXT
);
CREATE TABLE research (
  contentid TEXT PRIMARY KEY REFERENCES places(contentid),
  research_status TEXT NOT NULL CHECK(research_status IN ('matched','uncertain','not_found')),
  identity_notes TEXT NOT NULL,
  summary TEXT NOT NULL CHECK(length(summary) > 0),
  place_kind TEXT NOT NULL,
  experience_scope TEXT NOT NULL,
  typical_visit TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('indoor','outdoor','mixed','unknown')),
  facts_json TEXT NOT NULL,
  unknowns_json TEXT NOT NULL,
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64)
);
CREATE TABLE label_runs (
  label_run_id TEXT PRIMARY KEY,
  algorithm_version TEXT NOT NULL,
  input_digest TEXT NOT NULL CHECK(length(input_digest) = 64),
  climate_hash TEXT NOT NULL CHECK(length(climate_hash) = 64),
  status TEXT NOT NULL CHECK(status IN ('ai_draft'))
);
CREATE TABLE label_proposals (
  label_run_id TEXT NOT NULL REFERENCES label_runs(label_run_id),
  contentid TEXT NOT NULL REFERENCES places(contentid),
  source_order INTEGER NOT NULL,
  experience_scope TEXT NOT NULL,
  research_status TEXT NOT NULL CHECK(research_status IN ('matched','uncertain','not_found')),
  pilot_anchor INTEGER NOT NULL CHECK(pilot_anchor IN (0,1)),
  review_priority TEXT NOT NULL CHECK(review_priority IN ('low','medium','high')),
  review_reasons_json TEXT NOT NULL,
  proposal_sha256 TEXT NOT NULL CHECK(length(proposal_sha256) = 64),
  PRIMARY KEY(label_run_id, contentid),
  UNIQUE(label_run_id, source_order)
);
CREATE TABLE label_axes (
  label_run_id TEXT NOT NULL,
  contentid TEXT NOT NULL,
  source_order INTEGER NOT NULL,
  experience_scope TEXT NOT NULL,
  axis_group TEXT NOT NULL CHECK(axis_group IN ('companion','month')),
  axis_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('numeric','not_applicable')),
  value REAL,
  confidence REAL,
  inference_level TEXT NOT NULL CHECK(inference_level IN ('pilot_reviewed_anchor','direct_evidence','researched_inference','archetype_prior','climate_heuristic','not_applicable')),
  rationale TEXT NOT NULL CHECK(length(rationale) > 0),
  null_reason TEXT,
  evidence_ids_json TEXT NOT NULL,
  rule_ids_json TEXT NOT NULL,
  PRIMARY KEY(label_run_id, contentid, axis_group, axis_key),
  FOREIGN KEY(label_run_id, contentid) REFERENCES label_proposals(label_run_id, contentid),
  CHECK((state = 'numeric' AND value IN (0,0.25,0.5,0.75,1) AND confidence IN (0,0.25,0.5,0.75,1) AND null_reason IS NULL)
     OR (state = 'not_applicable' AND value IS NULL AND confidence IS NULL AND null_reason = 'date_gated_not_applicable'))
);
CREATE TABLE hard_constraints (
  constraint_id TEXT PRIMARY KEY,
  label_run_id TEXT NOT NULL,
  contentid TEXT NOT NULL,
  source_order INTEGER NOT NULL,
  experience_scope TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(length(kind) > 0),
  applies_to TEXT NOT NULL CHECK(length(applies_to) > 0),
  condition TEXT NOT NULL CHECK(length(condition) > 0),
  status TEXT NOT NULL CHECK(status IN ('confirmed','unknown','stale')),
  action TEXT NOT NULL CHECK(action IN ('exclude','verify')),
  source_url TEXT NOT NULL CHECK(length(source_url) > 0),
  checked_at TEXT NOT NULL CHECK(length(checked_at) >= 10),
  rule_id TEXT NOT NULL CHECK(length(rule_id) > 0),
  record_sha256 TEXT NOT NULL CHECK(length(record_sha256) = 64),
  FOREIGN KEY(label_run_id, contentid) REFERENCES label_proposals(label_run_id, contentid)
);
"""


def logical_database_digest(connection: sqlite3.Connection) -> str:
    order_by = {
        "places": "contentid",
        "web_sources": "source_id",
        "research": "contentid",
        "label_runs": "label_run_id",
        "label_proposals": "label_run_id, contentid",
        "label_axes": "label_run_id, contentid, axis_group, axis_key",
        "hard_constraints": "constraint_id",
    }
    dump: dict[str, Any] = {"tables": []}
    for table, ordering in order_by.items():
        cursor = connection.execute(f"SELECT * FROM {table} ORDER BY {ordering}")
        columns = [description[0] for description in cursor.description]
        rows = [list(row) for row in cursor.fetchall()]
        dump["tables"].append({"name": table, "columns": columns, "rows": rows})
    return canonical_sha256(dump)


def build_database(
    path: Path,
    places: list[dict[str, Any]],
    web_records: list[dict[str, Any]],
    research_records: list[dict[str, Any]],
    proposals: list[dict[str, Any]],
    constraints: list[dict[str, Any]],
    input_digest: str,
    climate_hash: str,
    dataset_meta: dict[str, Any],
) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    if temp.exists():
        temp.unlink()
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(temp)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(SCHEMA_SQL)
        for key, value in sorted(dataset_meta.items()):
            connection.execute("INSERT INTO dataset_meta(key, value) VALUES (?, ?)", (key, canonical_json(value)))
        connection.execute(
            "INSERT INTO label_runs VALUES (?, ?, ?, ?, ?)",
            (LABEL_RUN_ID, ALGORITHM_VERSION, input_digest, climate_hash, "ai_draft"),
        )
        for source_order, (place, web, research, proposal) in enumerate(
            zip(places, web_records, research_records, proposals, strict=True)
        ):
            contentid = clean(place["contentid"])
            raw_json = canonical_json(place)
            connection.execute(
                """INSERT INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    contentid,
                    source_order,
                    clean(place["contenttypeid"]),
                    clean(place["title"]),
                    clean(" ".join(filter(None, (clean(place.get("addr1")), clean(place.get("addr2")))))),
                    float_or_none(place.get("mapx")),
                    float_or_none(place.get("mapy")),
                    clean(place.get("lclsSystm1")),
                    clean(place.get("lclsSystm2")),
                    clean(place.get("lclsSystm3")),
                    raw_json,
                    hashlib.sha256(raw_json.encode("utf-8")).hexdigest(),
                ),
            )
            connection.execute(
                """INSERT INTO web_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"web:{contentid}",
                    contentid,
                    web["source_url"],
                    web.get("final_url"),
                    clean(web.get("publisher")),
                    clean(web.get("source_type")),
                    web.get("fetched_on"),
                    web.get("http_status"),
                    clean(web.get("page_title")),
                    clean(web.get("page_address")),
                    web.get("page_sha256"),
                    canonical_json(web.get("homepage_urls") or []),
                    web.get("retrieval_error"),
                ),
            )
            connection.execute(
                """INSERT INTO research VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    contentid,
                    research["research_status"],
                    research["identity_notes"],
                    research["summary"],
                    research["place_kind"],
                    research["experience_scope"],
                    research["typical_visit"],
                    research["environment"],
                    canonical_json(research.get("facts") or {}),
                    canonical_json(research.get("unknowns") or []),
                    research["record_sha256"],
                ),
            )
            connection.execute(
                """INSERT INTO label_proposals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    LABEL_RUN_ID,
                    contentid,
                    source_order,
                    proposal["experience_scope"],
                    proposal["research_status"],
                    1 if proposal["pilot_anchor"] else 0,
                    proposal["review_priority"],
                    canonical_json(proposal.get("review_reasons") or []),
                    proposal["proposal_sha256"],
                ),
            )
            for axis_group, keys in (("companion", COMPANION_KEYS), ("month", MONTH_KEYS)):
                source = proposal[f"{axis_group}_fit"]
                for axis_key in keys:
                    axis = source[axis_key]
                    state = "not_applicable" if axis.get("value") is None else "numeric"
                    connection.execute(
                        """INSERT INTO label_axes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            LABEL_RUN_ID,
                            contentid,
                            source_order,
                            proposal["experience_scope"],
                            axis_group,
                            axis_key,
                            state,
                            axis.get("value"),
                            axis.get("confidence"),
                            axis["inference_level"],
                            axis["rationale"],
                            axis.get("null_reason"),
                            canonical_json(axis.get("evidence_ids") or []),
                            canonical_json(axis.get("rule_ids") or []),
                        ),
                    )
        for constraint in constraints:
            connection.execute(
                """INSERT INTO hard_constraints VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    constraint["constraint_id"],
                    LABEL_RUN_ID,
                    constraint["contentid"],
                    constraint["source_order"],
                    constraint["experience_scope"],
                    constraint["kind"],
                    constraint["applies_to"],
                    constraint["condition"],
                    constraint["status"],
                    constraint["action"],
                    constraint["source_url"],
                    constraint["checked_at"],
                    constraint["rule_id"],
                    constraint["record_sha256"],
                ),
            )
        connection.commit()
        foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
        integrity = connection.execute("PRAGMA integrity_check").fetchone()
        if foreign_key_errors:
            raise ValueError(f"SQLite foreign key check failed: {foreign_key_errors[:3]}")
        if not integrity or integrity[0] != "ok":
            raise ValueError(f"SQLite integrity check failed: {integrity}")
        logical_digest = logical_database_digest(connection)
        connection.close()
        connection = None
        os.replace(temp, path)
        return logical_digest
    except BaseException:
        if connection is not None:
            connection.close()
        if temp.exists():
            temp.unlink()
        raise


def stats_for(
    places: list[dict[str, Any]], research: list[dict[str, Any]], proposals: list[dict[str, Any]], constraints: list[dict[str, Any]]
) -> dict[str, Any]:
    inference = Counter()
    companion_numeric = 0
    month_numeric = 0
    festival_na = 0
    for proposal, place in zip(proposals, places, strict=True):
        for axis in proposal["companion_fit"].values():
            companion_numeric += axis["value"] is not None
            inference[axis["inference_level"]] += 1
        for axis in proposal["month_fit"].values():
            if clean(place["contenttypeid"]) == "15":
                festival_na += axis["value"] is None
            else:
                month_numeric += axis["value"] is not None
            inference[axis["inference_level"]] += 1
    return {
        "total": len(places),
        "pilot_anchors": sum(bool(proposal["pilot_anchor"]) for proposal in proposals),
        "by_content_type": dict(sorted(Counter(clean(place["contenttypeid"]) for place in places).items())),
        "research_status": dict(sorted(Counter(item["research_status"] for item in research).items())),
        "review_priority": dict(sorted(Counter(item["review_priority"] for item in proposals).items())),
        "inference_level": dict(sorted(inference.items())),
        "companion_numeric": companion_numeric,
        "nonfestival_month_numeric": month_numeric,
        "festival_month_na": festival_na,
        "hard_constraints": len(constraints),
        "coordinate_anomalies": sum(coordinate_anomaly(place) for place in places),
        "archetypes": dict(sorted(Counter(item["companion_archetype"] for item in proposals).items())),
    }


def report_markdown(stats: dict[str, Any], logical_digest: str, input_digest: str) -> str:
    lines = [
        "# 제주 비음식점 전체 장소 프로필 빌드 보고서",
        "",
        f"- 상태: `ai_draft`",
        f"- 알고리즘: `{ALGORITHM_VERSION}`",
        f"- 장소: {stats['total']:,}건",
        f"- 파일럿 회귀 앵커: {stats['pilot_anchors']}건",
        f"- companion 수치: {stats['companion_numeric']:,}/7,170",
        f"- 비축제 month 수치: {stats['nonfestival_month_numeric']:,}/16,872",
        f"- 축제 month N/A: {stats['festival_month_na']:,}/336",
        f"- hard constraint: {stats['hard_constraints']:,}건",
        f"- 입력 digest: `{input_digest}`",
        f"- 논리 DB digest: `{logical_digest}`",
        "",
        "## 분포",
        "",
        f"- 유형: `{canonical_json(stats['by_content_type'])}`",
        f"- 조사 상태: `{canonical_json(stats['research_status'])}`",
        f"- 검수 우선순위: `{canonical_json(stats['review_priority'])}`",
        f"- 추론 수준: `{canonical_json(stats['inference_level'])}`",
        f"- archetype: `{canonical_json(stats['archetypes'])}`",
        "",
        "## 해석 주의",
        "",
        "- 모든 값은 사람 검수 전 AI 초안이다.",
        "- 숙박은 숙박 경험, 쇼핑은 관광 중 쇼핑 방문 경험 범위다.",
        "- 운영시간·휴무·가격·객실 재고·행사일은 확인 시점의 참고 정보이며 hard constraint로 다시 확인한다.",
        "- uncertain/not_found 장소는 수치 fallback을 유지하되 confidence 0.25와 high 우선순위다.",
        "- `contentid=2704351`은 삭제하지 않았고 좌표 이상과 high 우선순위를 유지한다.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    paths = {
        "non_restaurants": args.input.resolve(),
        "restaurants_protected": (args.input.parent / "restaurants.json").resolve(),
        "partition_manifest": args.partition_manifest.resolve(),
        "web_cache": args.web_cache.resolve(),
        "pilot_v2_research": (args.pilot_v2_dir / "place_web_research.json").resolve(),
        "pilot_v2_manifest": (args.pilot_v2_dir / "manifest.json").resolve(),
        "pilot_v3_proposals": (args.pilot_v3_dir / "auto_label_proposals.json").resolve(),
        "pilot_v3_profiles": (args.pilot_v3_dir / "place_profiles.json").resolve(),
        "pilot_v3_manifest": (args.pilot_v3_dir / "manifest.json").resolve(),
        "companion_profiles": (args.pilot_v3_dir / "scoring" / "companion_profiles.json").resolve(),
        "month_profiles": (args.pilot_v3_dir / "scoring" / "month_profiles.json").resolve(),
        "climate_fixture": args.climate.resolve(),
        "builder": Path(__file__).resolve(),
    }
    missing = [relative(path) for path in paths.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing required inputs: {missing}")
    before_hashes = {name: file_sha256(path) for name, path in paths.items()}

    places = validate_places(load_json(paths["non_restaurants"]))
    partition_manifest = load_json(paths["partition_manifest"])
    if partition_manifest.get("counts", {}).get("non_restaurants") != 1_434:
        raise ValueError("Partition manifest does not describe 1,434 non-restaurants")
    web_records = validate_web_cache(load_jsonl(paths["web_cache"]), places)
    pilot_v2_records = load_json(paths["pilot_v2_research"])
    pilot_proposals = load_json(paths["pilot_v3_proposals"])
    pilot_profiles = load_json(paths["pilot_v3_profiles"])
    if not all(isinstance(value, list) and len(value) == 100 for value in (pilot_v2_records, pilot_proposals, pilot_profiles)):
        raise ValueError("Pilot v2/v3 inputs must contain exactly 100 records")
    pilot_v2_by_id = {clean(item["contentid"]): item for item in pilot_v2_records}
    pilot_proposal_by_id = {clean(item["contentid"]): item for item in pilot_proposals}
    pilot_profile_by_id = {clean(item["contentid"]): item for item in pilot_profiles}
    if not (set(pilot_v2_by_id) == set(pilot_proposal_by_id) == set(pilot_profile_by_id)):
        raise ValueError("Pilot v2/v3 contentid sets differ")
    for contentid, proposal in pilot_proposal_by_id.items():
        profile = pilot_profile_by_id[contentid]
        if profile.get("companion_fit") != {key: proposal["companion_fit"][key]["value"] for key in COMPANION_KEYS}:
            raise ValueError(f"Pilot companion profile/proposal mismatch for {contentid}")
        if profile.get("month_fit") != {key: proposal["month_fit"][key]["value"] for key in MONTH_KEYS}:
            raise ValueError(f"Pilot month profile/proposal mismatch for {contentid}")

    companions = companion_profiles(paths["companion_profiles"])
    months = month_profiles(paths["month_profiles"])
    climate = load_json(paths["climate_fixture"])
    climate_canonical_hash = clean(climate.get("canonical_sha256"))
    if not valid_sha256(climate_canonical_hash):
        raise ValueError("Climate fixture canonical_sha256 is invalid")

    research_records: list[dict[str, Any]] = []
    proposals: list[dict[str, Any]] = []
    for source_order, (place, web) in enumerate(zip(places, web_records, strict=True)):
        contentid = clean(place["contentid"])
        assignment = assign_archetype(place, web)
        if contentid in pilot_v2_by_id:
            research = build_pilot_research(place, source_order, pilot_v2_by_id[contentid], web)
            proposal = build_pilot_proposal(place, source_order, pilot_proposal_by_id[contentid], research)
        else:
            research = build_nonpilot_research(place, source_order, web, assignment)
            proposal = build_nonpilot_proposal(place, source_order, web, research, assignment, companions, months)
        research_records.append(research)
        proposals.append(proposal)
    validate_proposals(proposals, places)
    if sum(bool(proposal["pilot_anchor"]) for proposal in proposals) != 100:
        raise ValueError("Expected exactly 100 pilot regression anchors")
    anchor = proposals[next(index for index, place in enumerate(places) if clean(place["contentid"]) == "2704351")]
    if anchor["review_priority"] != "high" or "coordinate_anomaly" not in anchor.get("flags", []):
        raise ValueError("Coordinate anomaly 2704351 was not preserved as high priority")

    constraints = flatten_constraints(proposals, places)
    review_queue = build_review_queue(proposals, places)
    output_dir = args.output_dir.resolve()
    output_paths = {
        "place_web_research.jsonl": output_dir / "place_web_research.jsonl",
        "auto_label_proposals.jsonl": output_dir / "auto_label_proposals.jsonl",
        "hard_constraints.jsonl": output_dir / "hard_constraints.jsonl",
        "review_queue.jsonl": output_dir / "review_queue.jsonl",
        "place_profiles.sqlite3": output_dir / "place_profiles.sqlite3",
        "manifest.json": output_dir / "manifest.json",
        "review_report.md": output_dir / "review_report.md",
    }
    write_jsonl(output_paths["place_web_research.jsonl"], research_records)
    write_jsonl(output_paths["auto_label_proposals.jsonl"], proposals)
    write_jsonl(output_paths["hard_constraints.jsonl"], constraints)
    write_jsonl(output_paths["review_queue.jsonl"], review_queue)

    input_manifest = {
        name: {"path": relative(path), "sha256": before_hashes[name]}
        for name, path in sorted(paths.items())
    }
    input_digest = canonical_sha256(input_manifest)
    dataset_meta = {
        "schema_version": "place-profiles-sqlite-v1",
        "dataset_version": FULL_VERSION,
        "snapshot_date": SNAPSHOT,
        "record_count": 1_434,
        "algorithm_version": ALGORITHM_VERSION,
        "label_run_id": LABEL_RUN_ID,
        "input_digest": input_digest,
        "climate_canonical_sha256": climate_canonical_hash,
        "ruleset_sha256": canonical_sha256(RULESET_DESCRIPTOR),
        "logical_db_digest_algorithm": "trip-ai-sqlite-logical-v1",
        "status": "ai_draft",
    }
    logical_digest = build_database(
        output_paths["place_profiles.sqlite3"],
        places,
        web_records,
        research_records,
        proposals,
        constraints,
        input_digest,
        climate_canonical_hash,
        dataset_meta,
    )
    stats = stats_for(places, research_records, proposals, constraints)
    if stats["companion_numeric"] != 7_170 or stats["nonfestival_month_numeric"] != 16_872 or stats["festival_month_na"] != 336:
        raise ValueError(f"Coverage mismatch: {stats}")
    atomic_write_text(output_paths["review_report.md"], report_markdown(stats, logical_digest, input_digest))
    output_files = {}
    counts = {
        "place_web_research.jsonl": len(research_records),
        "auto_label_proposals.jsonl": len(proposals),
        "hard_constraints.jsonl": len(constraints),
        "review_queue.jsonl": len(review_queue),
    }
    for name, path in output_paths.items():
        if name == "manifest.json":
            continue
        output_files[name] = {"path": relative(path), "sha256": file_sha256(path)}
        if name in counts:
            output_files[name]["count"] = counts[name]
    manifest = {
        "schema_version": "place-profile-full-manifest-v1",
        "status": "ai_draft",
        "dataset_version": FULL_VERSION,
        "snapshot_date": SNAPSHOT,
        "algorithm_version": ALGORITHM_VERSION,
        "label_run_id": LABEL_RUN_ID,
        "inputs": input_manifest,
        "input_digest": input_digest,
        "rules": {
            "descriptor": RULESET_DESCRIPTOR,
            "descriptor_sha256": canonical_sha256(RULESET_DESCRIPTOR),
            "builder_path": relative(paths["builder"]),
            "builder_sha256": before_hashes["builder"],
        },
        "climate": {
            "path": relative(paths["climate_fixture"]),
            "file_sha256": before_hashes["climate_fixture"],
            "canonical_sha256": climate_canonical_hash,
        },
        "stats": stats,
        "logical_db_digest": logical_digest,
        "logical_db_digest_algorithm": "trip-ai-sqlite-logical-v1",
        "files": output_files,
        "protected_inputs_unchanged": True,
    }
    atomic_write_text(output_paths["manifest.json"], f"{json.dumps(manifest, ensure_ascii=False, indent=2)}\n")

    after_hashes = {name: file_sha256(path) for name, path in paths.items()}
    changed = [name for name in paths if before_hashes[name] != after_hashes[name]]
    if changed:
        raise ValueError(f"Protected input files changed during build: {changed}")
    print(
        json.dumps(
            {
                "ok": True,
                "output": relative(output_dir),
                "records": len(places),
                "pilot_anchors": stats["pilot_anchors"],
                "research_status": stats["research_status"],
                "review_priority": stats["review_priority"],
                "hard_constraints": stats["hard_constraints"],
                "logical_db_digest": logical_digest,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # fail-fast CLI boundary
        print(f"ERROR: {error}", file=sys.stderr)
        raise
