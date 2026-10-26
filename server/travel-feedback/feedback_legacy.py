"""v2 compatibility kept while retained submissions and old clients still exist."""
from __future__ import annotations
from datetime import datetime
import re
from typing import Any

from feedback_contract import (V2_SCHEMA_VERSION, V3_SCHEMA_VERSION, SCHEMA_VERSION, API_PATH, ITINERARY_PATH, MAX_ITINERARY_BODY_BYTES, REVIEW_SCHEMA_VERSION, REVIEW_PATH_PATTERN, MAX_BODY_BYTES, MAX_ENTRIES, MAX_SESSION_ENTRIES, MAX_COMMENT_LENGTH, MAX_PARTICIPANT_NAME_LENGTH, ValidationError, SubmissionConflict, parse_iso_datetime, require_canonical_uuid, require_storage, feedback_entries, require_entry_place, require_entry_comment_and_metadata, require_snapshot_sections)

def validate_v2_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("request body must be an object")
    if payload.get("schema_version") != V2_SCHEMA_VERSION:
        raise ValidationError("unsupported schema_version")
    require_canonical_uuid(payload, "submission_id")
    parse_iso_datetime(payload.get("created_at"), "created_at")
    require_storage(payload, "server_api")
    feedback, entries, required, completed = feedback_entries(payload, MAX_ENTRIES)
    if required != completed or completed != len(entries) or feedback.get("all_scores_completed") is not True:
        raise ValidationError("feedback completion counts do not match")

    seen_place_ids: set[str] = set()
    for index, entry in enumerate(entries):
        require_entry_place(entry, index, seen_place_ids)
        score = entry.get("score")
        if type(score) is not int or not 1 <= score <= 5:
            raise ValidationError(f"feedback.entries[{index}].score must be 1..5")
        require_entry_comment_and_metadata(entry, index)

    require_snapshot_sections(payload)
    return payload
