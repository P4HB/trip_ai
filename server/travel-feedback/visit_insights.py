"""Offline public-review analysis: minimal excerpts, grounded IDs, reusable provenance."""
from __future__ import annotations

import hashlib
import json
import re

from llm_client import ProviderError, validate_schema

PROMPT_VERSION = "review-visit-insights-v1"
SCHEMA_VERSION = "place-visit-insights-v1"
SANITIZER_VERSION = "time-excerpts-v1"
PERIOD_WORDS = {"daylight": r"낮|오전|아침|대낮|햇빛|daylight|daytime",
                "sunset": r"일몰|노을|석양|sunset",
                "night": r"야경|야간|저녁|밤|night",
                "any": r"시간대.{0,6}(?:상관|무관)|any\s*time"}
DURATION = re.compile(r"(?:(\d{1,2}(?:\.5)?)\s*시간(?:\s*(\d{1,2})\s*분)?|(\d{1,3})\s*분)")
VISIT_ACTION = re.compile(r"관람|둘러|산책|구경|머물|체류|소요|걸렸|걸려|보는데|보는\s*데|돌아|돌았|돌면|visit|spent", re.I)
UNSAFE = re.compile(r"ignore|instruction|system\s*prompt|assistant|developer|api.?key|명령|지시|프롬프트|이전.{0,8}무시", re.I)
CONFLICT = re.compile(r"비추|추천하지|추천\s*안|안\s*좋|좋지|별로|피하|불가|위험|not\s+recommend|avoid", re.I)
ID_ARRAY = {"type": "array", "items": {"type": "string"}, "maxItems": 20}
INSIGHTS_SCHEMA = {"type": "object", "additionalProperties": False,
                  "properties": {"preferredPeriods": {"type": "array", "maxItems": 4, "items": {
                      "type": "object", "additionalProperties": False,
                      "properties": {"period": {"type": "string", "enum": list(PERIOD_WORDS)}, "evidenceReviewIds": ID_ARRAY},
                      "required": ["period", "evidenceReviewIds"]}},
                      "dwellMinutes": {"anyOf": [{"type": "null"}, {"type": "object", "additionalProperties": False,
                          "properties": {"min": {"type": "integer", "minimum": 10, "maximum": 720},
                                         "max": {"type": "integer", "minimum": 10, "maximum": 720},
                                         "evidenceReviewIds": ID_ARRAY}, "required": ["min", "max", "evidenceReviewIds"]}]},
                      "conflict": {"type": "boolean"}}, "required": ["preferredPeriods", "dwellMinutes", "conflict"]}


def sanitize_excerpt(text):
    """Select only timing sentences; remove obvious PII and all instruction-like sentences."""
    text = str(text or "")[:20_000]
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[contact removed]", text)
    text = re.sub(r"(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}", "[contact removed]", text)
    text = re.sub(r"(?<!\d)\d{2,3}[- ]\d{3,4}[- ]\d{4}(?!\d)", "[contact removed]", text)
    text = re.sub(r"https?://\S+|@[A-Za-z0-9_]+", "[link removed]", text)
    text = re.sub(r"(?:이름|성함|작성자|reviewer)\s*[:：]\s*[^,;\s]+", "[name removed]", text, flags=re.I)
    text = re.sub(r"[가-힣]{2,4}\s*(?:님|씨)(?=[\s,.!]|$)", "[name removed]", text)
    # A decimal duration such as 1.5시간 must remain one piece of evidence.
    sentences = re.split(r"[\n\r!?。]+|(?<!\d)\.|\.(?!\d)", text)
    accepted = []
    time_words = "|".join(PERIOD_WORDS.values())
    for sentence in sentences:
        sentence = " ".join(sentence.split())
        if UNSAFE.search(sentence):
            continue
        if re.search(time_words, sentence, re.I) or (DURATION.search(sentence) and VISIT_ACTION.search(sentence)):
            accepted.append(sentence[:400])
    return " / ".join(accepted)[:1200]


def prepared_reviews(reviews):
    result = []
    for review in reviews:
        excerpt = sanitize_excerpt(review.get("content"))
        if excerpt:
            result.append({"reviewId": str(review["review_id"]), "excerpt": excerpt})
    return sorted(result, key=lambda row: row["reviewId"])[:20]


def input_hash(reviews, model):
    # Include original ID + content hash so edits/removals withdraw cached claims, even if sanitized excerpts match.
    identity = {"reviews": sorted((str(r["review_id"]), hashlib.sha256(str(r.get("content") or "").encode()).hexdigest()) for r in reviews),
                "model": model, "promptVersion": PROMPT_VERSION, "schemaVersion": SCHEMA_VERSION,
                "sanitizerVersion": SANITIZER_VERSION}
    return hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()


def unknown_insights(reviews, model, reason="pending_llm_analysis"):
    prepared = prepared_reviews(reviews)
    return {"schemaVersion": SCHEMA_VERSION, "status": "unknown", "preferredPeriods": [], "dwellMinutes": None,
            "evidenceReviewIds": [], "kind": "review_inference", "unknownReason": reason if prepared else "no_time_evidence",
            "model": model, "promptVersion": PROMPT_VERSION, "sanitizerVersion": SANITIZER_VERSION,
            "inputHash": input_hash(reviews, model), "reviewCount": len(reviews), "timeEvidenceReviewCount": len(prepared)}


def _duration_values(excerpt):
    values = []
    for sentence in excerpt.split(" / "):
        if not VISIT_ACTION.search(sentence) or re.search(r"대기|기다|운전|이동|영업|운영|입장", sentence):
            continue
        for match in DURATION.finditer(sentence):
            minutes = round(float(match.group(1) or 0) * 60) + int(match.group(2) or match.group(3) or 0)
            if 10 <= minutes <= 720:
                values.append(minutes)
    return values


def validate_insights(result, prepared):
    validate_schema(result, INSIGHTS_SCHEMA)
    evidence = {row["reviewId"]: row["excerpt"] for row in prepared}
    all_ids = set()
    for claim in result["preferredPeriods"]:
        ids = claim["evidenceReviewIds"]
        if not ids or len(ids) != len(set(ids)) or any(i not in evidence for i in ids):
            raise ProviderError("review_invalid_evidence")
        if any(not re.search(PERIOD_WORDS[claim["period"]], evidence[i], re.I) for i in ids):
            raise ProviderError("review_ungrounded_period")
        all_ids.update(ids)
    dwell = result["dwellMinutes"]
    if dwell:
        ids = dwell["evidenceReviewIds"]
        if not ids or len(ids) != len(set(ids)) or any(i not in evidence for i in ids) or dwell["min"] > dwell["max"]:
            raise ProviderError("review_invalid_evidence")
        values = [v for i in ids for v in _duration_values(evidence[i])]
        # A model may summarize the observed range, but cannot invent a duration absent in cited text.
        if not values or dwell["min"] != min(values) or dwell["max"] != max(values):
            raise ProviderError("review_ungrounded_duration")
        all_ids.update(ids)
    conflict = result["conflict"] or any(CONFLICT.search(row["excerpt"]) for row in prepared)
    # Large contradictory observed durations also require confirmation; do not select convenient short evidence.
    observed = [v for row in prepared for v in _duration_values(row["excerpt"])]
    if observed and max(observed) > min(observed) * 2:
        conflict = True
    return {"status": "conflict" if conflict else ("inferred" if all_ids else "unknown"),
            "preferredPeriods": [] if conflict else result["preferredPeriods"],
            "dwellMinutes": None if conflict else dwell, "evidenceReviewIds": sorted(all_ids),
            "conflict": conflict, "kind": "review_inference"}


def analyze_reviews(reviews, client, timeout=30):
    prepared = prepared_reviews(reviews)
    base = unknown_insights(reviews, client.model)
    if not prepared:
        return base
    result = client.generate_structured("review_visit_insights", {"reviews": prepared}, INSIGHTS_SCHEMA, timeout)
    try:
        valid = validate_insights(result, prepared)
    except ValueError:
        raise ProviderError("review_invalid_output") from None
    base.update(valid)
    base["unknownReason"] = "conflicting_evidence" if valid["status"] == "conflict" else ("insufficient_evidence" if valid["status"] == "unknown" else None)
    return base
