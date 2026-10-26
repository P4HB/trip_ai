(function (root) {
  "use strict";
  const domain = root.TRAVEL_DOMAIN;
  const WIZARD_STEPS = Object.freeze(["동행자", "날짜", "여행 방식", "여행 취향", "조건 확인"]);
  const DISPLAY_VALUES = domain.TRIP_CHOICE_LABELS;
  const INTENT_CONTENT_TYPES = domain.INTENT_TYPES;
  root.TRAVEL_WIZARD = { create({ algorithm, availableTypes, categoryFor, dom, events, formatNumber, isMobileStackedFlow, placeById, places, preferenceEngine, regionName, state }) {
  function collectPreferences() {
    if (!state.preferenceProfile || !preferenceEngine) return [];
    return preferenceEngine.materializePreferences(state.preferenceProfile);
  }

  function requiredPlaceEligible(place) {
    if (!place?.recommendationReady || domain.isEventPlace(place)) return false;
    if (dom.destinationRegion.value !== "jeju_all" && place.region !== dom.destinationRegion.value) return false;
    return INTENT_CONTENT_TYPES[dom.tripIntent.value]?.has(String(place.type)) || false;
  }

  function requiredPlaceMatches(place, query) {
    const normalized = domain.normalizeSearchText(query);
    return String(place.id).includes(normalized) || place.searchText.includes(normalized);
  }

  function requiredPlaceMatchRank(place, query) {
    const normalized = domain.normalizeSearchText(query);
    const title = domain.normalizeSearchText(place.title);
    const id = String(place.id);
    if (id === normalized || title === normalized) return 0;
    if (title.startsWith(normalized)) return 1;
    if (title.includes(normalized)) return 2;
    if (domain.normalizeSearchText(place.address).includes(normalized)) return 3;
    return 4;
  }

  function renderSelectedRequiredPlaces() {
    dom.selectedRequiredPlaces.replaceChildren();
    const selectedIds = [...state.requiredPlaceIds];
    const invalidCount = selectedIds.filter((placeId) => !requiredPlaceEligible(placeById.get(placeId))).length;
    dom.requiredPlaceStatus.textContent = selectedIds.length
      ? `${formatNumber(selectedIds.length)}곳 선택${invalidCount ? ` · 현재 지역·목적과 맞지 않는 ${formatNumber(invalidCount)}곳은 삭제하거나 조건을 되돌려 주세요.` : ""}`
      : "선택된 필수 장소가 없습니다.";
    for (const placeId of selectedIds) {
      const place = placeById.get(placeId);
      if (!place) continue;
      const chip = document.createElement("div");
      chip.className = `selected-required-place${requiredPlaceEligible(place) ? "" : " is-invalid"}`;
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = place.title;
      const meta = document.createElement("span");
      meta.textContent = `${categoryFor(place.type).label} · ${regionName(place.region)} · ID ${place.id}`;
      copy.append(title, meta);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-required-place";
      remove.setAttribute("aria-label", `${place.title} 필수 장소에서 삭제`);
      remove.textContent = "삭제";
      remove.addEventListener("click", () => {
        state.requiredPlaceIds.delete(placeId);
        renderRequiredPlacePicker();
        events.emit("conditionsChanged", { message: "필수 장소가 바뀌었습니다. 추천을 다시 실행해 주세요." });
        dom.requiredPlaceSearch.focus();
      });
      chip.append(copy, remove);
      dom.selectedRequiredPlaces.append(chip);
    }
  }

  function renderRequiredPlaceSearchResults() {
    const query = dom.requiredPlaceSearch.value.trim();
    dom.requiredPlaceSearchResults.replaceChildren();
    if (!query) {
      dom.requiredPlaceSearchResults.hidden = true;
      dom.requiredPlaceSearch.setAttribute("aria-expanded", "false");
      return;
    }
    const excludedIds = new Set(dom.excludedPlaceIds.value.split(/[\s,]+/u).map((value) => value.trim()).filter(Boolean));
    const matches = places
      .filter(requiredPlaceEligible)
      .filter((place) => !state.requiredPlaceIds.has(String(place.id)) && !excludedIds.has(String(place.id)))
      .filter((place) => requiredPlaceMatches(place, query))
      .sort((left, right) => requiredPlaceMatchRank(left, query) - requiredPlaceMatchRank(right, query)
        || Number(left.sourceOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.sourceOrder ?? Number.MAX_SAFE_INTEGER)
        || String(left.id).localeCompare(String(right.id)))
      .slice(0, 10);
    dom.requiredPlaceSearchResults.hidden = false;
    dom.requiredPlaceSearch.setAttribute("aria-expanded", "true");
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "required-place-search-empty";
      empty.textContent = "현재 지역·장소 목적에서 선택 가능한 검색 결과가 없습니다.";
      dom.requiredPlaceSearchResults.append(empty);
      return;
    }
    for (const place of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "required-place-result";
      button.setAttribute("role", "option");
      button.dataset.placeId = String(place.id);
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = place.title;
      const address = document.createElement("span");
      address.textContent = place.address || "주소 정보 없음";
      copy.append(title, address);
      const meta = document.createElement("small");
      meta.textContent = `${categoryFor(place.type).label} · ${regionName(place.region)} · ID ${place.id}`;
      button.append(copy, meta);
      button.addEventListener("click", () => {
        state.requiredPlaceIds.add(String(place.id));
        state.selectedAnchorIds.clear();
        dom.requiredPlaceSearch.value = "";
        renderRequiredPlacePicker();
        events.emit("conditionsChanged", { message: "필수 장소가 바뀌었습니다. 추천을 다시 실행해 주세요." });
        dom.requiredPlaceSearch.focus();
      });
      dom.requiredPlaceSearchResults.append(button);
    }
  }

  function renderRequiredPlacePicker() {
    renderSelectedRequiredPlaces();
    renderRequiredPlaceSearchResults();
  }

  function collectRequest() {
    const hardConstraints = [...document.querySelectorAll('input[name="hardConstraint"]:checked')].map((input) => input.value);
    const excludedPlaceIds = dom.excludedPlaceIds.value.split(/[\s,]+/u).map((value) => value.trim()).filter(Boolean);
    const hasDates = !dom.dateUndecided.checked && dom.travelStartDate.value && dom.travelEndDate.value;
    const tripDays = hasDates ? null : selectedTripDays();
    return {
      ...(state.preferenceProfile ? {
        schemaVersion: algorithm.PERSONALIZED_REQUEST_SCHEMA_VERSION,
        preferenceProfile: state.preferenceProfile,
      } : {}),
      requestId: "local-dashboard",
      destinationRegion: dom.destinationRegion.value,
      intent: dom.tripIntent.value,
      travelWindow: hasDates ? { startDate: dom.travelStartDate.value, endDate: dom.travelEndDate.value } : null,
      tripDays,
      transportMode: dom.transportMode.value,
      companionType: dom.companionType.value,
      preferences: collectPreferences(),
      hardConstraints,
      requiredPlaceIds: [...state.requiredPlaceIds],
      anchorPlaceIds: [...state.selectedAnchorIds],
      excludedPlaceIds,
      resultCount: Number(dom.resultLimit.value),
      diversity: dom.diversityPreset.value,
      candidateFilter: {
        query: null,
        contentTypeIds: availableTypes.slice().sort(),
      },
    };
  }

  function syncChoiceCards() {
    document.querySelectorAll("[data-choice-target]").forEach((button) => {
      const target = dom[button.dataset.choiceTarget];
      button.setAttribute("aria-pressed", String(target?.value === button.dataset.choiceValue));
    });
  }

  function formatWizardDate(value) {
    return domain.formatDotDate(value) ?? "미선택";
  }

  function selectedTripDays() {
    const value = Number(dom.tripDurationDays.value);
    return [2, 3, 4].includes(value) ? value : null;
  }

  function formatTripDuration(days) {
    return Number.isInteger(days) && days > 1 ? `${days - 1}박 ${days}일` : "미선택";
  }

  function preferenceSummary() {
    const mbtiSummary = state.preferenceProfile?.displaySummary;
    if (mbtiSummary) return `${mbtiSummary.archetypeId} · ${mbtiSummary.archetypeName}`;
    return "MBTI 검사 필요";
  }

  function requiredInputStates() {
    const hasBothDates = Boolean(dom.travelStartDate.value && dom.travelEndDate.value);
    const hasValidDates = hasBothDates && dom.travelStartDate.value <= dom.travelEndDate.value;
    const tripDays = selectedTripDays();
    const eventRequiresDates = dom.tripIntent.value === "event";
    const dateValue = (dom.dateUndecided.checked || tripDays) && eventRequiresDates
      ? "축제 날짜 필요"
      : dom.dateUndecided.checked
      ? "기간 미정"
      : tripDays
        ? formatTripDuration(tripDays)
      : hasBothDates
        ? `${formatWizardDate(dom.travelStartDate.value)} → ${formatWizardDate(dom.travelEndDate.value)}`
        : "미선택";
    const preferences = collectPreferences();
    return [
      { key: "companion", label: "동행", step: 1, complete: Boolean(dom.companionType.value), value: DISPLAY_VALUES.companionType[dom.companionType.value] || "미선택" },
      { key: "date", label: "날짜·기간", step: 2, complete: hasValidDates || (Boolean(tripDays) && !eventRequiresDates) || (dom.dateUndecided.checked && !eventRequiresDates), value: dateValue },
      { key: "region", label: "여행 지역", step: 3, complete: Boolean(dom.destinationRegion.value), value: DISPLAY_VALUES.destinationRegion[dom.destinationRegion.value] || "미선택" },
      { key: "intent", label: "찾는 장소", step: 3, complete: Boolean(dom.tripIntent.value), value: DISPLAY_VALUES.tripIntent[dom.tripIntent.value] || "미선택" },
      { key: "transport", label: "이동", step: 3, complete: Boolean(dom.transportMode.value), value: DISPLAY_VALUES.transportMode[dom.transportMode.value] || "미선택" },
      { key: "preference", label: "여행 취향", step: 4, complete: Boolean(state.preferenceProfile && preferences.length), value: preferenceSummary(), wide: true },
    ];
  }

  function renderReviewSummary(requirements = requiredInputStates()) {
    const fragment = document.createDocumentFragment();
    for (const requirement of requirements) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `review-summary-item${requirement.wide ? " is-wide" : ""}${requirement.complete ? "" : " is-missing"}`;
      button.dataset.editStep = String(requirement.step);
      button.dataset.requirementKey = requirement.key;
      button.setAttribute("aria-label", `${requirement.label} ${requirement.complete ? "수정" : "필수 선택"}: ${requirement.value}`);
      const caption = document.createElement("span");
      caption.textContent = `${requirement.label} · ${requirement.complete ? "수정" : "필수"}`;
      const strong = document.createElement("strong");
      strong.textContent = requirement.value;
      button.append(caption, strong);
      fragment.append(button);
    }
    dom.reviewSummary.replaceChildren(fragment);
  }

  function updateRequiredInputState({ renderReview = isMobileStackedFlow() || state.wizardStep === WIZARD_STEPS.length } = {}) {
    const requirements = requiredInputStates();
    const completedCount = requirements.filter((requirement) => requirement.complete).length;
    const missing = requirements.filter((requirement) => !requirement.complete);
    const total = requirements.length;
    const progress = Math.round((completedCount / total) * 100);
    dom.requiredProgressText.textContent = `${completedCount} / ${total} 완료`;
    dom.requiredProgressTrack.setAttribute("aria-valuenow", String(completedCount));
    dom.requiredProgressBar.style.width = `${progress}%`;
    dom.requiredMissingText.textContent = missing.length
      ? `남은 항목: ${missing.map((requirement) => requirement.label).join(" · ")}`
      : "필수 조건을 모두 선택했어요.";
    dom.requiredOverview.classList.toggle("is-complete", missing.length === 0);
    const dateRequirement = requirements.find((requirement) => requirement.key === "date");
    dom.dateEventRequirement.hidden = dom.tripIntent.value !== "event" || dateRequirement.complete;
    dom.runRecommendationButton.textContent = missing.length
      ? `필수 조건 ${missing.length}개 확인하기`
      : state.recommendationResult
        ? "이 조건으로 다시 추천받기"
        : "추천 결과 아래에서 보기";
    dom.runRecommendationButton.classList.toggle("is-incomplete", missing.length > 0);
    dom.runRecommendationButton.dataset.missingCount = String(missing.length);

    for (const requirement of requirements) {
      const container = document.querySelector(`[data-requirement-key="${requirement.key}"]`);
      const showError = isMobileStackedFlow() && state.requiredValidationAttempted && !requirement.complete;
      container?.classList.toggle("is-complete", requirement.complete);
      container?.classList.toggle("has-required-error", showError);
      if (showError) container?.setAttribute("aria-invalid", "true");
      else container?.removeAttribute("aria-invalid");
      document.querySelectorAll(`[data-requirement-status="${requirement.key}"]`).forEach((status) => {
        status.textContent = requirement.complete ? "✓ 완료" : showError ? "확인 필요" : "선택 전";
      });
    }
    if (renderReview) renderReviewSummary(requirements);
    return requirements;
  }

  function focusWizardChoice(selector) {
    window.requestAnimationFrame(() => document.querySelector(selector)?.focus({ preventScroll: true }));
  }

  function validateWizardStep(step) {
    hideFormError();
    if (step === 1 && !dom.companionType.value) {
      showFormError("함께 가는 사람을 하나 선택해 주세요.");
      focusWizardChoice('[data-choice-target="companionType"]');
      return false;
    }
    if (step === 2 && dom.tripIntent.value === "event" && (dom.dateUndecided.checked || selectedTripDays())) {
      showFormError("축제·행사 추천은 실제 출발일과 돌아오는 날이 필요해요. 날짜를 직접 선택해 주세요.");
      window.requestAnimationFrame(() => selectedTripDays()
        ? document.querySelector('[data-choice-target="tripDurationDays"][aria-pressed="true"]')?.focus()
        : dom.dateUndecided.focus());
      return false;
    }
    if (step === 2 && !dom.dateUndecided.checked && !selectedTripDays()) {
      if (!dom.travelStartDate.value || !dom.travelEndDate.value) {
        showFormError("출발일과 돌아오는 날을 모두 선택하거나 여행 기간을 골라주세요.");
        window.requestAnimationFrame(() => (!dom.travelStartDate.value ? dom.travelStartDate : dom.travelEndDate).focus());
        return false;
      }
      if (dom.travelStartDate.value > dom.travelEndDate.value) {
        showFormError("돌아오는 날은 출발일과 같거나 이후여야 해요.");
        window.requestAnimationFrame(() => dom.travelEndDate.focus());
        return false;
      }
    }
    if (step === 3) {
      const missingTarget = ["destinationRegion", "tripIntent", "transportMode"].find((target) => !dom[target].value);
      if (missingTarget) {
        const messages = {
          destinationRegion: "둘러볼 지역을 선택해 주세요.",
          tripIntent: "찾고 싶은 장소 유형을 선택해 주세요.",
          transportMode: "제주에서 이용할 이동수단을 선택해 주세요.",
        };
        showFormError(messages[missingTarget]);
        focusWizardChoice(`[data-choice-target="${missingTarget}"]`);
        return false;
      }
    }
    if (step === 4 && (!state.preferenceProfile || collectPreferences().length === 0)) {
      showFormError("여행 MBTI 검사를 완료하고 결과를 적용해 주세요.");
      focusWizardChoice("#startTravelMbtiButton");
      return false;
    }
    return true;
  }

  function validateWizardFlow({ stacked = isMobileStackedFlow() } = {}) {
    if (stacked) {
      state.requiredValidationAttempted = true;
      updateRequiredInputState({ renderReview: true });
    }
    for (let step = 1; step < WIZARD_STEPS.length; step += 1) {
      if (validateWizardStep(step)) continue;
      state.wizardStep = step;
      if (stacked) {
        document.querySelector(`[data-wizard-step="${step}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const message = dom.formError.textContent;
        showWizardStep(step, { focus: false });
        showFormError(message);
      }
      return false;
    }
    return true;
  }

  function validateMobileWizardFlow() {
    return validateWizardFlow({ stacked: true });
  }

  function showWizardStep(step, { focus = true } = {}) {
    const nextStep = Math.max(1, Math.min(WIZARD_STEPS.length, Number(step) || 1));
    state.wizardStep = nextStep;
    hideFormError();
    const stacked = isMobileStackedFlow();
    document.body.classList.toggle("mobile-stacked-flow", stacked);
    document.querySelectorAll("[data-wizard-step]").forEach((section) => {
      const active = Number(section.dataset.wizardStep) === nextStep;
      section.hidden = stacked ? false : !active;
      section.setAttribute("aria-hidden", String(stacked ? false : !active));
      section.classList.toggle("is-active", active);
    });
    const progress = Math.round((nextStep / WIZARD_STEPS.length) * 100);
    dom.wizardStepLabel.textContent = `${nextStep} / ${WIZARD_STEPS.length} · ${WIZARD_STEPS[nextStep - 1]}`;
    dom.wizardProgressPercent.textContent = `${progress}%`;
    dom.wizardProgressBar.style.width = `${progress}%`;
    dom.wizardBackButton.hidden = stacked || nextStep === 1;
    dom.wizardNextButton.hidden = stacked || nextStep === WIZARD_STEPS.length;
    dom.runRecommendationButton.hidden = stacked ? false : nextStep !== WIZARD_STEPS.length;
    updateRequiredInputState({ renderReview: stacked || nextStep === WIZARD_STEPS.length });
    if (!stacked) document.querySelector(".panel-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    if (focus) {
      const heading = document.querySelector(`[data-wizard-step="${nextStep}"] .wizard-step-heading`);
      window.requestAnimationFrame(() => {
        if (stacked) heading?.scrollIntoView({ behavior: "smooth", block: "start" });
        heading?.focus({ preventScroll: true });
      });
    }
  }

  function resetRecommendationForm() {
    dom.destinationRegion.value = "";
    dom.tripIntent.value = "";
    dom.travelStartDate.value = "";
    dom.travelEndDate.value = "";
    dom.tripDurationDays.value = "";
    dom.dateUndecided.checked = false;
    dom.travelStartDate.disabled = false;
    dom.travelEndDate.disabled = false;
    dom.companionType.value = "";
    dom.transportMode.value = "";
    dom.resultLimit.value = "10";
    dom.diversityPreset.value = "balanced";
    dom.requiredPlaceSearch.value = "";
    state.requiredPlaceIds.clear();
    dom.excludedPlaceIds.value = "";
    state.selectedAnchorIds.clear();
    state.requiredValidationAttempted = false;
    state.selectedPreset = null;
    document.querySelectorAll('input[name="hardConstraint"]').forEach((input) => { input.checked = false; });
    syncChoiceCards();
    renderRequiredPlacePicker();
    showWizardStep(1, { focus: false });
    dom.requestPreview.textContent = "추천을 실행하면 입력이 표시됩니다.";
    dom.recommendationSummary.textContent = "여행 조건을 모두 고르면 여기에 추천 장소가 나타나요.";
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

  function bindEvents() {
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
  }

    return { WIZARD_STEPS, collectPreferences, requiredPlaceEligible, requiredPlaceMatches, requiredPlaceMatchRank, renderSelectedRequiredPlaces, renderRequiredPlaceSearchResults, renderRequiredPlacePicker, collectRequest, syncChoiceCards, formatWizardDate, selectedTripDays, formatTripDuration, preferenceSummary, requiredInputStates, renderReviewSummary, updateRequiredInputState, focusWizardChoice, validateWizardStep, validateWizardFlow, validateMobileWizardFlow, showWizardStep, resetRecommendationForm, showFormError, hideFormError, bindEvents };
  } };
})(window);
