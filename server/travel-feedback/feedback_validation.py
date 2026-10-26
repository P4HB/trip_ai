"""v3 session validation and explicit legacy dispatch."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

import uuid
from feedback_contract import (V2_SCHEMA_VERSION, V3_SCHEMA_VERSION, SCHEMA_VERSION, API_PATH, ITINERARY_PATH, MAX_ITINERARY_BODY_BYTES, REVIEW_SCHEMA_VERSION, REVIEW_PATH_PATTERN, MAX_BODY_BYTES, MAX_ENTRIES, MAX_SESSION_ENTRIES, MAX_COMMENT_LENGTH, MAX_PARTICIPANT_NAME_LENGTH, ValidationError, SubmissionConflict, parse_iso_datetime)
from feedback_legacy import validate_v2_payload

def validate_v3_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") != V3_SCHEMA_VERSION:
        raise ValidationError("unsupported schema_version")

    participant_name = payload.get("participant_name")
    if participant_name is not None:
        if not isinstance(participant_name, str) or not 1 <= len(participant_name) <= MAX_PARTICIPANT_NAME_LENGTH:
            raise ValidationError(f"participant_name must contain 1..{MAX_PARTICIPANT_NAME_LENGTH} characters")
        if participant_name != participant_name.strip():
            raise ValidationError("participant_name must not have leading or trailing whitespace")
        if any(ord(character) < 32 or ord(character) == 127 for character in participant_name):
            raise ValidationError("participant_name must not contain control characters")

    session_id = payload.get("session_id")
    try:
        parsed_id = uuid.UUID(session_id)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValidationError("session_id must be a UUID") from exc
    if str(parsed_id) != session_id.lower():
        raise ValidationError("session_id must use canonical UUID form")

    revision = payload.get("revision")
    if type(revision) is not int or revision < 1:
        raise ValidationError("revision must be a positive integer")
    parse_iso_datetime(payload.get("created_at"), "created_at")
    parse_iso_datetime(payload.get("updated_at"), "updated_at")

    storage = payload.get("storage")
    if not isinstance(storage, dict) or storage.get("method") != "server_autosave":
        raise ValidationError("storage.method must be server_autosave")
    if storage.get("endpoint") != API_PATH:
        raise ValidationError("storage.endpoint is invalid")
    if storage.get("server_transmitted") is not True or storage.get("web_storage_used") is not False:
        raise ValidationError("storage flags are invalid")

    feedback = payload.get("feedback")
    if not isinstance(feedback, dict):
        raise ValidationError("feedback must be an object")
    entries = feedback.get("entries")
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_SESSION_ENTRIES:
        raise ValidationError(f"feedback.entries must contain 1..{MAX_SESSION_ENTRIES} items")
    required = feedback.get("required_place_count")
    completed = feedback.get("completed_place_count")
    if type(required) is not int or type(completed) is not int:
        raise ValidationError("feedback counts must be integers")
    if required != len(entries) or not 0 <= completed <= required:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    actual_completed = 0
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
        score_label = entry.get("score_label")
        if score is None:
            if score_label is not None:
                raise ValidationError(f"feedback.entries[{index}].score_label must be null")
        elif type(score) is int and 1 <= score <= 5:
            if not isinstance(score_label, str) or not score_label:
                raise ValidationError(f"feedback.entries[{index}].score_label is invalid")
            actual_completed += 1
        else:
            raise ValidationError(f"feedback.entries[{index}].score must be null or 1..5")
        comment = entry.get("comment")
        if not isinstance(comment, str) or len(comment) > MAX_COMMENT_LENGTH:
            raise ValidationError(f"feedback.entries[{index}].comment is too long")
        if not isinstance(entry.get("title"), str) or not isinstance(entry.get("contexts"), list):
            raise ValidationError(f"feedback.entries[{index}] metadata is invalid")

    all_completed = completed == required
    if completed != actual_completed or feedback.get("all_scores_completed") is not all_completed:
        raise ValidationError("feedback score completion state is invalid")
    if not isinstance(payload.get("source"), dict):
        raise ValidationError("source must be an object")
    if not isinstance(payload.get("user_selections"), dict):
        raise ValidationError("user_selections must be an object")
    if not isinstance(payload.get("recommendation_result"), dict):
        raise ValidationError("recommendation_result must be an object")
    return payload


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") == V2_SCHEMA_VERSION:
        return validate_v2_payload(payload)
    if payload.get("schema_version") == V3_SCHEMA_VERSION:
        return validate_v3_payload(payload)
    raise ValidationError("unsupported schema_version")
