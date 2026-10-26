/* SPEC-113 REQ-006: recommendation run/reroll/clear, course variant session and the request form actions. */
(function (root) {
  "use strict";
  root.TRAVEL_RECOMMENDATION_CONTROLLER = { create({ WIZARD_STEPS, algorithm, clearTravelMbtiProfile, closeMobileRecommendationFeedbackDialog, collectRequest, dom, events, feedbackHasUserInput, fitRecommendationPlaces, hideFormError, invalidateItinerary, isMobileStackedFlow, mapPlaces, openOutputPanel, placeById, places, refreshMapMarkers, renderDetail, renderEmptyState, renderRecommendationOutput, renderReviewSummary, resetFeedbackAutoSave, resetRecommendationForm, scheduleFeedbackAutoSave, showFormError, showWizardStep, state, updateFeedbackSaveState, updateRequiredInputState, validateMobileWizardFlow, validateWizardFlow, validateWizardStep }) {
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

  function bindEvents() {
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
    dom.resetRecommendationButton.addEventListener("click", () => {
      clearRecommendation("여행 조건을 처음부터 다시 선택해 주세요.");
      clearTravelMbtiProfile();
      resetRecommendationForm();
    });
    dom.rerollRecommendationButton.addEventListener("click", rerollRecommendation);
    const markRequestDirty = (event) => {
      if (event.target.closest("#runRecommendationButton, #resetRecommendationButton")) return;
      if (event.target === dom.requiredPlaceSearch) return;
      clearRecommendation("입력값이 바뀌었습니다. 추천을 다시 실행해 주세요.");
    };
    dom.recommendationForm.addEventListener("input", markRequestDirty);
    dom.recommendationForm.addEventListener("change", markRequestDirty);
    events.on("conditionsChanged", ({ message }) => clearRecommendation(message));
    events.on("rerunRequested", (options) => runRecommendation(options));
  }

    return { resetVariantSession, attachVariantSession, rerollRecommendation, runRecommendation, clearRecommendation, bindEvents };
  } };
})(window);
