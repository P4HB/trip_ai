(function startReviewApp() {
  "use strict";

  const model = globalThis.TRIP_AI_REVIEW_MODEL;
  const datasetElement = document.getElementById("review-dataset");
  if (!model || !datasetElement) throw new Error("검수 화면 초기화 정보가 없습니다.");

  const dataset = JSON.parse(datasetElement.textContent);
  const storageKey = model.createStorageKey(dataset);
  const uiStorageKey = `${storageKey}:ui`;
  const typeNames = { "12": "관광지", "14": "문화시설", "15": "축제", "28": "레포츠" };
  const regionNames = { "110": "제주시", "130": "서귀포시" };
  const statusNames = {
    unreviewed: "미검토",
    in_progress: "작성 중",
    approved_as_is: "AI 원안 승인",
    approved_with_changes: "수정 후 승인",
    needs_research: "추가 조사",
    skipped: "건너뜀",
  };
  const researchStatusNames = {
    matched: "장소 일치 확인",
    uncertain: "식별·현재 상태 주의",
    not_found: "상세 근거 미확인",
  };
  const sourceTypeNames = {
    official_tourism: "공식 관광",
    public_agency: "공공기관",
    official_operator: "공식 운영자",
    heritage: "국가유산",
    reputable_secondary: "관광 상세 자료",
  };
  const researchFactLabels = {
    environment: "공간 성격",
    typical_visit: "대표 방문 경험",
    walking: "걷기·이동",
    stairs_slopes: "계단·경사",
    stroller_wheelchair: "유모차·휠체어 단서",
    seating_restroom: "좌석·화장실",
    kids: "아이 동반 단서",
    seniors: "부모님 동반 단서",
    rain: "비 영향",
    wind: "바람 영향",
    heat: "더위 영향",
    cold: "추위 영향",
    seasonality: "계절 특징",
    availability: "운영·행사 제약",
  };
  const axisInfo = {
    solo: ["혼자", "성인 1인이 자연스럽고 안전하게 방문하기 좋은가"],
    couple: ["커플", "성인 2인이 분위기와 경험을 함께 누리기 좋은가"],
    friends: ["친구", "2~5인이 함께 활동하고 머물기 좋은가"],
    kids: ["아이 동반", "보행 가능한 만 4~12세의 흥미·안전·편의가 적절한가"],
    parents: ["부모님", "평균 보행이 가능한 60대 이상에게 부담이 적절한가"],
  };
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const priorityNames = { low: "낮음", medium: "중간", high: "높음" };
  const inferenceNames = {
    direct_evidence: "웹 직접 근거",
    researched_inference: "조사 사실 추론",
    archetype_prior: "장소 유형 사전값",
    climate_heuristic: "기후평년 휴리스틱",
    not_applicable: "날짜 종속 N/A",
  };
  const labelOptions = [null, 0, 0.25, 0.5, 0.75, 1];
  const labelText = new Map([
    ["null", "미정"],
    ["0", "0 · 부적합"],
    ["0.25", "0.25 · 낮음"],
    ["0.5", "0.5 · 보통"],
    ["0.75", "0.75 · 좋음"],
    ["1", "1 · 매우 좋음"],
  ]);

  const refs = {
    progress: document.getElementById("review-progress"),
    progressLabel: document.getElementById("progress-label"),
    progressDetail: document.getElementById("progress-detail"),
    saveState: document.getElementById("save-state"),
    storageBanner: document.getElementById("storage-banner"),
    sidebar: document.getElementById("review-sidebar"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    mobileListButton: document.getElementById("mobile-list-button"),
    mobileClose: document.getElementById("mobile-close"),
    search: document.getElementById("place-search"),
    statusFilter: document.getElementById("status-filter"),
    typeFilter: document.getElementById("type-filter"),
    priorityFilter: document.getElementById("priority-filter"),
    noSourceFilter: document.getElementById("no-source-filter"),
    companionNullFilter: document.getElementById("companion-null-filter"),
    monthNullFilter: document.getElementById("month-null-filter"),
    changedFilter: document.getElementById("changed-filter"),
    clearFilters: document.getElementById("clear-filters"),
    listSummary: document.getElementById("list-summary"),
    placeList: document.getElementById("place-list"),
    reviewMain: document.getElementById("review-main"),
    reviewContainer: document.getElementById("review-container"),
    bulkApproveButton: document.getElementById("bulk-approve-button"),
    bulkApproveMediumButton: document.getElementById("bulk-approve-medium-button"),
    importButton: document.getElementById("import-button"),
    importFile: document.getElementById("import-file"),
    exportButton: document.getElementById("export-button"),
    resetAllButton: document.getElementById("reset-all-button"),
    toast: document.getElementById("toast"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalKicker: document.getElementById("modal-kicker"),
    modalTitle: document.getElementById("modal-title"),
    modalMessage: document.getElementById("modal-message"),
    modalCancel: document.getElementById("modal-cancel"),
    modalConfirm: document.getElementById("modal-confirm"),
  };

  let storageAvailable = canUseStorage();
  let bundle = loadInitialBundle();
  let filters = loadUiState();
  let currentId = filters.current_id && dataset.items.some((item) => item.contentid === filters.current_id)
    ? filters.current_id
    : dataset.items[0].contentid;
  let saveTimer = null;
  let toastTimer = null;
  let modalAction = null;
  let modalReturnFocus = null;
  let pendingImport = null;

  applyFilterControls();
  bindStaticEvents();
  syncCurrentToVisible();
  renderAll();

  function canUseStorage() {
    try {
      const probe = `${storageKey}:probe`;
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    } catch {
      refs.storageBanner.hidden = false;
      return false;
    }
  }

  function loadInitialBundle() {
    if (!storageAvailable) return model.createBundle(dataset);
    const loaded = model.loadBundle(localStorage, storageKey, dataset);
    if (loaded.ok && loaded.bundle) return loaded.bundle;
    if (!loaded.ok) {
      refs.storageBanner.hidden = false;
      refs.storageBanner.textContent = `저장된 검수 내용을 복원하지 못했습니다. 새 세션으로 시작합니다. (${loaded.reason})`;
    }
    return model.createBundle(dataset);
  }

  function defaultFilters() {
    return {
      query: "",
      status: "all",
      type: "all",
      priority: "all",
      no_source: false,
      companion_null: false,
      month_null: false,
      changed: false,
      current_id: null,
    };
  }

  function loadUiState() {
    const fallback = defaultFilters();
    if (!storageAvailable) return fallback;
    try {
      const parsed = JSON.parse(localStorage.getItem(uiStorageKey) ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
      return {
        query: typeof parsed.query === "string" ? parsed.query.slice(0, 100) : "",
        status: ["all", "unreviewed", "in_progress", "approved", "approved_as_is", "approved_with_changes", "needs_research", "skipped"].includes(parsed.status) ? parsed.status : "all",
        type: ["all", "12", "14", "15", "28"].includes(parsed.type) ? parsed.type : "all",
        priority: ["all", "low", "medium", "high"].includes(parsed.priority) ? parsed.priority : "all",
        no_source: parsed.no_source === true,
        companion_null: parsed.companion_null === true,
        month_null: parsed.month_null === true,
        changed: parsed.changed === true,
        current_id: typeof parsed.current_id === "string" ? parsed.current_id : null,
      };
    } catch {
      return fallback;
    }
  }

  function saveUiState() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(uiStorageKey, JSON.stringify({ ...filters, current_id: currentId }));
    } catch {
      storageAvailable = false;
      refs.storageBanner.hidden = false;
    }
  }

  function applyFilterControls() {
    refs.search.value = filters.query;
    refs.statusFilter.value = filters.status;
    refs.typeFilter.value = filters.type;
    refs.priorityFilter.value = filters.priority;
    refs.noSourceFilter.checked = filters.no_source;
    refs.companionNullFilter.checked = filters.companion_null;
    refs.monthNullFilter.checked = filters.month_null;
    refs.changedFilter.checked = filters.changed;
  }

  function bindStaticEvents() {
    refs.search.addEventListener("input", () => updateFilters({ query: refs.search.value }));
    refs.statusFilter.addEventListener("change", () => updateFilters({ status: refs.statusFilter.value }));
    refs.typeFilter.addEventListener("change", () => updateFilters({ type: refs.typeFilter.value }));
    refs.priorityFilter.addEventListener("change", () => updateFilters({ priority: refs.priorityFilter.value }));
    refs.noSourceFilter.addEventListener("change", () => updateFilters({ no_source: refs.noSourceFilter.checked }));
    refs.companionNullFilter.addEventListener("change", () => updateFilters({ companion_null: refs.companionNullFilter.checked }));
    refs.monthNullFilter.addEventListener("change", () => updateFilters({ month_null: refs.monthNullFilter.checked }));
    refs.changedFilter.addEventListener("change", () => updateFilters({ changed: refs.changedFilter.checked }));
    refs.clearFilters.addEventListener("click", clearFilters);
    refs.mobileListButton.addEventListener("click", openMobileSidebar);
    refs.mobileClose.addEventListener("click", () => closeMobileSidebar(true));
    refs.sidebarBackdrop.addEventListener("click", () => closeMobileSidebar(true));
    refs.importButton.addEventListener("click", () => refs.importFile.click());
    refs.importFile.addEventListener("change", handleImportFile);
    refs.exportButton.addEventListener("click", exportReviews);
    refs.bulkApproveButton.addEventListener("click", confirmBulkApproveLowRisk);
    refs.bulkApproveMediumButton.addEventListener("click", confirmBulkApproveMediumRisk);
    refs.resetAllButton.addEventListener("click", confirmResetAll);
    refs.modalCancel.addEventListener("click", closeModal);
    refs.modalConfirm.addEventListener("click", confirmModalAction);
    refs.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === refs.modalBackdrop) closeModal();
    });
    window.addEventListener("keydown", handleKeyboardShortcut);
    window.addEventListener("pagehide", flushPendingSave);
    window.addEventListener("storage", (event) => {
      if (event.key !== storageKey) return;
      refs.storageBanner.hidden = false;
      refs.storageBanner.textContent = "다른 탭에서 같은 검수 데이터가 변경되었습니다. 충돌을 피하려면 현재 결과를 내보낸 뒤 새로고침해 주세요.";
    });
  }

  function updateFilters(patch) {
    filters = { ...filters, ...patch };
    syncCurrentToVisible();
    saveUiState();
    renderList();
    renderMain();
  }

  function clearFilters() {
    const current = currentId ?? dataset.items[0].contentid;
    filters = { ...defaultFilters(), current_id: current };
    applyFilterControls();
    saveUiState();
    renderList();
    renderMain();
    refs.search.focus();
  }

  function getVisibleItems() {
    return model.filterItems(dataset, bundle, filters);
  }

  function syncCurrentToVisible() {
    const visible = getVisibleItems();
    if (!visible.some((item) => item.contentid === currentId)) currentId = visible[0]?.contentid ?? null;
  }

  function keepCurrentVisibleWhileEditing() {
    if (!currentId || getVisibleItems().some((item) => item.contentid === currentId)) return false;
    filters = {
      ...filters,
      status: "all",
      priority: "all",
      companion_null: false,
      month_null: false,
      changed: false,
    };
    applyFilterControls();
    saveUiState();
    return true;
  }

  function renderAll() {
    renderTopProgress();
    renderList();
    renderMain();
  }

  function renderTopProgress() {
    const summary = model.computeSummary(bundle);
    const lowRiskEligible = countPriorityEligible("low");
    const mediumRiskEligible = countPriorityEligible("medium");
    refs.progress.max = summary.total;
    refs.progress.value = summary.processed;
    refs.progressLabel.textContent = `처리 ${summary.processed} / ${summary.total}`;
    refs.progressDetail.textContent = `승인 ${summary.approved} · 조사 ${summary.needs_research} · 건너뜀 ${summary.skipped}`;
    refs.bulkApproveButton.disabled = lowRiskEligible === 0;
    refs.bulkApproveButton.textContent = lowRiskEligible ? `낮은 위험 ${lowRiskEligible}건 일괄 승인` : "낮은 위험 승인 완료";
    refs.bulkApproveMediumButton.disabled = mediumRiskEligible === 0;
    refs.bulkApproveMediumButton.textContent = mediumRiskEligible ? `중간 위험 ${mediumRiskEligible}건 일괄 승인` : "중간 위험 승인 완료";
  }

  function countPriorityEligible(priority) {
    return dataset.items.reduce((count, item, index) => {
      const review = bundle.reviews[index];
      const eligible = item.auto_label.review_priority === priority &&
        review.status === "unreviewed" &&
        model.countOverrides(review) === 0 &&
        review.comment === "";
      return count + (eligible ? 1 : 0);
    }, 0);
  }

  function renderList() {
    const visible = getVisibleItems();
    refs.listSummary.textContent = `${visible.length}건 표시 · 전체 ${dataset.items.length}건`;
    const fragment = document.createDocumentFragment();

    if (!visible.length) {
      const empty = createElement("li", "empty-state");
      empty.append(
        createElement("strong", "", "조건에 맞는 장소가 없습니다."),
        createElement("p", "", "필터를 지우고 다시 찾아보세요."),
      );
      fragment.append(empty);
    }

    for (const item of visible) {
      const index = dataset.items.findIndex((candidate) => candidate.contentid === item.contentid);
      const review = bundle.reviews[index];
      const li = createElement("li");
      const button = createElement("button", `place-row status-${review.status}`);
      button.type = "button";
      button.dataset.contentid = item.contentid;
      if (item.contentid === currentId) {
        button.classList.add("active");
        button.setAttribute("aria-current", "true");
      }

      const number = createElement("span", "place-index", String(index + 1).padStart(2, "0"));
      const copy = createElement("span", "place-row-copy");
      copy.append(
        createElement("strong", "place-row-title", item.title),
        createElement("span", "place-row-meta", `${typeNames[item.source_place.contenttypeid] ?? item.source_place.contenttypeid} · ${item.contentid}`),
      );
      const badges = createElement("span", "row-badges");
      badges.append(createElement("span", "badge muted", statusNames[review.status]));
      badges.append(createElement(
        "span",
        `badge priority-${item.auto_label.review_priority}`,
        `우선 ${priorityNames[item.auto_label.review_priority]}`,
      ));
      const changeCount = model.countOverrides(review);
      if (changeCount) badges.append(createElement("span", "badge warning", `${changeCount}개 수정`));
      if (!item.label_evidence.source_refs.length) badges.append(createElement("span", "badge muted", "확인 페이지 없음"));
      copy.append(badges);
      button.append(number, copy);
      button.addEventListener("click", () => selectItem(item.contentid, true));
      li.append(button);
      fragment.append(li);
    }
    refs.placeList.replaceChildren(fragment);
  }

  function renderMain() {
    const visible = getVisibleItems();
    if (!currentId || !visible.some((item) => item.contentid === currentId)) {
      const empty = createElement("section", "empty-state");
      empty.append(
        createElement("p", "eyebrow", "NO MATCH"),
        createElement("h2", "", "조건에 맞는 장소가 없습니다."),
        createElement("p", "", "왼쪽 필터를 지우거나 다른 조건을 선택해 주세요."),
      );
      refs.reviewContainer.replaceChildren(empty);
      return;
    }
    const itemIndex = dataset.items.findIndex((item) => item.contentid === currentId);
    if (itemIndex < 0) {
      const empty = createElement("section", "empty-state");
      empty.append(createElement("h2", "", "표시할 장소가 없습니다."));
      refs.reviewContainer.replaceChildren(empty);
      return;
    }
    const item = dataset.items[itemIndex];
    const review = bundle.reviews[itemIndex];
    const content = document.createDocumentFragment();
    content.append(
      buildHero(item, review, itemIndex),
      buildResearchSection(item),
      buildCompanionSection(item, review),
      buildMonthSection(item, review),
      buildEvidenceSection(item),
      buildCommentSection(item, review),
      buildStickyActions(item, review),
    );
    refs.reviewContainer.replaceChildren(content);
  }

  function buildHero(item, review, itemIndex) {
    const hero = createElement("section", "place-hero");
    const media = createElement("div", "hero-media");
    const fallback = createElement("div", "image-fallback", typeNames[item.source_place.contenttypeid] ?? "PLACE");
    const imageUrl = model.safeExternalUrl(item.display.image);
    if (imageUrl) {
      const image = createElement("img", "hero-image");
      image.src = imageUrl;
      image.alt = `${item.title} 대표 이미지`;
      image.loading = "eager";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.replaceWith(fallback), { once: true });
      media.append(image);
    } else {
      media.append(fallback);
    }

    const copy = createElement("div", "hero-content");
    copy.append(createElement("p", "eyebrow", `PLACE ${String(itemIndex + 1).padStart(2, "0")} / ${dataset.items.length}`));
    const title = createElement("h2", "place-title", item.title);
    title.tabIndex = -1;
    title.id = "current-place-title";
    copy.append(title);
    const region = (regionNames[item.source_place.region_code] ?? item.source_place.region_code) || "지역 미상";
    copy.append(createElement("p", "meta-line", `${region} · ${item.display.address || "주소 정보 없음"} · contentid ${item.contentid}`));
    if (item.display.classification.length) {
      copy.append(createElement("p", "classification-line", `TourAPI 신분류 · ${item.display.classification.join(" › ")}`));
    }

    const badges = createElement("div", "row-badges");
    badges.append(
      createElement("span", `badge type-${item.source_place.contenttypeid}`, typeNames[item.source_place.contenttypeid] ?? item.source_place.contenttypeid),
      createElement("span", `badge ${review.status.startsWith("approved_") ? "success" : review.status === "needs_research" ? "warning" : "muted"}`, statusNames[review.status]),
      createElement("span", `badge priority-${item.auto_label.review_priority}`, `검수 ${priorityNames[item.auto_label.review_priority]}`),
      createElement("span", `badge ${item.label_evidence.source_refs.length ? "success" : "warning"}`, item.label_evidence.source_refs.length ? `확인 페이지 ${item.label_evidence.source_refs.length}` : "확인 페이지 없음"),
    );
    if (model.countOverrides(review)) badges.append(createElement("span", "badge warning", `내 수정 ${model.countOverrides(review)}개`));
    copy.append(badges);

    const confidence = createElement("div", "confidence-grid");
    confidence.append(
      confidenceItem("Companion AI 신뢰도", item.label_meta.confidence.companion_fit),
      confidenceItem("Month AI 신뢰도", item.label_meta.confidence.month_fit),
      confidenceItem("생성 방식", readableMethod(item.label_meta.method)),
      confidenceItem("Companion 유형", readableArchetype(item.auto_label.companion_archetype)),
      confidenceItem("Month 유형", readableArchetype(item.auto_label.month_archetype)),
    );
    copy.append(confidence);

    const priorityNotice = createElement("div", `notice priority-${item.auto_label.review_priority}`);
    priorityNotice.append(createElement("strong", "", `검수 우선순위 ${priorityNames[item.auto_label.review_priority]}`));
    const priorityList = createElement("ul", "bullet-list");
    item.auto_label.review_reasons.forEach((reason) => priorityList.append(createElement("li", "", reason)));
    priorityNotice.append(priorityList);
    copy.append(priorityNotice);

    if (item.auto_label.hard_constraints.length) {
      const constraints = createElement("div", "notice warning");
      constraints.append(createElement("strong", "", "점수와 별도로 먼저 확인할 필수 조건"));
      const list = createElement("ul", "bullet-list");
      item.auto_label.hard_constraints.forEach((constraint) => list.append(createElement("li", "", `${constraint.applies_to} — ${constraint.condition} · ${constraint.action === "exclude" ? "조건 불충족 시 제외" : "방문 전 확인"}`)));
      constraints.append(list);
      copy.append(constraints);
    }

    if (item.label_evidence.limitations.length) {
      const warning = createElement("div", "notice warning");
      warning.append(createElement("strong", "", "먼저 확인할 제한"));
      const list = createElement("ul", "bullet-list");
      item.label_evidence.limitations.slice(0, 3).forEach((text) => list.append(createElement("li", "", text)));
      warning.append(list);
      copy.append(warning);
    }
    hero.append(media, copy);
    return hero;
  }

  function buildResearchSection(item) {
    const research = item.web_research;
    const section = createElement("section", "section-card research-section");
    const heading = createElement("div", "section-heading");
    const headingCopy = createElement("div");
    headingCopy.append(
      createElement("p", "eyebrow", "PLACE RESEARCH"),
      createElement("h3", "", "이 장소를 판단할 때 먼저 볼 정보"),
      createElement("p", "section-description", "웹 상세 페이지에서 확인한 사실과 아직 모르는 정보를 구분했습니다. 라벨은 아래 정보를 읽은 뒤 검수해 주세요."),
    );
    const statusClass = research.research_status === "matched" ? "success" : "warning";
    heading.append(
      headingCopy,
      createElement("span", `badge ${statusClass}`, researchStatusNames[research.research_status] ?? research.research_status),
    );
    section.append(heading);

    const summary = createElement("div", "research-summary");
    summary.append(
      createElement("p", "research-lead", research.summary),
      createElement("p", "identity-note", `장소 식별 · ${research.identity_notes}`),
    );
    if (research.experience_tags.length) {
      const tags = createElement("div", "research-tags");
      research.experience_tags.forEach((tag) => tags.append(createElement("span", "badge muted", tag)));
      summary.append(tags);
    }
    section.append(summary);

    const facts = createElement("div", "research-fact-grid");
    for (const [key, label] of Object.entries(researchFactLabels)) {
      const value = key === "environment"
        ? ({ indoor: "실내", outdoor: "실외", mixed: "실내·실외 혼합", unknown: "미확인" }[research.facts[key]] ?? research.facts[key])
        : research.facts[key];
      const card = createElement("article", `research-fact${value ? "" : " unknown"}`);
      card.append(
        createElement("h4", "", label),
        createElement("p", "", value || "확인된 정보 없음"),
      );
      facts.append(card);
    }
    section.append(facts);

    if (research.unknowns.length) {
      const unknowns = createElement("div", "notice warning");
      unknowns.append(createElement("strong", "", "검수자가 특히 확인할 점"));
      const list = createElement("ul", "bullet-list");
      research.unknowns.forEach((unknown) => list.append(createElement("li", "", unknown)));
      unknowns.append(list);
      section.append(unknowns);
    }

    const sourceHeading = createElement("div", "research-source-heading");
    sourceHeading.append(
      createElement("h4", "", `열어 확인한 페이지 ${research.sources.length}개`),
      createElement("p", "section-description", `확인일 ${research.checked_at} · 아래 주장은 각 페이지 본문에서 요약했습니다.`),
    );
    section.append(sourceHeading);

    const sources = createElement("div", "research-source-grid");
    if (!research.sources.length) {
      sources.append(createElement("p", "section-description", "사용할 수 있는 상세 페이지를 찾지 못했습니다."));
    }
    research.sources.forEach((source) => {
      const card = createElement("article", "research-source-card");
      const url = model.safeExternalUrl(source.url);
      const title = url
        ? createElement("a", "source-link", source.title || source.publisher)
        : createElement("strong", "", source.title || source.publisher);
      if (url) {
        title.href = url;
        title.target = "_blank";
        title.rel = "noopener noreferrer";
      }
      card.append(
        title,
        createElement("p", "source-meta", `${source.publisher} · ${sourceTypeNames[source.source_type] ?? source.source_type} · ${source.checked_at}`),
      );
      const claims = createElement("ul", "bullet-list");
      source.claims.forEach((claim) => claims.append(createElement("li", "", claim)));
      card.append(claims);
      sources.append(card);
    });
    section.append(sources);

    const attempts = createElement("details", "research-attempts");
    attempts.append(createElement("summary", "", "검색·확인 과정 보기"));
    const attemptsList = createElement("ul", "bullet-list");
    research.search_attempts.forEach((attempt) => attemptsList.append(createElement("li", "", attempt)));
    attempts.append(attemptsList);
    section.append(attempts);
    return section;
  }

  function confidenceItem(label, value) {
    const item = createElement("div", "confidence-item");
    item.append(createElement("span", "", label), createElement("strong", "", formatConfidence(value)));
    return item;
  }

  function formatConfidence(value) {
    return typeof value === "number" ? value.toFixed(2) : "N/A";
  }

  function readableMethod(method) {
    if (method.includes("autolabel")) return "웹 조사 + 장소 유형 + 기후평년";
    if (method.includes("web_evidence")) return "웹 근거 + 분류 사전";
    if (method.includes("rule_based")) return "분류 사전 초안";
    return method;
  }

  function readableArchetype(value) {
    return String(value ?? "").replaceAll("_", " ");
  }

  function buildCompanionSection(item, review) {
    const section = createElement("section", "section-card");
    const heading = createElement("div", "section-heading");
    const headingCopy = createElement("div");
    headingCopy.append(
      createElement("p", "eyebrow", "COMPANION FIT"),
      createElement("h3", "", "누구와 가기 좋은가요?"),
      createElement("p", "section-description", "웹 조사와 장소 유형을 바탕으로 AI가 먼저 채웠습니다. 맞는 값은 그대로 두고 예외만 바꾸면 됩니다."),
    );
    const reset = createElement("button", "btn ghost small", "동반자 AI 값 복원");
    reset.type = "button";
    reset.addEventListener("click", () => resetGroup(item, "companion_fit"));
    heading.append(headingCopy, reset);
    section.append(heading, buildLegend());

    const list = createElement("div", "companion-list");
    for (const key of model.COMPANION_KEYS) {
      const [label, description] = axisInfo[key];
      const fieldset = createElement("fieldset", "axis-row");
      const legend = createElement("legend", "axis-label", label);
      const help = createElement("p", "axis-description", description);
      const segmented = createElement("div", "segmented");
      const currentValue = model.getResolvedValue(item, review, "companion_fit", key);
      const originalValue = item.companion_fit[key];
      for (const value of labelOptions) {
        const option = createElement("label", "segment");
        if (model.labelValuesEqual(value, originalValue)) option.classList.add("ai-baseline");
        if (!model.labelValuesEqual(currentValue, originalValue) && model.labelValuesEqual(value, currentValue)) option.classList.add("changed");
        const input = createElement("input");
        input.type = "radio";
        input.name = `companion-${item.contentid}-${key}`;
        input.value = encodeLabel(value);
        input.checked = model.labelValuesEqual(currentValue, value);
        input.setAttribute("aria-label", `${label} ${formatLabel(value)}`);
        input.addEventListener("change", () => updateLabel(item, "companion_fit", key, decodeLabel(input.value)));
        option.append(input, createElement("span", "", shortLabel(value)));
        segmented.append(option);
      }
      const controls = createElement("div");
      controls.append(segmented);
      if (!model.labelValuesEqual(currentValue, originalValue)) {
        const note = createElement("p", "change-note", `AI ${formatLabel(originalValue)} → 내 입력 ${formatLabel(currentValue)}`);
        const restore = createElement("button", "reset-link", "이 축 복원");
        restore.type = "button";
        restore.addEventListener("click", () => updateLabel(item, "companion_fit", key, originalValue));
        note.append(" · ", restore);
        controls.append(note);
      } else {
        controls.append(createElement("p", "change-note", `AI 기준값 ${formatLabel(originalValue)}`));
      }
      const proposal = item.auto_label.companion_fit[key];
      controls.append(
        createElement("p", "axis-ai-meta", `${inferenceNames[proposal.inference_level]} · 신뢰도 ${formatConfidence(proposal.confidence)}`),
        createElement("p", "axis-ai-rationale", proposal.rationale),
      );
      fieldset.append(legend, help, controls);
      list.append(fieldset);
    }
    section.append(list);
    return section;
  }

  function buildLegend() {
    const legend = createElement("div", "legend-strip");
    [
      ["미정", "검수자가 명시적으로 보류"],
      ["0", "명백히 부적합"],
      ["0.25", "큰 마찰"],
      ["0.5", "검증된 중립"],
      ["0.75", "명확히 좋음"],
      ["1", "대표적 강점"],
    ].forEach(([value, text]) => {
      const item = createElement("span");
      item.append(createElement("strong", "", value), document.createTextNode(` ${text}`));
      legend.append(item);
    });
    return legend;
  }

  function buildMonthSection(item, review) {
    const section = createElement("section", "section-card");
    const heading = createElement("div", "section-heading");
    const headingCopy = createElement("div");
    headingCopy.append(
      createElement("p", "eyebrow", "MONTH FIT"),
      createElement("h3", "", "어느 달에 더 잘 맞나요?"),
      createElement("p", "section-description", "웹 계절 단서와 1991~2020 제주 기후평년으로 AI가 먼저 채웠습니다. 실제 예보·특보·휴무는 별도 확인 대상입니다."),
    );
    const reset = createElement("button", "btn ghost small", "12개월 AI 값 복원");
    reset.type = "button";
    reset.addEventListener("click", () => resetGroup(item, "month_fit"));
    if (item.source_place.contenttypeid === "15") reset.disabled = true;
    heading.append(headingCopy, reset);
    section.append(heading);

    if (item.source_place.contenttypeid === "15") {
      const festival = createElement("div", "notice festival");
      festival.append(
        createElement("strong", "", "축제 월 점수는 N/A"),
        document.createTextNode(" 축제는 개최일이 확정된 뒤 날짜 필터로 처리합니다. 아래 12칸은 미완료가 아니며 직접 채울 필요가 없습니다."),
      );
      section.append(festival);
    }

    const grid = createElement("div", "month-grid");
    for (const key of model.MONTH_KEYS) {
      const originalValue = item.month_fit[key];
      const currentValue = model.getResolvedValue(item, review, "month_fit", key);
      const proposal = item.auto_label.month_fit[key];
      const notApplicable = proposal.inference_level === "not_applicable";
      const card = createElement("article", "month-card");
      if (notApplicable) card.classList.add("not-applicable");
      if (!model.labelValuesEqual(originalValue, currentValue)) card.classList.add("changed");
      const label = createElement("label", "month-name");
      const selectId = `month-${item.contentid}-${key}`;
      label.htmlFor = selectId;
      label.textContent = monthNames[Number(key) - 1];
      const ai = createElement("span", "month-ai", notApplicable ? "AI N/A" : `AI ${shortLabel(originalValue)}`);
      const select = createElement("select", "month-select");
      select.id = selectId;
      select.setAttribute("aria-label", `${monthNames[Number(key) - 1]} 적합도`);
      for (const value of notApplicable ? [null] : labelOptions) {
        const option = createElement("option");
        option.value = encodeLabel(value);
        option.textContent = notApplicable ? "N/A · 개최일 종속" : formatLabel(value);
        option.selected = model.labelValuesEqual(value, currentValue);
        select.append(option);
      }
      select.disabled = notApplicable;
      if (!notApplicable) select.addEventListener("change", () => updateLabel(item, "month_fit", key, decodeLabel(select.value)));
      card.append(
        label,
        ai,
        select,
        createElement("p", "month-source", `${inferenceNames[proposal.inference_level]} · ${formatConfidence(proposal.confidence)}`),
      );
      card.title = proposal.rationale;
      if (!model.labelValuesEqual(originalValue, currentValue)) {
        const diff = createElement("p", "change-note", `내 입력 ${shortLabel(currentValue)}`);
        const restore = createElement("button", "reset-link", "복원");
        restore.type = "button";
        restore.addEventListener("click", () => updateLabel(item, "month_fit", key, originalValue));
        diff.append(" · ", restore);
        card.append(diff);
      }
      grid.append(card);
    }
    section.append(grid);
    return section;
  }

  function buildEvidenceSection(item) {
    const section = createElement("section", "section-card");
    const details = createElement("details");
    const summary = createElement("summary", "section-heading");
    const text = createElement("div");
    text.append(
      createElement("p", "eyebrow", "EVIDENCE"),
      createElement("h3", "", "AI 판단 근거와 출처 보기"),
      createElement("p", "section-description", "수정 전에 초안이 어떤 정보로 만들어졌는지 확인할 수 있습니다."),
    );
    summary.append(text);
    details.append(summary);

    const grid = createElement("div", "evidence-grid");
    grid.append(
      evidenceList("신분류·구조화 판단 필드", structuredEvidence(item)),
      evidenceList("자동 라벨 프로필", autoLabelEvidence(item)),
      evidenceList("동반자 판단 근거", item.label_evidence.companion_basis),
      evidenceList("월별 판단 근거", item.label_evidence.month_basis),
      evidenceList("알려진 제한", item.label_evidence.limitations),
      sourceBlock(item.label_evidence.source_refs),
      climateSourceBlock(dataset.climate_baseline),
    );
    details.append(grid);
    section.append(details);
    return section;
  }

  function structuredEvidence(item) {
    const evidence = item.label_evidence;
    const environmentNames = {
      indoor: "실내",
      outdoor: "실외",
      mixed: "실내·실외 혼합",
      unknown: "미정",
    };
    const score = (value) => value === null || value === undefined ? "미정" : String(value);
    const peakMonths = Array.isArray(evidence.seasonal_peak_months) && evidence.seasonal_peak_months.length
      ? evidence.seasonal_peak_months.map((month) => `${month}월`).join(", ")
      : "확정 월 없음";
    const mobilityScope = item.auto_label.hard_constraints
      .find((constraint) => constraint.rule_id === "GATE-CHUJA-OLLE")?.applies_to;
    const effortScopeNote = mobilityScope ? ` (${mobilityScope} 선택 경험에 한정)` : "";
    return [
      `신분류: ${item.display.classification.length ? item.display.classification.join(" › ") : "정보 없음"}`,
      `환경: ${environmentNames[evidence.environment] ?? evidence.environment ?? "미정"}`,
      `체력 부담: ${score(evidence.physical_effort)}${effortScopeNote} · 실내 비율: ${score(evidence.indoor_ratio)}`,
      `날씨 민감도 — 비 ${score(evidence.rain_sensitivity)}, 바람 ${score(evidence.wind_sensitivity)}, 더위 ${score(evidence.heat_sensitivity)}, 추위 ${score(evidence.cold_sensitivity)}`,
      `계절 절정 월: ${peakMonths}`,
      `운영·행사 가용성 별도 확인: ${evidence.availability_separate ? "필요" : "별도 표시 없음"}`,
    ];
  }

  function autoLabelEvidence(item) {
    const auto = item.auto_label;
    return [
      `Companion 유형: ${readableArchetype(auto.companion_archetype)}`,
      `Month 유형: ${readableArchetype(auto.month_archetype)}`,
      `분류 이유: ${auto.assignment_rationale}`,
      `적용 특성: ${auto.flags.length ? auto.flags.map(readableArchetype).join(", ") : "추가 보정 없음"}`,
      `검수 우선순위: ${priorityNames[auto.review_priority]} — ${auto.review_reasons.join(" ")}`,
    ];
  }

  function evidenceList(title, values) {
    const block = createElement("div", "evidence-block");
    block.append(createElement("h4", "", title));
    if (!values.length) {
      block.append(createElement("p", "section-description", "기록된 내용이 없습니다."));
      return block;
    }
    const list = createElement("ul", "bullet-list");
    values.forEach((value) => list.append(createElement("li", "", value)));
    block.append(list);
    return block;
  }

  function sourceBlock(sourceRefs) {
    const block = createElement("div", "evidence-block");
    block.append(createElement("h4", "", "확인한 웹 페이지"));
    if (!sourceRefs.length) {
      block.append(createElement("p", "section-description", "장소별 상세 페이지를 확인하지 못했습니다."));
      return block;
    }
    const list = createElement("ul", "source-list");
    sourceRefs.forEach((source) => {
      const li = createElement("li");
      const url = model.safeExternalUrl(source.url);
      if (url) {
        const link = createElement("a", "source-link", source.title || "출처 페이지");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        li.append(link, createElement("span", "", ` · 확인 ${source.checked_at}`));
      } else {
        li.append(createElement("span", "", "안전하지 않은 출처 URL이 제외되었습니다."));
      }
      list.append(li);
    });
    block.append(list);
    return block;
  }

  function climateSourceBlock(climate) {
    const block = createElement("div", "evidence-block");
    block.append(
      createElement("h4", "", `월별 기후 기준 ${climate.baseline_period}`),
      createElement("p", "section-description", climate.station_scope_note),
    );
    const list = createElement("ul", "source-list");
    climate.sources.forEach((source) => {
      const li = createElement("li");
      const url = model.safeExternalUrl(source.url);
      if (url) {
        const link = createElement("a", "source-link", source.title);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        li.append(link, document.createTextNode(` · ${source.claim}`));
      }
      list.append(li);
    });
    block.append(list);
    return block;
  }

  function buildCommentSection(item, review) {
    const section = createElement("section", "section-card");
    const heading = createElement("div", "section-heading");
    const headingCopy = createElement("div");
    headingCopy.append(
      createElement("p", "eyebrow", "YOUR NOTE"),
      createElement("h3", "", "이 장소에 남길 코멘트"),
      createElement("p", "section-description", "판단 근거, 고쳐야 할 점, 추가로 확인할 내용을 자유롭게 적어 주세요. 개인정보는 적지 마세요."),
    );
    heading.append(headingCopy);
    const area = createElement("div", "comment-area");
    const label = createElement("label", "visually-hidden", `${item.title} 검수 코멘트`);
    label.htmlFor = `comment-${item.contentid}`;
    const textarea = createElement("textarea");
    textarea.id = `comment-${item.contentid}`;
    textarea.maxLength = model.MAX_COMMENT_LENGTH;
    textarea.rows = 6;
    textarea.placeholder = "예: 아이 체험 프로그램은 좋아 보이지만 유모차 접근 여부를 확인해야 함";
    textarea.value = review.comment;
    const counter = createElement("p", "comment-counter", `${textarea.value.length} / ${model.MAX_COMMENT_LENGTH}`);
    textarea.addEventListener("input", () => {
      try {
        model.setComment(bundle, item.contentid, textarea.value);
        const filtersRelaxed = keepCurrentVisibleWhileEditing();
        counter.textContent = `${textarea.value.length} / ${model.MAX_COMMENT_LENGTH}`;
        scheduleSave();
        renderTopProgress();
        renderList();
        updateStatusSummary(item.contentid);
        if (filtersRelaxed) showToast("현재 장소를 계속 편집하도록 상태·값 필터를 해제했습니다.");
      } catch (error) {
        showToast(error.message, true);
      }
    });
    area.append(label, textarea, counter);
    const status = createElement("div", "review-status");
    status.id = `status-summary-${item.contentid}`;
    fillStatusSummary(status, review);
    section.append(heading, area, status);
    return section;
  }

  function fillStatusSummary(container, review) {
    container.replaceChildren(
      createElement("span", "status-option", `현재 상태 · ${statusNames[review.status]}`),
      createElement("span", "", `수정 ${model.countOverrides(review)}개${review.updated_at ? ` · ${formatSavedTime(review.updated_at)}` : ""}`),
    );
  }

  function updateStatusSummary(contentid) {
    const reviewIndex = bundle.reviews.findIndex((review) => review.contentid === contentid);
    const container = document.getElementById(`status-summary-${contentid}`);
    if (container && reviewIndex >= 0) fillStatusSummary(container, bundle.reviews[reviewIndex]);
  }

  function buildStickyActions(item, review) {
    const bar = createElement("section", "sticky-actions");
    const nav = createElement("div", "nav-actions");
    const previous = createElement("button", "btn secondary", "← 이전");
    previous.type = "button";
    previous.addEventListener("click", () => moveSelection(-1));
    const next = createElement("button", "btn secondary", "다음 →");
    next.type = "button";
    next.addEventListener("click", () => moveSelection(1));
    nav.append(previous, next);

    const decisions = createElement("div", "decision-actions");
    const reset = createElement("button", "btn ghost", "이 장소 초기화");
    reset.type = "button";
    reset.addEventListener("click", () => confirmResetPlace(item));
    const research = createElement("button", "btn secondary", "추가 조사");
    research.type = "button";
    research.addEventListener("click", () => finishWithStatus(item, "needs_research"));
    const skip = createElement("button", "btn ghost", "건너뜀");
    skip.type = "button";
    skip.addEventListener("click", () => finishWithStatus(item, "skipped"));
    const complete = createElement("button", "btn primary", model.countOverrides(review) ? "수정 후 승인 · 다음" : "AI 원안 승인 · 다음");
    complete.type = "button";
    complete.addEventListener("click", () => finishReview(item));
    decisions.append(reset, research, skip, complete);
    bar.append(nav, decisions, createElement("p", "kbd-hint", "⌘/Ctrl + Enter 승인 · Alt + ←/→ 이동 · / 검색"));
    return bar;
  }

  function updateLabel(item, group, key, value) {
    try {
      model.setOverride(bundle, dataset, item.contentid, group, key, value);
      const filtersRelaxed = keepCurrentVisibleWhileEditing();
      scheduleSave();
      renderAll();
      const selector = group === "companion_fit"
        ? `input[name="companion-${item.contentid}-${key}"]:checked`
        : `#month-${item.contentid}-${key}`;
      document.querySelector(selector)?.focus();
      if (filtersRelaxed) showToast("현재 장소를 계속 편집하도록 상태·값 필터를 해제했습니다.");
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function resetGroup(item, group) {
    const keys = group === "companion_fit" ? model.COMPANION_KEYS : model.MONTH_KEYS;
    let changed = false;
    for (const key of keys) {
      const reviewIndex = bundle.reviews.findIndex((review) => review.contentid === item.contentid);
      if (Object.prototype.hasOwnProperty.call(bundle.reviews[reviewIndex].overrides[group], key)) {
        model.setOverride(bundle, dataset, item.contentid, group, key, item[group][key]);
        changed = true;
      }
    }
    if (changed) {
      const filtersRelaxed = keepCurrentVisibleWhileEditing();
      scheduleSave();
      renderAll();
      showToast(filtersRelaxed ? "AI 값으로 복원하고 상태·값 필터를 해제했습니다." : "AI 기준값으로 복원했습니다.");
    }
  }

  function finishReview(item) {
    try {
      model.completeReview(bundle, item.contentid);
      scheduleSave(true);
      renderTopProgress();
      showToast("검토 완료로 저장했습니다.");
      moveToNextOpenItem();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function finishWithStatus(item, status) {
    const review = bundle.reviews.find((candidate) => candidate.contentid === item.contentid);
    if (!review.comment.trim()) {
      showToast("이 상태를 선택하려면 코멘트에 사유를 적어 주세요.", true);
      document.getElementById(`comment-${item.contentid}`)?.focus();
      return;
    }
    try {
      model.setReviewStatus(bundle, item.contentid, status);
      scheduleSave(true);
      renderTopProgress();
      showToast(`${statusNames[status]} 상태로 저장했습니다.`);
      moveToNextOpenItem();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function moveToNextOpenItem() {
    const nextId = model.nextVisibleOpenId(dataset, bundle, filters, currentId);
    if (nextId && nextId !== currentId) {
      selectItem(nextId, true);
      return;
    }
    currentId = nextId;
    saveUiState();
    renderList();
    renderMain();
    requestAnimationFrame(() => document.getElementById("current-place-title")?.focus());
  }

  function moveSelection(delta) {
    const visible = getVisibleItems();
    if (!visible.length) return;
    const currentIndex = visible.findIndex((item) => item.contentid === currentId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + visible.length) % visible.length;
    selectItem(visible[nextIndex].contentid, true);
  }

  function selectItem(contentid, focusHeading) {
    if (!dataset.items.some((item) => item.contentid === contentid)) return;
    currentId = contentid;
    saveUiState();
    renderList();
    renderMain();
    closeMobileSidebar(false);
    if (focusHeading) requestAnimationFrame(() => document.getElementById("current-place-title")?.focus());
  }

  function scheduleSave(immediate = false) {
    refs.saveState.textContent = "저장 중…";
    if (saveTimer) window.clearTimeout(saveTimer);
    if (immediate) persistBundle();
    else saveTimer = window.setTimeout(persistBundle, 300);
  }

  function persistBundle() {
    saveTimer = null;
    if (!storageAvailable) {
      refs.saveState.textContent = "자동 저장 불가 · JSON 백업 필요";
      return;
    }
    const result = model.saveBundle(localStorage, storageKey, bundle, dataset);
    if (result.ok) {
      refs.saveState.textContent = `자동 저장됨 · ${formatSavedTime(bundle.session.updated_at)}`;
    } else {
      storageAvailable = false;
      refs.storageBanner.hidden = false;
      refs.storageBanner.textContent = `자동 저장에 실패했습니다. 지금 JSON으로 내보내 주세요. (${result.error})`;
      refs.saveState.textContent = "자동 저장 실패";
    }
  }

  function flushPendingSave() {
    if (!saveTimer) return;
    window.clearTimeout(saveTimer);
    persistBundle();
  }

  function exportReviews() {
    try {
      const exported = model.makeExportBundle(bundle, dataset);
      const content = `${JSON.stringify(exported, null, 2)}\n`;
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTime = exported.session.exported_at.replace(/[:.]/g, "").replace("Z", "Z");
      link.href = url;
      link.download = `place-profile-human-review-v2_${safeTime}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      const summary = model.computeSummary(bundle);
      showToast(`검수 결과를 내려받았습니다. 처리 ${summary.processed}/${summary.total}건`);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  async function handleImportFile() {
    const file = refs.importFile.files?.[0];
    refs.importFile.value = "";
    if (!file) return;
    if (file.size > model.MAX_IMPORT_BYTES) {
      showToast("가져오기 파일은 5MB 이하여야 합니다.", true);
      return;
    }
    try {
      const text = await file.text();
      const parsed = model.parseImportText(text, file.size, dataset);
      if (!parsed.ok) {
        showToast(parsed.errors[0], true);
        return;
      }
      pendingImport = parsed.bundle;
      const summary = model.computeSummary(pendingImport);
      openModal({
        kicker: "JSON 불러오기",
        title: "현재 검수 내용을 교체할까요?",
        message: `불러올 파일은 처리 ${summary.processed}/${summary.total}건, 수정 ${summary.changed}건입니다. 현재 브라우저의 작업은 교체됩니다. 필요하면 먼저 현재 결과를 내보내세요.`,
        confirmText: "전체 교체",
        danger: false,
        action: applyPendingImport,
      });
    } catch {
      showToast("파일을 읽지 못했습니다.", true);
    }
  }

  function applyPendingImport() {
    if (!pendingImport) return;
    bundle = model.clone(pendingImport);
    pendingImport = null;
    syncCurrentToVisible();
    scheduleSave(true);
    renderAll();
    showToast("검수 JSON을 불러왔습니다.");
  }

  function confirmResetPlace(item) {
    openModal({
      kicker: "장소 초기화",
      title: `${item.title} 입력을 지울까요?`,
      message: "이 장소의 수정값, 코멘트와 사람 검수 상태만 지우고 AI 초안으로 돌아갑니다.",
      confirmText: "이 장소 초기화",
      danger: true,
      action: () => {
        model.resetReview(bundle, dataset, item.contentid);
        syncCurrentToVisible();
        scheduleSave(true);
        renderAll();
        showToast("이 장소의 입력을 초기화했습니다.");
      },
    });
  }

  function confirmBulkApproveLowRisk() {
    confirmBulkApprovePriority("low");
  }

  function confirmBulkApproveMediumRisk() {
    confirmBulkApprovePriority("medium");
  }

  function confirmBulkApprovePriority(priority) {
    const count = countPriorityEligible(priority);
    const name = priorityNames[priority];
    if (!count) {
      showToast(`일괄 승인할 미검토 ${name} 우선순위 장소가 없습니다.`);
      return;
    }
    openModal({
      kicker: `${name} 우선순위 일괄 승인`,
      title: `AI 원안 ${count}건을 한 번에 승인할까요?`,
      message: priority === "low"
        ? "웹 조사와 고정 규칙에 충돌·안전 제약이 없는 낮은 우선순위의 미검토 장소만 승인합니다. 이미 수정했거나 작성 중인 장소와 다른 우선순위는 바꾸지 않습니다."
        : "조사 사실 추론이나 별도 확인 조건이 있는 중간 우선순위의 미검토 장소를 AI 원안으로 승인합니다. 먼저 중간 필터에서 표본을 확인하는 것을 권장합니다. 이미 수정했거나 작성 중인 장소와 높은 우선순위는 절대 바꾸지 않습니다.",
      confirmText: `${count}건 AI 원안 승인`,
      danger: false,
      action: () => {
        const approvedIds = model.bulkApprovePriority(bundle, dataset, priority);
        syncCurrentToVisible();
        scheduleSave(true);
        renderAll();
        showToast(`${name} 우선순위 ${approvedIds.length}건을 AI 원안으로 승인했습니다.`);
      },
    });
  }

  function confirmResetAll() {
    const summary = model.computeSummary(bundle);
    openModal({
      kicker: "전체 초기화",
      title: "100건 검수 내용을 모두 지울까요?",
      message: `현재 처리 ${summary.processed}건과 작성 중 ${summary.in_progress}건이 삭제됩니다. 되돌릴 수 없으니 필요하면 먼저 JSON으로 내보내세요.`,
      confirmText: "100건 모두 초기화",
      danger: true,
      action: () => {
        if (storageAvailable) {
          try {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(uiStorageKey);
          } catch {
            storageAvailable = false;
          }
        }
        bundle = model.createBundle(dataset);
        filters = defaultFilters();
        currentId = dataset.items[0].contentid;
        applyFilterControls();
        renderAll();
        showToast("새 검수 세션으로 초기화했습니다.");
      },
    });
  }

  function openModal({ kicker, title, message, confirmText, danger, action }) {
    modalReturnFocus = document.activeElement;
    modalAction = action;
    refs.modalKicker.textContent = kicker;
    refs.modalTitle.textContent = title;
    refs.modalMessage.textContent = message;
    refs.modalConfirm.textContent = confirmText;
    refs.modalConfirm.classList.toggle("danger", danger);
    refs.modalConfirm.classList.toggle("primary", !danger);
    refs.modalBackdrop.hidden = false;
    document.body.classList.add("modal-open");
    refs.modalCancel.focus();
  }

  function closeModal() {
    const returnFocus = modalReturnFocus;
    refs.modalBackdrop.hidden = true;
    document.body.classList.remove("modal-open");
    modalAction = null;
    pendingImport = null;
    modalReturnFocus = null;
    restoreFocusAfterModal(returnFocus);
  }

  function confirmModalAction() {
    const action = modalAction;
    const returnFocus = modalReturnFocus;
    refs.modalBackdrop.hidden = true;
    document.body.classList.remove("modal-open");
    modalAction = null;
    modalReturnFocus = null;
    try {
      if (typeof action === "function") action();
    } finally {
      restoreFocusAfterModal(returnFocus);
    }
  }

  function restoreFocusAfterModal(returnFocus) {
    requestAnimationFrame(() => {
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
      else document.getElementById("current-place-title")?.focus();
    });
  }

  function openMobileSidebar() {
    refs.sidebar.classList.add("open");
    refs.sidebarBackdrop.hidden = false;
    refs.mobileListButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("sidebar-open");
    refs.mobileClose.focus();
  }

  function closeMobileSidebar(restoreFocus = false) {
    if (!refs.sidebar.classList.contains("open")) return;
    refs.sidebar.classList.remove("open");
    refs.sidebarBackdrop.hidden = true;
    refs.mobileListButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("sidebar-open");
    if (restoreFocus) refs.mobileListButton.focus();
  }

  function handleKeyboardShortcut(event) {
    if (!refs.modalBackdrop.hidden) {
      if (event.key === "Tab") {
        const focusable = [refs.modalCancel, refs.modalConfirm].filter((element) => !element.disabled);
        const currentIndex = focusable.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
        event.preventDefault();
        focusable[nextIndex]?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
      return;
    }
    const target = event.target;
    const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if (event.key === "Escape") {
      if (!refs.modalBackdrop.hidden) closeModal();
      else closeMobileSidebar(true);
      return;
    }
    if (!editable && event.key === "/") {
      event.preventDefault();
      refs.search.focus();
      return;
    }
    if (!editable && event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (!editable && event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      const item = dataset.items.find((candidate) => candidate.contentid === currentId);
      if (item) finishReview(item);
    }
  }

  function showToast(message, isError = false) {
    if (toastTimer) window.clearTimeout(toastTimer);
    refs.toast.textContent = message;
    refs.toast.classList.toggle("error", isError);
    refs.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      refs.toast.hidden = true;
    }, isError ? 5200 : 3200);
  }

  function createElement(tagName, className = "", text = null) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }

  function encodeLabel(value) {
    return value === null ? "null" : String(value);
  }

  function decodeLabel(value) {
    if (value === "null") return null;
    const parsed = Number(value);
    if (!model.isLabelValue(parsed)) throw new Error("허용되지 않은 라벨 값입니다.");
    return parsed;
  }

  function formatLabel(value) {
    return labelText.get(value === null ? "null" : String(value)) ?? String(value);
  }

  function shortLabel(value) {
    return value === null ? "미정" : String(value);
  }

  function formatSavedTime(iso) {
    try {
      return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return "방금";
    }
  }
})();
