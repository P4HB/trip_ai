"""Resumable Jeju restaurant inventory and public review batches (SPEC-085).

python scripts/collect_kakao_jeju_restaurant_reviews.py --output-dir data/kakao/jeju/2026-09-21/restaurants
Re-run the identical command to resume. Create STOP in the output directory to pause.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import time
from dataclasses import asdict
from contextlib import contextmanager
from collections import deque
from concurrent.futures import Future, ThreadPoolExecutor
from queue import Empty, Queue
from threading import Event

from collect_kakao_jeju_tourism_reviews import JEJU_REGIONS
from kakao_restaurant_review_crawler import (
    VERSION, Place, build_driver, classify, collect_detail, collect_query, now,
)

ROOT = Path(__file__).resolve().parents[1]
SUBTERMS = ["한식", "중식", "일식", "양식", "분식", "고기", "해산물", "치킨",
            "피자", "햄버거", "아시아음식", "뷔페", "도시락", "샐러드", "술집"]
REFINEMENTS = {
    '음식점': SUBTERMS,
    '한식': ['한정식', '백반', '국밥', '국수', '해장국', '찌개', '전골', '두부', '비빔밥',
           '죽', '족발', '보쌈', '곱창', '막창', '닭요리', '오리요리', '샤브샤브', '감자탕',
           '설렁탕', '곰탕', '칼국수', '냉면', '수제비', '추어탕', '순대', '아구찜', '고기', '해산물'],
    '고기': ['흑돼지', '삼겹살', '갈비', '소고기', '양고기', '닭갈비'],
    '해산물': ['횟집', '생선구이', '전복', '갈치', '고등어', '조개', '해물탕', '매운탕'],
    '일식': ['돈까스', '초밥', '라멘', '우동', '소바', '덮밥'],
    '양식': ['스테이크', '파스타', '이탈리안', '프랑스음식', '멕시칸'],
    '분식': ['김밥', '떡볶이', '순대', '만두', '라면'],
    '술집': ['호프', '포장마차', '칵테일바', '와인바', '요리주점'],
}
PLACE_FIELDS = list(Place.__dataclass_fields__)
REVIEW_FIELDS = ["query", "place_id", "place_name", "place_url", "rating", "date", "content", "tags", "likes", "collected_at"]
SUMMARY_FIELDS = ["place_id", "place_name", "place_url", "average_rating_5", "visitor_review_count",
                  "blog_review_count", "review_status", "collected_review_count", "collected_at"] + [f"top_review_{i}" for i in range(1, 6)]
HOURS_FIELDS = ['place_id', 'place_name', 'place_url', 'status', 'hours_text', 'opening_hours',
                'closed_days', 'break_time', 'last_order', 'schedule_json', 'source_url', 'checked_at', 'error']
VERIFIED_HOURS_STATUSES = ('available', 'not_provided')


def packed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


@contextmanager
def output_lock(directory):
    handle = (directory / ".collector.lock").open("a+b")
    try:
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            if handle.read(1) == b"":
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        raise RuntimeError("Another collector is using this output directory") from None
    try:
        yield
    finally:
        handle.close()


class Store:
    def __init__(self, directory: Path, settings: dict):
        self.directory = directory
        self.db = sqlite3.connect(directory / "collection.sqlite3")
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS queries(
              query TEXT PRIMARY KEY, region TEXT NOT NULL, term TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending', pages INTEGER DEFAULT 0,
              reported_count INTEGER, seen_count INTEGER DEFAULT 0,
              attempts INTEGER DEFAULT 0, error TEXT DEFAULT '', updated_at TEXT);
            CREATE TABLE IF NOT EXISTS places(
              place_id TEXT PRIMARY KEY, payload TEXT NOT NULL, classification TEXT NOT NULL,
              detail_status TEXT NOT NULL DEFAULT 'pending', summary TEXT, error TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS discoveries(
              query TEXT REFERENCES queries(query), place_id TEXT REFERENCES places(place_id),
              PRIMARY KEY(query,place_id));
            CREATE TABLE IF NOT EXISTS reviews(
              place_id TEXT REFERENCES places(place_id), position INTEGER, payload TEXT NOT NULL,
              PRIMARY KEY(place_id,position));
            CREATE TABLE IF NOT EXISTS business_hours(
              place_id TEXT PRIMARY KEY REFERENCES places(place_id),
              status TEXT NOT NULL, payload TEXT NOT NULL);
        """)
        saved = self.db.execute("SELECT value FROM metadata WHERE key='settings'").fetchone()
        if saved and json.loads(saved[0]) != settings:
            self.db.close()
            raise ValueError("Output settings differ. Use the original settings or a new output directory.")
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO metadata VALUES('settings',?)", (packed(settings),))
            self.db.execute("INSERT OR IGNORE INTO metadata VALUES('started_at',?)", (packed(now()),))
            self.db.execute("UPDATE queries SET status='pending' WHERE status='running'")
            for row in self.db.execute("SELECT place_id,payload FROM places WHERE classification IN ('category_unknown','address_unknown')").fetchall():
                place = json.loads(row['payload'])
                self.db.execute("UPDATE places SET classification=? WHERE place_id=?",
                                (classify(place['address'],place['category']),row['place_id']))

    def add_query(self, region, term):
        self.db.execute("INSERT OR IGNORE INTO queries(query,region,term) VALUES(?,?,?)",
                        (f"{region} {term}", region, term))

    def save_page(self, query, places, pages, reported_count, seen_count):
        with self.db:
            for place in places:
                kind = classify(place.address, place.category)
                self.db.execute("INSERT INTO places(place_id,payload,classification) VALUES(?,?,?) "
                                "ON CONFLICT(place_id) DO NOTHING", (place.place_id, packed(asdict(place)), kind))
                self.db.execute("INSERT OR IGNORE INTO discoveries VALUES(?,?)", (query, place.place_id))
            self.db.execute("UPDATE queries SET pages=?,reported_count=?,seen_count=?,updated_at=? WHERE query=?",
                            (pages, reported_count, seen_count, now(), query))

    def finish_query(self, query, result):
        with self.db:
            self.db.execute("UPDATE queries SET status=?,pages=?,reported_count=?,seen_count=?,error='',updated_at=? WHERE query=?",
                            (result['status'], result['pages'], result['reported_count'], result['seen_count'], now(), query))

    def save_detail(self, place_id, summary, reviews):
        # Reviews and completion become visible together, even after a power loss.
        with self.db:
            self.db.execute("DELETE FROM reviews WHERE place_id=?", (place_id,))
            self.db.executemany("INSERT INTO reviews VALUES(?,?,?)", ((place_id, i, packed(r)) for i, r in enumerate(reviews)))
            cursor = self.db.execute("UPDATE places SET summary=?,detail_status='done',error='' WHERE place_id=? AND classification='restaurant'",
                                    (packed(summary), place_id))
            if cursor.rowcount != 1:
                raise ValueError("Detail does not belong to an accepted restaurant")
            if summary.get('review_status') == 'not_provided':
                # Old search DOM exposed a hidden template count '(30)'. It is
                # not an observed public count; clear only after live confirmation.
                payload = json.loads(self.db.execute('SELECT payload FROM places WHERE place_id=?', (place_id,)).fetchone()[0])
                payload['visitor_review_count'] = ''
                payload['average_rating_5'] = ''
                self.db.execute('UPDATE places SET payload=? WHERE place_id=?', (packed(payload), place_id))

    def save_hours(self, record):
        if record['status'] not in (*VERIFIED_HOURS_STATUSES, 'unrecognized'):
            raise ValueError('Unknown business-hours status')
        with self.db:
            self.db.execute('INSERT INTO business_hours VALUES(?,?,?) ON CONFLICT(place_id) DO UPDATE SET status=excluded.status,payload=excluded.payload',
                            (record['place_id'], record['status'], packed(record)))

    def pending_details(self):
        return list(self.db.execute("""
          SELECT p.place_id,p.payload FROM places p LEFT JOIN business_hours h ON h.place_id=p.place_id
          WHERE p.classification='restaurant'
            AND (p.detail_status!='done' OR COALESCE(h.status,'') NOT IN ('available','not_provided'))
          ORDER BY CASE p.detail_status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,p.place_id
        """))

    def counts(self):
        db = self.db
        queries = {row[0]: row[1] for row in db.execute("SELECT status,COUNT(*) FROM queries GROUP BY status")}
        kinds = {row[0]: row[1] for row in db.execute("SELECT classification,COUNT(*) FROM places GROUP BY classification")}
        hours = {row[0]: row[1] for row in db.execute("SELECT h.status,COUNT(*) FROM business_hours h JOIN places p ON p.place_id=h.place_id WHERE p.classification='restaurant' GROUP BY h.status")}
        verified_hours = sum(hours.get(s,0) for s in VERIFIED_HOURS_STATUSES)
        return {"queries": queries, "classifications": kinds,
                "inventory_count": kinds.get("restaurant", 0),
                "completed_detail_count": db.execute("SELECT COUNT(*) FROM places WHERE detail_status='done'").fetchone()[0],
                "failed_detail_count": db.execute("SELECT COUNT(*) FROM places WHERE detail_status='failed'").fetchone()[0],
                "review_count": db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
                'business_hours': hours, 'hours_checked_count': verified_hours,
                'hours_pending_count': kinds.get('restaurant',0) - verified_hours}

    def export(self, run_status, full=True):
        if full:
            write_csv(self.directory / "places.csv", PLACE_FIELDS,
                      (json.loads(r[0]) for r in self.db.execute("SELECT payload FROM places WHERE classification='restaurant' ORDER BY place_id")))
            write_csv(self.directory / "excluded_places.csv", PLACE_FIELDS + ["classification"],
                      ({**json.loads(r[0]), "classification": r[1]} for r in self.db.execute("SELECT payload,classification FROM places WHERE classification!='restaurant' ORDER BY place_id")))
            write_csv(self.directory / "place_review_summary.csv", SUMMARY_FIELDS,
                      (json.loads(r[0]) for r in self.db.execute("SELECT summary FROM places WHERE detail_status='done' ORDER BY place_id")))
            write_csv(self.directory / "reviews.csv", REVIEW_FIELDS,
                      (json.loads(r[0]) for r in self.db.execute("SELECT payload FROM reviews ORDER BY place_id,position")))
            write_csv(self.directory / 'business_hours.csv', HOURS_FIELDS,
                      (json.loads(r[0]) for r in self.db.execute('SELECT payload FROM business_hours ORDER BY place_id')))
            fields = [r[1] for r in self.db.execute("PRAGMA table_info(queries)")]
            write_csv(self.directory / "queries.csv", fields,
                      (dict(r) for r in self.db.execute("SELECT * FROM queries ORDER BY region,term")))
        stats = self.counts()
        manifest = {"contract": VERSION, "updated_at": now(), "run_status": run_status, **stats,
                    "settings": json.loads(self.db.execute("SELECT value FROM metadata WHERE key='settings'").fetchone()[0]),
                    "started_at": json.loads(self.db.execute("SELECT value FROM metadata WHERE key='started_at'").fetchone()[0]),
                    "source": "https://map.kakao.com/", "all_jeju_restaurants_guaranteed": False,
                    "source_code": {name: hashlib.sha256((ROOT / 'scripts' / name).read_bytes()).hexdigest() for name in
                                    ('kakao_review_crawler.py', 'collect_kakao_jeju_tourism_reviews.py',
                                     'kakao_restaurant_review_crawler.py', 'collect_kakao_jeju_restaurant_reviews.py')},
                    "known_limitations": ["공개 검색 노출 기반 수집: 제주 전체 등록 음식점 전수 보장 불가",
                                          "truncated 검색은 하위 업종 검색으로 보완하나 누락 가능",
                                          "업종 불명·주소 불명은 excluded_places.csv에서 별도 검토 필요",
                                          "리뷰는 설정된 개수만 수집하며 현재 영업 상태를 보증하지 않음"],
                    "files": {name: name for name in ('places.csv','excluded_places.csv','queries.csv','place_review_summary.csv','reviews.csv','business_hours.csv','collection.sqlite3')}}
        if full:
            manifest["exported_at"] = now()
        else:
            old = self.directory / 'manifest.json'
            if old.exists():
                manifest['exported_at'] = json.loads(old.read_text(encoding='utf-8')).get('exported_at')
        atomic_text(self.directory / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        return stats


def atomic_text(path, text):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)


def write_csv(path, fields, rows):
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    temp.replace(path)


def stop_requested(args):
    if (args.output_dir / "STOP").exists():
        raise KeyboardInterrupt("STOP file requested pause")


def pause(args, seconds):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        stop_requested(args)
        time.sleep(min(1, max(0, until - time.monotonic())))


def quit_driver(driver):
    if driver:
        try:
            driver.quit()
        except Exception:
            pass


def build_inventory(store, args):
    attempted = set()
    failures = 0
    while True:
        if args.max_queries and len(attempted) >= args.max_queries:
            return
        row = next((r for r in store.db.execute("SELECT * FROM queries WHERE status IN ('pending','failed') ORDER BY CASE WHEN term='음식점' THEN 0 ELSE 1 END,rowid") if r['query'] not in attempted), None)
        if row is None:
            return
        stop_requested(args)
        query = row['query']
        attempted.add(query)
        driver = None
        with store.db:
            store.db.execute("UPDATE queries SET status='running',attempts=attempts+1,updated_at=? WHERE query=?", (now(), query))
        store.export('inventory_running', full=False)
        print(f"[검색] {query}", flush=True)
        try:
            driver = build_driver(args.headed)
            def checkpoint(places, pages, total, seen):
                stop_requested(args)
                store.save_page(query, places, pages, total, seen)
                if pages % 10 == 0:
                    print(f"  {pages}페이지 / 검색 결과 {seen}/{total if total is not None else '?'}", flush=True)
                    store.export('inventory_running', full=False)
            result = collect_query(driver, query, args.wait, args.page_delay, checkpoint, args.max_pages)
            store.finish_query(query, result)
            if result['status'] == 'truncated' and row['term'] in REFINEMENTS:
                with store.db:
                    for term in REFINEMENTS[row['term']]:
                        store.add_query(row['region'], term)
            failures = 0
            print(f"[검색 {result['status']}] {query}: 노출 {result['seen_count']}/{result['reported_count']}", flush=True)
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            failures += 1
            with store.db:
                store.db.execute("UPDATE queries SET status='failed',error=?,updated_at=? WHERE query=?", (str(exc)[:1000], now(), query))
            print(f"[검색 실패] {query}: {type(exc).__name__}", flush=True)
            if 'access_restricted' in str(exc) or failures >= args.max_failures:
                raise RuntimeError("Consecutive search failures; checkpoint saved") from exc
        finally:
            quit_driver(driver)
            store.export('inventory_running')
        pause(args, args.region_delay if failures == 0 else args.failure_pause)


def collect_details(store, args):
    rows = store.pending_details()
    if args.place_id:
        rows = [row for row in rows if row['place_id'] in args.place_id]
    if args.max_places:
        rows = rows[:args.max_places]
    driver = None
    failures = 0
    try:
        for index, row in enumerate(rows):
            stop_requested(args)
            if index % args.batch_size == 0:
                quit_driver(driver)
                driver = build_driver(args.headed)
            place = Place(**json.loads(row['payload']))
            try:
                summary, reviews = collect_detail(driver, place, args.max_reviews, args.wait, args.page_delay,
                                                  on_business_hours=store.save_hours)
                store.save_detail(place.place_id, summary, reviews)
                failures = 0
                hours_status = store.db.execute('SELECT status FROM business_hours WHERE place_id=?',(place.place_id,)).fetchone()
                print(f"[상세 {index+1}/{len(rows)}] {place.name}: 후기 {len(reviews)}개, 운영시간 {hours_status[0] if hours_status else 'pending'}", flush=True)
            except Exception as exc:
                failures += 1
                with store.db:
                    store.db.execute("UPDATE places SET detail_status='failed',error=? WHERE place_id=?", (str(exc)[:1000], place.place_id))
                print(f"[상세 실패] {place.name}: {type(exc).__name__}", flush=True)
                if 'access_restricted' in str(exc) or failures >= args.max_failures:
                    raise RuntimeError("Consecutive detail failures; checkpoint saved") from exc
            store.export('details_running', full=(index + 1) % args.batch_size == 0)
            if index + 1 < len(rows):
                delay = args.batch_pause if (index + 1) % args.batch_size == 0 else args.place_delay
                pause(args, args.failure_pause if failures else delay)
    finally:
        quit_driver(driver)


class BrowserWorker:
    """One executor owns one browser; no SQLite connection crosses threads."""
    def __init__(self, args, stopped, save):
        self.args, self.stopped, self.save = args, stopped, save
        self.driver = None
        self.uses = 0

    def close(self):
        quit_driver(self.driver)
        self.driver = None

    def run(self, kind, row):
        if self.stopped.is_set():
            raise KeyboardInterrupt('Collection stopped')
        stop_requested(self.args)
        if self.driver is None or self.uses >= self.args.batch_size:
            self.close()
            self.driver = build_driver(self.args.headed)
            self.uses = 0
        self.uses += 1
        try:
            if kind == 'search':
                return collect_query(self.driver, row['query'], self.args.wait, self.args.page_delay,
                                     lambda *values: self.save('page', row['query'], *values), self.args.max_pages)
            place = Place(**json.loads(row['payload']))
            return collect_detail(self.driver, place, self.args.max_reviews, self.args.wait,
                                  self.args.page_delay, on_business_hours=lambda record: self.save('hours', record))
        except BaseException:
            self.close()
            raise


def collect_concurrent(store, args):
    """Search and detail overlap, while the calling thread commits every result."""
    events, stopped = Queue(), Event()
    def save(kind, *values):
        if stopped.is_set():
            raise KeyboardInterrupt('Collection stopped')
        stop_requested(args)
        receipt = Future()
        events.put((kind, values, receipt))
        receipt.result()  # Next page/reviews cannot start before durable storage.
        if stopped.is_set():
            raise KeyboardInterrupt('Collection stopped')

    lanes = {}
    attempted_details = set()
    lane_kinds = ([] if args.skip_inventory else ['search']) + ([] if args.inventory_only else ['detail'] * args.detail_workers)
    for index, kind in enumerate(lane_kinds):
        lanes[f'{kind}{index}'] = {'kind': kind, 'pool': ThreadPoolExecutor(max_workers=1),
                                 'worker': BrowserWorker(args, stopped, save),
                                 'future': None, 'row': None, 'attempted': set() if kind == 'search' else attempted_details,
                                 'failures': 0, 'completed': 0, 'ready': 0.0}
    detail_queue = deque()
    fatal = None
    completed = 0
    last_export = time.monotonic()

    def next_row(kind, lane):
        limit = args.max_queries if kind == 'search' else args.max_places
        if limit and len(lane['attempted']) >= limit:
            return None
        if kind == 'search':
            return next((dict(r) for r in store.db.execute(
                "SELECT * FROM queries WHERE status IN ('pending','failed') "
                "ORDER BY CASE WHEN term='음식점' THEN 0 ELSE 1 END,rowid")
                if r['query'] not in lane['attempted']), None)
        if not detail_queue:
            detail_queue.extend(dict(r) for r in store.pending_details()
                                if r['place_id'] not in lane['attempted']
                                and (not args.place_id or r['place_id'] in args.place_id))
        return detail_queue.popleft() if detail_queue else None

    try:
        while True:
            if fatal is None:
                try:
                    stop_requested(args)
                except KeyboardInterrupt as exc:
                    fatal = exc
                    stopped.set()
            # Even after STOP, acknowledge already queued records after saving them.
            while True:
                try:
                    kind, values, receipt = events.get_nowait()
                except Empty:
                    break
                try:
                    if kind == 'page':
                        store.save_page(*values)
                        query, _, pages, total, seen = values
                        if pages % 10 == 0:
                            print(f'[검색 진행] {query}: {seen}/{total}', flush=True)
                    else:
                        store.save_hours(*values)
                    receipt.set_result(None)
                except BaseException as exc:
                    receipt.set_exception(exc)
                    fatal = exc
                    stopped.set()

            for lane in lanes.values():
                kind = lane['kind']
                future, row = lane['future'], lane['row']
                if future is None or not future.done():
                    continue
                lane['future'] = None
                lane['completed'] += 1
                completed += 1
                try:
                    result = future.result()
                    if kind == 'search':
                        store.finish_query(row['query'], result)
                        if result['status'] == 'truncated':
                            with store.db:
                                for term in REFINEMENTS.get(row['term'], []):
                                    store.add_query(row['region'], term)
                        print(f"[검색 {result['status']}] {row['query']}: {result['seen_count']}/{result['reported_count']}", flush=True)
                    else:
                        summary, reviews = result
                        store.save_detail(row['place_id'], summary, reviews)
                        print(f"[상세 완료 {lane['completed']}] {summary['place_name']}: 저장 후기 {len(reviews)}개 ({summary.get('review_status', 'unknown')})", flush=True)
                    lane['failures'] = 0
                except KeyboardInterrupt as exc:
                    if kind == 'search':
                        with store.db:
                            store.db.execute("UPDATE queries SET status='pending' WHERE query=?", (row['query'],))
                    if fatal is None:
                        fatal = exc
                    stopped.set()
                except Exception as exc:
                    lane['failures'] += 1
                    with store.db:
                        if kind == 'search':
                            store.db.execute("UPDATE queries SET status='failed',error=?,updated_at=? WHERE query=?",
                                             (str(exc)[:1000], now(), row['query']))
                        else:
                            store.db.execute("UPDATE places SET detail_status='failed',error=? WHERE place_id=?",
                                             (str(exc)[:1000], row['place_id']))
                    print(f"[{kind} 실패] {row.get('query', row.get('place_id'))}: {type(exc).__name__}", flush=True)
                    if 'access_restricted' in str(exc) or lane['failures'] >= args.max_failures:
                        if fatal is None:
                            fatal = RuntimeError(f'{kind} stopped: {type(exc).__name__}: {exc}')
                        stopped.set()
                delay = args.region_delay if kind == 'search' else args.place_delay
                if lane['completed'] % args.batch_size == 0:
                    delay = max(delay, args.batch_pause)
                if lane['failures']:
                    delay = args.failure_pause
                lane['ready'] = time.monotonic() + delay

            if completed >= args.batch_size or time.monotonic() - last_export >= 10:
                store.export('concurrent_running', full=completed >= args.batch_size)
                if completed >= args.batch_size:
                    completed = 0
                last_export = time.monotonic()

            active = any(lane['future'] is not None for lane in lanes.values())
            if fatal is not None:
                if not active:
                    raise fatal
            else:
                waiting = False
                for lane in lanes.values():
                    kind = lane['kind']
                    if lane['future'] is not None:
                        continue
                    if time.monotonic() < lane['ready']:
                        waiting = True
                        continue
                    row = next_row(kind, lane)
                    if row is None:
                        continue
                    key = row['query'] if kind == 'search' else row['place_id']
                    lane['attempted'].add(key)
                    lane['row'] = row
                    if kind == 'search':
                        with store.db:
                            store.db.execute("UPDATE queries SET status='running',attempts=attempts+1,updated_at=? WHERE query=?", (now(), key))
                        print(f'[검색] {key}', flush=True)
                    lane['future'] = lane['pool'].submit(lane['worker'].run, kind, row)
                    active = True
                if not active and not waiting:
                    break
            time.sleep(0.1)
    finally:
        stopped.set()
        # A failure of the writer must also release workers awaiting a receipt.
        while any(lane['future'] is not None and not lane['future'].done() for lane in lanes.values()):
            try:
                _, _, receipt = events.get(timeout=0.1)
                receipt.set_exception(RuntimeError('Writer stopped before checkpoint'))
            except Empty:
                pass
        for lane in lanes.values():
            lane['pool'].submit(lane['worker'].close).result()
            lane['pool'].shutdown()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="제주 43개 구역 음식점 인벤토리·리뷰 배치 수집 (카페·제과 제외)")
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'data/kakao/jeju' / now()[:10] / 'restaurants')
    parser.add_argument('--max-reviews', type=int, default=5, help='기본 5, 0은 리뷰 제외, -1은 공개 리뷰 전체 시도')
    parser.add_argument('--max-regions', type=int, default=0, help='0은 43개 전체, 양수는 표본')
    parser.add_argument('--max-places', type=int, default=0, help='이번 실행에서 상세 방문할 최대 장소 수, 0은 전체')
    parser.add_argument('--place-id', action='append', default=[], help='특정 저장된 식당만 상세 확인(반복 가능); 전체 검색 계획은 유지')
    parser.add_argument('--max-pages', type=int, default=200, help='검색어당 안전 상한; 도달 시 truncated')
    parser.add_argument('--max-queries', type=int, default=0, help='이번 실행 검색어 수 제한, 0은 전체; 미수행 검색은 pending 유지')
    parser.add_argument('--batch-size', type=int, default=20)
    parser.add_argument('--batch-pause', type=float, default=20)
    parser.add_argument('--page-delay', type=float, default=1)
    parser.add_argument('--region-delay', type=float, default=2)
    parser.add_argument('--place-delay', type=float, default=1.5)
    parser.add_argument('--failure-pause', type=float, default=30)
    parser.add_argument('--max-failures', type=int, default=3)
    parser.add_argument('--wait', type=int, default=15)
    parser.add_argument('--inventory-only', action='store_true')
    parser.add_argument('--skip-inventory', action='store_true')
    parser.add_argument('--status', action='store_true', help='수집 없이 SQLite에서 현황·CSV 재생성')
    parser.add_argument('--headed', action='store_true')
    parser.add_argument('--concurrent', action='store_true', help='검색 1개와 상세 1개를 병행하며 최대 브라우저 2개 사용')
    parser.add_argument('--detail-workers', type=int, choices=(1, 2), default=1,
                        help='상세 병행 수. 2는 --concurrent --skip-inventory와 함께 사용')
    args = parser.parse_args(argv)
    if args.max_reviews < -1 or not 0 <= args.max_regions <= len(JEJU_REGIONS) or min(args.max_places, args.max_queries) < 0:
        parser.error('max-reviews >= -1, max-regions 0..43, max-places >= 0 required')
    if min(args.batch_size, args.wait, args.max_pages, args.max_failures) < 1:
        parser.error('batch-size, wait, max-pages, max-failures must be positive')
    if min(args.batch_pause, args.page_delay, args.region_delay, args.place_delay, args.failure_pause) < 0:
        parser.error('delays must be nonnegative')
    if args.inventory_only and args.skip_inventory:
        parser.error('inventory-only and skip-inventory are mutually exclusive')
    if args.detail_workers == 2 and (not args.concurrent or not args.skip_inventory or args.inventory_only):
        parser.error('detail-workers 2 requires --concurrent --skip-inventory')
    if any(not value.isdigit() for value in args.place_id):
        parser.error('place-id must be numeric')
    return args


def main(argv=None):
    args = parse_args(argv)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    regions = JEJU_REGIONS[:args.max_regions] if args.max_regions else JEJU_REGIONS
    settings = {'contract': VERSION, 'regions': regions, 'base_term': '음식점', 'subterms': SUBTERMS,
                'exclude_cafes_bakeries': True, 'max_reviews': args.max_reviews, 'max_pages': args.max_pages}
    with output_lock(args.output_dir):
        if args.status and (args.output_dir / 'collection.sqlite3').exists():
            with sqlite3.connect(args.output_dir / 'collection.sqlite3') as db:
                settings = json.loads(db.execute("SELECT value FROM metadata WHERE key='settings'").fetchone()[0])
        store = Store(args.output_dir, settings)
        status = 'running'
        code = 0
        try:
            if args.status:
                old = args.output_dir / 'manifest.json'
                status = json.loads(old.read_text(encoding='utf-8')).get('run_status', 'unknown') if old.exists() else 'unknown'
            else:
                with store.db:
                    for region in regions:
                        store.add_query(region, '음식점')
                if args.concurrent:
                    store.export('concurrent_running', full=False)
                    collect_concurrent(store, args)
                else:
                    if not args.skip_inventory:
                        build_inventory(store, args)
                    if not args.inventory_only:
                        if not store.counts()['inventory_count']:
                            raise RuntimeError('No accepted restaurants available')
                        collect_details(store, args)
                stats = store.counts()
                pending_queries = sum(stats['queries'].get(s, 0) for s in ('pending','failed','running'))
                pending_places = len(store.pending_details())
                status = 'partial' if pending_queries or (not args.inventory_only and pending_places) else ('inventory_finished' if args.inventory_only else 'finished_search_scope')
                code = 2 if status == 'partial' else 0
        except KeyboardInterrupt:
            status, code = 'paused', 130
        except Exception as exc:
            status, code = 'failed', 1
            print(f"[중단] {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        finally:
            stats = store.export(status)
            store.db.close()
            print(packed({'run_status': status, **stats}), flush=True)
        return code


if __name__ == '__main__':
    raise SystemExit(main())
