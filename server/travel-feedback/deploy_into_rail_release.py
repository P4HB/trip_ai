#!/usr/bin/env python3
"""Install the travel feedback sidecar into a copied Rail Desk release."""

from __future__ import annotations

import argparse
from pathlib import Path


SERVICE_BLOCK = """  travel-feedback:
    image: rail-desk-travel-feedback:${APP_VERSION:-dev}
    build:
      context: ./travel-feedback
      dockerfile: Dockerfile
    init: true
    restart: unless-stopped
    expose:
      - "8200"
    environment:
      TRAVEL_PUBLIC_ORIGIN: ${RAIL_PUBLIC_ORIGIN:?Set RAIL_PUBLIC_ORIGIN in .env}
      TRAVEL_FEEDBACK_DB_PATH: /data/feedback.sqlite3
      TRAVEL_FEEDBACK_RETENTION_DAYS: 90
      TRAVEL_REVIEW_DB_PATH: /app/data/kakao_reviews.sqlite3
    volumes:
      - travel_feedback_data:/data
    mem_limit: 96m
    mem_reservation: 24m
    cpus: 0.5
    pids_limit: 64
    ulimits:
      core:
        soft: 0
        hard: 0
    read_only: true
    tmpfs:
      - /tmp:size=16m,noexec,nosuid,nodev
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    logging: *default-logging
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - import urllib.request; urllib.request.urlopen('http://127.0.0.1:8200/healthz', timeout=2)
      interval: 15s
      timeout: 3s
      retries: 5
      start_period: 10s

"""

CADDY_BLOCK = """\t\t@travel_api path /travel/api/feedback /travel/api/places/*/reviews
\t\thandle @travel_api {
\t\t\treverse_proxy travel-feedback:8200 {
\t\t\t\theader_up X-Travel-Client-IP {remote_host}
\t\t\t}
\t\t}

"""

PREVIOUS_CADDY_BLOCK = """\t\t@travel_feedback path /travel/api/feedback
\t\thandle @travel_feedback {
\t\t\treverse_proxy travel-feedback:8200 {
\t\t\t\theader_up X-Travel-Client-IP {remote_host}
\t\t\t}
\t\t}

"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"expected one {label} anchor, found {text.count(old)}")
    return text.replace(old, new, 1)


def install(release: Path, version: str) -> None:
    resolved = release.resolve(strict=True)
    releases_root = Path("/opt/rail-desk/releases").resolve()
    if releases_root not in resolved.parents:
        raise RuntimeError("release must be a concrete directory under /opt/rail-desk/releases")

    compose_path = resolved / "compose.yaml"
    compose = compose_path.read_text(encoding="utf-8")
    if "  travel-feedback:\n" not in compose:
        compose = replace_once(compose, "  edge:\n", SERVICE_BLOCK + "  edge:\n", "edge service")
        depends = """    depends_on:
      rail-api:
        condition: service_healthy
"""
        depends_with_feedback = depends + """      travel-feedback:
        condition: service_healthy
"""
        compose = replace_once(compose, depends, depends_with_feedback, "edge dependency")
        compose = replace_once(
            compose,
            "  rail_api_data:\n",
            "  rail_api_data:\n  travel_feedback_data:\n",
            "volume list",
        )
        compose_path.write_text(compose, encoding="utf-8")

    caddy_path = resolved / "deploy" / "Caddyfile"
    caddy = caddy_path.read_text(encoding="utf-8")
    legacy_caddy_block = """\t\t@travel_feedback path /travel/api/feedback
\t\thandle @travel_feedback {
\t\t\treverse_proxy travel-feedback:8200
\t\t}

"""
    if PREVIOUS_CADDY_BLOCK in caddy:
        caddy = replace_once(caddy, PREVIOUS_CADDY_BLOCK, CADDY_BLOCK, "travel API route")
        caddy_path.write_text(caddy, encoding="utf-8")
    elif legacy_caddy_block in caddy:
        caddy = replace_once(caddy, legacy_caddy_block, CADDY_BLOCK, "legacy travel feedback route")
        caddy_path.write_text(caddy, encoding="utf-8")
    elif "@travel_api path" not in caddy:
        caddy = replace_once(
            caddy,
            "\t\t@travel_no_slash path /travel\n",
            CADDY_BLOCK + "\t\t@travel_no_slash path /travel\n",
            "travel route",
        )
        caddy_path.write_text(caddy, encoding="utf-8")

    activate_path = resolved / "deploy" / "activate-release.sh"
    activate = activate_path.read_text(encoding="utf-8")
    activate_mode = activate_path.stat().st_mode
    build_line = "docker compose --env-file .env build --pull travel-feedback\n"
    if build_line not in activate:
        activate = replace_once(
            activate,
            "docker compose --env-file .env build --pull edge\n",
            "docker compose --env-file .env build --pull edge\n" + build_line,
            "edge build",
        )
        activate_path.write_text(activate, encoding="utf-8")
        activate_path.chmod(activate_mode)

    env_path = resolved / ".env"
    env_text = env_path.read_text(encoding="utf-8")
    lines = env_text.splitlines()
    matches = [index for index, line in enumerate(lines) if line.startswith("APP_VERSION=")]
    if len(matches) != 1:
        raise RuntimeError(f"expected one APP_VERSION, found {len(matches)}")
    lines[matches[0]] = f"APP_VERSION={version}"
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("release", type=Path)
    parser.add_argument("version")
    args = parser.parse_args()
    install(args.release, args.version)


if __name__ == "__main__":
    main()
