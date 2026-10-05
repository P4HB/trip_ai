"""Restaurant-specific Selenium parsing; the original tourism crawler is unchanged."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from kakao_review_crawler import build_driver, clean_text, first_text

KST = timezone(timedelta(hours=9))
VERSION = "kakao-jeju-restaurants-v1"
REVIEW_SELECTOR = "ul.list_review > li"
EXCLUDED_CATEGORY = re.compile(
    r"카페|커피|제과|베이커리|베이글|도넛|디저트|아이스크림|빙수|떡집|떡카페|"
    r"찻집|다방|주스|쥬스|생과일전문|떡,한과|차전문|편의점|마트|슈퍼|식료품|주류판매|단란주점|유흥주점"
)
FOOD_CATEGORY = re.compile(
    r"음식점|식당|한식|한정식|중식|중국요리|일식|양식|분식|고기|육류|해물|해산물|생선|회$|횟집|"
    r"국수|냉면|칼국수|수제비|우동|소바|라멘|일본식라면|돈까스|돈가스|초밥|스시|덮밥|도시락|"
    r"국밥|해장국|설렁탕|곰탕|감자탕|찌개|전골|두부|죽$|비빔밥|백반|김밥|"
    r"치킨|닭강정|통닭|피자|햄버거|버거|샌드위치|토스트|뷔페|구내식당|푸드코트|"
    r"패밀리레스토랑|패스트푸드|스테이크|이탈리안|이탈리아|프랑스|스페인|멕시칸|"
    r"멕시코|베트남|태국|인도요리|아시아|동남아|퓨전요리|세계음식|양꼬치|마라탕|"
    r"샤브샤브|샐러드|채식|사찰음식|수산물|조개|장어|갈비|불고기|삼겹살|족발|"
    r"보쌈|순대|닭발|닭요리|오리|곱창|막창|양고기|닭갈비|아구|복어|매운탕|"
    r"굴,전복|게,대게|낙지|오징어|추어|떡볶이|전,빈대떡|주점|호프|술집|요리주점|포장마차|오뎅바|와인바|칵테일바"
)


def now() -> str:
    return datetime.now(KST).isoformat(timespec="seconds")


def digits(text: str) -> str:
    return re.sub(r"\D", "", text or "")


@dataclass(frozen=True)
class Place:
    place_id: str
    name: str
    url: str
    average_rating_5: str = ""
    visitor_review_count: str = ""
    blog_review_count: str = ""
    address: str = ""
    category: str = ""
    query: str = ""
    collected_at: str = ""


def classify(address: str, category: str) -> str:
    if not re.match(r"^제주(?:특별자치도|도)?\s+(?:제주시|서귀포시)\s", clean_text(address)):
        return "address_unknown" if not address else "outside_jeju"
    if EXCLUDED_CATEGORY.search(category):
        return "excluded_category"
    return "restaurant" if FOOD_CATEGORY.search(category) else "category_unknown"


def card_to_place(link, query: str) -> Place | None:
    match = re.search(r"place\.map\.kakao\.com/(\d+)", link.get_attribute("href") or "")
    parents = link.find_elements(By.XPATH, "ancestor::li[1]")
    if not match or not parents:
        return None
    item = parents[0]
    return Place(
        match[1], first_text(item, ".link_name"), f"https://place.map.kakao.com/{match[1]}",
        visible_text(item, ".score .num"), digits(visible_text(item, ".numberofscore")),
        digits(visible_text(item, ".review")), first_text(item, ".addr p"),
        first_text(item, ".subcategory"), query, now(),
    )


def visible(driver, by, selector):
    return [e for e in driver.find_elements(by, selector) if e.is_displayed()]


def visible_text(driver, selector):
    return next((clean_text(e.text) for e in visible(driver, By.CSS_SELECTOR, selector)), '')


def signature(driver) -> tuple[str, ...]:
    return tuple(driver.execute_script("return [...document.querySelectorAll('a.moreview')].filter(e=>e.getClientRects().length).map(e=>e.href)"))


def search_snapshot(driver, query):
    # Read cards and navigation in one DOM snapshot: pagination replaces nodes.
    raw = driver.execute_script("""
      const shown=e=>e && e.getClientRects().length>0;
      const text=(e,s)=>{const n=e.querySelector(s);return (shown(n)?n.innerText:'').replace(/\\s+/g,' ').trim();};
      const cards=[...document.querySelectorAll('a.moreview')].filter(shown).map(a=>{
        const li=a.closest('li'); if(!li) return null;
        return {url:a.href, name:text(li,'.link_name'), category:text(li,'.subcategory'),
          address:text(li,'.addr p'), average_rating_5:text(li,'.score .num'),
          visitor_review_count:text(li,'.numberofscore'), blog_review_count:text(li,'.review')};
      }).filter(Boolean);
      const pages=[...document.querySelectorAll('[id="info.search.page"] a')].filter(shown);
      const active=pages.find(e=>e.classList.contains('ACTIVE'));
      const n=Number(active?.innerText);
      let next=pages.find(e=>Number(e.innerText)===n+1);
      const more=document.getElementById('info.search.place.more');
      const button=document.getElementById('info.search.page.next');
      if(shown(more)) next=more;
      else if(!next && shown(button) && !button.classList.contains('disabled')) next=button;
      return {cards, next_id:next?.id||null};
    """)
    cards = []
    for row in raw['cards']:
        match = re.search(r"place\.map\.kakao\.com/(\d+)", row['url'])
        if match:
            row['url'] = f"https://place.map.kakao.com/{match[1]}"
            row['visitor_review_count'] = digits(row['visitor_review_count'])
            row['blog_review_count'] = digits(row['blog_review_count'])
            cards.append(Place(place_id=match[1], query=query, collected_at=now(), **row))
    return cards, raw['next_id']


def check_access(driver) -> None:
    body = first_text(driver, "body")
    if any(text in body for text in ("비정상적인 접근", "자동입력 방지", "접근이 제한", "접속이 제한")):
        raise RuntimeError("access_restricted: save progress and stop; no bypass")


def wait_search(driver, seconds: int):
    def loaded(current):
        check_access(current)
        if signature(current):
            return "results"
        text = first_text(current, "body")
        if any(message in text for message in ("검색결과가 없습니다", "검색 결과가 없습니다", "검색 결과가 없어요")):
            return "empty"
        return False
    return WebDriverWait(driver, seconds).until(loaded)


def advance_search(driver, query, next_id, current, wait_seconds):
    driver.execute_script("document.getElementById(arguments[0]).click();", next_id)
    def moved(d):
        updated = signature(d)
        if updated and updated != current:
            return True
        return (next_id == 'info.search.place.more'
                and first_text(d, '[id="info.search.page"] a.ACTIVE') == '1'
                and not visible(d, By.ID, 'info.search.place.more'))
    WebDriverWait(driver, wait_seconds).until(moved)
    if signature(driver) == current:
        # Some queries expand navigation while keeping the same complete page 1.
        _, following_id = search_snapshot(driver, query)
        if not following_id or following_id == next_id:
            raise RuntimeError('search_expansion_stalled')
        driver.execute_script("document.getElementById(arguments[0]).click();", following_id)
        WebDriverWait(driver, wait_seconds).until(lambda d: signature(d) and signature(d) != current)


def collect_query(driver, query, wait_seconds, page_delay, on_page, max_pages=200):
    """Yield every visible page to a durable checkpoint; never hide a stalled page."""
    driver.get(f"https://map.kakao.com/?q={quote(query)}")
    if wait_search(driver, wait_seconds) == "empty":
        return {"status": "done", "reported_count": 0, "seen_count": 0, "pages": 0}
    time.sleep(page_delay)
    total_text = first_text(driver, '[id="info.search.place.cnt"]')
    total = int(digits(total_text)) if digits(total_text) else None
    seen: set[str] = set()
    page_signatures = set()
    pages = 0
    while True:
        check_access(driver)
        current = signature(driver)
        if not current or current in page_signatures:
            raise RuntimeError("search_page_stalled")
        page_signatures.add(current)
        cards, next_id = search_snapshot(driver, query)
        if not cards:
            raise RuntimeError("search_card_parser_empty")
        seen.update(card.place_id for card in cards)
        pages += 1
        on_page(cards, pages, total, len(seen))
        if next_id is None or pages >= max_pages:
            truncated = (total is not None and len(seen) < total) or pages >= max_pages
            return {"status": "truncated" if truncated else "done", "reported_count": total,
                    "seen_count": len(seen), "pages": pages}
        advance_search(driver, query, next_id, current, wait_seconds)
        time.sleep(page_delay)


def review_count(driver, expected_empty: bool = False) -> int | None:
    text = first_text(driver, ".section_review .link_reviewall")
    count = re.search(r"[\d,]+", text)
    if count:
        return int(count[0].replace(",", ""))
    # The live zero-review page has this invitation instead of section_review.
    if expected_empty and not driver.find_elements(By.CSS_SELECTOR, '.section_review') and '방문 후기를 남겨주세요!' in first_text(driver, '.section_grade'):
        return 0
    return None


def reviews_not_provided(driver):
    return any('매장주 요청으로 후기가 제공되지 않는 장소입니다' in e.text
               for e in visible(driver, By.CSS_SELECTOR, '.desc_noti'))


def parse_reviews(driver, place: Place, max_reviews: int) -> list[dict]:
    items = driver.find_elements(By.CSS_SELECTOR, REVIEW_SELECTOR)
    if max_reviews >= 0:
        items = items[:max_reviews]
    result = []
    for item in items:
        rating = next((clean_text(e.get_attribute("textContent")) for e in
                       item.find_elements(By.CSS_SELECTOR, ".starred_grade .screen_out")
                       if re.fullmatch(r"\d+(?:\.\d+)?", clean_text(e.get_attribute("textContent")))), "")
        content = re.sub(r"\s*(더보기|접기)$", "", first_text(item, ".desc_review")).strip()
        tags = "|".join(clean_text(e.text) for e in item.find_elements(By.CSS_SELECTOR, ".wrap_badge .badge_point") if clean_text(e.text))
        if not (content or rating or tags):
            continue
        result.append({"query": place.query, "place_id": place.place_id, "place_name": place.name,
                       "place_url": place.url, "rating": rating, "date": first_text(item, ".txt_date"),
                       "content": content, "tags": tags, "likes": first_text(item, ".review_unit .txt_btn"),
                       "collected_at": now()})
    return result


def business_hours_record(place: Place, snapshot: dict) -> dict:
    """Preserve displayed dates/weekday wording; do not invent a recurring schedule."""
    raw = (snapshot.get('text') or '').strip()
    rows = snapshot.get('rows') or []
    lines = [clean_text(f"{r.get('label','')} {' | '.join(r.get('details') or [])}") for r in rows]
    raw = '\n'.join(dict.fromkeys(value for value in [raw, *lines, *(snapshot.get('notes') or [])] if value))
    opening, closed, breaks, last_orders = [], [], [], []
    for row in rows:
        label = row.get('label', '')
        for detail in row.get('details') or []:
            line = clean_text(f'{label} {detail}')
            if re.search(r'브레이크|휴게시간', detail):
                breaks.append(line)
            elif re.search(r'라스트오더|마지막\s*주문|주문\s*마감', detail):
                last_orders.append(line)
            elif re.search(r'휴무|휴점|휴일', detail):
                closed.append(line)
            elif re.search(r'\d{1,2}:\d{2}|24시간', detail):
                opening.append(line)
    # Some recurring closures and special notices sit outside the daily rows.
    for note in snapshot.get('notes') or []:
        if re.search(r'휴무|휴점|휴일', note):
            closed.append(clean_text(note))
        if re.search(r'브레이크|휴게시간', note):
            breaks.append(clean_text(note))
        if re.search(r'라스트오더|마지막\s*주문|주문\s*마감', note):
            last_orders.append(clean_text(note))
    if opening or closed or breaks or last_orders:
        status = 'available'
    elif snapshot.get('container_found') and re.search(r'영업시간.{0,12}(?:알려주세요|정보가 없습니다|등록되지|미등록)|등록된 영업시간이 없', clean_text(raw)):
        status = 'not_provided'
    else:
        status = 'unrecognized'
    return {'place_id': place.place_id, 'place_name': place.name, 'place_url': place.url,
            'status': status, 'hours_text': raw,
            'opening_hours': '\n'.join(dict.fromkeys(opening)),
            'closed_days': '\n'.join(dict.fromkeys(closed)),
            'break_time': '\n'.join(dict.fromkeys(breaks)),
            'last_order': '\n'.join(dict.fromkeys(last_orders)),
            'schedule_json': json.dumps(rows, ensure_ascii=False),
            'source_url': place.url + '?openhour=1', 'checked_at': now(),
            'error': 'hours_dom_unrecognized' if status == 'unrecognized' else ''}


def collect_business_hours(driver, place: Place, wait_seconds: int) -> dict:
    # ?openhour=1 is Kakao's observed public link for the expanded hours section.
    check_access(driver)
    def hours_state(d):
        if d.find_elements(By.CSS_SELECTOR, '.info_operation'):
            return 'available'
        if any('영업시간을 알려주세요' in e.text for e in visible(d, By.CSS_SELECTOR, '.section_defaultinfo .txt_detail2')):
            return 'not_provided'
        return False
    try:
        state = WebDriverWait(driver, min(wait_seconds, 5)).until(hours_state)
    except TimeoutException:
        return business_hours_record(place, {'container_found': False})
    if state == 'not_provided':
        return business_hours_record(place, {'container_found': True, 'text': '영업시간을 알려주세요'})
    driver.execute_script("""
      const parent=document.querySelector('.info_operation')?.parentElement;
      const toggle=parent && [...parent.querySelectorAll('button,a')].find(e=>e.innerText.trim()==='펼치기');
      if(toggle) toggle.click();
    """)
    snapshot = driver.execute_script("""
      const container=document.querySelector('.info_operation');
      if(!container) return {container_found:false,text:'',rows:[],notes:[]};
      const text=e=>(e?.innerText||'').trim();
      const rows=[...container.querySelectorAll('.line_fold')].map(e=>({
        label:text(e.querySelector('.tit_fold')),
        details:[...e.querySelectorAll('.detail_fold .txt_detail')].map(text).filter(Boolean)
      }));
      const notes=[...container.querySelectorAll('*')].filter(e=>!e.children.length && !e.closest('.line_fold'))
        .map(text).filter(t=>/휴무|휴점|휴일|브레이크|휴게시간|라스트오더|마지막\\s*주문|주문\\s*마감/.test(t));
      return {container_found:true,text:text(container),rows,notes};
    """)
    return business_hours_record(place, snapshot)


def collect_detail(driver, place: Place, max_reviews: int, wait_seconds: int, delay: float,
                   on_business_hours=None):
    # Starting at #review can leave the upper hours section unmounted (lazy DOM).
    driver.get(place.url + "?openhour=1")
    def loaded(d):
        check_access(d)
        return d.find_elements(By.CSS_SELECTOR, ".section_defaultinfo") or False
    try:
        WebDriverWait(driver, wait_seconds).until(loaded)
    except TimeoutException as exc:
        raise TimeoutException('place_detail_load_timeout') from exc
    title = clean_text(driver.title.split("|", 1)[0])
    if not title or title == "카카오맵":
        raise RuntimeError("place_detail_not_loaded")
    hours = collect_business_hours(driver, place, wait_seconds)
    if on_business_hours is not None:
        # Save hours before reviews so an unrelated review timeout cannot lose them.
        on_business_hours(hours)
    driver.execute_script("window.location.hash = 'review';document.querySelector('.section_review')?.scrollIntoView();")
    expected_empty = place.visitor_review_count == '0'
    total = review_count(driver, expected_empty)
    status = "not_requested" if max_reviews == 0 else "limited"
    if max_reviews != 0:
        try:
            WebDriverWait(driver, wait_seconds).until(lambda d: reviews_not_provided(d) or d.find_elements(By.CSS_SELECTOR, REVIEW_SELECTOR) or review_count(d, expected_empty) == 0)
        except TimeoutException as exc:
            check_access(driver)
            raise TimeoutException('review_section_load_timeout') from exc
    unavailable = reviews_not_provided(driver)
    if unavailable:
        status, total = 'not_provided', None
    elif max_reviews != 0:
        total = review_count(driver, expected_empty)
        previous = -1
        for _ in range(10000):
            count = len(driver.find_elements(By.CSS_SELECTOR, REVIEW_SELECTOR))
            if total == 0 or (total is not None and count >= total):
                status = "empty" if total == 0 else "complete"
                break
            if max_reviews > 0 and count >= max_reviews:
                break
            if count == previous:
                raise RuntimeError("reviews_stalled_before_requested_count")
            previous = count
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            more = visible(driver, By.XPATH, "//*[self::a or self::button][contains(normalize-space(.), '후기 더보기')]")
            if more:
                driver.execute_script("arguments[0].click();", more[0])
            time.sleep(max(delay, 1.0))
            WebDriverWait(driver, wait_seconds).until(lambda d: len(d.find_elements(By.CSS_SELECTOR, REVIEW_SELECTOR)) > count)
        else:
            raise RuntimeError("review_iteration_limit")
        for button in visible(driver, By.CSS_SELECTOR, ".desc_review .btn_more"):
            driver.execute_script("arguments[0].click();", button)
    reviews = [] if unavailable else parse_reviews(driver, place, max_reviews)
    if max_reviews and total and not reviews:
        raise RuntimeError("review_parser_empty")
    summary = {"place_id": place.place_id, "place_name": title, "place_url": place.url,
               "average_rating_5": '' if unavailable else first_text(driver, ".section_review .num_star") or place.average_rating_5,
               "visitor_review_count": '' if unavailable else str(total) if total is not None else place.visitor_review_count,
               "blog_review_count": place.blog_review_count, "review_status": status,
               "collected_review_count": len(reviews), "collected_at": now()}
    for index in range(5):
        review = reviews[index] if index < len(reviews) else {}
        summary[f"top_review_{index+1}"] = " | ".join(str(review[k]) for k in ("rating", "date", "content") if review.get(k))
    return summary, reviews


def main():
    parser = argparse.ArgumentParser(description="음식점 Selenium 파서의 실제 검색 진단")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--probe", help="진단할 카카오맵 검색어")
    group.add_argument("--inspect-hours", help="영업시간 공개 DOM을 확인할 숫자 장소 ID")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    driver = build_driver(False)
    try:
        if args.inspect_hours:
            if not args.inspect_hours.isdigit():
                parser.error('inspect-hours must be a numeric place ID')
            driver.get(f'https://place.map.kakao.com/{args.inspect_hours}?openhour=1')
            WebDriverWait(driver, 20).until(lambda d: '|' in d.title and not d.title.startswith('카카오맵'))
            time.sleep(1)
            print(driver.title)
            print(driver.execute_script("return document.querySelector('.info_operation')?.outerHTML || 'NO_HOURS_CONTAINER'"))
            print(driver.execute_script("return [...document.querySelectorAll('[class^=section_]')].map(e=>({class:e.className,text:e.innerText.slice(0,120)})).filter(e=>!e.class.includes('blog'))"))
            place = Place(args.inspect_hours, driver.title.split('|',1)[0].strip(), f'https://place.map.kakao.com/{args.inspect_hours}')
            print(json.dumps(collect_business_hours(driver, place, 20), ensure_ascii=False))
            return
        driver.get(f"https://map.kakao.com/?q={quote(args.probe)}")
        wait_search(driver, 20)
        time.sleep(2)
        link = driver.find_elements(By.CSS_SELECTOR, "a.moreview")[0]
        place = card_to_place(link, args.probe)
        print(json.dumps(asdict(place), ensure_ascii=False))
        print(link.find_element(By.XPATH, "ancestor::li[1]").get_attribute("outerHTML")[:8000])
        more = visible(driver, By.ID, "info.search.place.more")
        if more:
            more[0].click()
            time.sleep(2)
        print("PAGE", driver.find_element(By.ID, "info.search.page").get_attribute("outerHTML"))
        print("NEXT", driver.find_element(By.ID, "info.search.page.next").get_attribute("outerHTML"))
        summary, reviews = collect_detail(driver, place, 5, 20, 1)
        print(json.dumps({"summary": {k:v for k,v in summary.items() if not k.startswith("top_review")},
                          "review_count": len(reviews)}, ensure_ascii=False))
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
