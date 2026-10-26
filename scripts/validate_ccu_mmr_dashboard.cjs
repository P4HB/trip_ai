"use strict";
/*
 * Static dashboard contract (SPEC-113 REQ-001): DOM ids and wizard structure in index.html, script load
 * order, forbidden browser APIs, bundled data counts and ranker results. Interface behavior that used to
 * be checked by matching JS/CSS source text is verified in a real browser by test_dashboard_behavior.cjs.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CCU = require("../map-ui/ccu-mmr.js");
const Preference = require("../map-ui/preference-elicitation.js");

const workspaceRoot = path.resolve(__dirname, "..");
const mapRoot = path.join(workspaceRoot, "map-ui");
const bundlePath = path.join(mapRoot, "data", "jeju-places.js");
const dashboardHtml = fs.readFileSync(path.join(mapRoot, "index.html"), "utf8");
// First-party browser modules; vendor libraries and generated data live in subdirectories.
const modules = new Map(fs.readdirSync(mapRoot).filter((name) => name.endsWith(".js"))
  .map((name) => [name, fs.readFileSync(path.join(mapRoot, name), "utf8")]));

for (const id of [
  "headerTravelMbtiButton", "travelMbtiLaunch", "startTravelMbtiButton", "travelMbtiApplied", "restartTravelMbtiButton", "travelMbtiDialog",
  "travelMbtiProgressLabel", "travelMbtiProgressBar", "travelMbtiBody", "travelMbtiBackButton", "travelMbtiSkipButton",
  "detailPlaceId", "detailReviews", "detailMedia", "detailImageBackdrop", "detailImageButton", "detailImage", "detailMobileFeedback",
  "placeImageDialog", "placeImageDialogTitle", "placeImageDialogImage", "placeImageDialogCloseButton",
  "mobileRecommendationFeedbackDialog", "mobileRecommendationFeedbackContext", "mobileRecommendationFeedbackTitle",
  "mobileRecommendationFeedbackMeta", "mobileRecommendationFeedbackCloseButton", "mobileRecommendationFeedbackMedia",
  "mobileRecommendationFeedbackImage", "mobileRecommendationFeedbackImagePlaceholder", "mobileRecommendationFeedbackMount",
  "mobileRecommendationFeedbackResearch", "mobileRecommendationFeedbackReviews",
  "sidebarCollapseButton", "sidebarExpandButton",
  "participantNamePanel", "participantName", "participantNameStatus",
  "feedbackSavePanel", "feedbackCompletionStatus", "feedbackSaveHelp",
]) {
  assert.match(dashboardHtml, new RegExp(`id=["']${id}["']`, "u"), `${id}: travel MBTI DOM contract`);
}

// Script load order: deferred scripts run in document order, so shared modules come first and app.js last.
const scripts = [...dashboardHtml.matchAll(/<script\s+src="\.\/([^"?]+)(?:\?[^"]*)?"([^>]*)><\/script>/gu)]
  .map((match) => ({ src: match[1], attributes: match[2] }));
const scriptOrder = scripts.map((script) => script.src);
const scriptPosition = (name) => scriptOrder.indexOf(name);
for (const script of scripts) {
  assert.match(script.attributes, /\bdefer\b/u, `${script.src}: deferred in document order`);
  assert.ok(fs.existsSync(path.join(mapRoot, script.src)), `${script.src}: loaded script exists`);
}
assert.equal(scriptOrder.at(-1), "app.js", "app.js assembles the page after every module");
assert.ok(scriptPosition("data/jeju-places.js") >= 0, "place bundle is loaded");
for (const name of modules.keys()) {
  assert.ok(scriptPosition(name) >= 0, `${name}: first-party module is loaded by index.html`);
  if (name !== "domain.js") assert.ok(scriptPosition("domain.js") < scriptPosition(name), `domain.js loads before ${name}`);
}
assert.ok(scriptPosition("preference-elicitation.js") < scriptPosition("ccu-mmr.js"), "preference module must load before ranker");

// Forbidden browser APIs in every first-party module; pure engines stay network-free.
for (const [name, source] of modules) {
  assert.doesNotMatch(source, /localStorage|sessionStorage|sendBeacon|XMLHttpRequest/u, `${name}: no browser persistence or background transport`);
}
for (const name of ["domain.js", "preference-elicitation.js", "ccu-mmr.js"]) {
  assert.doesNotMatch(modules.get(name), /\bfetch\s*\(/u, `${name}: engine remains network-free`);
}

assert.equal(Preference.QUESTIONS.length, 18);
assert.equal(Object.keys(Preference.ARCHETYPES).length, 8);
assert.match(dashboardHtml, /검사하러 가기/u, "unapplied preference step only offers the MBTI entry point");
assert.doesNotMatch(dashboardHtml, /data-preset=|id="preferenceRows"|id="addPreferenceButton"|세부 취향을 직접 조정|취향 없이 골고루/u, "manual preference presets and rows are removed");
assert.doesNotMatch(dashboardHtml, /id="clearTravelMbtiButton"/u, "applied MBTI is replaced through retesting instead of a manual preference fallback");
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
  "wizardStepLabel", "wizardProgressBar", "wizardBackButton", "wizardNextButton", "tripDurationDays", "dateUndecided", "dateEventRequirement", "reviewSummary",
  "companionType", "destinationRegion", "tripIntent", "transportMode", "runRecommendationButton",
  "requiredOverview", "requiredProgressText", "requiredProgressTrack", "requiredProgressBar", "requiredMissingText",
]) {
  assert.match(dashboardHtml, new RegExp(`id="${id}"`, "u"), `${id}: wizard control`);
}
for (const target of ["companionType", "tripDurationDays", "destinationRegion", "tripIntent", "transportMode"]) {
  assert.match(dashboardHtml, new RegExp(`data-choice-target="${target}"`, "u"), `${target}: choice cards`);
}
assert.match(dashboardHtml, /id="sidebarCollapseButton"[\s\S]*?aria-controls="sidebar"[\s\S]*?aria-expanded="true"/u, "desktop sidebar collapse control");
assert.match(dashboardHtml, /id="sidebarExpandButton"[\s\S]*?aria-controls="sidebar"[\s\S]*?aria-expanded="false"/u, "desktop sidebar expand control");
assert.match(dashboardHtml, /id="detailImageButton"[\s\S]*aria-haspopup="dialog"/u, "detail image opens an accessible dialog");
assert.doesNotMatch(dashboardHtml, /id="detailLabels"|id="detailConstraintNote"|장소 41개 라벨/u, "internal labels and constraints are removed from place detail DOM");
assert.doesNotMatch(dashboardHtml, /id="detailScoreTrace"|class="detail-score-trace"/u, "internal recommendation trace is removed from place detail DOM");
assert.match(dashboardHtml, /id="placeImageDialog"[\s\S]*aria-labelledby="placeImageDialogTitle"/u, "large image dialog labeling");
assert.equal((dashboardHtml.match(/data-requirement-key="(?:companion|date|region|intent|transport|preference)"/gu) || []).length, 6, "six required input groups");
assert.equal((dashboardHtml.match(/data-requirement-status="(?:companion|date|region|intent|transport|preference)"/gu) || []).length, 6, "six live required statuses");
assert.match(dashboardHtml, /추천 결과 설정 <span class="optional-badge">선택<\/span>/u, "optional output settings label");
assert.equal((dashboardHtml.match(/data-choice-target="tripDurationDays" data-choice-value="[234]"/gu) || []).length, 3, "three duration-only choices");
assert.match(dashboardHtml, /만족도나 의견을 남기면 여행 조건과 추천 결과가 서버에 자동 저장돼요\./u, "feedback autosave notice");
assert.doesNotMatch(dashboardHtml, /id="saveFeedbackLogButton"/u, "manual feedback save button is removed");
assert.match(dashboardHtml, /자동 전송되어 90일간 보관/u, "feedback retention notice");
assert.match(dashboardHtml, /id="participantName"[^>]*maxlength="30"/u, "participant name length boundary");
assert.match(dashboardHtml, /실명 대신 별칭을 사용해도 되며 연락처는 입력하지 마세요/u, "participant privacy notice");
assert.match(dashboardHtml, /id="detailMobileFeedback"[^>]*hidden/u, "mobile detail feedback mount starts hidden");
assert.match(dashboardHtml, /id="mobileRecommendationFeedbackDialog"[\s\S]*?aria-labelledby="mobileRecommendationFeedbackTitle"/u, "mobile recommendation feedback dialog labeling");

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
