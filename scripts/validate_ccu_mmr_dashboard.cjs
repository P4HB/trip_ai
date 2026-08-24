"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CCU = require("../map-ui/ccu-mmr.js");

const workspaceRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
const dashboardHtml = fs.readFileSync(path.join(workspaceRoot, "map-ui", "index.html"), "utf8");
const dashboardApp = fs.readFileSync(path.join(workspaceRoot, "map-ui", "app.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(bundlePath, "utf8"), sandbox, { filename: bundlePath });

const places = sandbox.window.JEJU_PLACES;
const metadata = sandbox.window.JEJU_DATA_META;
assert.ok(Array.isArray(places));
assert.equal(places.length, 2153);
assert.equal(metadata.recommendationReadyCount, 1663);
assert.equal(metadata.recommendationUnscoredCount, 490);
assert.equal(metadata.v5ReviewSourceCount, 1664);
assert.equal(metadata.v5ReviewAttachedCount, 1663);
assert.equal(metadata.fitLabelSourceCount, 1664);
assert.equal(metadata.fitLabelAttachedCount, 1663);
assert.equal(metadata.researchSourceCount, 1664);
assert.equal(metadata.researchAttachedCount, 1663);
assert.equal(metadata.recommendationResearchReadyCount, 1663);
assert.equal(metadata.hardConstraintAttachedCount, 1517);
assert.equal(metadata.algorithmVersion, CCU.ALGORITHM_VERSION);

assert.equal((dashboardHtml.match(/data-wizard-step="[1-5]"/gu) || []).length, 5, "five wizard steps");
for (const id of [
  "wizardStepLabel", "wizardProgressBar", "wizardBackButton", "wizardNextButton", "dateUndecided", "reviewSummary",
  "companionType", "destinationRegion", "tripIntent", "transportMode", "runRecommendationButton",
]) {
  assert.match(dashboardHtml, new RegExp(`id="${id}"`, "u"), `${id}: wizard control`);
}
for (const target of ["companionType", "destinationRegion", "tripIntent", "transportMode"]) {
  assert.match(dashboardHtml, new RegExp(`data-choice-target="${target}"`, "u"), `${target}: choice cards`);
}
assert.match(dashboardApp, /function validateWizardStep\(step\)/u, "wizard validation");
assert.match(dashboardApp, /function renderReviewSummary\(\)/u, "review summary");
assert.doesNotMatch(dashboardApp, /initMap\(\);\s*runRecommendation\(/u, "recommendation must not auto-run on initialize");

const readyPlaces = places.filter((place) => place.v5 && place.fit);
assert.equal(readyPlaces.length, 1663);
for (const place of readyPlaces) {
  assert.equal(place.v5.labels.length, 24, `${place.id}: preference axes`);
  assert.equal(place.fit.companion.length, 5, `${place.id}: companion axes`);
  assert.equal(place.fit.month.length, 12, `${place.id}: month axes`);
  const uniqueLabels = new Set(place.v5.labels.map((record) => record.label));
  assert.equal(uniqueLabels.size, 24, `${place.id}: unique preference axes`);
  assert.equal([...uniqueLabels].filter((label) => label.startsWith("derived_style.")).length, 6, `${place.id}: derived axes`);
  assert.ok(place.fit.companion.every((axis) => axis.state === "numeric" && Number.isFinite(axis.value)));
  assert.ok(place.fit.month.every((axis) =>
    (axis.state === "numeric" && Number.isFinite(axis.value)) ||
    (axis.state === "not_applicable" && axis.value === null)
  ));
  assert.equal(place.research.status, "ai_draft", `${place.id}: research status`);
  assert.ok(["claim_available", "metadata_only"].includes(place.research.coverage), `${place.id}: research coverage`);
  assert.ok(place.research.highlights.length >= 1 && place.research.highlights.length <= 2, `${place.id}: research highlights`);
  assert.ok(place.research.sources.length >= 1, `${place.id}: research sources`);
  const researchSourceIds = new Set(place.research.sources.map((source) => source.id));
  assert.ok(place.research.sources.every((source) => /^https:\/\//u.test(source.url)), `${place.id}: secure research URLs`);
  assert.ok(place.research.highlights.every((highlight) =>
    highlight.text && researchSourceIds.has(highlight.sourceId) && highlight.tier >= 1 && highlight.tier <= 6
  ), `${place.id}: research claim provenance`);
  assert.ok(
    place.research.highlights.every((highlight) => !highlight.dynamic) || place.research.coverage === "metadata_only",
    `${place.id}: changing information must be avoided or explicitly downgraded`
  );
}

const legacyResearch = readyPlaces.find((place) => place.id === "1906211")?.research;
assert.ok(legacyResearch?.highlights.some((highlight) => highlight.text.includes("골목")), "legacy evidence fallback");

for (const contentId of [
  "140930", "129076", "126438", "2948051",
  "132160", "132556", "992261", "1690237", "2730822", "3512205", "131784", "2411625",
]) {
  const research = readyPlaces.find((place) => place.id === contentId)?.research;
  assert.ok(research?.highlights?.length, `${contentId}: changing-information regression place`);
  assert.ok(
    research.highlights.every((highlight) => !highlight.dynamic) || research.coverage === "metadata_only",
    `${contentId}: changing information must be avoided or marked as metadata-only`
  );
}

function featureKey(label) {
  return String(label).split(".").at(-1);
}

const rankedInput = places.map((place) => {
  const atomicFeatures = Object.fromEntries(
    (place.v5?.labels || [])
      .filter((record) => ["theme.", "environment.", "style_evidence."].some((prefix) => record.label.startsWith(prefix)))
      .map((record) => [featureKey(record.label), record.value]),
  );
  return {
    ...place,
    atomicFeatures,
    companionScores: Object.fromEntries((place.fit?.companion || []).map((axis) => [axis.key, axis.value])),
    monthScores: Object.fromEntries((place.fit?.month || []).map((axis) => [axis.key, axis.value])),
    recommendationReady: Boolean(place.v5 && place.fit && CCU.ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
  };
});

const request = {
  destinationRegion: "jeju_all",
  intent: "visit",
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-22" },
  transportMode: "car",
  requiredPlaceIds: ["126435"],
  companionType: "parents",
  preferences: [
    { feature: "ocean", mode: "benefit", weight: 4 },
    { feature: "physical_ease", mode: "benefit", weight: 2 },
    { feature: "local_embeddedness", mode: "benefit", weight: 2 },
    { feature: "photo_value", mode: "benefit", weight: 1 },
  ],
  resultCount: 10,
  diversity: "balanced",
};

const first = CCU.rank(rankedInput, request, { random: () => 0.65 });
const second = CCU.rank(rankedInput, request, { random: () => 0.65 });
assert.equal(first.summary.inputCandidates, 2153);
assert.equal(
  first.summary.scoredCandidates + first.verificationCandidates.length + first.summary.filteredByIntent + first.summary.unscored,
  2153,
);
assert.equal(first.items.length, 10);
assert.deepEqual(first.items.map((item) => item.placeId), second.items.map((item) => item.placeId));
assert.equal(first.seedSelection.strategy, "weighted-precomputed-top-relevance-3");
assert.equal(first.seedSelection.selectedRelevanceRank, 2);
assert.equal(first.seedSelection.selectedProbability, 0.3);
assert.equal(first.seedSelection.selectedPlaceId, first.items[0].placeId);
assert.ok(first.seedSelection.candidates.some((candidate) => candidate.placeId === first.items[0].placeId));
assert.equal(first.courseVariants.length, 3);
assert.deepEqual(first.courseVariants.map((variant) => variant.seedRelevanceRank), [1, 2, 3]);
assert.deepEqual(first.courseVariants.map((variant) => variant.placeIds[0]), first.courseVariants.map((variant) => variant.seedPlaceId));
assert.equal(first.courseVariant.variantId, "seed-rank-2");
assert.ok(!first.request.diversityFeatureKeys.includes("ocean"));
assert.ok(first.items.every((item) => Number.isFinite(item.relevance) && Number.isFinite(item.mmrScore)));
assert.ok(first.items.every((item) => readyPlaces.find((place) => place.id === item.placeId)?.research?.highlights?.length));
assert.equal(first.schedule.radiusKm, 15);
assert.equal(first.schedule.dailyCapacity, 6);
assert.equal(first.schedule.status, "feasible");
assert.equal(first.schedule.dayClusters.length, 3);
assert.equal(first.schedule.dayClusters[0].requiredPlaceIds[0], "126435");
assert.equal(first.schedule.courseVariantId, first.courseVariant.variantId);
assert.equal(first.schedule.autoAnchorCount, 2);
assert.ok(first.schedule.dayClusters.every((day) => day.usedCapacity <= 6));
assert.ok(first.schedule.dayClusters.every((day) => day.maxCenterDistanceKm <= 15));
assert.ok(first.schedule.dayClusters.slice(1).every((day) => ["variant_anchor", "fallback_anchor"].includes(day.centerType)));

const explicitThird = CCU.rank(rankedInput, request, { variantId: "seed-rank-3" });
assert.equal(explicitThird.courseVariant.variantId, "seed-rank-3");
assert.equal(explicitThird.items[0].placeId, explicitThird.courseVariants[2].seedPlaceId);
assert.notDeepEqual(
  first.schedule.dayClusters.map((day) => day.anchorPlaceId),
  explicitThird.schedule.dayClusters.map((day) => day.anchorPlaceId),
);

console.log(JSON.stringify({
  places: places.length,
  recommendationReady: readyPlaces.length,
  labelsPerReadyPlace: 41,
  researchCoverage: metadata.recommendationResearchReadyCount,
  returned: first.items.length,
  verificationCandidates: first.verificationCandidates.length,
  scheduleStatus: first.schedule.status,
  scheduledDays: first.schedule.dayClusters.length,
  topPlaceIds: first.items.map((item) => item.placeId),
}, null, 2));
