#!/usr/bin/env python3
"""Run the map UI and travel API together on one local origin (SPEC-107 D8).

Put an LLM key (Gemini or OpenAI) in the repository root ``.env`` (Git-ignored, never read by AI
agents — SPEC-109) and run:

    python scripts/run_trip_ai_local.py
    # open http://127.0.0.1:8080

``.env`` example::

    GEMINI_API_KEY=...            # or OPENAI_API_KEY=...
    # optional: LLM_PROVIDER=gemini, ITINERARY_LLM_MODEL=gemini-3.8-flash, RESTAURANT_LLM_MODEL=...

Without a key the map and recommendations still work and the itinerary section reports
that the feature is not configured. Route times are distance estimates (no Kakao key).
Feedback written locally goes to a temporary SQLite file, never to the shared server.
Keys and prompts are never printed.
"""
from __future__ import annotations

import argparse
import mimetypes
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server/travel-feedback"
MAP_UI = ROOT / "map-ui"
REVIEW_ALIAS = re.compile(r"^/(?:travel/)?api/places/([0-9]+)/reviews$")


def load_env_file(path, environ=None):
    """Minimal KEY=VALUE reader; existing environment variables win. Returns loaded keys."""
    environ = os.environ if environ is None else environ
    loaded = []
    if not Path(path).is_file():
        return loaded
    for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        key, separator, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if key not in environ:
            environ[key] = value
            loaded.append(key)
    return loaded


def static_target(path):
    """Map a URL path to a file under map-ui, or None.

    The decoded path is validated as plain POSIX segments BEFORE touching the filesystem so
    Windows drive/UNC forms (``C:``, ``\\server``), NUL bytes and ``..`` never reach ``resolve``.
    """
    relative = unquote(path)
    if relative == "/travel" or relative.startswith("/travel/"):
        relative = relative[len("/travel"):] or "/"
    if any(character in relative for character in ("\\", ":", "\x00")):
        return None
    parts = [part for part in relative.split("/") if part]
    if any(part in (".", "..") for part in parts):
        return None
    if not parts or relative.endswith("/"):
        parts.append("index.html")
    try:
        root = MAP_UI.resolve()
        target = root.joinpath(*parts).resolve()
        if root not in target.parents or not target.is_file():
            return None
    except (OSError, ValueError):
        return None
    return target


def build_server(host, port):
    sys.path.insert(0, str(SERVER_DIR))
    import feedback_api  # noqa: E402  (after sys.path and environment are prepared)

    class LocalHandler(feedback_api.FeedbackRequestHandler):
        server_version = "TripAILocal/1"

        def log_message(self, format_string, *args):
            path = urlsplit(self.path).path
            if path.startswith("/travel/api/") or path == "/healthz":
                super().log_message(format_string, *args)

        def do_GET(self):  # noqa: N802
            path = urlsplit(self.path).path
            alias = REVIEW_ALIAS.fullmatch(path)
            if alias:
                query = urlsplit(self.path).query
                self.path = f"/travel/api/places/{alias.group(1)}/reviews" + (f"?{query}" if query else "")
                return super().do_GET()
            if path.startswith("/travel/api/") or path == "/healthz":
                return super().do_GET()
            self.serve_static(path)

        def serve_static(self, path):
            target = static_target(path)
            if target is None:
                self.send_json(404, {"ok": False, "error": "not_found"})
                return
            body = target.read_bytes()
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if content_type.startswith("text/") or target.suffix in (".js", ".json"):
                content_type = ("text/javascript" if target.suffix == ".js" else content_type) + "; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    origin = f"http://{host}:{port}"
    extra = tuple({f"http://127.0.0.1:{port}", f"http://localhost:{port}"} - {origin})
    data_dir = Path(tempfile.gettempdir()) / "trip-ai-local"
    feedback_db = os.environ.get("TRAVEL_FEEDBACK_DB_PATH") or str(data_dir / "feedback.sqlite3")
    review_db = os.environ.get("TRAVEL_REVIEW_DB_PATH") or str(SERVER_DIR / "data/kakao_reviews.sqlite3")
    try:
        review_store = feedback_api.ReviewStore(review_db)
    except Exception:
        review_store = None
    service = feedback_api.load_itinerary_service()
    server = feedback_api.FeedbackHTTPServer(
        (host, port), feedback_api.FeedbackStore(feedback_db), origin, review_store=review_store,
        itinerary_service=service,
        itinerary_per_minute=int(os.environ.get("ITINERARY_REQUESTS_PER_MINUTE", "30")),
        itinerary_per_day=int(os.environ.get("ITINERARY_REQUESTS_PER_DAY", "300")),
        additional_origins=extra, handler_class=LocalHandler)
    return server, service, feedback_db


def main():
    parser = argparse.ArgumentParser(description="Trip AI local runner (map UI + API on one origin)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    args = parser.parse_args()
    load_env_file(args.env_file)
    server, service, feedback_db = build_server(args.host, args.port)
    from llm_client import llm_key_configured, resolve_llm_provider
    try:
        provider = resolve_llm_provider()
    except ValueError:
        provider = "알 수 없음(LLM_PROVIDER 확인)"
    key = llm_key_configured()
    key_name = "GEMINI_API_KEY" if provider == "gemini" else "OPENAI_API_KEY"
    print(f"Trip AI local: http://{args.host}:{args.port}/", flush=True)
    # Only "configured / missing" is printed; key values are never shown (SPEC-109).
    print(f"- LLM 공급자: {provider} · 키 {'설정됨' if key else f'없음 (.env에 {key_name} 또는 GEMINI_API_KEY를 넣으면 동선·식당 후보가 켜집니다)'}", flush=True)
    if service is None:
        print("- 동선: 꺼짐 (ITINERARY_ENABLED=0 이거나 키·데이터 설정을 확인하세요)", flush=True)
    else:
        router = getattr(service.router, "provider", "unknown")
        restaurants = len(service.recommender.catalog.restaurants) if service.recommender else 0
        print(f"- 동선: 켜짐 · 이동시간 {router} · 시간표 모델 {getattr(service.llm, 'model', '?')}", flush=True)
        print(f"- 식당 후보: {'%d곳 카탈로그' % restaurants if restaurants else '카탈로그 없음 (scripts/build_restaurant_meal_catalog.py)'}"
              + (f" · 판정 모델 {service.recommender.model}" if service.recommender else ""), flush=True)
    print(f"- 로컬 평가 저장 위치: {feedback_db}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
