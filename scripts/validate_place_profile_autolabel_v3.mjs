import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const v2Directory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v2-100",
);
const v3Directory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v3-auto-100",
);
const scoringDirectory = path.join(v3Directory, "scoring");

const CLIMATE_FIXTURE_CANONICAL_SHA256 = "f4280833510c0a2180093fbfce6671b56d08aae21af034541daa8831653e3370";
const KMA_CLIMATE_TABLE_PDF_SHA256 = "bc0ee3819d0e593bc529f60d981c2a17b82f6fa10a95e77820709c567b71314c";
const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const SUMMER_MONTH_KEYS = ["6", "7", "8", "9"];
const CLIMATE_METRIC_KEYS = ["mean_temperature_c", "mean_daily_max_c", "precipitation_mm", "mean_relative_humidity_pct", "mean_wind_ms"];
const MONTH_ARCHETYPE_KEYS = ["indoor_neutral", "outdoor_neutral", "mixed_neutral", "beach_water", "coast_photo", "forest_hike", "hot_spring", "camping_outdoor_sport", "festival_na"];
const LABEL_VALUES = new Set([0, 0.25, 0.5, 0.75, 1]);
const INFERENCE_LEVELS = new Set(["direct_evidence", "researched_inference", "archetype_prior", "climate_heuristic", "not_applicable"]);
const REVIEW_PRIORITIES = new Set(["low", "medium", "high"]);
const FESTIVAL_IDS = new Set(["3482354", "3014969", "3546882", "3554702"]);
const REJECTED_V2_COMPANION_DIRECT = new Set(["3396532:solo"]);
const EXPLICIT_MONTH_VALUES = {
  "1926379": { "9": 0.75, "10": 0.75, "11": 0.75 },
  "2765234": { "9": 0.75, "10": 0.75, "11": 0.75 },
  "2662743": { "3": 0.75, "4": 0.75, "5": 0.75 },
  "1889809": { "1": 0.75, "2": 0.75, "12": 0.75 },
  "2723542": { "3": 0.75, "4": 0.75, "5": 0.75, "6": 0.75, "7": 0.75, "8": 0.75 },
  "2742357": { "6": 0.75, "7": 0.75, "8": 0.75 },
  "2414812": { "3": 0.75, "4": 0.75, "5": 0.75 },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalFixtureSha256(fixture) {
  const { canonical_sha256: ignoredCanonicalSha256, ...payload } = fixture;
  void ignoredCanonicalSha256;
  return crypto.createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}

function oneDecimalMean(values) {
  const tenths = values.map((value) => Math.round(value * 10));
  return Math.round(tenths.reduce((sum, value) => sum + value, 0) / tenths.length) / 10;
}

function monthMap(vector) {
  return Object.fromEntries(MONTH_KEYS.map((month, index) => [month, vector[index]]));
}

function exactKeys(value, keys, message) {
  assert(value && typeof value === "object" && !Array.isArray(value), message);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), message);
}

function verifyAxis(axis, context, { allowNull = false } = {}) {
  assert(axis && typeof axis === "object" && !Array.isArray(axis), `${context} must be an object`);
  assert(INFERENCE_LEVELS.has(axis.inference_level), `${context} inference level is invalid`);
  assert.equal(typeof axis.rationale, "string", `${context} rationale must be a string`);
  assert(axis.rationale.trim(), `${context} rationale is empty`);
  assert(Array.isArray(axis.evidence_ids) && axis.evidence_ids.length > 0, `${context} evidence IDs are missing`);
  assert(Array.isArray(axis.rule_ids) && axis.rule_ids.length > 0, `${context} rule IDs are missing`);
  if (allowNull) {
    assert.equal(axis.value, null, `${context} must be null`);
    assert.equal(axis.confidence, null, `${context} N/A confidence must be null`);
    assert.equal(axis.inference_level, "not_applicable", `${context} must be not applicable`);
    assert.equal(axis.null_reason, "date_gated_not_applicable", `${context} null reason differs`);
    return;
  }
  assert(LABEL_VALUES.has(axis.value), `${context} value is invalid`);
  assert(LABEL_VALUES.has(axis.confidence), `${context} confidence is invalid`);
  assert.notEqual(axis.inference_level, "not_applicable", `${context} cannot be N/A`);
  if (axis.inference_level !== "direct_evidence") {
    assert(![0, 1].includes(axis.value), `${context} inferred extreme is forbidden`);
    assert(axis.confidence <= 0.5, `${context} inferred confidence must be <= 0.5`);
  }
}

const v2ProfilesPath = path.join(v2Directory, "place_profiles.json");
const researchPath = path.join(v2Directory, "place_web_research.json");
const v2ManifestPath = path.join(v2Directory, "manifest.json");
const profilesPath = path.join(v3Directory, "place_profiles.json");
const proposalsPath = path.join(v3Directory, "auto_label_proposals.json");
const assignmentsPath = path.join(scoringDirectory, "archetype_assignments.json");
const climatePath = path.join(v3Directory, "climate_baseline.json");
const monthProfilesPath = path.join(scoringDirectory, "month_profiles.json");
const manifestPath = path.join(v3Directory, "manifest.json");
const climateInputPath = path.join(workspaceRoot, "data", "climate", "kma", "1991-2020", "jeju_four_station_monthly_normals.json");

const v2Profiles = readJson(v2ProfilesPath);
const research = readJson(researchPath);
const v2Manifest = readJson(v2ManifestPath);
const profiles = readJson(profilesPath);
const proposals = readJson(proposalsPath);
const assignments = readJson(assignmentsPath);
const climate = readJson(climatePath);
const monthProfiles = readJson(monthProfilesPath);
const climateInput = readJson(climateInputPath);
const manifest = readJson(manifestPath);
const assignmentParts = [1, 2, 3].flatMap((part) => readJson(path.join(scoringDirectory, `assignments_part_${part}.json`)));

assert.equal(v2Profiles.length, 100);
assert.equal(research.length, 100);
assert.equal(profiles.length, 100);
assert.equal(proposals.length, 100);
assert.equal(assignments.length, 100);
assert.deepEqual(assignments, assignmentParts, "combined assignments differ from the three reviewed parts");

const v2Ids = v2Profiles.map((profile) => String(profile.contentid));
assert.equal(new Set(v2Ids).size, 100, "v2 IDs must be unique");
assert.deepEqual(profiles.map((profile) => profile.contentid), v2Ids, "v3 profile order differs from v2");
assert.deepEqual(proposals.map((proposal) => proposal.contentid), v2Ids, "proposal order differs from v2");
assert.deepEqual(assignments.map((assignment) => assignment.contentid), v2Ids, "assignment order differs from v2");

let companionNumeric = 0;
let companionDirect = 0;
let companionInferred = 0;
let nonfestivalMonthNumeric = 0;
let nonfestivalMonthDirect = 0;
let festivalMonthNa = 0;
let inferredExtremes = 0;
const priorityCounts = { low: 0, medium: 0, high: 0 };

for (let index = 0; index < 100; index += 1) {
  const base = v2Profiles[index];
  const profile = profiles[index];
  const proposal = proposals[index];
  const assignment = assignments[index];
  const web = research[index];
  const prefix = `items[${index}] ${profile.contentid}`;
  const festival = FESTIVAL_IDS.has(profile.contentid);

  assert.equal(profile.title, base.title, `${prefix} title differs`);
  assert.deepEqual(profile.source_place, base.source_place, `${prefix} source place differs`);
  assert.equal(web.contentid, profile.contentid, `${prefix} research identity differs`);
  assert.equal(assignment.title, profile.title, `${prefix} assignment title differs`);
  assert.equal(proposal.title, profile.title, `${prefix} proposal title differs`);
  assert.equal(profile.label_meta.version, "place-profile-pilot-v3-auto", `${prefix} label version differs`);
  assert.equal(profile.label_meta.review_priority, proposal.review_priority, `${prefix} priority differs`);
  assert(REVIEW_PRIORITIES.has(proposal.review_priority), `${prefix} review priority is invalid`);
  priorityCounts[proposal.review_priority] += 1;
  assert(Array.isArray(proposal.review_reasons) && proposal.review_reasons.length > 0, `${prefix} review reasons are missing`);
  assert(Array.isArray(proposal.hard_constraints), `${prefix} hard constraints must be an array`);
  if (proposal.review_priority === "low") assert.equal(proposal.hard_constraints.length, 0, `${prefix} low priority cannot have a hard constraint`);
  proposal.hard_constraints.forEach((constraint, constraintIndex) => {
    exactKeys(constraint, ["kind", "applies_to", "condition", "status", "action", "source", "checked_at", "rule_id"], `${prefix}.hard_constraints[${constraintIndex}] structure differs`);
    assert(constraint.applies_to.trim(), `${prefix} hard constraint scope is empty`);
    assert(constraint.condition.trim(), `${prefix} hard constraint condition is empty`);
    assert(["confirmed", "unknown", "stale"].includes(constraint.status), `${prefix} hard constraint status is invalid`);
    assert(["exclude", "verify"].includes(constraint.action), `${prefix} hard constraint action is invalid`);
  });

  exactKeys(profile.companion_fit, COMPANION_KEYS, `${prefix} companion keys differ`);
  exactKeys(proposal.companion_fit, COMPANION_KEYS, `${prefix} proposal companion keys differ`);
  for (const key of COMPANION_KEYS) {
    const axis = proposal.companion_fit[key];
    verifyAxis(axis, `${prefix}.companion_fit.${key}`);
    assert.equal(profile.companion_fit[key], axis.value, `${prefix} companion profile/proposal value differs`);
    companionNumeric += 1;
    if (axis.inference_level === "direct_evidence") companionDirect += 1;
    else companionInferred += 1;
    const rejectedDirect = REJECTED_V2_COMPANION_DIRECT.has(`${profile.contentid}:${key}`);
    if (base.companion_fit[key] !== null && !rejectedDirect) {
      assert.equal(axis.value, base.companion_fit[key], `${prefix} v2 companion evidence changed`);
      assert.equal(axis.inference_level, "direct_evidence", `${prefix} v2 companion evidence is not marked direct`);
    } else {
      assert(!axis.rule_ids.includes("COMP-DIRECT-V2"), `${prefix} empty v2 axis is incorrectly marked as a v2 direct label`);
    }
    if (axis.inference_level !== "direct_evidence" && [0, 1].includes(axis.value)) inferredExtremes += 1;
  }

  exactKeys(profile.month_fit, MONTH_KEYS, `${prefix} month keys differ`);
  exactKeys(proposal.month_fit, MONTH_KEYS, `${prefix} proposal month keys differ`);
  assert.equal(festival, profile.source_place.contenttypeid === "15", `${prefix} festival type differs`);
  assert.equal(festival, assignment.month_archetype === "festival_na", `${prefix} festival assignment differs`);
  for (const month of MONTH_KEYS) {
    const axis = proposal.month_fit[month];
    if (festival) {
      verifyAxis(axis, `${prefix}.month_fit.${month}`, { allowNull: true });
      assert.equal(profile.month_fit[month], null, `${prefix} festival profile month must be null`);
      festivalMonthNa += 1;
      continue;
    }
    verifyAxis(axis, `${prefix}.month_fit.${month}`);
    assert.equal(profile.month_fit[month], axis.value, `${prefix} month profile/proposal value differs`);
    nonfestivalMonthNumeric += 1;
    const explicitValue = EXPLICIT_MONTH_VALUES[profile.contentid]?.[month];
    if (explicitValue !== undefined) {
      assert.equal(axis.value, explicitValue, `${prefix} direct season value differs`);
      assert.equal(axis.inference_level, "direct_evidence", `${prefix} direct season is not marked direct`);
      assert(axis.rule_ids.includes("MONTH-DIRECT-SEASON"), `${prefix} direct season rule is missing`);
      assert(web.facts.seasonality, `${prefix} direct season fact is missing`);
      nonfestivalMonthDirect += 1;
    } else {
      assert.notEqual(axis.inference_level, "direct_evidence", `${prefix} month without an explicit season mapping is marked direct`);
    }
    if (axis.inference_level !== "direct_evidence" && [0, 1].includes(axis.value)) inferredExtremes += 1;
  }

  assert.equal(profile.label_evidence.companion_basis.length, 5, `${prefix} companion rationale coverage differs`);
  assert.equal(profile.label_evidence.month_basis.length, 12, `${prefix} month rationale coverage differs`);
  assert.deepEqual(profile.label_evidence.hard_constraints, proposal.hard_constraints, `${prefix} profile constraints differ`);
  if (proposal.review_priority === "low") {
    for (const key of ["kids", "parents"]) {
      const axis = proposal.companion_fit[key];
      assert(axis.inference_level === "direct_evidence" || axis.value === 0.5, `${prefix} low priority has a non-neutral inferred ${key} value`);
    }
    assert(!(base.label_evidence.physical_effort >= 0.75), `${prefix} low priority has high physical effort`);
  }
}

assert.equal(companionNumeric, 500, "companion numeric coverage must be 500/500");
assert.equal(companionDirect + companionInferred, 500);
assert.equal(nonfestivalMonthNumeric, 1152, "non-festival month numeric coverage must be 1152/1152");
assert.equal(festivalMonthNa, 48, "festival N/A coverage must be 48/48");
assert.equal(inferredExtremes, 0, "inferred 0/1 values are forbidden");

const proposalById = new Map(proposals.map((proposal) => [proposal.contentid, proposal]));
assert.equal(proposalById.get("3396532").companion_fit.solo.inference_level, "researched_inference");
assert.equal(proposalById.get("3396532").companion_fit.solo.confidence, 0.5);
assert(proposalById.get("3396532").hard_constraints.some((constraint) => constraint.rule_id === "GATE-AGE-8"));
assert.equal(proposalById.get("2498698").companion_fit.solo.value, 0);
assert.equal(proposalById.get("2498698").companion_fit.solo.inference_level, "direct_evidence");
assert(proposalById.get("2498698").companion_fit.solo.rationale.includes("기본 2인"));
assert(proposalById.get("2498698").hard_constraints.some((constraint) => constraint.rule_id === "GATE-MIN-PARTY"));
assert(proposalById.get("131829").hard_constraints.some((constraint) => constraint.rule_id === "GATE-AGE-5"));
for (const contentid of ["1839784", "1839451", "1839709"]) {
  assert(proposalById.get(contentid).hard_constraints.some((constraint) => constraint.rule_id === "GATE-OLLE-SOLO-TIME"));
}

const expectedConstraintScopes = {
  "128150": { "GATE-WEATHER": "차밭 야외 관람" },
  "127052": { "GATE-WEATHER": "폭포 관람·수량" },
  "2705373": { "GATE-WEATHER": "레일바이크 탑승" },
  "2414827": { "GATE-WEATHER": "숲길 탐방" },
  "2765227": { "GATE-MOBILITY": "가파른 바리메오름 탐방 구간" },
  "577461": { "GATE-MOBILITY": "급경사 다랑쉬오름 탐방 구간" },
  "2704351": { "GATE-MOBILITY": "영주산의 긴 계단을 포함한 동쪽 탐방로" },
  "228854": { "GATE-MOBILITY": "휴게소에서 해안 입구로 내려가는 좁은 파식대 탐방로" },
  "126452": { "GATE-MOBILITY": "1km 공개 동굴 탐방 구간" },
  "129071": { "GATE-MOBILITY": "올레 2코스·식산봉 오름 선택 구간" },
  "130474": { "GATE-MOBILITY": "전통가옥·체험장 도보 관람 동선" },
  "1839451": { "GATE-MOBILITY": "15.1km 올레 1코스와 오름 구간" },
  "1839709": { "GATE-MOBILITY": "11.8km 올레 9코스와 가파른 월라봉 구간" },
  "2806561": { "GATE-MOBILITY": "7.5km 하영올레 도보 코스" },
};
for (const [contentid, scopes] of Object.entries(expectedConstraintScopes)) {
  for (const [ruleId, expectedScope] of Object.entries(scopes)) {
    const constraint = proposalById.get(contentid).hard_constraints.find((item) => item.rule_id === ruleId);
    assert(constraint, `${contentid} ${ruleId} constraint is missing`);
    assert.equal(constraint.applies_to, expectedScope, `${contentid} ${ruleId} scope differs`);
  }
}
const jungmunSeasonal = proposalById.get("126449").hard_constraints.find((constraint) => constraint.rule_id === "GATE-SEASONAL-OPERATION");
assert.equal(jungmunSeasonal.applies_to, "해수욕 개장·수상레저별 운영");
assert.equal(jungmunSeasonal.status, "unknown");
assert(jungmunSeasonal.condition.includes("개장 기간과 수상레저별 운영 조건"));
const chuja = proposalById.get("127863");
assert.equal(chuja.companion_archetype, "transport_or_ferry");
assert.deepEqual(chuja.flags, ["aggregate"]);
assert.equal(chuja.companion_fit.kids.value, 0.5);
assert.equal(chuja.companion_fit.parents.value, 0.5);
assert.equal(chuja.review_priority, "medium");
assert(!chuja.review_reasons.some((reason) => reason.includes("체력 부담이 높아")));
for (const [ruleId, scope] of [["GATE-CHUJA-FERRY", "추자도 여객선 입도"], ["GATE-CHUJA-OLLE", "추자올레 선택 코스"]]) {
  const constraint = chuja.hard_constraints.find((item) => item.rule_id === ruleId);
  assert(constraint, `127863 ${ruleId} constraint is missing`);
  assert.equal(constraint.applies_to, scope);
  assert.equal(constraint.status, "unknown");
}
for (const proposal of proposals) {
  for (const constraint of proposal.hard_constraints) {
    assert(!constraint.applies_to.includes("야외·수상 핵심 경험"), `${proposal.contentid} has the obsolete weather scope`);
    assert(!constraint.applies_to.includes("장거리·경사 구간을 포함한 탐방"), `${proposal.contentid} has the obsolete mobility scope`);
  }
}

assert.equal(climateInput.schema_version, "kma-jeju-four-station-climate-input-v1");
assert.equal(climateInput.baseline_period, "1991-2020");
assert.equal(climateInput.checked_at, "2026-08-10");
assert.equal(
  climateInput.canonicalization,
  "SHA-256 of UTF-8 recursive lexicographic-key JSON for this object with canonical_sha256 omitted",
);
assert.equal(canonicalFixtureSha256(climateInput), climateInput.canonical_sha256, "climate fixture canonical hash is invalid");
assert.equal(climateInput.canonical_sha256, CLIMATE_FIXTURE_CANONICAL_SHA256, "climate fixture is not the pinned version");
assert.deepEqual(climateInput.month_order, MONTH_KEYS, "climate fixture month order differs");

const expectedSourceIds = [
  "kma_normals_definition",
  "kma_climate_table_pdf",
  "kma_rainy_season",
  "kma_typhoon_statistics",
  "kma_jeju_region_climate",
];
assert.deepEqual(climateInput.sources.map((source) => source.id), expectedSourceIds, "climate fixture source IDs differ");
for (const source of climateInput.sources) {
  assert(/^https:\/\/(?:data\.kma\.go\.kr|www\.weather\.go\.kr)\//.test(source.url), `non-KMA climate source: ${source.url}`);
  assert(source.publisher && source.title && source.claim, `incomplete climate source: ${source.id}`);
}
const pdfSource = climateInput.sources.find((source) => source.id === "kma_climate_table_pdf");
assert.equal(pdfSource.document_sha256, KMA_CLIMATE_TABLE_PDF_SHA256, "KMA climate table PDF hash differs");
assert.equal(pdfSource.document_size_bytes, 21320494, "KMA climate table PDF size differs");

const expectedStations = [
  { station_id: "184", station_name: "제주", printed_pages: ["II-79", "II-80"], pdf_pages_1_based: [147, 148] },
  { station_id: "185", station_name: "고산", printed_pages: ["II-81", "II-82"], pdf_pages_1_based: [149, 150] },
  { station_id: "188", station_name: "성산", printed_pages: ["II-83", "II-84"], pdf_pages_1_based: [151, 152] },
  { station_id: "189", station_name: "서귀포", printed_pages: ["II-85", "II-86"], pdf_pages_1_based: [153, 154] },
];
assert.equal(climateInput.stations.length, 4, "climate fixture station count differs");
climateInput.stations.forEach((station, stationIndex) => {
  const expectedStation = expectedStations[stationIndex];
  assert.equal(station.station_id, expectedStation.station_id, `station ID differs at ${stationIndex}`);
  assert.equal(station.station_name, expectedStation.station_name, `station name differs at ${stationIndex}`);
  assert.equal(station.source_id, "kma_climate_table_pdf", `station source differs: ${station.station_id}`);
  assert.deepEqual(station.printed_pages, expectedStation.printed_pages, `printed pages differ: ${station.station_id}`);
  assert.deepEqual(station.pdf_pages_1_based, expectedStation.pdf_pages_1_based, `PDF pages differ: ${station.station_id}`);
  exactKeys(station.monthly, CLIMATE_METRIC_KEYS, `station metrics differ: ${station.station_id}`);
  for (const metric of CLIMATE_METRIC_KEYS) {
    const vector = station.monthly[metric];
    assert.equal(vector.length, 12, `${station.station_id} ${metric} month count differs`);
    assert(vector.every((value) => Number.isFinite(value)), `${station.station_id} ${metric} contains a non-number`);
  }
});

assert.equal(climateInput.typhoon_korea_impact_monthly.source_id, "kma_typhoon_statistics");
exactKeys(climateInput.typhoon_korea_impact_monthly.values, MONTH_KEYS, "typhoon month keys differ");
assert(Object.values(climateInput.typhoon_korea_impact_monthly.values).every((value) => Number.isFinite(value) && value >= 0), "typhoon monthly value is invalid");
assert.equal(climateInput.rainy_season_jeju_1991_2020.source_id, "kma_rainy_season");

const climateInputSha256 = sha256File(climateInputPath);
const expectedFixtureProvenance = {
  path: path.relative(workspaceRoot, climateInputPath).replaceAll("\\", "/"),
  sha256: climateInputSha256,
  canonical_sha256: climateInput.canonical_sha256,
};
assert.equal(climate.baseline_period, climateInput.baseline_period);
assert.equal(climate.checked_at, climateInput.checked_at);
assert.deepEqual(climate.input_fixture, expectedFixtureProvenance, "climate output fixture provenance differs");
assert(climate.station_scope_note.includes("공식 제주권 평균이 아닌"), "derived four-station mean must be disclosed");
assert.deepEqual(climate.sources, climateInput.sources, "climate output sources differ from fixture");
assert.deepEqual(
  climate.station_tables,
  climateInput.stations.map((station) => ({
    station_id: station.station_id,
    station_name: station.station_name,
    source_id: station.source_id,
    printed_pages: station.printed_pages,
    pdf_pages_1_based: station.pdf_pages_1_based,
  })),
  "climate station table provenance differs",
);
assert.deepEqual(climate.rainy_season_jeju_1991_2020, climateInput.rainy_season_jeju_1991_2020, "rainy-season output differs from fixture");

exactKeys(
  Object.fromEntries(Object.entries(climate.monthly_normals_four_station_mean).filter(([key]) => /^\d+$/.test(key))),
  MONTH_KEYS,
  "climate monthly-normal keys differ",
);
for (const [monthIndex, month] of MONTH_KEYS.entries()) {
  const expectedMonthlyNormal = {
    mean_temperature_c: oneDecimalMean(climateInput.stations.map((station) => station.monthly.mean_temperature_c[monthIndex])),
    precipitation_mm: oneDecimalMean(climateInput.stations.map((station) => station.monthly.precipitation_mm[monthIndex])),
    mean_wind_ms: oneDecimalMean(climateInput.stations.map((station) => station.monthly.mean_wind_ms[monthIndex])),
    typhoon_korea_impact: climateInput.typhoon_korea_impact_monthly.values[month],
  };
  exactKeys(climate.monthly_normals_four_station_mean[month], Object.keys(expectedMonthlyNormal), `climate normal metric keys differ: month ${month}`);
  assert.deepEqual(climate.monthly_normals_four_station_mean[month], expectedMonthlyNormal, `climate normal differs from fixture: month ${month}`);
}

assert.deepEqual(
  Object.keys(climate.summer_heat_humidity_four_station_mean).filter((key) => /^\d+$/.test(key)),
  SUMMER_MONTH_KEYS,
  "summer heat/humidity month keys differ",
);
for (const month of SUMMER_MONTH_KEYS) {
  const monthIndex = Number(month) - 1;
  const expectedSummerNormal = {
    mean_daily_max_c: oneDecimalMean(climateInput.stations.map((station) => station.monthly.mean_daily_max_c[monthIndex])),
    mean_relative_humidity_pct: oneDecimalMean(climateInput.stations.map((station) => station.monthly.mean_relative_humidity_pct[monthIndex])),
  };
  exactKeys(climate.summer_heat_humidity_four_station_mean[month], Object.keys(expectedSummerNormal), `summer metric keys differ: month ${month}`);
  assert.deepEqual(climate.summer_heat_humidity_four_station_mean[month], expectedSummerNormal, `summer heat/humidity differs from fixture: month ${month}`);
}

exactKeys(climateInput.product_policy.outdoor_comfort, MONTH_KEYS, "fixture outdoor-comfort keys differ");
assert(Object.values(climateInput.product_policy.outdoor_comfort).every((value) => LABEL_VALUES.has(value)), "fixture outdoor-comfort value is invalid");
assert.deepEqual(climate.outdoor_comfort, climateInput.product_policy.outdoor_comfort, "outdoor-comfort output differs from fixture");
assert.deepEqual(climate.policy_thresholds, climateInput.product_policy.policy_thresholds, "climate policy thresholds differ from fixture");
assert.equal(climate.interpretation, climateInput.product_policy.interpretation, "climate interpretation differs from fixture");

assert.equal(monthProfiles.schema_version, "month-archetype-profiles-v1");
assert.equal(monthProfiles.baseline_ref, "climate_baseline.json");
assert.deepEqual(monthProfiles.input_fixture, expectedFixtureProvenance, "month profiles fixture provenance differs");
exactKeys(climateInput.product_policy.month_profiles, MONTH_ARCHETYPE_KEYS, "fixture month archetypes differ");
exactKeys(monthProfiles.profiles, MONTH_ARCHETYPE_KEYS, "generated month archetypes differ");
for (const archetype of MONTH_ARCHETYPE_KEYS) {
  const fixtureVector = climateInput.product_policy.month_profiles[archetype];
  assert.equal(fixtureVector.length, 12, `fixture month vector length differs: ${archetype}`);
  if (archetype === "festival_na") assert(fixtureVector.every((value) => value === null), "fixture festival vector must be N/A");
  else assert(fixtureVector.every((value) => LABEL_VALUES.has(value)), `fixture month vector value is invalid: ${archetype}`);
  exactKeys(monthProfiles.profiles[archetype], MONTH_KEYS, `generated month keys differ: ${archetype}`);
  assert.deepEqual(monthProfiles.profiles[archetype], monthMap(fixtureVector), `generated month vector differs from fixture: ${archetype}`);
}
assert.deepEqual(monthProfiles.profiles.outdoor_neutral, climate.outdoor_comfort, "outdoor-neutral and outdoor-comfort vectors differ");

assert.deepEqual(manifest.source, v2Manifest.source, "v3 TourAPI source provenance differs from v2");
const tourApiSourcePath = path.resolve(workspaceRoot, manifest.source.path);
const tourApiSourceRelative = path.relative(workspaceRoot, tourApiSourcePath);
assert(!tourApiSourceRelative.startsWith("..") && !path.isAbsolute(tourApiSourceRelative), "TourAPI source path escapes the workspace");
assert(fs.existsSync(tourApiSourcePath), "TourAPI source file is missing");
const tourApiSourceSha256 = sha256File(tourApiSourcePath);
assert.equal(tourApiSourceSha256, manifest.source.sha256, "TourAPI source hash differs from v3 manifest");
assert.equal(tourApiSourceSha256, v2Manifest.source.sha256, "TourAPI source hash differs from v2 manifest");

assert.equal(sha256File(v2ProfilesPath), v2Manifest.files["place_profiles.json"].sha256, "protected v2 profile hash differs");
assert.equal(sha256File(researchPath), v2Manifest.files["place_web_research.json"].sha256, "protected v2 research hash differs");
assert.equal(manifest.base_v2.profile_sha256, sha256File(v2ProfilesPath));
assert.equal(manifest.base_v2.research_sha256, sha256File(researchPath));
assert.equal(manifest.climate_baseline.period, climateInput.baseline_period);
assert.equal(manifest.climate_baseline.path, path.relative(workspaceRoot, climatePath).replaceAll("\\", "/"));
assert.equal(manifest.climate_baseline.sha256, sha256File(climatePath));
assert.deepEqual(manifest.climate_baseline.input_fixture, expectedFixtureProvenance);
assert.deepEqual(manifest.climate_baseline.source_urls, climateInput.sources.map((source) => source.url));
assert.equal(manifest.month_profiles.path, path.relative(workspaceRoot, monthProfilesPath).replaceAll("\\", "/"));
assert.equal(manifest.month_profiles.sha256, sha256File(monthProfilesPath));
assert.equal(manifest.month_profiles.input_fixture_canonical_sha256, climateInput.canonical_sha256);
assert.equal(manifest.stats.companion_numeric, companionNumeric);
assert.equal(manifest.stats.companion_direct, companionDirect);
assert.equal(manifest.stats.companion_inferred, companionInferred);
assert.equal(manifest.stats.nonfestival_month_numeric, nonfestivalMonthNumeric);
assert.equal(manifest.stats.nonfestival_month_direct, nonfestivalMonthDirect);
assert.equal(manifest.stats.festival_month_na, festivalMonthNa);
assert.deepEqual(manifest.stats.review_priority, Object.fromEntries(Object.entries(priorityCounts).filter(([, value]) => value > 0)));

for (const file of Object.values(manifest.files)) {
  const filePath = path.join(workspaceRoot, file.path);
  assert(fs.existsSync(filePath), `manifest file is missing: ${file.path}`);
  assert.equal(sha256File(filePath), file.sha256, `manifest hash differs: ${file.path}`);
}

console.log(JSON.stringify({
  valid: true,
  places: profiles.length,
  companion: {
    numeric: companionNumeric,
    direct: companionDirect,
    inferred: companionInferred,
  },
  month: {
    nonfestival_numeric: nonfestivalMonthNumeric,
    nonfestival_direct: nonfestivalMonthDirect,
    festival_na: festivalMonthNa,
  },
  inferred_extremes: inferredExtremes,
  review_priority: priorityCounts,
  official_climate_sources: climate.sources.length,
  climate_fixture: {
    canonical_sha256: climateInput.canonical_sha256,
    stations: climateInput.stations.length,
    monthly_normal_vectors_checked: 4,
    summer_vectors_checked: 2,
    outdoor_comfort_months_checked: 12,
    month_profile_vectors_checked: MONTH_ARCHETYPE_KEYS.length,
  },
  tourapi_source_sha256: tourApiSourceSha256,
}, null, 2));
