"""Conservative parser for Kakao restaurant business hours (SPEC-107).

The collector stored only the 7 calendar days shown on the place page (`schedule_json`,
e.g. ``{"label": "화(9/22)", "details": ["11:00 ~ 22:00", "21:00 라스트오더"]}``) plus
free-text notes. This module projects that observed week onto weekdays with explicit,
conservative rules. Anything it cannot interpret excludes the restaurant (or, for a
holiday-only ambiguity, only that weekday) instead of guessing.

Shared by ``scripts/build_restaurant_meal_catalog.py`` and the itinerary server.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date, datetime, time, timedelta

VERSION = "kakao-observed-week-hours-v1"
from timeutil import KST
WEEKDAYS = "월화수목금토일"  # ISO weekday 1..7
# Public holidays inside the 2026-09 collection windows. They are needed only to decide
# whether an observed day shows regular weekly hours. The data itself labels these dates
# (추석전날/당일/다음날, 개천절, 개천절 대체공휴일). Observations outside the coverage
# range exclude the restaurant until this table is extended for a new collection.
OBSERVATION_HOLIDAYS = frozenset({"2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09"})
OBSERVATION_COVERAGE = ("2026-09-01", "2026-10-31")

_SPACE = re.compile(r"\s+")
_LABEL = re.compile(r"([월화수목금토일])\((\d{1,2})/(\d{1,2})\)")
_SCHEDULE_LINE = re.compile(r"[월화수목금토일]\(\d{1,2}/\d{1,2}\)(?: |$)")
_INTERVAL = re.compile(r"(\d{2}):(\d{2}) ~ (\d{2}):(\d{2})")
_BREAK = re.compile(r"(\d{2}):(\d{2}) ~ (\d{2}):(\d{2}) 브레이크타임")
_LAST_ORDER = re.compile(r"(\d{2}):(\d{2}) 라스트오더")
_SPECIAL_CLOSURE = re.compile(r"\S.* 휴무")
_WEEKLY_CLOSURE = re.compile(r"매주 ([월화수목금토일]요일(?:, ?[월화수목금토일]요일)*) 휴무")
_DATED_CLOSURE = re.compile(r"(\d{1,2})/(\d{1,2})\(([월화수목금토일])\)(?: ~ (\d{1,2})/(\d{1,2})\(([월화수목금토일])\))? 휴무")
_HEADINGS = frozenset({"휴무일", "브레이크타임", "곧 브레이크타임", "라스트오더", "영업정보", "수정제안"})
_IGNORABLE_NOTES = frozenset({"", "요기요 제공", "연중무휴", "브레이크타임 없음"})


class HoursParseError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _norm(text):
    return _SPACE.sub(" ", str(text or "").replace("\xa0", " ")).strip()


def _minutes(hour, minute, *, allow_24=False):
    hour, minute = int(hour), int(minute)
    if minute > 59 or hour > 24 or (hour == 24 and (minute or not allow_24)):
        raise HoursParseError("time_invalid")
    return hour * 60 + minute


def _observation_year(checked_at):
    try:
        checked = datetime.fromisoformat(str(checked_at))
    except (TypeError, ValueError):
        raise HoursParseError("checked_at_missing") from None
    if checked.utcoffset() is None:
        raise HoursParseError("checked_at_missing")
    return checked.astimezone(KST).date()


def _resolve_date(reference, month, day, weekday_char=None):
    month, day = int(month), int(day)
    candidates = []
    for year in (reference.year - 1, reference.year, reference.year + 1):
        try:
            candidates.append(date(year, month, day))
        except ValueError:
            continue
    if not candidates:
        raise HoursParseError("label_date_invalid")
    resolved = min(candidates, key=lambda value: abs((value - reference).days))
    if weekday_char is not None and WEEKDAYS[resolved.isoweekday() - 1] != weekday_char:
        raise HoursParseError("label_weekday_mismatch")
    return resolved


def _note_lines(hours_text, closed_days, break_time, last_order):
    lines = []
    text_lines = str(hours_text or "").split("\n")
    # The first hours_text line is the live status ("영업 중19:00 까지", "휴무일내일 10:00 오픈").
    for index, raw in enumerate(text_lines):
        if index == 0:
            continue
        lines.append(raw)
    for field in (closed_days, break_time, last_order):
        lines.extend(str(field or "").split("\n"))
    notes = []
    for raw in lines:
        line = _norm(raw)
        if line in _HEADINGS or _SCHEDULE_LINE.match(line):
            continue
        if line not in notes:
            notes.append(line)
    return notes


def _classify_notes(notes, reference):
    weekly_closed, date_closures = set(), []
    for line in notes:
        if line in _IGNORABLE_NOTES:
            continue
        weekly = _WEEKLY_CLOSURE.fullmatch(line)
        if weekly:
            weekly_closed.update(WEEKDAYS.index(part.strip()[0]) + 1 for part in weekly.group(1).split(","))
            continue
        dated = _DATED_CLOSURE.fullmatch(line)
        if dated:
            start = _resolve_date(reference, dated.group(1), dated.group(2), dated.group(3))
            end = _resolve_date(start, dated.group(4), dated.group(5), dated.group(6)) if dated.group(4) else start
            if end < start or (end - start).days > 366:
                raise HoursParseError("dated_closure_invalid")
            date_closures.append((start.isoformat(), end.isoformat()))
            continue
        # 격주·매달·비정기·재료 소진·홀/포장 분리·공휴일·계절 등은 추측하지 않는다.
        raise HoursParseError("note_unsupported")
    return weekly_closed, sorted(set(date_closures))


def _parse_day(details):
    if not isinstance(details, list) or any(not isinstance(item, str) for item in details):
        raise HoursParseError("detail_unrecognized")
    intervals, breaks, orders = [], [], []
    closed = special = False
    for raw in details:
        item = _norm(raw)
        if (match := _BREAK.fullmatch(item)):
            breaks.append(match.groups())
        elif (match := _INTERVAL.fullmatch(item)):
            intervals.append(match.groups())
        elif (match := _LAST_ORDER.fullmatch(item)):
            orders.append(match.groups())
        elif item == "휴무일":
            closed = True
        elif _SPECIAL_CLOSURE.fullmatch(item):
            special = True
        else:
            raise HoursParseError("detail_unrecognized")
    if closed or special:
        if intervals or breaks or orders:
            raise HoursParseError("mixed_closed_and_open")
        return ("special",) if special else ("closed",)
    if not intervals:
        raise HoursParseError("detail_unrecognized")
    spans = []
    for oh, om, ch, cm in intervals:
        start, end = _minutes(oh, om), _minutes(ch, cm, allow_24=True)
        if end <= start:
            end += 1440
        if end - start > 1440 or start >= 1440:
            raise HoursParseError("interval_invalid")
        spans.append([start, end])
    spans.sort()
    if any(previous[1] > current[0] for previous, current in zip(spans, spans[1:])):
        raise HoursParseError("interval_overlap")
    segments = [list(span) for span in spans]
    for bh, bm, eh, em in breaks:
        begin, finish = _minutes(bh, bm), _minutes(eh, em, allow_24=True)
        placed = False
        for shift in (0, 1440):
            b0 = begin + shift
            b1 = finish + shift if finish + shift > b0 else finish + shift + 1440
            for index, (start, end) in enumerate(segments):
                if start < b0 < b1 < end:
                    segments[index:index + 1] = [[start, b0], [b1, end]]
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise HoursParseError("break_outside_hours")
    cutoffs = [None] * len(segments)
    for lh, lm in orders:
        value = _minutes(lh, lm, allow_24=True)
        matches = [index for shift in (0, 1440) for index, (start, end) in enumerate(segments) if start < value + shift <= end]
        if len(matches) != 1:
            raise HoursParseError("last_order_outside_hours" if not matches else "last_order_ambiguous")
        index = matches[0]
        if cutoffs[index] is not None:
            raise HoursParseError("last_order_ambiguous")
        start, end = segments[index]
        cutoffs[index] = value if start < value <= end else value + 1440
    return ("open", tuple((start, end, cutoff) for (start, end), cutoff in zip(segments, cutoffs)))


def parse_business_hours(*, status, schedule_json, hours_text="", closed_days="", break_time="", last_order="", checked_at=None):
    """Return ``{"status": "parsed", ...}`` or ``{"status": "excluded", "reason": code}``."""
    try:
        if status != "available":
            raise HoursParseError(f"hours_{status or 'missing'}")
        reference = _observation_year(checked_at)
        schedule = json.loads(schedule_json) if isinstance(schedule_json, str) else schedule_json
        if not isinstance(schedule, list):
            raise HoursParseError("schedule_invalid")
        weekly_closed, date_closures = _classify_notes(_note_lines(hours_text, closed_days, break_time, last_order), reference)
        observations = []
        for entry in schedule:
            if not isinstance(entry, dict):
                raise HoursParseError("schedule_invalid")
            label, details = _norm(entry.get("label")), entry.get("details", [])
            if not label and not details:
                continue  # Kakao renders an empty marker row for free-text notes; the note itself is classified above.
            match = _LABEL.fullmatch(label)
            if not match:
                raise HoursParseError("label_unrecognized")
            observed = _resolve_date(reference, match.group(2), match.group(3), match.group(1))
            if not OBSERVATION_COVERAGE[0] <= observed.isoformat() <= OBSERVATION_COVERAGE[1]:
                raise HoursParseError("observation_outside_holiday_table")
            observations.append((observed, _parse_day(details)))
        if not observations:
            raise HoursParseError("schedule_empty")

        def in_dated_closure(day):
            return any(start <= day.isoformat() <= end for start, end in date_closures)

        regular = Counter(signature for day, signature in observations if signature[0] == "open"
                          and day.isoformat() not in OBSERVATION_HOLIDAYS and not in_dated_closure(day))
        ranked = regular.most_common(2)
        mode = ranked[0][0] if ranked and (len(ranked) == 1 or ranked[0][1] > ranked[1][1]) else None
        weekly = {}
        for weekday in range(1, 8):
            resolved = []
            for day, signature in observations:
                if day.isoweekday() != weekday:
                    continue
                if in_dated_closure(day):
                    resolved.append(("unknown", "dated_closure"))
                elif day.isoformat() in OBSERVATION_HOLIDAYS:
                    if signature[0] == "open":
                        resolved.append(signature if signature == mode else ("unknown", "holiday_observation"))
                    else:
                        resolved.append(("closed",) if weekday in weekly_closed else ("unknown", "holiday_observation"))
                elif signature[0] == "special":
                    resolved.append(("unknown", "special_closure"))
                else:
                    resolved.append(signature)
            concrete = {item for item in resolved if item[0] != "unknown"}
            if len(concrete) > 1:
                result = ("unknown", "conflicting_observations")
            elif concrete:
                result = next(iter(concrete))
            elif resolved:
                result = resolved[0]
            else:
                result = ("closed",) if weekday in weekly_closed else ("unknown", "not_observed")
            if weekday in weekly_closed and result[0] == "open":
                result = ("unknown", "closure_rule_conflict")
            elif weekday in weekly_closed and result[0] == "unknown" and result[1] == "not_observed":
                result = ("closed",)
            if result[0] == "open":
                weekly[str(weekday)] = {"status": "open", "segments": [list(segment) for segment in result[1]]}
            elif result[0] == "closed":
                weekly[str(weekday)] = {"status": "closed"}
            else:
                weekly[str(weekday)] = {"status": "unknown", "reason": result[1]}
        if not any(value["status"] == "open" for value in weekly.values()):
            raise HoursParseError("no_open_weekday")
        return {"status": "parsed", "version": VERSION, "basis": "observed_week_projection",
                "weekly": weekly, "dateClosures": [list(item) for item in date_closures],
                "observedDates": sorted({day.isoformat() for day, _ in observations})}
    except HoursParseError as error:
        return {"status": "excluded", "reason": error.code}


def _segments_for(hours, day):
    """Segments (start, end, lastOrder) in minutes relative to ``day`` 00:00, or None if unknown."""
    if any(start <= day.isoformat() <= end for start, end in hours.get("dateClosures", [])):
        return []
    entry = hours["weekly"].get(str(day.isoweekday()))
    if not entry or entry.get("status") == "unknown":
        return None
    segments = [tuple(item) for item in entry.get("segments", [])] if entry["status"] == "open" else []
    previous = day - timedelta(days=1)
    prev_entry = hours["weekly"].get(str(previous.isoweekday())) or {}
    prev_closed = any(start <= previous.isoformat() <= end for start, end in hours.get("dateClosures", []))
    if prev_entry.get("status") == "open" and not prev_closed:
        for start, end, cutoff in prev_entry["segments"]:
            if end > 1440:  # overnight carry-over
                segments.append((start - 1440, end - 1440, None if cutoff is None else cutoff - 1440))
    return sorted(segments)


def meal_fits(hours, arrival, duration_minutes):
    """Whether [arrival, arrival+duration] lies in one service segment and arrival <= last order.

    Returns ``(True, segment)`` or ``(False, reason)``; reasons are ``hours_unknown_for_weekday``
    and ``closed_at_time``. ``arrival`` must be timezone-aware.
    """
    local = arrival.astimezone(KST)
    day = local.date()
    segments = _segments_for(hours, day)
    if segments is None:
        return False, "hours_unknown_for_weekday"
    midnight = datetime.combine(day, time(0), KST)
    start_min = (local - midnight).total_seconds() / 60
    end_min = start_min + duration_minutes
    for start, end, cutoff in segments:
        if start <= start_min and end_min <= end and (cutoff is None or start_min <= cutoff):
            return True, (start, end, cutoff)
    return False, "closed_at_time"


def _clock(minutes):
    minutes = int(minutes)
    prefix = "다음날 " if minutes >= 1440 else ""
    minutes %= 1440
    return f"{prefix}{minutes // 60:02d}:{minutes % 60:02d}"


def hours_summary(hours, day):
    """Short Korean summary of the projected hours for a trip date."""
    label = WEEKDAYS[day.isoweekday() - 1]
    segments = _segments_for(hours, day)
    if segments is None:
        return f"{label} 영업시간 확인 필요"
    own = [item for item in segments if item[0] >= 0]
    if not own:
        return f"{label} 휴무"
    parts = [f"{_clock(start)}–{_clock(end)}" + (f"(라스트오더 {_clock(cutoff)})" if cutoff is not None else "") for start, end, cutoff in own]
    return f"{label} " + ", ".join(parts)
