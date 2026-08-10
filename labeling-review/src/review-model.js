(function attachReviewModel(global) {
  "use strict";

  const SCHEMA_VERSION = "place-profile-human-review-v2";
  const UI_VERSION = "place-profile-review-ui-v3";
  const COMPANION_KEYS = Object.freeze(["solo", "couple", "friends", "kids", "parents"]);
  const MONTH_KEYS = Object.freeze(Array.from({ length: 12 }, (_, index) => String(index + 1)));
  const LABEL_VALUES = Object.freeze([null, 0, 0.25, 0.5, 0.75, 1]);
  const REVIEW_STATUSES = Object.freeze([
    "unreviewed",
    "in_progress",
    "approved_as_is",
    "approved_with_changes",
    "needs_research",
    "skipped",
  ]);
  const TERMINAL_STATUSES = new Set([
    "approved_as_is",
    "approved_with_changes",
    "needs_research",
    "skipped",
  ]);
  const MAX_COMMENT_LENGTH = 2000;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactKeys(value, expected) {
    if (!isPlainObject(value)) return false;
    const actual = Object.keys(value).sort();
    const sortedExpected = [...expected].sort();
    return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
  }

  function isLabelValue(value) {
    return LABEL_VALUES.some((candidate) => Object.is(candidate, value));
  }

  function labelValuesEqual(left, right) {
    return Object.is(left, right);
  }

  function isIsoDateTime(value) {
    return typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      Number.isFinite(Date.parse(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function fallbackSessionId() {
    const randomPart = Math.random().toString(36).slice(2, 12);
    return `review-${Date.now().toString(36)}-${randomPart}`;
  }

  function createSessionId() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === "function") {
        return global.crypto.randomUUID();
      }
    } catch {
      // Fall through to a local, non-security identifier.
    }
    return fallbackSessionId();
  }

  function createStorageKey(dataset) {
    return `trip-ai:place-profile-review:v2:${dataset.review_base_sha256}`;
  }

  function datasetBase(dataset) {
    return {
      label_version: dataset.label_version,
      profile_path: dataset.profile_path,
      profile_sha256: dataset.profile_sha256,
      review_base_sha256: dataset.review_base_sha256,
      profile_count: dataset.items.length,
    };
  }

  function createEmptyReview(item) {
    return {
      contentid: item.contentid,
      title_snapshot: item.title,
      status: "unreviewed",
      overrides: {
        companion_fit: {},
        month_fit: {},
      },
      comment: "",
      started_at: null,
      updated_at: null,
      completed_at: null,
    };
  }

  function createBundle(dataset, timestamp = nowIso(), sessionId = createSessionId()) {
    return {
      schema_version: SCHEMA_VERSION,
      base: datasetBase(dataset),
      session: {
        session_id: sessionId,
        ui_version: UI_VERSION,
        created_at: timestamp,
        updated_at: timestamp,
        exported_at: null,
      },
      reviews: dataset.items.map(createEmptyReview),
    };
  }

  function findReviewIndex(bundle, contentid) {
    return bundle.reviews.findIndex((review) => review.contentid === contentid);
  }

  function itemById(dataset, contentid) {
    return dataset.items.find((item) => item.contentid === contentid) ?? null;
  }

  function keysForGroup(group) {
    if (group === "companion_fit") return COMPANION_KEYS;
    if (group === "month_fit") return MONTH_KEYS;
    return null;
  }

  function countOverrides(review) {
    return Object.keys(review.overrides.companion_fit).length + Object.keys(review.overrides.month_fit).length;
  }

  function touchReview(review, bundle, timestamp) {
    if (review.started_at === null) review.started_at = timestamp;
    review.updated_at = timestamp;
    review.completed_at = null;
    review.status = "in_progress";
    bundle.session.updated_at = timestamp;
    bundle.session.exported_at = null;
  }

  function setOverride(bundle, dataset, contentid, group, key, toValue, timestamp = nowIso()) {
    if (!isLabelValue(toValue)) throw new Error("허용되지 않은 라벨 값입니다.");
    const allowedKeys = keysForGroup(group);
    if (!allowedKeys || !allowedKeys.includes(key)) throw new Error("허용되지 않은 라벨 축입니다.");
    const reviewIndex = findReviewIndex(bundle, contentid);
    const item = itemById(dataset, contentid);
    if (reviewIndex < 0 || !item) throw new Error("검수 대상에 없는 장소입니다.");
    if (group === "month_fit" && item.auto_label?.month_fit?.[key]?.inference_level === "not_applicable") {
      throw new Error("개최일 종속 축제의 월 N/A는 이 화면에서 수정하지 않습니다.");
    }

    const review = bundle.reviews[reviewIndex];
    const fromValue = item[group][key];
    const previous = review.overrides[group][key];
    if (labelValuesEqual(fromValue, toValue)) {
      if (previous === undefined) return false;
      delete review.overrides[group][key];
    } else {
      if (previous && labelValuesEqual(previous.to, toValue)) return false;
      review.overrides[group][key] = { from: fromValue, to: toValue };
    }
    touchReview(review, bundle, timestamp);
    return true;
  }

  function setComment(bundle, contentid, comment, timestamp = nowIso()) {
    if (typeof comment !== "string") throw new Error("코멘트는 문자열이어야 합니다.");
    if (comment.length > MAX_COMMENT_LENGTH) throw new Error(`코멘트는 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.`);
    const reviewIndex = findReviewIndex(bundle, contentid);
    if (reviewIndex < 0) throw new Error("검수 대상에 없는 장소입니다.");
    const review = bundle.reviews[reviewIndex];
    if (review.comment === comment) return false;
    review.comment = comment;
    touchReview(review, bundle, timestamp);
    return true;
  }

  function resetReview(bundle, dataset, contentid, timestamp = nowIso()) {
    const reviewIndex = findReviewIndex(bundle, contentid);
    const item = itemById(dataset, contentid);
    if (reviewIndex < 0 || !item) throw new Error("검수 대상에 없는 장소입니다.");
    bundle.reviews[reviewIndex] = createEmptyReview(item);
    bundle.session.updated_at = timestamp;
    bundle.session.exported_at = null;
  }

  function setReviewStatus(bundle, contentid, status, timestamp = nowIso()) {
    if (!REVIEW_STATUSES.includes(status)) throw new Error("허용되지 않은 검수 상태입니다.");
    const reviewIndex = findReviewIndex(bundle, contentid);
    if (reviewIndex < 0) throw new Error("검수 대상에 없는 장소입니다.");
    const review = bundle.reviews[reviewIndex];
    const overrideCount = countOverrides(review);

    if (status === "approved_as_is" && overrideCount !== 0) {
      throw new Error("수정값이 있는 장소는 '수정 후 승인'으로 완료해야 합니다.");
    }
    if (status === "approved_with_changes" && overrideCount === 0) {
      throw new Error("수정 후 승인에는 한 개 이상의 변경값이 필요합니다.");
    }
    if ((status === "needs_research" || status === "skipped") && !review.comment.trim()) {
      throw new Error("추가 조사 또는 건너뜀에는 코멘트를 남겨 주세요.");
    }

    if (status === "unreviewed") {
      throw new Error("미검토 상태로 되돌리려면 이 장소를 초기화해 주세요.");
    }
    if (review.started_at === null) review.started_at = timestamp;
    review.status = status;
    review.updated_at = timestamp;
    review.completed_at = TERMINAL_STATUSES.has(status) ? timestamp : null;
    bundle.session.updated_at = timestamp;
    bundle.session.exported_at = null;
    return status;
  }

  function completeReview(bundle, contentid, timestamp = nowIso()) {
    const reviewIndex = findReviewIndex(bundle, contentid);
    if (reviewIndex < 0) throw new Error("검수 대상에 없는 장소입니다.");
    const status = countOverrides(bundle.reviews[reviewIndex]) === 0
      ? "approved_as_is"
      : "approved_with_changes";
    return setReviewStatus(bundle, contentid, status, timestamp);
  }

  function bulkApprovePriority(bundle, dataset, priority, timestamp = nowIso()) {
    if (priority !== "low" && priority !== "medium") {
      throw new Error("낮음 또는 중간 우선순위만 일괄 승인할 수 있습니다.");
    }
    const approvedIds = [];
    for (let index = 0; index < dataset.items.length; index += 1) {
      const item = dataset.items[index];
      const review = bundle.reviews[index];
      if (item.auto_label?.review_priority !== priority) continue;
      if (review.status !== "unreviewed") continue;
      if (countOverrides(review) !== 0 || review.comment !== "") continue;
      setReviewStatus(bundle, item.contentid, "approved_as_is", timestamp);
      approvedIds.push(item.contentid);
    }
    return approvedIds;
  }

  function bulkApproveLowRisk(bundle, dataset, timestamp = nowIso()) {
    return bulkApprovePriority(bundle, dataset, "low", timestamp);
  }

  function resolvedGroup(item, review, group) {
    const keys = keysForGroup(group);
    return Object.fromEntries(keys.map((key) => [
      key,
      Object.prototype.hasOwnProperty.call(review.overrides[group], key)
        ? review.overrides[group][key].to
        : item[group][key],
    ]));
  }

  function getResolvedValue(item, review, group, key) {
    return Object.prototype.hasOwnProperty.call(review.overrides[group], key)
      ? review.overrides[group][key].to
      : item[group][key];
  }

  function computeSummary(bundle) {
    const byStatus = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0]));
    let changed = 0;
    for (const review of bundle.reviews) {
      byStatus[review.status] += 1;
      if (countOverrides(review) > 0) changed += 1;
    }
    const approved = byStatus.approved_as_is + byStatus.approved_with_changes;
    const processed = approved + byStatus.needs_research + byStatus.skipped;
    return {
      total: bundle.reviews.length,
      processed,
      approved,
      needs_research: byStatus.needs_research,
      skipped: byStatus.skipped,
      in_progress: byStatus.in_progress,
      unreviewed: byStatus.unreviewed,
      changed,
      by_status: byStatus,
    };
  }

  function itemMatchesFilters(item, review, filters) {
    const query = String(filters.query ?? "").trim().toLocaleLowerCase("ko-KR");
    if (query && !`${item.title} ${item.contentid}`.toLocaleLowerCase("ko-KR").includes(query)) return false;
    if (filters.type && filters.type !== "all" && item.source_place.contenttypeid !== filters.type) return false;
    if (filters.priority && filters.priority !== "all" && item.auto_label?.review_priority !== filters.priority) return false;
    if (filters.status && filters.status !== "all") {
      if (filters.status === "approved") {
        if (!review.status.startsWith("approved_")) return false;
      } else if (review.status !== filters.status) {
        return false;
      }
    }
    if (filters.no_source && item.label_evidence.source_refs.length !== 0) return false;
    if (filters.changed && countOverrides(review) === 0) return false;
    if (filters.companion_null) {
      const resolved = resolvedGroup(item, review, "companion_fit");
      if (!Object.values(resolved).includes(null)) return false;
    }
    if (filters.month_null) {
      const resolved = resolvedGroup(item, review, "month_fit");
      const hasActionableNull = MONTH_KEYS.some((key) => resolved[key] === null && item.auto_label?.month_fit?.[key]?.inference_level !== "not_applicable");
      if (!hasActionableNull) return false;
    }
    return true;
  }

  function filterItems(dataset, bundle, filters) {
    return dataset.items.filter((item, index) => itemMatchesFilters(item, bundle.reviews[index], filters));
  }

  function nextVisibleOpenId(dataset, bundle, filters, currentId) {
    const visible = filterItems(dataset, bundle, filters);
    if (!visible.length) return null;
    const currentSourceIndex = dataset.items.findIndex((item) => item.contentid === currentId);
    const open = visible.filter((item) => {
      const review = bundle.reviews.find((candidate) => candidate.contentid === item.contentid);
      return review && (review.status === "unreviewed" || review.status === "in_progress");
    });
    if (open.length) {
      const afterCurrent = open.find((item) => dataset.items.findIndex((candidate) => candidate.contentid === item.contentid) > currentSourceIndex);
      return (afterCurrent ?? open[0]).contentid;
    }
    return visible.some((item) => item.contentid === currentId) ? currentId : visible[0].contentid;
  }

  function safeExternalUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function validateBundle(bundle, dataset) {
    const errors = [];
    const add = (message) => errors.push(message);
    if (!exactKeys(bundle, ["schema_version", "base", "session", "reviews"])) {
      return { ok: false, errors: ["최상위 검수 파일 구조가 올바르지 않습니다."] };
    }
    if (bundle.schema_version !== SCHEMA_VERSION) add("지원하지 않는 검수 스키마 버전입니다.");
    if (!exactKeys(bundle.base, ["label_version", "profile_path", "profile_sha256", "review_base_sha256", "profile_count"])) {
      add("기준 데이터 정보 구조가 올바르지 않습니다.");
    } else {
      const expectedBase = datasetBase(dataset);
      for (const key of Object.keys(expectedBase)) {
        if (bundle.base[key] !== expectedBase[key]) add(`기준 데이터 ${key}가 현재 100건과 다릅니다.`);
      }
    }
    if (!exactKeys(bundle.session, ["session_id", "ui_version", "created_at", "updated_at", "exported_at"])) {
      add("검수 세션 정보 구조가 올바르지 않습니다.");
    } else {
      if (typeof bundle.session.session_id !== "string" || !bundle.session.session_id || bundle.session.session_id.length > 128) add("세션 ID가 올바르지 않습니다.");
      if (bundle.session.ui_version !== UI_VERSION) add("지원하지 않는 검수 화면 버전입니다.");
      if (!isIsoDateTime(bundle.session.created_at) || !isIsoDateTime(bundle.session.updated_at)) add("세션 시각 형식이 올바르지 않습니다.");
      if (bundle.session.exported_at !== null && !isIsoDateTime(bundle.session.exported_at)) add("내보내기 시각 형식이 올바르지 않습니다.");
    }
    if (!Array.isArray(bundle.reviews) || bundle.reviews.length !== dataset.items.length) {
      add(`검수 항목은 정확히 ${dataset.items.length}건이어야 합니다.`);
      return { ok: false, errors };
    }

    const seenIds = new Set();
    bundle.reviews.forEach((review, index) => {
      const path = `reviews[${index}]`;
      const item = dataset.items[index];
      if (!exactKeys(review, ["contentid", "title_snapshot", "status", "overrides", "comment", "started_at", "updated_at", "completed_at"])) {
        add(`${path} 구조가 올바르지 않습니다.`);
        return;
      }
      if (review.contentid !== item.contentid) add(`${path} contentid 또는 순서가 기준 데이터와 다릅니다.`);
      if (seenIds.has(review.contentid)) add(`${path} contentid가 중복됩니다.`);
      seenIds.add(review.contentid);
      if (review.title_snapshot !== item.title) add(`${path} 장소명 스냅샷이 기준 데이터와 다릅니다.`);
      if (!REVIEW_STATUSES.includes(review.status)) add(`${path} 검수 상태가 올바르지 않습니다.`);
      if (typeof review.comment !== "string" || review.comment.length > MAX_COMMENT_LENGTH) add(`${path} 코멘트가 올바르지 않습니다.`);
      if (!exactKeys(review.overrides, ["companion_fit", "month_fit"])) {
        add(`${path} override 구조가 올바르지 않습니다.`);
        return;
      }

      for (const group of ["companion_fit", "month_fit"]) {
        const allowedKeys = keysForGroup(group);
        const overrides = review.overrides[group];
        if (!isPlainObject(overrides)) {
          add(`${path}.${group} override는 객체여야 합니다.`);
          continue;
        }
        for (const key of Object.keys(overrides)) {
          if (!allowedKeys.includes(key)) {
            add(`${path}.${group}.${key}는 허용되지 않은 축입니다.`);
            continue;
          }
          const change = overrides[key];
          if (!exactKeys(change, ["from", "to"])) {
            add(`${path}.${group}.${key} 변경 구조가 올바르지 않습니다.`);
            continue;
          }
          if (!isLabelValue(change.from) || !isLabelValue(change.to)) add(`${path}.${group}.${key} 값이 허용 척도가 아닙니다.`);
          if (!labelValuesEqual(change.from, item[group][key])) add(`${path}.${group}.${key} AI 기준값이 현재 데이터와 다릅니다.`);
          if (labelValuesEqual(change.from, change.to)) add(`${path}.${group}.${key}에 효과 없는 변경이 있습니다.`);
          if (group === "month_fit" && item.auto_label?.month_fit?.[key]?.inference_level === "not_applicable") {
            add(`${path}.${group}.${key} 개최일 종속 N/A에는 변경값을 둘 수 없습니다.`);
          }
        }
      }

      const overrideCount = countOverrides(review);
      const times = [review.started_at, review.updated_at, review.completed_at];
      if (times.some((value) => value !== null && !isIsoDateTime(value))) add(`${path} 시각 형식이 올바르지 않습니다.`);
      if (review.status === "unreviewed") {
        if (overrideCount || review.comment || times.some((value) => value !== null)) add(`${path} 미검토 항목에 편집 내용이 있습니다.`);
      } else {
        if (review.started_at === null || review.updated_at === null) add(`${path} 편집 시각이 누락되었습니다.`);
      }
      if (review.status === "in_progress" && review.completed_at !== null) add(`${path} 작성 중 항목에 완료 시각이 있습니다.`);
      if (TERMINAL_STATUSES.has(review.status) && review.completed_at === null) add(`${path} 처리된 항목에 완료 시각이 없습니다.`);
      if (review.status === "approved_as_is" && overrideCount !== 0) add(`${path} 원안 승인에 수정값이 있습니다.`);
      if (review.status === "approved_with_changes" && overrideCount === 0) add(`${path} 수정 승인에 수정값이 없습니다.`);
      if ((review.status === "needs_research" || review.status === "skipped") && !review.comment.trim()) add(`${path} 상태 사유 코멘트가 없습니다.`);
    });

    return { ok: errors.length === 0, errors };
  }

  function saveBundle(storage, key, bundle, dataset) {
    const validation = validateBundle(bundle, dataset);
    if (!validation.ok) return { ok: false, error: validation.errors[0] };
    try {
      storage.setItem(key, JSON.stringify(bundle));
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "브라우저 저장에 실패했습니다." };
    }
  }

  function loadBundle(storage, key, dataset) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return { ok: true, bundle: null, reason: "empty" };
      const parsed = JSON.parse(raw);
      const validation = validateBundle(parsed, dataset);
      if (!validation.ok) return { ok: false, bundle: null, reason: validation.errors[0] };
      return { ok: true, bundle: parsed, reason: "loaded" };
    } catch (error) {
      return { ok: false, bundle: null, reason: error instanceof Error ? error.message : "저장값을 읽지 못했습니다." };
    }
  }

  function makeExportBundle(bundle, dataset, timestamp = nowIso()) {
    const exported = clone(bundle);
    exported.session.exported_at = timestamp;
    const validation = validateBundle(exported, dataset);
    if (!validation.ok) throw new Error(validation.errors[0]);
    return exported;
  }

  function parseImportText(text, byteLength, dataset) {
    if (typeof text !== "string") return { ok: false, bundle: null, errors: ["JSON 파일을 텍스트로 읽지 못했습니다."] };
    if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_IMPORT_BYTES) {
      return { ok: false, bundle: null, errors: ["가져오기 파일은 5MB 이하여야 합니다."] };
    }
    try {
      const parsed = JSON.parse(text);
      const validation = validateBundle(parsed, dataset);
      if (validation.ok && parsed.session.exported_at === null) {
        return { ok: false, bundle: null, errors: ["내보내기가 완료된 검수 JSON만 불러올 수 있습니다."] };
      }
      return validation.ok
        ? { ok: true, bundle: parsed, errors: [] }
        : { ok: false, bundle: null, errors: validation.errors };
    } catch {
      return { ok: false, bundle: null, errors: ["올바른 JSON 파일이 아닙니다."] };
    }
  }

  global.TRIP_AI_REVIEW_MODEL = Object.freeze({
    SCHEMA_VERSION,
    UI_VERSION,
    COMPANION_KEYS,
    MONTH_KEYS,
    LABEL_VALUES,
    REVIEW_STATUSES,
    MAX_COMMENT_LENGTH,
    MAX_IMPORT_BYTES,
    isLabelValue,
    labelValuesEqual,
    isIsoDateTime,
    clone,
    nowIso,
    createSessionId,
    createStorageKey,
    createBundle,
    countOverrides,
    setOverride,
    setComment,
    resetReview,
    setReviewStatus,
    completeReview,
    bulkApprovePriority,
    bulkApproveLowRisk,
    resolvedGroup,
    getResolvedValue,
    computeSummary,
    filterItems,
    nextVisibleOpenId,
    safeExternalUrl,
    validateBundle,
    saveBundle,
    loadBundle,
    makeExportBundle,
    parseImportText,
  });
})(globalThis);
