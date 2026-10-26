#!/usr/bin/env python3
"""SPEC-113 REQ-010: shared script I/O helpers keep the byte-level behavior of the code they replaced."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import data_io  # noqa: E402


class DataIoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_sha256_file_matches_hashlib(self):
        path = self.base / "blob.bin"
        path.write_bytes(os.urandom(3 * 1024 * 1024 + 17))
        self.assertEqual(data_io.sha256_file(path), hashlib.sha256(path.read_bytes()).hexdigest())

    def test_json_text_keeps_unicode_indent_and_trailing_newline(self):
        self.assertEqual(data_io.json_text({"장소": [1, None]}), '{\n  "장소": [\n    1,\n    null\n  ]\n}\n')

    def test_atomic_write_newline_modes_and_no_leftover(self):
        lf, native = self.base / "lf.txt", self.base / "native.txt"
        data_io.atomic_write_text(lf, "a\nb\n", newline="\n")
        data_io.atomic_write_text(native, "a\nb\n")
        self.assertEqual(lf.read_bytes(), b"a\nb\n")
        self.assertEqual(native.read_bytes(), "a\nb\n".replace("\n", os.linesep).encode("utf-8"))
        data_io.atomic_write_text(lf, "replaced", newline="\n")
        self.assertEqual(lf.read_text(encoding="utf-8"), "replaced")
        self.assertEqual(sorted(path.name for path in self.base.iterdir()), ["lf.txt", "native.txt"])

    def test_atomic_write_creates_parents_only_when_asked(self):
        nested = self.base / "a" / "b" / "c.json"
        with self.assertRaises(FileNotFoundError):
            data_io.atomic_write_text(nested, "{}")
        data_io.atomic_write_text(nested, "{}", make_parents=True)
        self.assertEqual(nested.read_text(encoding="utf-8"), "{}")

    def test_active_path_uses_the_manifest(self):
        manifest = json.loads(data_io.ACTIVE_DATASETS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(data_io.active_path("primaryTypes"), (data_io.ROOT / manifest["primaryTypes"]).resolve())
        with self.assertRaises(KeyError):
            data_io.active_path("missing-dataset")


if __name__ == "__main__":
    unittest.main()
