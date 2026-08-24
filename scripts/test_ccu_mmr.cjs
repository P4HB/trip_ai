"use strict";

const assert = require("node:assert/strict");
const CCU = require("../map-ui/ccu-mmr.js");
const Preference = require("../map-ui/preference-elicitation.js");

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function place(id, relevanceVector, overrides = {}) {
  const atomicFeatures = Object.fromEntries(
    CCU.ATOMIC_FEATURES.map((key, index) => [key, relevanceVector[index] ?? 0.5]),
  );
  return {
    id,
    title: id,
    type: overrides.type || "12",
    region: overrides.region || "jeju_city",
    sourceOrder: overrides.sourceOrder ?? (Number(id.replace(/\D/gu, "")) || 0),
    lat: overrides.lat ?? 33.5,
    lng: overrides.lng ?? 126.5,
    recommendationReady: true,
    companionScores: { solo: 0.5, couple: 0.5, friends: 0.5, kids: 0.5, parents: 0.5 },
    monthScores: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), 0.5])),
    constraints: [],
    ...overrides,
    atomicFeatures: { ...atomicFeatures, ...(overrides.atomicFeatures || {}) },
  };
}

close(CCU.utilityForPreference(0.8, { mode: "benefit" }), 0.8);
close(CCU.utilityForPreference(0.8, { mode: "avoid" }), 0.2);
close(CCU.utilityForPreference(0.6, { mode: "target", target: 0.5, tolerance: 0.1 }), Math.exp(-0.5));

const weights = CCU.monthDayWeights({ startDate: "2026-01-30", endDate: "2026-02-02" });
assert.deepEqual(weights, { daysByMonth: { 1: 2, 2: 2 }, totalDays: 4 });

const example = place("1", [], {
  atomicFeatures: { ocean: 1, physical_ease: 0.75, local_embeddedness: 0.8, photo_value: 0.9 },
});
const exampleResult = CCU.rank([example], {
  preferences: [
    { feature: "ocean", mode: "benefit", weight: 4 },
    { feature: "physical_ease", mode: "benefit", weight: 2 },
    { feature: "local_embeddedness", mode: "benefit", weight: 2 },
    { feature: "photo_value", mode: "benefit", weight: 1 },
  ],
  resultCount: 1,
});
close(exampleResult.items[0].components.preference.value, 8 / 9);

const profileAnswers = Preference.QUESTIONS.map((question, index) => ({
  questionId: question.id,
  optionId: ["a", "b", "b", "b", "a", "a", "a", "b", "b", "b", "a", "a", "a", "b", "a", "b", "a", "b"][index],
}));
const preferenceProfile = Preference.estimateProfile(profileAnswers, []);
assert.equal(preferenceProfile.schemaVersion, CCU.PREFERENCE_PROFILE_SCHEMA_VERSION);
const personalizedPlaces = [
  place("PERSONAL-HIGH", [], { sourceOrder: 1, atomicFeatures: { activity: 0.95 } }),
  place("PERSONAL-LOW", [], { sourceOrder: 2, atomicFeatures: { activity: 0.15 } }),
];
const personalizedResult = CCU.rank(personalizedPlaces, {
  schemaVersion: CCU.PERSONALIZED_REQUEST_SCHEMA_VERSION,
  preferenceProfile,
  preferences: [{ feature: "activity", mode: "benefit", weight: 3.275, confidence: 0.84, source: "quiz" }],
  resultCount: 2,
  diversity: "off",
});
assert.equal(personalizedResult.schemaVersion, CCU.RESULT_SCHEMA_VERSION);
assert.equal(personalizedResult.request.schemaVersion, CCU.PERSONALIZED_REQUEST_SCHEMA_VERSION);
assert.deepEqual(personalizedResult.request.preferenceProfile, preferenceProfile);
assert.equal(personalizedResult.request.preferences[0].weight, 3.275);
assert.equal(personalizedResult.request.preferences[0].confidence, 0.84);
assert.deepEqual(personalizedResult.items.map((item) => item.placeId), ["PERSONAL-HIGH", "PERSONAL-LOW"]);
assert.throws(
  () => CCU.normalizeRequest({ preferences: [{ feature: "activity", mode: "benefit", weight: 3.275 }] }),
  /1, 2, 4/u,
);
assert.throws(
  () => CCU.normalizeRequest({
    schemaVersion: CCU.PERSONALIZED_REQUEST_SCHEMA_VERSION,
    preferenceProfile,
    preferences: [{ feature: "activity", mode: "benefit", weight: 3, confidence: 2, source: "quiz" }],
  }),
  /confidence/u,
);

const blockPlace = place("2", [], {
  atomicFeatures: { ocean: 0.8 },
  companionScores: { parents: 0.6 },
  monthScores: { 8: 0.4 },
});
const blockResult = CCU.rank([blockPlace], {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  companionType: "parents",
  travelWindow: { startDate: "2026-08-01", endDate: "2026-08-01" },
  resultCount: 1,
});
close(blockResult.items[0].relevance, (0.7 * 0.8 + 0.15 * 0.6 + 0.1 * 0.4) / 0.95);

const monthPlace = place("3", [], { monthScores: { 1: 0.2, 2: 0.8 } });
const monthResult = CCU.rank([monthPlace], {
  travelWindow: { startDate: "2026-01-30", endDate: "2026-02-02" },
  resultCount: 1,
});
close(monthResult.items[0].components.month.value, 0.5);

const mmrPlaces = [
  place("A1", Array(18).fill(1), { sourceOrder: 1, atomicFeatures: { ocean: 0.9 } }),
  place("B2", Array(18).fill(1), { sourceOrder: 2, atomicFeatures: { ocean: 0.88 } }),
  place("C3", Array(18).fill(0), { sourceOrder: 3, type: "14", region: "seogwipo_city", atomicFeatures: { ocean: 0.8 } }),
];
const mmrResult = CCU.rank(mmrPlaces, {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  resultCount: 3,
  diversity: "balanced",
}, { random: () => 0 });
assert.deepEqual(mmrResult.items.map((item) => item.placeId), ["A1", "C3", "B2"]);
assert.equal(mmrResult.seedSelection.selectedRelevanceRank, 1);
assert.equal(mmrResult.items[0].seedSelectionProbability, 0.5);
assert.deepEqual(mmrResult.courseVariants.map((variant) => variant.seedPlaceId), ["A1", "B2", "C3"]);
assert.deepEqual(mmrResult.courseVariants.map((variant) => variant.placeIds[0]), ["A1", "B2", "C3"]);
assert.equal(mmrResult.courseVariant.variantId, "seed-rank-1");
assert.ok(!mmrResult.request.diversityFeatureKeys.includes("ocean"));
assert.ok(mmrResult.request.diversityFeatureKeys.includes("culture_history"));

const allPreferenceFeatures = CCU.ATOMIC_FEATURES.map((feature) => ({ feature, mode: "benefit", weight: 1 }));
const noFeatureSimilarityResult = CCU.rank(mmrPlaces, {
  preferences: allPreferenceFeatures,
  resultCount: 3,
  diversity: "balanced",
}, { variantId: "seed-rank-1" });
assert.deepEqual(noFeatureSimilarityResult.request.diversityFeatureKeys, []);
assert.ok(noFeatureSimilarityResult.items.every((item) => Number.isFinite(item.mmrScore)));

const weightedSeedPlaces = [
  place("S1", [], { sourceOrder: 1, atomicFeatures: { ocean: 0.9 } }),
  place("S2", [], { sourceOrder: 2, atomicFeatures: { ocean: 0.8 } }),
  place("S3", [], { sourceOrder: 3, atomicFeatures: { ocean: 0.7 } }),
];
function weightedSeedResult(randomValue, candidates = weightedSeedPlaces) {
  return CCU.rank(candidates, {
    preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
    resultCount: candidates.length,
    diversity: "balanced",
  }, { random: () => randomValue });
}
for (const [randomValue, expectedPlaceId] of [
  [0, "S1"], [0.499999, "S1"], [0.5, "S2"],
  [0.799999, "S2"], [0.8, "S3"], [0.999999, "S3"],
]) {
  assert.equal(weightedSeedResult(randomValue).items[0].placeId, expectedPlaceId, `seed boundary ${randomValue}`);
}

const twoCandidateFirst = weightedSeedResult(0.624999, weightedSeedPlaces.slice(0, 2));
const twoCandidateSecond = weightedSeedResult(0.625, weightedSeedPlaces.slice(0, 2));
assert.equal(twoCandidateFirst.items[0].placeId, "S1");
assert.equal(twoCandidateSecond.items[0].placeId, "S2");
close(twoCandidateFirst.seedSelection.candidates[0].probability, 0.625);
close(twoCandidateFirst.seedSelection.candidates[1].probability, 0.375);
const oneCandidateSeed = weightedSeedResult(0.999999, weightedSeedPlaces.slice(0, 1));
assert.equal(oneCandidateSeed.items[0].placeId, "S1");
assert.equal(oneCandidateSeed.seedSelection.selectedProbability, 1);

const secondSeedMmr = CCU.rank(mmrPlaces, {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  resultCount: 3,
  diversity: "balanced",
}, { random: () => 0.5 });
assert.deepEqual(secondSeedMmr.items.map((item) => item.placeId), ["B2", "C3", "A1"]);

let explicitVariantRandomCalled = false;
const explicitThirdVariant = CCU.rank(weightedSeedPlaces, {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  resultCount: 3,
  diversity: "balanced",
}, {
  variantId: "seed-rank-3",
  random: () => { explicitVariantRandomCalled = true; return 0; },
});
assert.equal(explicitVariantRandomCalled, false);
assert.equal(explicitThirdVariant.items[0].placeId, "S3");
assert.equal(explicitThirdVariant.courseVariant.variantId, "seed-rank-3");
assert.equal(explicitThirdVariant.seedSelection.reason, "explicit_variant");
assert.throws(
  () => CCU.rank(weightedSeedPlaces, { resultCount: 3 }, { variantId: "seed-rank-4" }),
  /지원하지 않는 코스 variant/u,
);

const sessionVariants = explicitThirdVariant.courseVariants;
assert.deepEqual(
  CCU.selectNextCourseVariant(sessionVariants, ["seed-rank-2"], "seed-rank-2"),
  { variantId: "seed-rank-1", cycleRestarted: false },
);
assert.deepEqual(
  CCU.selectNextCourseVariant(sessionVariants, ["seed-rank-1", "seed-rank-2"], "seed-rank-1"),
  { variantId: "seed-rank-3", cycleRestarted: false },
);
assert.deepEqual(
  CCU.selectNextCourseVariant(sessionVariants, sessionVariants.map((variant) => variant.variantId), "seed-rank-3"),
  { variantId: "seed-rank-1", cycleRestarted: true },
);
assert.deepEqual(
  CCU.courseOverlapTrace(["A", "B", "C"], ["B", "C", "D"]),
  { overlapCount: 2, overlapRate: 2 / 3, changedPlaceCount: 1 },
);

let balancedRandomCalls = 0;
CCU.rank(weightedSeedPlaces, {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  resultCount: 3,
  diversity: "balanced",
}, { random: () => { balancedRandomCalls += 1; return 0.9; } });
assert.equal(balancedRandomCalls, 1);

let offRandomCalled = false;
const diversityOff = CCU.rank(weightedSeedPlaces, {
  preferences: [{ feature: "ocean", mode: "benefit", weight: 1 }],
  resultCount: 3,
  diversity: "off",
}, { random: () => { offRandomCalled = true; return 0.99; } });
assert.equal(offRandomCalled, false);
assert.deepEqual(diversityOff.items.map((item) => item.placeId), ["S1", "S2", "S3"]);
assert.equal(diversityOff.seedSelection.reason, "diversity_off");
assert.equal(diversityOff.courseVariants.length, 1);
assert.equal(diversityOff.courseVariant.variantId, "relevance-order");
assert.throws(() => weightedSeedResult(1), /난수값/u);
assert.throws(() => weightedSeedResult(-0.01), /난수값/u);

const exploration = CCU.rank([place("4", []), place("5", [])], { resultCount: 2 });
assert.ok(exploration.items.every((item) => item.relevance === 0.5 && item.rankingMode === "exploration"));

const excluded = CCU.rank([place("6", []), place("7", [])], { excludedPlaceIds: ["6"], resultCount: 2 });
assert.deepEqual(excluded.items.map((item) => item.placeId), ["7"]);

const verification = CCU.rank([place("8", [])], {
  hardConstraints: ["wheelchair_accessible"],
  resultCount: 1,
});
assert.equal(verification.items.length, 0);
assert.equal(verification.verificationCandidates.length, 1);

const deterministicInput = [place("9", []), place("10", []), place("11", [])];
const deterministicRequest = { companionType: "parents", resultCount: 3, diversity: "balanced" };
assert.deepEqual(
  CCU.rank(deterministicInput, deterministicRequest, { random: () => 0.75 }).items,
  CCU.rank(deterministicInput, deterministicRequest, { random: () => 0.75 }).items,
);
assert.notEqual(
  CCU.rank(deterministicInput, deterministicRequest, { random: () => 0 }).items[0].placeId,
  CCU.rank(deterministicInput, deterministicRequest, { random: () => 0.9 }).items[0].placeId,
);

assert.throws(
  () => CCU.normalizeRequest({ travelWindow: { startDate: "2026-08-10", endDate: "2026-08-01" } }),
  /종료일/u,
);
assert.throws(
  () => CCU.normalizeRequest({ preferences: [{ feature: "ocean", mode: "target", weight: 1, target: 0.5, tolerance: 0 }] }),
  /허용 오차/u,
);
assert.equal(CCU.normalizeRequest({}).intent, "visit");
assert.equal(CCU.CONFIG.weatherEnabled, false);
assert.deepEqual(
  CCU.normalizeRequest({ candidateFilter: { query: "우도", contentTypeIds: ["14", "12", "14"] } }).candidateFilter,
  { query: "우도", contentTypeIds: ["12", "14"] },
);
assert.throws(() => CCU.normalizeRequest({ intent: "all" }), /여행 목적/u);
assert.throws(() => CCU.normalizeRequest({ diversity: "random" }), /다양성/u);
assert.throws(() => CCU.normalizeRequest({ preferences: {} }), /배열/u);
assert.throws(() => CCU.rank([place("12", []), place("12", [])], {}), /중복/u);

const carRequest = CCU.normalizeRequest({
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-22" },
  transportMode: "car",
});
assert.equal(carRequest.scheduleConfig.tripDays, 3);
assert.equal(carRequest.scheduleConfig.radiusKm, 15);
assert.equal(carRequest.scheduleConfig.dailyCapacity, 6);
assert.equal(CCU.normalizeRequest({ transportMode: "no_car" }).scheduleConfig.radiusKm, 5);
assert.throws(() => CCU.normalizeRequest({ transportMode: "airplane" }), /이동수단/u);
close(CCU.haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111.1950802335329, 1e-6);

const closeRequired = Array.from({ length: 8 }, (_, index) => place(`R${index + 1}`, [], {
  sourceOrder: index + 1,
  lat: 33.5 + (index % 2) * 0.005,
  lng: 126.5 + Math.floor(index / 2) * 0.005,
}));
const capacitySchedule = CCU.rank(closeRequired, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  transportMode: "car",
  requiredPlaceIds: closeRequired.map((item) => item.id),
  resultCount: 8,
}).schedule;
assert.equal(capacitySchedule.status, "feasible");
assert.equal(capacitySchedule.geographicClusterCount, 1);
assert.equal(capacitySchedule.requiredDayClusterCount, 2);
assert.deepEqual(capacitySchedule.dayClusters.map((day) => day.usedCapacity), [6, 2]);
assert.deepEqual(
  capacitySchedule.dayClusters.flatMap((day) => day.requiredPlaceIds).sort(),
  closeRequired.map((item) => item.id).sort(),
);
assert.ok(capacitySchedule.dayClusters.every((day) => day.maxCenterDistanceKm <= 15));

const spacedPlaces = [
  place("G1", [], { sourceOrder: 1, lng: 126.5 }),
  place("G2", [], { sourceOrder: 2, lng: 126.62 }),
];
const carCluster = CCU.rank(spacedPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-20" },
  transportMode: "car",
  requiredPlaceIds: ["G1", "G2"],
}).schedule;
const noCarCluster = CCU.rank(spacedPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-20" },
  transportMode: "no_car",
  requiredPlaceIds: ["G1", "G2"],
}).schedule;
assert.equal(carCluster.geographicClusterCount, 1);
assert.equal(carCluster.status, "feasible");
assert.equal(noCarCluster.geographicClusterCount, 2);
assert.equal(noCarCluster.status, "infeasible");

const anchorPlaces = [
  place("MUST", [], { sourceOrder: 1, lng: 126.5 }),
  place("NEAR", [], { sourceOrder: 2, lng: 126.51 }),
  place("FAR", [], { sourceOrder: 3, lng: 126.8 }),
];
const needsAnchor = CCU.rank(anchorPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  requiredPlaceIds: ["MUST"],
}).schedule;
assert.equal(needsAnchor.status, "feasible");
assert.equal(needsAnchor.unfilledDayCount, 0);
assert.equal(needsAnchor.autoAnchorCount, 1);
assert.deepEqual(needsAnchor.autoAnchorIds, ["FAR"]);
assert.equal(needsAnchor.dayClusters[1].centerType, "variant_anchor");
close(needsAnchor.dayClusters[0].places.find((item) => item.placeId === "NEAR").dayMmrScore, 0.2, 0.01);
const diversityOffNeedsAnchor = CCU.rank(anchorPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  requiredPlaceIds: ["MUST"],
  diversity: "off",
}).schedule;
assert.equal(diversityOffNeedsAnchor.status, "needs_anchor_selection");
assert.equal(diversityOffNeedsAnchor.autoAnchorCount, 0);
const withAnchor = CCU.rank(anchorPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  requiredPlaceIds: ["MUST"],
  anchorPlaceIds: ["FAR"],
}).schedule;
assert.equal(withAnchor.status, "feasible");
assert.equal(withAnchor.dayClusters.length, 2);
assert.equal(withAnchor.dayClusters[1].anchorPlaceId, "FAR");
assert.equal(withAnchor.dayClusters[1].date, "2026-08-21");
assert.equal(withAnchor.dayClusters[1].centerType, "user_anchor");
assert.equal(withAnchor.autoAnchorCount, 0);

const variantSchedulePlaces = [
  place("V1", [], { sourceOrder: 1, lng: 126.2 }),
  place("V2", [], { sourceOrder: 2, lng: 126.5 }),
  place("V3", [], { sourceOrder: 3, lng: 126.8 }),
];
const variantScheduleRequest = {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  transportMode: "car",
  resultCount: 3,
  diversity: "balanced",
};
const firstVariantSchedule = CCU.rank(
  variantSchedulePlaces,
  variantScheduleRequest,
  { variantId: "seed-rank-1" },
).schedule;
const thirdVariantSchedule = CCU.rank(
  variantSchedulePlaces,
  variantScheduleRequest,
  { variantId: "seed-rank-3" },
).schedule;
assert.equal(firstVariantSchedule.status, "feasible");
assert.equal(thirdVariantSchedule.status, "feasible");
assert.equal(firstVariantSchedule.dayClusters[0].anchorPlaceId, "V1");
assert.equal(thirdVariantSchedule.dayClusters[0].anchorPlaceId, "V3");
assert.ok(firstVariantSchedule.dayClusters.every((day) => day.usedCapacity <= 6 && day.maxCenterDistanceKm <= 15));
assert.ok(thirdVariantSchedule.dayClusters.every((day) => day.usedCapacity <= 6 && day.maxCenterDistanceKm <= 15));

const fallbackAnchorSchedule = CCU.rank(
  variantSchedulePlaces,
  variantScheduleRequest,
  { variantId: "seed-rank-1" },
).schedule;
const oneResultFallbackSchedule = CCU.rank(
  variantSchedulePlaces,
  { ...variantScheduleRequest, resultCount: 1 },
  { variantId: "seed-rank-1" },
).schedule;
assert.equal(fallbackAnchorSchedule.autoAnchors.every((anchor) => anchor.source === "variant"), true);
assert.deepEqual(oneResultFallbackSchedule.autoAnchors.map((anchor) => anchor.source), ["variant", "relevance_fallback"]);

console.log("CCU-MMR tests passed");
