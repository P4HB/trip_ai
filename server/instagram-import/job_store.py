"""Local import job lifecycle, persistence, cancellation and retention."""
from __future__ import annotations
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
from pathlib import Path
from core import atomic_json, normalize_url, now, summarize
from extractor import resolve_mention
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

    def _work(self, job_id, retry=False):
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
                previous = copy.deepcopy(self.jobs[job_id].get("result")) if retry else None
                if retry:
                    for file in self._path(job_id).iterdir():
                        if file.is_file() and (file.name == "extraction.json" or re.fullmatch(r"image_\d{2}\.jpg", file.name)):
                            shutil.copyfile(file, scratch / file.name)
            result = self.pipeline.retry_extraction(previous, scratch, progress) if retry else self.pipeline.run(url, scratch, progress)
            with self.lock:
                if self._cancelled(job_id):
                    return
                directory = self._path(job_id)
                for file in scratch.iterdir():
                    if file.is_file() and (file.name in {"ocr.json", "extraction.json"} or re.fullmatch(r"image_\d{2}\.jpg", file.name)):
                        shutil.copyfile(file, directory / file.name)
                job = self.jobs[job_id]
                job.update(state="finished", stage="finished", detail="분석 완료", result=result, updated_at=now())
                self._save(job)
        except Cancelled:
            pass
        except Exception as error:
            with self.lock:
                if not self._cancelled(job_id):
                    self.jobs[job_id].update(state="finished" if retry else "failed", stage="finished" if retry else "failed",
                                             detail="재시도하지 못했습니다" if retry else "게시물을 처리하지 못했습니다",
                                             error=type(error).__name__, updated_at=now())
                    self._save(self.jobs[job_id])
        finally:
            # Only this explicitly created temporary directory is recursively removed.
            if scratch.parent.resolve() == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith("trip-ai-import-"):
                shutil.rmtree(scratch, ignore_errors=True)

    def get(self, job_id):
        with self.lock:
            self.cleanup()
            job = copy.deepcopy(self.jobs[job_id])
            job["can_retry_extraction"] = False
            if job["state"] == "finished" and job.get("result") and not job.get("raw_expired"):
                try:
                    self.pipeline.can_retry(job["result"])
                    job["can_retry_extraction"] = True
                except ValueError:
                    pass
            return job

    def retry_extraction(self, job_id):
        with self.lock:
            self.cleanup()
            job = self.jobs[job_id]
            if job["state"] != "finished" or not job.get("result"):
                raise ValueError("result_not_ready")
            if job.get("raw_expired"):
                raise ValueError("raw_expired")
            self.pipeline.can_retry(job["result"])
            if sum(j["state"] in {"queued", "processing"} for j in self.jobs.values()) >= 4:
                raise ValueError("queue_full")
            job.update(state="queued", stage="queued", detail="실패 사진 분석 대기", updated_at=now())
            self._save(job)
            self.executor.submit(self._work, job_id, True)
            return self.get(job_id)

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
                    (directory / "extraction.json").unlink(missing_ok=True)
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
