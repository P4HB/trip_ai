(function exposeCCUMMR(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CCU_MMR = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createCCUMMR() {
  "use strict";

  const ALGORITHM_VERSION = "ccu-mmr-v6-travel-mbti-three-axis";
  const REQUEST_SCHEMA_VERSION = "ccu-mmr-request-v2";
  const PERSONALIZED_REQUEST_SCHEMA_VERSION = "ccu-mmr-request-v4-personalized";
  const PREFERENCE_PROFILE_SCHEMA_VERSION = "traveler-preference-profile-v2-three-axis";
  const RESULT_SCHEMA_VERSION = "ccu-mmr-result-v6";
  const SEED_SELECTION_WEIGHTS = Object.freeze([0.5, 0.3, 0.2]);
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
    seedSelection: Object.freeze({
      strategy: "weighted-precomputed-top-relevance-3",
      weights: SEED_SELECTION_WEIGHTS,
    }),
    courseVariantCount: 3,
    diversityFeaturePolicy: "exclude-requested-preference-features-v1",
    softPenalty: 0,
    schedule: Object.freeze({
      method: "center-radius-capacity-v3-course-anchor",
      carRadiusKm: 15,
      noCarRadiusKm: 5,
      capacityMode: "place_count",
      dailyCapacity: 6,
      centerWeight: 0.20,
      anchorCandidateLimit: 12,
    }),
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

  function selectWeightedSeed(candidates, random = Math.random) {
    if (!Array.isArray(candidates)) throw new Error("seed 후보는 배열이어야 합니다.");
    const topCandidates = candidates.slice(0, SEED_SELECTION_WEIGHTS.length);
    if (!topCandidates.length) {
      return {
        candidate: null,
        trace: {
          strategy: CONFIG.seedSelection.strategy,
          applied: false,
          reason: "no_candidates",
          randomValue: null,
          candidates: [],
          selectedPlaceId: null,
          selectedVariantId: null,
          selectedRelevanceRank: null,
          selectedProbability: null,
        },
      };
    }
    if (typeof random !== "function") throw new Error("seed 난수 생성기는 함수여야 합니다.");
    const randomValue = Number(random());
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new Error("seed 난수값은 0 이상 1 미만이어야 합니다.");
    }
    const weights = SEED_SELECTION_WEIGHTS.slice(0, topCandidates.length);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const traceCandidates = topCandidates.map((candidate, index) => ({
      placeId: String(candidate.placeId),
      variantId: candidate.variantId || null,
      relevanceRank: index + 1,
      weight: weights[index],
      probability: weights[index] / totalWeight,
    }));
    let selectedIndex = traceCandidates.length - 1;
    let cumulativeProbability = 0;
    for (let index = 0; index < traceCandidates.length; index += 1) {
      cumulativeProbability += traceCandidates[index].probability;
      if (randomValue < cumulativeProbability) {
        selectedIndex = index;
        break;
      }
    }
    const selected = traceCandidates[selectedIndex];
    return {
      candidate: topCandidates[selectedIndex],
      trace: {
        strategy: CONFIG.seedSelection.strategy,
        applied: true,
        reason: null,
        randomValue,
        candidates: traceCandidates,
        selectedPlaceId: selected.placeId,
        selectedVariantId: selected.variantId,
        selectedRelevanceRank: selected.relevanceRank,
        selectedProbability: selected.probability,
      },
    };
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

  function normalizeIdList(value, fieldName) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${fieldName}는 배열이어야 합니다.`);
    return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
  }

  function normalizeRequest(input = {}) {
    const requestSchemaVersion = input.schemaVersion || REQUEST_SCHEMA_VERSION;
    if (![REQUEST_SCHEMA_VERSION, PERSONALIZED_REQUEST_SCHEMA_VERSION].includes(requestSchemaVersion)) {
      throw new Error(`지원하지 않는 추천 요청 버전입니다: ${requestSchemaVersion}`);
    }
    const personalized = requestSchemaVersion === PERSONALIZED_REQUEST_SCHEMA_VERSION;
    let preferenceProfile = null;
    if (personalized) {
      if (!input.preferenceProfile || input.preferenceProfile.schemaVersion !== PREFERENCE_PROFILE_SCHEMA_VERSION) {
        throw new Error("개인화 요청에는 유효한 여행 취향 프로필이 필요합니다.");
      }
      preferenceProfile = JSON.parse(JSON.stringify(input.preferenceProfile));
    } else if (input.preferenceProfile !== undefined) {
      throw new Error("여행 취향 프로필은 개인화 요청 버전에서만 사용할 수 있습니다.");
    }
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
      if (personalized) {
        if (!Number.isFinite(weight) || weight <= 0 || weight > 4) {
          throw new Error("개인화 선호 중요도는 0보다 크고 4 이하여야 합니다.");
        }
      } else if (![1, 2, 4].includes(weight)) {
        throw new Error("선호 중요도는 1, 2, 4 중 하나여야 합니다.");
      }
      const normalized = { feature, mode, weight };
      if (personalized) {
        const confidence = Number(preference.confidence);
        if (!isUnitValue(confidence)) throw new Error("개인화 선호 confidence는 0~1이어야 합니다.");
        const source = String(preference.source || "");
        if (!["quiz", "pairwise", "quiz_pairwise", "manual_override"].includes(source)) {
          throw new Error(`지원하지 않는 개인화 선호 출처입니다: ${source || "(비어 있음)"}`);
        }
        normalized.confidence = confidence;
        normalized.source = source;
      }
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
    const requestedPreferenceFeatures = new Set(normalizedPreferences.map((preference) => preference.feature));
    const diversityFeatureKeys = ATOMIC_FEATURES.filter((feature) => !requestedPreferenceFeatures.has(feature));
    const travelWindow = input.travelWindow?.startDate || input.travelWindow?.endDate
      ? {
          startDate: input.travelWindow.startDate,
          endDate: input.travelWindow.endDate,
          timezone: "Asia/Seoul",
        }
      : null;
    if (intent === "event" && !travelWindow) throw new Error("축제·행사 추천에는 여행 기간이 필요합니다.");
    const monthWeights = monthDayWeights(travelWindow);
    const excludedPlaceIds = normalizeIdList(input.excludedPlaceIds, "excludedPlaceIds");
    const requiredPlaceIds = normalizeIdList(input.requiredPlaceIds, "requiredPlaceIds");
    const anchorPlaceIds = normalizeIdList(input.anchorPlaceIds, "anchorPlaceIds");
    const hardConstraints = normalizeIdList(input.hardConstraints, "hardConstraints");
    const transportMode = input.transportMode || "car";
    if (!["car", "no_car"].includes(transportMode)) {
      throw new Error("이동수단은 자차 또는 비자차여야 합니다.");
    }
    const overlap = requiredPlaceIds.find((placeId) => excludedPlaceIds.includes(placeId));
    if (overlap) throw new Error(`필수 장소와 제외 장소가 중복되었습니다: ${overlap}`);
    const anchorRequiredOverlap = anchorPlaceIds.find((placeId) => requiredPlaceIds.includes(placeId));
    if (anchorRequiredOverlap) throw new Error(`필수 장소는 추가 중심지로 다시 선택할 수 없습니다: ${anchorRequiredOverlap}`);
    const anchorExcludedOverlap = anchorPlaceIds.find((placeId) => excludedPlaceIds.includes(placeId));
    if (anchorExcludedOverlap) throw new Error(`제외 장소는 추가 중심지로 선택할 수 없습니다: ${anchorExcludedOverlap}`);
    const candidateFilter = {
      query: input.candidateFilter?.query ? String(input.candidateFilter.query) : null,
      contentTypeIds: Array.isArray(input.candidateFilter?.contentTypeIds)
        ? [...new Set(input.candidateFilter.contentTypeIds.map(String))].sort()
        : [],
    };
    return {
      schemaVersion: requestSchemaVersion,
      requestId: String(input.requestId || "local-dashboard"),
      destinationRegion,
      intent,
      travelWindow,
      transportMode,
      companionType,
      preferences: normalizedPreferences,
      ...(personalized ? { preferenceProfile } : {}),
      diversityFeatureKeys,
      hardConstraints,
      excludedPlaceIds,
      requiredPlaceIds,
      anchorPlaceIds,
      resultCount,
      diversity,
      monthWeights,
      scheduleConfig: {
        tripDays: monthWeights?.totalDays || 0,
        radiusKm: transportMode === "car" ? CONFIG.schedule.carRadiusKm : CONFIG.schedule.noCarRadiusKm,
        capacityMode: CONFIG.schedule.capacityMode,
        dailyCapacity: CONFIG.schedule.dailyCapacity,
        centerWeight: CONFIG.schedule.centerWeight,
      },
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

  function featureSimilarity(a, b, featureKeys = ATOMIC_FEATURES) {
    let distanceSum = 0;
    let comparable = 0;
    for (const feature of featureKeys) {
      const left = a.atomicFeatures?.[feature];
      const right = b.atomicFeatures?.[feature];
      if (!isUnitValue(left) || !isUnitValue(right)) continue;
      distanceSum += Math.abs(left - right);
      comparable += 1;
    }
    return comparable ? 1 - distanceSum / comparable : 0;
  }

  function placeSimilarity(a, b, featureKeys = ATOMIC_FEATURES) {
    const feature = featureSimilarity(a, b, featureKeys);
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

  function summarizeCourseVariant(variant) {
    return {
      variantId: variant.variantId,
      seedPlaceId: variant.seedPlaceId,
      seedRelevanceRank: variant.seedRelevanceRank,
      baseProbability: variant.baseProbability,
      placeIds: variant.items.map((item) => item.placeId),
      averageRelevance: variant.items.length
        ? variant.items.reduce((sum, item) => sum + item.relevance, 0) / variant.items.length
        : null,
    };
  }

  function buildMmrVariant(pool, placesById, request, seedIndex, baseProbability) {
    const seed = pool[seedIndex] || null;
    const variantId = request.diversity === "off" ? "relevance-order" : `seed-rank-${seedIndex + 1}`;
    if (!seed) {
      return { variantId, seedPlaceId: null, seedRelevanceRank: null, baseProbability: null, items: [] };
    }
    if (request.diversity === "off") {
      const items = pool.slice(0, request.resultCount).map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
        mmrScore: candidate.relevance,
        maxSimilarity: 0,
        redundancyPenalty: 0,
        similarPlaceId: null,
      }));
      return { variantId, seedPlaceId: seed.placeId, seedRelevanceRank: 1, baseProbability: 1, items };
    }

    const selected = [{
      ...seed,
      mmrScore: CONFIG.mmrLambda * seed.relevance,
      maxSimilarity: 0,
      redundancyPenalty: 0,
      similarPlaceId: null,
      seedRelevanceRank: seedIndex + 1,
      seedSelectionProbability: baseProbability,
    }];
    const remaining = pool.filter((candidate) => candidate.placeId !== seed.placeId);
    while (remaining.length && selected.length < request.resultCount) {
      const evaluated = remaining.map((candidate) => {
        const candidatePlace = placesById.get(candidate.placeId);
        let maxSimilarity = 0;
        let similarPlaceId = null;
        for (const prior of selected) {
          const similarity = placeSimilarity(
            candidatePlace,
            placesById.get(prior.placeId),
            request.diversityFeatureKeys,
          ).value;
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
    return {
      variantId,
      seedPlaceId: seed.placeId,
      seedRelevanceRank: seedIndex + 1,
      baseProbability,
      items: selected.map((item, index) => ({ ...item, rank: index + 1 })),
    };
  }

  function buildCourseVariants(pool, placesById, request) {
    if (!pool.length) return [];
    if (request.diversity === "off") return [buildMmrVariant(pool, placesById, request, 0, 1)];
    const seedCount = Math.min(CONFIG.courseVariantCount, pool.length);
    const weights = SEED_SELECTION_WEIGHTS.slice(0, seedCount);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return Array.from({ length: seedCount }, (_, seedIndex) => buildMmrVariant(
      pool,
      placesById,
      request,
      seedIndex,
      weights[seedIndex] / totalWeight,
    ));
  }

  function courseOverlapTrace(previousPlaceIds = [], currentPlaceIds = []) {
    const previous = new Set(previousPlaceIds.map(String));
    const current = currentPlaceIds.map(String);
    const overlapCount = current.filter((placeId) => previous.has(placeId)).length;
    const denominator = Math.max(previousPlaceIds.length, current.length, 1);
    return {
      overlapCount,
      overlapRate: overlapCount / denominator,
      changedPlaceCount: denominator - overlapCount,
    };
  }

  function selectNextCourseVariant(courseVariants, shownVariantIds = [], currentVariantId = null) {
    const ordered = [...courseVariants].sort((left, right) => (
      left.seedRelevanceRank - right.seedRelevanceRank
      || compareText(left.variantId, right.variantId)
    ));
    const shown = new Set([...shownVariantIds].map(String));
    let candidates = ordered.filter((variant) => (
      variant.variantId !== currentVariantId && !shown.has(variant.variantId)
    ));
    let cycleRestarted = false;
    if (!candidates.length) {
      cycleRestarted = true;
      candidates = ordered.filter((variant) => variant.variantId !== currentVariantId);
    }
    return {
      variantId: candidates[0]?.variantId || null,
      cycleRestarted,
    };
  }

  function hasCoordinates(place) {
    return Number.isFinite(Number(place?.lat)) && Number.isFinite(Number(place?.lng));
  }

  function haversineKm(left, right) {
    if (!hasCoordinates(left) || !hasCoordinates(right)) return Number.POSITIVE_INFINITY;
    const toRadians = (degrees) => Number(degrees) * Math.PI / 180;
    const lat1 = toRadians(left.lat);
    const lat2 = toRadians(right.lat);
    const deltaLat = lat2 - lat1;
    const deltaLng = toRadians(right.lng) - toRadians(left.lng);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function sphericalCenter(inputPlaces) {
    if (!inputPlaces.length || inputPlaces.some((place) => !hasCoordinates(place))) return null;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const place of inputPlaces) {
      const lat = Number(place.lat) * Math.PI / 180;
      const lng = Number(place.lng) * Math.PI / 180;
      x += Math.cos(lat) * Math.cos(lng);
      y += Math.cos(lat) * Math.sin(lng);
      z += Math.sin(lat);
    }
    const horizontal = Math.sqrt(x * x + y * y);
    return {
      lat: Math.atan2(z, horizontal) * 180 / Math.PI,
      lng: Math.atan2(y, x) * 180 / Math.PI,
    };
  }

  function clusterFromIds(placeIds, placesById, fixedCenter = null) {
    const sortedIds = [...placeIds].map(String).sort(compareText);
    const clusterPlaces = sortedIds.map((placeId) => placesById.get(placeId));
    const center = fixedCenter || sphericalCenter(clusterPlaces);
    const maxCenterDistanceKm = center
      ? Math.max(0, ...clusterPlaces.map((place) => haversineKm(center, place)))
      : Number.POSITIVE_INFINITY;
    return { placeIds: sortedIds, center, maxCenterDistanceKm };
  }

  function clusterRequiredPlaces(requiredPlaceIds, placesById, radiusKm) {
    const clusters = requiredPlaceIds.map((placeId) => clusterFromIds([placeId], placesById));
    const epsilon = 1e-9;
    while (clusters.length > 1) {
      let best = null;
      for (let leftIndex = 0; leftIndex < clusters.length - 1; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
          const merged = clusterFromIds(
            [...clusters[leftIndex].placeIds, ...clusters[rightIndex].placeIds],
            placesById,
          );
          if (merged.maxCenterDistanceKm > radiusKm + epsilon) continue;
          const key = merged.placeIds.join("|");
          if (!best
            || merged.maxCenterDistanceKm < best.cluster.maxCenterDistanceKm - epsilon
            || (Math.abs(merged.maxCenterDistanceKm - best.cluster.maxCenterDistanceKm) <= epsilon
              && compareText(key, best.key) < 0)) {
            best = { leftIndex, rightIndex, cluster: merged, key };
          }
        }
      }
      if (!best) break;
      clusters.splice(best.rightIndex, 1);
      clusters.splice(best.leftIndex, 1, best.cluster);
    }
    return clusters.sort((a, b) => compareText(a.placeIds[0], b.placeIds[0]));
  }

  function bearingFromCenter(center, place) {
    const deltaLng = (Number(place.lng) - center.lng) * Math.PI / 180;
    const lat1 = center.lat * Math.PI / 180;
    const lat2 = Number(place.lat) * Math.PI / 180;
    return Math.atan2(
      Math.sin(deltaLng) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng),
    );
  }

  function splitClustersByCapacity(geographicClusters, placesById, dailyCapacity) {
    const dayClusters = [];
    geographicClusters.forEach((geographicCluster, geographicClusterIndex) => {
      const ordered = [...geographicCluster.placeIds].sort((leftId, rightId) => {
        const bearingDifference = bearingFromCenter(geographicCluster.center, placesById.get(leftId))
          - bearingFromCenter(geographicCluster.center, placesById.get(rightId));
        return bearingDifference || compareText(leftId, rightId);
      });
      for (let offset = 0; offset < ordered.length; offset += dailyCapacity) {
        const requiredPlaceIds = ordered.slice(offset, offset + dailyCapacity);
        const child = clusterFromIds(requiredPlaceIds, placesById, geographicCluster.center);
        dayClusters.push({
          center: child.center,
          centerType: "required_centroid",
          anchorPlaceId: null,
          requiredPlaceIds,
          recommendedPlaceIds: [],
          maxCenterDistanceKm: child.maxCenterDistanceKm,
          geographicClusterIndex,
        });
      }
    });
    return dayClusters;
  }

  function outsideAllCenters(place, clusters, radiusKm) {
    return hasCoordinates(place)
      && clusters.every((cluster) => haversineKm(cluster.center, place) > radiusKm + 1e-9);
  }

  function dateForDay(startDate, dayIndex) {
    if (!startDate) return null;
    const date = parseCalendarDate(startDate, "여행 시작일");
    date.setUTCDate(date.getUTCDate() + dayIndex);
    return date.toISOString().slice(0, 10);
  }

  function chooseDayRecommendations(dayCluster, scoredCandidates, placesById, usedPlaceIds, request, preferredPlaceIds = new Set()) {
    const selectedIds = [
      ...dayCluster.requiredPlaceIds,
      ...(dayCluster.anchorPlaceId ? [dayCluster.anchorPlaceId] : []),
    ];
    const recommended = [];
    while (selectedIds.length < request.scheduleConfig.dailyCapacity) {
      const evaluated = [];
      for (const candidate of scoredCandidates) {
        if (usedPlaceIds.has(candidate.placeId)) continue;
        const candidatePlace = placesById.get(candidate.placeId);
        const distanceKm = haversineKm(dayCluster.center, candidatePlace);
        if (distanceKm > request.scheduleConfig.radiusKm + 1e-9) continue;
        const centerFit = Math.max(0, 1 - distanceKm / request.scheduleConfig.radiusKm);
        const dayRelevance = (1 - request.scheduleConfig.centerWeight) * candidate.relevance
          + request.scheduleConfig.centerWeight * centerFit;
        let maxSimilarity = 0;
        let similarPlaceId = null;
        for (const selectedId of selectedIds) {
          const similarity = featureSimilarity(candidatePlace, placesById.get(selectedId), request.diversityFeatureKeys);
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            similarPlaceId = selectedId;
          }
        }
        const mmrScore = CONFIG.mmrLambda * dayRelevance - (1 - CONFIG.mmrLambda) * maxSimilarity;
        evaluated.push({
          ...candidate,
          distanceKm,
          centerFit,
          dayRelevance,
          maxSimilarity,
          similarPlaceId,
          mmrScore,
          variantPreferred: preferredPlaceIds.has(candidate.placeId),
        });
      }
      if (!evaluated.length) break;
      const preferred = evaluated.filter((candidate) => candidate.variantPreferred);
      const selectionPool = preferred.length ? preferred : evaluated;
      selectionPool.sort((a, b) => compareStable(a, b, "mmrScore"));
      const winner = selectionPool[0];
      selectedIds.push(winner.placeId);
      usedPlaceIds.add(winner.placeId);
      recommended.push(winner);
    }
    return recommended;
  }

  function buildSchedule(scoredCandidates, placesById, request, courseVariant = null) {
    const tripDays = request.scheduleConfig.tripDays;
    const radiusKm = request.scheduleConfig.radiusKm;
    const dailyCapacity = request.scheduleConfig.dailyCapacity;
    const base = {
      method: CONFIG.schedule.method,
      status: tripDays ? "needs_anchor_selection" : "not_requested",
      approximation: "center_to_place_haversine",
      tripDays,
      transportMode: request.transportMode,
      radiusKm,
      capacityMode: request.scheduleConfig.capacityMode,
      dailyCapacity,
      geographicClusterCount: 0,
      requiredDayClusterCount: 0,
      selectedAnchorCount: 0,
      autoAnchorCount: 0,
      autoAnchorIds: [],
      autoAnchors: [],
      unfilledDayCount: tripDays,
      courseVariantId: courseVariant?.variantId || null,
      variantSeedPlaceId: courseVariant?.seedPlaceId || null,
      dayClusters: [],
      anchorCandidates: [],
      violations: [],
    };
    if (!tripDays) return base;

    const scoreById = new Map(scoredCandidates.map((candidate) => [candidate.placeId, candidate]));
    const requestedIds = [...request.requiredPlaceIds, ...request.anchorPlaceIds];
    for (const placeId of requestedIds) {
      const place = placesById.get(placeId);
      if (!place) throw new Error(`일정 장소 ID를 후보 데이터에서 찾을 수 없습니다: ${placeId}`);
      if (!scoreById.has(placeId)) throw new Error(`일정 장소가 현재 지역·목적·필수조건을 통과하지 못했습니다: ${placeId}`);
      if (!hasCoordinates(place)) throw new Error(`일정 장소 좌표가 없습니다: ${placeId}`);
    }

    const geographicClusters = clusterRequiredPlaces(request.requiredPlaceIds, placesById, radiusKm);
    let dayClusters = splitClustersByCapacity(geographicClusters, placesById, dailyCapacity);
    base.geographicClusterCount = geographicClusters.length;
    base.requiredDayClusterCount = dayClusters.length;
    if (dayClusters.length > tripDays) {
      base.status = "infeasible";
      base.unfilledDayCount = 0;
      base.violations.push({
        code: "required_clusters_exceed_trip_days",
        message: `필수 장소에 필요한 일자 ${dayClusters.length}일이 여행일 ${tripDays}일을 초과합니다.`,
      });
    }

    if (base.status !== "infeasible") {
      if (dayClusters.length + request.anchorPlaceIds.length > tripDays) {
        throw new Error("선택한 추가 중심지 수가 남은 여행일 수를 초과합니다.");
      }
      for (const anchorPlaceId of request.anchorPlaceIds) {
        const anchor = placesById.get(anchorPlaceId);
        if (!outsideAllCenters(anchor, dayClusters, radiusKm)) {
          throw new Error(`추가 중심지는 기존 모든 중심에서 ${radiusKm}km 밖이어야 합니다: ${anchorPlaceId}`);
        }
        dayClusters.push({
          center: { lat: Number(anchor.lat), lng: Number(anchor.lng) },
          centerType: "user_anchor",
          anchorPlaceId,
          anchorSource: "user",
          requiredPlaceIds: [],
          recommendedPlaceIds: [],
          maxCenterDistanceKm: 0,
          geographicClusterIndex: null,
        });
      }
      base.selectedAnchorCount = request.anchorPlaceIds.length;
    }

    const occupiedIds = new Set([
      ...request.requiredPlaceIds,
      ...request.anchorPlaceIds,
    ]);
    if (base.status !== "infeasible") {
      const addAutomaticAnchor = (candidate, source) => {
        if (!candidate || dayClusters.length >= tripDays || occupiedIds.has(candidate.placeId)) return false;
        const place = placesById.get(candidate.placeId);
        if (!place || !scoreById.has(candidate.placeId) || !outsideAllCenters(place, dayClusters, radiusKm)) return false;
        dayClusters.push({
          center: { lat: Number(place.lat), lng: Number(place.lng) },
          centerType: source === "variant" ? "variant_anchor" : "fallback_anchor",
          anchorPlaceId: candidate.placeId,
          anchorSource: source,
          requiredPlaceIds: [],
          recommendedPlaceIds: [],
          maxCenterDistanceKm: 0,
          geographicClusterIndex: null,
        });
        occupiedIds.add(candidate.placeId);
        base.autoAnchors.push({ placeId: candidate.placeId, source });
        return true;
      };

      if (request.diversity === "balanced" && courseVariant) {
        for (const placeId of courseVariant.placeIds) {
          if (dayClusters.length >= tripDays) break;
          addAutomaticAnchor(scoreById.get(placeId), "variant");
        }
        for (const candidate of scoredCandidates) {
          if (dayClusters.length >= tripDays) break;
          addAutomaticAnchor(candidate, "relevance_fallback");
        }
      }

      base.autoAnchorIds = base.autoAnchors.map((anchor) => anchor.placeId);
      base.autoAnchorCount = base.autoAnchorIds.length;
      base.unfilledDayCount = Math.max(0, tripDays - dayClusters.length);
      base.status = base.unfilledDayCount ? "needs_anchor_selection" : "feasible";
      base.anchorCandidates = scoredCandidates
        .filter((candidate) => !occupiedIds.has(candidate.placeId))
        .filter((candidate) => outsideAllCenters(placesById.get(candidate.placeId), dayClusters, radiusKm))
        .slice(0, CONFIG.schedule.anchorCandidateLimit)
        .map((candidate) => ({
          placeId: candidate.placeId,
          title: candidate.title,
          relevance: candidate.relevance,
          region: candidate.region,
        }));
      if (base.unfilledDayCount && !base.anchorCandidates.length) {
        base.violations.push({ code: "no_anchor_candidates", message: "기존 중심 반경 밖에서 추가 중심 후보를 찾지 못했습니다." });
      }
    }

    const usedPlaceIds = new Set(occupiedIds);
    const preferredPlaceIds = new Set(courseVariant?.placeIds || []);
    base.dayClusters = dayClusters.map((cluster, index) => {
      const recommendations = base.status === "infeasible"
        ? []
        : chooseDayRecommendations(cluster, scoredCandidates, placesById, usedPlaceIds, request, preferredPlaceIds);
      cluster.recommendedPlaceIds = recommendations.map((item) => item.placeId);
      const allPlaceIds = [
        ...cluster.requiredPlaceIds,
        ...(cluster.anchorPlaceId ? [cluster.anchorPlaceId] : []),
        ...cluster.recommendedPlaceIds,
      ];
      return {
        dayIndex: index + 1,
        date: index < tripDays ? dateForDay(request.travelWindow?.startDate, index) : null,
        center: cluster.center,
        centerType: cluster.centerType,
        anchorPlaceId: cluster.anchorPlaceId,
        anchorSource: cluster.anchorSource || null,
        requiredPlaceIds: cluster.requiredPlaceIds,
        recommendedPlaceIds: cluster.recommendedPlaceIds,
        placeIds: allPlaceIds,
        places: allPlaceIds.map((placeId) => ({
          placeId,
          title: placesById.get(placeId)?.title || placeId,
          role: cluster.requiredPlaceIds.includes(placeId)
            ? "required"
            : placeId === cluster.anchorPlaceId ? "anchor" : "recommended",
          distanceKm: haversineKm(cluster.center, placesById.get(placeId)),
          relevance: scoreById.get(placeId)?.relevance ?? null,
          dayMmrScore: recommendations.find((item) => item.placeId === placeId)?.mmrScore ?? null,
          variantPreferred: preferredPlaceIds.has(placeId),
        })),
        usedCapacity: allPlaceIds.length,
        remainingCapacity: Math.max(0, dailyCapacity - allPlaceIds.length),
        maxCenterDistanceKm: Math.max(0, ...allPlaceIds.map((placeId) => haversineKm(cluster.center, placesById.get(placeId)))),
      };
    });
    return base;
  }

  function rank(inputPlaces, requestInput, runtime = {}) {
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
    const variantRecords = buildCourseVariants(pool, placesById, request);
    const courseVariants = variantRecords.map(summarizeCourseVariant);
    summary.variantCount = courseVariants.length;
    let selectedVariant = null;
    let seedSelection = {
      strategy: CONFIG.seedSelection.strategy,
      applied: false,
      reason: request.diversity === "off" ? "diversity_off" : "no_candidates",
      selectionMode: request.diversity === "off" ? "relevance_order" : "none",
      randomValue: null,
      candidates: [],
      selectedPlaceId: null,
      selectedVariantId: null,
      selectedRelevanceRank: null,
      selectedProbability: null,
    };

    if (variantRecords.length) {
      if (request.diversity === "off") {
        selectedVariant = variantRecords[0];
        const onlyVariant = courseVariants[0];
        seedSelection.candidates = [{
          placeId: onlyVariant.seedPlaceId,
          variantId: onlyVariant.variantId,
          relevanceRank: 1,
          weight: 1,
          probability: 1,
        }];
        seedSelection.selectedPlaceId = onlyVariant.seedPlaceId;
        seedSelection.selectedVariantId = onlyVariant.variantId;
        seedSelection.selectedRelevanceRank = 1;
        seedSelection.selectedProbability = 1;
      } else if (runtime.variantId !== undefined && runtime.variantId !== null) {
        const requestedVariantId = String(runtime.variantId);
        selectedVariant = variantRecords.find((variant) => variant.variantId === requestedVariantId) || null;
        if (!selectedVariant) throw new Error(`지원하지 않는 코스 variant입니다: ${requestedVariantId}`);
        const selectedSummary = summarizeCourseVariant(selectedVariant);
        seedSelection = {
          strategy: CONFIG.seedSelection.strategy,
          applied: true,
          reason: "explicit_variant",
          selectionMode: "explicit_variant",
          randomValue: null,
          candidates: courseVariants.map((variant, index) => ({
            placeId: variant.seedPlaceId,
            variantId: variant.variantId,
            relevanceRank: variant.seedRelevanceRank,
            weight: SEED_SELECTION_WEIGHTS[index],
            probability: variant.baseProbability,
          })),
          selectedPlaceId: selectedSummary.seedPlaceId,
          selectedVariantId: selectedSummary.variantId,
          selectedRelevanceRank: selectedSummary.seedRelevanceRank,
          selectedProbability: selectedSummary.baseProbability,
        };
      } else {
        const seedCandidates = courseVariants.map((variant) => ({
          placeId: variant.seedPlaceId,
          variantId: variant.variantId,
        }));
        const seed = selectWeightedSeed(seedCandidates, runtime.random || Math.random);
        selectedVariant = variantRecords.find((variant) => variant.variantId === seed.trace.selectedVariantId) || null;
        seedSelection = { ...seed.trace, selectionMode: "initial_weighted" };
      }
    }

    const courseVariant = selectedVariant ? summarizeCourseVariant(selectedVariant) : null;
    const items = selectedVariant?.items || [];
    summary.returned = items.length;
    const schedule = buildSchedule(candidates, placesById, request, courseVariant);
    summary.scheduleStatus = schedule.status;
    summary.scheduledDays = schedule.dayClusters.length;
    if (!items.length) warnings.push("현재 조건에서 순위를 계산할 수 있는 추천 후보가 없습니다.");
    if (items.some((item) => item.requestCoverage < 1)) {
      warnings.push("일부 후보는 요청 라벨이 없어 사용 가능한 블록만 재정규화했습니다.");
    }
    if (schedule.status !== "not_requested") {
      warnings.push(`일정은 실제 도로시간이 아닌 중심-장소 Haversine 직선거리(${schedule.radiusKm}km)와 하루 ${schedule.dailyCapacity}곳으로 만든 근사 군집입니다.`);
    }
    if (schedule.status === "needs_anchor_selection") {
      warnings.push(`비어 있는 ${schedule.unfilledDayCount}일의 추가 중심 장소를 선택해야 합니다.`);
    }
    if (schedule.status === "infeasible") {
      warnings.push("필수 장소를 현재 여행일·반경·하루 capacity 안에 모두 배치할 수 없습니다.");
    }
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
      executionMode: CONFIG.executionMode,
      datasetStatus: CONFIG.datasetStatus,
      request,
      config: CONFIG,
      summary,
      seedSelection,
      courseVariant,
      courseVariants,
      items,
      schedule,
      verificationCandidates,
      warnings,
    };
  }

  return Object.freeze({
    ALGORITHM_VERSION,
    REQUEST_SCHEMA_VERSION,
    PERSONALIZED_REQUEST_SCHEMA_VERSION,
    PREFERENCE_PROFILE_SCHEMA_VERSION,
    RESULT_SCHEMA_VERSION,
    ATOMIC_FEATURES,
    COMPANION_TYPES,
    CONFIG,
    normalizeRequest,
    monthDayWeights,
    utilityForPreference,
    selectWeightedSeed,
    courseOverlapTrace,
    selectNextCourseVariant,
    featureSimilarity,
    placeSimilarity,
    haversineKm,
    sphericalCenter,
    clusterRequiredPlaces,
    splitClustersByCapacity,
    buildSchedule,
    rank,
  });
});
