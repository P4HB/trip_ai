"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CCU = require("../map-ui/ccu-mmr.js");

const workspaceRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
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
assert.equal(metadata.hardConstraintAttachedCount, 1517);

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

const first = CCU.rank(rankedInput, request);
const second = CCU.rank(rankedInput, request);
assert.equal(first.summary.inputCandidates, 2153);
assert.equal(
  first.summary.scoredCandidates + first.verificationCandidates.length + first.summary.filteredByIntent + first.summary.unscored,
  2153,
);
assert.equal(first.items.length, 10);
assert.deepEqual(first.items.map((item) => item.placeId), second.items.map((item) => item.placeId));
assert.ok(first.items.every((item) => Number.isFinite(item.relevance) && Number.isFinite(item.mmrScore)));

console.log(JSON.stringify({
  places: places.length,
  recommendationReady: readyPlaces.length,
  labelsPerReadyPlace: 41,
  returned: first.items.length,
  verificationCandidates: first.verificationCandidates.length,
  topPlaceIds: first.items.map((item) => item.placeId),
}, null, 2));
