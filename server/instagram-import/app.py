"""Local web and CLI entry points for Instagram place import (SPEC-102)."""
from __future__ import annotations

import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from catalog import Catalog
from core import MODULE_DIR, Pipeline, atomic_json, make_extractor, normalize_url, now, summarize

ROOT = MODULE_DIR.parents[1]


from job_store import JobStore, Cancelled


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
                        "extraction_adapter": store.pipeline.ocr.adapter, "extraction_available": store.pipeline.ocr.available,
                        "model": getattr(store.pipeline.ocr, "model", None),
                        "ocr_adapter": "not_used" if store.pipeline.ocr.adapter == "gemini" else store.pipeline.ocr.adapter,
                        "ocr_available": store.pipeline.ocr.available if store.pipeline.ocr.adapter != "gemini" else False})
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
                match = re.fullmatch(r"/api/imports/([0-9a-f]{32})/(resolve|review-name|retry-extraction)", path)
                if match:
                    if match[2] == "retry-extraction":
                        return self._reply(202, store.retry_extraction(match[1]))
                    if match[2] == "review-name":
                        return self._reply(200, store.review_name(match[1], body.get("mention_id"), body.get("name")))
                    return self._reply(200, store.resolve(match[1], body.get("mention_id"), body.get("candidate_id")))
                self._reply(404, {"error": "not_found"})
            except ValueError as error:
                # Error codes are internal fixed strings; external exception messages are never returned.
                allowed = {"invalid_url", "invalid_body", "queue_full", "invalid_mention", "invalid_candidate", "invalid_name", "result_not_ready", "candidate_not_offered", "raw_expired", "retry_incompatible", "extraction_complete"}
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
    parser.add_argument("--extractor", "--ocr", dest="extractor", choices=["auto", "gemini", "easyocr", "windows"], default="auto")
    parser.add_argument("--model", help="Gemini model ID (default: GEMINI_MODEL or gemini-3.1-flash-lite)")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser("serve")
    serve.add_argument("--port", type=int, default=8091)
    serve.add_argument("--data-dir", type=Path, default=MODULE_DIR / ".data")
    run = sub.add_parser("import")
    run.add_argument("url")
    run.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    catalog = Catalog(ROOT)
    pipeline = Pipeline(catalog, ocr=make_extractor(args.extractor, args.model))
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
