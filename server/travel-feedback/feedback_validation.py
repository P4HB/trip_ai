"""v3 session validation and explicit legacy dispatch."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

from feedback_contract import (V2_SCHEMA_VERSION, V3_SCHEMA_VERSION, SCHEMA_VERSION, API_PATH, ITINERARY_PATH, MAX_ITINERARY_BODY_BYTES, REVIEW_SCHEMA_VERSION, REVIEW_PATH_PATTERN, MAX_BODY_BYTES, MAX_ENTRIES, MAX_SESSION_ENTRIES, MAX_COMMENT_LENGTH, MAX_PARTICIPANT_NAME_LENGTH, ValidationError, SubmissionConflict, parse_iso_datetime, require_canonical_uuid, require_storage, feedback_entries, require_entry_place, require_entry_comment_and_metadata, require_snapshot_sections)
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

    require_canonical_uuid(payload, "session_id")

    revision = payload.get("revision")
    if type(revision) is not int or revision < 1:
        raise ValidationError("revision must be a positive integer")
    parse_iso_datetime(payload.get("created_at"), "created_at")
    parse_iso_datetime(payload.get("updated_at"), "updated_at")

    require_storage(payload, "server_autosave")
    feedback, entries, required, completed = feedback_entries(payload, MAX_SESSION_ENTRIES)
    if required != len(entries) or not 0 <= completed <= required:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    actual_completed = 0
    for index, entry in enumerate(entries):
        require_entry_place(entry, index, seen_place_ids)
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
        require_entry_comment_and_metadata(entry, index)

    all_completed = completed == required
    if completed != actual_completed or feedback.get("all_scores_completed") is not all_completed:
        raise ValidationError("feedback score completion state is invalid")
    require_snapshot_sections(payload)
    return payload


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") == V2_SCHEMA_VERSION:
        return validate_v2_payload(payload)
    if payload.get("schema_version") == V3_SCHEMA_VERSION:
        return validate_v3_payload(payload)
    raise ValidationError("unsupported schema_version")
