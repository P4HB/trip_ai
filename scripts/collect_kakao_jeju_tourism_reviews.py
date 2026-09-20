"""Collect Jeju tourism places by administrative area with safe batching.

The collector first builds a de-duplicated place inventory, then visits each
place detail page. Progress is saved every batch, so the command can be rerun
after interruption and will continue with unfinished place IDs.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from kakao_review_crawler import (
    Place,
    Review,
    build_driver,
    clean_text,
    expand_and_load_reviews,
    first_text,
    parse_reviews,
    place_summary,
    write_csv,
    write_summary_csv,
)


JEJU_REGIONS = [
    "제주시 한림읍", "제주시 애월읍", "제주시 구좌읍", "제주시 조천읍",
    "제주시 한경면", "제주시 추자면", "제주시 우도면",
    "제주시 일도1동", "제주시 일도2동", "제주시 이도1동", "제주시 이도2동",
    "제주시 삼도1동", "제주시 삼도2동", "제주시 용담1동", "제주시 용담2동",
    "제주시 건입동", "제주시 화북동", "제주시 삼양동", "제주시 봉개동",
    "제주시 아라동", "제주시 오라동", "제주시 연동", "제주시 노형동",
    "제주시 외도동", "제주시 이호동", "제주시 도두동",
    "서귀포시 대정읍", "서귀포시 남원읍", "서귀포시 성산읍",
    "서귀포시 안덕면", "서귀포시 표선면", "서귀포시 송산동",
    "서귀포시 정방동", "서귀포시 중앙동", "서귀포시 천지동",
    "서귀포시 효돈동", "서귀포시 영천동", "서귀포시 동홍동",
    "서귀포시 서홍동", "서귀포시 대륜동", "서귀포시 대천동",
    "서귀포시 중문동", "서귀포시 예래동",
]

KST = ZoneInfo("Asia/Seoul")


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def card_to_place(link) -> Place | None:
    url = (link.get_attribute("href") or "").split("#", 1)[0]
    match = re.search(r"place\.map\.kakao\.com/(\d+)", url)
    if not match:
        return None
    items = link.find_elements(By.XPATH, "ancestor::li[1]")
    if not items:
        return None
    item = items[0]
    return Place(
        place_id=match.group(1),
        name=first_text(item, ".link_name") or f"place_{match.group(1)}",
        url=url,
        average_rating_5=first_text(item, ".score .num"),
        visitor_review_count=digits(first_text(item, ".numberofscore")),
        blog_review_count=digits(first_text(item, ".review")),
    )


def wait_for_page_change(driver, old_first_url: str, wait_seconds: int) -> None:
    WebDriverWait(driver, wait_seconds).until(
        lambda current: (
            current.find_elements(By.CSS_SELECTOR, "a.moreview")
            and current.find_elements(By.CSS_SELECTOR, "a.moreview")[0].get_attribute("href")
            != old_first_url
        )
    )


def collect_current_page(driver, places: dict[str, Place]) -> int:
    before = len(places)
    for link in driver.find_elements(By.CSS_SELECTOR, "a.moreview"):
        place = card_to_place(link)
        if place:
            places[place.place_id] = place
    return len(places) - before


def collect_region(driver, region: str, places: dict[str, Place], args) -> int:
    query = f"{region} 관광지"
    driver.get(f"https://map.kakao.com/?q={quote(query)}")
    WebDriverWait(driver, args.wait).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "a.moreview"))
    )
    time.sleep(args.page_delay)
    added = collect_current_page(driver, places)

    more = driver.find_elements(By.ID, "info.search.place.more")
    if not more or not more[0].is_displayed():
        return added

    old_url = driver.find_elements(By.CSS_SELECTOR, "a.moreview")[0].get_attribute("href")
    driver.execute_script("arguments[0].click();", more[0])
    try:
        wait_for_page_change(driver, old_url, args.wait)
    except TimeoutException:
        return added

    while True:
        time.sleep(args.page_delay)
        added += collect_current_page(driver, places)
        active = driver.find_elements(By.CSS_SELECTOR, "#info\\.search\\.page a.ACTIVE")
        visible_pages = [
            page
            for page in driver.find_elements(By.CSS_SELECTOR, "#info\\.search\\.page a")
            if page.is_displayed()
        ]
        next_target = None
        if active and active[0] in visible_pages:
            active_index = visible_pages.index(active[0])
            if active_index + 1 < len(visible_pages):
                next_target = visible_pages[active_index + 1]

        if next_target is None:
            next_buttons = driver.find_elements(By.ID, "info.search.page.next")
            if not next_buttons or "disabled" in (next_buttons[0].get_attribute("class") or ""):
                break
            next_target = next_buttons[0]

        links = driver.find_elements(By.CSS_SELECTOR, "a.moreview")
        if not links:
            break
        old_url = links[0].get_attribute("href")
        driver.execute_script("arguments[0].click();", next_target)
        try:
            wait_for_page_change(driver, old_url, args.wait)
        except TimeoutException:
            break
    return added


def save_inventory(path: Path, places: dict[str, Place]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(Place.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(asdict(place) for place in places.values())


def load_inventory(path: Path) -> dict[str, Place]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return {row["place_id"]: Place(**row) for row in csv.DictReader(file)}


def load_reviews(path: Path) -> list[Review]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return [Review(**row) for row in csv.DictReader(file)]


def load_summaries(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def build_inventory(args) -> dict[str, Place]:
    places = {} if args.refresh_inventory else load_inventory(args.inventory)
    completed_regions: set[str] = set()
    if args.state.exists() and not args.refresh_inventory:
        saved_state = json.loads(args.state.read_text(encoding="utf-8"))
        if isinstance(saved_state, list):
            completed_regions = set(saved_state)
        else:
            completed_regions = set(saved_state.get("completed_regions", []))

    regions = JEJU_REGIONS[: args.max_regions] if args.max_regions else JEJU_REGIONS
    for index, region in enumerate(regions, start=1):
        if region in completed_regions:
            continue
        before = len(places)
        driver = build_driver(args.headed)
        try:
            collect_region(driver, region, places, args)
            completed_regions.add(region)
            print(
                f"[구역 {index}/{len(regions)}] {region}: "
                f"신규 {len(places) - before}곳, 누적 {len(places)}곳"
            )
        except (TimeoutException, WebDriverException) as exc:
            print(f"[구역 실패] {region}: {type(exc).__name__}: {exc}")
        finally:
            try:
                driver.quit()
            except WebDriverException:
                pass
        save_inventory(args.inventory, places)
        args.state.parent.mkdir(parents=True, exist_ok=True)
        args.state.write_text(
            json.dumps(
                {
                    "updated_at": datetime.now(KST).isoformat(),
                    "completed_regions": sorted(completed_regions),
                },
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        time.sleep(args.region_delay)
    return places


def write_manifest(args, inventory_count: int, completed_count: int) -> None:
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "contract": "kakao-jeju-tourism-review-v1",
        "source": "카카오맵 공개 장소 및 방문 후기 페이지",
        "updated_at": datetime.now(KST).isoformat(),
        "search_regions": JEJU_REGIONS,
        "inventory_count": inventory_count,
        "completed_detail_count": completed_count,
        "settings": {
            "batch_size": args.batch_size,
            "batch_pause_seconds": args.batch_pause,
            "failure_pause_seconds": args.failure_pause,
            "place_delay_seconds": args.place_delay,
            "max_reviews_per_place": args.max_reviews,
        },
        "files": {
            "inventory": str(args.inventory),
            "summary": str(args.output),
            "reviews": str(args.reviews_output),
            "state": str(args.state),
        },
        "known_limitations": [
            "카카오맵 검색 노출 건수와 순서는 수집 시점에 따라 달라질 수 있음",
            "행정 구역 분할 검색 결과는 화면에 표시된 제주 전체 건수와 일치하지 않을 수 있음",
            "카카오맵 DOM 변경 시 셀렉터 갱신이 필요함",
        ],
    }
    args.manifest.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def collect_details(places: list[Place], args) -> None:
    reviews = load_reviews(args.reviews_output)
    summaries = load_summaries(args.output)
    completed_ids = {summary["place_id"] for summary in summaries}
    pending = [place for place in places if place.place_id not in completed_ids]
    if args.max_places:
        pending = pending[: args.max_places]
    print(f"상세 수집 대상: {len(pending)}곳 (완료 {len(completed_ids)}곳 제외)")

    for batch_start in range(0, len(pending), args.batch_size):
        batch = pending[batch_start : batch_start + args.batch_size]
        batch_failures = 0
        driver = build_driver(args.headed)
        try:
            for offset, place in enumerate(batch):
                index = batch_start + offset + 1
                try:
                    driver.get(f"{place.url}#review")
                    expand_and_load_reviews(driver, args.max_reviews, args.wait)
                    place_reviews = parse_reviews(
                        driver, "제주도 관광지", place, args.max_reviews
                    )
                    reviews.extend(place_reviews)
                    summaries.append(place_summary(driver, place, place_reviews))
                    print(
                        f"[{index}/{len(pending)}] {place.name}: "
                        f"후기 {len(place_reviews)}개"
                    )
                except (TimeoutException, WebDriverException) as exc:
                    batch_failures += 1
                    print(
                        f"[{index}/{len(pending)} 실패] {place.name}: "
                        f"{type(exc).__name__}"
                    )
                if offset + 1 < len(batch) and args.place_delay:
                    time.sleep(args.place_delay)
        finally:
            try:
                driver.quit()
            except WebDriverException:
                pass

        write_summary_csv(args.output, summaries)
        write_csv(args.reviews_output, reviews)
        write_manifest(args, len(places), len(summaries))
        print(f"체크포인트 저장: 누적 장소 {len(summaries)}개")

        processed = batch_start + len(batch)
        if processed < len(pending):
            pause = args.failure_pause if batch_failures >= 3 else args.batch_pause
            print(f"요청 완화 대기: {pause:.0f}초")
            time.sleep(pause)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="제주 전역 관광지 리뷰 배치 수집기")
    data_dir = Path("data/kakao/jeju/2026-08-19")
    parser.add_argument("--inventory", type=Path, default=data_dir / "places.csv")
    parser.add_argument("--output", type=Path, default=data_dir / "place_review_summary.csv")
    parser.add_argument("--reviews-output", type=Path, default=data_dir / "reviews.csv")
    parser.add_argument("--state", type=Path, default=data_dir / "collection_state.json")
    parser.add_argument("--manifest", type=Path, default=data_dir / "manifest.json")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--batch-pause", type=float, default=45.0)
    parser.add_argument("--failure-pause", type=float, default=90.0)
    parser.add_argument("--place-delay", type=float, default=1.5)
    parser.add_argument("--page-delay", type=float, default=0.8)
    parser.add_argument("--region-delay", type=float, default=2.0)
    parser.add_argument("--max-reviews", type=int, default=5)
    parser.add_argument("--max-places", type=int, default=0, help="0이면 전체, 테스트 시 양수")
    parser.add_argument("--max-regions", type=int, default=0, help="0이면 제주 전체 구역")
    parser.add_argument("--wait", type=int, default=12)
    parser.add_argument("--inventory-only", action="store_true")
    parser.add_argument("--skip-inventory", action="store_true")
    parser.add_argument("--refresh-inventory", action="store_true")
    parser.add_argument("--headed", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.skip_inventory:
        places = load_inventory(args.inventory)
        if not places:
            raise RuntimeError(f"기존 인벤토리를 찾을 수 없습니다: {args.inventory}")
    else:
        places = build_inventory(args)
    print(f"중복 제거된 관광지: {len(places)}곳")
    if args.inventory_only:
        write_manifest(args, len(places), len(load_summaries(args.output)))
    else:
        collect_details(list(places.values()), args)


if __name__ == "__main__":
    main()
