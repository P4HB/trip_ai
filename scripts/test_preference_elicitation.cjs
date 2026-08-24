"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Preference = require("../map-ui/preference-elicitation.js");

assert.equal(Preference.QUESTIONS.length, 18);
assert.equal(Preference.PAIRS.length, 6);
assert.equal(Preference.MAX_PAIR_QUESTIONS, 3);
assert.equal(Object.keys(Preference.ARCHETYPES).length, 8);
assert.deepEqual(
  Object.keys(Preference.ARCHETYPES).sort(),
  ["AOL", "AOH", "AIL", "AIH", "ROL", "ROH", "RIL", "RIH"].sort(),
);
assert.equal(Preference.AXIS_DEFINITIONS.length, 3);
assert.deepEqual(Preference.AXIS_DEFINITIONS.map((axis) => [axis.positiveCode, axis.negativeCode]), [["A", "R"], ["O", "I"], ["L", "H"]]);
assert.equal(Preference.QUESTIONS[1].id, "q02_fair_weather_space");
assert.equal(new Set(Preference.QUESTIONS.map((item) => item.id)).size, 18);
assert.equal(new Set(Preference.PAIRS.map((item) => item.id)).size, 6);

for (const axis of Preference.AXIS_DEFINITIONS) {
  const axisQuestions = Preference.QUESTIONS.filter((question) => question.axisId === axis.id);
  assert.equal(axisQuestions.length, 6, `${axis.id}: exactly six questions`);
  assert.equal(axisQuestions.filter((question) => question.options[0].axisValue === 1).length, 3, `${axis.id}: positive choice appears first three times`);
  assert.equal(axisQuestions.filter((question) => question.options[1].axisValue === 1).length, 3, `${axis.id}: positive choice appears second three times`);
}

for (const question of Preference.QUESTIONS) {
  assert.match(question.id, /^q\d{2}_[a-z_]+$/u);
  assert.ok(Preference.AXIS_DEFINITIONS.some((axis) => axis.id === question.axisId));
  assert.equal(question.options.length, 2);
  for (const option of question.options) {
    assert.ok(option.label && option.icon);
    assert.ok([-1, 1].includes(option.axisValue));
    assert.ok(Object.keys(option.effects || {}).every((feature) => Preference.ATOMIC_FEATURES.includes(feature)));
    assert.ok(Object.values(option.effects || {}).every((value) => Number.isFinite(value) && value >= -1 && value <= 1));
  }
}

for (const pair of Preference.PAIRS) {
  assert.match(pair.id, /^p\d{2}_[a-z_]+$/u);
  assert.ok(pair.cardA.title && pair.cardA.description && pair.cardB.title && pair.cardB.description);
  assert.ok(!/제주|성산|한라|우도|협재/u.test(`${pair.cardA.title}${pair.cardB.title}`), `${pair.id}: real-looking name`);
  for (const card of [pair.cardA, pair.cardB]) {
    assert.ok(Object.keys(card.features).every((feature) => Preference.ATOMIC_FEATURES.includes(feature)));
    assert.ok(Object.values(card.features).every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
  }
}

const representativeChoices = ["a", "b", "b", "b", "a", "a", "a", "b", "b", "b", "a", "a", "a", "b", "a", "b", "a", "b"];
const representativeAnswers = Preference.QUESTIONS.map((question, index) => ({
  questionId: question.id,
  optionId: representativeChoices[index],
}));
const representative = Preference.estimateProfile(representativeAnswers, []);
const representativeAgain = Preference.estimateProfile(representativeAnswers, []);
assert.deepEqual(representative, representativeAgain);
assert.equal(JSON.stringify(representative), JSON.stringify(representativeAgain));
assert.equal(representative.schemaVersion, "traveler-preference-profile-v2-three-axis");
assert.equal(representative.displaySummary.archetypeId, "AIL");
assert.equal(representative.displaySummary.archetypeName, "로컬 콘텐츠 탐험가");
assert.equal(representative.displaySummary.axes.length, 3);
assert.equal(Object.keys(representative.axisEstimates).length, 3);
assert.ok(Object.values(representative.axisEstimates).every((axis) => axis.answeredCount === 6 && axis.confidence === 1));
assert.ok(representative.displaySummary.topPreferences.includes("activity"));

const preferences = Preference.materializePreferences(representative);
assert.ok(preferences.length > 0 && preferences.length <= Preference.MAX_ACTIVE_FEATURES);
assert.ok(preferences.every((item) => item.weight > 0 && item.weight <= 4));
assert.ok(preferences.every((item) => item.confidence >= 0 && item.confidence <= 1));
assert.equal(Math.max(...preferences.map((item) => item.weight)), 4);

const pairA = Preference.estimateProfile([], [{ pairId: "p01_panorama_or_story", choice: "a" }]);
const pairB = Preference.estimateProfile([], [{ pairId: "p01_panorama_or_story", choice: "b" }]);
for (const feature of ["mountain", "ocean", "scenic_value", "culture_history", "traditional_market"]) {
  assert.ok(Math.abs(pairA.featureEstimates[feature].mean + pairB.featureEstimates[feature].mean) < 1e-9, `${feature}: pair symmetry`);
  assert.equal(pairA.featureEstimates[feature].uncertainty, pairB.featureEstimates[feature].uncertainty, `${feature}: pair uncertainty symmetry`);
}

const skipped = Preference.estimateProfile(
  Preference.QUESTIONS.map((question) => ({ questionId: question.id, optionId: "skip" })),
  [],
);
assert.equal(Preference.materializePreferences(skipped).length, 0);
assert.ok(Object.values(skipped.featureEstimates).every((estimate) => estimate.mean === 0 && estimate.active === false));
assert.ok(Object.values(skipped.axisEstimates).every((estimate) => estimate.mean === 0 && estimate.confidence === 0));

const refinedRepresentative = Preference.estimateProfile(representativeAnswers, [{ pairId: "p01_panorama_or_story", choice: "b" }]);
assert.equal(refinedRepresentative.displaySummary.archetypeId, representative.displaySummary.archetypeId, "label refinement must not change type letters");

const firstPair = Preference.nextAdaptivePair(representative, []);
const firstPairAgain = Preference.nextAdaptivePair(representative, []);
assert.equal(firstPair.pair.id, firstPairAgain.pair.id);
const secondPair = Preference.nextAdaptivePair(representative, [firstPair.pair.id]);
assert.notEqual(secondPair.pair.id, firstPair.pair.id);
assert.equal(Preference.nextAdaptivePair(representative, Preference.PAIRS.map((pair) => pair.id)), null);

const shareText = Preference.publicShareText(representative);
assert.match(shareText, /AIL · 로컬 콘텐츠 탐험가/u);
assert.doesNotMatch(shareText, /featureEstimates|questionnaire|activity|confidence/u);

assert.throws(() => Preference.estimateProfile([{ questionId: "unknown", optionId: "a" }]), /알 수 없는 질문/u);
assert.throws(() => Preference.estimateProfile([], [{ pairId: "unknown", choice: "a" }]), /알 수 없는 가상 장소/u);

const normalizeSource = (source) => source.replace(/\r\n/g, "\n").trimEnd();
assert.equal(
  normalizeSource(fs.readFileSync(path.join(__dirname, "..", "travel-mbti-site", "app", "lib", "preference-elicitation.js"), "utf8")),
  normalizeSource(fs.readFileSync(path.join(__dirname, "..", "map-ui", "preference-elicitation.js"), "utf8")),
  "standalone site engine snapshot must match map UI engine",
);

console.log("Travel preference elicitation tests passed");
