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
  const LIST_LIMIT = 40;
  const JEJU_LIMITS = [[32.78, 125.72], [33.82, 127.22]];
  const LABEL_GROUPS = [
    { name: "Theme", prefix: "theme.", count: 8 },
    { name: "Environment", prefix: "environment.", count: 2 },
    { name: "Atomic Style", prefix: "style_evidence.", count: 8 },
    { name: "Derived Style · 표시 전용", prefix: "derived_style.", count: 6, displayOnly: true },
    { name: "Companion", prefix: "companion.", count: 5 },
    { name: "Month", prefix: "month.", count: 12 },
  ];
  const LABEL_NAMES = {
    mountain: "산", ocean: "바다", activity: "활동", culture_history: "문화·역사",
    theme_park: "테마파크", cafe: "카페", traditional_market: "전통시장", festival: "축제",
    indoor_ratio: "실내 비율", weather_sensitivity: "날씨 민감", restfulness: "휴식성",
    physical_ease: "이동 편의", visit_duration_flexibility: "체류 유연성", scenic_value: "경관 가치",
    distinctiveness: "독특함", local_embeddedness: "제주 로컬성", landmark_significance: "랜드마크성",
    photo_value: "사진 가치", healing_slow: "힐링·느긋함", scenic_immersion: "경관 몰입",
    discovery_explorer: "발견·탐험", local_immersion: "로컬 몰입", iconic_highlight: "상징 하이라이트",
    photo_mood: "사진 무드", solo: "혼자", couple: "연인·부부", friends: "친구",
    kids: "아이", parents: "부모님",
  };
  const FEATURE_CATALOG = [
    ["Theme", ["mountain", "ocean", "activity", "culture_history", "theme_park", "cafe", "traditional_market", "festival"]],
    ["Environment", ["indoor_ratio", "weather_sensitivity"]],
    ["Atomic Style", ["restfulness", "physical_ease", "visit_duration_flexibility", "scenic_value", "distinctiveness", "local_embeddedness", "landmark_significance", "photo_value"]],
  ];
  const PRESETS = {
    scenic: [
      { feature: "ocean", mode: "benefit", weight: 4 },
      { feature: "scenic_value", mode: "benefit", weight: 2 },
      { feature: "photo_value", mode: "benefit", weight: 1 },
    ],
    easy: [
      { feature: "physical_ease", mode: "benefit", weight: 4 },
      { feature: "restfulness", mode: "benefit", weight: 2 },
      { feature: "activity", mode: "avoid", weight: 2 },
    ],
    local: [
      { feature: "local_embeddedness", mode: "benefit", weight: 4 },
      { feature: "distinctiveness", mode: "benefit", weight: 2 },
      { feature: "culture_history", mode: "benefit", weight: 1 },
    ],
    indoor: [
      { feature: "indoor_ratio", mode: "benefit", weight: 4 },
      { feature: "weather_sensitivity", mode: "avoid", weight: 2 },
      { feature: "physical_ease", mode: "benefit", weight: 1 },
    ],
  };
  const DEFAULT_PREFERENCES = [
    { feature: "ocean", mode: "benefit", weight: 4 },
    { feature: "physical_ease", mode: "benefit", weight: 2 },
    { feature: "local_embeddedness", mode: "benefit", weight: 2 },
    { feature: "photo_value", mode: "benefit", weight: 1 },
  ];

  const dom = Object.fromEntries([
    "mapLoading", "headerReadyCount", "sourceDate", "filterSummary", "placeSearch", "clearSearchButton",
    "resetFiltersButton", "categoryFilters", "resultCount", "resultList", "viewportCount", "mobileResultCount",
    "fitRecommendationButton", "fitFilteredButton", "fitJejuButton", "detailPanel", "detailCloseButton",
    "detailImage", "detailImagePlaceholder", "detailType", "detailModified", "detailRank", "detailTitle",
    "detailAddress", "detailPhone", "detailResearch", "detailScoreTrace", "detailLabels", "detailConstraintNote", "centerPlaceButton",
    "copyPlaceButton", "copyPlaceButtonLabel", "mobilePanelButton", "mobileOutputButton", "mobileResultsFab",
    "sidebarCloseButton", "outputCloseButton", "sidebarBackdrop", "outputBackdrop", "outputPanel",
    "recommendationForm", "destinationRegion", "tripIntent", "travelStartDate", "travelEndDate", "companionType",
    "preferenceRows", "addPreferenceButton", "resultLimit", "diversityPreset", "excludedPlaceIds", "formError",
    "runRecommendationButton", "resetRecommendationButton", "requestPreview", "configPreview", "algorithmBadge",
    "recommendationSummary", "candidateMetric", "scoredMetric", "poolMetric", "returnedMetric", "warningList",
    "recommendationCount", "recommendationResultList", "verificationPanel", "verificationCount", "verificationList",
    "outputPreview", "recommendationLegend", "outputScroll",
  ].map((id) => [id, document.getElementById(id)]));

  const numberFormatter = new Intl.NumberFormat("ko-KR");
  const metadata = window.JEJU_DATA_META || {};
  const algorithm = window.CCU_MMR;
  const rawPlaces = Array.isArray(window.JEJU_PLACES) ? window.JEJU_PLACES : [];

  function categoryFor(type) {
    return CATEGORY_CONFIG[type] || FALLBACK_CATEGORY;
  }

  function featureKey(label) {
    return String(label || "").split(".").at(-1);
  }

  function labelName(label) {
    const key = featureKey(label);
    if (/^\d{1,2}$/u.test(key)) return `${key}월`;
    return LABEL_NAMES[key] || key;
  }

  function atomicFeaturesFor(place) {
    const atomic = {};
    for (const record of place.v5?.labels || []) {
      if (["theme.", "environment.", "style_evidence."].some((prefix) => record.label.startsWith(prefix))) {
        if (Number.isFinite(record.value)) atomic[featureKey(record.label)] = Number(record.value);
      }
    }
    return atomic;
  }

  function contextScores(records) {
    return Object.fromEntries((records || []).map((record) => [record.key, record.state === "numeric" ? record.value : null]));
  }

  const places = rawPlaces.map((place) => {
    const atomicFeatures = atomicFeaturesFor(place);
    return {
      ...place,
      atomicFeatures,
      companionScores: contextScores(place.fit?.companion),
      monthScores: contextScores(place.fit?.month),
      recommendationReady: Boolean(place.v5 && place.fit && algorithm?.ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
      searchText: `${place.title || ""} ${place.address || ""}`.normalize("NFKC").toLocaleLowerCase("ko-KR"),
    };
  });
  const placeById = new Map(places.map((place) => [String(place.id), place]));
  const countsByType = places.reduce((counts, place) => counts.set(place.type, (counts.get(place.type) || 0) + 1), new Map());
  const availableTypes = Object.keys(CATEGORY_CONFIG).filter((type) => (countsByType.get(type) || 0) > 0);
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
    recommendationResult: null,
    recommendationById: new Map(),
    drawerReturnFocus: null,
  };

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function formatScore(value, digits = 3) {
    return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
  }

  function formatSourceDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value || "—");
  }

  function formatModifiedDate(value) {
    const digits = String(value || "").replace(/\D/gu, "");
    return digits.length >= 8 ? `업데이트 ${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : "수정일 정보 없음";
  }

  function researchSource(place, sourceId) {
    return (place.research?.sources || []).find((source) => source.id === sourceId) || null;
  }

  function publicResearch(place) {
    const research = place?.research;
    if (!research?.highlights?.length) return null;
    return {
      status: research.status,
      coverage: research.coverage,
      notice: "웹 조사 AI 초안이며 변동 정보는 방문 전 원문 확인이 필요합니다.",
      highlights: research.highlights.map((highlight) => {
        const source = researchSource(place, highlight.sourceId);
        return {
          text: highlight.text,
          publisher: source?.publisher || "출처 미기록",
          checkedAt: source?.checkedAt || null,
          url: source?.url || null,
          requiresRecheck: Boolean(highlight.dynamic),
        };
      }),
    };
  }

  function renderResearchDetail(place) {
    dom.detailResearch.replaceChildren();
    const research = place.research;
    if (!research?.highlights?.length) {
      dom.detailResearch.hidden = true;
      return;
    }
    dom.detailResearch.hidden = false;
    const metadataOnly = research.coverage === "metadata_only";
    const heading = document.createElement("div");
    heading.className = "research-heading";
    const title = document.createElement("strong");
    title.textContent = metadataOnly ? "기본 정보만 확인됨" : "어떤 곳인가요?";
    const badge = document.createElement("span");
    badge.className = "research-draft-badge";
    badge.textContent = metadataOnly ? "장소 메타데이터만 확인됨" : "웹 조사 AI 초안";
    badge.classList.toggle("is-metadata", metadataOnly);
    heading.append(title, badge);
    const facts = document.createElement("div");
    facts.className = "research-facts";
    for (const highlight of research.highlights) {
      const source = researchSource(place, highlight.sourceId);
      const fact = document.createElement("article");
      fact.className = "research-fact";
      const meta = document.createElement("div");
      meta.className = "research-source-meta";
      if (source?.url) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `출처: ${source.publisher}`;
        link.setAttribute("aria-label", `${place.title} – ${source.publisher} 출처 새 창`);
        meta.append(link);
      } else {
        const publisher = document.createElement("span");
        publisher.textContent = `출처: ${source?.publisher || "미기록"}`;
        meta.append(publisher);
      }
      const checked = document.createElement("span");
      checked.textContent = source?.checkedAt ? `확인 ${formatSourceDate(source.checkedAt)}` : "출처 확인일 미기록";
      meta.append(checked);
      const copy = document.createElement("p");
      copy.textContent = highlight.text;
      fact.append(meta, copy);
      facts.append(fact);
    }
    const notice = document.createElement("p");
    notice.className = "research-notice";
    notice.textContent = metadataOnly
      ? "웹 조사에서 활동 설명을 찾지 못해 분류·주소 등 기본 정보만 표시합니다. 실제 체험은 원문에서 확인하세요."
      : "출처 내용을 짧게 정리한 AI 초안입니다. 운영시간·가격·휴무·행사 일정은 방문 전에 원문에서 다시 확인하세요.";
    dom.detailResearch.append(heading, facts, notice);
  }

  function regionName(region) {
    return region === "jeju_city" ? "제주시" : region === "seogwipo_city" ? "서귀포시" : "권역 미상";
  }

  function debounce(callback, delay = 180) {
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
    window.setTimeout(() => { dom.mapLoading.hidden = true; }, 300);
  }

  function createFeatureSelect(selectedFeature) {
    const select = document.createElement("select");
    select.className = "preference-feature";
    select.setAttribute("aria-label", "원자 라벨");
    for (const [groupName, features] of FEATURE_CATALOG) {
      const group = document.createElement("optgroup");
      group.label = groupName;
      for (const feature of features) {
        const option = document.createElement("option");
        option.value = feature;
        option.textContent = LABEL_NAMES[feature] || feature;
        option.selected = feature === selectedFeature;
        group.append(option);
      }
      select.append(group);
    }
    return select;
  }

  function createSimpleSelect(className, ariaLabel, options, selectedValue) {
    const select = document.createElement("select");
    select.className = className;
    select.setAttribute("aria-label", ariaLabel);
    for (const [value, label] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = String(value) === String(selectedValue);
      select.append(option);
    }
    return select;
  }

  function addPreferenceRow(preference = { feature: "scenic_value", mode: "benefit", weight: 1 }) {
    if (dom.preferenceRows.children.length >= algorithm.ATOMIC_FEATURES.length) return;
    const row = document.createElement("div");
    row.className = "preference-row";
    const feature = createFeatureSelect(preference.feature);
    const mode = createSimpleSelect("preference-mode", "선호 방향", [
      ["benefit", "높을수록 선호"], ["avoid", "낮을수록 선호"], ["target", "목표값 선호"],
    ], preference.mode);
    const weight = createSimpleSelect("preference-weight", "중요도", [[1, "조금 · 1"], [2, "중요 · 2"], [4, "매우 · 4"]], preference.weight);
    const targetFields = document.createElement("div");
    targetFields.className = "target-fields";
    targetFields.dataset.targetFields = "true";
    const target = document.createElement("input");
    target.type = "number";
    target.className = "preference-target";
    target.min = "0";
    target.max = "1";
    target.step = "0.05";
    target.value = String(preference.target ?? 0.5);
    target.setAttribute("aria-label", "목표값");
    const tolerance = document.createElement("input");
    tolerance.type = "number";
    tolerance.className = "preference-tolerance";
    tolerance.min = "0.01";
    tolerance.max = "1";
    tolerance.step = "0.05";
    tolerance.value = String(preference.tolerance ?? 0.15);
    tolerance.setAttribute("aria-label", "허용 오차");
    targetFields.append(target, tolerance);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-preference-button";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", `${LABEL_NAMES[preference.feature] || preference.feature} 선호 삭제`);
    feature.addEventListener("change", () => {
      remove.setAttribute("aria-label", `${LABEL_NAMES[feature.value] || feature.value} 선호 삭제`);
    });
    const syncTarget = () => { targetFields.hidden = mode.value !== "target"; };
    mode.addEventListener("change", syncTarget);
    remove.addEventListener("click", () => {
      row.remove();
      clearRecommendation("선호 라벨이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    });
    syncTarget();
    row.append(feature, mode, weight, targetFields, remove);
    dom.preferenceRows.append(row);
  }

  function renderPreferenceRows(preferences) {
    dom.preferenceRows.replaceChildren();
    for (const preference of preferences) addPreferenceRow(preference);
  }

  function collectPreferences() {
    return [...dom.preferenceRows.querySelectorAll(".preference-row")].map((row) => {
      const mode = row.querySelector(".preference-mode").value;
      const preference = {
        feature: row.querySelector(".preference-feature").value,
        mode,
        weight: Number(row.querySelector(".preference-weight").value),
      };
      if (mode === "target") {
        preference.target = Number(row.querySelector(".preference-target").value);
        preference.tolerance = Number(row.querySelector(".preference-tolerance").value);
      }
      return preference;
    });
  }

  function collectRequest() {
    const hardConstraints = [...document.querySelectorAll('input[name="hardConstraint"]:checked')].map((input) => input.value);
    const excludedPlaceIds = dom.excludedPlaceIds.value.split(/[\s,]+/u).map((value) => value.trim()).filter(Boolean);
    const hasDates = dom.travelStartDate.value || dom.travelEndDate.value;
    return {
      requestId: "local-dashboard",
      destinationRegion: dom.destinationRegion.value,
      intent: dom.tripIntent.value,
      travelWindow: hasDates ? { startDate: dom.travelStartDate.value, endDate: dom.travelEndDate.value } : null,
      companionType: dom.companionType.value,
      preferences: collectPreferences(),
      hardConstraints,
      excludedPlaceIds,
      resultCount: Number(dom.resultLimit.value),
      diversity: dom.diversityPreset.value,
      candidateFilter: {
        query: state.query || null,
        contentTypeIds: [...state.selectedTypes].sort(),
      },
    };
  }

  function resetRecommendationForm() {
    dom.destinationRegion.value = "jeju_all";
    dom.tripIntent.value = "visit";
    dom.travelStartDate.value = "2026-08-20";
    dom.travelEndDate.value = "2026-08-22";
    dom.companionType.value = "parents";
    dom.resultLimit.value = "10";
    dom.diversityPreset.value = "balanced";
    dom.excludedPlaceIds.value = "";
    document.querySelectorAll('input[name="hardConstraint"]').forEach((input) => { input.checked = false; });
    renderPreferenceRows(DEFAULT_PREFERENCES);
    hideFormError();
  }

  function showFormError(message) {
    dom.formError.hidden = false;
    dom.formError.textContent = message;
  }

  function hideFormError() {
    dom.formError.hidden = true;
    dom.formError.textContent = "";
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
      button.setAttribute("aria-pressed", state.selectedTypes.has(button.dataset.type) ? "true" : "false");
    });
  }

  function toggleCategory(type) {
    if (state.selectedTypes.has(type)) state.selectedTypes.delete(type);
    else state.selectedTypes.add(type);
    updateCategoryFilterState();
    clearRecommendation("후보 유형이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    applyFilters();
  }

  function recommendationFor(place) {
    return state.recommendationById.get(String(place.id)) || null;
  }

  function createMarkerIcon(place, selected = false) {
    const recommendation = recommendationFor(place);
    const category = categoryFor(place.type);
    const markerClass = recommendation ? " is-recommended" : "";
    const content = recommendation ? String(recommendation.rank) : category.short;
    return window.L.divIcon({
      className: `place-marker-wrap${selected ? " is-selected" : ""}${markerClass}`,
      html: `<div class="place-marker" style="--marker-color:${recommendation ? "#ef8354" : category.color}"><span>${content}</span></div>`,
      iconSize: [32, 38], iconAnchor: [16, 37], tooltipAnchor: [0, -31],
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
        icon: createMarkerIcon(place), keyboard: true, riseOnHover: true, title: place.title,
      });
      const tooltip = document.createElement("span");
      tooltip.textContent = place.title;
      marker.bindTooltip(tooltip, { className: "place-tooltip", direction: "top", opacity: 1, offset: [0, -4] });
      marker.on("click", () => selectPlace(place, { moveMap: false }));
      state.markerById.set(place.id, marker);
    }
  }

  function mapPlaces() {
    if (state.recommendationResult?.items?.length) {
      return state.recommendationResult.items.map((item) => placeById.get(item.placeId)).filter(Boolean);
    }
    return state.filteredPlaces;
  }

  function refreshMapMarkers() {
    if (!state.clusterLayer) return;
    state.clusterLayer.clearLayers();
    const targetPlaces = mapPlaces();
    for (const place of places) {
      const marker = state.markerById.get(place.id);
      if (marker) marker.setIcon(createMarkerIcon(place, state.selectedPlace?.id === place.id));
    }
    state.clusterLayer.addLayers(targetPlaces.map((place) => state.markerById.get(place.id)).filter(Boolean));
    dom.recommendationLegend.hidden = !state.recommendationResult?.items?.length;
    dom.fitRecommendationButton.disabled = !state.recommendationResult?.items?.length;
    scheduleVisibleResultRender();
  }

  function initMap() {
    if (!window.L || typeof window.L.markerClusterGroup !== "function") throw new Error("지도 라이브러리를 불러오지 못했습니다.");
    if (!places.length) throw new Error("표시할 제주 장소 데이터가 없습니다.");
    state.map = window.L.map("map", { zoomControl: false, minZoom: 7, maxZoom: 19, maxBounds: JEJU_LIMITS, maxBoundsViscosity: 0.45, preferCanvas: true });
    window.L.control.zoom({ position: "topright" }).addTo(state.map);
    state.tileLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(state.map);
    state.clusterLayer = window.L.markerClusterGroup({
      chunkedLoading: true, chunkInterval: 80, chunkDelay: 30, disableClusteringAtZoom: 16,
      maxClusterRadius: 52, removeOutsideVisibleBounds: true, showCoverageOnHover: false,
      spiderfyOnMaxZoom: true, zoomToBoundsOnClick: true, iconCreateFunction: createClusterIcon,
    });
    state.map.addLayer(state.clusterLayer);
    createMarkers();
    state.initialBounds = window.L.latLngBounds(places.map((place) => [place.lat, place.lng]));
    state.map.on("moveend zoomend", scheduleVisibleResultRender);
    state.tileLayer.once("load", hideLoading);
    window.setTimeout(hideLoading, 2500);
    for (const selector of [".map-toolbar", ".viewport-status", ".map-legend", ".detail-card", ".mobile-results-fab"]) {
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
    return !state.query || place.searchText.includes(state.query);
  }

  function applyFilters({ fit = false } = {}) {
    state.filteredPlaces = places.filter(matchesCurrentFilters);
    if (!state.recommendationResult) refreshMapMarkers();
    const ready = state.filteredPlaces.filter((place) => place.recommendationReady).length;
    dom.fitFilteredButton.disabled = state.filteredPlaces.length === 0;
    dom.filterSummary.textContent = `전체 ${formatNumber(places.length)}개 중 ${formatNumber(state.filteredPlaces.length)}개 · 추천 점수 가능 ${formatNumber(ready)}개`;
    updateCategoryFilterState();
    scheduleVisibleResultRender();
    if (fit && state.filteredPlaces.length) fitFilteredPlaces();
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
    const visiblePlaces = state.filteredPlaces.filter((place) => bounds.contains([place.lat, place.lng])).sort((a, b) => {
      const aDistance = state.map.distance(center, [a.lat, a.lng]);
      const bDistance = state.map.distance(center, [b.lat, b.lng]);
      return aDistance - bDistance || a.sourceOrder - b.sourceOrder;
    });
    dom.viewportCount.textContent = formatNumber(visiblePlaces.length);
    dom.resultCount.textContent = formatNumber(visiblePlaces.length);
    if (!visiblePlaces.length) {
      renderEmptyState(dom.resultList, "현재 화면에 후보가 없습니다", "지도를 이동하거나 후보 필터를 바꿔보세요.");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const place of visiblePlaces.slice(0, LIST_LIMIT)) fragment.append(createPlaceListItem(place));
    dom.resultList.replaceChildren(fragment);
  }

  function renderEmptyState(container, title, description) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const copy = document.createElement("span");
    copy.textContent = description;
    empty.append(strong, copy);
    container.replaceChildren(empty);
  }

  function createPlaceListItem(place) {
    const category = categoryFor(place.type);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-item compact-place-item";
    button.dataset.placeId = place.id;
    button.style.setProperty("--item-color", category.color);
    button.setAttribute("aria-current", state.selectedPlace?.id === place.id ? "true" : "false");
    const icon = document.createElement("span");
    icon.className = "place-item-icon";
    icon.textContent = recommendationFor(place)?.rank || category.short;
    const copy = document.createElement("span");
    copy.className = "place-item-copy";
    const title = document.createElement("span");
    title.className = "place-item-title";
    title.textContent = place.title;
    const address = document.createElement("span");
    address.className = "place-item-address";
    address.textContent = `${regionName(place.region)} · ${place.recommendationReady ? "41축" : "추천 라벨 없음"}`;
    copy.append(title, address);
    button.append(icon, copy);
    button.addEventListener("click", () => selectPlace(place, { moveMap: true }));
    return button;
  }

  function requestUsedLabel(record) {
    const request = state.recommendationResult?.request;
    if (!request) return false;
    if (record.label.startsWith("companion.")) return featureKey(record.label) === request.companionType;
    if (record.label.startsWith("month.")) return Boolean(request.monthWeights?.daysByMonth?.[featureKey(record.label)]);
    return request.preferences.some((preference) => preference.feature === featureKey(record.label));
  }

  function allLabelRecords(place) {
    const contextRecords = [];
    for (const axis of place.fit?.companion || []) {
      contextRecords.push({
        label: `companion.${axis.key}`, value: axis.value, confidence: axis.confidence,
        status: axis.status, inferenceLevel: axis.inferenceLevel, state: axis.state, source_ids: [],
      });
    }
    for (const axis of place.fit?.month || []) {
      contextRecords.push({
        label: `month.${axis.key}`, value: axis.value, confidence: axis.confidence,
        status: axis.status, inferenceLevel: axis.inferenceLevel, state: axis.state, source_ids: [],
      });
    }
    return [...(place.v5?.labels || []), ...contextRecords];
  }

  function renderPlaceLabels(place) {
    const records = allLabelRecords(place);
    dom.detailLabels.replaceChildren();
    if (!records.length) {
      dom.detailLabels.hidden = true;
      return;
    }
    dom.detailLabels.hidden = false;
    const heading = document.createElement("div");
    heading.className = "v5-label-heading";
    const headingTitle = document.createElement("strong");
    headingTitle.textContent = `장소 라벨 ${records.length}개`;
    const headingCopy = document.createElement("span");
    headingCopy.textContent = "강조된 항목은 현재 추천 점수에 사용";
    heading.append(headingTitle, headingCopy);
    const grid = document.createElement("div");
    grid.className = "v5-label-grid label-grid-extended";
    const detail = document.createElement("div");
    detail.className = "v5-label-detail";
    const sourceMap = new Map((place.v5?.sources || []).map((source) => [source.id, source]));

    const showDetail = (record, group) => {
      detail.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = `${labelName(record.label)} · ${record.state === "not_applicable" ? "N/A" : formatScore(record.value, 2)}`;
      const status = document.createElement("span");
      status.className = "v5-label-status";
      status.textContent = record.status === "confirmed" ? "근거 확인" : record.status === "ai_draft" ? "AI 초안" : "검토 보류";
      const rationale = document.createElement("p");
      if (group.displayOnly) rationale.textContent = "파생 Style은 화면 요약용이며 CCU-MMR 점수와 유사도에는 다시 사용하지 않습니다.";
      else if (record.rationale || record.hold_reason) rationale.textContent = record.rationale || record.hold_reason;
      else if (record.state === "not_applicable") rationale.textContent = "개최일 확인이 필요한 축제로 월 적합도를 점수에 사용하지 않습니다.";
      else rationale.textContent = `근거 수준 ${record.inferenceLevel || "미기록"} · 신뢰도 ${formatScore(record.confidence, 2)}. 원시 값을 그대로 사용하는 CCU-MMR 실험입니다.`;
      if (requestUsedLabel(record)) rationale.textContent += " 현재 요청 점수에 사용된 라벨입니다.";
      detail.append(title, status, rationale);
      const linkedSources = (record.source_ids || []).map((id) => sourceMap.get(id)).filter((source) => source?.url);
      if (linkedSources.length) {
        const links = document.createElement("div");
        links.className = "v5-source-links";
        for (const source of linkedSources) {
          const link = document.createElement("a");
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = source.publisher || "웹 근거";
          links.append(link);
        }
        detail.append(links);
      }
    };

    for (const groupDefinition of LABEL_GROUPS) {
      const groupRecords = records.filter((record) => record.label.startsWith(groupDefinition.prefix));
      if (!groupRecords.length) continue;
      const group = document.createElement("div");
      group.className = `v5-label-group${groupDefinition.displayOnly ? " is-display-only" : ""}`;
      const title = document.createElement("span");
      title.textContent = `${groupDefinition.name} · ${groupRecords.length}`;
      group.append(title);
      for (const record of groupRecords) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `v5-label-chip${requestUsedLabel(record) ? " is-used" : ""}`;
        button.setAttribute("aria-pressed", "false");
        const name = document.createElement("span");
        name.textContent = labelName(record.label);
        const score = document.createElement("b");
        score.textContent = record.state === "not_applicable" ? "N/A" : formatScore(record.value, 2);
        button.append(name, score);
        button.addEventListener("click", () => {
          grid.querySelectorAll(".v5-label-chip").forEach((chip) => {
            chip.classList.remove("is-active");
            chip.setAttribute("aria-pressed", "false");
          });
          button.classList.add("is-active");
          button.setAttribute("aria-pressed", "true");
          showDetail(record, groupDefinition);
        });
        group.append(button);
      }
      grid.append(group);
    }
    dom.detailLabels.append(heading, grid, detail);
  }

  function scorePill(label, value, className = "") {
    const pill = document.createElement("div");
    pill.className = `score-pill ${className}`.trim();
    const name = document.createElement("span");
    name.textContent = label;
    const score = document.createElement("strong");
    score.textContent = formatScore(value);
    pill.append(name, score);
    return pill;
  }

  function renderScoreTrace(place, recommendation) {
    dom.detailScoreTrace.replaceChildren();
    dom.detailRank.hidden = !recommendation;
    if (!recommendation) {
      dom.detailScoreTrace.hidden = true;
      return;
    }
    dom.detailRank.hidden = false;
    dom.detailRank.textContent = `추천 ${recommendation.rank}위`;
    dom.detailScoreTrace.hidden = false;
    const heading = document.createElement("div");
    heading.className = "trace-heading";
    const title = document.createElement("strong");
    title.textContent = "CCU-MMR 점수 trace";
    const meta = document.createElement("span");
    meta.textContent = `coverage ${(recommendation.requestCoverage * 100).toFixed(0)}%`;
    heading.append(title, meta);
    const scores = document.createElement("div");
    scores.className = "trace-score-grid";
    scores.append(
      scorePill("관련도 R", recommendation.relevance, "is-primary"),
      scorePill("MMR", recommendation.mmrScore),
      scorePill("취향 P", recommendation.components.preference.value),
      scorePill("동행 A", recommendation.components.companion.value),
      scorePill("월 M", recommendation.components.month.value),
      scorePill("중복 유사도", recommendation.maxSimilarity),
    );
    const blockLine = document.createElement("p");
    const activeBlocks = ["preference", "companion", "month"].filter((key) => recommendation.components[key].active).map((key) => {
      const names = { preference: "P", companion: "A", month: "M" };
      return `${names[key]} ${(recommendation.components[key].effectiveWeight * 100).toFixed(1)}%`;
    });
    blockLine.textContent = `활성 블록: ${activeBlocks.join(" · ") || "없음(탐색 모드)"}`;
    const preferenceLine = document.createElement("div");
    preferenceLine.className = "trace-preference-list";
    for (const trace of recommendation.components.preference.traces || []) {
      const item = document.createElement("span");
      const mode = trace.mode === "avoid" ? "회피" : trace.mode === "target" ? "목표" : "선호";
      item.textContent = `${LABEL_NAMES[trace.feature] || trace.feature} ${mode}: x=${formatScore(trace.rawValue, 2)} → u=${formatScore(trace.utility, 2)} · w${trace.weight}`;
      preferenceLine.append(item);
    }
    dom.detailScoreTrace.append(heading, scores, blockLine, preferenceLine);
  }

  function renderConstraintNote(place) {
    dom.detailConstraintNote.replaceChildren();
    if (!place.constraints?.length) {
      dom.detailConstraintNote.hidden = true;
      return;
    }
    dom.detailConstraintNote.hidden = false;
    const title = document.createElement("strong");
    title.textContent = `변동·제약 정보 ${place.constraints.length}건 확인 필요`;
    const copy = document.createElement("p");
    copy.textContent = "자유 텍스트 정보라 추천 점수로 자동 통과·제외하지 않았습니다.";
    dom.detailConstraintNote.append(title, copy);
    for (const constraint of place.constraints.slice(0, 4)) {
      const row = document.createElement("div");
      row.className = "constraint-row";
      const kind = document.createElement("b");
      kind.textContent = constraint.kind || "확인 항목";
      const condition = document.createElement("span");
      condition.textContent = constraint.condition || constraint.appliesTo || "상세 확인 필요";
      row.append(kind, condition);
      if (/^https:\/\//u.test(constraint.sourceUrl || "")) {
        const link = document.createElement("a");
        link.href = constraint.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "출처";
        row.append(link);
      }
      dom.detailConstraintNote.append(row);
    }
  }

  function selectPlace(place, { moveMap = false } = {}) {
    const previous = state.selectedPlace;
    state.selectedPlace = place;
    if (previous && previous.id !== place.id) state.markerById.get(previous.id)?.setIcon(createMarkerIcon(previous, false));
    const marker = state.markerById.get(place.id);
    marker?.setIcon(createMarkerIcon(place, true));
    renderDetail(place);
    scheduleVisibleResultRender();
    if (moveMap && marker) {
      const fly = () => state.map.flyTo([place.lat, place.lng], Math.max(state.map.getZoom(), 14), { animate: true, duration: 0.5 });
      if (state.clusterLayer.hasLayer(marker)) state.clusterLayer.zoomToShowLayer(marker, fly);
      else fly();
    }
  }

  function renderDetail(place) {
    const category = categoryFor(place.type);
    const recommendation = recommendationFor(place);
    dom.detailPanel.hidden = false;
    dom.detailPanel.style.setProperty("--detail-color", category.color);
    document.body.classList.add("detail-open");
    dom.detailType.textContent = `${category.label} · ${regionName(place.region)}`;
    dom.detailModified.textContent = formatModifiedDate(place.modified);
    dom.detailTitle.textContent = place.title;
    dom.detailAddress.textContent = place.address || "주소 정보 없음";
    dom.detailPhone.textContent = place.phone || "";
    dom.detailPhone.hidden = !place.phone;
    renderResearchDetail(place);
    renderScoreTrace(place, recommendation);
    renderPlaceLabels(place);
    renderConstraintNote(place);
    dom.detailImage.onload = () => { dom.detailImage.hidden = false; dom.detailImagePlaceholder.hidden = true; };
    dom.detailImage.onerror = () => { dom.detailImage.hidden = true; dom.detailImagePlaceholder.hidden = false; dom.detailImage.removeAttribute("src"); };
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
    if (state.selectedPlace) state.markerById.get(state.selectedPlace.id)?.setIcon(createMarkerIcon(state.selectedPlace, false));
    state.selectedPlace = null;
    dom.detailPanel.hidden = true;
    document.body.classList.remove("detail-open");
    scheduleVisibleResultRender();
  }

  function createRecommendationCard(item) {
    const place = placeById.get(item.placeId);
    const category = categoryFor(place.type);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recommendation-card";
    button.dataset.placeId = item.placeId;
    button.setAttribute("aria-current", state.selectedPlace?.id === item.placeId ? "true" : "false");
    const top = document.createElement("div");
    top.className = "recommendation-card-top";
    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = String(item.rank);
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = place.title;
    const meta = document.createElement("span");
    meta.textContent = `${category.label} · ${regionName(place.region)} · ID ${place.id}`;
    copy.append(title, meta);
    const relevance = document.createElement("b");
    relevance.className = "recommendation-relevance";
    relevance.textContent = formatScore(item.relevance);
    top.append(rank, copy, relevance);
    const researchSnippet = document.createElement("div");
    researchSnippet.className = "recommendation-research-snippet";
    const metadataOnly = place.research?.coverage === "metadata_only";
    const researchHeading = document.createElement("div");
    researchHeading.className = "research-snippet-heading";
    const researchTitle = document.createElement("strong");
    researchTitle.textContent = metadataOnly ? "기본 정보만 확인됨" : "어떤 곳인가요?";
    const researchBadge = document.createElement("span");
    researchBadge.textContent = metadataOnly ? "장소 메타데이터만 확인됨" : "웹 조사 AI 초안";
    researchBadge.className = metadataOnly ? "is-metadata" : "";
    researchHeading.append(researchTitle, researchBadge);
    const firstHighlight = place.research?.highlights?.[0] || null;
    const firstSource = firstHighlight ? researchSource(place, firstHighlight.sourceId) : null;
    const researchCopy = document.createElement("p");
    researchCopy.textContent = firstHighlight?.text || "웹 활동 설명이 아직 없습니다.";
    const researchMeta = document.createElement("span");
    researchMeta.textContent = firstSource
      ? `연결 출처: ${firstSource.publisher}${firstSource.checkedAt ? ` · 확인 ${formatSourceDate(firstSource.checkedAt)}` : " · 확인일 미기록"}${firstHighlight?.dynamic ? " · 방문 전 원문 재확인" : ""}`
      : "TourAPI 장소 분류 참고";
    researchSnippet.append(researchHeading, researchMeta, researchCopy);
    const scoreRow = document.createElement("div");
    scoreRow.className = "recommendation-score-row";
    const scorePairs = [
      ["MMR", item.mmrScore], ["P", item.components.preference.value], ["A", item.components.companion.value], ["M", item.components.month.value],
    ];
    for (const [label, value] of scorePairs) {
      const score = document.createElement("span");
      score.textContent = `${label} ${formatScore(value)}`;
      scoreRow.append(score);
    }
    const reasons = document.createElement("div");
    reasons.className = "recommendation-reasons";
    const traces = [...(item.components.preference.traces || [])]
      .filter((trace) => Number.isFinite(trace.utility) && trace.utility >= 0.6)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);
    for (const trace of traces) {
      const chip = document.createElement("span");
      const prefix = trace.mode === "avoid" ? "낮은 " : trace.mode === "target" ? "목표 " : "높은 ";
      chip.textContent = `${prefix}${LABEL_NAMES[trace.feature] || trace.feature} · u ${formatScore(trace.utility, 2)}`;
      reasons.append(chip);
    }
    if (item.similarPlaceId) {
      const diversity = document.createElement("p");
      diversity.className = "diversity-note";
      diversity.textContent = `가장 유사: ${placeById.get(item.similarPlaceId)?.title || item.similarPlaceId} · sim ${formatScore(item.maxSimilarity)}`;
      button.append(top, researchSnippet, scoreRow, reasons, diversity);
    } else button.append(top, researchSnippet, scoreRow, reasons);
    button.addEventListener("click", () => {
      selectPlace(place, { moveMap: true });
      closeOutputPanel();
    });
    return button;
  }

  function renderWarnings(warnings) {
    dom.warningList.replaceChildren();
    dom.warningList.hidden = !warnings?.length;
    for (const warning of warnings || []) {
      const item = document.createElement("div");
      item.textContent = warning;
      dom.warningList.append(item);
    }
  }

  function renderVerificationCandidates(result) {
    const candidates = result.verificationCandidates || [];
    dom.verificationPanel.hidden = !candidates.length;
    dom.verificationCount.textContent = formatNumber(candidates.length);
    dom.verificationList.replaceChildren();
    for (const candidate of candidates.slice(0, 30)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${candidate.title} · ${candidate.reasons.join(", ")}`;
      button.addEventListener("click", () => {
        const place = placeById.get(candidate.placeId);
        if (place) selectPlace(place, { moveMap: true });
      });
      dom.verificationList.append(button);
    }
    if (candidates.length > 30) {
      const note = document.createElement("p");
      note.textContent = `화면에는 30개만 표시했습니다. 전체 ${formatNumber(candidates.length)}개는 출력 JSON에서 확인할 수 있습니다.`;
      dom.verificationList.append(note);
    }
  }

  function renderRecommendationOutput(result) {
    result.provenance = {
      sourceDate: metadata.sourceDate || null,
      labelSnapshotDate: metadata.labelSnapshotDate || null,
      preferenceLabelVersion: metadata.preferenceLabelVersion || null,
      fitLabelVersion: metadata.fitLabelVersion || null,
      hardConstraintVersion: metadata.hardConstraintVersion || null,
      recommendationReadyCount: metadata.recommendationReadyCount || null,
      candidateFilter: result.request.candidateFilter,
    };
    for (const item of result.items) {
      item.webResearch = publicResearch(placeById.get(item.placeId));
    }
    state.recommendationResult = result;
    state.recommendationById = new Map(result.items.map((item) => [item.placeId, item]));
    const summary = result.summary;
    dom.requestPreview.textContent = JSON.stringify(result.request, null, 2);
    dom.outputPreview.textContent = JSON.stringify(result, null, 2);
    dom.candidateMetric.textContent = formatNumber(summary.inputCandidates);
    dom.scoredMetric.textContent = formatNumber(summary.scoredCandidates);
    dom.poolMetric.textContent = formatNumber(summary.poolSize);
    dom.returnedMetric.textContent = formatNumber(summary.returned);
    dom.recommendationCount.textContent = formatNumber(summary.returned);
    dom.mobileResultCount.textContent = formatNumber(summary.returned);
    const mode = result.request.diversity === "balanced" ? "MMR 다양성 적용" : "관련도 순";
    dom.recommendationSummary.textContent = `${formatNumber(summary.scoredCandidates)}개 점수 계산 · ${mode} · ${formatNumber(summary.returned)}개 출력`;
    renderWarnings(result.warnings);
    renderVerificationCandidates(result);
    if (result.items.length) {
      const fragment = document.createDocumentFragment();
      for (const item of result.items) fragment.append(createRecommendationCard(item));
      dom.recommendationResultList.replaceChildren(fragment);
    } else {
      renderEmptyState(dom.recommendationResultList, "일반 추천 결과가 없습니다", result.verificationCandidates.length ? "미확인 조건 후보를 별도 목록과 JSON에서 확인하세요." : "지역·목적·후보 필터를 바꿔보세요.");
    }
    dom.outputScroll.scrollTop = 0;
    refreshMapMarkers();
    if (state.selectedPlace) renderDetail(state.selectedPlace);
  }

  function runRecommendation({ fit = true, openOutput = true } = {}) {
    hideFormError();
    try {
      if (!algorithm) throw new Error("CCU-MMR 알고리즘을 불러오지 못했습니다.");
      const result = algorithm.rank(state.filteredPlaces, collectRequest());
      renderRecommendationOutput(result);
      if (fit && result.items.length) fitRecommendationPlaces();
      if (openOutput && window.innerWidth <= 1240) openOutputPanel();
      return result;
    } catch (error) {
      showFormError(error instanceof Error ? error.message : "추천 입력을 확인해 주세요.");
      return null;
    }
  }

  function clearRecommendation(message = "추천 입력을 바꾼 뒤 다시 실행하세요.") {
    if (!state.recommendationResult) return;
    state.recommendationResult = null;
    state.recommendationById = new Map();
    dom.recommendationSummary.textContent = message;
    dom.recommendationCount.textContent = "0";
    dom.mobileResultCount.textContent = "0";
    dom.fitRecommendationButton.disabled = true;
    dom.recommendationLegend.hidden = true;
    renderEmptyState(dom.recommendationResultList, "결과를 다시 계산해야 합니다", message);
    refreshMapMarkers();
    if (state.selectedPlace) renderDetail(state.selectedPlace);
  }

  function fitBoundsForPlaces(targetPlaces, maxZoom = 12) {
    if (!targetPlaces.length) return;
    if (targetPlaces.length === 1) {
      state.map.flyTo([targetPlaces[0].lat, targetPlaces[0].lng], 14, { animate: true, duration: 0.55 });
      return;
    }
    state.map.fitBounds(window.L.latLngBounds(targetPlaces.map((place) => [place.lat, place.lng])), {
      animate: true, duration: 0.55, maxZoom, padding: [42, 42],
    });
  }

  function fitFilteredPlaces() { fitBoundsForPlaces(state.filteredPlaces, 12); }
  function fitRecommendationPlaces() { fitBoundsForPlaces(mapPlaces(), 13); }
  function fitJeju() {
    if (state.initialBounds) state.map.fitBounds(state.initialBounds, { animate: true, duration: 0.55, maxZoom: 10, padding: [36, 36] });
  }
  function centerSelectedPlace() {
    if (state.selectedPlace) state.map.flyTo([state.selectedPlace.lat, state.selectedPlace.lng], 15, { animate: true, duration: 0.5 });
  }

  async function copySelectedPlace() {
    if (!state.selectedPlace) return;
    const place = state.selectedPlace;
    const recommendation = recommendationFor(place);
    const text = [place.title, place.address, `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`, recommendation ? `CCU-MMR ${recommendation.rank}위 · R ${formatScore(recommendation.relevance)}` : ""].filter(Boolean).join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      dom.copyPlaceButtonLabel.textContent = "복사됨";
      window.setTimeout(() => { dom.copyPlaceButtonLabel.textContent = "위치 복사"; }, 1300);
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
    clearRecommendation("후보 필터를 초기화했습니다. 추천을 다시 실행해 주세요.");
    applyFilters();
    fitJeju();
  }

  function openSidebar() {
    state.drawerReturnFocus = document.activeElement;
    document.body.classList.remove("output-open");
    document.body.classList.add("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "true");
    dom.mobileOutputButton.setAttribute("aria-expanded", "false");
    dom.mobileResultsFab.setAttribute("aria-expanded", "false");
    window.requestAnimationFrame(() => document.getElementById("sidebar")?.focus({ preventScroll: true }));
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }
  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    dom.mobilePanelButton.setAttribute("aria-expanded", "false");
    if (state.drawerReturnFocus instanceof HTMLElement) state.drawerReturnFocus.focus({ preventScroll: true });
    state.drawerReturnFocus = null;
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }
  function openOutputPanel() {
    state.drawerReturnFocus = document.activeElement;
    document.body.classList.remove("sidebar-open");
    document.body.classList.add("output-open");
    dom.mobileOutputButton.setAttribute("aria-expanded", "true");
    dom.mobileResultsFab.setAttribute("aria-expanded", "true");
    dom.mobilePanelButton.setAttribute("aria-expanded", "false");
    window.requestAnimationFrame(() => dom.outputPanel.focus({ preventScroll: true }));
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }
  function closeOutputPanel() {
    document.body.classList.remove("output-open");
    dom.mobileOutputButton.setAttribute("aria-expanded", "false");
    dom.mobileResultsFab.setAttribute("aria-expanded", "false");
    if (state.drawerReturnFocus instanceof HTMLElement) state.drawerReturnFocus.focus({ preventScroll: true });
    state.drawerReturnFocus = null;
    window.setTimeout(() => state.map?.invalidateSize(), 230);
  }

  function bindEvents() {
    dom.recommendationForm.addEventListener("submit", (event) => { event.preventDefault(); runRecommendation(); });
    dom.addPreferenceButton.addEventListener("click", () => {
      addPreferenceRow();
      clearRecommendation("선호 라벨이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    });
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        renderPreferenceRows(PRESETS[button.dataset.preset]);
        clearRecommendation("선호 프리셋이 바뀌었습니다. 추천을 다시 실행해 주세요.");
      });
    });
    dom.resetRecommendationButton.addEventListener("click", () => { resetRecommendationForm(); runRecommendation(); });
    const markRequestDirty = (event) => {
      if (event.target.closest("#runRecommendationButton, #resetRecommendationButton")) return;
      clearRecommendation("입력값이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    };
    dom.recommendationForm.addEventListener("input", markRequestDirty);
    dom.recommendationForm.addEventListener("change", markRequestDirty);
    const handleSearch = debounce(() => {
      state.query = dom.placeSearch.value.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
      dom.clearSearchButton.hidden = !dom.placeSearch.value;
      clearRecommendation("후보 검색어가 바뀌었습니다. 추천을 다시 실행해 주세요.");
      applyFilters({ fit: Boolean(state.query) });
    });
    dom.placeSearch.addEventListener("input", handleSearch);
    dom.clearSearchButton.addEventListener("click", () => {
      dom.placeSearch.value = "";
      state.query = "";
      dom.clearSearchButton.hidden = true;
      clearRecommendation("후보 검색어를 지웠습니다. 추천을 다시 실행해 주세요.");
      applyFilters();
    });
    dom.resetFiltersButton.addEventListener("click", resetFilters);
    dom.fitRecommendationButton.addEventListener("click", fitRecommendationPlaces);
    dom.fitFilteredButton.addEventListener("click", fitFilteredPlaces);
    dom.fitJejuButton.addEventListener("click", fitJeju);
    dom.detailCloseButton.addEventListener("click", clearSelection);
    dom.centerPlaceButton.addEventListener("click", centerSelectedPlace);
    dom.copyPlaceButton.addEventListener("click", copySelectedPlace);
    dom.mobilePanelButton.addEventListener("click", openSidebar);
    dom.mobileOutputButton.addEventListener("click", openOutputPanel);
    dom.mobileResultsFab.addEventListener("click", openOutputPanel);
    dom.sidebarCloseButton.addEventListener("click", closeSidebar);
    dom.outputCloseButton.addEventListener("click", closeOutputPanel);
    dom.sidebarBackdrop.addEventListener("click", closeSidebar);
    dom.outputBackdrop.addEventListener("click", closeOutputPanel);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.body.classList.contains("sidebar-open")) closeSidebar();
      else if (document.body.classList.contains("output-open")) closeOutputPanel();
      else if (state.selectedPlace) clearSelection();
    });
    window.addEventListener("resize", debounce(() => {
      if (window.innerWidth > 1240) { closeSidebar(); closeOutputPanel(); }
      state.map?.invalidateSize();
      scheduleVisibleResultRender();
    }, 120));
  }

  function initialize() {
    try {
      if (!algorithm) throw new Error("CCU-MMR 알고리즘 파일을 불러오지 못했습니다.");
      dom.headerReadyCount.textContent = formatNumber(metadata.recommendationReadyCount || places.filter((place) => place.recommendationReady).length);
      dom.sourceDate.textContent = `수집일 ${formatSourceDate(metadata.sourceDate)}`;
      dom.algorithmBadge.textContent = algorithm.ALGORITHM_VERSION;
      dom.configPreview.textContent = JSON.stringify(algorithm.CONFIG, null, 2);
      renderPreferenceRows(DEFAULT_PREFERENCES);
      createCategoryFilters();
      bindEvents();
      initMap();
      runRecommendation({ fit: true, openOutput: false });
      window.CCU_MMR_DASHBOARD = {
        run: () => runRecommendation({ fit: false, openOutput: false }),
        getResult: () => state.recommendationResult,
        getSelectedPlace: () => state.selectedPlace,
      };
    } catch (error) {
      console.error(error);
      setLoadingError(error instanceof Error ? error.message : "지도를 준비하지 못했습니다.");
      dom.filterSummary.textContent = "데이터를 불러오지 못했습니다.";
      renderEmptyState(dom.resultList, "지도를 열 수 없습니다", "파일 구성을 확인한 뒤 새로고침해 주세요.");
    }
  }

  initialize();
})();
