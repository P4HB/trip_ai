"use strict";

const assert = require("node:assert/strict");
const CCU = require("../map-ui/ccu-mmr.js");

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function place(id, relevanceVector, overrides = {}) {
  return {
    id,
    title: id,
    type: overrides.type || "12",
    region: overrides.region || "jeju_city",
    sourceOrder: overrides.sourceOrder ?? (Number(id.replace(/\D/gu, "")) || 0),
    lat: overrides.lat ?? 33.5,
    lng: overrides.lng ?? 126.5,
    recommendationReady: true,
    atomicFeatures: Object.fromEntries(CCU.ATOMIC_FEATURES.map((key, index) => [key, relevanceVector[index] ?? 0.5])),
    companionScores: { solo: 0.5, couple: 0.5, friends: 0.5, kids: 0.5, parents: 0.5 },
    monthScores: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), 0.5])),
    constraints: [],
    ...overrides,
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
});
assert.deepEqual(mmrResult.items.map((item) => item.placeId), ["A1", "C3", "B2"]);

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
  CCU.rank(deterministicInput, deterministicRequest).items,
  CCU.rank(deterministicInput, deterministicRequest).items,
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
assert.equal(needsAnchor.status, "needs_anchor_selection");
assert.equal(needsAnchor.unfilledDayCount, 1);
assert.deepEqual(needsAnchor.anchorCandidates.map((item) => item.placeId), ["FAR"]);
close(needsAnchor.dayClusters[0].places.find((item) => item.placeId === "NEAR").dayMmrScore, 0.2, 0.01);
const withAnchor = CCU.rank(anchorPlaces, {
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-21" },
  requiredPlaceIds: ["MUST"],
  anchorPlaceIds: ["FAR"],
}).schedule;
assert.equal(withAnchor.status, "feasible");
assert.equal(withAnchor.dayClusters.length, 2);
assert.equal(withAnchor.dayClusters[1].anchorPlaceId, "FAR");
assert.equal(withAnchor.dayClusters[1].date, "2026-08-21");

console.log("CCU-MMR tests passed");
