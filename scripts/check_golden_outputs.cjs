"use strict";
/*
 * SPEC-113 REQ-002: deterministic golden outputs for the browser ranker, preference engine and
 * itinerary helpers. Default mode compares against scripts/fixtures/golden/js_outputs.json;
 * `--update` rewrites it (only when a behavior change is intended and recorded in a SPEC).
 *
 *   node scripts/check_golden_outputs.cjs [--update]
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CCU = require("../map-ui/ccu-mmr.js");
const Preference = require("../map-ui/preference-elicitation.js");
const Itinerary = require("../map-ui/itinerary.js");

const ROOT = path.resolve(__dirname, "..");
const BUNDLE_PATH = path.join(ROOT, "map-ui", "data", "jeju-places.js");
const GOLDEN_PATH = path.join(__dirname, "fixtures", "golden", "js_outputs.json");
const SCHEMA_VERSION = "trip-ai-golden-js-v1";

// Sorted object keys keep hashes stable when a refactor only reorders property construction;
// array order and number values still have to match exactly.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function digest(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function capture(fn) {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

function loadBundle() {
  const source = fs.readFileSync(BUNDLE_PATH, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: BUNDLE_PATH });
  return { sourceSha256: sha256(source), rawPlaces: sandbox.window.JEJU_PLACES };
}

// Reference copy of the map-ui/app.js place enrichment at the SPEC-113 baseline.
function featureKey(label) {
  return String(label || "").split(".").at(-1);
}

function contextScores(records) {
  return Object.fromEntries((records || []).map((record) => [record.key, record.state === "numeric" ? record.value : null]));
}

function enrichPlace(place) {
  const atomicFeatures = {};
  for (const record of place.v5?.labels || []) {
    if (["theme.", "environment.", "style_evidence."].some((prefix) => record.label.startsWith(prefix))) {
      if (Number.isFinite(record.value)) atomicFeatures[featureKey(record.label)] = Number(record.value);
    }
  }
  return {
    ...place,
    atomicFeatures,
    companionScores: contextScores(place.fit?.companion),
    monthScores: contextScores(place.fit?.month),
    recommendationReady: Boolean(place.v5 && place.fit && CCU.ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
    searchText: `${place.title || ""} ${place.address || ""}`.normalize("NFKC").toLocaleLowerCase("ko-KR"),
  };
}

// --- Preference engine ------------------------------------------------------------------------

const QUESTIONS = Preference.QUESTIONS;
const axisOption = (question, sign) => [...question.options].sort((left, right) => sign * (right.axisValue - left.axisValue))[0].id;
const ANSWER_SETS = {
  "axis-positive": {
    questionnaire: QUESTIONS.map((question) => ({ questionId: question.id, optionId: axisOption(question, 1) })),
    pairChoices: ["a", "a", "a"],
  },
  "axis-negative": {
    questionnaire: QUESTIONS.map((question) => ({ questionId: question.id, optionId: axisOption(question, -1) })),
    pairChoices: ["b", "both_dislike", "b"],
  },
  mixed: {
    questionnaire: QUESTIONS.map((question, index) => ({
      questionId: question.id,
      optionId: [question.options[0].id, question.options[1].id, "both_like", "both_dislike", "skip", question.options[1].id][index % 6],
    })),
    pairChoices: ["both_like", "b", "tie"],
  },
  partial: {
    questionnaire: QUESTIONS.slice(0, 7).map((question, index) => ({ questionId: question.id, optionId: question.options[index % 2].id })),
    pairChoices: ["skip", "a"],
  },
};

// Mirrors the wizard: questionnaire first, then up to MAX_PAIR_QUESTIONS adaptive pairs.
function runPreferenceFlow({ questionnaire, pairChoices }) {
  const pairs = [];
  let profile = Preference.estimateProfile(questionnaire, pairs);
  const pairTrace = [];
  for (const choice of pairChoices.slice(0, Preference.MAX_PAIR_QUESTIONS)) {
    const next = Preference.nextAdaptivePair(profile, pairs.map((answer) => answer.pairId));
    if (!next) break;
    pairTrace.push({ pairId: next.pair.id, informationScore: next.informationScore, predictedPreference: next.predictedPreference });
    pairs.push({ pairId: next.pair.id, choice });
    profile = Preference.estimateProfile(questionnaire, pairs);
  }
  return { profile, pairTrace };
}

function preferenceOutputs() {
  const profiles = {};
  const outputs = {};
  for (const [name, answers] of Object.entries(ANSWER_SETS)) {
    const { profile, pairTrace } = runPreferenceFlow(answers);
    profiles[name] = profile;
    outputs[name] = {
      profileSha256: digest(profile),
      status: profile.status,
      archetypeId: profile.displaySummary.archetypeId,
      pairTrace,
      preferences: Preference.materializePreferences(profile),
      shareText: Preference.publicShareText(profile),
    };
  }
  outputs.errors = {
    unknownQuestion: capture(() => Preference.estimateProfile([{ questionId: "missing", optionId: "a" }])).error,
    duplicatePair: capture(() => Preference.estimateProfile([], [{ pairId: Preference.PAIRS[0].id }, { pairId: Preference.PAIRS[0].id }])).error,
    materializeInvalid: capture(() => Preference.materializePreferences({ schemaVersion: "other" })).error,
    shareWithoutSummary: capture(() => Preference.publicShareText({})).error,
  };
  return { profiles, outputs };
}

// --- Ranker -----------------------------------------------------------------------------------

const KNOWN_CONTENT_TYPES = ["12", "14", "15", "25", "28", "32", "38", "39"];
const INTENTS = ["visit", "shopping", "stay", "event"];
const COMPANIONS = ["none", "solo", "couple", "friends", "kids", "parents"];
const TRANSPORTS = ["car", "no_car"];
const PERIODS = [
  { id: "1d", travelWindow: { startDate: "2026-10-01", endDate: "2026-10-01" } },
  { id: "3d", travelWindow: { startDate: "2026-08-20", endDate: "2026-08-22" } },
];
const VARIANTS = ["seed-rank-1", "seed-rank-2", "seed-rank-3"];
const MANUAL_PREFERENCES = [
  { feature: "ocean", mode: "benefit", weight: 4 },
  { feature: "physical_ease", mode: "benefit", weight: 2 },
  { feature: "local_embeddedness", mode: "benefit", weight: 2 },
  { feature: "photo_value", mode: "benefit", weight: 1 },
];

function preferenceFields(name, profiles) {
  if (name === "none") return { preferences: [] };
  if (name === "manual") return { preferences: MANUAL_PREFERENCES };
  const profile = profiles[name.replace(/^mbti:/u, "")];
  return {
    schemaVersion: CCU.PERSONALIZED_REQUEST_SCHEMA_VERSION,
    preferenceProfile: profile,
    preferences: Preference.materializePreferences(profile),
  };
}

// Same shape as map-ui/wizard.js collectRequest().
function buildRankRequest(options, profiles, contentTypeIds) {
  return {
    ...preferenceFields(options.preferences, profiles),
    requestId: "local-dashboard",
    destinationRegion: options.region || "jeju_all",
    intent: options.intent,
    travelWindow: options.travelWindow ?? null,
    tripDays: options.tripDays ?? null,
    transportMode: options.transport,
    companionType: options.companion,
    hardConstraints: options.hardConstraints || [],
    requiredPlaceIds: options.requiredPlaceIds || [],
    anchorPlaceIds: options.anchorPlaceIds || [],
    excludedPlaceIds: options.excludedPlaceIds || [],
    resultCount: options.resultCount ?? 10,
    diversity: options.diversity || "balanced",
    candidateFilter: { query: null, contentTypeIds },
  };
}

function summarizeRank(result) {
  return {
    sha256: digest(result),
    variantId: result.courseVariant?.variantId ?? null,
    itemPlaceIds: result.items.map((item) => String(item.placeId)),
    scheduleStatus: result.schedule.status,
    dayPlaceIds: result.schedule.dayClusters.map((day) => day.placeIds.map(String)),
    verificationCandidates: result.verificationCandidates.length,
  };
}

function rankScenarios(profiles) {
  const preferenceSets = ["mbti:axis-positive", "mbti:axis-negative", "mbti:mixed", "manual", "none"];
  const scenarios = [];
  INTENTS.forEach((intent, intentIndex) => {
    COMPANIONS.forEach((companion, companionIndex) => {
      const index = intentIndex * COMPANIONS.length + companionIndex;
      const transport = TRANSPORTS[companionIndex % 2];
      const period = PERIODS[Math.floor(companionIndex / 2) % 2];
      const preferences = preferenceSets[index % preferenceSets.length];
      for (const variantId of VARIANTS) {
        scenarios.push({
          id: `${intent}.${companion}.${transport}.${period.id}.${preferences}.${variantId}`,
          request: { intent, companion, transport, travelWindow: period.travelWindow, preferences },
          runtime: { variantId },
        });
      }
    });
  });
  const base = { intent: "visit", companion: "parents", transport: "car", travelWindow: PERIODS[1].travelWindow, preferences: "manual" };
  const special = {
    required: { ...base, requiredPlaceIds: ["126435"] },
    "required-mbti": { ...base, preferences: "mbti:mixed", requiredPlaceIds: ["126435", "126446"] },
    anchor: { ...base, anchorPlaceIds: ["591866"] },
    "required-anchor": { ...base, requiredPlaceIds: ["126435"], anchorPlaceIds: ["131836"] },
    excluded: { ...base, excludedPlaceIds: ["591866", "126446"] },
    "hard-constraint": { ...base, hardConstraints: ["wheelchair_accessible"] },
    "result-count-1": { ...base, resultCount: 1 },
    "result-count-20": { ...base, preferences: "mbti:axis-negative", resultCount: 20 },
    "duration-2": { ...base, travelWindow: null, tripDays: 2 },
    "duration-3-no-car": { ...base, transport: "no_car", travelWindow: null, tripDays: 3, preferences: "mbti:axis-positive" },
    "region-jeju-city": { ...base, region: "jeju_city", preferences: "mbti:axis-positive" },
    "region-seogwipo": { ...base, region: "seogwipo_city", companion: "kids" },
    "long-trip": { ...base, travelWindow: { startDate: "2026-12-29", endDate: "2027-01-04" } },
  };
  for (const [name, request] of Object.entries(special)) {
    for (const variantId of VARIANTS) scenarios.push({ id: `special.${name}.${variantId}`, request, runtime: { variantId } });
  }
  scenarios.push({ id: "special.diversity-off", request: { ...base, diversity: "off" }, runtime: {} });
  scenarios.push({ id: "special.diversity-off-mbti", request: { ...base, diversity: "off", preferences: "mbti:axis-positive" }, runtime: {} });
  for (const randomValue of [0.05, 0.65, 0.95]) {
    scenarios.push({ id: `special.weighted-random-${randomValue}`, request: base, runtime: { random: () => randomValue } });
  }
  const invalid = {
    "event-without-dates": { ...base, intent: "event", travelWindow: null, tripDays: 2 },
    "required-excluded-overlap": { ...base, requiredPlaceIds: ["126435"], excludedPlaceIds: ["126435"] },
    "result-count-zero": { ...base, resultCount: 0 },
    "unknown-region": { ...base, region: "busan" },
  };
  for (const [name, request] of Object.entries(invalid)) scenarios.push({ id: `invalid.${name}`, request, runtime: { variantId: "seed-rank-1" } });
  scenarios.push({ id: "invalid.unknown-variant", request: base, runtime: { variantId: "seed-rank-9" } });
  scenarios.push({ id: "invalid.unknown-feature", request: base, runtime: { variantId: "seed-rank-1" }, override: { preferences: [{ feature: "missing", mode: "benefit", weight: 1 }] } });
  return scenarios;
}

function rankOutputs(places, profiles, contentTypeIds) {
  const outputs = {};
  const results = {};
  for (const scenario of rankScenarios(profiles)) {
    const request = { ...buildRankRequest(scenario.request, profiles, contentTypeIds), ...(scenario.override || {}) };
    const run = capture(() => CCU.rank(places, request, scenario.runtime));
    outputs[scenario.id] = run.error ? { error: run.error } : summarizeRank(run.value);
    if (run.value) results[scenario.id] = run.value;
  }
  outputs["invalid.duplicate-place-id"] = { error: capture(() => CCU.rank([places[0], places[0]], buildRankRequest({ intent: "visit", companion: "none", transport: "car", preferences: "none" }, profiles, contentTypeIds))).error };
  return { outputs, results };
}

function courseVariantOutputs(results) {
  const outputs = {};
  for (const id of ["visit.parents.no_car.1d.manual.seed-rank-1", "special.required.seed-rank-2", "special.long-trip.seed-rank-3"]) {
    const result = results[id];
    if (!result) {
      outputs[id] = { error: "missing rank result" };
      continue;
    }
    const variants = result.courseVariants;
    const current = result.courseVariant.variantId;
    outputs[id] = {
      next: [
        CCU.selectNextCourseVariant(variants, [], current),
        CCU.selectNextCourseVariant(variants, [current], current),
        CCU.selectNextCourseVariant(variants, variants.map((variant) => variant.variantId), current),
        CCU.selectNextCourseVariant(variants, ["seed-rank-1", "seed-rank-2"], null),
      ],
      overlap: variants.map((variant) => CCU.courseOverlapTrace(variants[0].placeIds, variant.placeIds)),
    };
  }
  return outputs;
}

// --- Itinerary helpers ------------------------------------------------------------------------

function itineraryOptions(result, extra = {}) {
  return {
    requestId: "golden-itinerary",
    recommendationRevision: 3,
    sourceMapVersion: "golden-map",
    days: result.schedule.dayClusters.map((day, index) => ({
      dayIndex: day.dayIndex,
      startLocation: { placeId: day.placeIds[0] },
      endLocation: { placeId: day.placeIds.at(-1) },
      startTime: index === 0 ? "10:00" : "09:00",
      endTime: "20:30",
      mealModes: index === 1 ? { lunch: "required", dinner: "excluded" } : undefined,
    })),
    ...extra,
  };
}

function syntheticCandidate(id, verdict, insertion = {}) {
  return {
    restaurantId: `kakao:${id}`,
    title: `식당 ${id}`,
    category: id % 2 ? "한식" : "국수",
    insertion: { basis: "distance_estimate", departPrevious: "2026-10-01T11:50:00+09:00", arrival: "2026-10-01T12:05:00+09:00",
      mealEnd: "2026-10-01T13:05:00+09:00", nextArrival: "2026-10-01T13:30:00+09:00", toRestaurantMinutes: 15, fromRestaurantMinutes: 25, ...insertion },
    judgement: verdict ? { status: "judged", verdict } : { status: "unavailable", verdict: null },
  };
}

function itineraryOutputs(results) {
  const exact = results["special.required.seed-rank-1"];
  const oneDay = results["visit.none.car.1d.mbti:axis-positive.seed-rank-1"];
  const noCar = results["visit.solo.no_car.1d.mbti:axis-negative.seed-rank-1"];
  const duration = results["special.duration-2.seed-rank-1"];
  const personalized = results["special.required-mbti.seed-rank-1"];
  const requests = {
    exact: capture(() => Itinerary.buildRequest(exact, itineraryOptions(exact))),
    exactCustomMeals: capture(() => Itinerary.buildRequest(exact, itineraryOptions(exact, {
      mealPreferences: { lunch: { windowStart: "12:00", windowEnd: "13:30", durationMinutes: 45 }, dinner: { windowStart: "18:00", windowEnd: "20:00", durationMinutes: 90 }, maxDetourMinutes: 35 },
    }))),
    personalized: capture(() => Itinerary.buildRequest(personalized, itineraryOptions(personalized))),
    oneDay: capture(() => Itinerary.buildRequest(oneDay, itineraryOptions(oneDay))),
    noCar: capture(() => Itinerary.buildRequest(noCar, itineraryOptions(noCar))),
    duration: capture(() => Itinerary.buildRequest(duration, itineraryOptions(duration))),
    invalidMeal: capture(() => Itinerary.buildRequest(exact, itineraryOptions(exact, { mealPreferences: { lunch: { windowStart: "13:00", windowEnd: "12:00", durationMinutes: 60 } } }))),
    invalidDetour: capture(() => Itinerary.buildRequest(exact, itineraryOptions(exact, { mealPreferences: { maxDetourMinutes: 61 } }))),
    missingLocation: capture(() => Itinerary.buildRequest(exact, { ...itineraryOptions(exact), days: [] })),
    noResult: capture(() => Itinerary.buildRequest(null, {})),
  };
  const slot = {
    slotId: "2026-10-01-lunch",
    restaurantCandidates: [syntheticCandidate(1, "recommended"), syntheticCandidate(2, "not_recommended"), syntheticCandidate(3, null), syntheticCandidate(4, "acceptable"), syntheticCandidate(5, "not_recommended")],
  };
  const day = {
    legs: [
      { fromId: "a", toId: "b", departureTime: "2026-10-01T11:40:00+09:00", durationMinutes: 30 },
      { fromId: "b", toId: "c", departureTime: "2026-10-01T15:00:00+09:00", durationMinutes: 20 },
      { fromId: "c", toId: "d", departureTime: "2026-10-01T18:10:00+09:00", durationMinutes: 25 },
    ],
    mealSlots: [
      { slotId: "lunch", beforeLocation: { placeId: "a", title: "A" }, afterLocation: { placeId: "b", title: "B" } },
      { slotId: "snack", beforeLocation: { placeId: "a", title: "A" }, afterLocation: { placeId: "b", title: "B" } },
      { slotId: "dinner", beforeLocation: { placeId: "c", title: "C" }, afterLocation: { placeId: "d", title: "D" } },
    ],
  };
  const pick = (candidate) => ({ restaurantId: candidate.restaurantId, title: candidate.title, candidate });
  const mealRoutes = {
    lunchOnly: Itinerary.selectedMealRoutes(day, new Map([["lunch", pick(slot.restaurantCandidates[0])]])),
    duplicateLeg: Itinerary.selectedMealRoutes(day, new Map([["lunch", pick(slot.restaurantCandidates[0])], ["snack", pick(slot.restaurantCandidates[3])]])),
    missingInsertion: Itinerary.selectedMealRoutes(day, new Map([["dinner", { restaurantId: "kakao:9", title: "식당 9", candidate: { insertion: { departPrevious: null } } }]])),
    none: Itinerary.selectedMealRoutes(day, new Map()),
  };
  return {
    requests: Object.fromEntries(Object.entries(requests).map(([name, run]) => [name, run.error ? { error: run.error } : { sha256: digest(run.value), value: run.value }])),
    eligibility: Object.fromEntries(Object.entries({ exact, oneDay, noCar, duration, missing: null }).map(([name, result]) => [name, Itinerary.eligibility(result)])),
    travelerContext: [personalized?.request, exact?.request, { companionType: "pets", preferences: [{ feature: "ocean", mode: "target" }, { feature: "ocean", mode: "benefit" }] }].map(Itinerary.travelerContext),
    foodContext: Itinerary.foodContext([
      { restaurantId: "kakao:1", category: "국수" }, { restaurantId: "kakao:1", category: "중복" }, { restaurantId: "naver:2", category: "무효" },
      { restaurantId: "kakao:3", category: "흑돼지".repeat(10) }, null,
    ]),
    verdictLabels: [{ status: "judged", verdict: "recommended" }, { status: "judged", verdict: "other" }, { status: "unavailable" }, null].map(Itinerary.verdictLabel),
    partition: Itinerary.partitionCandidates(slot),
    partitionEmpty: Itinerary.partitionCandidates({}),
    mealRoutes,
    defaultMeals: Itinerary.DEFAULT_MEALS,
    preferenceFeaturesShared: Itinerary.PREFERENCE_FEATURES === CCU.ATOMIC_FEATURES,
  };
}

// --- Driver -----------------------------------------------------------------------------------

function buildGolden() {
  const { sourceSha256, rawPlaces } = loadBundle();
  const places = rawPlaces.map(enrichPlace);
  const presentTypes = new Set(places.map((place) => String(place.type)));
  const contentTypeIds = KNOWN_CONTENT_TYPES.filter((type) => presentTypes.has(type)).sort();
  const { profiles, outputs: preference } = preferenceOutputs();
  const { outputs: rank, results } = rankOutputs(places, profiles, contentTypeIds);
  return {
    schemaVersion: SCHEMA_VERSION,
    inputs: { placesBundleSha256: sourceSha256, placeCount: rawPlaces.length, algorithmVersion: CCU.ALGORITHM_VERSION },
    enrichedPlaces: { sha256: digest(places), recommendationReady: places.filter((place) => place.recommendationReady).length },
    preference,
    rank,
    courseVariants: courseVariantOutputs(results),
    itinerary: itineraryOutputs(results),
  };
}

function differences(expected, actual, prefix = "", found = []) {
  if (found.length >= 40) return found;
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (isObject(expected) && isObject(actual)) {
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
      differences(expected[key], actual[key], prefix ? `${prefix}.${key}` : key, found);
    }
  } else if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    found.push(prefix || "(root)");
  }
  return found;
}

function main() {
  const update = process.argv.includes("--update");
  const golden = buildGolden();
  const rendered = `${JSON.stringify(golden, null, 2)}\n`;
  if (update) {
    fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
    fs.writeFileSync(GOLDEN_PATH, rendered, "utf8");
    console.log(`Updated ${path.relative(ROOT, GOLDEN_PATH)}: ${Object.keys(golden.rank).length} rank scenarios`);
    return;
  }
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error(`Missing ${path.relative(ROOT, GOLDEN_PATH)}; run with --update on the baseline commit first.`);
    process.exitCode = 1;
    return;
  }
  // Compare parsed JSON so CRLF checkouts do not count as a difference.
  const expected = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  const actual = JSON.parse(rendered);
  const changed = differences(expected, actual);
  if (changed.length) {
    console.error(`FAIL: JS golden outputs differ (${changed.length}${changed.length >= 40 ? "+" : ""} paths):`);
    for (const item of changed) console.error(`  - ${item}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: JS golden outputs match (${Object.keys(golden.rank).length} rank scenarios, ${Object.keys(golden.preference).length - 1} preference flows, itinerary helpers)`);
}

main();
