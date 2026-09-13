"""Check the deployed Vercel proxy; --write-test stores one synthetic session.

No real participant data is read. The synthetic session remains subject to the
existing retention policy and must be excluded from participant analysis.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit


PUBLIC_ORIGIN = "https://trip-ai-wine-eight.vercel.app"
BACKEND_ORIGIN = "https://168-107-40-231.sslip.io"
FEEDBACK_PATH = "/travel/api/feedback"
MAP_DIR = Path(__file__).resolve().parents[1] / "map-ui"


def request(url: str, *, body: bytes | None = None, origin: str | None = None):
    headers = {"User-Agent": "TripAI-DeploymentCheck/SPEC-081", "Accept-Encoding": "gzip"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if origin is not None:
        headers["Origin"] = origin
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        content = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            content = gzip.decompress(content)
        return response.status, content, response.headers


def require(condition: bool, description: str) -> None:
    if not condition:
        raise RuntimeError(description)
    print("PASS", description, flush=True)


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        path = attrs.get("src") if tag == "script" else attrs.get("href") if tag == "link" else None
        if path and not urlsplit(path).scheme and not path.startswith("//"):
            self.paths.append(path)


def check_readonly() -> None:
    status, html, _ = request(PUBLIC_ORIGIN + "/")
    require(status == 200 and html == (MAP_DIR / "index.html").read_bytes(), "public HTML matches checkout")
    assets = Assets()
    assets.feed(html.decode("utf-8"))
    for asset in assets.paths:
        status, body, _ = request(urljoin(PUBLIC_ORIGIN + "/", asset))
        path = MAP_DIR / urlsplit(asset).path.lstrip("/")
        require(status == 200 and hashlib.sha256(body).digest() == hashlib.sha256(path.read_bytes()).digest(), f"static asset {asset}")
    for path in ("/docs/README.md", "/server/travel-feedback/feedback_api.py", "/travel/api/feedback", "/api/places/not-a-number/reviews"):
        status, _, _ = request(PUBLIC_ORIGIN + path)
        require(status == 404, f"unpublished path {path}")
    status, _, _ = request(BACKEND_ORIGIN + "/travel/")
    require(status == 200, "existing travel page remains available")
    for query in ("?limit=1&offset=0", "?limit=1&offset=1"):
        path = "/api/places/126471/reviews" + query
        status, body, _ = request(PUBLIC_ORIGIN + path)
        original_status, original, _ = request(BACKEND_ORIGIN + "/travel" + path)
        require(status == original_status == 200 and json.loads(body) == json.loads(original), "reviews and query preserved " + query)
    for origin in ("https://untrusted.example", "https://trip-ai-wine-eight.vercel.app.untrusted.example", "https://trip-ai-wine-eightXvercelYapp", "null"):
        status, body, _ = request(PUBLIC_ORIGIN + FEEDBACK_PATH, body=b"{}", origin=origin)
        require(status == 403 and json.loads(body).get("error") == "origin_not_allowed", "reject origin " + origin)
    for body, expected in ((b"{", 400), (b"{}", 422)):
        status, _, headers = request(PUBLIC_ORIGIN + FEEDBACK_PATH, body=body, origin=PUBLIC_ORIGIN)
        require(status == expected and "no-store" in headers.get("Cache-Control", ""), f"validation status {expected}, no-store")


def synthetic_payload(session_id: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "schema_version": "travel-recommendation-feedback-log-v3",
        "participant_name": "DEPLOYMENT-TEST-SPEC081",
        "session_id": session_id,
        "revision": 1,
        "created_at": now,
        "updated_at": now,
        "storage": {"method": "server_autosave", "endpoint": FEEDBACK_PATH, "server_transmitted": True, "web_storage_used": False},
        "source": {"ui_version": "deployment-smoke-spec081", "algorithm_version": "synthetic-test"},
        "user_selections": {"request": {}},
        "recommendation_result": {"items": []},
        "feedback": {
            "required_place_count": 1,
            "completed_place_count": 1,
            "all_scores_completed": True,
            "entries": [{"place_id": "123", "title": "Synthetic deployment test", "contexts": [{"kind": "recommendation", "rank": 1}], "score": 5, "score_label": "test", "comment": "Synthetic SPEC-081 check; exclude from participant analysis."}],
        },
    }


def post_payload(origin: str, payload: dict):
    status, body, headers = request(origin + FEEDBACK_PATH, body=json.dumps(payload).encode("utf-8"), origin=origin)
    receipt = json.loads(body)
    require(receipt.get("ok") is True and receipt.get("session_id") == payload["session_id"], "storage receipt identifies test session")
    require("no-store" in headers.get("Cache-Control", ""), "storage response is not cached")
    return status, receipt


def check_write() -> None:
    session_id = str(uuid.uuid4())
    print("SYNTHETIC_SESSION_ID", session_id, flush=True)
    first = synthetic_payload(session_id)
    status, receipt = post_payload(PUBLIC_ORIGIN, first)
    require(status == 201 and receipt.get("created") is True and receipt.get("revision") == 1, "Vercel creates revision 1")
    status, receipt = post_payload(BACKEND_ORIGIN, first)
    require(status == 200 and receipt.get("created") is False and receipt.get("revision") == 1, "original server sees the same saved session")
    second = copy.deepcopy(first)
    second["revision"] = 2
    second["updated_at"] = datetime.now(timezone.utc).isoformat()
    second["feedback"]["entries"][0]["score"] = 4
    status, receipt = post_payload(PUBLIC_ORIGIN, second)
    require(status == 200 and receipt.get("created") is False and receipt.get("revision") == 2, "Vercel updates the existing session to revision 2")
    status, receipt = post_payload(BACKEND_ORIGIN, second)
    require(status == 200 and receipt.get("created") is False and receipt.get("revision") == 2, "original server confirms revision 2")
    status, receipt = post_payload(PUBLIC_ORIGIN, first)
    require(status == 200 and receipt.get("stale") is True and receipt.get("revision") == 2, "old revision cannot overwrite the latest stored value")
    print("Retained synthetic session:", session_id, "participant_name=DEPLOYMENT-TEST-SPEC081", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-test", action="store_true", help="store one clearly marked synthetic session in the existing production DB")
    args = parser.parse_args()
    check_readonly()
    if args.write_test:
        check_write()


if __name__ == "__main__":
    main()
