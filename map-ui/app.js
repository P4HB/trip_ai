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
    detailLabels: document.querySelector("#detailLabels"),
    centerPlaceButton: document.querySelector("#centerPlaceButton"),
    copyPlaceButton: document.querySelector("#copyPlaceButton"),
    copyPlaceButtonLabel: document.querySelector("#copyPlaceButtonLabel"),
    mobilePanelButton: document.querySelector("#mobilePanelButton"),
    mobileResultsFab: document.querySelector("#mobileResultsFab"),
    sidebarCloseButton: document.querySelector("#sidebarCloseButton"),
    sidebarBackdrop: document.querySelector("#sidebarBackdrop"),
  };

  const numberFormatter = new Intl.NumberFormat("ko-KR");
  const LABEL_GROUPS = [
    ["Theme", "theme."],
    ["Environment", "environment."],
    ["Style", "style_evidence."],
    ["Derived Style", "derived_style."],
  ];
  const LABEL_NAMES = {
    mountain: "산", ocean: "바다", activity: "활동", culture_history: "문화·역사",
    theme_park: "테마파크", cafe: "카페", traditional_market: "전통시장", festival: "축제",
    indoor_ratio: "실내 비율", weather_sensitivity: "날씨 민감", restfulness: "휴식성",
    physical_ease: "이동 편의", visit_duration_flexibility: "체류 유연성", scenic_value: "경관 가치",
    distinctiveness: "독특함", local_embeddedness: "제주 로컬성", landmark_significance: "랜드마크성",
    photo_value: "사진 가치", healing_slow: "힐링·느긋함", scenic_immersion: "경관 몰입",
    discovery_explorer: "발견·탐험", local_immersion: "로컬 몰입", iconic_highlight: "상징 하이라이트",
    photo_mood: "사진 무드",
  };
  const rawPlaces = Array.isArray(window.JEJU_PLACES) ? window.JEJU_PLACES : [];
  const metadata = window.JEJU_DATA_META || {};
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

  function labelName(label) {
    const key = String(label).split(".").at(-1);
    return LABEL_NAMES[key] || key;
  }

  function formatScore(value) {
    return Number.isFinite(value) ? String(value) : "—";
  }

  function renderV5Labels(place) {
    const review = place.v5;
    dom.detailLabels.replaceChildren();
    if (!review?.labels?.length) {
      dom.detailLabels.hidden = true;
      return;
    }
    dom.detailLabels.hidden = false;
    const heading = document.createElement("div");
    heading.className = "v5-label-heading";
    heading.innerHTML = "<strong>v5 근거 라벨</strong><span>24개 · 항목을 누르면 근거 표시</span>";
    const grid = document.createElement("div");
    grid.className = "v5-label-grid";
    const detail = document.createElement("div");
    detail.className = "v5-label-detail";
    const sourceMap = new Map((review.sources || []).map((source) => [source.id, source]));

    const showDetail = (record) => {
      detail.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = `${labelName(record.label)} · ${formatScore(record.value)}`;
      const status = document.createElement("span");
      status.className = "v5-label-status";
      status.textContent = record.status === "confirmed" ? "근거 확인" : "검토 보류";
      const rationale = document.createElement("p");
      rationale.textContent = record.rationale || record.hold_reason || "판단 사유가 기록되지 않았습니다.";
      detail.append(title, status, rationale);
      const linkedSources = record.source_ids.map((id) => sourceMap.get(id)).filter(Boolean);
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

    for (const [groupName, prefix] of LABEL_GROUPS) {
      const group = document.createElement("div");
      group.className = "v5-label-group";
      const title = document.createElement("span");
      title.textContent = groupName;
      group.append(title);
      for (const record of review.labels.filter((label) => label.label.startsWith(prefix))) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "v5-label-chip";
        button.innerHTML = `<span>${labelName(record.label)}</span><b>${formatScore(record.value)}</b>`;
        button.addEventListener("click", () => {
          grid.querySelectorAll(".v5-label-chip").forEach((chip) => chip.classList.remove("is-active"));
          button.classList.add("is-active");
          showDetail(record);
        });
        group.append(button);
      }
      grid.append(group);
    }
    dom.detailLabels.append(heading, grid, detail);
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
    renderV5Labels(place);

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
