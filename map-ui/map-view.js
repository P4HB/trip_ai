(function (root) {
  "use strict";
  const domain = root.TRAVEL_DOMAIN;
  root.TRAVEL_MAP_VIEW = { create({ availableTypes, categoryFor, clearSelection, countsByType, debounce, dom, events, formatNumber, hideLoading, placeById, places, recommendationFor, regionName, renderEmptyState, selectPlace, state }) {
  const LIST_LIMIT = 40;
  const JEJU_LIMITS = [[32.78, 125.72], [33.82, 127.22]];

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
    applyFilters();
  }

  function activeScheduleDay() {
    return state.hoveredScheduleDay ?? state.focusedScheduleDay;
  }

  function createMarkerIcon(place, selected = false) {
    const recommendation = recommendationFor(place);
    const scheduleAssignment = state.scheduleById.get(String(place.id));
    const highlightedDay = activeScheduleDay();
    const isDayHighlighted = highlightedDay !== null && scheduleAssignment?.dayIndex === highlightedDay;
    const category = categoryFor(place.type);
    const markerClass = recommendation || scheduleAssignment ? " is-recommended" : "";
    const content = scheduleAssignment ? `D${scheduleAssignment.dayIndex}` : recommendation ? String(recommendation.rank) : category.short;
    const markerColor = isDayHighlighted ? "#d84f75" : scheduleAssignment ? "#14877a" : recommendation ? "#ef8354" : category.color;
    return window.L.divIcon({
      className: `place-marker-wrap${selected ? " is-selected" : ""}${markerClass}${isDayHighlighted ? " is-day-highlighted" : ""}`,
      html: `<div class="place-marker" style="--marker-color:${markerColor}"><span>${content}</span></div>`,
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
    const highlightedDay = activeScheduleDay();
    if (highlightedDay !== null) {
      const day = state.recommendationResult?.schedule?.dayClusters?.find((item) => item.dayIndex === highlightedDay);
      return (day?.placeIds || []).map((placeId) => placeById.get(placeId)).filter(Boolean);
    }
    const scheduleIds = [...state.scheduleById.keys()];
    if (scheduleIds.length) return scheduleIds.map((placeId) => placeById.get(placeId)).filter(Boolean);
    if (state.recommendationResult?.items?.length) {
      return state.recommendationResult.items.map((item) => placeById.get(item.placeId)).filter(Boolean);
    }
    return state.filteredPlaces;
  }

  function refreshMapMarkers() {
    if (!state.clusterLayer) return;
    state.clusterLayer.clearLayers();
    const targetPlaces = mapPlaces();
    dom.map.dataset.highlightedScheduleDay = activeScheduleDay() ?? "";
    dom.map.dataset.visiblePlaceIds = targetPlaces.map((place) => String(place.id)).join(",");
    for (const place of places) {
      const marker = state.markerById.get(place.id);
      if (marker) marker.setIcon(createMarkerIcon(place, state.selectedPlace?.id === place.id));
    }
    state.clusterLayer.addLayers(targetPlaces.map((place) => state.markerById.get(place.id)).filter(Boolean));
    dom.recommendationLegend.hidden = !state.recommendationResult?.items?.length && !state.scheduleById.size;
    dom.fitRecommendationButton.disabled = !state.recommendationResult?.items?.length && !state.scheduleById.size;
    scheduleVisibleResultRender();
  }

  function refreshScheduleDayHighlight() {
    const highlightedDay = activeScheduleDay();
    document.querySelectorAll(".schedule-day-card").forEach((card) => {
      card.classList.toggle("is-map-highlighted", Number(card.dataset.dayIndex) === highlightedDay);
    });
    refreshMapMarkers();
  }

  function initMap() {
    if (!window.L || typeof window.L.markerClusterGroup !== "function") throw new Error("지도 라이브러리를 불러오지 못했습니다.");
    if (!places.length) throw new Error("표시할 제주 장소 데이터가 없습니다.");
    state.map = window.L.map("map", { zoomControl: false, minZoom: 7, maxZoom: 19, maxBounds: JEJU_LIMITS, maxBoundsViscosity: 0.45, preferCanvas: true });
    window.L.control.zoom({ position: "topright" }).addTo(state.map);
    state.tileLayer = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
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

  function showSelection({ previous, place, moveMap }) {
    if (!place) {
      if (previous) state.markerById.get(previous.id)?.setIcon(createMarkerIcon(previous, false));
      scheduleVisibleResultRender();
      return;
    }
    if (previous && previous.id !== place.id) state.markerById.get(previous.id)?.setIcon(createMarkerIcon(previous, false));
    const marker = state.markerById.get(place.id);
    marker?.setIcon(createMarkerIcon(place, true));
    scheduleVisibleResultRender();
    if (moveMap && marker) {
      const fly = () => state.map.flyTo([place.lat, place.lng], Math.max(state.map.getZoom(), 14), { animate: true, duration: 0.5 });
      if (state.clusterLayer.hasLayer(marker)) state.clusterLayer.zoomToShowLayer(marker, fly);
      else fly();
    }
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

  function resetFilters() {
    state.query = "";
    dom.placeSearch.value = "";
    dom.clearSearchButton.hidden = true;
    state.selectedTypes = new Set(availableTypes);
    clearSelection();
    applyFilters();
    fitJeju();
  }

  function bindEvents() {
    const handleSearch = debounce(() => {
      state.query = domain.normalizeSearchText(dom.placeSearch.value.trim());
      dom.clearSearchButton.hidden = !dom.placeSearch.value;
      applyFilters({ fit: Boolean(state.query) });
    });
    dom.placeSearch.addEventListener("input", handleSearch);
    dom.clearSearchButton.addEventListener("click", () => {
      dom.placeSearch.value = "";
      state.query = "";
      dom.clearSearchButton.hidden = true;
      applyFilters();
    });
    dom.resetFiltersButton.addEventListener("click", resetFilters);
    dom.fitRecommendationButton.addEventListener("click", fitRecommendationPlaces);
    dom.fitFilteredButton.addEventListener("click", fitFilteredPlaces);
    dom.fitJejuButton.addEventListener("click", fitJeju);
    events.on("selectionChanged", showSelection);
  }

    return { createCategoryFilters, updateCategoryFilterState, toggleCategory, activeScheduleDay, createMarkerIcon, createClusterIcon, createMarkers, mapPlaces, refreshMapMarkers, refreshScheduleDayHighlight, initMap, matchesCurrentFilters, applyFilters, scheduleVisibleResultRender, renderVisibleResults, createPlaceListItem, fitFilteredPlaces, fitRecommendationPlaces, fitJeju, resetFilters, bindEvents };
  } };
})(window);
