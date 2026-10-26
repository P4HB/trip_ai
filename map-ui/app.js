(() => {
  "use strict";
  // SPEC-113 REQ-006: app.js only assembles the modules, exposes the inspection/test boundaries and owns
  // the page-wide Escape shortcut and resize handling. Modules are created in dependency order; later
  // modules are reached through TRAVEL_EVENTS instead of references.

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

  const metadata = window.JEJU_DATA_META || {};
  const algorithm = window.CCU_MMR;
  const preferenceEngine = window.TRAVEL_PREFERENCE;
  const events = window.TRAVEL_EVENTS;
  const helpers = window.TRAVEL_VIEW_HELPERS;
  const { categoryFor, formatNumber, formatScore, formatSourceDate, formatModifiedDate, regionName, debounce, renderEmptyState } = helpers;
  const rawPlaces = Array.isArray(window.JEJU_PLACES) ? window.JEJU_PLACES : [];
  const places = rawPlaces.map((place) => window.TRAVEL_DOMAIN.enrichPlace(place));
  const placeById = new Map(places.map((place) => [String(place.id), place]));
  const countsByType = places.reduce((counts, place) => counts.set(place.type, (counts.get(place.type) || 0) + 1), new Map());
  const availableTypes = Object.keys(helpers.CATEGORY_CONFIG).filter((type) => (countsByType.get(type) || 0) > 0);
  const { state, recommendationFor } = window.TRAVEL_STATE.create({ places, availableTypes });

  const layout = window.TRAVEL_LAYOUT.create({ dom, state });
  const { isMobileStackedFlow } = layout;
  const placeDetail = window.TRAVEL_PLACE_DETAIL.create({ dom, formatNumber, formatSourceDate, metadata, places, state });
  const feedback = window.TRAVEL_FEEDBACK.create({ state, dom, placeById, algorithm, events });
  const itineraryView = window.TRAVEL_ITINERARY_VIEW.create({ state, dom, places, placeById, metadata });
  const wizard = window.TRAVEL_WIZARD.create({
    algorithm, availableTypes, categoryFor, dom, events, formatNumber, isMobileStackedFlow, placeById, places, preferenceEngine, regionName, state,
  });
  const preferenceView = window.TRAVEL_PREFERENCE_VIEW.create({
    dom, events, hideFormError: wizard.hideFormError, preferenceEngine, showFormError: wizard.showFormError, state,
  });
  const detail = window.TRAVEL_DETAIL_VIEW.create({
    categoryFor, closeOutputPanel: layout.closeOutputPanel, createRecommendationFeedback: feedback.createRecommendationFeedback, dom, events,
    formatModifiedDate, formatScore, isMobileStackedFlow, loadPlaceReviews: placeDetail.loadPlaceReviews, openOutputPanel: layout.openOutputPanel,
    recommendationFor, regionName, renderResearchDetail: placeDetail.renderResearchDetail, state,
  });
  const mapView = window.TRAVEL_MAP_VIEW.create({
    availableTypes, categoryFor, clearSelection: detail.clearSelection, countsByType, debounce, dom, events, formatNumber,
    hideLoading: layout.hideLoading, placeById, places, recommendationFor, regionName, renderEmptyState, selectPlace: detail.selectPlace, state,
  });
  const results = window.TRAVEL_RESULTS_VIEW.create({
    categoryFor, closeMobileRecommendationFeedbackDialog: detail.closeMobileRecommendationFeedbackDialog,
    createFeedbackBadge: feedback.createFeedbackBadge, createRecommendationFeedback: feedback.createRecommendationFeedback, dom, events,
    formatNumber, formatScore, invalidateItinerary: itineraryView.invalidateItinerary, metadata, openRecommendationPlace: detail.openRecommendationPlace,
    placeById, publicResearch: placeDetail.publicResearch, recommendationFeedbackTargets: feedback.recommendationFeedbackTargets,
    refreshMapMarkers: mapView.refreshMapMarkers, refreshScheduleDayHighlight: mapView.refreshScheduleDayHighlight, regionName,
    renderDetail: detail.renderDetail, renderEmptyState, renderItineraryInputs: itineraryView.renderItineraryInputs, selectPlace: detail.selectPlace,
    state, updateFeedbackSaveState: feedback.updateFeedbackSaveState, updateRequiredInputState: wizard.updateRequiredInputState,
  });
  const controller = window.TRAVEL_RECOMMENDATION_CONTROLLER.create({
    WIZARD_STEPS: wizard.WIZARD_STEPS, algorithm, clearTravelMbtiProfile: preferenceView.clearTravelMbtiProfile,
    closeMobileRecommendationFeedbackDialog: detail.closeMobileRecommendationFeedbackDialog, collectRequest: wizard.collectRequest, dom, events,
    feedbackHasUserInput: feedback.feedbackHasUserInput, fitRecommendationPlaces: mapView.fitRecommendationPlaces, hideFormError: wizard.hideFormError,
    invalidateItinerary: itineraryView.invalidateItinerary, isMobileStackedFlow, mapPlaces: mapView.mapPlaces, openOutputPanel: layout.openOutputPanel,
    placeById, places, refreshMapMarkers: mapView.refreshMapMarkers, renderDetail: detail.renderDetail, renderEmptyState,
    renderRecommendationOutput: results.renderRecommendationOutput, renderReviewSummary: wizard.renderReviewSummary,
    resetFeedbackAutoSave: feedback.resetFeedbackAutoSave, resetRecommendationForm: wizard.resetRecommendationForm,
    scheduleFeedbackAutoSave: feedback.scheduleFeedbackAutoSave, showFormError: wizard.showFormError, showWizardStep: wizard.showWizardStep, state,
    updateFeedbackSaveState: feedback.updateFeedbackSaveState, updateRequiredInputState: wizard.updateRequiredInputState,
    validateMobileWizardFlow: wizard.validateMobileWizardFlow, validateWizardFlow: wizard.validateWizardFlow, validateWizardStep: wizard.validateWizardStep,
  });

  function bindGlobalEvents() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dom.mobileRecommendationFeedbackDialog.open) detail.closeMobileRecommendationFeedbackDialog();
      else if (detail.placeImageDialogOpen()) detail.closePlaceImageDialog();
      else if (dom.travelMbtiDialog.open) preferenceView.closeTravelMbtiDialog();
      else if (document.body.classList.contains("sidebar-open")) layout.closeSidebar();
      else if (document.body.classList.contains("output-open")) layout.closeOutputPanel();
      else if (state.selectedPlace) detail.clearSelection();
    });
    window.addEventListener("resize", debounce(() => {
      if (!isMobileStackedFlow() && dom.mobileRecommendationFeedbackDialog.open) {
        detail.closeMobileRecommendationFeedbackDialog({ restoreFocus: false });
      }
      if (window.innerWidth > 1240) { layout.closeSidebar(); layout.closeOutputPanel(); }
      else if (state.sidebarCollapsed) layout.setDesktopSidebarCollapsed(false, { focus: false });
      else layout.syncDesktopSidebarState();
      wizard.showWizardStep(state.wizardStep, { focus: false });
      state.map?.invalidateSize();
      mapView.scheduleVisibleResultRender();
    }, 120));
  }

  function bindEvents() {
    // Same registration order as the former single bindEvents (SPEC-113 REQ-006).
    feedback.bindEvents();
    controller.bindEvents();
    wizard.bindEvents();
    preferenceView.bindEvents();
    itineraryView.bindEvents();
    mapView.bindEvents();
    detail.bindEvents();
    layout.bindEvents();
    bindGlobalEvents();
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
      wizard.syncChoiceCards();
      preferenceView.renderAppliedTravelMbti();
      wizard.renderRequiredPlacePicker();
      mapView.createCategoryFilters();
      bindEvents();
      layout.syncDesktopSidebarState();
      mapView.initMap();
      wizard.showWizardStep(1, { focus: false });
      // SPEC-113 REQ-001: browser tests set this flag with page.addInitScript before the page loads.
      if (window.__TRIP_AI_TEST__ === true) {
        window.__TRIP_AI_INTERNALS__ = Object.freeze({
          algorithm, places, placeById, dom, state,
          clearRecommendation: controller.clearRecommendation, resetFeedbackAutoSave: feedback.resetFeedbackAutoSave,
          attachVariantSession: controller.attachVariantSession, renderRecommendationOutput: results.renderRecommendationOutput,
          completeRecommendationFeedback: feedback.completeRecommendationFeedback, toggleCategory: mapView.toggleCategory,
          runRecommendation: controller.runRecommendation, rerollRecommendation: controller.rerollRecommendation,
          scheduleFeedbackAutoSave: feedback.scheduleFeedbackAutoSave, itineraryPlaceLabel: itineraryView.itineraryPlaceLabel,
          selectPlace: detail.selectPlace,
        });
      }
      window.CCU_MMR_DASHBOARD = {
        run: () => controller.runRecommendation({ fit: false, openOutput: false }),
        reroll: () => controller.rerollRecommendation(),
        getResult: () => state.recommendationResult,
        getItinerary: () => itineraryView.itineraryClient?.getState(),
        generateItinerary: () => itineraryView.generateItinerary(),
        getSelectedPlace: () => state.selectedPlace,
        getSidebarCollapsed: () => state.sidebarCollapsed,
        getMapPlaceIds: () => mapView.mapPlaces().map((place) => String(place.id)),
        getHighlightedScheduleDay: () => mapView.activeScheduleDay(),
        getPreferenceProfile: () => state.preferenceProfile,
        getRecommendationFeedback: () => Object.fromEntries(state.recommendationFeedback),
        getParticipantName: () => feedback.participantNameValue(),
        getFeedbackCompletion: () => feedback.recommendationFeedbackCompletion(),
        buildFeedbackLog: () => feedback.buildFeedbackLog(Math.max(1, state.feedbackAutoSave.revision)),
        getFeedbackAutoSaveState: () => ({
          sessionId: state.feedbackAutoSave.sessionId,
          revision: state.feedbackAutoSave.revision,
          savedRevision: state.feedbackAutoSave.savedRevision,
          status: state.feedbackAutoSave.status,
          error: state.feedbackAutoSave.error,
        }),
        startTravelMbti: () => preferenceView.startTravelMbti(),
      };
    } catch (error) {
      console.error(error);
      layout.setLoadingError(error instanceof Error ? error.message : "지도를 준비하지 못했습니다.");
      dom.filterSummary.textContent = "데이터를 불러오지 못했습니다.";
      renderEmptyState(dom.resultList, "지도를 열 수 없습니다", "파일 구성을 확인한 뒤 새로고침해 주세요.");
    }
  }

  initialize();
})();
