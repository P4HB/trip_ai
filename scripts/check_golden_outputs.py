#!/usr/bin/env python3
"""SPEC-113 REQ-002: deterministic golden outputs for server itinerary generation and feedback validation.

Uses the same offline stack as ``scripts/evaluate_restaurant_candidates.py`` (real itinerary catalog,
real restaurant meal sidecar, ``EstimatedRouteProvider`` and the ``FakeScheduler`` LLM stand-in).
Clock reads are pinned so the output depends only on code and data.

    python -X utf8 scripts/check_golden_outputs.py [--update]
"""
from __future__ import annotations

import argparse
import contextlib
from contextlib import closing
import copy
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
import socket
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server/travel-feedback"
GOLDEN_PATH = ROOT / "scripts/fixtures/golden/py_outputs.json"
SCHEMA_VERSION = "trip-ai-golden-py-v1"
sys.path.insert(0, str(SERVER))
import feedback_api  # noqa: E402
import itinerary_validation  # noqa: E402
from fake_llm_scheduler import FakeScheduler  # noqa: E402
from itinerary_service import ItineraryService, load_policy  # noqa: E402
from restaurant_catalog import RestaurantCatalog  # noqa: E402
from route_provider import EstimatedRouteProvider  # noqa: E402

# Frozen copy of the SPEC-107 evaluation scenarios (public TourAPI IDs from data/itinerary_catalog.json).
SCENARIOS = [
    {"id": "west-coast", "places": ["127490", "126455", "2660802", "741109"], "start": "228853", "end": "228853", "time": ("09:00", "20:30")},
    {"id": "east-coast", "places": ["127813", "126472", "126471", "992261"], "start": "126451", "end": "126451", "time": ("09:00", "20:30")},
    {"id": "mid-mountain", "places": ["126474", "1146121", "1544730", "127479"], "start": "1013246", "end": "1013246", "time": ("09:00", "20:30")},
    {"id": "south-coast", "places": ["126438", "126470", "127492", "1798082"], "start": "2627229", "end": "2627229", "time": ("09:00", "20:30")},
    {"id": "southwest-mid", "places": ["572973", "2714241", "741109", "126440"], "start": "2561880", "end": "2561880", "time": ("09:00", "20:30")},
    {"id": "dinner-only-north", "places": ["127046", "1918639", "992261"], "start": "126451", "end": "126451", "time": ("14:00", "21:00")},
    {"id": "lunch-only-city", "places": ["228853", "1013246", "2738665"], "start": "126448", "end": "126448", "time": ("08:30", "14:30")},
]
DATES = ["2026-10-20", "2026-10-23", "2026-10-24", "2026-10-25"]  # Tue, Fri, Sat, Sun
DETOURS = (20, 10, 5)
# Before every scenario date, so freshness is judged against the travel day itself.
FIXED_NOW = datetime(2026, 10, 19, 9, 0, tzinfo=itinerary_validation.KST)


def canonical_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def capture(fn):
    try:
        return {"value": fn()}
    except Exception as exc:  # golden records the failure contract, including the exception type
        return {"error": f"{type(exc).__name__}: {exc}"}


def pin_clock():
    original = itinerary_validation.fresh

    def fresh(record, day, policy, now=None):
        return original(record, day, policy, now or FIXED_NOW)

    itinerary_validation.fresh = fresh
    return lambda: setattr(itinerary_validation, "fresh", original)


def itinerary_request(scenario, date, detour):
    return {"schemaVersion": "itinerary-request-v2", "requestId": f"{scenario['id']}.{date}", "recommendationRevision": "offline",
            "courseVariantId": "offline", "travelWindow": {"startDate": date, "endDate": date}, "routeMode": "car",
            "generationScope": "day", "mealPreferences": {"maxDetourMinutes": detour},
            "travelerContext": {"companionType": "friends", "preferenceSignals": [{"feature": "local_embeddedness", "direction": "benefit"}]},
            "days": [{"dayIndex": 1, "date": date, "placeIds": scenario["places"], "requiredPlaceIds": [],
                      "anchorPlaceId": scenario["places"][0], "startLocation": {"placeId": scenario["start"]},
                      "endLocation": {"placeId": scenario["end"]}, "startTime": scenario["time"][0], "endTime": scenario["time"][1]}]}


def summarize_day(day):
    return {"status": day["status"],
            "stops": [stop.get("placeId") for stop in day.get("stops", [])],
            "violations": [item.get("code") for item in day.get("violations", [])],
            "meals": [{"kind": slot["kind"], "start": slot.get("start"), "status": slot.get("restaurantStatus"),
                       "candidates": [item["restaurantId"] for item in slot.get("restaurantCandidates") or []]}
                      for slot in day.get("mealSlots", [])]}


def itinerary_outputs(service):
    generated = {}
    for detour in DETOURS:
        for scenario in SCENARIOS:
            for date in DATES:
                run = capture(lambda: service.generate(itinerary_request(scenario, date, detour)))
                key = f"{scenario['id']}.{date}.detour-{detour}"
                if "error" in run:
                    generated[key] = {"error": run["error"]}
                    continue
                result = run["value"]
                generated[key] = {"sha256": digest(result), "status": result["status"],
                                  "days": [summarize_day(day) for day in result["days"]]}
    return generated


def invalid_itinerary_outputs(service):
    base = itinerary_request(SCENARIOS[0], DATES[0], 20)

    def mutate(edit):
        payload = copy.deepcopy(base)
        edit(payload)
        return payload

    day = lambda payload: payload["days"][0]  # noqa: E731
    cases = {
        "not-object": [],
        "schema": mutate(lambda p: p.update(schemaVersion="itinerary-request-v9")),
        "duration-only": mutate(lambda p: p.update(travelWindow=None)),
        "timezone": mutate(lambda p: p.update(timezone="UTC")),
        "route-mode": mutate(lambda p: p.update(routeMode="transit")),
        "bad-date": mutate(lambda p: p["travelWindow"].update(startDate="2026-02-30")),
        "day-date-mismatch": mutate(lambda p: day(p).update(date="2026-10-21")),
        "duplicate-place": mutate(lambda p: day(p).update(placeIds=["127490", "127490"])),
        "too-many-places": mutate(lambda p: day(p).update(placeIds=[*SCENARIOS[0]["places"], *SCENARIOS[1]["places"]])),
        "excluded-place": mutate(lambda p: p.update(excludedPlaceIds=["126455"])),
        "anchor-outside": mutate(lambda p: day(p).update(anchorPlaceId="127813")),
        "required-outside": mutate(lambda p: day(p).update(requiredPlaceIds=["127813"])),
        "start-location": mutate(lambda p: day(p).update(startLocation={"placeId": "not-a-place"})),
        "same-start-end-time": mutate(lambda p: day(p).update(startTime="10:00", endTime="10:00")),
        "bad-clock": mutate(lambda p: day(p).update(startTime="9:00")),
        "meal-mode": mutate(lambda p: day(p).update(mealModes={"lunch": "sometimes"})),
        "meal-duration": mutate(lambda p: p["mealPreferences"].update(lunch={"windowStart": "11:30", "windowEnd": "14:00", "durationMinutes": 10})),
        "meal-window": mutate(lambda p: p["mealPreferences"].update(dinner={"windowStart": "18:00", "windowEnd": "18:30", "durationMinutes": 60})),
        "detour": mutate(lambda p: p["mealPreferences"].update(maxDetourMinutes=61)),
        "two-days-day-scope": mutate(lambda p: p["days"].append({**copy.deepcopy(day(p)), "dayIndex": 2})),
        "request-id": mutate(lambda p: p.update(requestId="")),
    }
    return {name: capture(lambda payload=payload: service.generate(payload)).get("error", "accepted") for name, payload in cases.items()}


def v2_payload():
    return {"schema_version": feedback_api.V2_SCHEMA_VERSION, "submission_id": "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f",
            "created_at": "2026-08-28T00:00:00.000Z",
            "storage": {"method": "server_api", "endpoint": feedback_api.API_PATH, "server_transmitted": True, "web_storage_used": False},
            "source": {"ui_version": "map-ui-feedback-server-v2", "algorithm_version": "golden"},
            "user_selections": {"request": {}}, "recommendation_result": {"items": []},
            "feedback": {"required_place_count": 1, "completed_place_count": 1, "all_scores_completed": True,
                         "entries": [{"place_id": "123", "title": "테스트 장소", "contexts": [{"kind": "recommendation", "rank": 1}],
                                      "score": 5, "score_label": "꼭 가고 싶어요", "comment": "좋아요"}]}}


def v3_payload():
    return {"schema_version": feedback_api.V3_SCHEMA_VERSION, "participant_name": "테스터01",
            "session_id": "0b8f2a6e-1c3d-4e5f-9a7b-6c5d4e3f2a1b", "revision": 2,
            "created_at": "2026-08-30T00:00:00.000Z", "updated_at": "2026-08-30T00:00:02.000Z",
            "storage": {"method": "server_autosave", "endpoint": feedback_api.API_PATH, "server_transmitted": True, "web_storage_used": False},
            "source": {"ui_version": "map-ui-feedback-autosave-v3", "algorithm_version": "golden"},
            "user_selections": {"request": {}}, "recommendation_result": {"items": []},
            "feedback": {"required_place_count": 2, "completed_place_count": 1, "all_scores_completed": False,
                         "entries": [{"place_id": "123", "title": "첫 장소", "contexts": [{"kind": "recommendation", "rank": 1}],
                                      "score": 5, "score_label": "꼭 가고 싶어요", "comment": ""},
                                     {"place_id": "456", "title": "둘째 장소", "contexts": [{"kind": "recommendation", "rank": 2}],
                                      "score": None, "score_label": None, "comment": ""}]}}


def feedback_outputs():
    def edit(factory, change):
        payload = factory()
        change(payload)
        return payload

    entry = lambda payload, index=0: payload["feedback"]["entries"][index]  # noqa: E731
    cases = {
        "v2.valid": v2_payload(),
        "v2.uppercase-id": edit(v2_payload, lambda p: p.update(submission_id=p["submission_id"].upper())),
        "v2.bad-id": edit(v2_payload, lambda p: p.update(submission_id="not-a-uuid")),
        "v2.naive-time": edit(v2_payload, lambda p: p.update(created_at="2026-08-28T00:00:00")),
        "v2.storage": edit(v2_payload, lambda p: p["storage"].update(method="server_autosave")),
        "v2.incomplete": edit(v2_payload, lambda p: p["feedback"].update(completed_place_count=0)),
        "v2.score-null": edit(v2_payload, lambda p: entry(p).update(score=None)),
        "v2.long-comment": edit(v2_payload, lambda p: entry(p).update(comment="가" * 301)),
        "v3.valid": v3_payload(),
        "v3.no-participant": edit(v3_payload, lambda p: p.update(participant_name=None)),
        "v3.participant-space": edit(v3_payload, lambda p: p.update(participant_name=" 테스터")),
        "v3.participant-control": edit(v3_payload, lambda p: p.update(participant_name="테스터\u0007")),
        "v3.participant-long": edit(v3_payload, lambda p: p.update(participant_name="가" * 31)),
        "v3.session-id": edit(v3_payload, lambda p: p.update(session_id="0B8F2A6E-1C3D-4E5F-9A7B-6C5D4E3F2A1B")),
        "v3.revision-zero": edit(v3_payload, lambda p: p.update(revision=0)),
        "v3.revision-bool": edit(v3_payload, lambda p: p.update(revision=True)),
        "v3.updated-at": edit(v3_payload, lambda p: p.update(updated_at="yesterday")),
        "v3.storage-flags": edit(v3_payload, lambda p: p["storage"].update(web_storage_used=True)),
        "v3.endpoint": edit(v3_payload, lambda p: p["storage"].update(endpoint="/api/feedback")),
        "v3.no-entries": edit(v3_payload, lambda p: p["feedback"].update(entries=[], required_place_count=0, completed_place_count=0)),
        "v3.count-mismatch": edit(v3_payload, lambda p: p["feedback"].update(required_place_count=3)),
        "v3.duplicate-place": edit(v3_payload, lambda p: entry(p, 1).update(place_id="123")),
        "v3.score-range": edit(v3_payload, lambda p: entry(p).update(score=6)),
        "v3.score-label-null": edit(v3_payload, lambda p: entry(p, 1).update(score_label="없음")),
        "v3.metadata": edit(v3_payload, lambda p: entry(p).update(contexts="recommendation")),
        "v3.completion-flag": edit(v3_payload, lambda p: p["feedback"].update(all_scores_completed=True)),
        "v3.source": edit(v3_payload, lambda p: p.pop("source")),
        "v3.recommendation-result": edit(v3_payload, lambda p: p.update(recommendation_result=[])),
        "unknown-schema": edit(v3_payload, lambda p: p.update(schema_version="travel-recommendation-feedback-log-v9")),
        "not-object": [],
    }
    outputs = {}
    for name, payload in cases.items():
        run = capture(lambda payload=payload: feedback_api.validate_payload(payload))
        outputs[name] = {"error": run["error"]} if "error" in run else {"sha256": digest(run["value"])}
    return outputs


# --- HTTP boundary (AC-006) ---------------------------------------------------------------------

ORIGIN = "https://travel.example"
FIXED_UTC = datetime(2026, 10, 19, 0, 0, tzinfo=timezone.utc)
RECORDED_HEADERS = ("content-type", "content-length", "cache-control", "x-content-type-options")


def raw_http(address, method, path, headers=(), body=b""):
    """One request on its own connection; raw bytes so malformed framing can be expressed."""
    lines = [f"{method} {path} HTTP/1.1", "Host: golden.test", "Connection: close", *(f"{name}: {value}" for name, value in headers)]
    with socket.create_connection(address, timeout=15) as connection:
        connection.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("latin-1") + body)
        chunks = []
        while chunk := connection.recv(65536):
            chunks.append(chunk)
    head, _, payload = b"".join(chunks).partition(b"\r\n\r\n")
    status_line, *header_lines = head.decode("iso-8859-1").split("\r\n")
    response_headers = {name.strip().lower(): value.strip() for name, value in (line.split(":", 1) for line in header_lines)}
    record = {"status": int(status_line.split()[1]), "headers": {name: response_headers[name] for name in RECORDED_HEADERS if name in response_headers}}
    if response_headers.get("content-type", "").startswith("application/json"):
        body_json = json.loads(payload)
        record["body"] = {"sha256": digest(body_json), "status": body_json.get("status"), "requestId": body_json.get("requestId")} \
            if len(payload) > 4096 else body_json
    else:
        record["bodySha256"] = hashlib.sha256(payload).hexdigest()
    return record


def json_body(value):
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


def post(address, path, payload=None, *, origin=ORIGIN, content_type="application/json", body=None, extra=()):
    data = json_body(payload) if body is None else body
    headers = [("Origin", origin)] if origin else []
    if content_type:
        headers.append(("Content-Type", content_type))
    headers.append(("Content-Length", str(len(data))))
    return raw_http(address, "POST", path, [*headers, *extra], data)


@contextlib.contextmanager
def running_server(**options):
    with tempfile.TemporaryDirectory() as directory:
        server = feedback_api.FeedbackHTTPServer(("127.0.0.1", 0), feedback_api.FeedbackStore(str(Path(directory) / "feedback.sqlite3")), ORIGIN, **options)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield server.server_address
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


def http_outputs(service):
    original_now = feedback_api.utc_now
    feedback_api.utc_now = lambda: FIXED_UTC
    reviews = feedback_api.ReviewStore(str(SERVER / "data/kakao_reviews.sqlite3"))
    with closing(reviews.connect()) as connection:
        place_id = connection.execute("SELECT contentid FROM place_links ORDER BY contentid LIMIT 1").fetchone()[0]
    review = f"/travel/api/places/{place_id}/reviews"
    valid_itinerary = itinerary_request(SCENARIOS[0], DATES[0], 20)
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            limiter = feedback_api.MemoryRateLimiter(limit=1000)
            with running_server(review_store=reviews, itinerary_service=service, rate_limiter=limiter, itinerary_per_minute=1000, itinerary_per_day=1000) as address:
                get = lambda path: raw_http(address, "GET", path)  # noqa: E731
                out["get.health"] = get("/healthz")
                for name, query in {"default": "", "page": "?limit=2&offset=1", "bounds": "?limit=20&offset=1000000", "extra": "?foo=1",
                                    "repeated": "?limit=1&limit=2", "limit-zero": "?limit=0", "limit-high": "?limit=21", "limit-negative": "?limit=-1",
                                    "offset-text": "?offset=abc"}.items():
                    out[f"get.reviews.{name}"] = get(review + query)
                out["get.reviews.unknown-place"] = get("/travel/api/places/999999999/reviews")
                out["get.reviews.non-digit"] = get("/travel/api/places/abc/reviews")
                out["get.reviews.long-id"] = get("/travel/api/places/" + "1" * 21 + "/reviews")
                out["get.not-found"] = get("/nope")
                out["get.feedback-path"] = get(feedback_api.API_PATH)
                out["head.health"] = raw_http(address, "HEAD", "/healthz")
                out["put.feedback"] = raw_http(address, "PUT", feedback_api.API_PATH, [("Content-Length", "0")])

                feedback = feedback_api.API_PATH
                v3 = v3_payload()
                out["feedback.v3.create"] = post(address, feedback, v3)
                out["feedback.v3.repeat"] = post(address, feedback, v3)
                newer = {**v3_payload(), "revision": 3, "updated_at": "2026-08-30T00:00:03.000Z"}
                out["feedback.v3.newer"] = post(address, feedback, newer)
                out["feedback.v3.older"] = post(address, feedback, v3)
                out["feedback.v3.conflict"] = post(address, feedback, {**newer, "participant_name": "다른이름"})
                v2 = v2_payload()
                out["feedback.v2.create"] = post(address, feedback, v2)
                out["feedback.v2.duplicate"] = post(address, feedback, v2)
                out["feedback.v2.conflict"] = post(address, feedback, {**v2, "created_at": "2026-08-28T00:00:01.000Z"})
                other_session = {**v3_payload(), "session_id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"}
                out["feedback.no-origin"] = post(address, feedback, other_session, origin=None)
                out["feedback.charset"] = post(address, feedback, {**other_session, "session_id": "2c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"},
                                                content_type="application/json; charset=utf-8")
                out["feedback.bad-origin"] = post(address, feedback, v3, origin="https://evil.example")
                out["feedback.text-plain"] = post(address, feedback, v3, content_type="text/plain")
                out["feedback.no-length"] = raw_http(address, "POST", feedback, [("Origin", ORIGIN), ("Content-Type", "application/json")])
                out["feedback.chunked"] = raw_http(address, "POST", feedback, [("Origin", ORIGIN), ("Content-Type", "application/json"),
                                                                                ("Transfer-Encoding", "chunked")], b"0\r\n\r\n")
                out["feedback.empty"] = post(address, feedback, body=b"")
                out["feedback.too-large"] = raw_http(address, "POST", feedback, [("Origin", ORIGIN), ("Content-Type", "application/json"),
                                                                                  ("Content-Length", str(feedback_api.MAX_BODY_BYTES + 1))])
                out["feedback.invalid-json"] = post(address, feedback, body=b"{not json")
                out["feedback.bad-utf8"] = post(address, feedback, body=b'{"a":"\xff"}')
                out["feedback.invalid"] = post(address, feedback, {**v3_payload(), "revision": 0})
                out["feedback.query-path"] = post(address, feedback + "?x=1", v3)
                out["post.not-found"] = post(address, "/nope", v3)

                itinerary = feedback_api.ITINERARY_PATH
                out["itinerary.no-origin"] = post(address, itinerary, valid_itinerary, origin=None)
                out["itinerary.bad-origin"] = post(address, itinerary, valid_itinerary, origin="https://evil.example")
                out["itinerary.text-plain"] = post(address, itinerary, valid_itinerary, content_type="text/plain")
                out["itinerary.chunked"] = raw_http(address, "POST", itinerary, [("Origin", ORIGIN), ("Content-Type", "application/json"),
                                                                                  ("Transfer-Encoding", "chunked")], b"0\r\n\r\n")
                out["itinerary.no-length"] = raw_http(address, "POST", itinerary, [("Origin", ORIGIN), ("Content-Type", "application/json")])
                out["itinerary.empty"] = post(address, itinerary, body=b"")
                out["itinerary.too-large"] = raw_http(address, "POST", itinerary, [("Origin", ORIGIN), ("Content-Type", "application/json"),
                                                                                    ("Content-Length", str(feedback_api.MAX_ITINERARY_BODY_BYTES + 1))])
                out["itinerary.invalid-json"] = post(address, itinerary, body=b"{not json")
                out["itinerary.array"] = post(address, itinerary, [])
                out["itinerary.invalid"] = post(address, itinerary, {**valid_itinerary, "travelWindow": None})
                out["itinerary.valid"] = post(address, itinerary, valid_itinerary)
                out["itinerary.valid-other"] = post(address, itinerary, itinerary_request(SCENARIOS[5], DATES[2], 10))
            with running_server(review_store=None, itinerary_service=None) as address:
                out["unconfigured.health"] = raw_http(address, "GET", "/healthz")
                out["unconfigured.reviews"] = raw_http(address, "GET", review)
                out["unconfigured.itinerary"] = post(address, feedback_api.ITINERARY_PATH, valid_itinerary)
            with running_server(itinerary_service=service, rate_limiter=feedback_api.MemoryRateLimiter(limit=1),
                                itinerary_per_minute=1, trusted_proxy_ips=("127.0.0.1",)) as address:
                sessions = [{**v3_payload(), "session_id": f"{index}c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"} for index in range(3, 6)]
                proxy = lambda ip: [("X-Travel-Client-IP", ip)]  # noqa: E731
                out["limits.feedback.first"] = post(address, feedback_api.API_PATH, sessions[0], extra=proxy("203.0.113.7"))
                out["limits.feedback.other-client"] = post(address, feedback_api.API_PATH, sessions[1], extra=proxy("203.0.113.8"))
                out["limits.feedback.same-client"] = post(address, feedback_api.API_PATH, sessions[2], extra=proxy("203.0.113.7"))
                out["limits.itinerary.first"] = post(address, feedback_api.ITINERARY_PATH, valid_itinerary)
                out["limits.itinerary.second"] = post(address, feedback_api.ITINERARY_PATH, valid_itinerary)
    finally:
        feedback_api.utc_now = original_now
    return out


def build_golden():
    restore = pin_clock()
    try:
        policy = load_policy()
        catalog = json.loads((SERVER / "data/itinerary_catalog.json").read_text(encoding="utf-8"))
        restaurants = RestaurantCatalog(SERVER / "data/restaurant_meal_catalog.sqlite3")
        router = EstimatedRouteProvider(policy["routeEstimate"], now=lambda: FIXED_NOW)
        service = ItineraryService(catalog, FakeScheduler(), router, policy=policy, restaurants=restaurants)
        return {"schemaVersion": SCHEMA_VERSION,
                "inputs": {"catalogVersion": catalog.get("version"), "restaurantCatalogVersion": restaurants.version,
                           "policyVersion": policy.get("version"), "fixedNow": FIXED_NOW.isoformat()},
                "itinerary": itinerary_outputs(service),
                "itineraryInputErrors": invalid_itinerary_outputs(service),
                "feedbackValidation": feedback_outputs(),
                "http": http_outputs(service)}
    finally:
        restore()


def differences(expected, actual, prefix="", found=None):
    found = [] if found is None else found
    if len(found) >= 40:
        return found
    if isinstance(expected, dict) and isinstance(actual, dict):
        for key in sorted(set(expected) | set(actual)):
            differences(expected.get(key), actual.get(key), f"{prefix}.{key}" if prefix else key, found)
    elif canonical_json(expected) != canonical_json(actual):
        found.append(prefix or "(root)")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--update", action="store_true", help="rewrite the golden file from the current code")
    args = parser.parse_args()
    golden = build_golden()
    rendered = json.dumps(golden, ensure_ascii=False, indent=2) + "\n"
    relative = GOLDEN_PATH.relative_to(ROOT).as_posix()
    if args.update:
        GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN_PATH.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"Updated {relative}: {len(golden['itinerary'])} itinerary runs, {len(golden['feedbackValidation'])} feedback payloads")
        return 0
    if not GOLDEN_PATH.exists():
        print(f"Missing {relative}; run with --update on the baseline commit first.", file=sys.stderr)
        return 1
    # Compare parsed JSON so CRLF checkouts do not count as a difference.
    changed = differences(json.loads(GOLDEN_PATH.read_text(encoding="utf-8")), json.loads(rendered))
    if changed:
        print(f"FAIL: Python golden outputs differ ({len(changed)}{'+' if len(changed) >= 40 else ''} paths):", file=sys.stderr)
        for item in changed:
            print(f"  - {item}", file=sys.stderr)
        return 1
    print(f"PASS: Python golden outputs match ({len(golden['itinerary'])} itinerary runs, "
          f"{len(golden['itineraryInputErrors'])} invalid requests, {len(golden['feedbackValidation'])} feedback payloads, "
          f"{len(golden['http'])} HTTP requests)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
