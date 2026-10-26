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
Non-empty LLM settings in ``.env`` win over inherited environment variables. Keys and prompts are
never printed; the startup diagnostic shows only names, sources and key formats.
"""
from __future__ import annotations

import argparse
import logging
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


# LLM settings in .env are this project's explicit choice: a non-empty .env value wins over an
# inherited environment variable (e.g. an OPENAI_API_KEY set globally for another tool).
LLM_ENV_NAMES = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "LLM_PROVIDER")
LLM_NAME_HINT = re.compile(r"GEMINI|GOOGLE|OPENAI|LLM", re.IGNORECASE)
KNOWN_LLM_NAMES = set(LLM_ENV_NAMES) | {"ITINERARY_LLM_MODEL", "ITINERARY_LLM_MAX_OUTPUT_TOKENS", "RESTAURANT_LLM_MODEL",
                                        "RESTAURANT_LLM_MAX_OUTPUT_TOKENS", "GEMINI_THINKING_LEVEL"}


def read_env_pairs(path):
    """Minimal KEY=VALUE parser for ``.env``. Values stay inside the program (SPEC-109)."""
    pairs = {}
    if not Path(path).is_file():
        return pairs
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
        pairs[key] = value
    return pairs


def load_env_file(path, environ=None):
    """Load ``.env``; existing environment variables win except non-empty LLM settings. Returns loaded keys."""
    environ = os.environ if environ is None else environ
    loaded = []
    for key, value in read_env_pairs(path).items():
        if key not in environ or (key in LLM_ENV_NAMES and value and environ.get(key) != value):
            environ[key] = value
            loaded.append(key)
    return loaded


def key_format(value):
    if value.startswith("AIza"):
        return "Google(Gemini) 형식"
    if value.startswith("sk-"):
        return "OpenAI 형식"
    return "알 수 없는 형식"


def describe_llm_settings(pairs, inherited, environ=None):
    """One diagnostic line per concern: names, sources and key formats only — never values."""
    environ = os.environ if environ is None else environ
    parts = []
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY"):
        value = str(environ.get(name, "")).strip()
        if not value:
            if name != "GOOGLE_API_KEY":
                parts.append(f"{name} 없음")
            continue
        source = ".env" if pairs.get(name, "").strip() == value else "시스템 환경변수"
        extra = ", 시스템 환경변수 값 대신 .env 사용" if source == ".env" and str(inherited.get(name, "")).strip() not in ("", value) else ""
        parts.append(f"{name} 있음({source}, {key_format(value)}{extra})")
    parts.append(f"LLM_PROVIDER {str(environ.get('LLM_PROVIDER', '')).strip() or 'auto'}")
    lines = ["키 진단: " + " · ".join(parts)]
    unknown = sorted(name for name, value in pairs.items() if value and LLM_NAME_HINT.search(name) and name not in KNOWN_LLM_NAMES)
    if unknown:
        lines.append("인식하지 않는 .env 이름: " + ", ".join(unknown) + " → Gemini 키는 GEMINI_API_KEY 이름으로 넣으세요.")
    return lines


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
    inherited = {name: os.environ.get(name, "") for name in LLM_ENV_NAMES}
    load_env_file(args.env_file)
    server, service, feedback_db = build_server(args.host, args.port)
    logging.basicConfig(level=logging.WARNING, format="[%(asctime)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
    from llm_client import llm_key_configured, llm_key_notices, resolve_llm_provider
    try:
        provider = resolve_llm_provider()
    except ValueError:
        provider = "알 수 없음(LLM_PROVIDER 확인)"
    key = llm_key_configured()
    key_name = "GEMINI_API_KEY" if provider == "gemini" else "OPENAI_API_KEY"
    print(f"Trip AI local: http://{args.host}:{args.port}/", flush=True)
    # Only "configured / missing" is printed; key values are never shown (SPEC-109).
    print(f"- LLM 공급자: {provider} · 키 {'설정됨' if key else f'없음 (.env에 {key_name} 또는 GEMINI_API_KEY를 넣으면 동선·식당 후보가 켜집니다)'}", flush=True)
    for notice in llm_key_notices():
        print(f"- 안내: {notice}", flush=True)
    for line in describe_llm_settings(read_env_pairs(args.env_file), inherited):
        print(f"- {line}", flush=True)
    if service is None:
        print("- 동선: 꺼짐 (ITINERARY_ENABLED=0 이거나 키·데이터 설정을 확인하세요)", flush=True)
    else:
        router = getattr(service.router, "provider", "unknown")
        restaurants = len(service.recommender.catalog.restaurants) if service.recommender else 0
        fallback = getattr(service.llm, "fallback_model", None)
        print(f"- 동선: 켜짐 · 이동시간 {router} · 시간표 모델 {getattr(service.llm, 'model', '?')}"
              + (f" (과부하·지연 시 {fallback})" if fallback else ""), flush=True)
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
