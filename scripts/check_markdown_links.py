#!/usr/bin/env python3
"""SPEC-113 AC-005: report broken relative links in tracked Markdown files.

Checks inline links and images (``[text](target)``) whose target is a repository path; external URLs,
in-page anchors and links inside code spans/blocks are ignored. Fragments and queries are stripped.

    python -X utf8 scripts/check_markdown_links.py
"""
from __future__ import annotations

from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
FENCE = re.compile(r"^\s*(```|~~~)")
CODE_SPAN = re.compile(r"`[^`\n]*`")
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.IGNORECASE)


def tracked_markdown() -> list[Path]:
    listing = subprocess.run(["git", "ls-files", "-z", "--", "*.md"], cwd=ROOT, capture_output=True, check=True)
    return [ROOT / name for name in listing.stdout.decode("utf-8").split("\0") if name]


def broken_links(path: Path) -> list[tuple[int, str]]:
    found = []
    in_fence = False
    for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for match in LINK.finditer(CODE_SPAN.sub("", line)):
            target = match.group(1)
            if EXTERNAL.match(target):
                continue
            relative = unquote(target.split("#", 1)[0].split("?", 1)[0])
            resolved = (ROOT / relative.lstrip("/")) if relative.startswith("/") else (path.parent / relative)
            if relative and not resolved.exists():
                found.append((number, target))
    return found


def main() -> int:
    problems = [(path, number, target) for path in tracked_markdown() if path.exists() for number, target in broken_links(path)]
    for path, number, target in problems:
        print(f"{path.relative_to(ROOT).as_posix()}:{number}: {target}")
    if problems:
        print(f"FAIL: {len(problems)} broken relative Markdown link(s)", file=sys.stderr)
        return 1
    print(f"PASS: relative Markdown links resolve ({len(tracked_markdown())} tracked files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
