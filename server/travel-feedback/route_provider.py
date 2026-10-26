"""Route providers for itinerary legs.

SPEC-107 (user decision D2): the default provider is a deterministic distance-based
estimate that never calls an external API. The Kakao Mobility future-route provider is
kept for an explicit opt-in (`ITINERARY_ROUTE_PROVIDER=kakao`).
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from http_client import ProviderError, request_json
import settings
from timeutil import KST


class KakaoRouteProvider:
    provider = "kakao_mobility"
    version = "kakao-future-directions-v1"

    def __init__(self, api_key=None, *, opener=urlopen, now=None):
        self._api_key = api_key if api_key is not None else settings.env("KAKAO_MOBILITY_API_KEY")
        self._opener = opener
        self._now = now or (lambda: datetime.now(KST))

    @property
    def configured(self):
        return bool(self._api_key)

    def route(self, origin, destination, departure, mode="car", timeout=10):
        if mode != "car":
            raise ProviderError("unsupported_route_mode")
        if not self._api_key:
            raise ProviderError("route_not_configured")
        try:
            planned = datetime.fromisoformat(departure)
            if planned.utcoffset() is None:
                raise ValueError()
            planned = planned.astimezone(KST)
            points = [(float(item["lng"]), float(item["lat"])) for item in (origin, destination)]
            if any(not math.isfinite(x) or not math.isfinite(y) or not (-180 <= x <= 180 and -90 <= y <= 90) for x, y in points):
                raise ValueError()
        except (KeyError, TypeError, ValueError):
            raise ProviderError("route_invalid_input") from None
        queried_at = self._now()
        if planned <= queried_at:
            # The current-time endpoint cannot honestly provide historical forecasts.
            raise ProviderError("route_departure_not_future")
        params = {"origin": f"{points[0][0]},{points[0][1]}", "destination": f"{points[1][0]},{points[1][1]}",
                  "departure_time": planned.strftime("%Y%m%d%H%M"), "priority": "RECOMMEND",
                  "summary": "false", "alternatives": "false"}
        request = Request("https://apis-navi.kakaomobility.com/v1/future/directions?" + urlencode(params),
                          headers={"Authorization": "KakaoAK " + self._api_key, "Content-Type": "application/json"})
        response = request_json(request, timeout, self._opener, max_bytes=4_000_000)
        routes = response.get("routes", [])
        if not isinstance(routes, list) or not routes or not isinstance(routes[0], dict) or routes[0].get("result_code") != 0:
            raise ProviderError("route_not_found")
        route = routes[0]
        summary = route.get("summary", {})
        if not isinstance(summary, dict):
            raise ProviderError("route_invalid_response")
        seconds, distance = summary.get("duration"), summary.get("distance")
        if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) or x < 0 for x in (seconds, distance)):
            raise ProviderError("route_invalid_response")
        if points[0] != points[1] and seconds == 0:
            raise ProviderError("route_invalid_response")
        path = []
        sections = route.get("sections", [])
        if not isinstance(sections, list):
            raise ProviderError("route_invalid_response")
        for section in sections:
            if not isinstance(section, dict) or not isinstance(section.get("roads", []), list):
                raise ProviderError("route_invalid_response")
            for road in section.get("roads", []):
                if not isinstance(road, dict):
                    raise ProviderError("route_invalid_response")
                vertices = road.get("vertexes", [])
                if not isinstance(vertices, list) or len(vertices) % 2:
                    raise ProviderError("route_invalid_response")
                for i in range(0, len(vertices), 2):
                    point = vertices[i:i + 2]
                    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in point):
                        raise ProviderError("route_invalid_response")
                    if not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                        raise ProviderError("route_invalid_response")
                    if not path or point != path[-1]:
                        path.append(point)
        cache_identity = {"provider": self.version, "mode": mode, "params": params}
        digest = hashlib.sha256(json.dumps(cache_identity, sort_keys=True).encode()).hexdigest()[:24]
        return {"fromId": origin.get("placeId", origin.get("id")), "toId": destination.get("placeId", destination.get("id")),
                "durationSeconds": seconds, "durationMinutes": math.ceil(seconds / 60), "distanceMeters": distance,
                "provider": self.provider, "providerVersion": self.version, "mode": "car",
                "queriedAt": queried_at.isoformat(), "departureAt": planned.isoformat(), "departureTime": planned.isoformat(),
                "predictionBasis": "future_departure_prediction", "routeRef": f"kakao:{digest}", "path": path}


ESTIMATE_DEFAULTS = {
    "version": "haversine-road-factor-v1",
    "roadFactor": 1.35,
    "speedBandsKmh": [{"maxKm": 3, "kmh": 25}, {"maxKm": 15, "kmh": 40}, {"maxKm": None, "kmh": 55}],
    "fixedOverheadMinutes": 3,
}
EARTH_RADIUS_METERS = 6_371_008.8


def haversine_meters(lng1, lat1, lng2, lat2):
    """Great-circle distance in meters; arguments are WGS84 longitude, latitude pairs."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlambda = phi2 - phi1, math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(a)))


class RouteEstimator:
    """Monotonic, concave distance→minutes estimate (development default, not measured).

    Road distance = straight distance × roadFactor. Driving time accumulates band by band
    (first 3km at 25km/h, next 12km at 40km/h, rest at 55km/h) so a longer trip never takes
    less time. A fixed parking/boarding overhead is added once per leg and the total is
    rounded up to whole minutes. Points closer than 1m are the same location (0 minutes).
    """

    def __init__(self, config=None):
        config = {**ESTIMATE_DEFAULTS, **(config or {})}
        self.version = str(config["version"])
        self.road_factor = float(config["roadFactor"])
        self.overhead = float(config["fixedOverheadMinutes"])
        bands, previous = [], 0.0
        for band in config["speedBandsKmh"]:
            upper = math.inf if band.get("maxKm") is None else float(band["maxKm"])
            speed = float(band["kmh"])
            if not (upper > previous and speed > 0 and math.isfinite(speed)):
                raise ValueError("invalid_route_estimate_band")
            bands.append((previous, upper, speed))
            previous = upper
        if not bands or bands[-1][1] != math.inf or self.road_factor < 1 or self.overhead < 0:
            raise ValueError("invalid_route_estimate_config")
        self.bands = bands
        # Smallest minutes-per-straight-km slope; used for a lossless prefilter.
        self.min_minutes_per_straight_km = self.road_factor * 60 / max(speed for _, _, speed in bands)

    def driving_minutes(self, road_km):
        minutes = 0.0
        for lower, upper, speed in self.bands:
            if road_km <= lower:
                break
            minutes += (min(road_km, upper) - lower) / speed * 60
        return minutes

    def minutes(self, straight_meters):
        if not math.isfinite(straight_meters) or straight_meters < 0:
            raise ValueError("invalid_distance")
        if straight_meters < 1:
            return 0
        road_km = straight_meters / 1000 * self.road_factor
        # Round to 1e-9 first so exact boundaries are not pushed up by float noise.
        return math.ceil(round(self.driving_minutes(road_km) + self.overhead, 9))

    def between(self, origin, destination):
        meters = haversine_meters(float(origin["lng"]), float(origin["lat"]), float(destination["lng"]), float(destination["lat"]))
        return self.minutes(meters), meters

    def straight_km_budget(self, detour_minutes):
        """Max extra straight-line km (a+b-c) that can still fit a detour budget (lossless).

        Driving time f is increasing and concave with f(0)=0, so f(a)+f(b)-f(c) >= slope_min*(a+b-c).
        With the overhead on each leg and ceil rounding, ceil(f(c)+o) < f(c)+o+1, hence
        detour > slope_min*(a+b-c) + o - 1. Legs under 1 m (0 minutes) only arise when the
        excess is below 2 m, covered by the 0.002 km floor.
        """
        return max(0.002, (detour_minutes - self.overhead + 1) / self.min_minutes_per_straight_km)


class EstimatedRouteProvider:
    """Kakao-free route provider (SPEC-107). Never performs network I/O."""
    provider = "estimated_haversine"
    external = False

    def __init__(self, config=None, *, now=None):
        self.estimator = RouteEstimator(config)
        self.version = self.estimator.version
        self._now = now or (lambda: datetime.now(KST))

    @property
    def configured(self):
        return True

    def route(self, origin, destination, departure, mode="car", timeout=10):
        if mode != "car":
            raise ProviderError("unsupported_route_mode")
        try:
            planned = datetime.fromisoformat(departure)
            if planned.utcoffset() is None:
                raise ValueError()
            points = [(float(item["lng"]), float(item["lat"])) for item in (origin, destination)]
            if any(not math.isfinite(x) or not math.isfinite(y) or not (-180 <= x <= 180 and -90 <= y <= 90) for x, y in points):
                raise ValueError()
        except (KeyError, TypeError, ValueError):
            raise ProviderError("route_invalid_input") from None
        minutes, meters = self.estimator.between({"lng": points[0][0], "lat": points[0][1]}, {"lng": points[1][0], "lat": points[1][1]})
        identity = {"provider": self.version, "points": points}
        digest = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:24]
        return {"fromId": origin.get("placeId", origin.get("id")), "toId": destination.get("placeId", destination.get("id")),
                "durationSeconds": minutes * 60, "durationMinutes": minutes,
                "distanceMeters": round(meters * self.estimator.road_factor),
                "straightDistanceMeters": round(meters),
                "provider": self.provider, "providerVersion": self.version, "mode": "car",
                "queriedAt": self._now().isoformat(), "departureAt": planned.astimezone(KST).isoformat(),
                "departureTime": planned.astimezone(KST).isoformat(),
                "predictionBasis": "distance_estimate", "routeRef": f"estimate:{digest}", "geometry": []}


def create_route_provider(policy, name=None, environ=None):
    """Select the configured provider; unknown names raise ValueError (feature stays off)."""
    environ = os.environ if environ is None else environ
    name = (name or settings.env("ITINERARY_ROUTE_PROVIDER", environ) or "estimate").strip().lower()
    if name == "estimate":
        return EstimatedRouteProvider((policy or {}).get("routeEstimate"))
    if name == "kakao":
        return KakaoRouteProvider(settings.env("KAKAO_MOBILITY_API_KEY", environ))
    raise ValueError("unsupported_route_provider")
