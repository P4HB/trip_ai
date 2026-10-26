"""Every environment setting the travel-feedback server reads, with its default (SPEC-113 REQ-008).

Values are read from the environment at call time (tests patch ``os.environ``) and returned as raw
strings; callers keep their own trimming, number parsing and provider-specific fallbacks. Secret
values are only passed to the code that needs them and are never logged.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Mapping

DATA_DIR = Path(__file__).parent / "data"

DEFAULTS = {
    # HTTP server and storage
    "TRAVEL_FEEDBACK_PORT": "8200",
    "TRAVEL_FEEDBACK_DB_PATH": "/data/feedback.sqlite3",
    "TRAVEL_PUBLIC_ORIGIN": "http://127.0.0.1:8080",
    "TRAVEL_FEEDBACK_RETENTION_DAYS": "90",
    "TRAVEL_REVIEW_DB_PATH": "/app/data/kakao_reviews.sqlite3",
    "TRAVEL_TRUSTED_PROXY_IPS": "",
    # Itinerary feature and its public sidecars
    "ITINERARY_ENABLED": "auto",
    "ITINERARY_REQUESTS_PER_MINUTE": "10",
    "ITINERARY_REQUESTS_PER_DAY": "100",
    "ITINERARY_CATALOG_PATH": str(DATA_DIR / "itinerary_catalog.json"),
    "ITINERARY_INSIGHTS_PATH": str(DATA_DIR / "visit_insights.json"),
    "ITINERARY_RESTAURANT_CATALOG_PATH": str(DATA_DIR / "restaurant_meal_catalog.sqlite3"),
    "ITINERARY_ROUTE_PROVIDER": "",
    "KAKAO_MOBILITY_API_KEY": "",
    # LLM provider (SPEC-108)
    "LLM_PROVIDER": "",
    "GEMINI_API_KEY": "",
    "GOOGLE_API_KEY": "",
    "OPENAI_API_KEY": "",
    "ITINERARY_LLM_MODEL": "",
    "ITINERARY_LLM_MAX_OUTPUT_TOKENS": "",
    "RESTAURANT_LLM_MODEL": "",
    "RESTAURANT_LLM_MAX_OUTPUT_TOKENS": "",
    "GEMINI_THINKING_LEVEL": "",
    "GEMINI_FALLBACK_MODEL": "",
}

# Names the local runner must recognize in a .env file (scripts/run_trip_ai_local.py).
LLM_SETTING_NAMES = frozenset(name for name in DEFAULTS if any(part in name for part in ("GEMINI", "GOOGLE", "OPENAI", "LLM")))


def env(name: str, environ: Mapping[str, str] | None = None) -> str:
    """Raw value of a registered setting; an unregistered name is a programming error."""
    if name not in DEFAULTS:
        raise KeyError(f"unregistered setting: {name}")
    environ = os.environ if environ is None else environ
    return environ.get(name, DEFAULTS[name])
