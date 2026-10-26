"""Shared file I/O for active data scripts; Python counterpart of data_io.mjs (SPEC-113 REQ-010).

Frozen label-lineage scripts and files whose hashes are pinned in data manifests keep their own
helpers on purpose.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ACTIVE_DATASETS_PATH = ROOT / "config/active_datasets.json"


def sha256_file(path: str | Path) -> str:
    """Hex SHA-256 of a file's bytes, read in 1 MiB chunks."""
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_text(value: Any) -> str:
    """Pretty JSON document text used by the collectors and builders (non-ASCII kept, trailing newline)."""
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def atomic_write_text(path: str | Path, text: str, *, newline: str | None = None, make_parents: bool = False) -> None:
    """Write ``<name>.tmp`` beside the target and replace the target with it.

    ``newline=None`` keeps Python's platform newline translation, which is what most existing call sites
    relied on; pass ``"\\n"`` where a caller always wrote LF.
    """
    path = Path(path)
    if make_parents:
        path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline=newline)
    temporary.replace(path)


def active_datasets() -> dict[str, Any]:
    return json.loads(ACTIVE_DATASETS_PATH.read_text(encoding="utf-8"))


def active_path(key: str) -> Path:
    """Workspace path of an active dataset registered in config/active_datasets.json."""
    relative = active_datasets().get(key)
    if not isinstance(relative, str):
        raise KeyError(f"Unknown dataset: {key}")
    resolved = (ROOT / relative).resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError(f"Dataset outside workspace: {key}")
    return resolved
