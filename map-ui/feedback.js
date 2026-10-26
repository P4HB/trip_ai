/* SPEC-111: feedback.js */
(function (root) {
  "use strict";
  root.TRAVEL_FEEDBACK = { create({ state, dom, placeById, algorithm, FEEDBACK_OPTIONS, closeMobileRecommendationFeedbackDialog, clearSelection, openOutputPanel }) {
  const widgets = new Map(), badges = new Map();
  function register(registry, key, element) {
    if (!registry.has(key)) registry.set(key, new Set());
    registry.get(key).add(element);
  }
  const observer = new MutationObserver(() => {
    for (const registry of [widgets, badges]) for (const [key, nodes] of registry) {
      for (const node of nodes) if (!node.isConnected) nodes.delete(node);
      if (!nodes.size) registry.delete(key);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function hasFeedbackScore(entry) {
    return Number.isInteger(entry?.score) && entry.score >= 1 && entry.score <= 5;
  }

  function updateFeedbackBadge(badge, entry) {
    const rated = hasFeedbackScore(entry);
    const completed = rated && entry.completed === true;
    badge.textContent = completed ? `✓ 평가 완료 · ${entry.score}점`
      : rated ? `${entry.score}점 · 완료 전` : "미평가";
    badge.classList.toggle("is-completed", completed);
    badge.classList.toggle("is-rated", rated && !completed);
  }

  function createFeedbackBadge(placeId) {
    const badge = document.createElement("span");
    badge.className = "recommendation-feedback-badge";
    badge.dataset.feedbackBadgePlaceId = String(placeId);
    badge.setAttribute("aria-live", "polite");
    updateFeedbackBadge(badge, state.recommendationFeedback.get(String(placeId)));
    register(badges, String(placeId), badge);
    return badge;
  }

  function completeRecommendationFeedback(feedbackKey, contextKey) {
    const current = state.recommendationFeedback.get(feedbackKey);
    if (!hasFeedbackScore(current)) return;
    state.recommendationFeedback.set(feedbackKey, { ...current, completed: true });
    syncRecommendationFeedback(feedbackKey);
    scheduleFeedbackAutoSave(0);
    if (contextKey === "mobile-dialog") closeMobileRecommendationFeedbackDialog();
    else if (contextKey === "mobile-detail") {
      clearSelection();
      openOutputPanel();
    }
  }

  function syncRecommendationFeedback(feedbackKey, sourceInput = null) {
    const current = state.recommendationFeedback.get(feedbackKey) || { score: null, comment: "" };
    for (const feedback of (widgets.get(feedbackKey) || [])) {
      if (feedback.dataset.feedbackPlaceId !== feedbackKey) continue;
      for (const control of feedback.querySelectorAll(".recommendation-feedback-option")) {
        control.setAttribute("aria-pressed", String(Number(control.dataset.score) === current.score));
      }
      const status = feedback.querySelector(".recommendation-feedback-status");
      if (status) {
        status.textContent = current.score
          ? `${current.score}점 · ${FEEDBACK_OPTIONS[current.score - 1].label}`
          : "";
      }
      const completeButton = feedback.querySelector(".recommendation-feedback-complete");
      if (completeButton) completeButton.hidden = !hasFeedbackScore(current);
      const commentInput = feedback.querySelector("textarea");
      if (commentInput && commentInput !== sourceInput && commentInput.value !== current.comment) {
        commentInput.value = current.comment;
      }
      const commentCount = feedback.querySelector(".recommendation-feedback-count");
      if (commentCount) commentCount.textContent = `${current.comment.length}/300`;
    }
    for (const badge of (badges.get(feedbackKey) || [])) {
      if (badge.dataset.feedbackBadgePlaceId === feedbackKey) updateFeedbackBadge(badge, current);
    }
  }

  function recommendationFeedbackTargets(result = state.recommendationResult, includeHistory = false) {
    const targets = new Map();
    const addContext = (placeId, title, context) => {
      const key = String(placeId);
      if (!targets.has(key)) targets.set(key, { placeId: key, title: title || placeById.get(key)?.title || "", contexts: [] });
      const target = targets.get(key);
      const contextKey = JSON.stringify(context);
      if (!target.contexts.some((item) => JSON.stringify(item) === contextKey)) target.contexts.push(context);
    };
    for (const item of result?.items || []) {
      addContext(item.placeId, placeById.get(String(item.placeId))?.title, { kind: "recommendation", rank: item.rank });
    }
    for (const day of result?.schedule?.dayClusters || []) {
      for (const item of day.places || []) {
        addContext(item.placeId, item.title, {
          kind: "schedule",
          dayIndex: day.dayIndex,
          date: day.date || null,
          role: item.role,
        });
      }
    }
    if (includeHistory) {
      for (const [key, target] of state.feedbackTargetHistory) {
        const entry = state.recommendationFeedback.get(key);
        if (!targets.has(key) && (hasFeedbackScore(entry) || entry?.comment)) targets.set(key, target);
      }
    }
    return [...targets.values()];
  }

  function recommendationFeedbackCompletion(targets = recommendationFeedbackTargets()) {
    const completed = targets.filter((target) => {
      const score = state.recommendationFeedback.get(target.placeId)?.score;
      return Number.isInteger(score) && score >= 1 && score <= 5;
    }).length;
    return { completed, total: targets.length, allCompleted: targets.length > 0 && completed === targets.length };
  }

  function participantNameValue() {
    return dom.participantName.value.trim();
  }

  function feedbackHasUserInput() {
    return [...state.recommendationFeedback.values()].some((entry) =>
      (Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 5) || Boolean(entry.comment),
    );
  }

  function updateParticipantNameState() {
    const hasResult = Boolean(state.recommendationResult);
    const name = participantNameValue();
    const waiting = hasResult && feedbackHasUserInput() && !name && state.feedbackAutoSave.savedRevision === 0;
    dom.participantNamePanel.hidden = !hasResult;
    dom.participantNamePanel.classList.toggle("is-waiting", waiting);
    dom.participantName.setAttribute("aria-invalid", String(waiting));
    if (!hasResult) dom.participantNameStatus.textContent = "";
    else if (name) dom.participantNameStatus.textContent = `${name.length}/30자 · 평가 로그에 함께 저장됩니다.`;
    else if (waiting) dom.participantNameStatus.textContent = "이름 또는 별칭을 입력하면 보류 중인 평가가 저장됩니다.";
    else dom.participantNameStatus.textContent = "이름 또는 별칭을 입력해 주세요.";
  }

  function resetFeedbackAutoSave({ createSession = false } = {}) {
    const previous = state.feedbackAutoSave;
    if (previous.timerId) window.clearTimeout(previous.timerId);
    previous.timerId = null;
    // The outgoing snapshot is already captured. Let its request/retry finish independently.
    if (previous.pendingPayload) void flushFeedbackAutoSave(previous);
    state.feedbackAutoSave = {
      sessionId: createSession ? crypto.randomUUID() : null,
      createdAt: createSession ? new Date().toISOString() : null,
      revision: 0,
      savedRevision: 0,
      status: "idle",
      timerId: null,
      retryAttempt: 0,
      inFlight: false,
      controller: null,
      pendingPayload: null,
      error: "",
    };
  }

  function updateFeedbackSaveState() {
    const completion = recommendationFeedbackCompletion();
    const hasTargets = Boolean(state.recommendationResult) && completion.total > 0;
    const autosave = state.feedbackAutoSave;
    const participantName = participantNameValue();
    updateParticipantNameState();
    dom.feedbackSavePanel.hidden = !hasTargets;
    dom.feedbackCompletionStatus.textContent = `만족도 ${completion.completed}/${completion.total} 완료`;
    if (!hasTargets) dom.feedbackSaveHelp.textContent = "";
    else if (!participantName && feedbackHasUserInput() && autosave.savedRevision === 0) dom.feedbackSaveHelp.textContent = "이름 또는 별칭 입력을 기다리고 있습니다.";
    else if (autosave.status === "saved") dom.feedbackSaveHelp.textContent = `서버에 자동 저장됨 · ${autosave.savedRevision}번째 변경`;
    else if (autosave.status === "saving") dom.feedbackSaveHelp.textContent = "서버에 자동 저장 중…";
    else if (autosave.status === "pending") dom.feedbackSaveHelp.textContent = "변경 내용을 곧 자동 저장합니다.";
    else if (autosave.status === "failed") dom.feedbackSaveHelp.textContent = `${autosave.error} 자동으로 다시 시도합니다.`;
    else dom.feedbackSaveHelp.textContent = "만족도를 선택하거나 의견을 입력하면 서버에 자동 저장됩니다.";
  }

  function cloneForFeedbackLog(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function buildFeedbackLog(revision = state.feedbackAutoSave.revision) {
    const targets = recommendationFeedbackTargets(state.recommendationResult, true);
    const completion = recommendationFeedbackCompletion(targets);
    const autosave = state.feedbackAutoSave;
    if (!state.recommendationResult || !autosave.sessionId || !autosave.createdAt || revision < 1) {
      throw new Error("자동 저장할 추천 세션이 없습니다.");
    }
    const result = cloneForFeedbackLog(state.recommendationResult);
    return {
      schema_version: "travel-recommendation-feedback-log-v3",
      participant_name: participantNameValue() || null,
      session_id: autosave.sessionId,
      revision,
      created_at: autosave.createdAt,
      updated_at: new Date().toISOString(),
      storage: {
        method: "server_autosave",
        endpoint: "/travel/api/feedback",
        server_transmitted: true,
        web_storage_used: false,
      },
      source: {
        ui_version: "map-ui-feedback-autosave-v3",
        algorithm_version: algorithm.ALGORITHM_VERSION,
        provenance: cloneForFeedbackLog(result.provenance || null),
      },
      user_selections: {
        request: cloneForFeedbackLog(result.request),
        selected_preset: state.selectedPreset,
        travel_mbti: {
          questionnaire_answers: cloneForFeedbackLog(state.travelMbti.questionnaireAnswers),
          pair_answers: cloneForFeedbackLog(state.travelMbti.pairAnswers),
          generated_profile: cloneForFeedbackLog(state.travelMbti.profile),
          applied_profile: cloneForFeedbackLog(state.preferenceProfile),
        },
        variant_session: {
          fingerprint: state.variantSession.fingerprint,
          shown_variant_ids: [...state.variantSession.shownVariantIds],
          current_variant_id: state.variantSession.currentVariantId,
          current_place_ids: [...state.variantSession.currentPlaceIds],
          reroll_index: state.variantSession.rerollIndex,
          last_transition: cloneForFeedbackLog(state.variantSession.lastTransition),
        },
      },
      recommendation_result: result,
      feedback: {
        required_place_count: completion.total,
        completed_place_count: completion.completed,
        all_scores_completed: completion.allCompleted,
        entries: targets.map((target) => {
          const entry = state.recommendationFeedback.get(target.placeId) || { score: null, comment: "" };
          const score = Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 5 ? entry.score : null;
          return {
            place_id: target.placeId,
            title: target.title,
            contexts: cloneForFeedbackLog(target.contexts),
            score,
            score_label: score === null ? null : FEEDBACK_OPTIONS[score - 1].label,
            comment: entry.comment || "",
          };
        }),
      },
    };
  }

  function scheduleFeedbackAutoSave(delayMs = 0, { allowBlankParticipant = false } = {}) {
    const autosave = state.feedbackAutoSave;
    if (!state.recommendationResult || !autosave.sessionId) return;
    if (!participantNameValue() && !allowBlankParticipant) {
      if (autosave.timerId) window.clearTimeout(autosave.timerId);
      autosave.timerId = null;
      if (!autosave.inFlight) {
        autosave.revision = autosave.savedRevision;
        autosave.pendingPayload = null;
      }
      autosave.status = "awaiting_name";
      autosave.error = "";
      updateFeedbackSaveState();
      return;
    }
    autosave.revision += 1;
    autosave.status = "pending";
    autosave.retryAttempt = 0;
    autosave.pendingPayload = buildFeedbackLog(autosave.revision);
    autosave.error = "";
    if (autosave.timerId) window.clearTimeout(autosave.timerId);
    autosave.timerId = window.setTimeout(() => flushFeedbackAutoSave(autosave), delayMs);
    updateFeedbackSaveState();
  }

  function queueFeedbackAutoSaveRetry(autosave) {
    if (autosave.timerId) return;
    const delayMs = Math.min(15000, 2000 * (2 ** Math.min(Math.max(autosave.retryAttempt - 1, 0), 3)));
    autosave.timerId = window.setTimeout(() => flushFeedbackAutoSave(autosave), delayMs);
  }

  async function flushFeedbackAutoSave(autosave = state.feedbackAutoSave) {
    if (!autosave.sessionId) return;
    autosave.timerId = null;
    if (autosave.inFlight) return;
    if (autosave.revision <= autosave.savedRevision) {
      autosave.status = autosave.savedRevision ? "saved" : "idle";
      updateFeedbackSaveState();
      return;
    }
    const sendingRevision = autosave.revision;
    const log = autosave.pendingPayload?.revision === sendingRevision
      ? autosave.pendingPayload
      : state.feedbackAutoSave === autosave ? buildFeedbackLog(sendingRevision) : null;
    if (!log) return;
    autosave.pendingPayload = log;
    autosave.inFlight = true;
    autosave.status = "saving";
    autosave.controller = new AbortController();
    const timeoutId = window.setTimeout(() => autosave.controller?.abort(), 15000);
    updateFeedbackSaveState();
    try {
      const response = await fetch("/travel/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
        credentials: "omit",
        signal: autosave.controller.signal,
      });
      const receipt = await response.json().catch(() => null);
      if (!response.ok || !receipt?.ok) {
        throw new Error(receipt?.error ? `서버 저장에 실패했습니다 (${receipt.error}).` : `서버 저장에 실패했습니다 (HTTP ${response.status}).`);
      }
      if (receipt.session_id !== log.session_id) throw new Error("서버 영수증의 세션 ID가 일치하지 않습니다.");
      if (!Number.isInteger(receipt.revision) || receipt.revision < sendingRevision) throw new Error("서버 저장 버전을 확인할 수 없습니다.");
      autosave.savedRevision = Math.max(autosave.savedRevision, receipt.revision);
      autosave.retryAttempt = 0;
      autosave.error = "";
      if (autosave.revision <= autosave.savedRevision) {
        autosave.status = "saved";
        autosave.pendingPayload = null;
      } else autosave.status = "pending";
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "서버 응답 시간이 초과되었습니다."
        : error instanceof Error ? error.message : "자동 저장하지 못했습니다.";
      autosave.status = "failed";
      autosave.error = message;
      autosave.retryAttempt += 1;
    } finally {
      window.clearTimeout(timeoutId);
      autosave.inFlight = false;
      autosave.controller = null;
      if (autosave.status === "failed") queueFeedbackAutoSaveRetry(autosave);
      else if (autosave.revision > autosave.savedRevision && !autosave.timerId) {
        autosave.timerId = window.setTimeout(() => flushFeedbackAutoSave(autosave), 0);
      }
      updateFeedbackSaveState();
    }
  }

  function createRecommendationFeedback(place, contextKey) {
    const feedbackKey = String(place.id);
    const selectedFeedback = state.recommendationFeedback.get(feedbackKey) || { score: null, comment: "" };
    const feedback = document.createElement("section");
    feedback.className = "recommendation-feedback";
    feedback.dataset.feedbackPlaceId = feedbackKey;
    feedback.setAttribute("aria-label", `${place.title} 추천 만족도`);
    const feedbackHeading = document.createElement("strong");
    feedbackHeading.textContent = "이 추천, 얼마나 마음에 드나요? (점수 필수)";
    const feedbackScale = document.createElement("div");
    feedbackScale.className = "recommendation-feedback-scale";
    feedbackScale.setAttribute("role", "group");
    feedbackScale.setAttribute("aria-label", "1점부터 5점까지 선택");
    const feedbackStatus = document.createElement("span");
    feedbackStatus.className = "recommendation-feedback-status";
    feedbackStatus.setAttribute("aria-live", "polite");
    for (const option of FEEDBACK_OPTIONS) {
      const feedbackButton = document.createElement("button");
      feedbackButton.type = "button";
      feedbackButton.className = "recommendation-feedback-option";
      feedbackButton.dataset.score = String(option.score);
      feedbackButton.textContent = String(option.score);
      feedbackButton.title = option.label;
      feedbackButton.setAttribute("aria-label", `${option.score}점, ${option.label}`);
      feedbackButton.setAttribute("aria-pressed", String(selectedFeedback.score === option.score));
      feedbackButton.addEventListener("click", () => {
        const current = state.recommendationFeedback.get(feedbackKey) || { score: null, comment: "" };
        if (current.score === option.score) return;
        state.recommendationFeedback.set(feedbackKey, { ...current, score: option.score, completed: false });
        syncRecommendationFeedback(feedbackKey);
        scheduleFeedbackAutoSave(0);
      });
      feedbackScale.append(feedbackButton);
    }
    const feedbackEnds = document.createElement("div");
    feedbackEnds.className = "recommendation-feedback-ends";
    feedbackEnds.innerHTML = "<span>전혀 안 끌려요</span><span>꼭 가고 싶어요</span>";
    if (selectedFeedback.score) {
      feedbackStatus.textContent = `${selectedFeedback.score}점 · ${FEEDBACK_OPTIONS[selectedFeedback.score - 1].label}`;
    }
    const comment = document.createElement("div");
    comment.className = "recommendation-feedback-comment";
    const commentLabel = document.createElement("label");
    const safeContext = String(contextKey).replace(/[^a-z0-9_-]/giu, "-");
    const commentId = `recommendation-comment-${safeContext}-${place.id}`;
    const countId = `${commentId}-count`;
    commentLabel.htmlFor = commentId;
    commentLabel.textContent = "의견을 자유롭게 남겨주세요 (선택)";
    const commentInput = document.createElement("textarea");
    commentInput.id = commentId;
    commentInput.rows = 3;
    commentInput.maxLength = 300;
    commentInput.placeholder = "좋았던 점이나 아쉬운 점을 적어주세요.";
    commentInput.value = selectedFeedback.comment;
    commentInput.setAttribute("aria-label", `${place.title} 추천 의견`);
    commentInput.setAttribute("aria-describedby", countId);
    const commentCount = document.createElement("span");
    commentCount.id = countId;
    commentCount.className = "recommendation-feedback-count";
    commentCount.textContent = `${commentInput.value.length}/300`;
    commentInput.addEventListener("input", () => {
      const current = state.recommendationFeedback.get(feedbackKey) || { score: null, comment: "" };
      state.recommendationFeedback.set(feedbackKey, { ...current, comment: commentInput.value, completed: false });
      syncRecommendationFeedback(feedbackKey, commentInput);
      scheduleFeedbackAutoSave(800);
    });
    comment.append(commentLabel, commentInput, commentCount);
    const completeButton = document.createElement("button");
    completeButton.type = "button";
    completeButton.className = "recommendation-feedback-complete";
    completeButton.textContent = "완료";
    completeButton.hidden = !hasFeedbackScore(selectedFeedback);
    completeButton.addEventListener("click", () => completeRecommendationFeedback(feedbackKey, contextKey));
    feedback.append(feedbackHeading, feedbackScale, feedbackEnds, feedbackStatus, comment, completeButton);
    register(widgets, feedbackKey, feedback);
    return feedback;
  }


    return { hasFeedbackScore, updateFeedbackBadge, createFeedbackBadge, completeRecommendationFeedback, syncRecommendationFeedback, recommendationFeedbackTargets, recommendationFeedbackCompletion, participantNameValue, feedbackHasUserInput, updateParticipantNameState, resetFeedbackAutoSave, updateFeedbackSaveState, cloneForFeedbackLog, buildFeedbackLog, scheduleFeedbackAutoSave, queueFeedbackAutoSaveRetry, flushFeedbackAutoSave, createRecommendationFeedback };
  } };
})(window);
