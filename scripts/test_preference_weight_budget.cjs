"use strict";

const assert = require("node:assert/strict");
const CCU = require("../map-ui/ccu-mmr.js");

const GROUP = ["scenic_value", "distinctiveness", "local_embeddedness", "landmark_significance", "photo_value"];
const pref = (feature, weight = 1, mode = "benefit", extra = {}) => ({ feature, weight, mode, ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
function place(id, values = {}) {
  return {
    id, title: id, sourceOrder: Number(id) || 0, type: "12", primaryType: `fixture_${id}`,
    region: "jeju_city", lng: 126.5, lat: 33.5, recommendationReady: true,
    atomicFeatures: { ...Object.fromEntries(CCU.ATOMIC_FEATURES.map((key) => [key, 0.5])), ...values },
    companionScores: { parents: 0.6 }, monthScores: { 9: 0.4 }, constraints: [],
  };
}
function rank(places, preferences, extra = {}) {
  return CCU.rank(places, { preferences, resultCount: places.length, diversity: "off", ...extra });
}
function component(preferences, values = {}) {
  return rank([place("1", values)], preferences).items[0].components.preference;
}
const trace = (p, feature) => p.traces.find((item) => item.feature === feature);
function invariant(p) {
  close(p.traces.reduce((sum, item) => sum + item.effectiveWeight, 0), p.active ? 1 : 0);
  if (p.active) {
    close(p.value, p.traces.reduce((sum, item) => sum + item.contribution, 0));
    assert.ok(p.value >= 0 && p.value <= 1 + 1e-12);
  }
  for (const t of p.traces) {
    assert.ok(Number.isFinite(t.effectiveWeight) && t.effectiveWeight >= 0);
    assert.ok(Number.isFinite(t.contribution) && t.contribution >= 0);
    close(t.contribution, Number.isFinite(t.utility) ? t.effectiveWeight * t.utility : 0);
  }
  const groupShare = p.traces.filter((t) => GROUP.includes(t.feature)).reduce((sum, t) => sum + t.effectiveWeight, 0);
  close(groupShare, p.weightAdjustment.cappedGroup.shareAfterCap);
  if (p.traces.some((t) => !GROUP.includes(t.feature) && Number.isFinite(t.utility))) {
    assert.ok(groupShare <= 0.25 + 1e-12);
  }
}
let checked = 0;
function test(name, run) { run(); checked += 1; console.log(`PASS ${name}`); }

test("non-group preferences retain their weighted mean", () => {
  const p = component([pref("ocean", 4), pref("physical_ease", 2)], { ocean: 1, physical_ease: 0.25 });
  close(p.value, 0.75);
  assert.equal(p.weightAdjustment.cappedGroup.reason, "no_capped_features");
  invariant(p);
});

test("equal visual weights share one budget before the 25% cap", () => {
  const p = component([pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 4)], { ocean: 0.2, scenic_value: 1, photo_value: 1 });
  close(p.weightAdjustment.visualGroup.budget, 4);
  close(trace(p, "scenic_value").groupedWeight, 2);
  close(trace(p, "photo_value").groupedWeight, 2);
  close(trace(p, "ocean").normalizedWeightBeforeCap, 0.5);
  close(trace(p, "ocean").effectiveWeight, 0.75);
  close(trace(p, "scenic_value").effectiveWeight, 0.125);
  close(trace(p, "photo_value").effectiveWeight, 0.125);
  close(p.value, 0.4);
  invariant(p);
});

test("unequal visual weights preserve preference ratios", () => {
  const p = component([pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 2)]);
  close(trace(p, "scenic_value").groupedWeight, 8 / 3);
  close(trace(p, "photo_value").groupedWeight, 4 / 3);
  close(trace(p, "scenic_value").effectiveWeight, 1 / 6);
  close(trace(p, "photo_value").effectiveWeight, 1 / 12);
  invariant(p);
});

test("visual grouping below the cap still removes duplicate budget", () => {
  const p = component([pref("ocean", 4), pref("scenic_value"), pref("photo_value")]);
  close(trace(p, "ocean").effectiveWeight, 0.8);
  close(trace(p, "scenic_value").effectiveWeight, 0.1);
  close(trace(p, "photo_value").effectiveWeight, 0.1);
  assert.equal(p.weightAdjustment.cappedGroup.capApplied, false);
  invariant(p);
});

test("a single visual feature is not divided by two", () => {
  const p = component([pref("ocean", 4), pref("photo_value")]);
  close(trace(p, "photo_value").groupedWeight, 1);
  close(trace(p, "photo_value").effectiveWeight, 0.2);
  assert.equal(p.weightAdjustment.visualGroup.applied, false);
  invariant(p);
});

test("the exact 25% boundary is left unchanged", () => {
  const p = component([pref("ocean", 2), pref("activity"), pref("distinctiveness")]);
  close(trace(p, "distinctiveness").effectiveWeight, 0.25);
  assert.equal(p.weightAdjustment.cappedGroup.capApplied, false);
  invariant(p);
});

test("the cap preserves ratios within both sides", () => {
  const p = component([pref("ocean", 2), pref("activity"), pref("local_embeddedness", 4), pref("distinctiveness", 2)]);
  close(trace(p, "ocean").effectiveWeight, 0.5);
  close(trace(p, "activity").effectiveWeight, 0.25);
  close(trace(p, "local_embeddedness").effectiveWeight, 1 / 6);
  close(trace(p, "distinctiveness").effectiveWeight, 1 / 12);
  invariant(p);
});

test("benefit, avoid and target keep their own utility", () => {
  const p = component([
    pref("activity", 4), pref("scenic_value", 4, "avoid"),
    pref("photo_value", 2, "target", { target: 0.75, tolerance: 0.25 }), pref("local_embeddedness"),
  ], { activity: 0.4, scenic_value: 0.8, photo_value: 0.5, local_embeddedness: 0.6 });
  close(trace(p, "scenic_value").utility, 0.2);
  close(trace(p, "photo_value").utility, Math.exp(-0.5));
  close(p.value, 0.75 * 0.4 + (2 / 15) * 0.2 + (1 / 15) * Math.exp(-0.5) + 0.05 * 0.6);
  invariant(p);
});

test("only capped features use an explicit cap exception", () => {
  const p = component([pref("local_embeddedness", 4), pref("scenic_value", 2), pref("photo_value")]);
  close(trace(p, "local_embeddedness").effectiveWeight, 2 / 3);
  close(trace(p, "scenic_value").effectiveWeight, 2 / 9);
  close(trace(p, "photo_value").effectiveWeight, 1 / 9);
  assert.equal(p.weightAdjustment.cappedGroup.reason, "no_other_usable_features");
  assert.equal(p.weightAdjustment.cappedGroup.capApplied, false);
  invariant(p);
});

test("a photo-only request keeps its meaning", () => {
  const p = component([pref("photo_value", 4)], { photo_value: 0.8 });
  close(p.value, 0.8);
  close(trace(p, "photo_value").effectiveWeight, 1);
  invariant(p);
});

test("missing visual values are not zero and do not consume budget", () => {
  const preferences = [pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 4)];
  for (const missing of [null, undefined, NaN, -1, 2]) {
    const p = component(preferences, { ocean: 0.5, scenic_value: 1, photo_value: missing });
    close(p.coverage, 2 / 3);
    close(trace(p, "scenic_value").groupedWeight, 4);
    close(trace(p, "photo_value").effectiveWeight, 0);
    close(p.value, 0.625);
    invariant(p);
  }
  const zero = component(preferences, { ocean: 0.5, scenic_value: 1, photo_value: 0 });
  close(zero.coverage, 1);
  close(trace(zero, "photo_value").effectiveWeight, 0.125);
  close(zero.value, 0.5);
  invariant(zero);
});

test("missing outside data records the cap exception and reduced coverage", () => {
  const p = component([pref("ocean"), pref("scenic_value"), pref("photo_value")], { ocean: null });
  assert.equal(p.weightAdjustment.cappedGroup.reason, "no_other_usable_features");
  close(p.coverage, 2 / 3);
  invariant(p);
});

test("all missing values keep the preference component inactive", () => {
  const p = component([pref("ocean"), pref("photo_value")], { ocean: null, photo_value: null });
  assert.equal(p.active, false);
  assert.equal(p.value, null);
  close(p.coverage, 0);
  assert.equal(p.weightAdjustment.cappedGroup.reason, "no_usable_features");
  invariant(p);
});

test("an empty request keeps exploration behavior", () => {
  const result = rank([place("1")], []);
  assert.equal(result.items[0].components.preference.requested, false);
  assert.equal(result.items[0].rankingMode, "exploration");
  close(result.items[0].relevance, 0.5);
});

test("a match on the other requested preference can outrank all-high style labels", () => {
  const preferences = [pref("activity", 4), ...GROUP.map((key) => pref(key, 4))];
  const allHigh = place("1", { activity: 0, ...Object.fromEntries(GROUP.map((key) => [key, 1])) });
  const activityMatch = place("2", { activity: 1 });
  // The previous flat mean would put allHigh (20/24) ahead of activityMatch (14/24).
  const result = rank([allHigh, activityMatch], preferences);
  assert.deepEqual(result.items.map((item) => item.placeId), ["2", "1"]);
  close(result.items[0].components.preference.value, 0.875);
  close(result.items[1].components.preference.value, 0.25);
  result.items.forEach((item) => invariant(item.components.preference));
});

test("an explicit ocean preference still favors the nature match", () => {
  const result = rank([
    place("1", { ocean: 1, scenic_value: 1, photo_value: 1 }),
    place("2", { ocean: 0, scenic_value: 0.5, photo_value: 0.5 }),
  ], [pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 4)]);
  assert.deepEqual(result.items.map((item) => item.placeId), ["1", "2"]);
  close(result.items[0].components.preference.value, 1);
});

test("P/A/M weights and hard constraints are preserved", () => {
  const preferences = [pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 4)];
  const places = [place("1", { ocean: 0.2, scenic_value: 1, photo_value: 1 })];
  const extra = { companionType: "parents", travelWindow: { startDate: "2026-09-26", endDate: "2026-09-26" } };
  const result = rank(places, preferences, extra);
  close(result.items[0].relevance, (0.7 * 0.4 + 0.15 * 0.6 + 0.1 * 0.4) / 0.95);
  const gated = rank(places, preferences, { ...extra, hardConstraints: ["wheelchair_accessible"] });
  assert.equal(gated.items.length, 0);
  assert.equal(gated.verificationCandidates.length, 1);
});

test("trace contributions, request weights, determinism and inputs stay consistent", () => {
  const preferences = [pref("ocean", 4), pref("scenic_value", 4), pref("photo_value", 2)];
  const places = [place("1", { ocean: 0.5, scenic_value: 1, photo_value: 0.75 })];
  const before = structuredClone({ preferences, places });
  const first = rank(places, preferences);
  assert.deepEqual(first.items, rank(places, preferences).items);
  assert.deepEqual({ preferences, places }, before);
  assert.deepEqual(first.request.preferences, preferences);
  const p = first.items[0].components.preference;
  invariant(p);
  assert.deepEqual(p.traces.map((t) => t.weight), [4, 4, 2]);
  assert.equal([...p.traces].sort((a, b) => b.contribution - a.contribution)[0].feature, "ocean");
});

console.log(`Preference weight budget: ${checked} scenarios passed.`);
