"""Extract place mentions from OCR geometry and keep uncertain matches reviewable."""
from __future__ import annotations

import hashlib
import re
from statistics import median

from catalog import normalized


REGION = re.compile(r"제주(?:특별자치도)?|서귀포시|제주시")
ADDRESS = re.compile(r"(?:제주특별자치도\s*)?(?:서귀포시|제주시)?\s*(?:[가-힣]+[읍면]\s*)?[가-힣0-9]+(?:로|길)(?:\d+번길)?\s+\d+(?:[-–]\d+)?")
NON_PLACES = re.compile(r"^\d{1,2}월에|관광지\s*\d*\s*곳|대표\s*관광지|가기\s*좋은|총정리|가을빛|맛집추천|해물라면맛집|제주여행|제주맛집|저장하고")
REGION_NAMES = {"제주", "제주도", "제주특별자치도", "제주시", "서귀포", "서귀포시"}


def bbox(line):
    if "bbox" in line:
        return line["bbox"]
    words = line.get("words", [])
    if not words:
        return [0, 0, 0, 0]
    bounds = [w["bbox"] for w in words]
    x = min(b[0] for b in bounds)
    y = min(b[1] for b in bounds)
    right = max(b[0] + b[2] for b in bounds)
    bottom = max(b[1] + b[3] for b in bounds)
    return [x, y, right - x, bottom - y]


def clean_name(text):
    name = re.sub(r"^[#＃@'`\s①-⑳]+", "", text).strip()
    name = re.sub(r"^\d{1,2}(?:[.)]\s+|\s+)", "", name)
    name = re.split(r"[#＃@]", name, maxsplit=1)[0].strip()
    name = name.strip("-_:;|[]() ")
    return name


def section_context(lines, box, width, height):
    """Use nearby text in the same column; never mix addresses from other panels."""
    column = box[0] >= width / 2
    y = box[1]
    nearby = []
    for line in lines:
        b = bbox(line)
        if (b[0] >= width / 2) == column and y - height * 0.04 <= b[1] <= y + height * 0.16:
            nearby.append(line["text"])
    text = " ".join(nearby)
    city = "서귀포시" if "서귀포시" in text else ("제주시" if "제주시" in text else None)
    address = ADDRESS.search(text)
    return text, city, address.group().strip() if address else None


def merge_title_words(lines, width):
    """Join ordinary spaces while preserving separate panels and hashtag headings."""
    merged = []
    for raw in sorted(lines, key=lambda l: (bbox(l)[1], bbox(l)[0])):
        line = dict(raw)
        line["bbox"] = bbox(raw)
        b = line["bbox"]
        found = None
        for old in reversed(merged):
            a = old["bbox"]
            vertical = abs((a[1] + a[3] / 2) - (b[1] + b[3] / 2))
            gap = max(a[0], b[0]) - min(a[0] + a[2], b[0] + b[2])
            same_column = (a[0] < width / 2) == (b[0] < width / 2)
            small_height = min(a[3], b[3])
            if same_column and -small_height * 0.2 <= gap <= max(20, small_height * 0.7) and vertical <= small_height * 0.4:
                if re.match(r"[#＃].+", old["text"]) and re.match(r"[#＃].+", line["text"]):
                    continue
                found = old
                break
        if found:
            a = found["bbox"]
            right = max(a[0] + a[2], b[0] + b[2]); bottom = max(a[1] + a[3], b[1] + b[3])
            x = min(a[0], b[0]); y = min(a[1], b[1])
            found["bbox"] = [x, y, right - x, bottom - y]
            found["text"] = (line["text"] + " " + found["text"]) if b[0] < a[0] else (found["text"] + " " + line["text"])
            found["confidence"] = min(found.get("confidence", 1), line.get("confidence", 1))
        else:
            merged.append(line)
    return merged


def extract_mentions(caption, ocr_rows, catalog):
    collected = []
    for row in ocr_rows:
        if row.get("status") != "complete":
            continue
        width, height = row.get("width", 1080), row.get("height", 1350)
        lines = merge_title_words(row.get("lines", []), width)
        heights = [bbox(line)[3] for line in lines if re.search(r"[가-힣]", line.get("text", "")) and bbox(line)[3] > 0]
        typical = median(heights) if heights else 20
        for line in lines:
            text = line.get("text", "")
            b = bbox(line)
            name = clean_name(text)
            if not 2 <= len(normalized(name)) <= 40 or not re.search(r"[가-힣]", name):
                continue
            if normalized(name) in REGION_NAMES or NON_PLACES.search(name) or ADDRESS.fullmatch(name):
                continue
            candidate = catalog.candidates(name)
            exact = any(c["match_kind"] == "exact_name" for c in candidate)
            hashtag = "#" in text or "＃" in text
            numbered = bool(re.match(r"^\s*\d{1,2}[.)\s]+", text))
            # Names in informative large titles, numbered lists, and exact catalog rows.
            title_size = b[3] >= max(24, typical * 1.25)
            if not (numbered or (title_size and (hashtag or exact or len(normalized(name)) <= 22))):
                continue
            if name.startswith(("가을", "저녁", "왕복", "내외", "거대한", "경사가", "주차", "한눈", "10월에는", "탁트인", "가벼운", "해발", "일몰", "해안가", "데크", "독특한", "실내", "제주의", "스릴", "문어", "푸짐", "부드러운", "김밥맛집")) and not exact:
                continue
            if re.search(r"좋아요|있어요|가득|풍경|산책하기|들어간|만나는|함께|먹는|내외|체험,|먹이주기", name) and not exact:
                continue
            context, city, address = section_context(lines, b, width, height)
            nearby_number = any(re.fullmatch(r"\d{1,2}", l["text"].strip()) and
                                0 <= b[0] - bbox(l)[0] - bbox(l)[2] <= width * 0.08 and
                                abs((bbox(l)[1] + bbox(l)[3] / 2) - (b[1] + b[3] / 2)) <= b[3]
                                for l in lines)
            if not (exact or hashtag or numbered or nearby_number or address):
                continue
            collected.append({"observed_name": name, "region_hint": city or ("제주" if REGION.search(caption + context) else None),
                              "name_status": "review_required" if line.get("confidence", 1) < 0.5 else "ocr_observed",
                              "address_hint": address, "evidence": [{"kind": "image_ocr", "image_order": row["index"],
                              "text": text, "bbox": [round(x, 1) for x in b], "ocr_confidence": line.get("confidence"),
                              "context": context[:500]}]})
    # Caption-only names must occur as complete tokens or separated list entries.
    for part in re.split(r"[\n,;]|(?=#)", caption or ""):
        name = clean_name(part)
        if not name or normalized(name) in REGION_NAMES or NON_PLACES.search(name):
            continue
        if normalized(name) in catalog.aliases:
            start = caption.find(part)
            collected.append({"observed_name": name, "region_hint": "제주" if REGION.search(caption) else None,
                              "address_hint": None, "evidence": [{"kind": "caption", "text": part,
                              "span": [start, start + len(part)]}]})
    merged = {}
    for mention in collected:
        key = normalized(mention["observed_name"])
        # An address conflict keeps branches separate even if the visible name is equal.
        if key in merged and mention.get("address_hint") and merged[key].get("address_hint") and normalized(mention["address_hint"]) != normalized(merged[key]["address_hint"]):
            key += ":" + normalized(mention["address_hint"])
        if key in merged:
            merged[key]["evidence"].extend(mention["evidence"])
        else:
            merged[key] = mention
    mentions = list(merged.values())
    for mention in mentions:
        key = normalized(mention["observed_name"]) + str(mention.get("address_hint"))
        mention["mention_id"] = hashlib.sha256(key.encode()).hexdigest()[:16]
        resolve_mention(mention, catalog)
    return mentions


def resolve_mention(mention, catalog, selected=None):
    name = mention.get("corrected_name") or mention["observed_name"]
    candidates = catalog.candidates(name)
    mention["candidates"] = candidates
    mention["metadata"] = None
    mention["labels"] = None
    mention.pop("identity_basis", None)
    mention["resolution"] = "not_found" if not candidates else "needs_review"
    if selected:
        if selected not in {c["canonical_id"] for c in candidates}:
            raise ValueError("candidate_not_offered")
        chosen = selected
        method = "user_selected"
    else:
        # UI candidate limits must never hide a conflicting exact-name branch.
        exact = [c for c in catalog.candidates(name, limit=None) if c["match_kind"] == "exact_name"]
        viable = []
        for c in exact:
            hint = mention.get("region_hint")
            if hint in {"서귀포시", "제주시"} and c["city"]["name"] != hint:
                continue
            address = mention.get("address_hint")
            if address:
                road = normalized(address)
                address_ok = road in normalized(c["address"]) or normalized(c["address"]) in road
                # Explicit address evidence takes precedence over generic 제주 context.
                if not address_ok:
                    continue
            elif not hint or hint == "제주" and "제주" not in c["address"]:
                continue
            viable.append(c)
        if len(viable) != 1:
            return mention
        chosen = viable[0]["canonical_id"]
        method = "exact_name_and_location"
    mention.update(resolution="resolved", metadata=catalog.metadata(chosen), labels=catalog.labels(chosen),
                   identity_basis=method)
    return mention
