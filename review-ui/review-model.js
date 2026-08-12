(function attachReviewModel(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TripAiReviewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReviewModel() {
  "use strict";

  const DATA_SCHEMA = "place-label-review-ui-data-v1";
  const DECISION_SCHEMA = "place-label-review-decisions-v1";
  const SCORE_SCALE = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
  const DECISIONS = Object.freeze(["approve", "override", "keep_null"]);

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function sameValue(left, right) {
    return left === right || (left === null && right === null);
  }

  function isAllowedScore(value) {
    return SCORE_SCALE.includes(value);
  }

  function normalizeText(value, maximum = 4000) {
    const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
    assert(normalized.length <= maximum, `입력은 ${maximum}자를 넘을 수 없습니다.`);
    return normalized;
  }

  function normalizeEvidenceUrl(value) {
    const normalized = normalizeText(value, 2000);
    if (!normalized) return "";
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error("근거 URL 형식이 올바르지 않습니다.");
    }
    assert(parsed.protocol === "https:", "근거 URL은 https:// 주소만 사용할 수 있습니다.");
    return parsed.href;
  }

  function normalizeDateTime(value, fieldName) {
    assert(
      typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value),
      `${fieldName}은 시간대를 포함한 ISO 8601 형식이어야 합니다.`,
    );
    const parsed = new Date(value);
    assert(!Number.isNaN(parsed.getTime()), `${fieldName}이 올바르지 않습니다.`);
    return parsed.toISOString();
  }

  function datasetReference(data) {
    assert(isPlainObject(data), "검토 데이터가 없습니다.");
    assert(data.schema_version === DATA_SCHEMA, "지원하지 않는 검토 데이터 버전입니다.");
    assert(isPlainObject(data.source), "검토 데이터 출처가 없습니다.");
    return {
      snapshot_date: String(data.snapshot_date || ""),
      label_version: String(data.label_version || ""),
      rule_version: String(data.rule_version || ""),
      review_manifest_sha256: String(data.source.review_manifest_sha256 || ""),
      review_queue_sha256: String(data.source.review_queue_sha256 || ""),
    };
  }

  function datasetFingerprint(data) {
    const source = datasetReference(data);
    return [
      source.snapshot_date,
      source.label_version,
      source.rule_version,
      source.review_manifest_sha256,
      source.review_queue_sha256,
    ].join(":");
  }

  function storageKey(data) {
    const source = datasetReference(data);
    return `trip-ai-review:${source.snapshot_date}:${source.review_manifest_sha256.slice(0, 16)}`;
  }

  function itemIndex(data) {
    const items = new Map();
    assert(Array.isArray(data.places), "검토 장소 목록이 없습니다.");
    for (const place of data.places) {
      assert(Array.isArray(place.queue_items), `${place.contentid} 검토 항목이 없습니다.`);
      for (const item of place.queue_items) {
        assert(!items.has(item.review_key), `검토 키가 중복됩니다: ${item.review_key}`);
        items.set(item.review_key, { place, item });
      }
    }
    return items;
  }

  function validateDecisionForItem(decision, place, item) {
    assert(isPlainObject(decision), "판정 형식이 올바르지 않습니다.");
    assert(DECISIONS.includes(decision.decision), "지원하지 않는 판정입니다.");
    assert(decision.review_key === item.review_key, "판정의 review_key가 다릅니다.");
    assert(String(decision.contentid) === String(place.contentid), "판정의 contentid가 다릅니다.");
    assert(decision.label === item.label, "판정의 label이 다릅니다.");
    assert(sameValue(decision.source_value, item.value), "판정의 원본값이 현재 데이터와 다릅니다.");

    if (decision.decision === "approve") {
      assert(item.value !== null, "null 현재값은 승인할 수 없습니다. null 유지를 사용하세요.");
      assert(sameValue(decision.reviewed_value, item.value), "승인값은 현재값과 같아야 합니다.");
    } else if (decision.decision === "override") {
      assert(isAllowedScore(decision.reviewed_value), "수정값이 허용 점수에 없습니다.");
    } else {
      assert(decision.reviewed_value === null, "null 유지 판정값은 null이어야 합니다.");
    }

    const reviewedAt = normalizeDateTime(decision.reviewed_at, "판정 시각");
    return {
      review_key: item.review_key,
      contentid: String(place.contentid),
      label: item.label,
      decision: decision.decision,
      source_value: item.value,
      reviewed_value: decision.reviewed_value,
      note: normalizeText(decision.note),
      evidence_url: normalizeEvidenceUrl(decision.evidence_url),
      reviewed_at: reviewedAt,
    };
  }

  function createDecision({ data, reviewKey, decision, reviewedValue, note, evidenceUrl, now }) {
    const indexed = itemIndex(data).get(reviewKey);
    assert(indexed, `검토 항목을 찾을 수 없습니다: ${reviewKey}`);
    let normalizedValue = reviewedValue;
    if (decision === "approve") normalizedValue = indexed.item.value;
    if (decision === "keep_null") normalizedValue = null;
    const reviewedAt = now instanceof Date ? now : new Date(now || Date.now());
    assert(!Number.isNaN(reviewedAt.getTime()), "판정 시각이 올바르지 않습니다.");
    return validateDecisionForItem(
      {
        review_key: reviewKey,
        contentid: indexed.place.contentid,
        label: indexed.item.label,
        decision,
        source_value: indexed.item.value,
        reviewed_value: normalizedValue,
        note: note || "",
        evidence_url: evidenceUrl || "",
        reviewed_at: reviewedAt.toISOString(),
      },
      indexed.place,
      indexed.item,
    );
  }

  function assertSameDataset(actual, expected) {
    for (const key of Object.keys(expected)) {
      assert(actual?.[key] === expected[key], `판정 파일의 dataset.${key}가 현재 데이터와 다릅니다.`);
    }
  }

  function normalizeDecisionExport(payload, data) {
    assert(isPlainObject(payload), "판정 파일의 최상위 형식이 올바르지 않습니다.");
    assert(payload.schema_version === DECISION_SCHEMA, "지원하지 않는 판정 파일 버전입니다.");
    assertSameDataset(payload.dataset, datasetReference(data));
    const exportedAt = normalizeDateTime(payload.exported_at, "판정 파일의 exported_at");
    assert(Array.isArray(payload.decisions), "판정 목록이 배열이 아닙니다.");
    const indexed = itemIndex(data);
    const normalized = [];
    const keys = new Set();
    for (const decision of payload.decisions) {
      assert(!keys.has(decision.review_key), `판정 키가 중복됩니다: ${decision.review_key}`);
      keys.add(decision.review_key);
      const source = indexed.get(decision.review_key);
      assert(source, `현재 데이터에 없는 판정입니다: ${decision.review_key}`);
      normalized.push(validateDecisionForItem(decision, source.place, source.item));
    }
    return {
      reviewer: normalizeText(payload.reviewer, 100),
      exported_at: exportedAt,
      decisions: normalized,
    };
  }

  function comparePlaceGroups(left, right, decisions) {
    const reviewed = decisions instanceof Map ? decisions : new Map();
    const pendingCount = (group) =>
      group.entries.reduce(
        (count, entry) => count + (reviewed.has(entry.item.review_key) ? 0 : 1),
        0,
      );
    const pendingDifference = pendingCount(right) - pendingCount(left);
    if (pendingDifference) return pendingDifference;
    const minimumPriority = (group) =>
      Math.min(...group.entries.map((entry) => Number(entry.item.priority)));
    const priorityDifference = minimumPriority(left) - minimumPriority(right);
    if (priorityDifference) return priorityDifference;
    const titleDifference = String(left.place.title).localeCompare(String(right.place.title), "ko");
    if (titleDifference) return titleDifference;
    return String(left.place.contentid).localeCompare(String(right.place.contentid), "en", {
      numeric: true,
    });
  }

  function createDecisionExport({ data, decisions, reviewer, now }) {
    const indexed = itemIndex(data);
    const normalized = [];
    const values = decisions instanceof Map ? [...decisions.values()] : Array.from(decisions || []);
    for (const decision of values) {
      const source = indexed.get(decision.review_key);
      assert(source, `현재 데이터에 없는 판정입니다: ${decision.review_key}`);
      normalized.push(validateDecisionForItem(decision, source.place, source.item));
    }
    normalized.sort((left, right) => left.review_key.localeCompare(right.review_key));
    const exportedAt = now instanceof Date ? now : new Date(now || Date.now());
    assert(!Number.isNaN(exportedAt.getTime()), "내보내기 시각이 올바르지 않습니다.");
    return {
      schema_version: DECISION_SCHEMA,
      dataset: datasetReference(data),
      reviewer: normalizeText(reviewer, 100),
      exported_at: exportedAt.toISOString(),
      decisions: normalized,
    };
  }

  return Object.freeze({
    DATA_SCHEMA,
    DECISION_SCHEMA,
    SCORE_SCALE,
    DECISIONS,
    createDecision,
    createDecisionExport,
    comparePlaceGroups,
    datasetFingerprint,
    datasetReference,
    itemIndex,
    normalizeDecisionExport,
    normalizeEvidenceUrl,
    storageKey,
  });
});
