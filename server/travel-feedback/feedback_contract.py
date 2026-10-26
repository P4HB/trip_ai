"""Shared feedback protocol bounds and validation types."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

V2_SCHEMA_VERSION = "travel-recommendation-feedback-log-v2"
V3_SCHEMA_VERSION = "travel-recommendation-feedback-log-v3"
SCHEMA_VERSION = V2_SCHEMA_VERSION
API_PATH = "/travel/api/feedback"
ITINERARY_PATH = "/travel/api/itineraries"
MAX_ITINERARY_BODY_BYTES = 64 * 1024
REVIEW_SCHEMA_VERSION = "kakao-place-reviews-v1"
REVIEW_PATH_PATTERN = re.compile(r"^/travel/api/places/([^/]+)/reviews$")
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_ENTRIES = 100
MAX_SESSION_ENTRIES = 3000  # bounded cumulative evaluations across course variants; body limit still applies
MAX_COMMENT_LENGTH = 300
MAX_PARTICIPANT_NAME_LENGTH = 30


class ValidationError(ValueError):
    pass


class SubmissionConflict(ValueError):
    pass


def parse_iso_datetime(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be an ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"{field} must be an ISO 8601 string") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{field} must include a timezone")
    return parsed
