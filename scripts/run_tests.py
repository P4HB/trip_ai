#!/usr/bin/env python3
"""SPEC-113 REQ-003: run every Python, Node and browser regression plus the golden comparisons.

    python -X utf8 scripts/run_tests.py            # everything, in order
    python -X utf8 scripts/run_tests.py -k golden  # only checks whose name contains "golden"
    python -X utf8 scripts/run_tests.py --list

Browser checks need the Node ``playwright`` package. When it is not installed, the runner reuses the
Python Playwright driver (same browsers) through a shim under ``tmp/test-runtime``. After the run it
fails if any check left new or modified files in the working tree outside the Git-ignored ``tmp/``.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "tmp/test-runtime"
PY = (sys.executable, "-X", "utf8")
PLACE_TYPES = Path("data/labeling/jeju/2026-09-11/place-types-v1")
LABELING_PROFILES = Path("data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/place_profiles.json")


def crlf_paths(*paths: Path) -> list[str]:
    return [path.as_posix() for path in paths if b"\r\n" in (ROOT / path).read_bytes()]


def labeling_review_environment() -> str | None:
    crlf = crlf_paths(LABELING_PROFILES)
    return f"pinned byte hash needs an LF checkout; CRLF working copy: {', '.join(crlf)}" if crlf else None


def place_types_environment() -> str | None:
    # SQLite records the writing library version in the header (offset 96), so pinned bytes need the same library.
    header = (ROOT / PLACE_TYPES / "place_types.sqlite3").read_bytes()[96:100]
    pinned = int.from_bytes(header, "big")
    major, minor, patch = sqlite3.sqlite_version_info
    if major * 1_000_000 + minor * 1_000 + patch != pinned:
        return (f"pinned SQLite bytes were written by SQLite {pinned // 1_000_000}.{pinned // 1_000 % 1_000}.{pinned % 1_000}; "
                f"this Python uses {sqlite3.sqlite_version}")
    crlf = crlf_paths(*(PLACE_TYPES / name for name in ("manifest.json", "place_types.jsonl", "report.md")))
    return f"pinned byte hashes need an LF checkout; CRLF working copy: {', '.join(crlf)}" if crlf else None


@dataclass(frozen=True)
class Check:
    name: str
    command: tuple[str, ...]
    browser: bool = False
    # Returns a reason when the environment cannot reproduce pinned bytes; the check is then reported as SKIP.
    precondition: Callable[[], str | None] | None = None


def node(script: str) -> tuple[str, ...]:
    return ("node", f"scripts/{script}")


CHECKS = [
    Check("python: server travel-feedback", (*PY, "-m", "unittest", "discover", "-s", "server/travel-feedback")),
    Check("python: instagram import", (*PY, "scripts/test_instagram_import.py")),
    Check("python: instagram gemini", (*PY, "scripts/test_instagram_gemini.py")),
    Check("python: kakao restaurant collector", (*PY, "scripts/test_kakao_restaurant_collector.py")),
    Check("python: restaurant catalog", (*PY, "scripts/test_restaurant_catalog.py")),
    Check("python: restaurant coordinates", (*PY, "scripts/test_restaurant_coordinates.py")),
    Check("python: restaurant query db", (*PY, "scripts/test_restaurant_query_db.py")),
    Check("python: place types (pinned outputs)", (*PY, "scripts/test_place_types.py"), precondition=place_types_environment),
    Check("node: ccu-mmr", node("test_ccu_mmr.cjs")),
    Check("node: daily type limit", node("test_daily_type_limit.cjs")),
    Check("node: preference weight budget", node("test_preference_weight_budget.cjs")),
    Check("node: preference elicitation", node("test_preference_elicitation.cjs")),
    Check("node: dashboard static contract", node("validate_ccu_mmr_dashboard.cjs")),
    Check("node: review contracts", node("test_review_contracts.cjs")),
    Check("node: instagram import ui", node("test_instagram_import_ui.cjs")),
    Check("node: labeling review model (pinned outputs)", node("test_labeling_review_model.mjs"), precondition=labeling_review_environment),
    Check("golden: js outputs", node("check_golden_outputs.cjs")),
    Check("golden: python outputs", (*PY, "scripts/check_golden_outputs.py")),
    Check("browser: itinerary ui", node("test_itinerary_ui.cjs"), browser=True),
    Check("browser: feedback completion", node("test_feedback_completion.cjs"), browser=True),
    Check("browser: dashboard behavior", node("test_dashboard_behavior.cjs"), browser=True),
]


def node_resolves(module: str, env: dict[str, str]) -> bool:
    probe = subprocess.run(["node", "-e", f"require.resolve({json.dumps(module)})"], cwd=ROOT, env=env, capture_output=True)
    return probe.returncode == 0


def playwright_environment(env: dict[str, str]) -> tuple[dict[str, str], str]:
    """Resolve the Node playwright package, falling back to the Python Playwright driver."""
    if node_resolves("playwright", env):
        return env, "node playwright package"
    spec = importlib.util.find_spec("playwright")
    driver = Path(spec.origin).parent / "driver" / "package" if spec and spec.origin else None
    if driver and (driver / "package.json").exists():
        shim = RUNTIME / "node_modules" / "playwright"
        shim.mkdir(parents=True, exist_ok=True)
        (shim / "index.js").write_text(f"module.exports = require({json.dumps(driver.as_posix())});\n", encoding="utf-8")
        (shim / "package.json").write_text('{"name": "playwright", "main": "index.js"}\n', encoding="utf-8")
        shimmed = dict(env, NODE_PATH=os.pathsep.join(filter(None, [str(shim.parent), env.get("NODE_PATH")])))
        if node_resolves("playwright", shimmed):
            return shimmed, f"Python Playwright driver ({driver})"
    return env, ""


def working_tree() -> set[str]:
    status = subprocess.run(["git", "status", "--porcelain=v1", "--untracked-files=all"], cwd=ROOT, capture_output=True,
                            text=True, encoding="utf-8", check=True)
    return set(status.stdout.splitlines())


def tail(text: str, lines: int = 30) -> str:
    return "\n".join(text.rstrip().splitlines()[-lines:])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("-k", dest="filters", action="append", default=[], help="run checks whose name contains this text (repeatable)")
    parser.add_argument("--list", action="store_true", help="list checks and exit")
    parser.add_argument("-v", "--verbose", action="store_true", help="print the full output of every check")
    args = parser.parse_args()
    checks = [check for check in CHECKS if not args.filters or any(text in check.name for text in args.filters)]
    if args.list:
        for check in checks:
            print(f"{check.name}: {' '.join(check.command)}")
        return 0
    if not checks:
        print("No checks match the filter.", file=sys.stderr)
        return 1
    if not shutil.which("node"):
        print("node is not on PATH.", file=sys.stderr)
        return 1

    env = dict(os.environ, PYTHONUTF8="1")
    browser_source = ""
    if any(check.browser for check in checks):
        env, browser_source = playwright_environment(env)
        print(f"Browser checks use: {browser_source or 'unavailable (install the Node playwright package)'}")
    before = working_tree()
    results = []
    started = time.monotonic()
    for index, check in enumerate(checks, 1):
        label = f"[{index:>2}/{len(checks)}] {check.name}"
        skip = check.precondition() if check.precondition else None
        if check.browser and not browser_source:
            results.append((check, "FAIL", 0.0, "Node playwright package is not available."))
            print(f"{label:<60} FAIL")
            continue
        if skip:
            results.append((check, "SKIP", 0.0, skip))
            print(f"{label:<60} SKIP")
            continue
        check_started = time.monotonic()
        run = subprocess.run(check.command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        elapsed = time.monotonic() - check_started
        output = run.stdout + run.stderr
        status = "PASS" if run.returncode == 0 else "FAIL"
        results.append((check, status, elapsed, output))
        print(f"{label:<60} {status} {elapsed:6.1f}s")
        if args.verbose:
            print(output)

    leftovers = sorted(working_tree() - before)
    failed = [result for result in results if result[1] == "FAIL"]
    skipped = [result for result in results if result[1] == "SKIP"]
    print(f"\n{len(results) - len(failed) - len(skipped)} passed, {len(skipped)} skipped, {len(failed)} failed "
          f"in {time.monotonic() - started:.1f}s")
    for check, _, _, reason in skipped:
        print(f"SKIP {check.name}: {reason}")
    for check, _, _, output in failed:
        print(f"\nFAIL {check.name}: {' '.join(check.command)}\n{tail(output)}")
    if leftovers:
        print("\nFAIL checks changed the working tree outside tmp/:")
        for line in leftovers:
            print(f"  {line}")
    return 1 if failed or leftovers else 0


if __name__ == "__main__":
    sys.exit(main())
