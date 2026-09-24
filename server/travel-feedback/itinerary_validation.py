"""Deterministic time/identity validation for SPEC-083; providers are never facts from LLM."""
from __future__ import annotations

import calendar
import math
import re
from datetime import date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
SOLAR_VERSION = "noaa-fractional-year-v1"
SOLAR_SOURCE = "https://gml.noaa.gov/grad/solcalc/solareqns.PDF"


def issue(code, message, place_id=None):
    result = {"code": code, "message": message}
    if place_id is not None:
        result["placeId"] = place_id
    return result


def local_time(day, value):
    if not isinstance(value, str):
        raise ValueError("시간은 문자열이어야 합니다.")
    if value == "24:00":
        return local_time(day, "00:00") + timedelta(days=1)
    if re.fullmatch(r"\d{2}:\d{2}", value):
        parsed = datetime.fromisoformat(f"{day}T{value}:00+09:00")
    else:
        parsed = datetime.fromisoformat(value)
        if parsed.utcoffset() != timedelta(hours=9):
            raise ValueError("시간대는 +09:00이어야 합니다.")
    return parsed


def iso(value):
    return value.isoformat(timespec="seconds")


def bounds(day):
    start = local_time(day["date"], day["startTime"])
    end = local_time(day["date"], day["endTime"])
    if end <= start:
        end += timedelta(days=1)
    return start, end


def solar_times(day, lng, lat):
    """NOAA fractional-year approximation, not observed visibility or opening hours."""
    when = date.fromisoformat(day)
    gamma = 2 * math.pi / (366 if calendar.isleap(when.year) else 365) * (when.timetuple().tm_yday - 1)
    eq = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                   - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))
    decl = (0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
            - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma)
            - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma))
    latitude = math.radians(lat)
    cosine = math.cos(math.radians(90.833)) / (math.cos(latitude) * math.cos(decl)) - math.tan(latitude) * math.tan(decl)
    if not -1 <= cosine <= 1:
        return {"status": "unknown", "version": SOLAR_VERSION}
    hour_angle = math.degrees(math.acos(cosine))
    midnight = local_time(day, "00:00")
    def stamp(sign):
        minutes = 720 - 4 * (lng + sign * hour_angle) - eq + 540
        return iso(midnight + timedelta(minutes=round(minutes)))
    return {"status": "astronomical_estimate", "sunrise": stamp(1), "sunset": stamp(-1),
            "version": SOLAR_VERSION, "source": SOLAR_SOURCE,
            "limitation": "대기·지형·날씨에 따른 실제 관측 시각과 가시성은 보장하지 않습니다."}


def fresh(record, day, policy, now=None):
    if not isinstance(record, dict) or not record.get("sourceRefs") or not record.get("checkedAt"):
        return False
    try:
        checked = datetime.fromisoformat(record["checkedAt"].replace("Z", "+00:00"))
        if checked.tzinfo is None:
            return False
        reference = max(now or datetime.now(KST), local_time(day, "00:00"))
        return timedelta(days=-1) <= reference - checked <= timedelta(days=policy["operatingFreshnessDays"])
    except (ValueError, TypeError):
        return False


def _intervals_for(info, day):
    exceptional = info.get("exceptions", {}).get(day)
    if exceptional is not None:
        if not isinstance(exceptional, dict) or exceptional.get("status") in ("unknown", "conflict"):
            return None
        return [] if exceptional.get("closed") else exceptional.get("intervals")
    seasonal = [item for item in info.get("seasonal", []) if item.get("startDate", "9999") <= day <= item.get("endDate", "0000")]
    if len(seasonal) > 1:
        return None
    weekly = seasonal[0].get("weekly", {}) if seasonal else info.get("weekly", {})
    return weekly.get(str(date.fromisoformat(day).isoweekday()))


def operating_windows(place, day, policy, now=None):
    info = place.get("operatingInfo") or {}
    if info.get("status") not in ("known", "verified") or not fresh(info, day, policy, now):
        return None, issue("operating_information_unknown", "운영정보가 없거나 오래되었거나 상충하여 확인이 필요합니다.", place["placeId"])
    today = _intervals_for(info, day)
    if today is None:
        return None, issue("operating_information_unknown", "해당 날짜의 운영정보를 확인해야 합니다.", place["placeId"])
    # Explicit exceptional closure overrides any carry-over interval.
    if info.get("exceptions", {}).get(day, {}).get("closed"):
        return [], None
    windows = []
    previous = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
    try:
        for base, intervals in ((previous, _intervals_for(info, previous) or []), (day, today)):
            if not isinstance(intervals, list):
                raise ValueError("intervals")
            for interval in intervals:
                opened = local_time(base, interval["open"])
                closed = local_time(base, interval["close"])
                if closed <= opened:
                    closed += timedelta(days=1)
                if base == previous and closed <= local_time(day, "00:00"):
                    continue
                cutoff = local_time(base, interval["lastAdmission"]) if interval.get("lastAdmission") else None
                if cutoff and cutoff < opened:
                    cutoff += timedelta(days=1)
                if cutoff and not opened <= cutoff <= closed:
                    raise ValueError("last admission")
                windows.append((opened, closed, cutoff))
    except (ValueError, TypeError, KeyError):
        return None, issue("operating_information_unknown", "운영 구간 형식을 확인해야 합니다.", place["placeId"])
    return windows, None


def choose_duration(place, day, policy, now=None):
    official = place.get("officialDwellMinutes")
    if isinstance(official, dict) and fresh(official, day, policy, now):
        minutes = official.get("minutes")
        if isinstance(minutes, (int, float)) and not isinstance(minutes, bool) and 1 <= minutes <= 1440:
            return {"minutes": math.ceil(minutes), "basis": "official", "sourceRefs": official["sourceRefs"], "evidenceReviewIds": []}
    insights = place.get("visitInsights") or {}
    dwell = insights.get("dwellMinutes")
    evidence = set(insights.get("evidenceReviewIds") or [])
    if insights.get("status") not in ("unknown", "conflict", "insufficient") and isinstance(dwell, dict):
        ids = dwell.get("evidenceReviewIds") or []
        low, high = dwell.get("min"), dwell.get("max")
        if ids and set(ids) <= evidence and all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in (low, high)) and 1 <= low <= high <= 1440:
            return {"minutes": math.ceil(high), "basis": "review_estimate", "sourceRefs": [], "evidenceReviewIds": ids}
    place_type = place.get("primaryType")
    if place.get("requiresDurationConfirmation") or place_type in policy["durationConfirmationTypes"]:
        return {"minutes": None, "basis": "unknown", "sourceRefs": [], "evidenceReviewIds": []}
    return {"minutes": policy["dwellDefaultMinutes"].get(place_type, policy["dwellDefaultMinutes"]["default"]),
            "basis": "provisional_type_default", "sourceRefs": [], "evidenceReviewIds": []}


def _proposal_structure(proposal):
    if not isinstance(proposal, dict) or set(proposal) != {"stops", "mealSlots", "unscheduledPlaces"}:
        return False
    shapes = {"stops": {"placeId", "arrival", "departure", "evidenceReviewIds"},
              "mealSlots": {"kind", "start", "end"}, "unscheduledPlaces": {"placeId", "reason"}}
    for key, fields in shapes.items():
        if not isinstance(proposal[key], list) or len(proposal[key]) > 12:
            return False
        for item in proposal[key]:
            if not isinstance(item, dict) or set(item) != fields:
                return False
            for field in fields - {"evidenceReviewIds"}:
                if not isinstance(item[field], str) or len(item[field]) > 300:
                    return False
            if key == "stops" and (not isinstance(item["evidenceReviewIds"], list) or len(item["evidenceReviewIds"]) > 20 or any(not isinstance(i, str) for i in item["evidenceReviewIds"])):
                return False
    return True


def meal_requirements(day, preferences):
    """Resolve meals against activity bounds without dropping a conflicting meal."""
    day_start, day_end = bounds(day)
    requirements, errors = [], []
    for kind in ("lunch", "dinner"):
        pref = preferences[kind]
        mode = day.get("mealModes", {}).get(kind, "auto")
        opened = local_time(day["date"], pref["windowStart"])
        closed = local_time(day["date"], pref["windowEnd"])
        overlaps = max(opened, day_start) < min(closed, day_end)
        status = "excluded" if mode == "excluded" else "outside_activity" if mode == "auto" and not overlaps else "required"
        label = "점심" if kind == "lunch" else "저녁"
        requirement = {"kind": kind, "mode": mode, "status": status,
                       "windowStart": iso(opened), "windowEnd": iso(closed),
                       "durationMinutes": pref["durationMinutes"],
                       "message": f"{label}: " + {"excluded": "사용자가 일정에서 제외했습니다.", "outside_activity": "활동 시간 밖이라 포함하지 않았습니다.", "required": "일정에 포함합니다."}[status]}
        requirements.append(requirement)
        if status == "required":
            earliest = max(opened, day_start)
            latest_end = min(closed, day_end - timedelta(minutes=preferences["maxDetourMinutes"]))
            if earliest + timedelta(minutes=pref["durationMinutes"]) > latest_end:
                errors.append({**issue("meal_activity_conflict", f"{label} 시간과 활동 범위가 맞지 않습니다. 식사 조건·활동 시간을 바꾸거나 해당 식사를 제외해 주세요."), "kind": kind})
    return requirements, errors


def validate_day(day, proposal, places, route_fn, meal_preferences, policy, now=None):
    """Validate a proposal with server facts; route_fn uses actual proposed departures.

    Meals occupy a gap and reserve their detour budget separately. The baseline A→B
    leg can occur before or after a reserved meal, never concurrently with it.
    """
    result = {"dayIndex": day["dayIndex"], "date": day["date"], "status": "generation_failed", "stops": [],
              "legs": [], "mealSlots": [], "unscheduledPlaces": [], "violations": [], "unknowns": [], "assumptions": [],
              "restaurantIntegrationStatus": "pending", "routeObservations": []}
    errors, unknowns = result["violations"], result["unknowns"]
    result["mealRequirements"], meal_errors = meal_requirements(day, meal_preferences)
    def reject():
        old_reasons = {item["placeId"]: item for item in result["unscheduledPlaces"]}
        result["unscheduledPlaces"] = [old_reasons.get(pid, {
            "placeId": pid, "reason": "validation_failed", "required": pid in day["requiredPlaceIds"] or pid == day.get("anchorPlaceId")
        }) for pid in day["placeIds"]]
        # Rejected proposals are only sent to the bounded repair call, not presented as a timetable.
        result["stops"], result["legs"], result["mealSlots"] = [], [], []
        return result
    if meal_errors:
        errors.extend(meal_errors)
        result["status"] = "needs_input"
        return reject()
    if not _proposal_structure(proposal):
        errors.append(issue("invalid_schema", "LLM의 시간표 형식이 올바르지 않습니다."))
        result["unscheduledPlaces"] = [{"placeId": pid, "reason": "invalid_schema", "required": pid in day["requiredPlaceIds"] or pid == day.get("anchorPlaceId")} for pid in day["placeIds"]]
        return reject()
    allowed = set(day["placeIds"])
    mandatory = set(day["requiredPlaceIds"]) | ({day["anchorPlaceId"]} if day.get("anchorPlaceId") else set())
    seen, stop_times = set(), []
    day_start, day_end = bounds(day)
    buffer = timedelta(minutes=policy["visitBufferMinutes"])
    for item in proposal["stops"]:
        pid = item["placeId"]
        if pid not in allowed:
            errors.append(issue("unauthorized_place", "일자 후보에 없는 장소가 추가되었습니다.", pid))
            continue
        if pid in seen:
            errors.append(issue("duplicate_place", "장소가 중복되었습니다.", pid))
            continue
        seen.add(pid)
        try:
            arrival, departure = local_time(day["date"], item["arrival"]), local_time(day["date"], item["departure"])
        except (TypeError, ValueError):
            errors.append(issue("invalid_time", "방문 시각 형식이 올바르지 않습니다.", pid))
            continue
        if arrival < day_start or departure + buffer > day_end or departure <= arrival:
            errors.append(issue("day_boundary", "방문·여유시간이 하루 활동 범위를 벗어납니다.", pid))
        if stop_times and arrival < stop_times[-1][2] + buffer:
            errors.append(issue("time_overlap", "방문 순서 또는 방문당 여유시간이 겹칩니다.", pid))
        place = places[pid]
        duration = choose_duration(place, day["date"], policy, now)
        if duration["minutes"] is None:
            unknowns.append(issue("dwell_unknown", "등산·회차·숙박 등 별도 체류시간 확인이 필요합니다.", pid))
        elif (departure - arrival).total_seconds() < duration["minutes"] * 60:
            errors.append(issue("insufficient_dwell", "근거에 따른 체류시간보다 짧습니다.", pid))
        if duration["basis"] == "provisional_type_default":
            result["assumptions"].append(issue("provisional_dwell", f"유형별 임시 체류시간 {duration['minutes']}분을 사용했습니다.", pid))
            unknowns.append(issue("dwell_provisional", "임시 체류시간을 현장 정보로 확인해야 합니다.", pid))
        valid_evidence = set((place.get("visitInsights") or {}).get("evidenceReviewIds") or [])
        if not set(item["evidenceReviewIds"]) <= valid_evidence:
            errors.append(issue("fabricated_evidence", "저장된 분석에 없는 리뷰 근거입니다.", pid))
        # A travel day can end after midnight. Validate the actual calendar dates
        # touched by a visit so tomorrow's explicit closure overrides yesterday's
        # overnight interval. A midnight boundary does not require re-admission.
        unknown = None
        visit_dates = sorted({arrival.date(), (departure - timedelta(microseconds=1)).date()})
        for visit_date in visit_dates:
            midnight = local_time(visit_date.isoformat(), "00:00")
            segment_start = max(arrival, midnight)
            segment_end = min(departure, midnight + timedelta(days=1))
            if segment_end <= segment_start:
                continue
            windows, segment_unknown = operating_windows(place, visit_date.isoformat(), policy, now)
            if segment_unknown:
                unknown = segment_unknown
                unknowns.append(segment_unknown)
                continue
            covering = [(opened, closed, cutoff) for opened, closed, cutoff in windows
                        if segment_start >= opened and segment_end <= closed]
            if not covering:
                errors.append(issue("closed_or_outside_hours", "휴무·휴게 또는 운영 종료 시각을 위반합니다.", pid))
            elif segment_start == arrival and not any(cutoff is None or arrival <= cutoff for _, _, cutoff in covering):
                errors.append(issue("last_admission", "입장 마감 시각을 지났습니다.", pid))
        stop_times.append((pid, arrival, departure))
        result["stops"].append({"placeId": pid, "title": place.get("title", pid), "order": len(stop_times),
            "arrival": iso(arrival), "departure": iso(departure), "dwellMinutes": (departure - arrival).total_seconds() / 60,
            "minimumDwellMinutes": duration["minutes"], "dwellBasis": duration["basis"], "dwellEvidence": duration,
            "bufferMinutes": policy["visitBufferMinutes"], "operatingStatus": "verification_required" if unknown else "checked",
            "operatingSourceRefs": (place.get("operatingInfo") or {}).get("sourceRefs", []),
            "operatingCheckedAt": (place.get("operatingInfo") or {}).get("checkedAt"),
            "evidenceReviewIds": item["evidenceReviewIds"], "visitInsights": place.get("visitInsights") or {"status": "unknown"},
            "solarTimes": solar_times(arrival.date().isoformat(), place["lng"], place["lat"])})
    reasons = {}
    for item in proposal["unscheduledPlaces"]:
        pid = item["placeId"]
        if pid not in allowed or pid in seen or pid in reasons or not item["reason"].strip():
            errors.append(issue("invalid_unscheduled", "미배정 장소 또는 사유가 올바르지 않습니다.", pid))
        reasons[pid] = item["reason"]
    for pid in day["placeIds"]:
        if pid not in seen:
            result["unscheduledPlaces"].append({"placeId": pid, "reason": reasons.get(pid, "LLM이 미배정 이유를 제공하지 않았습니다."), "reasonBasis": "model_proposal", "required": pid in mandatory})
            if pid in mandatory:
                errors.append(issue("required_place_missing", "필수 장소 또는 anchor가 누락되었습니다.", pid))
            elif pid not in reasons:
                errors.append(issue("unscheduled_reason_missing", "선택 장소의 미배정 이유가 필요합니다.", pid))
    types = [places[pid].get("primaryType") for pid in seen]
    if len(set(types)) != len(types):
        errors.append(issue("daily_type_limit", "하루 대표 유형당 1곳 제한을 위반합니다."))
    required_meals = {item["kind"] for item in result["mealRequirements"] if item["status"] == "required"}
    meal_times, meal_kinds = [], set()
    for item in proposal["mealSlots"]:
        kind = item["kind"]
        if kind not in required_meals or kind in meal_kinds:
            errors.append(issue("invalid_meal", "포함하기로 한 식사만 각각 한 번 배정해야 합니다."))
            continue
        meal_kinds.add(kind)
        pref = meal_preferences[kind]
        try:
            start, end = local_time(day["date"], item["start"]), local_time(day["date"], item["end"])
            win_start, win_end = local_time(day["date"], pref["windowStart"]), local_time(day["date"], pref["windowEnd"])
        except (ValueError, TypeError):
            errors.append(issue("invalid_meal_time", "식사 시각 형식이 올바르지 않습니다."))
            continue
        if start < win_start or end > win_end or end <= start or (end - start).total_seconds() < pref["durationMinutes"] * 60:
            errors.append(issue("meal_window", "식사 시간대 또는 식사 소요시간을 위반합니다."))
        reserved_end = end + timedelta(minutes=meal_preferences["maxDetourMinutes"])
        if start < day_start or reserved_end > day_end:
            errors.append(issue("meal_day_boundary", "식사와 우회 여유가 하루 활동 범위를 벗어납니다."))
        if any(start < dep + buffer and reserved_end > arr for _, arr, dep in stop_times):
            errors.append(issue("meal_overlap", "식사·우회 여유와 방문 시간이 겹칩니다."))
        meal_times.append((kind, start, end, reserved_end))
    if meal_kinds != required_meals:
        errors.append(issue("missing_meal", "활동 시간에 포함하기로 한 식사 자리를 확보해야 합니다."))
    meal_times.sort(key=lambda item: item[1])
    if any(current[1] < previous[3] for previous, current in zip(meal_times, meal_times[1:])):
        errors.append(issue("meal_overlap", "식사·우회 여유가 서로 겹칩니다."))
    # Identity/structural errors must never cause route calls to arbitrary locations.
    fatal = {"unauthorized_place", "duplicate_place", "invalid_time", "invalid_meal_time", "time_overlap", "day_boundary", "meal_overlap", "meal_day_boundary"}
    if any(error["code"] in fatal for error in errors):
        return reject()
    points = [(day["startLocation"]["placeId"], day_start, day_start)] + stop_times + [(day["endLocation"]["placeId"], day_end, day_end)]
    attached_meals = set()
    for index, (previous, following) in enumerate(zip(points, points[1:])):
        from_id, _, prev_departure = previous
        to_id, next_arrival, _ = following
        gap_start = prev_departure + (buffer if index else timedelta())
        in_gap = [meal for meal in meal_times if gap_start <= meal[1] and meal[3] <= next_arrival]
        departure = gap_start
        # At most three actual-departure lookups: initial + after lunch + after dinner.
        for _ in range(len(in_gap) + 1):
            route = route_fn(from_id, to_id, departure)
            seconds = route.get("durationSeconds")
            if not isinstance(seconds, (int, float)) or isinstance(seconds, bool) or not math.isfinite(seconds) or seconds < 0:
                raise ValueError("invalid_route_duration")
            travel_minutes = math.ceil(seconds / 60)
            route_arrival = departure + timedelta(minutes=travel_minutes)
            overlap = next((meal for meal in in_gap if departure < meal[3] and route_arrival > meal[1]), None)
            if overlap is None:
                break
            departure = overlap[3]
        observation = {key: route.get(key) for key in ("provider", "queriedAt", "predictionBasis", "routeRef")}
        observation.update(fromId=from_id, toId=to_id, departureTime=iso(departure),
                           durationSeconds=seconds, durationMinutes=travel_minutes, arrivalTime=iso(route_arrival),
                           nextArrival=iso(next_arrival), availableMinutes=(next_arrival - departure).total_seconds() / 60,
                           shortageMinutes=max(0, (route_arrival - next_arrival).total_seconds() / 60))
        result["routeObservations"].append(observation)
        if route_arrival > next_arrival:
            errors.append({**issue("insufficient_travel", "제공자의 이동시간과 방문·식사·우회 여유를 확보할 수 없습니다.", to_id), **observation})
        leg = {**route, "fromId": from_id, "toId": to_id, "departureTime": iso(departure),
               "arrivalTime": iso(route_arrival), "durationMinutes": travel_minutes,
               "availableMinutes": (next_arrival - gap_start).total_seconds() / 60}
        result["legs"].append(leg)
        if route.get("predictionBasis") in ("current_traffic", "current_snapshot", "unknown", None):
            unknowns.append(issue("route_forecast_unknown", "해당 출발일·시각의 교통 예측이 아닌 조회 시점 추정입니다."))
        for kind, start, end, reserved_end in in_gap:
            attached_meals.add(kind)
            def location(pid):
                return {key: places[pid][key] for key in ("placeId", "title", "lng", "lat")}
            result["mealSlots"].append({"slotId": f"{day['date']}-{kind}", "kind": kind,
                "start": iso(start), "end": iso(end), "durationMinutes": (end - start).total_seconds() / 60,
                "windowStart": meal_preferences[kind]["windowStart"], "windowEnd": meal_preferences[kind]["windowEnd"],
                "beforeLocation": location(from_id), "afterLocation": location(to_id),
                "routeRef": route.get("routeRef"), "baselineRoute": leg,
                "maxDetourMinutes": meal_preferences["maxDetourMinutes"], "detourReserveEnd": iso(reserved_end),
                "gapStart": iso(gap_start), "nextArrival": iso(next_arrival),
                "restaurantStatus": "pending", "requiresRevalidation": True})
    if attached_meals != meal_kinds:
        errors.append(issue("meal_gap_missing", "식사와 우회 여유를 연결할 앞뒤 이동 구간이 없습니다."))
    if errors:
        return reject()
    result["status"] = "partially_scheduled" if result["unscheduledPlaces"] else "verification_required" if unknowns else "validated"
    return result


def validate_restaurant_insertion(slot, first_leg_seconds, second_leg_seconds, arrival, departure, next_arrival):
    """Follow-up contract checker, not a restaurant search/insert implementation.

    Caller must separately validate restaurant opening/order cutoff and revalidate
    all following itinerary legs at their changed departure times.
    """
    errors = []
    baseline = slot["baselineRoute"]["durationSeconds"]
    if any(not isinstance(n, (int, float)) or isinstance(n, bool) or not math.isfinite(n) or n < 0 for n in (first_leg_seconds, second_leg_seconds)):
        return [issue("restaurant_route_unknown", "식당 앞뒤 이동시간이 필요합니다.")]
    if first_leg_seconds + second_leg_seconds - baseline > slot["maxDetourMinutes"] * 60:
        errors.append(issue("restaurant_detour", "식당 경유의 추가 이동시간이 허용 우회를 초과합니다."))
    start, end, following = (datetime.fromisoformat(value) for value in (arrival, departure, next_arrival))
    if start < datetime.fromisoformat(slot["start"]) or end > datetime.fromisoformat(slot["end"]) or (end - start).total_seconds() < slot["durationMinutes"] * 60:
        errors.append(issue("restaurant_meal_window", "식당 체류가 확보한 식사 시간과 맞지 않습니다."))
    if end + timedelta(minutes=math.ceil(second_leg_seconds / 60)) > following:
        errors.append(issue("restaurant_next_arrival", "식당 이후 이동으로 다음 방문 시각을 지킬 수 없습니다."))
    baseline_departure = datetime.fromisoformat(slot["gapStart"])
    if baseline_departure + timedelta(minutes=math.ceil(first_leg_seconds / 60)) > start:
        errors.append(issue("restaurant_arrival", "식당까지 이동할 시간이 부족합니다."))
    return errors
