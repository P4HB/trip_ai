/* SPEC-111: state.js */
(function (root) {
  "use strict";
  root.TRAVEL_STATE = { create({ places, availableTypes }) {
  const state = {
    map: null,
    tileLayer: null,
    clusterLayer: null,
    markerById: new Map(),
    selectedTypes: new Set(availableTypes),
    selectedPlace: null,
    sidebarCollapsed: false,
    detailImageLoadToken: 0,
    reviewRequests: new Map(),
    filteredPlaces: places,
    initialBounds: null,
    query: "",
    renderFrame: null,
    recommendationResult: null,
    itineraryRevision: 0,
    // SPEC-107: slotId -> chosen restaurant candidate. Tab memory only; never sent to the feedback log.
    mealSelections: new Map(),
    openRestaurantGroups: new Set(),
    recommendationById: new Map(),
    recommendationFeedback: new Map(),
    feedbackTargetHistory: new Map(),
    feedbackAutoSave: {
      sessionId: null,
      createdAt: null,
      revision: 0,
      savedRevision: 0,
      status: "idle",
      timerId: null,
      retryAttempt: 0,
      inFlight: false,
      controller: null,
      pendingPayload: null,
      error: "",
    },
    scheduleById: new Map(),
    requiredPlaceIds: new Set(),
    selectedAnchorIds: new Set(),
    hoveredScheduleDay: null,
    focusedScheduleDay: null,
    drawerReturnFocus: null,
    mobileFeedbackReturnFocus: null,
    wizardStep: 1,
    requiredValidationAttempted: false,
    selectedPreset: null,
    preferenceProfile: null,
    travelMbti: {
      phase: "question",
      questionIndex: 0,
      questionnaireAnswers: [],
      pairAnswers: [],
      currentPairId: null,
      profile: null,
    },
    variantSession: {
      fingerprint: null,
      shownVariantIds: new Set(),
      currentVariantId: null,
      currentPlaceIds: [],
      rerollIndex: 0,
      lastTransition: null,
    },
  };


    return { state };
  } };
})(window);
