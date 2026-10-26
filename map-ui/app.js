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
  const INTENT_CONTENT_TYPES = window.TRAVEL_DOMAIN.INTENT_TYPES;
  const LIST_LIMIT = 40;
  const JEJU_LIMITS = [[32.78, 125.72], [33.82, 127.22]];
  const LABEL_NAMES = {
    ...window.TRAVEL_DOMAIN.FEATURE_LABELS,
    healing_slow: "힐링·느긋함", scenic_immersion: "경관 몰입",
    discovery_explorer: "발견·탐험", local_immersion: "로컬 몰입", iconic_highlight: "상징 하이라이트",
    photo_mood: "사진 무드", solo: "혼자", couple: "연인·부부", friends: "친구",
    kids: "아이", parents: "부모님",
  };
  const WIZARD_STEPS = ["동행자", "날짜", "여행 방식", "여행 취향", "조건 확인"];
  const MOBILE_STACKED_MEDIA = "(max-width: 760px)";
  const FEEDBACK_OPTIONS = Object.freeze([
    { score: 1, label: "전혀 안 끌려요" },
    { score: 2, label: "별로예요" },
    { score: 3, label: "괜찮아요" },
    { score: 4, label: "마음에 들어요" },
    { score: 5, label: "꼭 가고 싶어요" },
  ]);
  const DISPLAY_VALUES = Object.freeze({
    companionType: {
      none: "동행자 미정", solo: "혼자", couple: "연인·부부", friends: "친구", kids: "아이와", parents: "부모님과",
    },
    destinationRegion: window.TRAVEL_DOMAIN.REGIONS,
    tripIntent: { visit: "볼거리·체험", shopping: "쇼핑", stay: "숙소", event: "축제·행사" },
    transportMode: { car: "차량 이용", no_car: "차량 없이" },
  });

  const dom = Object.fromEntries([
    "map", "mapLoading", "headerReadyCount", "sourceDate", "filterSummary", "placeSearch", "clearSearchButton",
    "resetFiltersButton", "categoryFilters", "resultCount", "resultList", "viewportCount", "mobileResultCount",
    "fitRecommendationButton", "fitFilteredButton", "fitJejuButton", "detailPanel", "detailCloseButton",
    "detailMedia", "detailImageBackdrop", "detailImageButton", "detailImage", "detailImagePlaceholder", "detailType", "detailModified", "detailPlaceId", "detailRank", "detailTitle",
    "detailAddress", "detailPhone", "detailMobileFeedback", "detailResearch", "detailReviews", "centerPlaceButton",
    "copyPlaceButton", "copyPlaceButtonLabel", "mobilePanelButton", "mobileOutputButton", "mobileResultsFab",
    "sidebarCollapseButton", "sidebarExpandButton", "sidebarCloseButton", "outputCloseButton", "sidebarBackdrop", "outputBackdrop", "outputPanel",
    "recommendationForm", "destinationRegion", "tripIntent", "travelStartDate", "travelEndDate", "tripDurationDays", "dateUndecided", "dateEventRequirement", "companionType", "transportMode",
    "resultLimit", "diversityPreset", "requiredPlaceSearch", "selectedRequiredPlaces",
    "requiredPlaceSearchResults", "requiredPlaceStatus", "excludedPlaceIds", "formError",
    "headerTravelMbtiButton", "preferenceStepTitle", "travelMbtiLaunch", "startTravelMbtiButton", "travelMbtiApplied", "travelMbtiAppliedType", "travelMbtiAppliedName", "travelMbtiAppliedSummary",
    "restartTravelMbtiButton", "travelMbtiDialog", "travelMbtiCloseButton", "travelMbtiProgressLabel", "travelMbtiProgressBar",
    "travelMbtiBody", "travelMbtiFooter", "travelMbtiBackButton", "travelMbtiSkipButton",
    "placeImageDialog", "placeImageDialogTitle", "placeImageDialogImage", "placeImageDialogCloseButton",
    "mobileRecommendationFeedbackDialog", "mobileRecommendationFeedbackContext", "mobileRecommendationFeedbackTitle", "mobileRecommendationFeedbackMeta",
    "mobileRecommendationFeedbackCloseButton", "mobileRecommendationFeedbackMedia", "mobileRecommendationFeedbackImage",
    "mobileRecommendationFeedbackImagePlaceholder", "mobileRecommendationFeedbackMount", "mobileRecommendationFeedbackResearch", "mobileRecommendationFeedbackReviews",
    "runRecommendationButton", "resetRecommendationButton", "requestPreview", "configPreview", "algorithmBadge",
    "wizardStepLabel", "wizardProgressPercent", "wizardProgressBar", "wizardBackButton", "wizardNextButton", "reviewSummary",
    "requiredOverview", "requiredProgressText", "requiredProgressTrack", "requiredProgressBar", "requiredMissingText",
    "recommendationSummary", "candidateMetric", "scoredMetric", "poolMetric", "returnedMetric", "warningList",
    "participantNamePanel", "participantName", "participantNameStatus",
    "recommendationCount", "recommendationResultList", "feedbackSavePanel", "feedbackCompletionStatus", "feedbackSaveHelp",
    "verificationPanel", "verificationCount", "verificationList",
    "scheduleSummary", "scheduleDayCount", "scheduleResultList", "anchorCandidatePanel", "anchorCandidateHelp", "anchorCandidateList",
    "itinerarySection", "itineraryGate", "itineraryForm", "itineraryDayInputs", "itineraryPublicPlaces", "itineraryLunchStart", "itineraryLunchEnd", "itineraryLunchDuration",
    "itineraryDinnerStart", "itineraryDinnerEnd", "itineraryDinnerDuration", "itineraryMaxDetour", "generateItineraryButton", "itineraryStatus", "itineraryResults",
    "courseVariantBar", "courseVariantLabel", "courseOverlapSummary", "rerollRecommendationButton",
    "outputPreview", "recommendationLegend", "outputScroll",
  ].map((id) => [id, document.getElementById(id)]));

  const numberFormatter = new Intl.NumberFormat("ko-KR");
  const metadata = window.JEJU_DATA_META || {};
  const algorithm = window.CCU_MMR;
  const preferenceEngine = window.TRAVEL_PREFERENCE;
  const rawPlaces = Array.isArray(window.JEJU_PLACES) ? window.JEJU_PLACES : [];

  function categoryFor(type) {
    return CATEGORY_CONFIG[type] || FALLBACK_CATEGORY;
  }

  function featureKey(label) {
    return String(label || "").split(".").at(-1);
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
  const { state } = window.TRAVEL_STATE.create({ places, availableTypes });

  const { itineraryClient, itineraryPlaceLabel, invalidateItinerary, renderItineraryInputs, collectItineraryOptions, generateItinerary, itineraryTime, itineraryStatusLabel, appendItineraryNotes, itineraryDate, restaurantWarnings, selectMealRestaurant, clearMealRestaurant, rerenderItinerary, renderRestaurantCandidate, renderRestaurantCandidates, renderMealEntry, renderItineraryState } = window.TRAVEL_ITINERARY_VIEW.create({ state, dom, places, placeById, metadata });

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

  const { researchSource, publicResearch, renderResearchDetail, reviewHeading, renderReviewStatus, renderReviewResponse, reviewRequestIsCurrent, loadPlaceReviews } = window.TRAVEL_PLACE_DETAIL.create({
    dom,
    formatNumber: (...args) => formatNumber(...args),
    formatSourceDate: (...args) => formatSourceDate(...args),
    metadata,
    places,
    state
  });

  function regionName(region) {
    return window.TRAVEL_DOMAIN.REGIONS[region] || "권역 미상";
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

  const { collectPreferences, requiredPlaceEligible, requiredPlaceMatches, requiredPlaceMatchRank, renderSelectedRequiredPlaces, renderRequiredPlaceSearchResults, renderRequiredPlacePicker, collectRequest, syncChoiceCards, formatWizardDate, selectedTripDays, formatTripDuration, preferenceSummary, requiredInputStates, renderReviewSummary, updateRequiredInputState, focusWizardChoice, isMobileStackedFlow, validateWizardStep, validateWizardFlow, validateMobileWizardFlow, showWizardStep, resetRecommendationForm, showFormError, hideFormError } = window.TRAVEL_WIZARD.create({
    DISPLAY_VALUES,
    INTENT_CONTENT_TYPES,
    MOBILE_STACKED_MEDIA,
    WIZARD_STEPS,
    algorithm,
    availableTypes,
    categoryFor: (...args) => categoryFor(...args),
    clearRecommendation: (...args) => clearRecommendation(...args),
    clearTravelMbtiProfile: (...args) => clearTravelMbtiProfile(...args),
    dom,
    formatNumber: (...args) => formatNumber(...args),
    placeById,
    places,
    preferenceEngine,
    regionName: (...args) => regionName(...args),
    state
  });

  function closeTravelMbtiDialog() {
    if (dom.travelMbtiDialog.open && typeof dom.travelMbtiDialog.close === "function") dom.travelMbtiDialog.close();
    else dom.travelMbtiDialog.removeAttribute("open");
  }

  function placeImageDialogOpen() {
    return Boolean(dom.placeImageDialog.open || dom.placeImageDialog.hasAttribute("open"));
  }

  function closePlaceImageDialog({ restoreFocus = true } = {}) {
    if (!placeImageDialogOpen()) return;
    if (typeof dom.placeImageDialog.close === "function") dom.placeImageDialog.close();
    else dom.placeImageDialog.removeAttribute("open");
    if (restoreFocus && !dom.detailPanel.hidden && !dom.detailImageButton.hidden) {
      window.requestAnimationFrame(() => dom.detailImageButton.focus({ preventScroll: true }));
    }
  }

  function openPlaceImageDialog() {
    if (dom.detailImageButton.hidden || !dom.detailImage.currentSrc) return;
    const title = state.selectedPlace?.title || "장소";
    dom.placeImageDialogTitle.textContent = `${title} 사진`;
    dom.placeImageDialogImage.alt = `${title} 크게 본 사진`;
    dom.placeImageDialogImage.src = dom.detailImage.currentSrc;
    if (typeof dom.placeImageDialog.showModal === "function") dom.placeImageDialog.showModal();
    else dom.placeImageDialog.setAttribute("open", "");
    window.requestAnimationFrame(() => dom.placeImageDialogCloseButton.focus({ preventScroll: true }));
  }

  const { setTravelMbtiProgress, resetTravelMbtiWizard, startTravelMbti, answerForQuestion, createTravelMbtiBothChoices, renderTravelMbtiQuestion, recordTravelMbtiQuestion, renderNextTravelMbtiPair, recordTravelMbtiPair, featureChip, renderTravelMbtiResult, renderAppliedTravelMbti, applyTravelMbtiProfile, clearTravelMbtiProfile, travelMbtiBack } = window.TRAVEL_PREFERENCE_VIEW.create({
    clearRecommendation: (...args) => clearRecommendation(...args),
    closeTravelMbtiDialog: (...args) => closeTravelMbtiDialog(...args),
    dom,
    hideFormError: (...args) => hideFormError(...args),
    preferenceEngine,
    runRecommendation: (...args) => runRecommendation(...args),
    showFormError: (...args) => showFormError(...args),
    state
  });

  const { createCategoryFilters, updateCategoryFilterState, toggleCategory, recommendationFor, activeScheduleDay, createMarkerIcon, createClusterIcon, createMarkers, mapPlaces, refreshMapMarkers, refreshScheduleDayHighlight, initMap, matchesCurrentFilters, applyFilters, scheduleVisibleResultRender, renderVisibleResults } = window.TRAVEL_MAP_VIEW.create({
    JEJU_LIMITS,
    LIST_LIMIT,
    availableTypes,
    categoryFor: (...args) => categoryFor(...args),
    countsByType,
    createPlaceListItem: (...args) => createPlaceListItem(...args),
    dom,
    fitFilteredPlaces: (...args) => fitFilteredPlaces(...args),
    fitJeju: (...args) => fitJeju(...args),
    formatNumber: (...args) => formatNumber(...args),
    hideLoading: (...args) => hideLoading(...args),
    placeById,
    places,
    renderEmptyState: (...args) => renderEmptyState(...args),
    selectPlace: (...args) => selectPlace(...args),
    state
  });

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

  function renderMobileDetailFeedback(place, recommendation) {
    const panel = dom.detailMobileFeedback;
    panel.replaceChildren();
    panel.hidden = false;
    panel.classList.toggle("is-unavailable", !recommendation);

    const heading = document.createElement("div");
    heading.className = "detail-mobile-feedback-heading";
    const title = document.createElement("strong");
    title.textContent = recommendation ? "이 장소 평가하기" : "장소 평가";
    heading.append(title);

    const help = document.createElement("p");
    if (recommendation) {
      const rank = document.createElement("span");
      rank.textContent = `추천 ${recommendation.rank}위`;
      heading.append(rank);
      help.textContent = "추천 카드와 일정의 평가가 함께 바뀌며 이름·별칭과 함께 자동 저장됩니다.";
      panel.append(heading, help, createRecommendationFeedback(place, "mobile-detail"));
      return;
    }

    help.textContent = state.recommendationResult
      ? "이번 추천 결과에 포함된 장소만 점수와 의견을 남길 수 있어요."
      : "여행 추천을 완료하면 추천 장소에 점수와 의견을 남길 수 있어요.";
    panel.append(heading, help);
  }

  function renderDetail(place) {
    const category = categoryFor(place.type);
    const recommendation = recommendationFor(place);
    dom.detailPanel.hidden = false;
    dom.detailPanel.style.setProperty("--detail-color", category.color);
    document.body.classList.add("detail-open");
    dom.detailType.textContent = `${category.label} · ${regionName(place.region)}`;
    dom.detailModified.textContent = formatModifiedDate(place.modified);
    dom.detailPlaceId.textContent = `ID ${place.id}`;
    dom.detailRank.hidden = !recommendation;
    if (recommendation) dom.detailRank.textContent = `추천 ${recommendation.rank}위`;
    dom.detailTitle.textContent = place.title;
    dom.detailAddress.textContent = place.address || "주소 정보 없음";
    dom.detailPhone.textContent = place.phone || "";
    dom.detailPhone.hidden = !place.phone;
    renderMobileDetailFeedback(place, recommendation);
    renderResearchDetail(place);
    loadPlaceReviews(place);
    closePlaceImageDialog({ restoreFocus: false });
    const loadToken = ++state.detailImageLoadToken;
    const imageUrl = String(place.image || "").trim();
    dom.detailMedia.classList.remove("is-low-resolution");
    dom.detailImageButton.hidden = true;
    dom.detailImageBackdrop.hidden = true;
    dom.detailImagePlaceholder.hidden = false;
    dom.detailImage.removeAttribute("src");
    dom.detailImageBackdrop.removeAttribute("src");
    dom.detailImage.alt = "";
    dom.detailImageButton.removeAttribute("aria-label");
    if (!imageUrl) return;
    const imageStillCurrent = () => state.detailImageLoadToken === loadToken && state.selectedPlace?.id === place.id;
    const imageLoader = new Image();
    imageLoader.onload = () => {
      if (!imageStillCurrent()) return;
      const scale = Math.min(
        dom.detailMedia.clientWidth / Math.max(1, imageLoader.naturalWidth),
        dom.detailMedia.clientHeight / Math.max(1, imageLoader.naturalHeight),
      );
      dom.detailMedia.classList.toggle("is-low-resolution", scale > 1.35);
      dom.detailImage.src = imageUrl;
      dom.detailImageBackdrop.src = imageUrl;
      dom.detailImageButton.hidden = false;
      dom.detailImageBackdrop.hidden = false;
      dom.detailImagePlaceholder.hidden = true;
    };
    imageLoader.onerror = () => {
      if (!imageStillCurrent()) return;
      dom.detailImageButton.hidden = true;
      dom.detailImageBackdrop.hidden = true;
      dom.detailImagePlaceholder.hidden = false;
    };
    dom.detailImage.alt = `${place.title} 사진`;
    dom.detailImageButton.setAttribute("aria-label", `${place.title} 사진 크게 보기`);
    imageLoader.src = imageUrl;
  }

  function clearSelection() {
    closePlaceImageDialog({ restoreFocus: false });
    state.detailImageLoadToken += 1;
    state.reviewRequests.get(dom.detailReviews)?.controller?.abort();
    state.reviewRequests.delete(dom.detailReviews);
    if (state.selectedPlace) state.markerById.get(state.selectedPlace.id)?.setIcon(createMarkerIcon(state.selectedPlace, false));
    state.selectedPlace = null;
    dom.detailPanel.hidden = true;
    dom.detailReviews.replaceChildren();
    dom.detailReviews.hidden = true;
    document.body.classList.remove("detail-open");
    scheduleVisibleResultRender();
  }

  const { hasFeedbackScore, updateFeedbackBadge, createFeedbackBadge, completeRecommendationFeedback, syncRecommendationFeedback, recommendationFeedbackTargets, recommendationFeedbackCompletion, participantNameValue, feedbackHasUserInput, updateParticipantNameState, resetFeedbackAutoSave, updateFeedbackSaveState, cloneForFeedbackLog, buildFeedbackLog, scheduleFeedbackAutoSave, queueFeedbackAutoSaveRetry, flushFeedbackAutoSave, createRecommendationFeedback } = window.TRAVEL_FEEDBACK.create({ state, dom, placeById, algorithm, FEEDBACK_OPTIONS, closeMobileRecommendationFeedbackDialog, clearSelection, openOutputPanel });

  function renderMobileRecommendationFeedbackImage(place) {
    const image = dom.mobileRecommendationFeedbackImage;
    const placeholder = dom.mobileRecommendationFeedbackImagePlaceholder;
    const imageUrl = String(place.image || "").trim();
    image.onload = null;
    image.onerror = null;
    image.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    placeholder.hidden = false;
    if (!imageUrl) return;
    const imageStillCurrent = () => dom.mobileRecommendationFeedbackDialog.dataset.placeId === String(place.id);
    image.onload = () => {
      if (!imageStillCurrent()) return;
      image.hidden = false;
      placeholder.hidden = true;
    };
    image.onerror = () => {
      if (!imageStillCurrent()) return;
      image.hidden = true;
      placeholder.hidden = false;
    };
    image.alt = `${place.title} 사진`;
    image.src = imageUrl;
  }

  function closeMobileRecommendationFeedbackDialog({ restoreFocus = true } = {}) {
    const dialog = dom.mobileRecommendationFeedbackDialog;
    const returnFocus = restoreFocus ? state.mobileFeedbackReturnFocus : null;
    state.mobileFeedbackReturnFocus = null;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    state.reviewRequests.get(dom.mobileRecommendationFeedbackReviews)?.controller?.abort();
    state.reviewRequests.delete(dom.mobileRecommendationFeedbackReviews);
    document.body.classList.remove("mobile-feedback-open");
    delete dialog.dataset.placeId;
    dom.mobileRecommendationFeedbackImage.onload = null;
    dom.mobileRecommendationFeedbackImage.onerror = null;
    dom.mobileRecommendationFeedbackImage.removeAttribute("src");
    dom.mobileRecommendationFeedbackImage.hidden = true;
    dom.mobileRecommendationFeedbackImagePlaceholder.hidden = false;
    dom.mobileRecommendationFeedbackMount.replaceChildren();
    dom.mobileRecommendationFeedbackResearch.replaceChildren();
    dom.mobileRecommendationFeedbackResearch.hidden = true;
    dom.mobileRecommendationFeedbackReviews.replaceChildren();
    dom.mobileRecommendationFeedbackReviews.hidden = true;
    if (returnFocus instanceof HTMLElement) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function openMobileRecommendationFeedbackDialog(place, contextLabel, returnFocus = document.activeElement) {
    if (!isMobileStackedFlow()) return false;
    if (dom.mobileRecommendationFeedbackDialog.open) {
      closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
    }
    const recommendation = recommendationFor(place);
    state.mobileFeedbackReturnFocus = returnFocus instanceof HTMLElement ? returnFocus : null;
    dom.mobileRecommendationFeedbackDialog.dataset.placeId = String(place.id);
    dom.mobileRecommendationFeedbackContext.textContent = contextLabel || (recommendation ? `추천 ${recommendation.rank}위` : "추천 장소 평가");
    dom.mobileRecommendationFeedbackTitle.textContent = place.title;
    dom.mobileRecommendationFeedbackMeta.textContent = `${categoryFor(place.type).label} · ${regionName(place.region)}`;
    renderMobileRecommendationFeedbackImage(place);
    dom.mobileRecommendationFeedbackMount.replaceChildren(createRecommendationFeedback(place, "mobile-dialog"));
    renderResearchDetail(place, dom.mobileRecommendationFeedbackResearch);
    document.body.classList.add("mobile-feedback-open");
    if (typeof dom.mobileRecommendationFeedbackDialog.showModal === "function") {
      dom.mobileRecommendationFeedbackDialog.showModal();
    } else {
      dom.mobileRecommendationFeedbackDialog.setAttribute("open", "");
    }
    loadPlaceReviews(place, dom.mobileRecommendationFeedbackReviews);
    window.requestAnimationFrame(() => {
      dom.mobileRecommendationFeedbackMount.querySelector(".recommendation-feedback-option")?.focus({ preventScroll: true });
    });
    return true;
  }

  function openRecommendationPlace(place, contextLabel, returnFocus) {
    if (openMobileRecommendationFeedbackDialog(place, contextLabel, returnFocus)) return;
    selectPlace(place, { moveMap: true });
    closeOutputPanel();
  }

  function createRecommendationCard(item) {
    const place = placeById.get(item.placeId);
    const category = categoryFor(place.type);
    const card = document.createElement("article");
    card.className = "recommendation-card";
    card.dataset.placeId = item.placeId;
    card.setAttribute("aria-current", state.selectedPlace?.id === item.placeId ? "true" : "false");
    const top = document.createElement("button");
    top.type = "button";
    top.className = "recommendation-card-top";
    const rank = document.createElement("span");
    rank.className = "recommendation-rank";
    rank.textContent = String(item.rank);
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.id = `recommendation-title-${item.placeId}`;
    title.textContent = place.title;
    const meta = document.createElement("span");
    meta.textContent = `${category.label} · ${regionName(place.region)}`;
    copy.append(title, meta);
    top.append(rank, copy);
    top.setAttribute("aria-label", `${place.title} 추천 평가 열기`);
    top.addEventListener("click", () => openRecommendationPlace(place, `추천 ${item.rank}위`, top));
    card.setAttribute("aria-labelledby", title.id);
    const researchSnippet = document.createElement("div");
    researchSnippet.className = "recommendation-research-snippet";
    const researchHeading = document.createElement("div");
    researchHeading.className = "research-snippet-heading";
    const researchTitle = document.createElement("strong");
    researchTitle.textContent = "어떤 곳인가요?";
    researchHeading.append(researchTitle);
    const firstHighlight = place.research?.highlights?.[0] || null;
    const researchCopy = document.createElement("p");
    researchCopy.textContent = firstHighlight?.text || "장소 설명을 준비하고 있어요.";
    researchSnippet.append(researchHeading, researchCopy);
    const traces = [...(item.components.preference.traces || [])]
      .filter((trace) => Number.isFinite(trace.utility) && trace.utility >= 0.6)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);
    const reasons = document.createElement("div");
    reasons.className = "recommendation-reasons";
    if (traces.length) {
      const reasonLabel = document.createElement("strong");
      reasonLabel.textContent = "내 취향과 맞는 점";
      const reasonChips = document.createElement("div");
      for (const trace of traces) {
        const chip = document.createElement("span");
        const feature = LABEL_NAMES[trace.feature] || trace.feature;
        chip.textContent = trace.mode === "avoid"
          ? `${feature} 부담 적음`
          : trace.mode === "target"
            ? `${feature} 취향에 가까움`
            : feature;
        reasonChips.append(chip);
      }
      reasons.append(reasonLabel, reasonChips);
    }
    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "recommendation-detail-button";
    detailButton.innerHTML = '<span class="recommendation-detail-desktop-label">상세보기</span><span class="recommendation-detail-mobile-label">이 장소 평가하기</span>';
    detailButton.setAttribute("aria-label", `${place.title} 열기`);
    detailButton.addEventListener("click", () => {
      openRecommendationPlace(place, `추천 ${item.rank}위`, detailButton);
    });

    const feedback = createRecommendationFeedback(place, "recommendation");
    card.append(top, createFeedbackBadge(place.id), researchSnippet);
    if (traces.length) card.append(reasons);
    card.append(detailButton, feedback);
    return card;
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

  function scheduleStatusLabel(status) {
    return {
      feasible: "일정 군집 완료",
      needs_anchor_selection: "추가 중심 선택 필요",
      infeasible: "현재 조건으로 배치 불가",
      not_requested: "여행일 미입력",
    }[status] || status;
  }

  function scheduleCenterLabel(centerType) {
    return {
      required_centroid: "필수 장소 중심",
      user_anchor: "사용자 선택 중심",
      variant_anchor: "선택 코스 자동 중심",
      fallback_anchor: "관련도 보완 중심",
    }[centerType] || "일정 중심";
  }

  function createSchedulePlaceCard(item, dayIndex) {
    const card = document.createElement("article");
    card.className = "schedule-place-card";
    card.dataset.placeId = item.placeId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `schedule-place is-${item.role}`;
    const role = item.role === "required" ? "필수" : item.role === "anchor" ? "중심" : "추천";
    button.innerHTML = `<span>${role}</span><strong></strong><small>${formatScore(item.distanceKm, 1)}km</small>`;
    button.querySelector("strong").textContent = item.title;
    button.setAttribute("aria-label", `${dayIndex}일차 ${role} 장소 ${item.title}`);
    button.addEventListener("click", () => {
      const place = placeById.get(item.placeId);
      if (place) {
        openRecommendationPlace(place, `${dayIndex}일차 · ${role}`, button);
      }
    });
    card.append(button);
    const place = placeById.get(item.placeId);
    if (place) card.append(createFeedbackBadge(place.id), createRecommendationFeedback(place, `schedule-${dayIndex}`));
    return card;
  }

  function renderSchedule(schedule) {
    dom.scheduleDayCount.textContent = formatNumber(schedule.dayClusters.length);
    dom.scheduleSummary.textContent = `${scheduleStatusLabel(schedule.status)} · ${schedule.radiusKm}km · 하루 최대 ${schedule.dailyCapacity}곳 · 유형별 하루 1곳 · 장소별 만족도 입력 가능`;
    if (schedule.dayClusters.length) {
      const fragment = document.createDocumentFragment();
      for (const day of schedule.dayClusters) {
        const card = document.createElement("article");
        card.className = "schedule-day-card";
        card.dataset.dayIndex = String(day.dayIndex);
        card.tabIndex = 0;
        card.setAttribute("aria-label", `${day.dayIndex}일차 일정 · 지도에서 이 일차 장소 강조`);
        card.addEventListener("mouseenter", () => {
          state.hoveredScheduleDay = day.dayIndex;
          refreshScheduleDayHighlight();
        });
        card.addEventListener("mouseleave", () => {
          state.hoveredScheduleDay = null;
          refreshScheduleDayHighlight();
        });
        card.addEventListener("focusin", () => {
          state.focusedScheduleDay = day.dayIndex;
          refreshScheduleDayHighlight();
        });
        card.addEventListener("focusout", (event) => {
          if (card.contains(event.relatedTarget)) return;
          state.focusedScheduleDay = null;
          refreshScheduleDayHighlight();
        });
        const heading = document.createElement("div");
        heading.className = "schedule-day-heading";
        const title = document.createElement("div");
        const dateText = day.date ? ` · ${day.date}` : "";
        title.innerHTML = `<strong>${day.dayIndex}일차${dateText}</strong><span>${scheduleCenterLabel(day.centerType)}</span>`;
        const usage = document.createElement("b");
        usage.textContent = `${day.usedCapacity}/${schedule.dailyCapacity}`;
        heading.append(title, usage);
        const meta = document.createElement("p");
        meta.textContent = `최대 중심거리 ${formatScore(day.maxCenterDistanceKm, 1)}km · 중심 ${formatScore(day.center.lat, 4)}, ${formatScore(day.center.lng, 4)}`;
        const placesList = document.createElement("div");
        placesList.className = "schedule-place-list";
        for (const item of day.places) placesList.append(createSchedulePlaceCard(item, day.dayIndex));
        card.append(heading, meta, placesList);
        if (schedule.status !== "infeasible" && day.remainingCapacity > 0) {
          const note = document.createElement("p");
          note.textContent = "유형별 하루 1곳과 거리 조건에 맞는 후보만 배치했습니다.";
          card.append(note);
        }
        if (day.anchorPlaceId && day.centerType === "user_anchor") {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "remove-anchor-button";
          remove.textContent = "이 중심 선택 취소";
          remove.addEventListener("click", () => {
            state.selectedAnchorIds.delete(day.anchorPlaceId);
            runRecommendation({
              fit: true,
              openOutput: false,
              variantId: state.variantSession.currentVariantId,
              preserveSession: true,
            });
          });
          card.append(remove);
        }
        fragment.append(card);
      }
      dom.scheduleResultList.replaceChildren(fragment);
    } else {
      const description = schedule.status === "infeasible"
        ? schedule.violations.map((violation) => violation.message).join(" ")
        : schedule.status === "not_requested"
          ? "여행 시작일과 종료일을 입력해 주세요."
          : "아래 후보 중 새 일자의 중심 장소를 선택해 주세요.";
      renderEmptyState(dom.scheduleResultList, scheduleStatusLabel(schedule.status), description);
    }

    const showAnchors = schedule.status === "needs_anchor_selection" && schedule.anchorCandidates.length > 0;
    dom.anchorCandidatePanel.hidden = !showAnchors;
    dom.anchorCandidateList.replaceChildren();
    if (showAnchors) {
      dom.anchorCandidateHelp.textContent = `${schedule.unfilledDayCount}일이 비어 있습니다. 기존 중심에서 ${schedule.radiusKm}km 밖인 후보입니다.`;
      for (const candidate of schedule.anchorCandidates) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "anchor-candidate-button";
        button.innerHTML = `<strong></strong><span>R ${formatScore(candidate.relevance)}</span>`;
        button.querySelector("strong").textContent = candidate.title;
        button.addEventListener("click", () => {
          state.selectedAnchorIds.add(candidate.placeId);
          runRecommendation({
            fit: true,
            openOutput: false,
            variantId: state.variantSession.currentVariantId,
            preserveSession: true,
          });
        });
        dom.anchorCandidateList.append(button);
      }
    }
  }

  function resetVariantSession() {
    state.variantSession = {
      fingerprint: null,
      shownVariantIds: new Set(),
      currentVariantId: null,
      currentPlaceIds: [],
      rerollIndex: 0,
      lastTransition: null,
    };
  }

  function requestFingerprint(request) {
    return JSON.stringify(request);
  }

  function attachVariantSession(result, { reroll = false, preserveSession = false } = {}) {
    const variantId = result.courseVariant?.variantId || null;
    const fingerprint = requestFingerprint(result.request);
    const sameRequest = state.variantSession.fingerprint === fingerprint;
    if (!preserveSession || !variantId || (reroll && !sameRequest)) resetVariantSession();

    const previousVariantId = reroll ? state.variantSession.currentVariantId : null;
    const transition = reroll
      ? {
          previousVariantId,
          ...algorithm.courseOverlapTrace(state.variantSession.currentPlaceIds, result.courseVariant.placeIds),
        }
      : state.variantSession.lastTransition || {
          previousVariantId: null,
          overlapCount: 0,
          overlapRate: 0,
          changedPlaceCount: 0,
        };

    if (reroll) {
      state.variantSession.rerollIndex += 1;
      state.variantSession.lastTransition = transition;
    } else if (!preserveSession) {
      state.variantSession.lastTransition = transition;
    }
    state.variantSession.fingerprint = fingerprint;
    state.variantSession.currentVariantId = variantId;
    state.variantSession.currentPlaceIds = [...(result.courseVariant?.placeIds || [])];
    if (variantId) state.variantSession.shownVariantIds.add(variantId);

    result.rerollSession = {
      rerollIndex: state.variantSession.rerollIndex,
      previousVariantId: transition.previousVariantId,
      shownVariantIds: [...state.variantSession.shownVariantIds],
      overlapCount: transition.overlapCount,
      overlapRate: transition.overlapRate,
      changedPlaceCount: transition.changedPlaceCount,
    };
  }

  function renderCourseVariant(result) {
    const variant = result.courseVariant;
    const variants = result.courseVariants || [];
    dom.courseVariantBar.hidden = !variant;
    if (!variant) return;

    dom.courseVariantLabel.textContent = `추천 코스 ${variant.seedRelevanceRank}안`;
    const session = result.rerollSession;
    dom.courseOverlapSummary.textContent = session?.previousVariantId
      ? `이전 코스와 다른 장소 ${session.changedPlaceCount}곳`
      : "현재 조건으로 고른 장소 구성이에요.";
    const rerollAvailable = result.request.diversity === "balanced" && variants.length > 1;
    dom.rerollRecommendationButton.hidden = !rerollAvailable;
    dom.rerollRecommendationButton.disabled = !rerollAvailable;
    if (rerollAvailable) {
      const shownCount = variants.filter((item) => state.variantSession.shownVariantIds.has(item.variantId)).length;
      dom.rerollRecommendationButton.textContent = `다른 코스 보기 · ${shownCount}/${variants.length}`;
    }
  }

  function rerollRecommendation() {
    const result = state.recommendationResult;
    const variants = [...(result?.courseVariants || [])]
      .sort((left, right) => left.seedRelevanceRank - right.seedRelevanceRank);
    if (variants.length < 2) return null;

    const currentVariantId = state.variantSession.currentVariantId;
    const selection = algorithm.selectNextCourseVariant(
      variants,
      state.variantSession.shownVariantIds,
      currentVariantId,
    );
    if (selection.cycleRestarted) {
      state.variantSession.shownVariantIds = new Set(currentVariantId ? [currentVariantId] : []);
    }
    return runRecommendation({
      fit: true,
      openOutput: false,
      variantId: selection.variantId,
      reroll: true,
      preserveSession: true,
    });
  }

  function renderRecommendationOutput(result) {
    if (!result) {
      renderWarnings([]);
      renderVerificationCandidates({ verificationCandidates: [] });
      dom.requestPreview.textContent = "";
      dom.outputPreview.textContent = "";
      for (const key of ["candidateMetric", "scoredMetric", "poolMetric", "returnedMetric"]) dom[key].textContent = "0";
      return;
    }
    invalidateItinerary();
    closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
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
    for (const target of recommendationFeedbackTargets(result)) state.feedbackTargetHistory.set(target.placeId, target);
    document.body.classList.add("has-recommendation");
    updateRequiredInputState();
    state.hoveredScheduleDay = null;
    state.focusedScheduleDay = null;
    state.recommendationById = new Map(result.items.map((item) => [item.placeId, item]));
    state.scheduleById = new Map();
    for (const day of result.schedule?.dayClusters || []) {
      for (const item of day.places || []) state.scheduleById.set(item.placeId, { ...item, dayIndex: day.dayIndex });
    }
    const summary = result.summary;
    dom.requestPreview.textContent = JSON.stringify(result.request, null, 2);
    dom.outputPreview.textContent = JSON.stringify(result, null, 2);
    dom.candidateMetric.textContent = formatNumber(summary.inputCandidates);
    dom.scoredMetric.textContent = formatNumber(summary.scoredCandidates);
    dom.poolMetric.textContent = formatNumber(summary.poolSize);
    dom.returnedMetric.textContent = formatNumber(summary.returned);
    dom.recommendationCount.textContent = formatNumber(summary.returned);
    dom.mobileResultCount.textContent = formatNumber(summary.returned);
    dom.recommendationSummary.textContent = `내 조건에 맞는 제주 장소 ${formatNumber(summary.returned)}곳을 골랐어요.`;
    renderCourseVariant(result);
    renderWarnings(result.warnings);
    renderVerificationCandidates(result);
    renderSchedule(result.schedule);
    renderItineraryInputs();
    if (result.items.length) {
      const fragment = document.createDocumentFragment();
      for (const item of result.items) fragment.append(createRecommendationCard(item));
      dom.recommendationResultList.replaceChildren(fragment);
    } else {
      renderEmptyState(dom.recommendationResultList, "일반 추천 결과가 없습니다", result.verificationCandidates.length ? "미확인 조건 후보를 별도 목록과 JSON에서 확인하세요." : "지역·목적·후보 필터를 바꿔보세요.");
    }
    updateFeedbackSaveState();
    dom.outputScroll.scrollTop = 0;
    refreshMapMarkers();
    if (state.selectedPlace) renderDetail(state.selectedPlace);
  }

  function runRecommendation({
    fit = true,
    openOutput = true,
    variantId = null,
    reroll = false,
    preserveSession = false,
  } = {}) {
    hideFormError();
    try {
      if (!algorithm) throw new Error("CCU-MMR 알고리즘을 불러오지 못했습니다.");
      const request = collectRequest();
      const candidateMap = new Map(places.map((place) => [String(place.id), place]));
      for (const placeId of [...request.requiredPlaceIds, ...request.anchorPlaceIds]) {
        const place = placeById.get(placeId);
        if (place) candidateMap.set(placeId, place);
      }
      const runtime = variantId ? { variantId } : {};
      const result = algorithm.rank([...candidateMap.values()], request, runtime);
      if (!state.feedbackAutoSave.sessionId) resetFeedbackAutoSave({ createSession: true });
      attachVariantSession(result, { reroll, preserveSession });
      renderRecommendationOutput(result);
      if (feedbackHasUserInput()) scheduleFeedbackAutoSave(0);
      if (fit && mapPlaces().length) fitRecommendationPlaces();
      if (openOutput && isMobileStackedFlow()) {
        window.requestAnimationFrame(() => dom.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else if (openOutput && window.innerWidth <= 1240) {
        openOutputPanel();
      }
      return result;
    } catch (error) {
      showFormError(error instanceof Error ? error.message : "추천 입력을 확인해 주세요.");
      return null;
    }
  }

  function clearRecommendation(message = "추천 입력을 바꾼 뒤 다시 실행하세요.") {
    hideFormError();
    invalidateItinerary();
    dom.itinerarySection.hidden = true;
    closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
    state.selectedAnchorIds.clear();
    resetFeedbackAutoSave();
    state.recommendationFeedback.clear();
    state.feedbackTargetHistory.clear();
    renderRecommendationOutput(null);
    resetVariantSession();
    dom.courseVariantBar.hidden = true;
    document.body.classList.remove("has-recommendation");
    if (!state.recommendationResult) {
      updateRequiredInputState();
      updateFeedbackSaveState();
      return;
    }
    state.recommendationResult = null;
    state.recommendationById = new Map();
    state.scheduleById = new Map();
    state.hoveredScheduleDay = null;
    state.focusedScheduleDay = null;
    dom.recommendationSummary.textContent = message;
    dom.recommendationCount.textContent = "0";
    dom.mobileResultCount.textContent = "0";
    dom.fitRecommendationButton.disabled = true;
    dom.recommendationLegend.hidden = true;
    dom.scheduleDayCount.textContent = "0";
    dom.scheduleSummary.textContent = "입력값이 바뀌어 일정을 다시 계산해야 합니다.";
    dom.anchorCandidatePanel.hidden = true;
    renderEmptyState(dom.scheduleResultList, "일정을 다시 계산해야 합니다", message);
    renderEmptyState(dom.recommendationResultList, "결과를 다시 계산해야 합니다", message);
    updateRequiredInputState();
    updateFeedbackSaveState();
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
    applyFilters();
    fitJeju();
  }

  function openSidebar() {
    if (isMobileStackedFlow()) {
      document.getElementById("sidebar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
  function isDesktopSidebarCollapsible() {
    return window.matchMedia("(min-width: 1241px)").matches;
  }
  function syncDesktopSidebarState() {
    const collapsed = isDesktopSidebarCollapsible() && state.sidebarCollapsed;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    dom.sidebarCollapseButton.setAttribute("aria-expanded", String(!collapsed));
    dom.sidebarExpandButton.setAttribute("aria-expanded", String(!collapsed));
    dom.sidebarExpandButton.hidden = !collapsed;
  }
  function setDesktopSidebarCollapsed(collapsed, { focus = true } = {}) {
    state.sidebarCollapsed = Boolean(collapsed) && isDesktopSidebarCollapsible();
    syncDesktopSidebarState();
    const focusTarget = state.sidebarCollapsed ? dom.sidebarExpandButton : dom.sidebarCollapseButton;
    window.requestAnimationFrame(() => {
      state.map?.invalidateSize();
      if (!focus) return;
      window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 240);
    });
    window.setTimeout(() => state.map?.invalidateSize(), 240);
  }
  function openOutputPanel() {
    if (isMobileStackedFlow()) {
      dom.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
    const handleParticipantNameInput = () => {
      updateParticipantNameState();
      if (!state.recommendationResult || !feedbackHasUserInput()) {
        updateFeedbackSaveState();
        return;
      }
      const allowBlankParticipant = !participantNameValue()
        && (state.feedbackAutoSave.savedRevision > 0 || state.feedbackAutoSave.revision > 0);
      scheduleFeedbackAutoSave(500, { allowBlankParticipant });
    };
    dom.participantName.addEventListener("input", handleParticipantNameInput);
    dom.participantName.addEventListener("blur", () => {
      const trimmedName = participantNameValue();
      if (dom.participantName.value === trimmedName) return;
      dom.participantName.value = trimmedName;
      handleParticipantNameInput();
    });
    dom.recommendationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (isMobileStackedFlow()) {
        renderReviewSummary();
        if (!validateMobileWizardFlow()) return;
        showWizardStep(WIZARD_STEPS.length, { focus: false });
        runRecommendation();
        return;
      }
      if (state.wizardStep !== WIZARD_STEPS.length) {
        if (validateWizardStep(state.wizardStep)) showWizardStep(state.wizardStep + 1);
        return;
      }
      if (validateWizardFlow({ stacked: false })) runRecommendation();
    });
    dom.wizardNextButton.addEventListener("click", () => {
      if (validateWizardStep(state.wizardStep)) showWizardStep(state.wizardStep + 1);
    });
    dom.wizardBackButton.addEventListener("click", () => showWizardStep(state.wizardStep - 1));
    dom.reviewSummary.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-step]");
      if (editButton) showWizardStep(Number(editButton.dataset.editStep));
    });
    document.querySelectorAll("[data-choice-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = dom[button.dataset.choiceTarget];
        if (!target) return;
        target.value = button.dataset.choiceValue;
        syncChoiceCards();
        hideFormError();
        target.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    dom.dateUndecided.addEventListener("change", () => {
      const undecided = dom.dateUndecided.checked;
      if (undecided) {
        dom.travelStartDate.value = "";
        dom.travelEndDate.value = "";
        dom.tripDurationDays.value = "";
      }
      dom.travelStartDate.disabled = undecided;
      dom.travelEndDate.disabled = undecided;
      syncChoiceCards();
      hideFormError();
    });
    dom.tripDurationDays.addEventListener("change", () => {
      if (selectedTripDays()) {
        dom.travelStartDate.value = "";
        dom.travelEndDate.value = "";
        dom.dateUndecided.checked = false;
        dom.travelStartDate.disabled = false;
        dom.travelEndDate.disabled = false;
      }
      syncChoiceCards();
      hideFormError();
    });
    const clearDurationForExactDate = () => {
      if (!dom.travelStartDate.value && !dom.travelEndDate.value) return;
      dom.tripDurationDays.value = "";
      dom.dateUndecided.checked = false;
      syncChoiceCards();
    };
    dom.travelStartDate.addEventListener("input", clearDurationForExactDate);
    dom.travelEndDate.addEventListener("input", clearDurationForExactDate);
    dom.headerTravelMbtiButton.addEventListener("click", startTravelMbti);
    dom.startTravelMbtiButton.addEventListener("click", startTravelMbti);
    dom.restartTravelMbtiButton.addEventListener("click", startTravelMbti);
    dom.travelMbtiCloseButton.addEventListener("click", closeTravelMbtiDialog);
    dom.travelMbtiBackButton.addEventListener("click", travelMbtiBack);
    dom.travelMbtiSkipButton.addEventListener("click", () => {
      if (state.travelMbti.phase === "question") recordTravelMbtiQuestion("skip");
      else if (state.travelMbti.phase === "pair") recordTravelMbtiPair("skip");
    });
    dom.requiredPlaceSearch.addEventListener("input", renderRequiredPlaceSearchResults);
    dom.requiredPlaceSearch.addEventListener("focus", renderRequiredPlaceSearchResults);
    dom.requiredPlaceSearch.addEventListener("keydown", (event) => {
      const firstResult = dom.requiredPlaceSearchResults.querySelector(".required-place-result");
      if (event.key === "Enter" && firstResult) {
        event.preventDefault();
        firstResult.click();
      } else if (event.key === "ArrowDown" && firstResult) {
        event.preventDefault();
        firstResult.focus();
      } else if (event.key === "Escape") {
        dom.requiredPlaceSearchResults.hidden = true;
        dom.requiredPlaceSearch.setAttribute("aria-expanded", "false");
      }
    });
    dom.destinationRegion.addEventListener("change", renderRequiredPlacePicker);
    dom.tripIntent.addEventListener("change", renderRequiredPlacePicker);
    dom.excludedPlaceIds.addEventListener("input", renderRequiredPlaceSearchResults);
    document.addEventListener("click", (event) => {
      if (event.target.closest(".required-place-picker")) return;
      dom.requiredPlaceSearchResults.hidden = true;
      dom.requiredPlaceSearch.setAttribute("aria-expanded", "false");
    });
    dom.resetRecommendationButton.addEventListener("click", () => {
      clearRecommendation("여행 조건을 처음부터 다시 선택해 주세요.");
      resetRecommendationForm();
    });
    dom.rerollRecommendationButton.addEventListener("click", rerollRecommendation);
    dom.itineraryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      generateItinerary();
    });
    dom.itineraryForm.addEventListener("input", invalidateItinerary);
    dom.itineraryForm.addEventListener("change", invalidateItinerary);
    const markRequestDirty = (event) => {
      if (event.target.closest("#runRecommendationButton, #resetRecommendationButton")) return;
      if (event.target === dom.requiredPlaceSearch) return;
      clearRecommendation("입력값이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    };
    dom.recommendationForm.addEventListener("input", markRequestDirty);
    dom.recommendationForm.addEventListener("change", markRequestDirty);
    const handleSearch = debounce(() => {
      state.query = dom.placeSearch.value.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
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
    dom.detailCloseButton.addEventListener("click", clearSelection);
    dom.detailImageButton.addEventListener("click", openPlaceImageDialog);
    dom.placeImageDialogCloseButton.addEventListener("click", () => closePlaceImageDialog());
    dom.placeImageDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePlaceImageDialog();
    });
    dom.mobileRecommendationFeedbackCloseButton.addEventListener("click", () => closeMobileRecommendationFeedbackDialog());
    dom.mobileRecommendationFeedbackDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeMobileRecommendationFeedbackDialog();
    });
    dom.mobileRecommendationFeedbackDialog.addEventListener("click", (event) => {
      if (event.target === dom.mobileRecommendationFeedbackDialog) closeMobileRecommendationFeedbackDialog();
    });
    dom.placeImageDialog.addEventListener("click", (event) => {
      if (event.target !== dom.placeImageDialog) return;
      const bounds = dom.placeImageDialog.querySelector(".place-image-dialog-shell").getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        closePlaceImageDialog();
      }
    });
    dom.centerPlaceButton.addEventListener("click", centerSelectedPlace);
    dom.copyPlaceButton.addEventListener("click", copySelectedPlace);
    dom.mobilePanelButton.addEventListener("click", openSidebar);
    dom.mobileOutputButton.addEventListener("click", openOutputPanel);
    dom.mobileResultsFab.addEventListener("click", openOutputPanel);
    dom.sidebarCollapseButton.addEventListener("click", () => setDesktopSidebarCollapsed(true));
    dom.sidebarExpandButton.addEventListener("click", () => setDesktopSidebarCollapsed(false));
    dom.sidebarCloseButton.addEventListener("click", closeSidebar);
    dom.outputCloseButton.addEventListener("click", closeOutputPanel);
    dom.sidebarBackdrop.addEventListener("click", closeSidebar);
    dom.outputBackdrop.addEventListener("click", closeOutputPanel);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dom.mobileRecommendationFeedbackDialog.open) closeMobileRecommendationFeedbackDialog();
      else if (placeImageDialogOpen()) closePlaceImageDialog();
      else if (dom.travelMbtiDialog.open) closeTravelMbtiDialog();
      else if (document.body.classList.contains("sidebar-open")) closeSidebar();
      else if (document.body.classList.contains("output-open")) closeOutputPanel();
      else if (state.selectedPlace) clearSelection();
    });
    window.addEventListener("resize", debounce(() => {
      if (!isMobileStackedFlow() && dom.mobileRecommendationFeedbackDialog.open) {
        closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
      }
      if (window.innerWidth > 1240) { closeSidebar(); closeOutputPanel(); }
      else if (state.sidebarCollapsed) setDesktopSidebarCollapsed(false, { focus: false });
      else syncDesktopSidebarState();
      showWizardStep(state.wizardStep, { focus: false });
      state.map?.invalidateSize();
      scheduleVisibleResultRender();
    }, 120));
  }

  function initialize() {
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    document.querySelectorAll("[data-debug-only]").forEach(element => { element.hidden = !debug; });
    try {
      if (!algorithm) throw new Error("CCU-MMR 알고리즘 파일을 불러오지 못했습니다.");
      if (!preferenceEngine) throw new Error("여행 MBTI 모듈을 불러오지 못했습니다.");
      dom.headerReadyCount.textContent = formatNumber(metadata.recommendationReadyCount || places.filter((place) => place.recommendationReady).length);
      dom.sourceDate.textContent = `수집일 ${formatSourceDate(metadata.sourceDate)}`;
      dom.algorithmBadge.textContent = algorithm.ALGORITHM_VERSION;
      dom.configPreview.textContent = JSON.stringify(algorithm.CONFIG, null, 2);
      syncChoiceCards();
      renderAppliedTravelMbti();
      renderRequiredPlacePicker();
      createCategoryFilters();
      bindEvents();
      syncDesktopSidebarState();
      initMap();
      showWizardStep(1, { focus: false });
      window.CCU_MMR_DASHBOARD = {
        run: () => runRecommendation({ fit: false, openOutput: false }),
        reroll: () => rerollRecommendation(),
        getResult: () => state.recommendationResult,
        getItinerary: () => itineraryClient?.getState(),
        generateItinerary: () => generateItinerary(),
        getSelectedPlace: () => state.selectedPlace,
        getSidebarCollapsed: () => state.sidebarCollapsed,
        getMapPlaceIds: () => mapPlaces().map((place) => String(place.id)),
        getHighlightedScheduleDay: () => activeScheduleDay(),
        getPreferenceProfile: () => state.preferenceProfile,
        getRecommendationFeedback: () => Object.fromEntries(state.recommendationFeedback),
        getParticipantName: () => participantNameValue(),
        getFeedbackCompletion: () => recommendationFeedbackCompletion(),
        buildFeedbackLog: () => buildFeedbackLog(Math.max(1, state.feedbackAutoSave.revision)),
        getFeedbackAutoSaveState: () => ({
          sessionId: state.feedbackAutoSave.sessionId,
          revision: state.feedbackAutoSave.revision,
          savedRevision: state.feedbackAutoSave.savedRevision,
          status: state.feedbackAutoSave.status,
          error: state.feedbackAutoSave.error,
        }),
        startTravelMbti: () => startTravelMbti(),
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
