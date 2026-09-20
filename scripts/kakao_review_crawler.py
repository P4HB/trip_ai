"""Collect Kakao Map place reviews with Selenium-controlled Chrome.

Example:
    python kakao_review_crawler.py --query "제주" --max-places 5 --max-reviews 20
"""

from __future__ import annotations

import argparse
import csv
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import quote

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


SEARCH_URL = "https://map.kakao.com/?q={}"
REVIEW_ITEM_SELECTOR = "ul.list_review > li"


@dataclass(frozen=True)
class Place:
    place_id: str
    name: str
    url: str
    average_rating_5: str
    visitor_review_count: str
    blog_review_count: str


@dataclass(frozen=True)
class Review:
    query: str
    place_id: str
    place_name: str
    place_url: str
    reviewer: str
    rating: str
    date: str
    content: str
    tags: str
    likes: str


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def first_text(parent: WebElement, selector: str) -> str:
    elements = parent.find_elements(By.CSS_SELECTOR, selector)
    return clean_text(elements[0].text) if elements else ""


def review_text(parent: WebElement) -> str:
    value = first_text(parent, ".desc_review")
    return re.sub(r"\s*(?:더보기|접기)$", "", value).strip()


def build_driver(headed: bool) -> webdriver.Chrome:
    options = Options()
    options.page_load_strategy = "eager"
    if not headed:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1600,1200")
    options.add_argument("--lang=ko-KR")
    options.add_argument("--disable-notifications")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    return driver


def collect_places(
    driver: webdriver.Chrome, query: str, max_places: int, wait_seconds: int
) -> list[Place]:
    driver.get(SEARCH_URL.format(quote(query)))
    wait = WebDriverWait(driver, wait_seconds)
    wait.until(
        EC.presence_of_element_located(
            (By.CSS_SELECTOR, 'a[href*="place.map.kakao.com"]')
        )
    )

    # The first search view commonly shows five places. Open the full place list
    # when Kakao exposes the "장소 더보기" link.
    if max_places > 5:
        more_links = driver.find_elements(
            By.XPATH, "//a[contains(normalize-space(.), '장소 더보기')]"
        )
        if more_links:
            driver.execute_script("arguments[0].click();", more_links[0])
            time.sleep(1.5)

    places: list[Place] = []
    seen_ids: set[str] = set()
    detail_links = driver.find_elements(By.CSS_SELECTOR, "a.moreview")
    if not detail_links:
        detail_links = driver.find_elements(
            By.CSS_SELECTOR, 'a[href*="place.map.kakao.com"]'
        )

    for link in detail_links:
        url = (link.get_attribute("href") or "").split("#", 1)[0]
        match = re.search(r"place\.map\.kakao\.com/(\d+)", url)
        if not match or match.group(1) in seen_ids:
            continue

        place_id = match.group(1)
        item = link.find_elements(By.XPATH, "ancestor::li[1]")
        name = ""
        if item:
            name = first_text(item[0], ".link_name")
        if not name or name in {"상세보기", "리뷰"}:
            name = f"place_{place_id}"

        rating = first_text(item[0], ".score .num") if item else ""
        visitor_count = first_text(item[0], ".numberofscore") if item else ""
        blog_count = first_text(item[0], ".review") if item else ""
        places.append(
            Place(
                place_id=place_id,
                name=name,
                url=url,
                average_rating_5=rating,
                visitor_review_count=re.sub(r"\D", "", visitor_count),
                blog_review_count=re.sub(r"\D", "", blog_count),
            )
        )
        seen_ids.add(place_id)
        if len(places) >= max_places:
            break

    return places


def expand_and_load_reviews(
    driver: webdriver.Chrome, max_reviews: int, wait_seconds: int
) -> None:
    wait = WebDriverWait(driver, wait_seconds)
    try:
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, REVIEW_ITEM_SELECTOR)))
    except TimeoutException:
        return

    previous_count = -1
    unchanged_rounds = 0
    while unchanged_rounds < 2:
        items = driver.find_elements(By.CSS_SELECTOR, REVIEW_ITEM_SELECTOR)
        if len(items) >= max_reviews:
            break

        if len(items) == previous_count:
            unchanged_rounds += 1
        else:
            unchanged_rounds = 0
            previous_count = len(items)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        candidates = driver.find_elements(
            By.XPATH,
            "//*[self::a or self::button][contains(normalize-space(.), '후기 더보기')]",
        )
        for candidate in candidates[:1]:
            try:
                driver.execute_script("arguments[0].click();", candidate)
            except WebDriverException:
                pass
        time.sleep(1.0)

    # Expand truncated review bodies that are already loaded.
    for button in driver.find_elements(By.CSS_SELECTOR, ".desc_review .btn_more"):
        try:
            driver.execute_script("arguments[0].click();", button)
        except WebDriverException:
            pass
    time.sleep(0.3)


def parse_reviews(
    driver: webdriver.Chrome, query: str, place: Place, max_reviews: int
) -> list[Review]:
    page_name = clean_text(driver.title.split("|", 1)[0]) or place.name
    reviews: list[Review] = []

    for item in driver.find_elements(By.CSS_SELECTOR, REVIEW_ITEM_SELECTOR)[:max_reviews]:
        rating = ""
        rating_parts = item.find_elements(
            By.CSS_SELECTOR, ".starred_grade .screen_out"
        )
        for part in rating_parts:
            value = clean_text(part.get_attribute("textContent") or "")
            if re.fullmatch(r"\d+(?:\.\d+)?", value):
                rating = value
                break

        tag_values = [
            clean_text(tag.text)
            for tag in item.find_elements(By.CSS_SELECTOR, ".wrap_badge .badge_point")
            if clean_text(tag.text)
        ]
        review = Review(
            query=query,
            place_id=place.place_id,
            place_name=page_name,
            place_url=place.url,
            reviewer=first_text(item, ".name_user"),
            rating=rating,
            date=first_text(item, ".txt_date"),
            content=review_text(item),
            tags="|".join(tag_values),
            likes=first_text(item, ".review_unit .txt_btn"),
        )
        if review.reviewer or review.content or review.rating:
            reviews.append(review)

    return reviews


def place_summary(driver: webdriver.Chrome, place: Place, reviews: list[Review]) -> dict[str, str]:
    count_text = first_text(driver, ".section_review .link_reviewall")
    count_match = re.search(r"[\d,]+", count_text)
    summary = {
        "place_id": place.place_id,
        "place_name": clean_text(driver.title.split("|", 1)[0]) or place.name,
        "place_url": place.url,
        "average_rating_5": place.average_rating_5
        or first_text(driver, ".section_review .num_star"),
        "visitor_review_count": place.visitor_review_count
        or (count_match.group(0).replace(",", "") if count_match else "0"),
        "blog_review_count": place.blog_review_count or "0",
    }
    for index in range(5):
        if index < len(reviews):
            review = reviews[index]
            summary[f"top_review_{index + 1}"] = " | ".join(
                value
                for value in (
                    review.reviewer,
                    f"{review.rating}/5" if review.rating else "",
                    review.date,
                    review.content,
                )
                if value
            )
        else:
            summary[f"top_review_{index + 1}"] = ""
    return summary


def crawl(args: argparse.Namespace) -> tuple[list[Review], list[dict[str, str]]]:
    driver = build_driver(args.headed)
    all_reviews: list[Review] = []
    summaries: list[dict[str, str]] = []
    try:
        places = collect_places(driver, args.query, args.max_places, args.wait)
        print(f"검색 결과: 장소 {len(places)}개")
        for index, place in enumerate(places, start=1):
            print(f"[{index}/{len(places)}] {place.name} ({place.place_id})")
            try:
                driver.get(f"{place.url}#review")
                expand_and_load_reviews(driver, args.max_reviews, args.wait)
                reviews = parse_reviews(driver, args.query, place, args.max_reviews)
                all_reviews.extend(reviews)
                summaries.append(place_summary(driver, place, reviews))
                print(f"  리뷰 {len(reviews)}개 수집")
            except (TimeoutException, WebDriverException) as exc:
                print(f"  수집 실패: {type(exc).__name__}: {exc}")
            time.sleep(args.delay)
    finally:
        driver.quit()
    return all_reviews, summaries


def write_csv(path: Path, reviews: list[Review]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(Review.__dataclass_fields__)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(asdict(review) for review in reviews)


def write_summary_csv(path: Path, summaries: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "place_id",
        "place_name",
        "place_url",
        "average_rating_5",
        "visitor_review_count",
        "blog_review_count",
        "top_review_1",
        "top_review_2",
        "top_review_3",
        "top_review_4",
        "top_review_5",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(summaries)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="카카오맵 검색 결과 리뷰 수집기")
    parser.add_argument("--query", default="제주", help="카카오맵 검색어")
    parser.add_argument("--max-places", type=int, default=5, help="수집할 장소 수")
    parser.add_argument("--max-reviews", type=int, default=5, help="장소별 최대 리뷰 수")
    parser.add_argument(
        "--output", type=Path, default=Path("kakao_jeju_place_summary.csv"),
        help="장소별 요약 CSV 경로",
    )
    parser.add_argument(
        "--reviews-output", type=Path, default=Path("kakao_jeju_reviews.csv"),
        help="개별 리뷰 CSV 경로",
    )
    parser.add_argument("--delay", type=float, default=1.0, help="장소 사이 대기 초")
    parser.add_argument("--wait", type=int, default=12, help="요소 로딩 대기 초")
    parser.add_argument("--headed", action="store_true", help="Chrome 창을 화면에 표시")
    args = parser.parse_args()
    if args.max_places < 1 or args.max_reviews < 1 or args.delay < 0:
        parser.error("max-places/max-reviews는 1 이상, delay는 0 이상이어야 합니다.")
    return args


def main() -> None:
    args = parse_args()
    reviews, summaries = crawl(args)
    write_summary_csv(args.output, summaries)
    write_csv(args.reviews_output, reviews)
    print(f"완료: 장소 {len(summaries)}개 요약 -> {args.output.resolve()}")
    print(f"원본: 리뷰 {len(reviews)}개 -> {args.reviews_output.resolve()}")


if __name__ == "__main__":
    main()
