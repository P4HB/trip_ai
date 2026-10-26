/* SPEC-113 REQ-006: presentation helpers shared by the map dashboard modules. */
(function (root) {
  "use strict";
  const domain = root.TRAVEL_DOMAIN;
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
  const numberFormatter = new Intl.NumberFormat("ko-KR");

  function categoryFor(type) {
    return CATEGORY_CONFIG[type] || FALLBACK_CATEGORY;
  }

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function formatScore(value, digits = 3) {
    return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
  }

  function formatSourceDate(value) {
    return domain.formatDotDate(value) ?? String(value || "—");
  }

  function formatModifiedDate(value) {
    const digits = String(value || "").replace(/\D/gu, "");
    return digits.length >= 8 ? `업데이트 ${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : "수정일 정보 없음";
  }

  function regionName(region) {
    return domain.REGIONS[region] || "권역 미상";
  }

  function debounce(callback, delay = 180) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
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

  root.TRAVEL_VIEW_HELPERS = Object.freeze({
    CATEGORY_CONFIG, categoryFor, formatNumber, formatScore, formatSourceDate, formatModifiedDate, regionName, debounce, renderEmptyState,
  });
})(window);
