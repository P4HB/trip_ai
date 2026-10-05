"""Local web and CLI entry points for Instagram place import (SPEC-102)."""
from __future__ import annotations

import argparse
import copy
import json
import re
import shutil
import stat
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from catalog import Catalog
from core import MODULE_DIR, LocalOCR, Pipeline, atomic_json, normalize_url, now, summarize
from extractor import resolve_mention

ROOT = MODULE_DIR.parents[1]
ID = re.compile(r"[0-9a-f]{32}")


class Cancelled(Exception):
    pass


class JobStore:
    def __init__(self, directory, pipeline):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.pipeline = pipeline
        self.lock = threading.RLock()
        self.jobs = {}
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="instagram-import")
        for path in self.directory.glob("*/job.json"):
            if not ID.fullmatch(path.parent.name):
                continue
            try:
                job = json.loads(path.read_text(encoding="utf-8"))
                if job["state"] in {"queued", "processing"}:
                    job.update(state="interrupted", stage="interrupted", detail="서버 재시작으로 중단됨")
                    atomic_json(path, job)
                elif job["state"] == "deleting":
                    job.update(state="delete_failed", stage="delete_failed", detail="삭제를 다시 시도해주세요")
                    atomic_json(path, job)
                self.jobs[job["job_id"]] = job
            except (ValueError, KeyError):
                continue
        self.cleanup()

    def _path(self, job_id):
        if not ID.fullmatch(job_id):
            raise KeyError(job_id)
        target = (self.directory / job_id).resolve()
        if not target.is_relative_to(self.directory) or target == self.directory:
            raise ValueError("unsafe_job_path")
        return target

    def _save(self, job):
        atomic_json(self._path(job["job_id"]) / "job.json", job)

    def _cancelled(self, job_id):
        return job_id not in self.jobs or self.jobs[job_id]["state"] in {"deleting", "delete_failed"}

    def submit(self, url):
        canonical, _ = normalize_url(url)
        with self.lock:
            self.cleanup()
            if sum(j["state"] in {"queued", "processing"} for j in self.jobs.values()) >= 4:
                raise ValueError("queue_full")
            job_id = uuid.uuid4().hex
            job = {"job_id": job_id, "state": "queued", "stage": "queued", "detail": "처리 대기",
                   "created_at": now(), "updated_at": now(), "url": canonical, "result": None}
            self.jobs[job_id] = job
            self._save(job)
            self.executor.submit(self._work, job_id)
            return self.get(job_id)

    def _work(self, job_id):
        import tempfile
        scratch = Path(tempfile.mkdtemp(prefix="trip-ai-import-"))
        try:
            def progress(stage, detail):
                with self.lock:
                    if self._cancelled(job_id):
                        raise Cancelled()
                    job = self.jobs[job_id]
                    job.update(state="processing", stage=stage, detail=detail, updated_at=now())
                    self._save(job)

            with self.lock:
                if self._cancelled(job_id):
                    return
                url = self.jobs[job_id]["url"]
            result = self.pipeline.run(url, scratch, progress)
            with self.lock:
                if self._cancelled(job_id):
                    return
                directory = self._path(job_id)
                for file in scratch.iterdir():
                    if file.is_file() and (file.name == "ocr.json" or re.fullmatch(r"image_\d{2}\.jpg", file.name)):
                        shutil.copyfile(file, directory / file.name)
                job = self.jobs[job_id]
                job.update(state="finished", stage="finished", detail="분석 완료", result=result, updated_at=now())
                self._save(job)
        except Cancelled:
            pass
        except Exception as error:
            with self.lock:
                if not self._cancelled(job_id):
                    self.jobs[job_id].update(state="failed", stage="failed", detail="게시물을 처리하지 못했습니다",
                                             error=type(error).__name__, updated_at=now())
                    self._save(self.jobs[job_id])
        finally:
            # Only this explicitly created temporary directory is recursively removed.
            if scratch.parent.resolve() == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith("trip-ai-import-"):
                shutil.rmtree(scratch, ignore_errors=True)

    def get(self, job_id):
        with self.lock:
            self.cleanup()
            return copy.deepcopy(self.jobs[job_id])

    def resolve(self, job_id, mention_id, candidate_id):
        if not isinstance(candidate_id, str) or not 1 <= len(candidate_id) <= 100:
            raise ValueError("invalid_candidate")
        with self.lock:
            job = self.jobs[job_id]
            if job["state"] != "finished" or not job.get("result"):
                raise ValueError("result_not_ready")
            mention = next((m for m in job["result"]["mentions"] if m["mention_id"] == mention_id), None)
            if mention is None:
                raise ValueError("invalid_mention")
            resolve_mention(mention, self.pipeline.catalog, candidate_id)
            summarize(job["result"])
            job["updated_at"] = now()
            self._save(job)
            return self.get(job_id)

    def delete(self, job_id):
        with self.lock:
            if job_id not in self.jobs:
                raise KeyError(job_id)
            directory = self._path(job_id)
            job = self.jobs[job_id]
            job.update(state="deleting", stage="deleting", detail="작업 삭제 중", updated_at=now())
            def writable_retry(action, path, error):
                target = Path(path).resolve()
                if not isinstance(error[1], PermissionError) or not target.is_relative_to(directory):
                    raise error[1]
                target.chmod(target.stat().st_mode | stat.S_IWRITE)
                action(path)
            try:
                if directory.is_dir():
                    shutil.rmtree(directory, onerror=writable_retry)
            except OSError:
                job.update(state="delete_failed", stage="delete_failed", detail="파일 잠금 해제 후 삭제를 다시 시도해주세요", updated_at=now())
                try:
                    self._save(job)
                except OSError:
                    pass
                raise RuntimeError("delete_failed") from None
            del self.jobs[job_id]

    def review_name(self, job_id, mention_id, name):
        if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100:
            raise ValueError("invalid_name")
        with self.lock:
            job = self.jobs[job_id]
            if job["state"] != "finished" or not job.get("result"):
                raise ValueError("result_not_ready")
            mention = next((m for m in job["result"]["mentions"] if m["mention_id"] == mention_id), None)
            if mention is None:
                raise ValueError("invalid_mention")
            mention["corrected_name"] = name.strip()
            mention["name_review"] = {"method": "user_correction", "reviewed_at": now()}
            resolve_mention(mention, self.pipeline.catalog)
            summarize(job["result"])
            job["updated_at"] = now()
            self._save(job)
            return self.get(job_id)

    def cleanup(self, at=None):
        with self.lock:
            instant = at or datetime.now(timezone.utc)
            for job_id, job in list(self.jobs.items()):
                created = datetime.fromisoformat(job["created_at"])
                age = (instant - created).total_seconds()
                if age > 7 * 86400:
                    try:
                        self.delete(job_id)
                    except RuntimeError:
                        continue
                elif age > 86400 and job.get("result") and not job.get("raw_expired"):
                    directory = self._path(job_id)
                    for file in directory.glob("image_*.jpg"):
                        file.unlink(missing_ok=True)
                    (directory / "ocr.json").unlink(missing_ok=True)
                    result = job["result"]
                    result["source"]["caption"] = None
                    for asset in result["assets"]:
                        if asset["kind"] == "image":
                            asset["storage_status"] = "expired"
                    for mention in result["mentions"]:
                        for evidence in mention["evidence"]:
                            evidence.pop("context", None)
                            evidence["asset_status"] = "expired"
                    job["raw_expired"] = True
                    self._save(job)

    def asset(self, job_id, order):
        with self.lock:
            self.cleanup()
            job = self.jobs[job_id]
            result = job.get("result") or {}
            asset = next((a for a in result.get("assets", []) if a["index"] == order and a["kind"] == "image" and a["status"] == "downloaded"), None)
            if not asset or job.get("raw_expired"):
                raise KeyError(order)
            return (self._path(job_id) / asset["filename"]).read_bytes()

    def close(self):
        self.executor.shutdown(wait=True, cancel_futures=True)


def handler_class(store):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_):
            pass

        def _host_ok(self):
            port = self.server.server_port
            return self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"}

        def _write_ok(self):
            origin = self.headers.get("Origin")
            port = self.server.server_port
            return self._host_ok() and (origin is None or origin in {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}) and self.headers.get("Sec-Fetch-Site") not in {"cross-site"}

        def _reply(self, status, value, mime="application/json; charset=utf-8", download=False):
            data = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
            if download:
                self.send_header("Content-Disposition", 'attachment; filename="instagram-import.json"')
            self.end_headers()
            self.wfile.write(data)

        def _body(self):
            length = int(self.headers.get("Content-Length", 0))
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json" or not 0 < length <= 8192:
                raise ValueError("invalid_body")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("invalid_body")
            return body

        def do_GET(self):
            if not self._host_ok():
                return self._reply(403, {"error": "invalid_host"})
            path = urlsplit(self.path).path
            try:
                if path == "/api/health":
                    return self._reply(200, {"catalog_count": len(store.pipeline.catalog.places),
                                             "ocr_adapter": store.pipeline.ocr.adapter, "ocr_available": store.pipeline.ocr.available})
                match = re.fullmatch(r"/api/imports/([0-9a-f]{32})(?:/(export|assets/([0-9]{1,2})))?", path)
                if match:
                    if match[3] is not None:
                        return self._reply(200, store.asset(match[1], int(match[3])), "image/jpeg")
                    job = store.get(match[1])
                    return self._reply(200, job.get("result") if match[2] == "export" else job, download=match[2] == "export")
                files = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/styles.css": ("styles.css", "text/css; charset=utf-8")}
                if path in files:
                    filename, mime = files[path]
                    return self._reply(200, (MODULE_DIR / "web" / filename).read_bytes(), mime)
                self._reply(404, {"error": "not_found"})
            except (KeyError, FileNotFoundError):
                self._reply(404, {"error": "not_found"})

        def do_POST(self):
            if not self._write_ok():
                return self._reply(403, {"error": "invalid_origin_or_host"})
            try:
                body = self._body()
                path = urlsplit(self.path).path
                if path == "/api/imports":
                    job = store.submit(body.get("url"))
                    return self._reply(202, {"job_id": job["job_id"]})
                match = re.fullmatch(r"/api/imports/([0-9a-f]{32})/(resolve|review-name)", path)
                if match:
                    if match[2] == "review-name":
                        return self._reply(200, store.review_name(match[1], body.get("mention_id"), body.get("name")))
                    return self._reply(200, store.resolve(match[1], body.get("mention_id"), body.get("candidate_id")))
                self._reply(404, {"error": "not_found"})
            except ValueError as error:
                # Error codes are internal fixed strings; external exception messages are never returned.
                allowed = {"invalid_url", "invalid_body", "queue_full", "invalid_mention", "invalid_candidate", "invalid_name", "result_not_ready", "candidate_not_offered"}
                code = str(error) if str(error) in allowed else "invalid_request"
                self._reply(429 if code == "queue_full" else 400, {"error": code})
            except KeyError:
                self._reply(404, {"error": "not_found"})

        def do_DELETE(self):
            if not self._write_ok():
                return self._reply(403, {"error": "invalid_origin_or_host"})
            match = re.fullmatch(r"/api/imports/([0-9a-f]{32})", urlsplit(self.path).path)
            try:
                if not match:
                    raise KeyError()
                store.delete(match[1])
                self._reply(200, {"deleted": True})
            except KeyError:
                self._reply(404, {"error": "not_found"})
            except RuntimeError:
                self._reply(500, {"error": "delete_failed"})
    return Handler


def main():
    parser = argparse.ArgumentParser(description="Instagram 장소 추출·기존 라벨 연결")
    parser.add_argument("--ocr", choices=["easyocr", "windows"], default="easyocr")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser("serve")
    serve.add_argument("--port", type=int, default=8091)
    serve.add_argument("--data-dir", type=Path, default=MODULE_DIR / ".data")
    run = sub.add_parser("import")
    run.add_argument("url")
    run.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    catalog = Catalog(ROOT)
    pipeline = Pipeline(catalog, ocr=LocalOCR(args.ocr))
    if args.command == "import":
        try:
            result = pipeline.run(args.url, args.output.resolve(), lambda stage, detail: print(f"{stage}: {detail}", flush=True))
            atomic_json(args.output / "result.json", result)
            print(json.dumps({"status": result["status"], "coverage": result["coverage"], "counts": result["counts"]}, ensure_ascii=False))
        except Exception as error:
            print(json.dumps({"status": "failed", "error": type(error).__name__}))
            raise SystemExit(1)
        return
    store = JobStore(args.data_dir, pipeline)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_class(store))
    server.daemon_threads = True
    print(f"Instagram 장소 가져오기: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        store.close()


if __name__ == "__main__":
    main()
