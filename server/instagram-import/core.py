"""Code-only Instagram acquisition and the shared local import pipeline."""
from __future__ import annotations

import hashlib
import importlib.util
import io
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

MODULE_DIR = Path(__file__).resolve().parent
if (MODULE_DIR / ".deps").exists():
    sys.path.insert(0, str(MODULE_DIR / ".deps"))

from PIL import Image, ImageFilter, ImageOps
from extractor import extract_mentions

MAX_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(path)


def normalize_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("invalid_url")
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" or parsed.hostname not in {"instagram.com", "www.instagram.com"} or parsed.username or parsed.password:
        raise ValueError("invalid_url")
    if parsed.port not in {None, 443}:
        raise ValueError("invalid_url")
    match = re.fullmatch(r"/(p|reel|tv)/([A-Za-z0-9_-]{5,64})/?", parsed.path)
    if not match:
        raise ValueError("invalid_url")
    return f"https://www.instagram.com/{match[1]}/{match[2]}/", match[2]


def validate_media_url(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in {None, 443}:
        raise ValueError("invalid_media_url")
    if not any(host.endswith("." + suffix) for suffix in ["cdninstagram.com", "fbcdn.net"]):
        raise ValueError("unapproved_media_host")
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(addr[4][0]).is_global for addr in addresses):
        raise ValueError("unsafe_media_address")


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        validate_media_url(newurl)
        return super().redirect_request(request, response, code, message, headers, newurl)


def download_image(url, destination):
    validate_media_url(url)
    request = urllib.request.Request(url, headers={"User-Agent": "TripAI-LocalImport/1.0"})
    opener = urllib.request.build_opener(SafeRedirect())
    with opener.open(request, timeout=20) as response:
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_BYTES:
            raise ValueError("image_too_large")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("image_too_large")
    with Image.open(io.BytesIO(data)) as image:
        width, height = image.size
        if width * height > MAX_PIXELS or width < 32 or height < 32:
            raise ValueError("invalid_image_dimensions")
        image.verify()
    # Canonical JPEG strips EXIF and keeps only the decoded image needed for OCR.
    with Image.open(io.BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        output = io.BytesIO()
        image.save(output, "JPEG", quality=95)
        clean = output.getvalue()
        width, height = image.size
    destination.write_bytes(clean)
    return {"width": width, "height": height, "mime_type": "image/jpeg", "format": "JPEG",
            "byte_size": len(clean), "source_byte_size": len(data),
            "sha256": hashlib.sha256(clean).hexdigest(), "status": "downloaded",
            "frame_coverage": "unknown", "collected_at": now()}


class InstagramAcquirer:
    def acquire(self, url):
        import instaloader
        canonical, shortcode = normalize_url(url)
        loader = instaloader.Instaloader(quiet=True, sleep=False, request_timeout=20,
                                       max_connection_attempts=1, download_comments=False,
                                       save_metadata=False)
        post = instaloader.Post.from_shortcode(loader.context, shortcode)
        if post.typename == "GraphSidecar":
            nodes = [{"index": i, "is_video": node.is_video, "url": None if node.is_video else node.display_url}
                     for i, node in enumerate(post.get_sidecar_nodes(), 1)]
        else:
            nodes = [{"index": 1, "is_video": post.is_video, "url": None if post.is_video else post.url}]
        if len(nodes) > 60:
            raise ValueError("too_many_media")
        return {"canonical_url": canonical, "shortcode": shortcode, "caption": post.caption or "",
                "post_type": post.typename, "reported_media_count": post.mediacount, "nodes": nodes,
                "adapter": "instaloader", "adapter_version": instaloader.__version__, "collected_at": now()}


def _iou(first, second):
    x = max(first[0], second[0]); y = max(first[1], second[1])
    right = min(first[0] + first[2], second[0] + second[2])
    bottom = min(first[1] + first[3], second[1] + second[3])
    inter = max(0, right - x) * max(0, bottom - y)
    return inter / max(1, first[2] * first[3] + second[2] * second[3] - inter)


class LocalOCR:
    def __init__(self, adapter="easyocr"):
        if adapter not in {"easyocr", "windows"}:
            raise ValueError("invalid_ocr_adapter")
        self.adapter = adapter
        self.reader = None

    @property
    def available(self):
        return bool(importlib.util.find_spec("easyocr")) if self.adapter == "easyocr" else os.name == "nt" and bool(shutil.which("powershell"))

    def _read(self, image):
        if self.reader is None:
            import easyocr
            import torch
            torch.set_num_threads(min(4, os.cpu_count() or 1))
            self.reader = easyocr.Reader(["ko", "en"], gpu=False, verbose=False,
                                       model_storage_directory=str(MODULE_DIR / ".models"))
        import numpy as np
        result = self.reader.readtext(np.array(image), detail=1, paragraph=False, batch_size=8, width_ths=0.1)
        lines = []
        for corners, text, confidence in result:
            x = min(float(p[0]) for p in corners); y = min(float(p[1]) for p in corners)
            width = max(float(p[0]) for p in corners) - x
            height = max(float(p[1]) for p in corners) - y
            lines.append({"text": text, "bbox": [x, y, width, height], "confidence": round(float(confidence), 4)})
        return lines

    def recognize(self, assets, directory, progress=None):
        if self.adapter == "windows":
            return self._windows(assets, directory)
        rows = []
        for asset in assets:
            if asset["status"] != "downloaded":
                continue
            if progress:
                progress("extracting", f"사진 {asset['index']} 글자 읽기")
            try:
                with Image.open(directory / asset["filename"]) as image:
                    image = image.convert("RGB")
                    lines = self._read(image)
                    # White letters with dark/white outlines need their inner fill isolated.
                    mask = ImageOps.grayscale(image).point(lambda p: 0 if p > 228 else 255).filter(ImageFilter.MaxFilter(5))
                    import cv2
                    import numpy as np
                    pixels = np.array(mask)
                    _, components, stats, _ = cv2.connectedComponentsWithStats(255 - pixels, 8)
                    for label, (_, _, w, h, area) in enumerate(stats[1:], 1):
                        density = area / max(1, w * h)
                        if (w > 100 and w > h * 1.8 and density < 0.35) or w > h * 4 or area > image.width * image.height * 0.25:
                            pixels[components == label] = 255
                    extra = self._read(mask) + self._read(Image.fromarray(pixels))
                    for new in extra:
                        overlap = [i for i, old in enumerate(lines) if _iou(old["bbox"], new["bbox"]) > 0.4]
                        if overlap:
                            best = max([new] + [lines[i] for i in overlap], key=lambda l: l["confidence"])
                            lines = [old for i, old in enumerate(lines) if i not in overlap] + [best]
                        else:
                            lines.append(new)
                    lines.sort(key=lambda l: (l["bbox"][1], l["bbox"][0]))
                    rows.append({"index": asset["index"], "status": "complete", "width": image.width,
                                 "height": image.height, "lines": lines})
            except Exception as error:
                rows.append({"index": asset["index"], "status": "failed", "error": type(error).__name__, "lines": []})
        return rows

    def _windows(self, assets, directory):
        items = [{"index": a["index"], "variant": "full", "path": str((directory / a["filename"]).resolve())}
                 for a in assets if a["status"] == "downloaded"]
        with tempfile.TemporaryDirectory(prefix="trip-ai-ocr-") as scratch:
            input_path = Path(scratch) / "input.json"
            atomic_json(input_path, items)
            completed = subprocess.run(["powershell", "-NoProfile", "-File", str(MODULE_DIR / "ocr_windows.ps1"),
                                        "-InputPath", str(input_path)], capture_output=True, timeout=120,
                                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            if completed.returncode:
                raise RuntimeError("windows_ocr_unavailable")
            return json.loads(completed.stdout.decode("utf-8-sig"))


class Pipeline:
    def __init__(self, catalog, acquirer=None, ocr=None, downloader=download_image):
        self.catalog = catalog
        self.acquirer = acquirer or InstagramAcquirer()
        self.ocr = ocr or LocalOCR()
        self.downloader = downloader

    def run(self, url, directory, progress=None):
        canonical, shortcode = normalize_url(url)
        directory.mkdir(parents=True, exist_ok=True)
        emit = progress or (lambda stage, detail: None)
        emit("acquiring", "게시물 확인")
        post = self.acquirer.acquire(canonical)
        nodes = post.pop("nodes")
        result = {"schema_version": "instagram-place-import-v1", "status": "processing", "source": post,
                  "assets": [], "mentions": [], "warnings": [], "provenance": {
                      "extractor_version": "ocr-layout-mentions-v1", "resolver_version": "snapshot-identity-v1",
                      "ocr_adapter": getattr(self.ocr, "adapter", "fixture"), "catalog": self.catalog.provenance}}
        assets = result["assets"]
        total = 0
        for node in nodes:
            index = node["index"]
            if node["is_video"]:
                assets.append({"index": index, "kind": "video", "status": "not_processed"})
                continue
            emit("downloading", f"사진 {index} 다운로드")
            asset = {"index": index, "kind": "image", "filename": f"image_{index:02d}.jpg"}
            try:
                if total >= MAX_TOTAL_BYTES:
                    raise ValueError("job_media_limit")
                downloaded = self.downloader(node["url"], directory / asset["filename"])
                total += downloaded["source_byte_size"]
                if total > MAX_TOTAL_BYTES:
                    (directory / asset["filename"]).unlink(missing_ok=True)
                    raise ValueError("job_media_limit")
                asset.update(downloaded)
            except Exception as error:
                asset.update(status="failed", error=type(error).__name__)
            assets.append(asset)
        expected = sum(not n["is_video"] for n in nodes)
        downloaded = sum(a["status"] == "downloaded" for a in assets)
        videos = len(nodes) - expected
        enumeration_ok = len(nodes) == post["reported_media_count"]
        result["coverage"] = {"reported_media_count": post["reported_media_count"], "enumerated_media_count": len(nodes),
                              "expected_image_count": expected, "downloaded_image_count": downloaded, "video_count": videos,
                              "enumeration": "complete" if enumeration_ok else "partial",
                              "images": "complete" if expected == downloaded and enumeration_ok else "partial",
                              "carousel": "complete" if enumeration_ok else "partial",
                              "video": "not_processed" if videos else "absent",
                              "caption": "available" if post["caption"] else "missing"}
        if videos:
            result["warnings"].append({"code": "video_not_processed", "count": videos})
        if expected != downloaded or not enumeration_ok:
            result["warnings"].append({"code": "partial_media"})
        emit("extracting", "사진에서 장소 추출")
        try:
            ocr_rows = self.ocr.recognize(assets, directory, emit)
        except Exception as error:
            ocr_rows = []
            result["warnings"].append({"code": "extraction_unavailable", "error": type(error).__name__})
        atomic_json(directory / "ocr.json", ocr_rows)
        ocr_complete = sum(row["status"] == "complete" for row in ocr_rows)
        result["coverage"]["ocr_processed_image_count"] = ocr_complete
        result["coverage"]["ocr"] = "complete" if ocr_complete == downloaded else "partial"
        emit("resolving", "기존 장소·메타데이터·라벨 확인")
        result["mentions"] = extract_mentions(post["caption"], ocr_rows, self.catalog)
        if not result["mentions"]:
            result["warnings"].append({"code": "no_place_mentions"})
        if ocr_complete != downloaded:
            result["warnings"].append({"code": "partial_extraction"})
        summarize(result)
        fingerprint = json.dumps({"url": post["canonical_url"], "caption": post["caption"],
                                  "images": [a.get("sha256") for a in assets if a["kind"] == "image"]}, ensure_ascii=False, sort_keys=True)
        result["provenance"]["input_digest"] = hashlib.sha256(fingerprint.encode()).hexdigest()
        result["provenance"]["processed_at"] = now()
        return result


def summarize(result):
    mentions = result["mentions"]
    result["counts"] = {"extracted": len(mentions),
                        "resolved": sum(m["resolution"] == "resolved" for m in mentions),
                        "needs_review": sum(m["resolution"] == "needs_review" for m in mentions),
                        "not_found": sum(m["resolution"] == "not_found" for m in mentions),
                        "labels_linked": sum((m.get("labels") or {}).get("status") == "linked" for m in mentions),
                        "labels_missing": sum((m.get("labels") or {}).get("status") == "labels_missing" for m in mentions)}
    result["status"] = "partial" if any(w["code"] in {"partial_media", "partial_extraction", "extraction_unavailable"} for w in result["warnings"]) else (
        "needs_review" if result["counts"]["needs_review"] or result["counts"]["not_found"] else "complete")
