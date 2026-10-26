(function (root) {
  "use strict";
  root.TRAVEL_PREFERENCE_VIEW = { create({ clearRecommendation, closeTravelMbtiDialog, dom, hideFormError, preferenceEngine, runRecommendation, showFormError, state }) {
  function setTravelMbtiProgress(label, completed, total = preferenceEngine.QUESTIONS.length + preferenceEngine.MAX_PAIR_QUESTIONS) {
    dom.travelMbtiProgressLabel.textContent = label;
    dom.travelMbtiProgressBar.style.width = `${Math.max(0, Math.min(100, (completed / total) * 100))}%`;
  }

  function resetTravelMbtiWizard() {
    state.travelMbti = {
      phase: "question",
      questionIndex: 0,
      questionnaireAnswers: [],
      pairAnswers: [],
      currentPairId: null,
      profile: null,
    };
  }

  function startTravelMbti() {
    hideFormError();
    if (!preferenceEngine) {
      showFormError("여행 MBTI 모듈을 불러오지 못했습니다.");
      return;
    }
    resetTravelMbtiWizard();
    if (typeof dom.travelMbtiDialog.showModal === "function") dom.travelMbtiDialog.showModal();
    else dom.travelMbtiDialog.setAttribute("open", "");
    renderTravelMbtiQuestion();
  }

  function answerForQuestion(questionId) {
    return state.travelMbti.questionnaireAnswers.find((answer) => answer.questionId === questionId) || null;
  }

  function createTravelMbtiBothChoices(onSelect, selectedChoice = null) {
    const actions = document.createElement("div");
    actions.className = "mbti-both-actions";
    for (const [choice, icon, label, description] of [
      ["both_like", "♡", "둘 다 좋아요", "공통 취향을 약하게 반영"],
      ["both_dislike", "×", "둘 다 마음에 안 들어요", "공통 특성을 회피로 반영"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mbti-both-option${choice === "both_dislike" ? " is-dislike" : ""}`;
      if (selectedChoice === choice) button.classList.add("is-selected");
      const mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = icon;
      const copy = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = label;
      const small = document.createElement("small");
      small.textContent = description;
      copy.append(strong, small);
      button.append(mark, copy);
      button.addEventListener("click", () => onSelect(choice));
      actions.append(button);
    }
    return actions;
  }

  function renderTravelMbtiQuestion() {
    const wizard = state.travelMbti;
    const question = preferenceEngine.QUESTIONS[wizard.questionIndex];
    wizard.phase = "question";
    wizard.currentPairId = null;
    setTravelMbtiProgress(`상황 질문 ${wizard.questionIndex + 1} / ${preferenceEngine.QUESTIONS.length}`, wizard.questionIndex);
    dom.travelMbtiFooter.hidden = false;
    dom.travelMbtiBackButton.hidden = false;
    dom.travelMbtiBackButton.disabled = wizard.questionIndex === 0;
    dom.travelMbtiSkipButton.hidden = false;
    dom.travelMbtiSkipButton.textContent = "이 질문 건너뛰기";

    const kicker = document.createElement("p");
    kicker.className = "mbti-stage-kicker";
    kicker.textContent = "01 · QUICK QUESTIONS";
    const title = document.createElement("h3");
    title.className = "mbti-question-title";
    title.textContent = question.prompt;
    const help = document.createElement("p");
    help.className = "mbti-question-help";
    help.textContent = "정답은 없어요. 한쪽을 고르거나 두 장면에 대한 마음을 그대로 알려주세요.";
    const grid = document.createElement("div");
    grid.className = "mbti-option-grid";
    const previous = answerForQuestion(question.id);
    for (const option of question.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mbti-option";
      if (previous?.optionId === option.id) button.classList.add("is-selected");
      const icon = document.createElement("span");
      icon.className = "mbti-option-icon";
      icon.textContent = option.icon;
      const label = document.createElement("strong");
      label.textContent = option.label;
      const note = document.createElement("small");
      note.textContent = option.id === "a" ? "선택 A" : "선택 B";
      button.append(icon, label, note);
      button.addEventListener("click", () => recordTravelMbtiQuestion(option.id));
      grid.append(button);
    }
    const bothChoices = createTravelMbtiBothChoices(recordTravelMbtiQuestion, previous?.optionId);
    dom.travelMbtiBody.replaceChildren(kicker, title, help, grid, bothChoices);
    window.requestAnimationFrame(() => grid.querySelector("button")?.focus({ preventScroll: true }));
  }

  function recordTravelMbtiQuestion(optionId) {
    const wizard = state.travelMbti;
    const question = preferenceEngine.QUESTIONS[wizard.questionIndex];
    wizard.questionnaireAnswers = wizard.questionnaireAnswers.filter((answer) => answer.questionId !== question.id);
    wizard.questionnaireAnswers.push({ questionId: question.id, optionId });
    wizard.questionIndex += 1;
    if (wizard.questionIndex < preferenceEngine.QUESTIONS.length) renderTravelMbtiQuestion();
    else renderNextTravelMbtiPair();
  }

  function renderNextTravelMbtiPair(forcedPairId = null) {
    const wizard = state.travelMbti;
    wizard.phase = "pair";
    wizard.profile = preferenceEngine.estimateProfile(wizard.questionnaireAnswers, wizard.pairAnswers);
    if (wizard.pairAnswers.length >= preferenceEngine.MAX_PAIR_QUESTIONS) {
      renderTravelMbtiResult();
      return;
    }
    const candidate = forcedPairId
      ? { pair: preferenceEngine.PAIRS.find((pair) => pair.id === forcedPairId) }
      : preferenceEngine.nextAdaptivePair(wizard.profile, wizard.pairAnswers.map((answer) => answer.pairId));
    if (!candidate?.pair) {
      renderTravelMbtiResult();
      return;
    }
    const pair = candidate.pair;
    wizard.currentPairId = pair.id;
    const pairNumber = wizard.pairAnswers.length + 1;
    setTravelMbtiProgress(`가상 여행지 선택 ${pairNumber} / ${preferenceEngine.MAX_PAIR_QUESTIONS}`, preferenceEngine.QUESTIONS.length + wizard.pairAnswers.length);
    dom.travelMbtiFooter.hidden = false;
    dom.travelMbtiBackButton.hidden = false;
    dom.travelMbtiBackButton.disabled = false;
    dom.travelMbtiSkipButton.hidden = false;
    dom.travelMbtiSkipButton.textContent = "이 비교 건너뛰기";

    const kicker = document.createElement("p");
    kicker.className = "mbti-stage-kicker";
    kicker.textContent = "02 · TASTE CHECK";
    const title = document.createElement("h3");
    title.className = "mbti-question-title";
    title.textContent = "두 가상 여행지에 대한 마음은 어떤가요?";
    const note = document.createElement("div");
    note.className = "mbti-virtual-note";
    note.textContent = "✦ 실제 장소가 아닌 취향 확인용 가상 여행지입니다";
    const grid = document.createElement("div");
    grid.className = "mbti-pair-grid";
    for (const [choice, card, labelText] of [["a", pair.cardA, "가상 여행지 A"], ["b", pair.cardB, "가상 여행지 B"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mbti-place-card";
      const label = document.createElement("span");
      label.className = "mbti-place-card-label";
      label.textContent = labelText;
      const icon = document.createElement("span");
      icon.className = "mbti-place-icon";
      icon.textContent = card.icon;
      const name = document.createElement("strong");
      name.textContent = card.title;
      const description = document.createElement("small");
      description.textContent = card.description;
      button.append(label, icon, name, description);
      button.addEventListener("click", () => recordTravelMbtiPair(choice));
      grid.append(button);
    }
    const bothChoices = createTravelMbtiBothChoices(recordTravelMbtiPair);
    dom.travelMbtiBody.replaceChildren(kicker, title, note, grid, bothChoices);
    window.requestAnimationFrame(() => grid.querySelector("button")?.focus({ preventScroll: true }));
  }

  function recordTravelMbtiPair(choice) {
    const wizard = state.travelMbti;
    if (!wizard.currentPairId) return;
    wizard.pairAnswers = wizard.pairAnswers.filter((answer) => answer.pairId !== wizard.currentPairId);
    wizard.pairAnswers.push({ pairId: wizard.currentPairId, choice });
    wizard.currentPairId = null;
    renderNextTravelMbtiPair();
  }

  function featureChip(feature, avoid = false) {
    const chip = document.createElement("span");
    chip.className = `mbti-feature-chip${avoid ? " is-avoid" : ""}`;
    chip.textContent = `${avoid ? "낮은 쪽 선호 · " : ""}${preferenceEngine.FEATURE_LABELS[feature] || feature}`;
    return chip;
  }

  function renderTravelMbtiResult() {
    const wizard = state.travelMbti;
    wizard.phase = "result";
    wizard.currentPairId = null;
    wizard.profile = preferenceEngine.estimateProfile(wizard.questionnaireAnswers, wizard.pairAnswers);
    const profile = wizard.profile;
    const summary = profile.displaySummary;
    const preferences = preferenceEngine.materializePreferences(profile);
    setTravelMbtiProgress("여행 MBTI 완성", preferenceEngine.QUESTIONS.length + preferenceEngine.MAX_PAIR_QUESTIONS);
    dom.travelMbtiFooter.hidden = true;

    const hero = document.createElement("section");
    hero.className = "mbti-result-hero";
    const code = document.createElement("p");
    code.className = "mbti-type-code";
    code.textContent = summary.archetypeId;
    const name = document.createElement("h3");
    name.textContent = summary.archetypeName;
    const description = document.createElement("p");
    description.textContent = summary.description;
    const emoji = document.createElement("span");
    emoji.className = "mbti-result-emoji";
    emoji.textContent = summary.emoji;
    hero.append(code, name, description, emoji);

    const axisGrid = document.createElement("div");
    axisGrid.className = "mbti-axis-grid";
    for (const axis of summary.axes) {
      const card = document.createElement("div");
      card.className = "mbti-axis-card";
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = axis.name;
      const value = document.createElement("strong");
      value.textContent = `${axis.code} · ${axis.label}`;
      row.append(label, value);
      const meter = document.createElement("div");
      meter.className = "mbti-axis-meter";
      const fill = document.createElement("span");
      fill.style.width = `${Math.max(8, axis.confidence * 100)}%`;
      meter.append(fill);
      card.append(row, meter);
      axisGrid.append(card);
    }

    const featureSection = document.createElement("section");
    featureSection.className = "mbti-result-section";
    const featureTitle = document.createElement("h4");
    featureTitle.textContent = "추천에 반영할 핵심 취향";
    const chips = document.createElement("div");
    chips.className = "mbti-feature-chips";
    for (const feature of summary.topPreferences) chips.append(featureChip(feature));
    for (const feature of summary.topAvoidances) chips.append(featureChip(feature, true));
    featureSection.append(featureTitle, chips);

    const actions = document.createElement("div");
    actions.className = "mbti-result-actions";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "button button-primary";
    apply.textContent = "이 취향 적용하기";
    apply.disabled = !preferences.length;
    apply.addEventListener("click", applyTravelMbtiProfile);
    const share = document.createElement("button");
    share.type = "button";
    share.className = "button button-secondary";
    share.textContent = "결과 문구 복사";
    share.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(preferenceEngine.publicShareText(profile));
        share.textContent = "복사했어요";
      } catch (_error) {
        share.textContent = "복사 권한을 확인해 주세요";
      }
    });
    const restart = document.createElement("button");
    restart.type = "button";
    restart.className = "travel-mbti-skip";
    restart.textContent = "다시 하기";
    restart.addEventListener("click", () => { resetTravelMbtiWizard(); renderTravelMbtiQuestion(); });
    actions.append(apply, share, restart);

    const content = [hero, axisGrid, featureSection];
    if (!preferences.length) {
      const warning = document.createElement("p");
      warning.className = "mbti-empty-warning";
      warning.textContent = "중립이거나 건너뛴 답변이 많아 추천에 적용할 취향 신호가 부족해요. 다시 검사해 주세요.";
      content.push(warning);
    }
    content.push(actions);
    dom.travelMbtiBody.replaceChildren(...content);
    window.requestAnimationFrame(() => apply.focus({ preventScroll: true }));
  }

  function renderAppliedTravelMbti() {
    const summary = state.preferenceProfile?.displaySummary;
    dom.preferenceStepTitle.textContent = summary ? "여행 MBTI가 적용됐어요" : "여행 MBTI를 검사해 볼까요?";
    dom.travelMbtiLaunch.hidden = Boolean(summary);
    dom.travelMbtiApplied.hidden = !summary;
    if (!summary) return;
    dom.travelMbtiAppliedType.textContent = summary.archetypeId;
    dom.travelMbtiAppliedName.textContent = summary.archetypeName;
    const labels = summary.topPreferences.map((feature) => preferenceEngine.FEATURE_LABELS[feature] || feature);
    dom.travelMbtiAppliedSummary.textContent = labels.length ? `추천 반영: ${labels.join(" · ")}` : summary.description;
  }

  function applyTravelMbtiProfile() {
    const profile = state.travelMbti.profile;
    const preferences = preferenceEngine.materializePreferences(profile);
    if (!preferences.length) return;
    state.preferenceProfile = profile;
    state.selectedPreset = "travel_mbti";
    renderAppliedTravelMbti();
    hideFormError();
    closeTravelMbtiDialog();
    clearRecommendation("여행 MBTI 취향을 적용했습니다. 마지막 확인에서 추천을 실행해 주세요.");
  }

  function clearTravelMbtiProfile({ run = false } = {}) {
    state.preferenceProfile = null;
    state.selectedPreset = null;
    renderAppliedTravelMbti();
    if (run) {
      clearRecommendation("여행 MBTI 개인화를 해제했습니다.");
      runRecommendation({ fit: true, openOutput: false });
    } else {
      clearRecommendation("여행 MBTI 개인화를 해제했습니다. 취향을 다시 선택해 주세요.");
    }
  }

  function travelMbtiBack() {
    const wizard = state.travelMbti;
    if (wizard.phase === "question") {
      if (!wizard.questionIndex) return;
      wizard.questionIndex -= 1;
      const questionId = preferenceEngine.QUESTIONS[wizard.questionIndex].id;
      wizard.questionnaireAnswers = wizard.questionnaireAnswers.filter((answer) => answer.questionId !== questionId);
      renderTravelMbtiQuestion();
      return;
    }
    const previousPair = wizard.pairAnswers.pop();
    if (previousPair) {
      renderNextTravelMbtiPair(previousPair.pairId);
      return;
    }
    wizard.questionIndex = preferenceEngine.QUESTIONS.length - 1;
    const questionId = preferenceEngine.QUESTIONS[wizard.questionIndex].id;
    wizard.questionnaireAnswers = wizard.questionnaireAnswers.filter((answer) => answer.questionId !== questionId);
    renderTravelMbtiQuestion();
  }

    return { setTravelMbtiProgress, resetTravelMbtiWizard, startTravelMbti, answerForQuestion, createTravelMbtiBothChoices, renderTravelMbtiQuestion, recordTravelMbtiQuestion, renderNextTravelMbtiPair, recordTravelMbtiPair, featureChip, renderTravelMbtiResult, renderAppliedTravelMbti, applyTravelMbtiProfile, clearTravelMbtiProfile, travelMbtiBack };
  } };
})(window);
