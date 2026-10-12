"""SPEC-107 distance-based route estimate: no network, monotonic, rounded up."""
import copy
import math
import random
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import route_provider
from llm_client import ProviderError
from route_provider import (EstimatedRouteProvider, KakaoRouteProvider, RouteEstimator, create_route_provider,
                            haversine_meters)
from itinerary_service import ItineraryService, load_policy
from test_itinerary import FakeLLM, catalog_fixture, request_fixture

POLICY = load_policy()
FACTOR = POLICY["routeEstimate"]["roadFactor"]


def straight_meters(road_km):
    return road_km * 1000 / FACTOR


class EstimatorTests(unittest.TestCase):
    def setUp(self):
        self.estimator = RouteEstimator(POLICY["routeEstimate"])

    def test_policy_defaults_are_versioned_development_values(self):
        config = POLICY["routeEstimate"]
        self.assertEqual(config["status"], "development_default_not_measured")
        self.assertEqual((config["roadFactor"], config["fixedOverheadMinutes"]), (1.35, 3))
        self.assertEqual([band["kmh"] for band in config["speedBandsKmh"]], [25, 40, 55])

    def test_band_boundaries_accumulate_and_round_up(self):
        # 3 road km at 25 km/h = 7.2 min (+3) -> 11; 15 road km = 7.2 + 18 = 25.2 (+3) -> 29.
        self.assertEqual(self.estimator.minutes(straight_meters(3)), 11)
        self.assertEqual(self.estimator.minutes(straight_meters(15)), 29)
        # 40 road km: 7.2 + 18 + 25/55*60 = 52.47 (+3) -> 56.
        self.assertEqual(self.estimator.minutes(straight_meters(40)), 56)
        # Exact whole minutes are not pushed up by float noise: 2.5 km = 6.0 min (+3) -> 9.
        self.assertEqual(self.estimator.minutes(straight_meters(2.5)), 9)
        # Just above a boundary is never faster than at the boundary.
        self.assertGreaterEqual(self.estimator.minutes(straight_meters(3.001)), self.estimator.minutes(straight_meters(3)))

    def test_monotonic_and_continuous(self):
        previous = 0
        for step in range(0, 6000):
            value = self.estimator.minutes(step * 10.0)
            self.assertGreaterEqual(value, previous)
            previous = value

    def test_same_place_is_zero_minutes(self):
        self.assertEqual(self.estimator.minutes(0), 0)
        self.assertEqual(self.estimator.minutes(0.9), 0)
        self.assertEqual(self.estimator.minutes(1.0), 4)  # overhead applies to a real move
        with self.assertRaises(ValueError):
            self.estimator.minutes(float("nan"))

    def test_straight_line_prefilter_is_lossless(self):
        rng = random.Random(7)
        budget = self.estimator.straight_km_budget(20)
        for _ in range(3000):
            p, n, r = ((126.2 + rng.random() * 0.8, 33.2 + rng.random() * 0.35) for _ in range(3))
            a, b, c = haversine_meters(*p, *r), haversine_meters(*r, *n), haversine_meters(*p, *n)
            detour = self.estimator.minutes(a) + self.estimator.minutes(b) - self.estimator.minutes(c)
            if (a + b - c) / 1000 > budget:
                self.assertGreater(detour, 20)

    def test_invalid_config_rejected(self):
        bad = copy.deepcopy(POLICY["routeEstimate"])
        bad["speedBandsKmh"][-1]["maxKm"] = 50
        with self.assertRaises(ValueError):
            RouteEstimator(bad)


class ProviderTests(unittest.TestCase):
    def test_route_contract_without_network(self):
        provider = EstimatedRouteProvider(POLICY["routeEstimate"])
        with patch.object(route_provider, "urlopen", side_effect=AssertionError("network must not be used")):
            leg = provider.route({"placeId": "a", "lng": 126.5, "lat": 33.5}, {"placeId": "b", "lng": 126.56, "lat": 33.25},
                                 "2026-10-01T10:00:00+09:00")
        for field in ("durationSeconds", "durationMinutes", "distanceMeters", "provider", "providerVersion",
                      "predictionBasis", "routeRef", "departureTime", "queriedAt", "geometry"):
            self.assertIn(field, leg)
        self.assertEqual(leg["durationSeconds"], leg["durationMinutes"] * 60)
        self.assertEqual((leg["provider"], leg["predictionBasis"]), ("estimated_haversine", "distance_estimate"))
        self.assertFalse(provider.external)
        self.assertTrue(provider.configured)
        same = provider.route({"placeId": "a", "lng": 126.5, "lat": 33.5}, {"placeId": "a2", "lng": 126.5, "lat": 33.5},
                              "2026-10-01T10:00:00+09:00")
        self.assertEqual(same["durationSeconds"], 0)

    def test_invalid_inputs(self):
        provider = EstimatedRouteProvider()
        with self.assertRaises(ProviderError):
            provider.route({"lng": 126.5, "lat": 33.5}, {"lng": 126.6, "lat": 33.5}, "2026-10-01T10:00:00+09:00", mode="walk")
        with self.assertRaises(ProviderError):
            provider.route({"lng": "x", "lat": 33.5}, {"lng": 126.6, "lat": 33.5}, "2026-10-01T10:00:00+09:00")
        with self.assertRaises(ProviderError):
            provider.route({"lng": 126.5, "lat": 33.5}, {"lng": 126.6, "lat": 33.5}, "2026-10-01T10:00:00")

    def test_provider_selection_defaults_to_estimate_without_kakao_key(self):
        self.assertIsInstance(create_route_provider(POLICY, environ={}), EstimatedRouteProvider)
        self.assertIsInstance(create_route_provider(POLICY, environ={"ITINERARY_ROUTE_PROVIDER": "estimate"}), EstimatedRouteProvider)
        kakao = create_route_provider(POLICY, environ={"ITINERARY_ROUTE_PROVIDER": "kakao"})
        self.assertIsInstance(kakao, KakaoRouteProvider)
        self.assertFalse(kakao.configured)
        with self.assertRaises(ValueError):
            create_route_provider(POLICY, environ={"ITINERARY_ROUTE_PROVIDER": "google"})


class EstimatedItineraryTests(unittest.TestCase):
    def test_estimated_provider_skips_external_call_budget_and_marks_assumption(self):
        policy = copy.deepcopy(POLICY)
        policy["maxRouteCallsPerDay"] = 1
        policy["maxRouteCallsPerRequest"] = 1
        catalog = catalog_fixture()
        # Fixture places are 0.01° apart; give them a valid schedule under estimated times.
        proposal = {"stops": [{"placeId": "A", "arrival": "09:30", "departure": "10:30", "evidenceReviewIds": ["review-A"]},
                              {"placeId": "B", "arrival": "14:30", "departure": "15:30", "evidenceReviewIds": []}],
                    "mealSlots": [{"kind": "lunch", "start": "12:00", "end": "13:00"}, {"kind": "dinner", "start": "18:00", "end": "19:00"}],
                    "unscheduledPlaces": []}
        with patch("itinerary_validation.fresh", return_value=True):
            result = ItineraryService(catalog, FakeLLM([proposal]), EstimatedRouteProvider(policy["routeEstimate"]), policy=policy).generate(request_fixture())
        day = result["days"][0]
        self.assertEqual(day["status"], "validated", day["violations"])
        self.assertGreater(result["provenance"]["calls"]["routes"], 1)
        self.assertTrue(all(leg["provider"] == "estimated_haversine" for leg in day["legs"]))
        self.assertIn("route_estimated", {item["code"] for item in day["assumptions"]})
        self.assertEqual(result["provenance"]["routeProvider"], "estimated_haversine")
        self.assertEqual(result["schemaVersion"], "itinerary-result-v2")
        self.assertEqual(result["restaurantIntegrationStatus"], "catalog_unavailable")
        self.assertEqual({slot["restaurantStatus"] for slot in day["mealSlots"]}, {"catalog_unavailable"})


if __name__ == "__main__":
    unittest.main()
