/* SPEC-113 REQ-006: recommendation cards, verification candidates, day schedule and course variant output. */
(function (root) {
  "use strict";
  const domain = root.TRAVEL_DOMAIN;
  root.TRAVEL_RESULTS_VIEW = { create({ categoryFor, closeMobileRecommendationFeedbackDialog, createFeedbackBadge, createRecommendationFeedback, dom, events, formatNumber, formatScore, invalidateItinerary, metadata, openRecommendationPlace, placeById, publicResearch, recommendationFeedbackTargets, refreshMapMarkers, refreshScheduleDayHighlight, regionName, renderDetail, renderEmptyState, renderItineraryInputs, selectPlace, state, updateFeedbackSaveState, updateRequiredInputState }) {
  const LABEL_NAMES = {
    ...domain.FEATURE_LABELS,
    healing_slow: "힐링·느긋함", scenic_immersion: "경관 몰입",
    discovery_explorer: "발견·탐험", local_immersion: "로컬 몰입", iconic_highlight: "상징 하이라이트",
    photo_mood: "사진 무드", ...domain.COMPANION_LABELS,
  };

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
            events.emit("rerunRequested", {
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
          events.emit("rerunRequested", {
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

    return { createRecommendationCard, renderWarnings, renderVerificationCandidates, renderSchedule, renderCourseVariant, renderRecommendationOutput };
  } };
})(window);
