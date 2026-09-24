"""Fixed scenario contract tests: no live providers, costs, or user data."""
import copy
import json
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import itinerary_validation as validation
from itinerary_service import ItineraryInputError, ItineraryService, load_policy, validate_request
from itinerary_validation import (KST, choose_duration, operating_windows, solar_times,
                                  validate_day, validate_restaurant_insertion)

DATE = "2026-09-22"
NOW = datetime(2026, 9, 22, 9, tzinfo=KST)


def catalog_fixture():
    places = []
    for index, (pid, kind) in enumerate((("A", "garden"), ("B", "museum_exhibition"), ("C", "coast_beach"), ("D", "viewpoint"), ("H", "accommodation"))):
        places.append({"placeId": pid, "title": f"공개 장소 {pid}", "lng": 126.25 + index * 0.01, "lat": 33.3,
            "primaryType": kind, "recommendationReady": True,
            "operatingInfo": {"status": "known", "checkedAt": NOW.isoformat(), "sourceRefs": ["https://example.test/official"],
                "weekly": {str(n): [{"open": "09:00", "close": "21:00", "lastAdmission": "20:00"}] for n in range(1, 8)},
                "exceptions": {}, "seasonal": []},
            "officialDwellMinutes": {"minutes": 60, "checkedAt": NOW.isoformat(), "sourceRefs": ["https://example.test/duration"]},
            "visitInsights": {"status": "inferred", "evidenceReviewIds": [f"review-{pid}"], "preferredPeriods": [], "dwellMinutes": None,
                              "inputHash": f"fixture-{pid}", "model": "fixture", "promptVersion": "fixture-v1"}})
    return {"version": "fixed-catalog-v1", "operatingVersion": "fixture-ops", "reviewVersion": "fixture-reviews", "places": places}


def request_fixture():
    return {"schemaVersion": "itinerary-request-v1", "requestId": "r1", "recommendationRevision": "revision1", "courseVariantId": "course1",
        "travelWindow": {"startDate": DATE, "endDate": DATE}, "routeMode": "car", "timezone": "Asia/Seoul", "scheduleStatus": "ready",
        "days": [{"dayIndex": 1, "date": DATE, "placeIds": ["A", "B"], "requiredPlaceIds": ["A"], "anchorPlaceId": "B",
                  "startLocation": {"placeId": "H"}, "endLocation": {"placeId": "H"}, "startTime": "09:00", "endTime": "20:00"}]}


def proposal_fixture():
    return {"stops": [{"placeId": "A", "arrival": "09:30", "departure": "10:30", "evidenceReviewIds": ["review-A"]},
                      {"placeId": "B", "arrival": "14:00", "departure": "15:00", "evidenceReviewIds": []}],
        "mealSlots": [{"kind": "lunch", "start": "12:00", "end": "13:00"}, {"kind": "dinner", "start": "18:00", "end": "19:00"}],
        "unscheduledPlaces": []}


class FakeRouter:
    def __init__(self, seconds=1200, failure=None):
        self.calls = []
        self.seconds = seconds
        self.failure = failure

    def route(self, origin, destination, departure, mode="car", timeout=8):
        self.calls.append((origin["placeId"], destination["placeId"], departure, mode, timeout))
        if self.failure and self.failure(origin, destination, departure):
            raise RuntimeError("provider request secret must never leak")
        seconds = self.seconds(origin, destination, departure) if callable(self.seconds) else self.seconds
        return {"fromId": origin["placeId"], "toId": destination["placeId"], "durationSeconds": seconds,
                "distanceMeters": 5000, "provider": "fixed-mock", "queriedAt": NOW.isoformat(), "departureTime": departure,
                "predictionBasis": "future_departure", "routeRef": f"mock:{origin['placeId']}:{destination['placeId']}:{departure}", "geometry": []}


class FakeLLM:
    model = "fixed-mock"

    def __init__(self, proposals=None):
        self.calls = []
        self.proposals = proposals or [proposal_fixture()]

    def generate_structured(self, task, input, schema, timeout=30):
        self.calls.append((task, copy.deepcopy(input), schema, timeout))
        result = self.proposals[min(len(self.calls) - 1, len(self.proposals) - 1)]
        if isinstance(result, Exception):
            raise result
        return copy.deepcopy(result)


class ItineraryTests(unittest.TestCase):
    def setUp(self):
        self.catalog = catalog_fixture()
        self.places = {p["placeId"]: p for p in self.catalog["places"]}
        self.policy = load_policy()
        self.request = request_fixture()
        self.day = self.request["days"][0]
        self.proposal = proposal_fixture()
        self.router = FakeRouter()
        actual_fresh = validation.fresh
        self.fresh_patch = patch.object(validation, "fresh", side_effect=lambda record, day, policy, now=None: actual_fresh(record, day, policy, now or NOW))
        self.fresh_patch.start()
        self.addCleanup(self.fresh_patch.stop)

    def check(self, proposal=None, day=None, prefs=None):
        return validate_day(day or self.day, proposal or self.proposal, self.places,
            lambda a, b, departure: self.router.route(self.places[a], self.places[b], departure.isoformat()),
            prefs or self.policy["mealPreferences"], self.policy, NOW)

    def codes(self, result):
        return {item["code"] for item in result["violations"]}

    def test_complete_server_verified_day_and_meal_contract(self):
        result = self.check()
        self.assertEqual(result["status"], "validated")
        self.assertEqual(len(result["legs"]), 3)
        self.assertEqual(len(result["mealSlots"]), 2)
        lunch = result["mealSlots"][0]
        self.assertEqual((lunch["beforeLocation"]["placeId"], lunch["afterLocation"]["placeId"]), ("A", "B"))
        self.assertEqual(lunch["maxDetourMinutes"], 20)
        self.assertEqual(lunch["restaurantStatus"], "pending")
        self.assertTrue(lunch["requiresRevalidation"])
        self.assertEqual(result["stops"][0]["bufferMinutes"], 10)

    def test_required_dates_and_transport_gate_before_providers(self):
        mutations = [lambda p: p.pop("travelWindow"), lambda p: p.update(travelWindow={"startDate": "", "endDate": ""}),
            lambda p: p.update(travelWindow={"startDate": DATE, "endDate": "2026-09-21"}),
            lambda p: p.update(travelWindow={"startDate": "2026-02-30", "endDate": "2026-03-01"}),
            lambda p: p.update(travelWindow={"startDate": DATE, "endDate": "2026-10-02"}),
            lambda p: p.update(routeMode="no_car"), lambda p: p["days"][0].pop("startLocation"),
            lambda p: p["days"][0].update(date="2026-09-23")]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                payload = copy.deepcopy(self.request)
                mutate(payload)
                llm, router = FakeLLM(), FakeRouter()
                with self.assertRaises(ItineraryInputError):
                    ItineraryService(self.catalog, llm, router).generate(payload)
                self.assertEqual(llm.calls, [])
                self.assertEqual(router.calls, [])

    def test_stale_bundle_and_catalog_are_rejected_without_generation(self):
        self.catalog["mapVersion"] = "2026-08-09:types-v1"
        for field, value in (("sourceMapVersion", "old-bundle"), ("catalogVersion", "old-catalog")):
            payload = copy.deepcopy(self.request)
            payload[field] = value
            with self.assertRaises(ItineraryInputError):
                validate_request(payload, self.catalog)
        self.request["sourceMapVersion"] = self.catalog["mapVersion"]
        self.request["courseVariantId"] = None
        self.assertEqual(validate_request(self.request, self.catalog)["courseVariantId"], "")

    def test_adapter_invalid_output_consumes_only_one_repair(self):
        from llm_client import ProviderError
        llm = FakeLLM([ProviderError("llm_invalid_output"), proposal_fixture()])
        result = ItineraryService(self.catalog, llm, FakeRouter()).generate(self.request)
        self.assertEqual(result["status"], "validated")
        self.assertEqual(len(llm.calls), 2)

    def test_catalog_ids_types_excluded_and_cross_day_gate(self):
        cases = []
        for change in ({"placeIds": ["A", "missing"]}, {"requiredPlaceIds": ["C"]}, {"anchorPlaceId": "C"}, {"placeIds": ["A", "A"]}):
            payload = copy.deepcopy(self.request)
            payload["days"][0].update(change)
            cases.append(payload)
        payload = copy.deepcopy(self.request)
        payload["excludedPlaceIds"] = ["A"]
        cases.append(payload)
        for payload in cases:
            with self.assertRaises(ItineraryInputError):
                validate_request(payload, self.catalog)
        self.places["B"]["primaryType"] = "garden"
        with self.assertRaises(ItineraryInputError):
            validate_request(self.request, self.catalog)

    def test_closing_17_blocks_1630_to1730(self):
        self.places["B"]["operatingInfo"]["weekly"]["2"] = [{"open": "09:00", "close": "17:00"}]
        self.proposal["stops"][1].update(arrival="16:30", departure="17:30")
        result = self.check()
        self.assertIn("closed_or_outside_hours", self.codes(result))
        self.assertEqual(result["status"], "generation_failed")
        self.assertEqual(result["stops"], [])
        self.assertEqual({item["placeId"] for item in result["unscheduledPlaces"]}, {"A", "B"})

    def test_30minute_route_cannot_fit_in_10minutes(self):
        self.router.seconds = 1800
        self.proposal["stops"][0].update(arrival="09:10", departure="10:10")
        self.assertIn("insufficient_travel", self.codes(self.check()))

    def test_dwell_and_buffer_counted_exactly_once(self):
        self.router.seconds = 600
        self.proposal["stops"][1].update(arrival="10:50", departure="11:50")
        self.assertEqual(self.check()["status"], "validated")
        self.proposal["stops"][1].update(arrival="10:49", departure="11:49")
        self.assertIn("insufficient_travel", self.codes(self.check()))
        self.proposal["stops"][0].update(departure="10:29")
        self.assertIn("insufficient_dwell", self.codes(self.check()))

    def test_last_admission_and_break(self):
        info = self.places["B"]["operatingInfo"]
        info["weekly"]["2"] = [{"open": "09:00", "close": "17:00", "lastAdmission": "13:00"}]
        self.assertIn("last_admission", self.codes(self.check()))
        info["weekly"]["2"] = [{"open": "09:00", "close": "14:30"}, {"open": "15:30", "close": "21:00"}]
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))

    def test_weekly_closure_exception_and_season(self):
        info = self.places["A"]["operatingInfo"]
        info["weekly"]["2"] = []
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))
        info["exceptions"][DATE] = {"intervals": [{"open": "09:00", "close": "21:00"}]}
        self.assertEqual(self.check()["status"], "validated")
        info["exceptions"][DATE] = {"closed": True}
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))
        info["exceptions"] = {}
        info["seasonal"] = [{"startDate": "2026-09-01", "endDate": "2026-10-01", "weekly": {"2": [{"open": "09:00", "close": "21:00"}]}}]
        self.assertEqual(self.check()["status"], "validated")
        info["seasonal"].append(copy.deepcopy(info["seasonal"][0]))
        self.assertEqual(self.check()["status"], "verification_required")

    def test_operating_unknown_stale_conflict_missing_weekday_are_not_validated(self):
        for mutation in ({"status": "unknown"}, {"status": "conflict"}, {"checkedAt": "2020-01-01T00:00:00+09:00"}, {"weekly": {}}, {"sourceRefs": []}):
            original = copy.deepcopy(self.places["A"]["operatingInfo"])
            self.places["A"]["operatingInfo"].update(mutation)
            self.assertEqual(self.check()["status"], "verification_required", mutation)
            self.places["A"]["operatingInfo"] = original

    def test_midnight_and_all_day_normalization(self):
        info = self.places["A"]["operatingInfo"]
        info["weekly"] = {"1": [{"open": "21:00", "close": "02:00", "lastAdmission": "01:00"}], "2": []}
        windows, unknown = operating_windows(self.places["A"], DATE, self.policy, NOW)
        self.assertIsNone(unknown)
        self.assertEqual(windows[0][1].isoformat(), DATE + "T02:00:00+09:00")
        self.assertEqual(windows[0][2].isoformat(), DATE + "T01:00:00+09:00")
        info["weekly"] = {"2": [{"open": "00:00", "close": "24:00"}]}
        windows, unknown = operating_windows(self.places["A"], DATE, self.policy, NOW)
        self.assertIsNone(unknown)
        self.assertEqual(windows[0][1].date().isoformat(), "2026-09-23")

    def test_overnight_visit_obeys_actual_calendar_exception_and_entry_cutoff(self):
        self.day["endTime"] = "02:00"
        info = self.places["B"]["operatingInfo"]
        info["weekly"]["2"] = [{"open": "21:00", "close": "02:00", "lastAdmission": "01:30"}]
        info["weekly"]["3"] = []
        self.proposal["stops"][1].update(arrival="2026-09-23T00:00:00+09:00", departure="2026-09-23T01:00:00+09:00")
        self.assertEqual(self.check()["status"], "validated")
        info["exceptions"]["2026-09-23"] = {"closed": True, "intervals": []}
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))
        self.proposal["stops"][1].update(arrival="2026-09-22T23:30:00+09:00", departure="2026-09-23T00:30:00+09:00")
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))
        info["exceptions"] = {}
        # Admission before yesterday's 23:45 cutoff remains admitted after midnight.
        info["weekly"]["2"][0]["lastAdmission"] = "23:45"
        self.assertEqual(self.check()["status"], "validated")
        self.proposal["stops"][1].update(arrival="2026-09-23T00:00:00+09:00", departure="2026-09-23T01:00:00+09:00")
        self.assertIn("last_admission", self.codes(self.check()))

    def test_required_anchor_duplicate_and_invented_place(self):
        for pid in ("A", "B"):
            proposal = proposal_fixture()
            proposal["stops"] = [item for item in proposal["stops"] if item["placeId"] != pid]
            proposal["unscheduledPlaces"] = [{"placeId": pid, "reason": "시간 부족"}]
            self.assertIn("required_place_missing", self.codes(self.check(proposal)))
        proposal = proposal_fixture()
        proposal["stops"].append(copy.deepcopy(proposal["stops"][0]))
        self.assertIn("duplicate_place", self.codes(self.check(proposal)))
        proposal["stops"][-1]["placeId"] = "C"
        self.assertIn("unauthorized_place", self.codes(self.check(proposal)))

    def test_optional_omission_requires_reason(self):
        self.day["anchorPlaceId"] = None
        self.proposal["stops"] = self.proposal["stops"][:1]
        self.assertIn("unscheduled_reason_missing", self.codes(self.check()))
        self.proposal["unscheduledPlaces"] = [{"placeId": "B", "reason": "식사와 종료 시각을 보존하면 선택 장소를 넣을 시간이 부족합니다."}]
        result = self.check()
        self.assertEqual(result["status"], "partially_scheduled")
        self.assertFalse(result["unscheduledPlaces"][0]["required"])

    def test_forged_reviews_and_llm_hours_are_rejected(self):
        self.proposal["stops"][0]["evidenceReviewIds"] = ["not-a-review"]
        self.assertIn("fabricated_evidence", self.codes(self.check()))
        self.proposal["stops"][0]["operatingHours"] = "all day"
        self.assertIn("invalid_schema", self.codes(self.check()))

    def test_meal_window_duration_missing_overlap_and_early_end(self):
        cases = [({"start": "11:00", "end": "12:00"}, "meal_window"), ({"start": "12:00", "end": "12:30"}, "meal_window"),
                 ({"start": "13:30", "end": "14:30"}, "meal_overlap")]
        for change, code in cases:
            proposal = proposal_fixture()
            proposal["mealSlots"][0].update(change)
            self.assertIn(code, self.codes(self.check(proposal)))
        proposal = proposal_fixture()
        proposal["mealSlots"] = proposal["mealSlots"][:1]
        self.assertIn("missing_meal", self.codes(self.check(proposal)))
        self.day["endTime"] = "18:00"
        self.assertIn("meal_activity_conflict", self.codes(self.check()))
        self.assertEqual(self.check()["status"], "needs_input")

    def test_restaurant_detour_and_next_arrival_checker(self):
        slot = self.check()["mealSlots"][0]
        result = validate_restaurant_insertion(slot, 1200, 2400, slot["start"], slot["end"], DATE + "T13:30:00+09:00")
        self.assertEqual({i["code"] for i in result}, {"restaurant_detour", "restaurant_next_arrival"})
        self.assertEqual(validate_restaurant_insertion(slot, 600, 1200, slot["start"], slot["end"], DATE + "T14:00:00+09:00"), [])

    def test_afternoon_arrival_requires_only_dinner(self):
        self.day["startTime"] = "15:00"
        self.proposal["stops"][0].update(arrival="15:30", departure="16:30")
        self.proposal["stops"][1].update(arrival="17:00", departure="18:00")
        self.proposal["mealSlots"] = [{"kind": "dinner", "start": "18:10", "end": "19:10"}]
        result = self.check()
        self.assertEqual(result["status"], "validated")
        self.assertEqual([m["status"] for m in result["mealRequirements"]], ["outside_activity", "required"])
        self.assertEqual([m["kind"] for m in result["mealSlots"]], ["dinner"])

    def test_morning_departure_can_have_no_meals(self):
        self.day.update(endTime="11:30", placeIds=["A"], anchorPlaceId=None)
        self.proposal.update(stops=self.proposal["stops"][:1], mealSlots=[])
        result = self.check()
        self.assertEqual(result["status"], "validated")
        self.assertEqual(result["mealSlots"], [])
        self.assertTrue(all(m["status"] == "outside_activity" for m in result["mealRequirements"]))

    def test_excluded_and_explicitly_required_meals(self):
        self.day["mealModes"] = {"lunch": "excluded", "dinner": "required"}
        self.proposal["mealSlots"] = self.proposal["mealSlots"][1:]
        self.assertEqual(self.check()["status"], "validated")
        self.proposal["mealSlots"] = []
        self.assertIn("missing_meal", self.codes(self.check()))
        self.proposal["mealSlots"] = proposal_fixture()["mealSlots"]
        self.assertIn("invalid_meal", self.codes(self.check()))

    def test_conflicting_meal_inputs_stop_before_provider_calls(self):
        for start, modes in [("13:45", {}), ("15:00", {"lunch": "required"})]:
            self.day.update(startTime=start, mealModes=modes)
            llm, router = FakeLLM(), FakeRouter()
            result = ItineraryService(self.catalog, llm, router).generate(self.request)
            self.assertEqual(result["status"], "needs_input")
            self.assertIn("meal_activity_conflict", self.codes(result))
            self.assertEqual((len(llm.calls), len(router.calls)), (0, 0))
        self.day["mealModes"] = {"lunch": "skip"}
        with self.assertRaises(ItineraryInputError):
            validate_request(self.request, self.catalog)

    def test_invalid_output_twice_is_generation_failure_not_impossibility(self):
        llm = FakeLLM([ValueError("invalid JSON")])
        result = ItineraryService(self.catalog, llm, FakeRouter()).generate(self.request)
        self.assertEqual(result["status"], "generation_failed")
        self.assertEqual(len(llm.calls), 2)
        self.assertEqual(result["days"][0]["stops"], [])
        self.assertNotIn("routeObservations", result["days"][0])

    def test_repair_receives_actual_route_and_shortage_then_succeeds(self):
        first, repaired = proposal_fixture(), proposal_fixture()
        first["stops"][1].update(arrival="11:00", departure="12:00")
        first["mealSlots"][0].update(start="12:30", end="13:30")
        repaired["stops"][1].update(arrival="11:30", departure="12:30")
        repaired["mealSlots"][0].update(start="12:50", end="13:50")
        def seconds(origin, destination, departure):
            return 3000 if origin["placeId"] == "A" and destination["placeId"] == "B" and "T09:00:" not in departure else 1200
        llm, router = FakeLLM([first, repaired]), FakeRouter(seconds)
        result = ItineraryService(self.catalog, llm, router).generate(self.request)
        self.assertEqual(result["status"], "validated")
        prompt = llm.calls[1][1]
        actual = next(r for r in prompt["revalidatedRoutes"] if r["fromId"] == "A" and r["toId"] == "B")
        self.assertEqual((actual["durationSeconds"], actual["durationMinutes"], actual["shortageMinutes"]), (3000, 50, 30))
        self.assertEqual(actual["departureTime"], DATE + "T10:40:00+09:00")
        self.assertEqual(actual["nextArrival"], DATE + "T11:00:00+09:00")
        self.assertTrue(actual["routeRef"])
        self.assertTrue(any(a == "B" and "T14:10:" in stamp for a, b, stamp, _, _ in router.calls))

    def test_seven_full_days_fit_route_budget_and_daily_scope(self):
        self.request["travelWindow"]["endDate"] = "2026-09-28"
        records = []
        for pid in ("START", "END"):
            place = copy.deepcopy(self.catalog["places"][0]); place["placeId"] = pid; records.append(place)
        days, proposals = [], []
        for index in range(7):
            ids = [f"day{index}-place{n}" for n in range(6)]
            for n, pid in enumerate(ids):
                place = copy.deepcopy(self.catalog["places"][0]); place.update(placeId=pid, primaryType=f"type{n}")
                place["officialDwellMinutes"]["minutes"] = 30
                records.append(place)
            day = copy.deepcopy(self.day)
            day.update(dayIndex=index + 1, date=(NOW + timedelta(days=index)).date().isoformat(), placeIds=ids,
                       requiredPlaceIds=[ids[0]], anchorPlaceId=ids[1], startLocation={"placeId": "START"}, endLocation={"placeId": "END"})
            days.append(day)
            windows = [("09:10", "09:40"), ("09:55", "10:25"), ("10:40", "11:10"), ("14:00", "14:30"), ("14:45", "15:15"), ("15:30", "16:00")]
            proposals.append({"stops": [{"placeId": pid, "arrival": a, "departure": b, "evidenceReviewIds": []} for pid, (a, b) in zip(ids, windows)],
                              "mealSlots": proposal_fixture()["mealSlots"], "unscheduledPlaces": []})
        self.catalog["places"] = records
        self.request["days"] = days
        result = ItineraryService(self.catalog, FakeLLM(proposals), FakeRouter(seconds=60)).generate(self.request)
        self.assertEqual([day["status"] for day in result["days"]], ["validated"] * 7)
        self.assertGreater(result["provenance"]["calls"]["routes"], 280)
        self.assertLessEqual(result["provenance"]["calls"]["routes"], self.policy["maxRouteCallsPerRequest"])
        self.request.update(generationScope="day", days=days[-1:])
        result = ItineraryService(self.catalog, FakeLLM(proposals[-1:]), FakeRouter(seconds=60)).generate(self.request)
        self.assertEqual(result["status"], "validated")
        self.assertFalse(result["unknowns"])
        self.assertLessEqual(result["provenance"]["calls"]["routes"], 100)
        self.request["days"] = days
        with self.assertRaises(ItineraryInputError):
            validate_request(self.request, self.catalog)

    def test_duration_priority_review_evidence_and_special_types(self):
        place = self.places["A"]
        self.assertEqual(choose_duration(place, DATE, self.policy, NOW)["basis"], "official")
        del place["officialDwellMinutes"]
        place["visitInsights"]["dwellMinutes"] = {"min": 50, "max": 75, "evidenceReviewIds": ["review-A"]}
        duration = choose_duration(place, DATE, self.policy, NOW)
        self.assertEqual((duration["minutes"], duration["basis"]), (75, "review_estimate"))
        place["visitInsights"]["status"] = "conflict"
        self.assertEqual(choose_duration(place, DATE, self.policy, NOW)["basis"], "provisional_type_default")
        place["primaryType"] = "mountain_oreum"
        self.assertIsNone(choose_duration(place, DATE, self.policy, NOW)["minutes"])

    def test_solar_times_change_with_date_and_preserve_admission_priority(self):
        winter = solar_times("2026-12-21", 126.53, 33.5)
        summer = solar_times("2026-06-21", 126.53, 33.5)
        self.assertTrue("17:15" < winter["sunset"][11:16] < "17:45")
        self.assertTrue("19:30" < summer["sunset"][11:16] < "20:00")
        self.places["B"]["visitInsights"]["preferredPeriods"] = [{"period": "night", "evidenceReviewIds": ["review-B"]}]
        self.places["B"]["operatingInfo"]["weekly"]["2"] = [{"open": "09:00", "close": "17:00", "lastAdmission": "16:00"}]
        self.proposal["stops"][1].update(arrival="18:00", departure="19:00")
        self.proposal["mealSlots"][1].update(start="19:00", end="20:00")
        self.day["endTime"] = "21:00"
        self.assertIn("closed_or_outside_hours", self.codes(self.check()))

    def test_repair_maximum_one_and_failed_timetable_hidden(self):
        broken = proposal_fixture()
        broken["stops"][0]["arrival"] = "09:01"
        llm = FakeLLM([broken])
        result = ItineraryService(self.catalog, llm, self.router).generate(self.request)
        self.assertEqual(len(llm.calls), 2)
        self.assertEqual(result["status"], "generation_failed")
        self.assertEqual(result["days"][0]["stops"], [])
        self.assertTrue(llm.calls[1][1]["violations"])
        llm = FakeLLM([broken, proposal_fixture()])
        self.assertEqual(ItineraryService(self.catalog, llm, FakeRouter()).generate(self.request)["status"], "validated")
        self.assertEqual(len(llm.calls), 2)

    def test_bad_schema_gets_one_repair(self):
        llm = FakeLLM([ValueError("invalid JSON"), proposal_fixture()])
        result = ItineraryService(self.catalog, llm, FakeRouter()).generate(self.request)
        self.assertEqual(result["status"], "validated")
        self.assertEqual(len(llm.calls), 2)

    def test_server_allowlist_no_names_feedback_mbti_or_raw_reviews(self):
        self.request.update(participantName="PRIVATE NAME", feedback={"comment": "PRIVATE COMMENT"}, mbti="PRIVATE MBTI")
        self.day["private"] = "PRIVATE DAILY"
        self.places["A"]["visitInsights"]["rawReview"] = "PRIVATE REVIEW"
        llm = FakeLLM()
        original = copy.deepcopy(self.request)
        result = ItineraryService(self.catalog, llm, FakeRouter()).generate(self.request)
        self.assertEqual(result["status"], "validated")
        self.assertEqual(original, self.request)
        prompt = json.dumps(llm.calls[0][1])
        self.assertNotIn("PRIVATE", prompt)
        self.assertEqual({p["placeId"] for p in llm.calls[0][1]["places"]}, {"A", "B"})
        self.assertEqual(result["provenance"]["operatingInfoVersion"], "fixture-ops")

    def test_directional_matrix_and_actual_departure_revalidation(self):
        def duration(origin, destination, departure):
            if origin["placeId"] == "A" and destination["placeId"] == "B":
                return 1200 if "T09:00:" in departure else 14400
            return 600
        router = FakeRouter(duration)
        llm = FakeLLM()
        result = ItineraryService(self.catalog, llm, router).generate(self.request)
        self.assertEqual(result["status"], "generation_failed")
        matrix = llm.calls[0][1]["routeMatrix"]
        lookup = {(r["fromId"], r["toId"]): r["durationSeconds"] for r in matrix}
        self.assertEqual((lookup[("A", "B")], lookup[("B", "A")]), (1200, 600))
        self.assertTrue(any(a == "A" and b == "B" and "T10:40:" in stamp for a, b, stamp, _, _ in router.calls))
        self.assertLessEqual(len(router.calls), self.policy["maxRouteCallsPerDay"])

    def test_route_nan_failure_and_query_budget_are_unavailable(self):
        for router in (FakeRouter(float("nan")), FakeRouter(failure=lambda *_: True)):
            llm = FakeLLM()
            result = ItineraryService(self.catalog, llm, router).generate(self.request)
            self.assertEqual(result["status"], "unavailable")
            self.assertEqual(llm.calls, [])
            self.assertNotIn("secret", json.dumps(result))
        policy = copy.deepcopy(self.policy)
        policy["maxRouteCallsPerDay"] = 1
        router = FakeRouter()
        result = ItineraryService(self.catalog, FakeLLM(), router, policy=policy).generate(self.request)
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(len(router.calls), 1)

    def test_request_deadline_stops_further_calls(self):
        policy = copy.deepcopy(self.policy)
        policy["requestDeadlineSeconds"] = 0
        llm = FakeLLM()
        result = ItineraryService(self.catalog, llm, self.router, policy=policy).generate(self.request)
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(llm.calls, [])
        self.assertEqual(self.router.calls, [])

    def test_provider_day_failure_preserves_other_day(self):
        self.request["travelWindow"]["endDate"] = "2026-09-23"
        second = copy.deepcopy(self.day)
        second.update(dayIndex=2, date="2026-09-23", placeIds=["C", "D"], requiredPlaceIds=["C"], anchorPlaceId="D")
        self.request["days"].append(second)
        router = FakeRouter(failure=lambda origin, dest, departure: origin["placeId"] == "C")
        result = ItineraryService(self.catalog, FakeLLM(), router).generate(self.request)
        self.assertEqual([day["status"] for day in result["days"]], ["validated", "unavailable"])
        self.assertEqual(len(result["days"][0]["stops"]), 2)

    def test_original_infeasible_and_empty_day_do_not_call_providers(self):
        llm = FakeLLM()
        self.request["scheduleStatus"] = "infeasible"
        self.request["scheduleIssues"] = [{"code": "original_type_issue", "message": "원래 충돌"}]
        result = ItineraryService(self.catalog, llm, self.router).generate(self.request)
        self.assertEqual(result["status"], "infeasible")
        self.assertIn("original_type_issue", self.codes(result))
        self.assertEqual(self.router.calls, [])
        self.request["scheduleStatus"] = "ready"
        self.day.update(placeIds=[], requiredPlaceIds=[], anchorPlaceId=None)
        self.assertEqual(ItineraryService(self.catalog, llm, self.router).generate(self.request)["status"], "needs_input")
        self.assertEqual(llm.calls, [])


if __name__ == "__main__":
    unittest.main()
