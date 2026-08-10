import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const pilotsRoot = path.join(workspaceRoot, "data", "labeling", "jeju", "2026-08-09", "pilots");
const v1Directory = path.join(pilotsRoot, "place-profile-v1-100");
const v2Directory = path.join(pilotsRoot, "place-profile-v2-100");
const researchDirectory = path.join(v2Directory, "research");
const sourcePath = path.join(workspaceRoot, "data", "tourapi", "jeju", "2026-08-09", "jeju_places.json");
const v1ProfilesPath = path.join(v1Directory, "place_profiles.json");
const selectionPath = path.join(v1Directory, "selection_ids.json");
const partPaths = [1, 2, 3].map((part) => path.join(researchDirectory, `part_${part}.json`));
const webPagesPath = path.join(researchDirectory, "web_pages.json");
const researchPath = path.join(v2Directory, "place_web_research.json");
const profilesPath = path.join(v2Directory, "place_profiles.json");
const manifestPath = path.join(v2Directory, "manifest.json");
const reportPath = path.join(v2Directory, "review_report.md");

const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const FACT_KEYS = ["environment", "typical_visit", "walking", "stairs_slopes", "stroller_wheelchair", "seating_restroom", "kids", "seniors", "rain", "wind", "heat", "cold", "seasonality", "availability"];
const EVIDENCE_SCORE_KEYS = ["physical_effort", "indoor_ratio", "rain_sensitivity", "wind_sensitivity", "heat_sensitivity", "cold_sensitivity", "seasonal_peak_months", "availability_separate"];
const RESEARCH_KEYS = ["contentid", "title", "research_status", "identity_notes", "checked_at", "summary", "experience_tags", "facts", "evidence_scores", "sources", "search_attempts", "unknowns", "proposed_companion_fit", "proposed_month_fit", "companion_rationale", "month_rationale", "confidence"];
const SOURCE_KEYS = ["url", "title", "publisher", "source_type", "checked_at", "claims"];
const LABEL_VALUES = new Set([null, 0, 0.25, 0.5, 0.75, 1]);
const SOURCE_TYPES = new Set(["official_tourism", "public_agency", "official_operator", "heritage", "reputable_secondary"]);
const STATUSES = new Set(["matched", "uncertain", "not_found"]);
const SEARCH_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?google\.[^/]+\/search/i,
  /^https?:\/\/search\.naver\.com\//i,
  /^https?:\/\/(?:www\.)?bing\.com\/search/i,
  /^https?:\/\/search\.daum\.net\//i,
];
const BANNED_GENERIC_PHRASES = [
  "공개 상세 페이지에서 확인한 장소·방문 특성 요약",
  "은(는) 제주 지역의",
  "장소 유형과 공개된 경관·관광 성격만 근거",
  "기존 분류의 계절 예비값",
  "페이지를 직접 확인",
  "제목·주소·유형이 입력 장소와 일치함",
  "확인된 경험을 근거로 예비값",
];
const WEATHER_FACT_BY_SCORE = {
  rain_sensitivity: "rain",
  wind_sensitivity: "wind",
  heat_sensitivity: "heat",
  cold_sensitivity: "cold",
};
const DEFAULT_WEATHER_SENSITIVITY = { indoor: 0.25, mixed: 0.5, outdoor: 0.75, unknown: null };

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  assert(!raw.includes("\uFFFD") && !/\?{3,}/.test(raw), `text encoding appears damaged: ${relativePath(filePath)}`);
  return JSON.parse(raw);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function exactKeys(value, keys, fieldPath) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${fieldPath} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${fieldPath} keys differ`);
}

function nonEmptyString(value, fieldPath) {
  assert.equal(typeof value, "string", `${fieldPath} must be a string`);
  assert(clean(value), `${fieldPath} must not be empty`);
  assert(value.length <= 2000, `${fieldPath} is too long`);
}

function nonEmptyKoreanString(value, fieldPath) {
  nonEmptyString(value, fieldPath);
  assert(/[가-힣]/.test(value), `${fieldPath} must contain a Korean explanation`);
}

function stringArray(value, fieldPath, { allowEmpty = true } = {}) {
  assert(Array.isArray(value), `${fieldPath} must be an array`);
  if (!allowEmpty) assert(value.length > 0, `${fieldPath} must not be empty`);
  value.forEach((entry, index) => nonEmptyString(entry, `${fieldPath}[${index}]`));
}

function labelMap(value, keys, fieldPath) {
  exactKeys(value, keys, fieldPath);
  for (const key of keys) assert(LABEL_VALUES.has(value[key]), `${fieldPath}.${key} has an invalid label`);
}

const v1Profiles = readJson(v1ProfilesPath);
const selection = readJson(selectionPath);
const parts = partPaths.map(readJson);
const webPages = readJson(webPagesPath);
const research = readJson(researchPath);
const profiles = readJson(profilesPath);
const manifest = readJson(manifestPath);
const report = fs.readFileSync(reportPath, "utf8");

assert.equal(v1Profiles.length, 100);
assert.equal(selection.contentids.length, 100);
assert.deepEqual(v1Profiles.map((profile) => profile.contentid), selection.contentids);
assert.deepEqual(parts.map((part) => part.items.length), [34, 33, 33]);
assert.equal(webPages.schema_version, "place-web-page-extract-v1");
assert.equal(webPages.items.length, 100);
assert.deepEqual(webPages.items.map((item) => item.contentid), selection.contentids);
assert(webPages.items.every((item) => item.http_status === 200 && item.overview), "every place must have an opened detail page with an overview");
parts.forEach((part, index) => {
  exactKeys(part, ["schema_version", "batch_id", "checked_at", "items"], `part_${index + 1}`);
  assert.equal(part.schema_version, "place-web-research-v1");
  assert.equal(part.batch_id, `part_${index + 1}`);
  assert.equal(part.checked_at, "2026-08-10");
});

const rawItems = parts.flatMap((part) => part.items);
assert.equal(rawItems.length, 100);
assert.deepEqual(rawItems, research, "merged research differs from the ordered part files");
assert.deepEqual(research.map((item) => clean(item.contentid)), selection.contentids);
assert.equal(new Set(research.map((item) => item.contentid)).size, 100);
assert.equal(profiles.length, 100);

const statusCounts = {};
const sourceTypeCounts = {};
let totalSources = 0;
let totalUnknowns = 0;

research.forEach((item, index) => {
  const fieldPath = `research[${index}]`;
  const v1 = v1Profiles[index];
  const webPage = webPages.items[index];
  exactKeys(item, RESEARCH_KEYS, fieldPath);
  assert.equal(clean(item.contentid), v1.contentid, `${fieldPath}.contentid differs`);
  assert.equal(clean(item.title), v1.title, `${fieldPath}.title differs`);
  assert(STATUSES.has(item.research_status), `${fieldPath}.research_status is invalid`);
  assert.equal(item.checked_at, "2026-08-10", `${fieldPath}.checked_at differs`);
  nonEmptyKoreanString(item.identity_notes, `${fieldPath}.identity_notes`);
  if (!webPage.title_matches) {
    assert(item.identity_notes.includes(webPage.page_title), `${fieldPath}.identity_notes must explain the opened page title alias`);
  }
  nonEmptyKoreanString(item.summary, `${fieldPath}.summary`);
  assert(item.summary.length >= 35, `${fieldPath}.summary is too generic or short`);
  assert(!BANNED_GENERIC_PHRASES.some((phrase) => item.summary.includes(phrase)), `${fieldPath}.summary contains a banned generic phrase`);
  stringArray(item.experience_tags, `${fieldPath}.experience_tags`);
  stringArray(item.search_attempts, `${fieldPath}.search_attempts`, { allowEmpty: false });
  stringArray(item.unknowns, `${fieldPath}.unknowns`);

  exactKeys(item.facts, FACT_KEYS, `${fieldPath}.facts`);
  assert(["indoor", "outdoor", "mixed", "unknown"].includes(item.facts.environment), `${fieldPath}.facts.environment is invalid`);
  for (const key of FACT_KEYS.slice(1)) {
    assert(item.facts[key] === null || typeof item.facts[key] === "string", `${fieldPath}.facts.${key} must be string or null`);
    if (typeof item.facts[key] === "string") nonEmptyString(item.facts[key], `${fieldPath}.facts.${key}`);
  }
  assert(FACT_KEYS.slice(1).filter((key) => item.facts[key] !== null).length >= 2, `${fieldPath} has too few researched facts`);
  if (item.research_status === "matched") {
    assert(item.facts.typical_visit !== null, `${fieldPath} matched place needs a researched typical_visit`);
    nonEmptyKoreanString(item.facts.typical_visit, `${fieldPath}.facts.typical_visit`);
  }

  exactKeys(item.evidence_scores, EVIDENCE_SCORE_KEYS, `${fieldPath}.evidence_scores`);
  for (const key of EVIDENCE_SCORE_KEYS.slice(0, 6)) assert(LABEL_VALUES.has(item.evidence_scores[key]), `${fieldPath}.evidence_scores.${key} is invalid`);
  if (item.evidence_scores.physical_effort !== null) {
    assert(item.facts.walking !== null || item.facts.stairs_slopes !== null, `${fieldPath}.physical_effort needs walking or stairs/slopes evidence`);
  }
  for (const [scoreKey, factKey] of Object.entries(WEATHER_FACT_BY_SCORE)) {
    if (item.facts[factKey] === null) {
      assert.equal(
        item.evidence_scores[scoreKey],
        DEFAULT_WEATHER_SENSITIVITY[item.facts.environment],
        `${fieldPath}.${scoreKey} without a direct weather fact must use the documented environment heuristic`,
      );
    }
  }
  assert(Array.isArray(item.evidence_scores.seasonal_peak_months), `${fieldPath}.seasonal_peak_months must be an array`);
  assert(item.evidence_scores.seasonal_peak_months.every((month) => Number.isInteger(month) && month >= 1 && month <= 12), `${fieldPath}.seasonal_peak_months is invalid`);
  assert.equal(typeof item.evidence_scores.availability_separate, "boolean", `${fieldPath}.availability_separate must be boolean`);

  assert(Array.isArray(item.sources), `${fieldPath}.sources must be an array`);
  if (item.research_status === "matched") assert(item.sources.length > 0, `${fieldPath} matched place has no source`);
  item.sources.forEach((source, sourceIndex) => {
    const sourcePath = `${fieldPath}.sources[${sourceIndex}]`;
    exactKeys(source, SOURCE_KEYS, sourcePath);
    nonEmptyString(source.url, `${sourcePath}.url`);
    const parsed = new URL(source.url);
    assert(["http:", "https:"].includes(parsed.protocol), `${sourcePath}.url must be HTTP(S)`);
    assert(!SEARCH_URL_PATTERNS.some((pattern) => pattern.test(source.url)), `${sourcePath}.url is a search result page`);
    nonEmptyString(source.title, `${sourcePath}.title`);
    nonEmptyString(source.publisher, `${sourcePath}.publisher`);
    assert(SOURCE_TYPES.has(source.source_type), `${sourcePath}.source_type is invalid`);
    assert.equal(source.checked_at, "2026-08-10", `${sourcePath}.checked_at differs`);
    stringArray(source.claims, `${sourcePath}.claims`, { allowEmpty: false });
    assert(source.claims.length >= 2, `${sourcePath}.claims must contain at least two concrete facts`);
    source.claims.forEach((claim, claimIndex) => nonEmptyKoreanString(claim, `${sourcePath}.claims[${claimIndex}]`));
    assert(!source.claims.some((claim) => BANNED_GENERIC_PHRASES.some((phrase) => claim.includes(phrase))), `${sourcePath}.claims contains a banned generic phrase`);
    sourceTypeCounts[source.source_type] = (sourceTypeCounts[source.source_type] ?? 0) + 1;
  });
  assert(item.sources.some((source) => source.url === webPage.source_url), `${fieldPath} does not cite its opened detail page`);

  labelMap(item.proposed_companion_fit, COMPANION_KEYS, `${fieldPath}.proposed_companion_fit`);
  labelMap(item.proposed_month_fit, MONTH_KEYS, `${fieldPath}.proposed_month_fit`);
  exactKeys(item.companion_rationale, COMPANION_KEYS, `${fieldPath}.companion_rationale`);
  COMPANION_KEYS.forEach((key) => nonEmptyKoreanString(item.companion_rationale[key], `${fieldPath}.companion_rationale.${key}`));
  nonEmptyKoreanString(item.month_rationale, `${fieldPath}.month_rationale`);
  labelMap(item.confidence, ["identity", "companion_fit", "month_fit"], `${fieldPath}.confidence`);

  const nonNullCompanion = Object.values(item.proposed_companion_fit).filter((value) => value !== null);
  const nonNullMonths = Object.values(item.proposed_month_fit).filter((value) => value !== null);
  if (nonNullCompanion.length) assert(item.confidence.companion_fit !== null && item.confidence.companion_fit >= 0.5, `${fieldPath} non-null companion labels need confidence >= 0.5`);
  else assert.equal(item.confidence.companion_fit, null, `${fieldPath} all-null companion labels need null confidence`);
  if (nonNullMonths.length) assert(item.confidence.month_fit !== null && item.confidence.month_fit >= 0.5, `${fieldPath} non-null month labels need confidence >= 0.5`);
  else {
    assert.equal(item.confidence.month_fit, null, `${fieldPath} all-null month labels need null confidence`);
    assert(item.month_rationale.includes("null"), `${fieldPath} all-null month rationale must say that values remain null`);
  }
  if (nonNullCompanion.some((value) => value === 0 || value === 1)) assert(item.confidence.companion_fit >= 0.75, `${fieldPath} extreme companion labels need confidence >= 0.75`);
  if (item.proposed_companion_fit.kids !== null) assert(item.facts.kids !== null, `${fieldPath} kids label needs a researched kids fact`);
  if (item.proposed_companion_fit.parents !== null) assert(item.facts.seniors !== null, `${fieldPath} parents label needs a researched seniors fact`);
  const nonNeutralMonths = nonNullMonths.filter((value) => value !== 0.5);
  if (nonNeutralMonths.length) assert(item.facts.seasonality !== null, `${fieldPath} non-neutral month labels need a researched seasonality fact`);
  if (item.facts.environment === "outdoor" && item.facts.seasonality === null) {
    assert(nonNullMonths.length === 0, `${fieldPath} outdoor month labels need explicit seasonality evidence; availability alone is not neutral fit`);
  }
  if (nonNullMonths.length === 12 && nonNullMonths.every((value) => value === 0.5) && item.facts.environment !== "indoor") {
    assert(item.facts.seasonality !== null && /(사계절|연중)/.test(item.facts.seasonality), `${fieldPath} non-indoor year-round neutral labels need explicit year-round experience evidence`);
  }
  if (v1.source_place.contenttypeid === "15") assert(Object.values(item.proposed_month_fit).every((value) => value === null), `${fieldPath} festival month labels must remain null`);

  const peakMonths = MONTH_KEYS.filter((month) => item.proposed_month_fit[month] === 1).map(Number);
  assert.deepEqual(item.evidence_scores.seasonal_peak_months, peakMonths, `${fieldPath} peak months differ from month_fit=1`);
  if (item.research_status === "not_found") {
    assert(Object.values(item.proposed_companion_fit).every((value) => value === null), `${fieldPath} not_found companion labels must be null`);
    assert(Object.values(item.proposed_month_fit).every((value) => value === null), `${fieldPath} not_found month labels must be null`);
  }

  const profile = profiles[index];
  assert.equal(profile.contentid, item.contentid);
  assert.equal(profile.title, item.title);
  assert.deepEqual(profile.source_place, v1.source_place);
  assert.deepEqual(profile.companion_fit, item.proposed_companion_fit);
  assert.deepEqual(profile.month_fit, item.proposed_month_fit);
  assert.equal(profile.label_meta.version, "place-profile-pilot-v2-web");
  assert.equal(profile.label_meta.method, "place_web_research_v1");
  assert.equal(profile.label_meta.research_record_sha256, sha256Json(item));
  assert.equal(profile.label_meta.review_status, "needs_human_review");
  assert.equal(profile.label_evidence.source_refs.length, item.sources.length);

  statusCounts[item.research_status] = (statusCounts[item.research_status] ?? 0) + 1;
  totalSources += item.sources.length;
  totalUnknowns += item.unknowns.length;
});

assert.equal(manifest.schema_version, "place-profile-web-research-manifest-v2");
assert.equal(manifest.label_version, "place-profile-pilot-v2-web");
assert.equal(manifest.source.path, relativePath(sourcePath));
assert.equal(manifest.source.snapshot_date, "2026-08-09");
assert.equal(manifest.source.sha256, sha256File(sourcePath));
assert.equal(manifest.base_profile.path, relativePath(v1ProfilesPath));
assert.equal(manifest.base_profile.sha256, sha256File(v1ProfilesPath));
assert.equal(manifest.selection.sha256, sha256File(selectionPath));
assert.equal(manifest.web_pages.path, relativePath(webPagesPath));
assert.equal(manifest.web_pages.source, webPages.source);
assert.equal(manifest.web_pages.count, webPages.items.length);
assert.equal(manifest.web_pages.http_ok, 100);
assert.equal(manifest.web_pages.exact_title_matches, webPages.items.filter((item) => item.title_matches).length);
assert.equal(manifest.web_pages.title_aliases, webPages.items.filter((item) => !item.title_matches).length);
assert.equal(manifest.web_pages.sha256, sha256File(webPagesPath));
manifest.research_parts.forEach((part, index) => {
  assert.equal(part.path, relativePath(partPaths[index]));
  assert.equal(part.count, parts[index].items.length);
  assert.equal(part.sha256, sha256File(partPaths[index]));
});
assert.deepEqual(manifest.stats.by_research_status, statusCounts);
assert.equal(manifest.stats.total_sources, totalSources);
assert.deepEqual(manifest.stats.by_source_type, sourceTypeCounts);
assert.equal(manifest.stats.total_unknowns, totalUnknowns);
for (const [name, filePath] of [["place_web_research.json", researchPath], ["place_profiles.json", profilesPath], ["review_report.md", reportPath]]) {
  assert.equal(manifest.files[name].path, relativePath(filePath));
  assert.equal(manifest.files[name].sha256, sha256File(filePath));
}
assert.equal((report.match(/^\| \d+ \|/gm) ?? []).length, 100, "review report must contain 100 place rows");

console.log(JSON.stringify({
  ok: true,
  places: research.length,
  research_status: statusCounts,
  sources: totalSources,
  source_types: sourceTypeCounts,
  unknowns: totalUnknowns,
  profile_sha256: sha256File(profilesPath),
}, null, 2));
