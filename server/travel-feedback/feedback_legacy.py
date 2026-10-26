"""v2 compatibility kept while retained submissions and old clients still exist."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

import uuid
from feedback_contract import (V2_SCHEMA_VERSION, V3_SCHEMA_VERSION, SCHEMA_VERSION, API_PATH, ITINERARY_PATH, MAX_ITINERARY_BODY_BYTES, REVIEW_SCHEMA_VERSION, REVIEW_PATH_PATTERN, MAX_BODY_BYTES, MAX_ENTRIES, MAX_SESSION_ENTRIES, MAX_COMMENT_LENGTH, MAX_PARTICIPANT_NAME_LENGTH, ValidationError, SubmissionConflict, parse_iso_datetime)

def validate_v2_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") != V2_SCHEMA_VERSION:
        raise ValidationError("unsupported schema_version")

    submission_id = payload.get("submission_id")
    try:
        parsed_id = uuid.UUID(submission_id)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValidationError("submission_id must be a UUID") from exc
    if str(parsed_id) != submission_id.lower():
        raise ValidationError("submission_id must use canonical UUID form")

    parse_iso_datetime(payload.get("created_at"), "created_at")
    storage = payload.get("storage")
    if not isinstance(storage, dict) or storage.get("method") != "server_api":
        raise ValidationError("storage.method must be server_api")
    if storage.get("endpoint") != API_PATH:
        raise ValidationError("storage.endpoint is invalid")
    if storage.get("server_transmitted") is not True or storage.get("web_storage_used") is not False:
        raise ValidationError("storage flags are invalid")

    feedback = payload.get("feedback")
    if not isinstance(feedback, dict):
        raise ValidationError("feedback must be an object")
    entries = feedback.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_ENTRIES:
        raise ValidationError(f"feedback.entries must contain 1..{MAX_ENTRIES} items")
    required = feedback.get("required_place_count")
    completed = feedback.get("completed_place_count")
    if type(required) is not int or type(completed) is not int:
        raise ValidationError("feedback counts must be integers")
    if required != completed or completed != len(entries) or feedback.get("all_scores_completed") is not True:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValidationError(f"feedback.entries[{index}] must be an object")
        place_id = entry.get("place_id")
        if not isinstance(place_id, str) or not place_id or len(place_id) > 100:
            raise ValidationError(f"feedback.entries[{index}].place_id is invalid")
        if place_id in seen_place_ids:
            raise ValidationError("feedback place_id values must be unique")
        seen_place_ids.add(place_id)
        score = entry.get("score")
        if type(score) is not int or not 1 <= score <= 5:
            raise ValidationError(f"feedback.entries[{index}].score must be 1..5")
        comment = entry.get("comment")
        if not isinstance(comment, str) or len(comment) > MAX_COMMENT_LENGTH:
            raise ValidationError(f"feedback.entries[{index}].comment is too long")
        if not isinstance(entry.get("title"), str) or not isinstance(entry.get("contexts"), list):
            raise ValidationError(f"feedback.entries[{index}] metadata is invalid")

    if not isinstance(payload.get("source"), dict):
        raise ValidationError("source must be an object")
    if not isinstance(payload.get("user_selections"), dict):
        raise ValidationError("user_selections must be an object")
    if not isinstance(payload.get("recommendation_result"), dict):
        raise ValidationError("recommendation_result must be an object")
    return payload
