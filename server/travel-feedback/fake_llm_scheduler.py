"""Deterministic offline stand-in for the LLM (tests and offline evaluation only).

It is NOT a production planner and is not shipped in the Docker image. It answers the
two structured tasks the server sends:

* ``itinerary``: greedy nearest-neighbour order from the server's route matrix, dwell
  minimums, visit buffer, required meals and detour reserve (mirrors validator rules).
* ``restaurant_fit``: rating/review-count heuristic citing the first supplied review ref.

``OpenAIResponsesStub`` / ``GeminiGenerateStub`` emulate the OpenAI Responses API and the Gemini
``generateContent`` API so the real adapters (model check, structured-output validation, task
instructions) can be exercised without a key.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta


def _clock(value):
    return value.strftime("%H:%M")


def _at(day, hhmm):
    return datetime.fromisoformat(f"{day}T{hhmm}:00+09:00")


def schedule_day(prompt):
    day = prompt["day"]
    date = day["date"]
    start, end = _at(date, day["startTime"]), _at(date, day["endTime"])
    if end <= start:
        end += timedelta(days=1)
    buffer = timedelta(minutes=prompt.get("visitBufferMinutes", 10))
    prefs = prompt["mealPreferences"]
    detour = timedelta(minutes=prefs["maxDetourMinutes"])
    matrix = {(row["fromId"], row["toId"]): row["durationMinutes"] for row in prompt.get("routeMatrix", [])}

    def travel(a, b):
        return timedelta(minutes=0 if a == b else matrix.get((a, b), 30))

    pending = [item["kind"] for item in prompt.get("mealRequirements", []) if item["status"] == "required"]
    windows = {kind: (_at(date, prefs[kind]["windowStart"]), _at(date, prefs[kind]["windowEnd"]),
                      timedelta(minutes=prefs[kind]["durationMinutes"])) for kind in ("lunch", "dinner")}
    places = {item["placeId"]: item for item in prompt["places"]}
    remaining = [item["placeId"] for item in sorted(prompt["places"], key=lambda item: item["priority"])]
    current, ready = day["startLocation"]["placeId"], start
    stops, meals, unscheduled = [], [], []

    def maybe_meal(gap_start, next_travel, next_need):
        """Place a pending meal in this gap if it is (or is about to be) meal time."""
        for kind in list(pending):
            w_start, w_end, duration = windows[kind]
            meal_start = max(gap_start, w_start)
            if meal_start + duration > w_end:
                continue
            due = gap_start >= w_start - timedelta(minutes=30) or gap_start + next_travel + next_need > w_end - duration
            if due:
                pending.remove(kind)
                meals.append({"kind": kind, "start": _clock(meal_start), "end": _clock(meal_start + duration)})
                return meal_start + duration + detour
        return gap_start

    while remaining:
        pid = min(remaining, key=lambda candidate: (not places[candidate]["required"] and not places[candidate]["anchor"],
                                                    travel(current, candidate), places[candidate]["priority"]))
        dwell = timedelta(minutes=(places[pid]["dwell"] or {}).get("minutes") or 120)
        gap_start = maybe_meal(ready, travel(current, pid), dwell + buffer)
        arrival = gap_start + travel(current, pid)
        departure = arrival + dwell
        home = travel(pid, day["endLocation"]["placeId"])
        # Keep room for meals still to be placed (duration + detour reserve) before the day ends.
        later_meals = sum((windows[kind][2] + detour for kind in pending if windows[kind][0] < end), timedelta())
        if departure + buffer + later_meals + home > end and not (places[pid]["required"] or places[pid]["anchor"]):
            remaining.remove(pid)
            unscheduled.append({"placeId": pid, "reason": "하루 종료 시각 안에 방문·이동 시간을 확보할 수 없습니다."})
            ready = gap_start if gap_start != ready else ready
            continue
        stops.append({"placeId": pid, "arrival": _clock(arrival), "departure": _clock(departure), "evidenceReviewIds": []})
        remaining.remove(pid)
        current, ready = pid, departure + buffer
    while pending:
        before = len(pending)
        ready = maybe_meal(ready, travel(current, day["endLocation"]["placeId"]), timedelta(days=1))
        if len(pending) == before:
            break
    return {"stops": stops, "mealSlots": meals, "unscheduledPlaces": unscheduled}


def judge_restaurants(prompt):
    judgements = []
    for slot in prompt["slots"]:
        for candidate in slot["candidates"]:
            reviews = candidate.get("reviews") or []
            rating = candidate.get("averageRating") or 0
            if not reviews:
                verdict, refs, quality, reason = "insufficient_evidence", [], "unknown", "리뷰가 없어 판단 근거가 부족합니다."
            elif rating >= 4.3:
                verdict, refs, quality, reason = "recommended", [reviews[0]["ref"]], "good", "리뷰 평이 좋은 편입니다."
            else:
                verdict, refs, quality, reason = "acceptable", [reviews[0]["ref"]], "neutral", "무난한 평가입니다."
            judgements.append({"slotId": slot["slotId"], "restaurantId": candidate["restaurantId"], "verdict": verdict,
                               "companionFit": "unknown", "mealTimeFit": "good" if reviews else "unknown", "quality": quality,
                               "diversity": "good" if not candidate.get("alreadyChosenSameCategory") else "poor",
                               "reason": reason, "evidenceReviewRefs": refs})
    return {"judgements": judgements}


def answer(task, prompt):
    if task == "itinerary" or "routeMatrix" in prompt:
        return schedule_day(prompt)
    if task == "restaurant_fit" or "slots" in prompt:
        return judge_restaurants(prompt)
    raise ValueError("unknown_task")


class FakeScheduler:
    """Drop-in for ``OpenAIClient`` with the same ``generate_structured`` signature."""
    model = "offline-fake-scheduler"
    prompt_version = "offline-fake-v1"

    def __init__(self, restaurant_failure=None):
        self.calls = []
        self.restaurant_failure = restaurant_failure

    def generate_structured(self, task, input, schema, timeout=30):
        self.calls.append(task)
        if task == "restaurant_fit" and self.restaurant_failure:
            raise self.restaurant_failure
        return answer(task, input)


class OpenAIResponsesStub:
    """Replacement for ``OpenAIClient._request`` returning Responses-API shaped JSON."""

    def __init__(self):
        self.requests = []

    def __call__(self, client, suffix, data, timeout):
        self.requests.append((suffix, data))
        if data is None:
            return {"id": client.model}
        prompt = json.loads(data["input"])
        task = "restaurant_fit" if "slots" in prompt else "itinerary"
        text = json.dumps(answer(task, prompt), ensure_ascii=False)
        return {"status": "completed", "output": [{"content": [{"type": "output_text", "text": text}]}],
                "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2}}


class GeminiGenerateStub:
    """Replacement for ``GeminiClient._request`` returning generateContent-shaped JSON."""

    def __init__(self):
        self.requests = []

    def __call__(self, client, suffix, data, timeout):
        self.requests.append((suffix, data))
        if data is None:
            return {"name": "models/" + client.model, "supportedGenerationMethods": ["generateContent", "countTokens"]}
        prompt = json.loads(data["contents"][0]["parts"][0]["text"])
        task = "restaurant_fit" if "slots" in prompt else "itinerary"
        text = json.dumps(answer(task, prompt), ensure_ascii=False)
        return {"candidates": [{"content": {"role": "model", "parts": [{"text": "stub reasoning", "thought": True}, {"text": text}]},
                                "finishReason": "STOP"}],
                "usageMetadata": {"promptTokenCount": 3, "candidatesTokenCount": 2, "thoughtsTokenCount": 1, "totalTokenCount": 6}}
