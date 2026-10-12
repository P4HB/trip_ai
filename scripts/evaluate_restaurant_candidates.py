#!/usr/bin/env python3
"""Offline SPEC-107 scenario report: meal-slot restaurant candidate counts on real Jeju data.

Uses the real itinerary catalog, the real restaurant meal sidecar and the estimated route
provider. The LLM is the deterministic offline stand-in (``fake_llm_scheduler``), so this
measures candidate supply (how many restaurants survive the detour/opening filters and how
often a slot ends up empty) — NOT model quality, real road times or real opening status.

    python scripts/evaluate_restaurant_candidates.py --output reports/spec107-restaurant-candidates.json
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import statistics
import sys

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server/travel-feedback"
sys.path.insert(0, str(SERVER))
from fake_llm_scheduler import FakeScheduler  # noqa: E402
from itinerary_service import ItineraryService, load_policy  # noqa: E402
from restaurant_catalog import RestaurantCatalog  # noqa: E402
from route_provider import EstimatedRouteProvider  # noqa: E402

# Public TourAPI place IDs from server/travel-feedback/data/itinerary_catalog.json.
SCENARIOS = [
    {"id": "west-coast", "area": "해안(서부)", "places": ["127490", "126455", "2660802", "741109"], "start": "228853", "end": "228853", "time": ("09:00", "20:30")},
    {"id": "east-coast", "area": "해안(동부)", "places": ["127813", "126472", "126471", "992261"], "start": "126451", "end": "126451", "time": ("09:00", "20:30")},
    {"id": "mid-mountain", "area": "중산간(동부)", "places": ["126474", "1146121", "1544730", "127479"], "start": "1013246", "end": "1013246", "time": ("09:00", "20:30")},
    {"id": "south-coast", "area": "해안(서귀포)", "places": ["126438", "126470", "127492", "1798082"], "start": "2627229", "end": "2627229", "time": ("09:00", "20:30")},
    {"id": "southwest-mid", "area": "중산간(서남부)", "places": ["572973", "2714241", "741109", "126440"], "start": "2561880", "end": "2561880", "time": ("09:00", "20:30")},
    {"id": "dinner-only-north", "area": "해안(북동부) 오후 출발", "places": ["127046", "1918639", "992261"], "start": "126451", "end": "126451", "time": ("14:00", "21:00")},
    {"id": "lunch-only-city", "area": "제주시 오전", "places": ["228853", "1013246", "2738665"], "start": "126448", "end": "126448", "time": ("08:30", "14:30")},
]
DATES = ["2026-10-20", "2026-10-23", "2026-10-24", "2026-10-25"]  # Tue, Fri, Sat, Sun


def run(output=None, detours=(20, 10, 5)):
    policy = load_policy()
    catalog = json.loads((SERVER / "data/itinerary_catalog.json").read_text(encoding="utf-8"))
    restaurants = RestaurantCatalog(SERVER / "data/restaurant_meal_catalog.sqlite3")
    service = ItineraryService(catalog, FakeScheduler(), EstimatedRouteProvider(policy["routeEstimate"]), policy=policy, restaurants=restaurants)
    sweep = {}
    for detour in detours:
        sweep[detour] = collect(service, detour)
    slots, days, failures = sweep[detours[0]]
    return report_from(restaurants, slots, days, failures, sweep, detours, output)


def collect(service, detour):
    slots, days, failures = [], [], []
    for scenario in SCENARIOS:
        for date in DATES:
            request = {"schemaVersion": "itinerary-request-v2", "requestId": f"{scenario['id']}.{date}", "recommendationRevision": "offline",
                       "courseVariantId": "offline", "travelWindow": {"startDate": date, "endDate": date}, "routeMode": "car",
                       "generationScope": "day", "mealPreferences": {"maxDetourMinutes": detour},
                       "travelerContext": {"companionType": "friends", "preferenceSignals": [{"feature": "local_embeddedness", "direction": "benefit"}]},
                       "days": [{"dayIndex": 1, "date": date, "placeIds": scenario["places"], "requiredPlaceIds": [],
                                 "anchorPlaceId": scenario["places"][0], "startLocation": {"placeId": scenario["start"]},
                                 "endLocation": {"placeId": scenario["end"]}, "startTime": scenario["time"][0], "endTime": scenario["time"][1]}]}
            result = service.generate(request)
            day = result["days"][0]
            days.append({"scenario": scenario["id"], "date": date, "status": day["status"], "stops": len(day["stops"]),
                         "violations": [item["code"] for item in day["violations"]]})
            if day["status"] not in ("validated", "verification_required", "partially_scheduled"):
                failures.append(days[-1])
                continue
            for slot in day["mealSlots"]:
                candidates = slot.get("restaurantCandidates") or []
                slots.append({"scenario": scenario["id"], "area": scenario["area"], "date": date, "kind": slot["kind"],
                              "start": slot["start"][11:16], "before": slot["beforeLocation"]["title"], "after": slot["afterLocation"]["title"],
                              "status": slot["restaurantStatus"], "reason": slot.get("restaurantNoCandidateReason"),
                              "pool": slot.get("restaurantCandidatePool"), "candidates": len(candidates),
                              "withDelayOrViolation": sum(1 for c in candidates if c["insertion"]["nextDelayMinutes"] or c["insertion"]["violations"]),
                              "verdicts": dict(Counter(c["judgement"].get("verdict") or "unavailable" for c in candidates))})
    return slots, days, failures


def report_from(restaurants, slots, days, failures, sweep, detours, output):
    counts = Counter(item["candidates"] for item in slots)
    by_kind = {kind: [item for item in slots if item["kind"] == kind] for kind in ("lunch", "dinner")}

    def summary(items):
        if not items:
            return {"slots": 0}
        pools = [item["pool"]["eligible"] for item in items]
        return {"slots": len(items), "zeroCandidateSlots": sum(item["candidates"] == 0 for item in items),
                "zeroRatio": round(sum(item["candidates"] == 0 for item in items) / len(items), 3),
                "fullFiveRatio": round(sum(item["candidates"] == 5 for item in items) / len(items), 3),
                "eligiblePool": {"min": min(pools), "median": statistics.median(pools), "max": max(pools)}}

    report = {"mode": "offline_fake_llm_estimated_routes_real_catalogs", "liveApiVerified": False,
              "limitations": ["LLM 판정과 시간표는 결정적 오프라인 대역입니다(모델 품질 아님).",
                              "이동시간은 직선거리 추정이며 섬(우도 등)·페리·실도로를 반영하지 않습니다.",
                              "영업시간은 2026-09 관측 주간의 요일 패턴 투영입니다."],
              "restaurantCatalogVersion": restaurants.version, "scenarios": len(SCENARIOS), "dates": DATES,
              "days": len(days), "dayFailures": failures, "slots": len(slots),
              "candidateCountDistribution": {str(n): counts.get(n, 0) for n in range(6)},
              "overall": summary(slots), "lunch": summary(by_kind["lunch"]), "dinner": summary(by_kind["dinner"]),
              "noCandidateReasons": dict(Counter(item["reason"] for item in slots if item["candidates"] == 0)),
              "baseMaxDetourMinutes": detours[0],
              "detourSensitivity": {str(detour): {"slots": len(found[0]), "dayFailures": len(found[2]),
                                                  "candidateCountDistribution": {str(n): Counter(i["candidates"] for i in found[0]).get(n, 0) for n in range(6)},
                                                  "zeroRatio": round(sum(i["candidates"] == 0 for i in found[0]) / max(1, len(found[0])), 3),
                                                  "noCandidateReasons": dict(Counter(i["reason"] for i in found[0] if i["candidates"] == 0))}
                                    for detour, found in sweep.items()},
              "slotDetails": slots}
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(rendered, encoding="utf-8")
    brief = {key: report[key] for key in ("days", "slots", "candidateCountDistribution", "overall", "lunch", "dinner", "noCandidateReasons", "detourSensitivity")}
    brief["dayFailures"] = len(failures)
    print(json.dumps(brief, ensure_ascii=False, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    run(args.output)


if __name__ == "__main__":
    main()
