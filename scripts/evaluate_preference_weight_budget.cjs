"use strict";

// Compare two real engine versions with synthetic requests and one unchanged place snapshot.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const Current = require("../map-ui/ccu-mmr.js");
const Preference = require("../map-ui/preference-elicitation.js");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
}
const baselineArgument = option("--baseline-engine");
if (!baselineArgument) throw new Error("Usage: node scripts/evaluate_preference_weight_budget.cjs --baseline-engine <saved-v7-engine.cjs> [--output <report.json>]");
const baselinePath = path.resolve(baselineArgument);
const Baseline = require(baselinePath);
assert.equal(Baseline.ALGORITHM_VERSION, "ccu-mmr-v7-daily-type-limit", "baseline must be the pre-budget engine");
const bundlePath = path.join(root, "map-ui/data/jeju-places.js");
const outputPath = path.resolve(option("--output") || path.join(root, "artifacts/evaluation/spec_084_preference_budget.json"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(bundlePath, "utf8"), context);
const places = context.window.JEJU_PLACES.map((p) => {
  const atomicFeatures = Object.fromEntries((p.v5?.labels || [])
    .filter((r) => ["theme.", "environment.", "style_evidence."].some((prefix) => r.label.startsWith(prefix)))
    .map((r) => [r.label.split(".").at(-1), r.value]));
  const contextScores = (rows) => Object.fromEntries((rows || []).map((r) => [r.key, r.state === "numeric" ? r.value : null]));
  return {
    ...p, atomicFeatures,
    recommendationReady: Boolean(p.v5 && p.fit && Current.ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
    companionScores: contextScores(p.fit?.companion), monthScores: contextScores(p.fit?.month),
  };
});
const byId = new Map(places.map((p) => [String(p.id), p]));
const group = new Set(Current.CONFIG.preferenceWeightPolicy.cappedFeatures);
const scenarios = [];
for (const energy of [1, -1]) for (const environment of [1, -1]) for (const discovery of [1, -1]) {
  const axes = { energy, environment, discovery };
  const answers = Preference.QUESTIONS.map((q) => ({ questionId: q.id, optionId: q.options.find((o) => o.axisValue === axes[q.axisId]).id }));
  const profile = Preference.estimateProfile(answers, []);
  scenarios.push({
    id: profile.displaySummary.archetypeId, kind: "synthetic_mbti", axes,
    request: { schemaVersion: Current.PERSONALIZED_REQUEST_SCHEMA_VERSION, preferenceProfile: profile, preferences: Preference.materializePreferences(profile) },
  });
}
const pref = (feature, weight) => ({ feature, weight, mode: "benefit" });
scenarios.push(
  { id: "explicit_nature", kind: "explicit_preference", request: { preferences: [pref("ocean", 4), pref("mountain", 2), pref("scenic_value", 4), pref("photo_value", 4)] } },
  { id: "photo_only", kind: "explicit_preference", request: { preferences: [pref("photo_value", 4)] } },
);
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const rounded = (value) => value === null ? null : Number(value.toFixed(6));
function metrics(result) {
  const selected = result.items.map((item) => byId.get(item.placeId));
  return {
    top10: result.items.map((item) => item.placeId),
    uniquePrimaryTypes: new Set(selected.map((p) => p.primaryType)).size,
    beachOreumCount: selected.filter((p) => ["coast_beach", "mountain_oreum"].includes(p.primaryType)).length,
    meanOcean: rounded(mean(selected.map((p) => p.atomicFeatures.ocean))),
    meanMountain: rounded(mean(selected.map((p) => p.atomicFeatures.mountain))),
    meanPhoto: rounded(mean(selected.map((p) => p.atomicFeatures.photo_value))),
    meanCappedWeightShare: rounded(mean(result.items.map((item) => item.components.preference.traces.filter((t) => group.has(t.feature)).reduce((sum, t) => sum + t.effectiveWeight, 0)))),
  };
}
const comparisons = scenarios.map((scenario) => {
  const variants = {};
  for (const diversity of ["off", "balanced"]) {
    const request = { ...scenario.request, intent: "visit", destinationRegion: "jeju_all", companionType: "none", resultCount: 10, diversity };
    const oldResult = Baseline.rank(places, request, { random: () => 0 });
    const newResult = Current.rank(places, request, { random: () => 0 });
    assert.equal(newResult.items.length, 10);
    for (const item of newResult.items) {
      const component = item.components.preference;
      const adjustment = component.weightAdjustment.cappedGroup;
      const outside = component.traces.some((t) => !group.has(t.feature) && Number.isFinite(t.utility));
      if (outside) assert.ok(adjustment.shareAfterCap <= 0.25 + 1e-12);
      assert.ok(Math.abs(component.value - component.traces.reduce((sum, t) => sum + t.contribution, 0)) < 1e-12);
    }
    const before = metrics(oldResult), after = metrics(newResult);
    if (scenario.id === "photo_only") assert.deepEqual(after.top10, before.top10, "photo-only rankings must be preserved");
    variants[diversity] = { before, after, overlapBeforeAfter: after.top10.filter((id) => before.top10.includes(id)).length };
  }
  return { id: scenario.id, kind: scenario.kind, axes: scenario.axes, preferences: scenario.request.preferences, variants };
});
function acrossProfileOverlap(rows) {
  const overlap = [];
  for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) {
    overlap.push(rows[i].top10.filter((id) => rows[j].top10.includes(id)).length);
  }
  return rounded(mean(overlap));
}
const mbti = comparisons.filter((s) => s.kind === "synthetic_mbti");
const aggregate = {};
for (const diversity of ["off", "balanced"]) {
  aggregate[diversity] = {};
  for (const version of ["before", "after"]) {
    const rows = mbti.map((s) => s.variants[diversity][version]);
    aggregate[diversity][version] = {
      meanUniquePrimaryTypes: rounded(mean(rows.map((r) => r.uniquePrimaryTypes))),
      meanBeachOreumCount: rounded(mean(rows.map((r) => r.beachOreumCount))),
      meanPairwiseTop10Overlap: acrossProfileOverlap(rows),
      groupWeightShareRange: [Math.min(...rows.map((r) => r.meanCappedWeightShare)), Math.max(...rows.map((r) => r.meanCappedWeightShare))],
    };
  }
  aggregate[diversity].meanBeforeAfterOverlap = rounded(mean(mbti.map((s) => s.variants[diversity].overlapBeforeAfter)));
}
const report = {
  schemaVersion: "spec-084-preference-budget-evaluation-v1",
  data: { path: "map-ui/data/jeju-places.js", sha256: digest(bundlePath), metadata: context.window.JEJU_DATA_META, readyCount: places.filter((p) => p.recommendationReady).length, visitCount: places.filter((p) => p.recommendationReady && ["12", "14", "25", "28"].includes(p.type)).length },
  baseline: { algorithmVersion: Baseline.ALGORITHM_VERSION, engineSha256: digest(baselinePath) },
  current: { algorithmVersion: Current.ALGORITHM_VERSION, engineSha256: digest(path.join(root, "map-ui/ccu-mmr.js")), policy: Current.CONFIG.preferenceWeightPolicy },
  evaluation: { syntheticMbtiProfiles: 8, explicitScenarios: 2, intent: "visit", destinationRegion: "jeju_all", companionType: "none", travelWindow: null, resultCount: 10, balancedSeed: "seed-rank-1", realUserResponsesUsed: false },
  aggregate, scenarios: comparisons,
  limitations: ["합성 응답과 현재 AI 초안 점수에 대한 민감도 비교이며 만족도·정확도 개선 검증이 아님.", "해변·오름 수는 두 대표 유형의 수이며 전체 자연경관 장소 수가 아님.", "각 버전은 자기 점수로 순위를 정하므로 서로 다른 버전의 점수 크기를 품질로 비교하지 않음."],
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(root, outputPath), aggregate, explicit: comparisons.filter((s) => s.kind === "explicit_preference").map((s) => ({ id: s.id, balanced: s.variants.balanced })) }, null, 2));
