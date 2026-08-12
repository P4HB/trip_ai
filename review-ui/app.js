(() => {
  "use strict";

  const data = window.JEJU_V5_RESEARCHED_DATA;
  const $ = (id) => document.getElementById(id);
  const dom = {
    placeCount: $("placeCount"), placeSearch: $("placeSearch"), resultCount: $("resultCount"),
    placeList: $("placeList"), emptyState: $("emptyState"), placeDetail: $("placeDetail"),
    placeId: $("placeId"), placeTitle: $("placeTitle"), placeMeta: $("placeMeta"), reviewedAt: $("reviewedAt"),
    labelGrid: $("labelGrid"), evidenceHeading: $("evidenceHeading"), labelEvidence: $("labelEvidence"),
  };
  const labelNames = {
    "theme.mountain": "산", "theme.ocean": "바다", "theme.activity": "활동", "theme.culture_history": "문화·역사",
    "theme.theme_park": "테마파크", "theme.cafe": "카페", "theme.traditional_market": "전통시장", "theme.festival": "축제",
    "environment.indoor_ratio": "실내 비중", "environment.weather_sensitivity": "날씨 민감도",
    "style_evidence.restfulness": "휴식성", "style_evidence.physical_ease": "신체적 편의", "style_evidence.visit_duration_flexibility": "체류 유연성",
    "style_evidence.scenic_value": "경관 가치", "style_evidence.distinctiveness": "차별성", "style_evidence.local_embeddedness": "제주 로컬성",
    "style_evidence.landmark_significance": "랜드마크성", "style_evidence.photo_value": "사진 가치",
    "derived_style.healing_slow": "힐링·느림", "derived_style.scenic_immersion": "경관 몰입", "derived_style.discovery_explorer": "발견·탐험",
    "derived_style.local_immersion": "로컬 몰입", "derived_style.iconic_highlight": "상징 하이라이트", "derived_style.photo_mood": "사진 무드",
  };
  const groupNames = { theme: "Theme", environment: "Environment", style_evidence: "Style", derived_style: "파생 Style" };
  let selectedPlace = null;
  let selectedLabel = null;

  function text(node, value) { node.textContent = value ?? ""; return node; }
  function element(tag, className, value) { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) text(node, value); return node; }
  function labelName(label) { return labelNames[label] || label; }
  function sourceMap(place) { return new Map(place.sources.map((source) => [source.id, source])); }
  function filteredPlaces() {
    const query = dom.placeSearch.value.trim().toLocaleLowerCase("ko");
    return query ? data.places.filter((place) => `${place.title} ${place.contentid}`.toLocaleLowerCase("ko").includes(query)) : data.places;
  }

  function renderPlaceList() {
    const places = filteredPlaces();
    text(dom.resultCount, `${places.length.toLocaleString("ko-KR")}개 장소`);
    const fragment = document.createDocumentFragment();
    for (const place of places) {
      const button = element("button", "place-button");
      button.type = "button";
      button.role = "option";
      button.setAttribute("aria-selected", String(place === selectedPlace));
      text(button, place.title);
      const id = element("span", "place-id", place.contentid);
      button.append(id);
      button.addEventListener("click", () => selectPlace(place));
      fragment.append(button);
    }
    dom.placeList.replaceChildren(fragment);
  }

  function selectPlace(place) {
    selectedPlace = place;
    selectedLabel = place.labels[0];
    renderPlaceList();
    renderPlace();
  }

  function renderPlace() {
    if (!selectedPlace) return;
    dom.emptyState.hidden = true;
    dom.placeDetail.hidden = false;
    text(dom.placeId, `CONTENT ID · ${selectedPlace.contentid}`);
    text(dom.placeTitle, selectedPlace.title);
    const placeMeta = selectedPlace.source_place;
    text(dom.placeMeta, [placeMeta.contenttypeid && `TourAPI 유형 ${placeMeta.contenttypeid}`, placeMeta.lclsSystm3].filter(Boolean).join(" · "));
    text(dom.reviewedAt, `검수일 ${selectedPlace.reviewed_at}`);
    const fragment = document.createDocumentFragment();
    let previousGroup = null;
    for (const label of selectedPlace.labels) {
      if (label.group !== previousGroup) {
        fragment.append(element("p", "group-title", groupNames[label.group] || label.group));
        previousGroup = label.group;
      }
      const button = element("button", "label-card");
      button.type = "button";
      button.classList.toggle("selected", label === selectedLabel);
      button.setAttribute("aria-pressed", String(label === selectedLabel));
      button.append(element("span", "label-name", labelName(label.label)));
      button.append(element("strong", "label-score", String(label.value)));
      const status = element("span", `status ${label.status === "needs_review" ? "hold" : ""}`, label.status === "needs_review" ? "보류" : "확정");
      button.append(status);
      button.addEventListener("click", () => { selectedLabel = label; renderPlace(); });
      fragment.append(button);
    }
    dom.labelGrid.replaceChildren(fragment);
    renderEvidence();
  }

  function sourceNode(source) {
    const card = element("article", "source-card");
    const link = element("a", "source-publisher", source.publisher || source.id);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link, element("p", "source-meta", `${source.type || "web"} · 확인 ${source.checked_at || "날짜 미기록"}`));
    const list = element("ul", "fact-list");
    for (const fact of source.facts || []) list.append(element("li", "", fact));
    card.append(list);
    return card;
  }

  function renderEvidence() {
    const label = selectedLabel;
    text(dom.evidenceHeading, `${labelName(label.label)} · ${label.value}`);
    const wrap = document.createDocumentFragment();
    const meta = element("div", "label-rationale");
    meta.append(element("p", "", `신뢰도 ${label.confidence ?? "미기록"} · ${label.status === "needs_review" ? "추가 확인 필요" : "확정"}`));
    if (label.rationale) meta.append(element("p", "", label.rationale));
    if (label.calculation) meta.append(element("code", "calculation", label.calculation));
    if (label.hold_reason) meta.append(element("p", "hold-reason", `보류 사유: ${label.hold_reason}`));
    wrap.append(meta);
    const byId = sourceMap(selectedPlace);
    const sourceIds = label.source_ids.length ? label.source_ids : selectedPlace.sources.map((source) => source.id);
    const sources = sourceIds.map((id) => byId.get(id)).filter(Boolean);
    wrap.append(element("h4", "", `연결 근거 ${sources.length}건`));
    const sourceGrid = element("div", "source-grid");
    for (const source of sources) sourceGrid.append(sourceNode(source));
    wrap.append(sourceGrid);
    dom.labelEvidence.replaceChildren(wrap);
  }

  function init() {
    if (!data || data.schema_version !== "place-preference-label-v5-researched-viewer-data-v1") {
      text(dom.emptyState, "v5 라벨 번들을 불러오지 못했습니다. 생성기를 실행한 뒤 새로고침하세요.");
      return;
    }
    text(dom.placeCount, data.place_count.toLocaleString("ko-KR"));
    dom.placeSearch.addEventListener("input", () => {
      const places = filteredPlaces();
      if (!places.includes(selectedPlace)) {
        selectedPlace = places[0] || null;
        selectedLabel = selectedPlace?.labels[0] || null;
      }
      renderPlaceList();
      if (selectedPlace) renderPlace();
    });
    selectedPlace = data.places.find((place) => place.contentid === "2472824") || data.places[0];
    selectedLabel = selectedPlace.labels[0];
    renderPlaceList();
    renderPlace();
  }

  init();
})();
