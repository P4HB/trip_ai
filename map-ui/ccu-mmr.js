(function exposeCCUMMR(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CCU_MMR = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createCCUMMR() {
  "use strict";

  const ALGORITHM_VERSION = "ccu-mmr-v0-demo";
  const REQUEST_SCHEMA_VERSION = "ccu-mmr-request-v1";
  const ATOMIC_FEATURES = [
    "mountain", "ocean", "activity", "culture_history", "theme_park", "cafe",
    "traditional_market", "festival", "indoor_ratio", "weather_sensitivity",
    "restfulness", "physical_ease", "visit_duration_flexibility", "scenic_value",
    "distinctiveness", "local_embeddedness", "landmark_significance", "photo_value",
  ];
  const COMPANION_TYPES = ["solo", "couple", "friends", "kids", "parents"];
  const BLOCK_WEIGHTS = Object.freeze({ preference: 0.70, companion: 0.15, month: 0.10, weather: 0.05 });
  const CONFIG = Object.freeze({
    algorithmVersion: ALGORITHM_VERSION,
    executionMode: "internal_experiment",
    datasetStatus: "ai_draft",
    weatherEnabled: false,
    mmrLambda: 0.75,
    candidatePoolSize: 100,
    resultCountDefault: 10,
    blockWeights: BLOCK_WEIGHTS,
    similarityWeights: Object.freeze({ feature: 0.70, sameType: 0.20, sameRegion: 0.10 }),
    softPenalty: 0,
  });
  const INTENT_TYPES = Object.freeze({
    visit: new Set(["12", "14", "25", "28"]),
    shopping: new Set(["38"]),
    stay: new Set(["32"]),
    event: new Set(["15"]),
  });

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function isUnitValue(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  function compareText(a, b) {
    const left = String(a ?? "");
    const right = String(b ?? "");
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function compareStable(a, b, scoreKey) {
    const scoreDifference = Number(b[scoreKey]) - Number(a[scoreKey]);
    if (scoreDifference) return scoreDifference;
    const relevanceDifference = Number(b.relevance) - Number(a.relevance);
    if (scoreKey !== "relevance" && relevanceDifference) return relevanceDifference;
    const orderDifference = Number(a.sourceOrder ?? Number.MAX_SAFE_INTEGER) - Number(b.sourceOrder ?? Number.MAX_SAFE_INTEGER);
    return orderDifference || compareText(a.placeId, b.placeId);
  }

  function parseCalendarDate(value, fieldName) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(value || ""))) {
      throw new Error(`${fieldName}은 YYYY-MM-DD 형식이어야 합니다.`);
    }
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error(`${fieldName}이 유효한 날짜가 아닙니다.`);
    }
    return date;
  }

  function monthDayWeights(travelWindow) {
    if (!travelWindow?.startDate && !travelWindow?.endDate) return null;
    if (!travelWindow?.startDate || !travelWindow?.endDate) {
      throw new Error("여행 시작일과 종료일을 모두 입력해 주세요.");
    }
    const start = parseCalendarDate(travelWindow.startDate, "여행 시작일");
    const end = parseCalendarDate(travelWindow.endDate, "여행 종료일");
    if (start > end) throw new Error("여행 종료일은 시작일보다 빠를 수 없습니다.");
    const dayCount = Math.floor((end - start) / 86400000) + 1;
    if (dayCount > 370) throw new Error("실험 대시보드의 여행 기간은 최대 370일입니다.");
    const daysByMonth = {};
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const month = String(cursor.getUTCMonth() + 1);
      daysByMonth[month] = (daysByMonth[month] || 0) + 1;
    }
    return { daysByMonth, totalDays: dayCount };
  }

  function utilityForPreference(value, preference) {
    if (!isUnitValue(value)) return null;
    if (preference.mode === "benefit") return value;
    if (preference.mode === "avoid") return 1 - value;
    const distance = value - preference.target;
    return Math.exp(-(distance * distance) / (2 * preference.tolerance * preference.tolerance));
  }

  function normalizeRequest(input = {}) {
    const destinationRegion = input.destinationRegion || "jeju_all";
    if (!["jeju_all", "jeju_city", "seogwipo_city"].includes(destinationRegion)) {
      throw new Error("지원하지 않는 추천 지역입니다.");
    }
    const intent = input.intent || "visit";
    if (!["visit", "shopping", "stay", "event"].includes(intent)) {
      throw new Error("지원하지 않는 여행 목적입니다.");
    }
    const companionType = input.companionType || "none";
    if (companionType !== "none" && !COMPANION_TYPES.includes(companionType)) {
      throw new Error("지원하지 않는 대표 동행 유형입니다.");
    }
    const resultCount = Number(input.resultCount ?? CONFIG.resultCountDefault);
    if (!Number.isInteger(resultCount) || resultCount < 1 || resultCount > 20) {
      throw new Error("추천 결과 수는 1~20의 정수여야 합니다.");
    }
    if (input.diversity !== undefined && !["off", "balanced"].includes(input.diversity)) {
      throw new Error("지원하지 않는 다양성 설정입니다.");
    }
    const diversity = input.diversity || "balanced";
    if (input.preferences !== undefined && !Array.isArray(input.preferences)) {
      throw new Error("preferences는 배열이어야 합니다.");
    }
    const preferences = input.preferences || [];
    const seenFeatures = new Set();
    const normalizedPreferences = preferences.map((preference) => {
      const feature = String(preference.feature || "");
      if (!ATOMIC_FEATURES.includes(feature)) throw new Error(`지원하지 않는 원자 라벨입니다: ${feature || "(비어 있음)"}`);
      if (seenFeatures.has(feature)) throw new Error(`같은 원자 라벨을 두 번 선택할 수 없습니다: ${feature}`);
      seenFeatures.add(feature);
      const mode = preference.mode || "benefit";
      if (!["benefit", "avoid", "target"].includes(mode)) throw new Error(`지원하지 않는 선호 모드입니다: ${mode}`);
      const weight = Number(preference.weight);
      if (![1, 2, 4].includes(weight)) throw new Error("선호 중요도는 1, 2, 4 중 하나여야 합니다.");
      const normalized = { feature, mode, weight };
      if (mode === "target") {
        normalized.target = Number(preference.target);
        normalized.tolerance = Number(preference.tolerance);
        if (!isUnitValue(normalized.target)) throw new Error("목표값은 0~1이어야 합니다.");
        if (!Number.isFinite(normalized.tolerance) || normalized.tolerance <= 0) {
          throw new Error("허용 오차는 0보다 커야 합니다.");
        }
      }
      return normalized;
    });
    const travelWindow = input.travelWindow?.startDate || input.travelWindow?.endDate
      ? {
          startDate: input.travelWindow.startDate,
          endDate: input.travelWindow.endDate,
          timezone: "Asia/Seoul",
        }
      : null;
    if (intent === "event" && !travelWindow) throw new Error("축제·행사 추천에는 여행 기간이 필요합니다.");
    const monthWeights = monthDayWeights(travelWindow);
    const excludedPlaceIds = [...new Set((input.excludedPlaceIds || []).map(String).filter(Boolean))];
    const hardConstraints = [...new Set((input.hardConstraints || []).map(String).filter(Boolean))];
    const candidateFilter = {
      query: input.candidateFilter?.query ? String(input.candidateFilter.query) : null,
      contentTypeIds: Array.isArray(input.candidateFilter?.contentTypeIds)
        ? [...new Set(input.candidateFilter.contentTypeIds.map(String))].sort()
        : [],
    };
    return {
      schemaVersion: REQUEST_SCHEMA_VERSION,
      requestId: String(input.requestId || "local-dashboard"),
      destinationRegion,
      intent,
      travelWindow,
      companionType,
      preferences: normalizedPreferences,
      hardConstraints,
      excludedPlaceIds,
      resultCount,
      diversity,
      monthWeights,
      candidateFilter,
    };
  }

  function matchesIntent(place, intent) {
    return INTENT_TYPES[intent]?.has(String(place.type));
  }

  function preferenceComponent(place, preferences) {
    if (!preferences.length) return { requested: false, active: false, value: null, coverage: 0, traces: [] };
    const traces = preferences.map((preference) => {
      const rawValue = place.atomicFeatures?.[preference.feature];
      const utility = utilityForPreference(rawValue, preference);
      return { ...preference, rawValue: isUnitValue(rawValue) ? rawValue : null, utility };
    });
    const usable = traces.filter((trace) => Number.isFinite(trace.utility));
    const requestedWeight = traces.reduce((sum, trace) => sum + trace.weight, 0);
    const usableWeight = usable.reduce((sum, trace) => sum + trace.weight, 0);
    if (!usableWeight) return { requested: true, active: false, value: null, coverage: 0, traces };
    for (const trace of traces) {
      trace.effectiveWeight = Number.isFinite(trace.utility) ? trace.weight / usableWeight : 0;
      trace.contribution = Number.isFinite(trace.utility) ? trace.effectiveWeight * trace.utility : 0;
    }
    return {
      requested: true,
      active: true,
      value: usable.reduce((sum, trace) => sum + trace.weight * trace.utility, 0) / usableWeight,
      coverage: usableWeight / requestedWeight,
      traces,
    };
  }

  function companionComponent(place, companionType) {
    if (companionType === "none") return { requested: false, active: false, value: null, coverage: 0 };
    const value = place.companionScores?.[companionType];
    return { requested: true, active: isUnitValue(value), value: isUnitValue(value) ? value : null, coverage: isUnitValue(value) ? 1 : 0 };
  }

  function monthComponent(place, monthWeights) {
    if (!monthWeights) return { requested: false, active: false, value: null, coverage: 0, daysByMonth: null };
    let weightedSum = 0;
    let usableDays = 0;
    for (const [month, days] of Object.entries(monthWeights.daysByMonth)) {
      const value = place.monthScores?.[month];
      if (!isUnitValue(value)) continue;
      weightedSum += value * days;
      usableDays += days;
    }
    return {
      requested: true,
      active: usableDays > 0,
      value: usableDays > 0 ? weightedSum / usableDays : null,
      coverage: usableDays / monthWeights.totalDays,
      daysByMonth: monthWeights.daysByMonth,
    };
  }

  function scorePlace(place, request) {
    const preference = preferenceComponent(place, request.preferences);
    const companion = companionComponent(place, request.companionType);
    const month = monthComponent(place, request.monthWeights);
    const components = { preference, companion, month, weather: { requested: false, active: false, value: null, coverage: 0 } };
    const requestedKeys = Object.keys(components).filter((key) => components[key].requested);
    const activeKeys = requestedKeys.filter((key) => components[key].active);
    const requestedBaseWeight = requestedKeys.reduce((sum, key) => sum + BLOCK_WEIGHTS[key], 0);
    const activeBaseWeight = activeKeys.reduce((sum, key) => sum + BLOCK_WEIGHTS[key], 0);
    let relevance = 0.5;
    let rankingMode = "exploration";
    if (activeBaseWeight > 0) {
      rankingMode = "personalized";
      relevance = activeKeys.reduce((sum, key) => {
        const effectiveWeight = BLOCK_WEIGHTS[key] / activeBaseWeight;
        components[key].effectiveWeight = effectiveWeight;
        components[key].contribution = effectiveWeight * components[key].value;
        return sum + components[key].contribution;
      }, 0);
    }
    for (const key of Object.keys(components)) {
      components[key].baseWeight = BLOCK_WEIGHTS[key];
      components[key].effectiveWeight ??= 0;
      components[key].contribution ??= 0;
    }
    const requestCoverage = requestedBaseWeight > 0
      ? requestedKeys.reduce((sum, key) => sum + BLOCK_WEIGHTS[key] * components[key].coverage, 0) / requestedBaseWeight
      : 0;
    return {
      placeId: String(place.id),
      title: place.title || "",
      type: String(place.type || ""),
      region: place.region || "unknown",
      sourceOrder: Number(place.sourceOrder ?? Number.MAX_SAFE_INTEGER),
      relevance: clamp(relevance - CONFIG.softPenalty),
      requestCoverage,
      rankingMode,
      components,
      sourceWarningCount: Array.isArray(place.constraints) ? place.constraints.length : 0,
    };
  }

  function featureSimilarity(a, b) {
    let distanceSum = 0;
    let comparable = 0;
    for (const feature of ATOMIC_FEATURES) {
      const left = a.atomicFeatures?.[feature];
      const right = b.atomicFeatures?.[feature];
      if (!isUnitValue(left) || !isUnitValue(right)) continue;
      distanceSum += Math.abs(left - right);
      comparable += 1;
    }
    return comparable ? 1 - distanceSum / comparable : 0;
  }

  function placeSimilarity(a, b) {
    const feature = featureSimilarity(a, b);
    const sameType = a.type && b.type && String(a.type) === String(b.type) ? 1 : 0;
    const sameRegion = a.region && b.region && a.region !== "unknown" && a.region === b.region ? 1 : 0;
    return {
      value: CONFIG.similarityWeights.feature * feature
        + CONFIG.similarityWeights.sameType * sameType
        + CONFIG.similarityWeights.sameRegion * sameRegion,
      feature,
      sameType,
      sameRegion,
    };
  }

  function rank(inputPlaces, requestInput) {
    const request = normalizeRequest(requestInput);
    if (!Array.isArray(inputPlaces)) throw new Error("추천 후보는 배열이어야 합니다.");
    const inputIds = new Set();
    for (const place of inputPlaces) {
      const placeId = String(place?.id || "");
      if (!placeId) throw new Error("추천 후보 placeId가 비어 있습니다.");
      if (inputIds.has(placeId)) throw new Error(`추천 후보 placeId가 중복되었습니다: ${placeId}`);
      inputIds.add(placeId);
    }
    const excludedIds = new Set(request.excludedPlaceIds);
    const placesById = new Map((inputPlaces || []).map((place) => [String(place.id), place]));
    const summary = {
      inputCandidates: inputPlaces?.length || 0,
      excludedByUser: 0,
      filteredByRegion: 0,
      filteredByIntent: 0,
      unscored: 0,
      verificationCandidates: 0,
      scoredCandidates: 0,
      poolSize: 0,
      returned: 0,
    };
    const warnings = [
      "AI 초안 라벨을 사용한 내부 실험 결과이며 장소 품질·영업·안전·방문 가능성을 보장하지 않습니다.",
      "실시간 날씨 데이터가 없어 날씨 블록은 비활성입니다.",
    ];
    const candidates = [];
    const verificationCandidates = [];

    for (const place of inputPlaces || []) {
      const placeId = String(place.id);
      if (excludedIds.has(placeId)) {
        summary.excludedByUser += 1;
        continue;
      }
      if (request.destinationRegion !== "jeju_all" && place.region !== request.destinationRegion) {
        summary.filteredByRegion += 1;
        continue;
      }
      if (!matchesIntent(place, request.intent)) {
        summary.filteredByIntent += 1;
        continue;
      }
      if (!place.recommendationReady) {
        summary.unscored += 1;
        continue;
      }
      const verificationReasons = [];
      if (String(place.type) === "15") verificationReasons.push("event_date_unstructured");
      if (request.hardConstraints.length) verificationReasons.push(...request.hardConstraints.map((key) => `unverified:${key}`));
      if (verificationReasons.length) {
        verificationCandidates.push({
          placeId,
          title: place.title || "",
          sourceOrder: Number(place.sourceOrder ?? Number.MAX_SAFE_INTEGER),
          reasons: verificationReasons,
        });
        continue;
      }
      candidates.push(scorePlace(place, request));
    }

    verificationCandidates.sort((a, b) => a.sourceOrder - b.sourceOrder || compareText(a.placeId, b.placeId));
    summary.verificationCandidates = verificationCandidates.length;
    if (verificationCandidates.length) {
      warnings.push("구조화된 개최일 또는 필수 조건 판정값이 없는 후보는 추천 순위에서 분리했습니다.");
    }
    candidates.sort((a, b) => compareStable(a, b, "relevance"));
    summary.scoredCandidates = candidates.length;
    const pool = candidates.slice(0, CONFIG.candidatePoolSize);
    summary.poolSize = pool.length;
    const selected = [];
    const remaining = [...pool];

    while (remaining.length && selected.length < request.resultCount) {
      if (request.diversity === "off") {
        const candidate = remaining.shift();
        selected.push({ ...candidate, mmrScore: candidate.relevance, maxSimilarity: 0, redundancyPenalty: 0, similarPlaceId: null });
        continue;
      }
      if (!selected.length) {
        const first = remaining.shift();
        selected.push({
          ...first,
          mmrScore: CONFIG.mmrLambda * first.relevance,
          maxSimilarity: 0,
          redundancyPenalty: 0,
          similarPlaceId: null,
        });
        continue;
      }
      const evaluated = remaining.map((candidate) => {
        const candidatePlace = placesById.get(candidate.placeId);
        let maxSimilarity = 0;
        let similarPlaceId = null;
        for (const prior of selected) {
          const similarity = placeSimilarity(candidatePlace, placesById.get(prior.placeId)).value;
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            similarPlaceId = prior.placeId;
          }
        }
        const redundancyPenalty = (1 - CONFIG.mmrLambda) * maxSimilarity;
        return {
          ...candidate,
          maxSimilarity,
          similarPlaceId,
          redundancyPenalty,
          mmrScore: CONFIG.mmrLambda * candidate.relevance - redundancyPenalty,
        };
      });
      evaluated.sort((a, b) => compareStable(a, b, "mmrScore"));
      const winner = evaluated[0];
      selected.push(winner);
      remaining.splice(remaining.findIndex((candidate) => candidate.placeId === winner.placeId), 1);
    }

    const items = selected.map((item, index) => ({ ...item, rank: index + 1 }));
    summary.returned = items.length;
    if (!items.length) warnings.push("현재 조건에서 순위를 계산할 수 있는 추천 후보가 없습니다.");
    if (items.some((item) => item.requestCoverage < 1)) {
      warnings.push("일부 후보는 요청 라벨이 없어 사용 가능한 블록만 재정규화했습니다.");
    }
    return {
      schemaVersion: "ccu-mmr-result-v1",
      algorithmVersion: ALGORITHM_VERSION,
      executionMode: CONFIG.executionMode,
      datasetStatus: CONFIG.datasetStatus,
      request,
      config: CONFIG,
      summary,
      items,
      verificationCandidates,
      warnings,
    };
  }

  return Object.freeze({
    ALGORITHM_VERSION,
    REQUEST_SCHEMA_VERSION,
    ATOMIC_FEATURES,
    COMPANION_TYPES,
    CONFIG,
    normalizeRequest,
    monthDayWeights,
    utilityForPreference,
    featureSimilarity,
    placeSimilarity,
    rank,
  });
});
