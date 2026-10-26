"""Shared feedback protocol bounds and validation types."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any
import uuid

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


# Checks shared by the v2 (legacy) and v3 (session) validators, in the order both apply them.

def require_canonical_uuid(payload: dict[str, Any], field: str) -> None:
    value = payload.get(field)
    try:
        parsed_id = uuid.UUID(value)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a UUID") from exc
    if str(parsed_id) != value.lower():
        raise ValidationError(f"{field} must use canonical UUID form")


def require_storage(payload: dict[str, Any], method: str) -> None:
    storage = payload.get("storage")
    if not isinstance(storage, dict) or storage.get("method") != method:
        raise ValidationError(f"storage.method must be {method}")
    if storage.get("endpoint") != API_PATH:
        raise ValidationError("storage.endpoint is invalid")
    if storage.get("server_transmitted") is not True or storage.get("web_storage_used") is not False:
        raise ValidationError("storage flags are invalid")


def feedback_entries(payload: dict[str, Any], max_entries: int) -> tuple[dict[str, Any], list[Any], int, int]:
    """The feedback object, its entries and the declared required/completed counts."""
    feedback = payload.get("feedback")
    if not isinstance(feedback, dict):
        raise ValidationError("feedback must be an object")
    entries = feedback.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= max_entries:
        raise ValidationError(f"feedback.entries must contain 1..{max_entries} items")
    required = feedback.get("required_place_count")
    completed = feedback.get("completed_place_count")
    if type(required) is not int or type(completed) is not int:
        raise ValidationError("feedback counts must be integers")
    return feedback, entries, required, completed


def require_entry_place(entry: Any, index: int, seen_place_ids: set[str]) -> None:
    if not isinstance(entry, dict):
        raise ValidationError(f"feedback.entries[{index}] must be an object")
    place_id = entry.get("place_id")
    if not isinstance(place_id, str) or not place_id or len(place_id) > 100:
        raise ValidationError(f"feedback.entries[{index}].place_id is invalid")
    if place_id in seen_place_ids:
        raise ValidationError("feedback place_id values must be unique")
    seen_place_ids.add(place_id)


def require_entry_comment_and_metadata(entry: dict[str, Any], index: int) -> None:
    comment = entry.get("comment")
    if not isinstance(comment, str) or len(comment) > MAX_COMMENT_LENGTH:
        raise ValidationError(f"feedback.entries[{index}].comment is too long")
    if not isinstance(entry.get("title"), str) or not isinstance(entry.get("contexts"), list):
        raise ValidationError(f"feedback.entries[{index}] metadata is invalid")


def require_snapshot_sections(payload: dict[str, Any]) -> None:
    if not isinstance(payload.get("source"), dict):
        raise ValidationError("source must be an object")
    if not isinstance(payload.get("user_selections"), dict):
        raise ValidationError("user_selections must be an object")
    if not isinstance(payload.get("recommendation_result"), dict):
        raise ValidationError("recommendation_result must be an object")
