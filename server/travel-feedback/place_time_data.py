"""Conservative TourAPI introduction normalization; ambiguous text stays unknown."""
from __future__ import annotations

import html
import re

VERSION = "tourapi-operating-normalizer-v1"
FIELDS = {
    "12": ("usetime", "restdate", None),
    "14": ("usetimeculture", "restdateculture", "spendtime"),
    "28": ("usetimeleports", "restdateleports", None),
    "38": ("opentime", "restdateshopping", None),
    "39": ("opentimefood", "restdatefood", None),
}
WEEKDAYS = {"월": "1", "화": "2", "수": "3", "목": "4", "금": "5", "토": "6", "일": "7"}
TIME = r"(?:[01]?\d|2[0-3]):[0-5]\d|24:00"
RANGE = re.compile(r"(" + TIME + r")\s*[~〜～–-]\s*(" + TIME + r")")


def clean(value):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", str(value or ""))).split())


def clock(value):
    hour, minute = value.split(":")
    return f"{int(hour):02d}:{int(minute):02d}"


def parse_duration(text):
    """Only an unqualified scalar official viewing duration is automatically accepted."""
    text = clean(text)
    match = re.fullmatch(r"(?:약\s*)?(?:(\d{1,2})\s*시간)?\s*(?:(\d{1,3})\s*분)?(?:\s*소요)?", text)
    if not match or not any(match.groups()):
        return None
    minutes = int(match.group(1) or 0) * 60 + int(match.group(2) or 0)
    return minutes if 10 <= minutes <= 720 else None


def normalize_introduction(raw, source_ref, checked_at):
    kind = str(raw.get("contenttypeid", ""))
    fields = FIELDS.get(kind)
    result = {"status": "unknown", "checkedAt": checked_at, "sourceRefs": [source_ref] if source_ref else [],
              "weekly": {}, "exceptions": {}, "seasonal": [], "raw": {}, "unknownReasons": [], "version": VERSION}
    if not fields:
        result["unknownReasons"] = ["unsupported_visit_type"]
        return {"operatingInfo": result, "officialDwellMinutes": None}
    hours_key, rest_key, dwell_key = fields
    result["raw"] = {key: clean(raw.get(key)) for key in fields if key}
    hours, rest = clean(raw.get(hours_key)), clean(raw.get(rest_key))
    duration = parse_duration(raw.get(dwell_key)) if dwell_key else None
    official = {"minutes": duration, "sourceRefs": [source_ref], "checkedAt": checked_at} if duration and source_ref and checked_at else None
    if not hours:
        result["unknownReasons"].append("opening_hours_missing")
    if not rest:
        result["unknownReasons"].append("closure_information_missing")
    # Dates, seasons, holidays, event sessions and free-form qualifications require curated normalization.
    # We preserve their text but never make an incomplete schedule authoritative.
    closed_days = set()
    if rest in ("연중무휴", "없음", "휴무없음", "휴무 없음"):
        pass
    elif re.fullmatch(r"매주\s*([월화수목금토일])요일(?:\s*휴무)?", rest):
        closed_days.add(WEEKDAYS[re.fullmatch(r"매주\s*([월화수목금토일])요일(?:\s*휴무)?", rest).group(1)])
    elif rest:
        result["unknownReasons"].append("closure_text_requires_review")
    admission = None
    admission_match = re.search(r"(?:입장\s*마감|마지막\s*입장|최종\s*입장)\s*[:：]?\s*(" + TIME + r")", hours)
    if admission_match:
        admission = clock(admission_match.group(1))
        hours = (hours[:admission_match.start()] + hours[admission_match.end():]).strip(" ()[],;/")
    intervals = []
    if hours in ("24시간", "24시간 개방", "상시 개방", "상시개방"):
        intervals = [{"open": "00:00", "close": "24:00"}]
    else:
        matches = list(RANGE.finditer(hours))
        remainder = RANGE.sub("", hours)
        # Comma/semicolon separated ranges represent explicit breaks. Anything else is ambiguous.
        if matches and re.fullmatch(r"[\s,;/]*", remainder):
            intervals = [{"open": clock(m.group(1)), "close": clock(m.group(2))} for m in matches]
        elif hours:
            result["unknownReasons"].append("opening_text_requires_review")
    if any(item["open"] == item["close"] or item["open"] == "24:00" for item in intervals):
        intervals = []
        result["unknownReasons"].append("ambiguous_zero_length_interval")
    if admission:
        if len(intervals) == 1:
            intervals[0]["lastAdmission"] = admission
        else:
            result["unknownReasons"].append("admission_interval_ambiguous")
    if not source_ref or not checked_at:
        result["unknownReasons"].append("source_or_timestamp_missing")
    if intervals and not result["unknownReasons"]:
        result["weekly"] = {str(day): [] if str(day) in closed_days else [dict(item) for item in intervals] for day in range(1, 8)}
        result["status"] = "known"
    return {"operatingInfo": result, "officialDwellMinutes": official}
