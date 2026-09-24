"""Kakao Mobility car routes, preserving direction and exact future departure time."""
from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from llm_client import ProviderError, request_json

KST = timezone(timedelta(hours=9))


class KakaoRouteProvider:
    provider = "kakao_mobility"
    version = "kakao-future-directions-v1"

    def __init__(self, api_key=None, *, opener=urlopen, now=None):
        self._api_key = api_key if api_key is not None else os.environ.get("KAKAO_MOBILITY_API_KEY", "")
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
