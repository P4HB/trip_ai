(() => {
  "use strict";

  const CATEGORY_CONFIG = {
    12: { label: "관광지", short: "관", color: "#14877a" },
    14: { label: "문화시설", short: "문", color: "#7564c7" },
    15: { label: "축제·행사", short: "축", color: "#d84f75" },
    25: { label: "여행코스", short: "코", color: "#3c7da8" },
    28: { label: "레포츠", short: "레", color: "#dc773a" },
    32: { label: "숙박", short: "숙", color: "#3974c5" },
    38: { label: "쇼핑", short: "쇼", color: "#aa6b36" },
    39: { label: "음식점", short: "맛", color: "#c55747" },
  };

  const FALLBACK_CATEGORY = { label: "기타", short: "기", color: "#60706d" };
  const LIST_LIMIT = 120;
  const JEJU_LIMITS = [
    [32.78, 125.72],
    [33.82, 127.22],
  ];

  const LABEL_GROUPS = [
    {
      key: "theme",
      title: "Theme",
      description: "장소에서 기대할 수 있는 핵심 경험",
    },
    {
      key: "environment",
      title: "Environment",
      description: "실내외 구성과 날씨 영향",
    },
    {
      key: "style_evidence",
      title: "Style 근거",
      description: "여행 스타일을 계산하는 장소 특성",
    },
    {
      key: "derived_style",
      title: "여행 스타일",
      description: "장소 특성을 조합한 여행 성향",
    },
  ];

  const LABEL_DEFINITIONS = {
    "theme.mountain": ["산·오름", "산, 오름, 고개, 봉우리 경험이 핵심인 정도"],
    "theme.ocean": ["바다", "바다, 해변, 해안 경관을 경험하는 정도"],
    "theme.activity": ["액티비티", "몸을 움직이는 체험이나 레포츠를 즐기는 정도"],
    "theme.culture_history": ["문화·역사", "문화, 역사, 유산, 전시를 경험하는 정도"],
    "theme.theme_park": ["테마파크", "놀이시설이나 테마형 공간을 즐기는 정도"],
    "theme.cafe": ["카페", "카페나 찻집에서 머무는 경험이 핵심인 정도"],
    "theme.traditional_market": ["전통시장", "시장과 지역 상권을 둘러보는 경험의 정도"],
    "theme.festival": ["축제", "축제, 공연, 행사 참여 경험의 정도"],
    "environment.indoor_ratio": ["실내 비율", "전체 방문 경험 중 실내에서 보내는 비중"],
    "environment.weather_sensitivity": ["날씨 민감도", "비, 바람, 더위 등 날씨가 핵심 경험에 미치는 영향"],
    "style_evidence.restfulness": ["여유로움", "느긋하고 차분하게 머물기 좋은 정도"],
    "style_evidence.physical_ease": ["신체 편안함", "걷기와 체력 부담이 적어 편하게 방문할 수 있는 정도"],
    "style_evidence.visit_duration_flexibility": ["시간 유연성", "체류시간을 짧거나 길게 조절하기 쉬운 정도"],
    "style_evidence.scenic_value": ["경관 가치", "인상적인 자연·도시 경관을 볼 수 있는 정도"],
    "style_evidence.distinctiveness": ["새로움", "다른 장소와 구별되는 독특한 경험의 정도"],
    "style_evidence.local_embeddedness": ["제주 로컬성", "제주의 생활, 문화, 지역성을 느낄 수 있는 정도"],
    "style_evidence.landmark_significance": ["랜드마크성", "제주를 대표하는 상징적 명소인 정도"],
    "style_evidence.photo_value": ["사진 가치", "사진을 남기기 좋은 장면과 분위기의 정도"],
    "derived_style.healing_slow": ["여유로운 힐링", "천천히 쉬면서 편안하게 즐기는 여행에 맞는 정도"],
    "derived_style.scenic_immersion": ["멋진 경관 몰입", "인상적인 풍경을 충분히 감상하는 여행에 맞는 정도"],
    "derived_style.discovery_explorer": ["새로운 곳 탐험", "새롭고 독특한 장소를 찾아다니는 여행에 맞는 정도"],
    "derived_style.local_immersion": ["제주 로컬 몰입", "제주의 지역성과 일상에 가까이 다가가는 여행에 맞는 정도"],
    "derived_style.iconic_highlight": ["대표 명소 중심", "잘 알려진 핵심 명소를 챙기는 여행에 맞는 정도"],
    "derived_style.photo_mood": ["사진·분위기", "사진과 공간 분위기를 중요하게 보는 여행에 맞는 정도"],
  };

  const GENERIC_SCORE_MEANINGS = {
    0: "해당 성향이 거의 없음",
    0.25: "해당 성향이 낮음",
    0.5: "해당 성향이 보통",
    0.75: "해당 성향이 높음",
    1: "해당 성향이 매우 높음",
  };

  const INDOOR_SCORE_MEANINGS = {
    0: "거의 전부 야외",
    0.25: "야외 중심·일부 실내",
    0.5: "실내와 야외가 비슷함",
    0.75: "실내 중심·일부 야외",
    1: "거의 전부 실내",
  };

  const WEATHER_SCORE_MEANINGS = {
    0: "날씨 영향이 거의 없음",
    0.25: "날씨 영향이 적음",
    0.5: "날씨에 따라 일부 제한",
    0.75: "핵심 경험이 크게 축소될 수 있음",
    1: "이용 곤란·취소 가능성이 매우 높음",
  };

  const dom = {
    mapLoading: document.querySelector("#mapLoading"),
    headerValidCount: document.querySelector("#headerValidCount"),
    sourceDate: document.querySelector("#sourceDate"),
    filterSummary: document.querySelector("#filterSummary"),
    placeSearch: document.querySelector("#placeSearch"),
    clearSearchButton: document.querySelector("#clearSearchButton"),
    resetFiltersButton: document.querySelector("#resetFiltersButton"),
    categoryFilters: document.querySelector("#categoryFilters"),
    resultCount: document.querySelector("#resultCount"),
    resultList: document.querySelector("#resultList"),
    viewportCount: document.querySelector("#viewportCount"),
    mobileResultCount: document.querySelector("#mobileResultCount"),
    fitFilteredButton: document.querySelector("#fitFilteredButton"),
    fitJejuButton: document.querySelector("#fitJejuButton"),
    detailPanel: document.querySelector("#detailPanel"),
    detailCloseButton: document.querySelector("#detailCloseButton"),
    detailImage: document.querySelector("#detailImage"),
    detailImagePlaceholder: document.querySelector("#detailImagePlaceholder"),
    detailType: document.querySelector("#detailType"),
    detailModified: document.querySelector("#detailModified"),
    detailTitle: document.querySelector("#detailTitle"),
    detailAddress: document.querySelector("#detailAddress"),
    detailPhone: document.querySelector("#detailPhone"),
    detailLabelSummary: document.querySelector("#detailLabelSummary"),
    detailLabelGroups: document.querySelector("#detailLabelGroups"),
    labelTooltip: document.querySelector("#labelTooltip"),
    labelTooltipTitle: document.querySelector("#labelTooltipTitle"),
    labelTooltipDescription: document.querySelector("#labelTooltipDescription"),
    labelTooltipValue: document.querySelector("#labelTooltipValue"),
    centerPlaceButton: document.querySelector("#centerPlaceButton"),
    copyPlaceButton: document.querySelector("#copyPlaceButton"),
    copyPlaceButtonLabel: document.querySelector("#copyPlaceButtonLabel"),
    mobilePanelButton: document.querySelector("#mobilePanelButton"),
    mobileResultsFab: document.querySelector("#mobileResultsFab"),
    sidebarCloseButton: document.querySelector("#sidebarCloseButton"),
    sidebarBackdrop: document.querySelector("#sidebarBackdrop"),
  };

  const numberFormatter = new Intl.NumberFormat("ko-KR");
  const rawPlaces = Array.isArray(window.JEJU_PLACES) ? window.JEJU_PLACES : [];
  const metadata = window.JEJU_DATA_META || {};
  const labelMetadata = window.JEJU_LABEL_META || {};
  const rawPlaceLabels =
    window.JEJU_PLACE_LABELS && typeof window.JEJU_PLACE_LABELS === "object"
      ? window.JEJU_PLACE_LABELS
      : {};
  const labelPaths = Array.isArray(labelMetadata.paths) ? labelMetadata.paths : [];
  const places = rawPlaces.map((place) => ({
    ...place,
    searchText: `${place.title || ""} ${place.address || ""}`
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR"),
  }));

  const countsByType = places.reduce((counts, place) => {
    counts.set(place.type, (counts.get(place.type) || 0) + 1);
    return counts;
  }, new Map());

  const availableTypes = Object.keys(CATEGORY_CONFIG).filter(
    (type) => (countsByType.get(type) || 0) > 0,
  );

  const state = {
    map: null,
    tileLayer: null,
    clusterLayer: null,
    markerById: new Map(),
    selectedTypes: new Set(availableTypes),
    selectedPlace: null,
    filteredPlaces: places,
    initialBounds: null,
    query: "",
    renderFrame: null,
  };

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function categoryFor(type) {
    return CATEGORY_CONFIG[type] || FALLBACK_CATEGORY;
  }

  function formatSourceDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value || "—");
  }

  function formatModifiedDate(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length < 8) return "수정일 정보 없음";
    return `업데이트 ${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }

  function formatScore(value) {
    return Number(value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function scoreMeaning(labelPath, value) {
    if (labelPath === "environment.indoor_ratio") {
      return INDOOR_SCORE_MEANINGS[value] || "값 의미 없음";
    }
    if (labelPath === "environment.weather_sensitivity") {
      return WEATHER_SCORE_MEANINGS[value] || "값 의미 없음";
    }
    return GENERIC_SCORE_MEANINGS[value] || "값 의미 없음";
  }

  function hideLabelTooltip() {
    dom.labelTooltip.hidden = true;
  }

  function positionLabelTooltip(target) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = dom.labelTooltip.getBoundingClientRect();
    const viewportPadding = 12;
    const centeredLeft = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, centeredLeft),
    );
    let top = targetRect.top - tooltipRect.height - 10;
    if (top < viewportPadding) top = targetRect.bottom + 10;
    top = Math.min(window.innerHeight - tooltipRect.height - viewportPadding, top);
    dom.labelTooltip.style.left = `${Math.round(left)}px`;
    dom.labelTooltip.style.top = `${Math.round(Math.max(viewportPadding, top))}px`;
  }

  function showLabelTooltip(target, labelPath, value) {
    const [labelName, description] = LABEL_DEFINITIONS[labelPath] || [labelPath, "장소 라벨"];
    dom.labelTooltipTitle.textContent = `${labelName} · ${formatScore(value)}`;
    dom.labelTooltipDescription.textContent = description;
    dom.labelTooltipValue.textContent = `현재 값 의미: ${scoreMeaning(labelPath, value)}`;
    dom.labelTooltip.hidden = false;
    window.requestAnimationFrame(() => positionLabelTooltip(target));
  }

  function createLabelResult(labelPath, value) {
    const [labelName] = LABEL_DEFINITIONS[labelPath] || [labelPath];
    const meaning = scoreMeaning(labelPath, value);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "label-result";
    button.style.setProperty("--label-strength", `${Number(value) * 100}%`);
    button.setAttribute("aria-describedby", "labelTooltip");
    button.setAttribute(
      "aria-label",
      `${labelName}, ${formatScore(value)}, ${meaning}. 설명 보기`,
    );

    const header = document.createElement("span");
    header.className = "label-result-header";
    const name = document.createElement("span");
    name.className = "label-result-name";
    name.textContent = labelName;
    const score = document.createElement("strong");
    score.className = "label-result-score";
    score.textContent = formatScore(value);
    header.append(name, score);

    const track = document.createElement("span");
    track.className = "label-result-track";
    const fill = document.createElement("span");
    fill.className = "label-result-fill";
    track.append(fill);
    button.append(header, track);

    button.addEventListener("mouseenter", () => showLabelTooltip(button, labelPath, value));
    button.addEventListener("mouseleave", () => {
      if (document.activeElement !== button) hideLabelTooltip();
    });
    button.addEventListener("focus", () => showLabelTooltip(button, labelPath, value));
    button.addEventListener("blur", hideLabelTooltip);
    button.addEventListener("click", () => showLabelTooltip(button, labelPath, value));
    return button;
  }

  function renderDetailLabels(place) {
    hideLabelTooltip();
    const values = rawPlaceLabels[place.id];
    const validValues =
      Array.isArray(values) &&
      labelPaths.length === 24 &&
      values.length === labelPaths.length &&
      values.every((value) => [0, 0.25, 0.5, 0.75, 1].includes(value));

    if (!validValues) {
      dom.detailLabelSummary.textContent = "미제공";
      const empty = document.createElement("div");
      empty.className = "label-empty";
      const title = document.createElement("strong");
      title.textContent = "이 장소의 라벨 데이터가 없습니다.";
      const description = document.createElement("span");
      description.textContent =
        place.type === "39"
          ? "현재 라벨 범위에서 제외된 일반 음식·주점입니다."
          : "현재 지도 스냅샷과 연결되는 라벨을 찾지 못했습니다.";
      empty.append(title, description);
      dom.detailLabelGroups.replaceChildren(empty);
      return;
    }

    const version = String(labelMetadata.labelVersion || "").replace(/^place-preference-label-/, "");
    dom.detailLabelSummary.textContent = `${values.length}개${version ? ` · ${version}` : ""}`;
    const valuesByPath = new Map(labelPaths.map((labelPath, index) => [labelPath, values[index]]));
    const fragment = document.createDocumentFragment();

    for (const group of LABEL_GROUPS) {
      const entries = labelPaths.filter((labelPath) => labelPath.startsWith(`${group.key}.`));
      if (!entries.length) continue;
      const section = document.createElement("section");
      section.className = "label-group";
      const heading = document.createElement("div");
      heading.className = "label-group-heading";
      const title = document.createElement("h4");
      title.textContent = group.title;
      const description = document.createElement("span");
      description.textContent = group.description;
      heading.append(title, description);
      const grid = document.createElement("div");
      grid.className = "label-grid";
      for (const labelPath of entries) {
        grid.append(createLabelResult(labelPath, valuesByPath.get(labelPath)));
      }
      section.append(heading, grid);
      fragment.append(section);
    }

    dom.detailLabelGroups.replaceChildren(fragment);
  }

  function debounce(callback, delay = 200) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function setLoadingError(message) {
    dom.mapLoading.classList.add("is-error");
    dom.mapLoading.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = message;
    dom.mapLoading.append(strong);
  }

  function hideLoading() {
    dom.mapLoading.classList.add("is-hidden");
    window.setTimeout(() => {
      dom.mapLoading.hidden = true;
    }, 300);
  }

  function createCategoryFilters() {
    const fragment = document.createDocumentFragment();

    for (const type of availableTypes) {
      const category = categoryFor(type);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-chip";
      button.dataset.type = type;
      button.setAttribute("aria-pressed", "true");
      button.style.setProperty("--chip-color", category.color);

      const icon = document.createElement("span");
      icon.className = "chip-icon";
      icon.textContent = category.short;
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "chip-label";
      label.textContent = category.label;

      const count = document.createElement("span");
      count.className = "chip-count";
      count.textContent = formatNumber(countsByType.get(type));

      button.append(icon, label, count);
      button.addEventListener("click", () => toggleCategory(type));
      fragment.append(button);
    }

    dom.categoryFilters.replaceChildren(fragment);
  }

  function updateCategoryFilterState() {
    dom.categoryFilters.querySelectorAll(".category-chip").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        state.selectedTypes.has(button.dataset.type) ? "true" : "false",
      );
    });
  }

  function toggleCategory(type) {
    if (state.selectedTypes.has(type)) {
      state.selectedTypes.delete(type);
    } else {
      state.selectedTypes.add(type);
    }
    updateCategoryFilterState();
    applyFilters();
  }

  function createMarkerIcon(place, selected = false) {
    const category = categoryFor(place.type);
    return window.L.divIcon({
      className: `place-marker-wrap${selected ? " is-selected" : ""}`,
      html: `<div class="place-marker" style="--marker-color:${category.color}"><span>${category.short}</span></div>`,
      iconSize: [32, 38],
      iconAnchor: [16, 37],
      tooltipAnchor: [0, -31],
    });
  }

  function createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const sizeClass = count >= 100 ? "cluster-large" : count >= 20 ? "cluster-medium" : "";
    const size = count >= 100 ? 58 : count >= 20 ? 52 : 46;
    return window.L.divIcon({
      className: "cluster-icon",
      html: `<div class="cluster-bubble ${sizeClass}">${formatNumber(count)}</div>`,
      iconSize: [size, size],
    });
  }

  function createMarkers() {
    for (const place of places) {
      const marker = window.L.marker([place.lat, place.lng], {
        icon: createMarkerIcon(place),
        keyboard: true,
        riseOnHover: true,
        title: place.title,
      });

      const tooltip = document.createElement("span");
      tooltip.textContent = place.title;
      marker.bindTooltip(tooltip, {
        className: "place-tooltip",
        direction: "top",
        opacity: 1,
        offset: [0, -4],
      });
      marker.on("click", () => selectPlace(place, { moveMap: false }));
      state.markerById.set(place.id, marker);
    }
  }

  function initMap() {
    if (!window.L || typeof window.L.markerClusterGroup !== "function") {
      throw new Error("지도 라이브러리를 불러오지 못했습니다. vendor 파일을 확인해 주세요.");
    }
    if (!places.length) {
      throw new Error("표시할 제주 장소 데이터가 없습니다.");
    }

    state.map = window.L.map("map", {
      zoomControl: false,
      minZoom: 7,
      maxZoom: 19,
      maxBounds: JEJU_LIMITS,
      maxBoundsViscosity: 0.45,
      preferCanvas: true,
    });

    window.L.control.zoom({ position: "topright" }).addTo(state.map);
    state.tileLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(state.map);

    state.clusterLayer = window.L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 80,
      chunkDelay: 30,
      disableClusteringAtZoom: 16,
      maxClusterRadius: 52,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: createClusterIcon,
    });

    state.map.addLayer(state.clusterLayer);
    createMarkers();
    state.initialBounds = window.L.latLngBounds(places.map((place) => [place.lat, place.lng]));

    state.map.on("moveend zoomend", scheduleVisibleResultRender);
    state.tileLayer.once("load", hideLoading);
    window.setTimeout(hideLoading, 2500);

    for (const selector of [".map-toolbar", ".viewport-status", ".detail-card", ".mobile-results-fab"]) {
      const element = document.querySelector(selector);
      if (element) {
        window.L.DomEvent.disableClickPropagation(element);
        window.L.DomEvent.disableScrollPropagation(element);
      }
    }

    applyFilters();
    fitJeju();
  }

  function matchesCurrentFilters(place) {
    if (!state.selectedTypes.has(place.type)) return false;
    if (!state.query) return true;
    return place.searchText.includes(state.query);
  }

  function applyFilters({ fit = false } = {}) {
    state.filteredPlaces = places.filter(matchesCurrentFilters);
    state.clusterLayer.clearLayers();
    state.clusterLayer.addLayers(
      state.filteredPlaces.map((place) => state.markerById.get(place.id)).filter(Boolean),
    );

    const filteredIds = new Set(state.filteredPlaces.map((place) => place.id));
    if (state.selectedPlace && !filteredIds.has(state.selectedPlace.id)) {
      clearSelection();
    }

    dom.fitFilteredButton.disabled = state.filteredPlaces.length === 0;
    dom.filterSummary.textContent = `전체 ${formatNumber(places.length)}개 중 ${formatNumber(
      state.filteredPlaces.length,
    )}개 표시`;
    updateCategoryFilterState();
    scheduleVisibleResultRender();

    if (fit && state.filteredPlaces.length) {
      fitFilteredPlaces();
    }
  }

  function scheduleVisibleResultRender() {
    if (state.renderFrame) window.cancelAnimationFrame(state.renderFrame);
    state.renderFrame = window.requestAnimationFrame(() => {
      state.renderFrame = null;
      renderVisibleResults();
    });
  }

  function renderVisibleResults() {
    if (!state.map) return;
    const bounds = state.map.getBounds().pad(0.015);
    const center = state.map.getCenter();
    const visiblePlaces = state.filteredPlaces
      .filter((place) => bounds.contains([place.lat, place.lng]))
      .sort((a, b) => {
        const aDistance = state.map.distance(center, [a.lat, a.lng]);
        const bDistance = state.map.distance(center, [b.lat, b.lng]);
        return aDistance - bDistance || a.title.localeCompare(b.title, "ko");
      });

    dom.viewportCount.textContent = formatNumber(visiblePlaces.length);
    dom.resultCount.textContent = formatNumber(visiblePlaces.length);
    dom.mobileResultCount.textContent = formatNumber(visiblePlaces.length);

    if (!state.filteredPlaces.length) {
      renderEmptyState(
        "조건에 맞는 장소가 없어요",
        "검색어를 바꾸거나 카테고리 필터를 초기화해 보세요.",
      );
      return;
    }

    if (!visiblePlaces.length) {
      renderEmptyState(
        "이 지도 화면에는 결과가 없어요",
        "‘결과 맞춤’을 누르면 검색된 장소가 있는 곳으로 이동합니다.",
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const place of visiblePlaces.slice(0, LIST_LIMIT)) {
      fragment.append(createPlaceListItem(place));
    }

    if (visiblePlaces.length > LIST_LIMIT) {
      const note = document.createElement("p");
      note.className = "list-note";
      note.textContent = `가까운 ${formatNumber(LIST_LIMIT)}개를 먼저 표시하고 있어요. 지도를 확대하면 더 자세히 볼 수 있습니다.`;
      fragment.append(note);
    }

    dom.resultList.replaceChildren(fragment);
  }

  function renderEmptyState(title, description) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const copy = document.createElement("span");
    copy.textContent = description;
    empty.append(strong, copy);
    dom.resultList.replaceChildren(empty);
  }

  function createPlaceListItem(place) {
    const category = categoryFor(place.type);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-item";
    button.dataset.placeId = place.id;
    button.style.setProperty("--item-color", category.color);
    button.setAttribute(
      "aria-label",
      `${place.title}, ${category.label}${place.address ? `, ${place.address}` : ""}`,
    );
    button.setAttribute("aria-current", state.selectedPlace?.id === place.id ? "true" : "false");

    const icon = document.createElement("span");
    icon.className = "place-item-icon";
    icon.textContent = category.short;
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "place-item-copy";
    const title = document.createElement("span");
    title.className = "place-item-title";
    title.textContent = place.title;
    const address = document.createElement("span");
    address.className = "place-item-address";
    address.textContent = place.address || `${category.label} · 주소 정보 없음`;
    copy.append(title, address);

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("aria-hidden", "true");
    arrow.classList.add("place-item-arrow");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m9 6 6 6-6 6");
    arrow.append(path);

    button.append(icon, copy, arrow);
    button.addEventListener("click", () => {
      selectPlace(place, { moveMap: true });
      closeSidebar();
    });
    return button;
  }

  function selectPlace(place, { moveMap = false } = {}) {
    const previous = state.selectedPlace;
    state.selectedPlace = place;

    if (previous && previous.id !== place.id) {
      const previousMarker = state.markerById.get(previous.id);
      previousMarker?.setIcon(createMarkerIcon(previous, false));
    }

    const marker = state.markerById.get(place.id);
    marker?.setIcon(createMarkerIcon(place, true));
    renderDetail(place);
    scheduleVisibleResultRender();

    if (moveMap && marker) {
      state.clusterLayer.zoomToShowLayer(marker, () => {
        state.map.flyTo([place.lat, place.lng], Math.max(state.map.getZoom(), 14), {
          animate: true,
          duration: 0.5,
        });
      });
    }

    window.requestAnimationFrame(() => {
      const selectedItem = dom.resultList.querySelector(`[data-place-id="${place.id}"]`);
      selectedItem?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function renderDetail(place) {
    const category = categoryFor(place.type);
    dom.detailPanel.hidden = false;
    dom.detailPanel.style.setProperty("--detail-color", category.color);
    document.body.classList.add("detail-open");

    dom.detailType.textContent = category.label;
    dom.detailModified.textContent = formatModifiedDate(place.modified);
    dom.detailTitle.textContent = place.title;
    dom.detailAddress.textContent = place.address || "주소 정보 없음";
    dom.detailPhone.textContent = place.phone || "";
    dom.detailPhone.hidden = !place.phone;
    renderDetailLabels(place);

    dom.detailImage.onload = () => {
      dom.detailImage.hidden = false;
      dom.detailImagePlaceholder.hidden = true;
    };
    dom.detailImage.onerror = () => {
      dom.detailImage.hidden = true;
      dom.detailImagePlaceholder.hidden = false;
      dom.detailImage.removeAttribute("src");
    };

    if (place.image) {
      dom.detailImage.hidden = false;
      dom.detailImagePlaceholder.hidden = true;
      dom.detailImage.alt = `${place.title} 사진`;
      dom.detailImage.src = place.image;
    } else {
      dom.detailImage.hidden = true;
      dom.detailImagePlaceholder.hidden = false;
      dom.detailImage.removeAttribute("src");
      dom.detailImage.alt = "";
    }
  }

  function clearSelection() {
    if (state.selectedPlace) {
      const marker = state.markerById.get(state.selectedPlace.id);
      marker?.setIcon(createMarkerIcon(state.selectedPlace, false));
    }
    state.selectedPlace = null;
    hideLabelTooltip();
    dom.detailPanel.hidden = true;
    document.body.classList.remove("detail-open");
    scheduleVisibleResultRender();
  }

  function fitBoundsForPlaces(targetPlaces, maxZoom = 12) {
    if (!targetPlaces.length) return;
    if (targetPlaces.length === 1) {
      state.map.flyTo([targetPlaces[0].lat, targetPlaces[0].lng], 14, {
        animate: true,
        duration: 0.55,
      });
      return;
    }
    const bounds = window.L.latLngBounds(targetPlaces.map((place) => [place.lat, place.lng]));
    state.map.fitBounds(bounds, {
      animate: true,
      duration: 0.55,
      maxZoom,
      padding: [42, 42],
    });
  }

  function fitFilteredPlaces() {
    fitBoundsForPlaces(state.filteredPlaces, 12);
  }

  function fitJeju() {
    if (!state.initialBounds) return;
    state.map.fitBounds(state.initialBounds, {
      animate: true,
      duration: 0.55,
      maxZoom: 10,
      padding: [36, 36],
    });
  }

  function centerSelectedPlace() {
    if (!state.selectedPlace) return;
    state.map.flyTo([state.selectedPlace.lat, state.selectedPlace.lng], 15, {
      animate: true,
      duration: 0.5,
    });
  }

  async function copySelectedPlace() {
    if (!state.selectedPlace) return;
    const place = state.selectedPlace;
    const text = [
      place.title,
      place.address,
      `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      const original = dom.copyPlaceButtonLabel.textContent;
      dom.copyPlaceButtonLabel.textContent = "복사됨";
      window.setTimeout(() => {
        dom.copyPlaceButtonLabel.textContent = original;
      }, 1300);
    } catch {
      window.prompt("아래 위치 정보를 복사하세요.", text);
    }
  }

  function resetFilters() {
    state.query = "";
    dom.placeSearch.value = "";
    dom.clearSearchButton.hidden = true;
    state.selectedTypes = new Set(availableTypes);
    clearSelection();
    applyFilters();
    fitJeju();
  }

  function openSidebar() {
    document.body.classList.add("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "true");
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "false");
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function bindEvents() {
    const handleSearch = debounce(() => {
      state.query = dom.placeSearch.value
        .trim()
        .normalize("NFKC")
        .toLocaleLowerCase("ko-KR");
      dom.clearSearchButton.hidden = !dom.placeSearch.value;
      applyFilters({ fit: Boolean(state.query) });
    }, 190);

    dom.placeSearch.addEventListener("input", handleSearch);
    dom.clearSearchButton.addEventListener("click", () => {
      dom.placeSearch.value = "";
      state.query = "";
      dom.clearSearchButton.hidden = true;
      applyFilters();
      dom.placeSearch.focus();
    });
    dom.resetFiltersButton.addEventListener("click", resetFilters);
    dom.fitFilteredButton.addEventListener("click", fitFilteredPlaces);
    dom.fitJejuButton.addEventListener("click", fitJeju);
    dom.detailCloseButton.addEventListener("click", clearSelection);
    dom.centerPlaceButton.addEventListener("click", centerSelectedPlace);
    dom.copyPlaceButton.addEventListener("click", copySelectedPlace);
    dom.mobilePanelButton.addEventListener("click", openSidebar);
    dom.mobileResultsFab.addEventListener("click", openSidebar);
    dom.sidebarCloseButton.addEventListener("click", closeSidebar);
    dom.sidebarBackdrop.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.body.classList.contains("sidebar-open")) {
        closeSidebar();
      } else if (state.selectedPlace) {
        clearSelection();
      }
    });

    window.addEventListener(
      "resize",
      debounce(() => {
        hideLabelTooltip();
        if (window.innerWidth > 760) closeSidebar();
        state.map?.invalidateSize();
        scheduleVisibleResultRender();
      }, 120),
    );
  }

  function initialize() {
    try {
      dom.headerValidCount.textContent = formatNumber(metadata.validCoordinates || places.length);
      dom.sourceDate.textContent = `수집일 ${formatSourceDate(metadata.sourceDate)}`;
      createCategoryFilters();
      bindEvents();
      initMap();
    } catch (error) {
      console.error(error);
      setLoadingError(error instanceof Error ? error.message : "지도를 준비하지 못했습니다.");
      dom.filterSummary.textContent = "데이터를 불러오지 못했습니다.";
      renderEmptyState("지도를 열 수 없어요", "파일 구성을 확인한 뒤 페이지를 새로고침해 주세요.");
    }
  }

  initialize();
})();
