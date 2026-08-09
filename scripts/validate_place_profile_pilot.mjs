import crypto from "node:crypto";
import fs from "node:fs";
import nodeAssert from "node:assert/strict";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const pilotDirectory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v1-100",
);
const selectionPath = path.join(pilotDirectory, "selection_ids.json");
const researchDirectory = path.join(pilotDirectory, "research");
const targetedSourcesPath = path.join(researchDirectory, "targeted_sources.json");
const profilesPath = path.join(pilotDirectory, "place_profiles.json");
const manifestPath = path.join(pilotDirectory, "manifest.json");
const reportPath = path.join(pilotDirectory, "review_report.md");
const sourcePath = path.join(
  workspaceRoot,
  "data",
  "tourapi",
  "jeju",
  "2026-08-09",
  "jeju_places.json",
);
const sourceManifestPath = path.join(path.dirname(sourcePath), "manifest.json");

const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const LABEL_VALUES = new Set([0, 0.25, 0.5, 0.75, 1, null]);
const EVIDENCE_VALUE_KEYS = [
  "physical_effort",
  "indoor_ratio",
  "rain_sensitivity",
  "wind_sensitivity",
  "heat_sensitivity",
  "cold_sensitivity",
];
const ALLOWED_TYPES = new Set(["12", "14", "15", "28"]);
const EXPECTED_TYPE_COUNTS = { "12": 68, "14": 12, "15": 4, "28": 16 };
const DISALLOWED_SOURCE_URLS_BY_CONTENTID = {
  "1839451": new Set([
    "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_000000000021303",
  ]),
  "2414827": new Set([
    "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_000002000000000000",
  ]),
  "3030351": new Set([
    "https://www.visitjeju.net/en/themtour/view?contentsid=CNTS_300000000014401&menuId=DOM_700000000010790",
  ]),
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(object, expectedKeys, fieldPath) {
  assert(object && typeof object === "object" && !Array.isArray(object), `${fieldPath} must be an object`);
  const actualKeys = Object.keys(object).sort();
  const sortedExpected = [...expectedKeys].sort();
  assert(
    JSON.stringify(actualKeys) === JSON.stringify(sortedExpected),
    `${fieldPath} keys differ: expected ${sortedExpected.join(",")}, received ${actualKeys.join(",")}`,
  );
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function labelValueKey(value) {
  return value === null ? "null" : String(value);
}

function emptyDistribution() {
  return { "0": 0, "0.25": 0, "0.5": 0, "0.75": 0, "1": 0, null: 0 };
}

function incrementDistribution(distribution, value) {
  distribution[labelValueKey(value)] += 1;
}

function createStats(profileList) {
  const byContentType = {};
  const byRegion = {};
  const byReviewStatus = {};
  const companionDistribution = Object.fromEntries(
    COMPANION_KEYS.map((key) => [key, emptyDistribution()]),
  );
  const monthDistribution = Object.fromEntries(MONTH_KEYS.map((key) => [key, emptyDistribution()]));
  let profilesWithWebSources = 0;
  let totalSourceRefs = 0;
  let companionConfidenceSum = 0;
  let monthConfidenceSum = 0;

  for (const profile of profileList) {
    const type = profile.source_place.contenttypeid;
    const region = profile.source_place.region_code;
    const status = profile.label_meta.review_status;
    byContentType[type] = (byContentType[type] ?? 0) + 1;
    byRegion[region] = (byRegion[region] ?? 0) + 1;
    byReviewStatus[status] = (byReviewStatus[status] ?? 0) + 1;
    if (profile.label_evidence.source_refs.length) profilesWithWebSources += 1;
    totalSourceRefs += profile.label_evidence.source_refs.length;
    companionConfidenceSum += profile.label_meta.confidence.companion_fit;
    monthConfidenceSum += profile.label_meta.confidence.month_fit;
    for (const key of COMPANION_KEYS) incrementDistribution(companionDistribution[key], profile.companion_fit[key]);
    for (const key of MONTH_KEYS) incrementDistribution(monthDistribution[key], profile.month_fit[key]);
  }

  return {
    total: profileList.length,
    by_content_type: byContentType,
    by_region: byRegion,
    by_review_status: byReviewStatus,
    profiles_with_web_sources: profilesWithWebSources,
    total_source_refs: totalSourceRefs,
    average_confidence: {
      companion_fit: Math.round((companionConfidenceSum / profileList.length) * 1000) / 1000,
      month_fit: Math.round((monthConfidenceSum / profileList.length) * 1000) / 1000,
    },
    companion_distribution: companionDistribution,
    month_distribution: monthDistribution,
  };
}

function rawSourceRefs(item) {
  const evidence = item.label_evidence ?? item.evidence ?? {};
  const refs = evidence.source_refs ?? item.source_refs ?? item.web_evidence?.source_refs ?? [];
  return Array.isArray(refs) ? refs : [];
}

function formatRatio(count, total) {
  return `${count}/${total} (${((count / total) * 100).toFixed(1)}%)`;
}

function distributionReportRow(axis, distribution) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  return `| ${axis} | ${distribution["0"]} | ${distribution["0.25"]} | ${distribution["0.5"]} | ${distribution["0.75"]} | ${distribution["1"]} | ${distribution.null} | ${formatRatio(distribution.null, total)} |`;
}

const selection = readJson(selectionPath);
const profiles = readJson(profilesPath);
const manifest = readJson(manifestPath);
const targetedSources = readJson(targetedSourcesPath);
const sourcePlaces = readJson(sourcePath);
const sourceManifest = readJson(sourceManifestPath);
const sourceById = new Map(sourcePlaces.map((place) => [String(place.contentid).trim(), place]));
const evidenceUrlsById = new Map();

for (const researchPart of manifest.research_parts ?? []) {
  const partPath = path.resolve(workspaceRoot, researchPart.path);
  assert(partPath.startsWith(`${workspaceRoot}${path.sep}`), `research path escapes workspace: ${researchPart.path}`);
  assert(fs.existsSync(partPath), `research part is missing: ${researchPart.path}`);
  assert(sha256File(partPath) === researchPart.sha256, `research part hash differs: ${researchPart.path}`);
  const items = readJson(partPath);
  assert(Array.isArray(items), `research part must be an array: ${researchPart.path}`);
  for (const item of items) {
    const contentid = clean(item.contentid ?? item.id);
    const urls = evidenceUrlsById.get(contentid) ?? new Set();
    for (const ref of rawSourceRefs(item)) {
      const url = clean(typeof ref === "string" ? ref : ref?.url ?? ref?.href);
      if (url) urls.add(url);
    }
    evidenceUrlsById.set(contentid, urls);
  }
}

assert(Array.isArray(targetedSources), "targeted_sources.json must contain an array");
assert(manifest.targeted_sources.path === path.relative(workspaceRoot, targetedSourcesPath).replaceAll("\\", "/"), "targeted source path differs");
assert(manifest.targeted_sources.count === targetedSources.length, "targeted source count differs");
assert(manifest.targeted_sources.sha256 === sha256File(targetedSourcesPath), "targeted source hash differs");
for (const item of targetedSources) {
  const contentid = clean(item.contentid);
  assert(selection.contentids.includes(contentid), `targeted source is not selected: ${contentid}`);
  const urls = evidenceUrlsById.get(contentid) ?? new Set();
  for (const ref of rawSourceRefs(item)) {
    const url = clean(typeof ref === "string" ? ref : ref?.url ?? ref?.href);
    if (url) urls.add(url);
  }
  evidenceUrlsById.set(contentid, urls);
}

assert(Array.isArray(selection.contentids), "selection contentids must be an array");
assert(selection.contentids.length === 100, "selection must contain 100 IDs");
assert(new Set(selection.contentids).size === 100, "selection IDs must be unique");
assert(Array.isArray(profiles), "place_profiles.json must contain an array");
assert(profiles.length === 100, "profile output must contain 100 records");

const profileIds = profiles.map((profile) => String(profile.contentid));
assert(new Set(profileIds).size === 100, "profile IDs must be unique");
assert(
  JSON.stringify(profileIds) === JSON.stringify(selection.contentids),
  "profile IDs or order differ from selection_ids.json",
);

const typeCounts = {};
let nullCompanionValues = 0;
let nullMonthValues = 0;
let directSourceProfiles = 0;
let totalSourceRefs = 0;

profiles.forEach((profile, index) => {
  const fieldPath = `profiles[${index}]`;
  const source = sourceById.get(profile.contentid);
  assert(source, `${fieldPath} is missing from source snapshot`);
  assert(profile.title === String(source.title ?? "").replace(/\s+/g, " ").trim(), `${fieldPath}.title differs from source`);

  const contentType = String(source.contenttypeid).trim();
  assert(ALLOWED_TYPES.has(contentType), `${fieldPath} has excluded content type ${contentType}`);
  assert(profile.source_place.contenttypeid === contentType, `${fieldPath} content type differs from source`);
  assert(profile.source_place.lclsSystm1 === String(source.lclsSystm1 ?? "").trim(), `${fieldPath} lclsSystm1 differs`);
  assert(profile.source_place.lclsSystm2 === String(source.lclsSystm2 ?? "").trim(), `${fieldPath} lclsSystm2 differs`);
  assert(profile.source_place.lclsSystm3 === String(source.lclsSystm3 ?? "").trim(), `${fieldPath} lclsSystm3 differs`);
  assert(profile.source_place.region_code === String(source.lDongSignguCd ?? "").trim(), `${fieldPath} region differs`);
  typeCounts[contentType] = (typeCounts[contentType] ?? 0) + 1;

  assertExactKeys(profile.companion_fit, COMPANION_KEYS, `${fieldPath}.companion_fit`);
  assertExactKeys(profile.month_fit, MONTH_KEYS, `${fieldPath}.month_fit`);
  for (const key of COMPANION_KEYS) {
    const value = profile.companion_fit[key];
    assert(LABEL_VALUES.has(value), `${fieldPath}.companion_fit.${key} has invalid value`);
    if (value === null) nullCompanionValues += 1;
  }
  for (const key of MONTH_KEYS) {
    const value = profile.month_fit[key];
    assert(LABEL_VALUES.has(value), `${fieldPath}.month_fit.${key} has invalid value`);
    if (value === null) nullMonthValues += 1;
  }

  const evidence = profile.label_evidence;
  assert(["indoor", "outdoor", "mixed", "unknown"].includes(evidence.environment), `${fieldPath} has invalid environment`);
  for (const key of EVIDENCE_VALUE_KEYS) {
    assert(LABEL_VALUES.has(evidence[key]), `${fieldPath}.label_evidence.${key} has invalid value`);
  }
  assert(Array.isArray(evidence.seasonal_peak_months), `${fieldPath} peak months must be an array`);
  assert(
    evidence.seasonal_peak_months.every((month) => Number.isInteger(month) && month >= 1 && month <= 12),
    `${fieldPath} has invalid peak month`,
  );
  const expectedPeakMonths = MONTH_KEYS
    .filter((month) => profile.month_fit[month] === 1)
    .map(Number);
  assert(
    JSON.stringify(evidence.seasonal_peak_months) === JSON.stringify(expectedPeakMonths),
    `${fieldPath} peak months differ from month_fit=1 months`,
  );
  assert(Array.isArray(evidence.companion_basis), `${fieldPath} companion_basis must be an array`);
  assert(Array.isArray(evidence.month_basis), `${fieldPath} month_basis must be an array`);
  assert(Array.isArray(evidence.source_refs), `${fieldPath} source_refs must be an array`);
  assert(Array.isArray(evidence.limitations), `${fieldPath} limitations must be an array`);
  assert(
    evidence.availability_separate === (contentType === "15"),
    `${fieldPath} availability separation differs from content type`,
  );

  if (evidence.source_refs.length) directSourceProfiles += 1;
  totalSourceRefs += evidence.source_refs.length;
  for (const ref of evidence.source_refs) {
    assert(/^https?:\/\//i.test(ref.url), `${fieldPath} has invalid source URL`);
    assert(!/\/search\/|search_list\.do/i.test(ref.url), `${fieldPath} uses a search-results URL as evidence`);
    const parsedUrl = new URL(ref.url);
    const isGenericPortal =
      /(^|\.)visitjeju\.net$/i.test(parsedUrl.hostname) &&
      /^\/(?:en|kr)?\/?$/i.test(parsedUrl.pathname);
    assert(!isGenericPortal, `${fieldPath} uses a generic portal URL as evidence`);
    assert(
      !(DISALLOWED_SOURCE_URLS_BY_CONTENTID[profile.contentid] ?? new Set()).has(ref.url),
      `${fieldPath} uses a known mismatched or insufficient source URL`,
    );
    assert(
      evidenceUrlsById.get(profile.contentid)?.has(ref.url),
      `${fieldPath} source URL is not recorded against the same contentid in research provenance`,
    );
    assert(clean(ref.title), `${fieldPath} source title is empty`);
    assert(clean(ref.source_type), `${fieldPath} source_type is empty`);
    assert(ref.checked_at === "2026-08-09", `${fieldPath} source checked_at differs`);
  }

  const meta = profile.label_meta;
  assert(meta.version === "place-profile-pilot-v1", `${fieldPath} label version differs`);
  assert(
    ["ai_draft", "needs_human_review"].includes(meta.review_status),
    `${fieldPath} has invalid review status`,
  );
  for (const key of ["companion_fit", "month_fit"]) {
    const value = meta.confidence[key];
    assert(Number.isFinite(value) && value >= 0 && value <= 1, `${fieldPath} has invalid ${key} confidence`);
  }
});

assert(JSON.stringify(typeCounts) === JSON.stringify(EXPECTED_TYPE_COUNTS), `type quotas differ: ${JSON.stringify(typeCounts)}`);
assert(selection.contentids.includes("2704351"), "selection must include the known invalid-coordinate record 2704351");
const selectedSourcePlaces = selection.contentids.map((contentid) => sourceById.get(contentid));
assert(selectedSourcePlaces.every(Boolean), "selection contains an ID missing from the source snapshot");
assert(
  selectedSourcePlaces.some((place) => !clean(place.firstimage) && !clean(place.firstimage2)),
  "selection must include an image-incomplete record",
);
for (const contentType of ALLOWED_TYPES) {
  const populationGroups = new Set(
    sourcePlaces
      .filter((place) => clean(place.contenttypeid) === contentType)
      .map((place) => clean(place.lclsSystm2)),
  );
  const selectedGroups = new Set(
    selectedSourcePlaces
      .filter((place) => clean(place.contenttypeid) === contentType)
      .map((place) => clean(place.lclsSystm2)),
  );
  for (const group of populationGroups) {
    assert(selectedGroups.has(group), `selection misses lclsSystm2 ${group} for content type ${contentType}`);
  }
}
const declaredSourceHash = sourceManifest.files?.["jeju_places.json"]?.sha256;
assert(sha256File(sourcePath) === declaredSourceHash, "source snapshot hash differs from source manifest");
assert(manifest.source.sha256 === sha256File(sourcePath), "pilot manifest source hash differs");
assert(manifest.selection.sha256 === sha256File(selectionPath), "pilot manifest selection hash differs");
assert(manifest.files["place_profiles.json"].sha256 === sha256File(profilesPath), "profile hash differs from manifest");
assert(manifest.files["review_report.md"].sha256 === sha256File(reportPath), "report hash differs from manifest");
assert(manifest.files["place_profiles.json"].count === profiles.length, "manifest profile count differs");

const computedStats = createStats(profiles);
nodeAssert.deepStrictEqual(manifest.stats, computedStats, "manifest stats differ from recomputed profile stats");
nodeAssert.deepStrictEqual(computedStats.by_region, { "110": 53, "130": 47 }, "region quotas differ");

const report = fs.readFileSync(reportPath, "utf8");
const placeTableSection = report
  .split("## 장소별 초안")[1]
  ?.split("## 알려진 제한")[0] ?? "";
const reportProfileRows = placeTableSection.match(/^\| \d+ \| \d+ \|/gm) ?? [];
assert(reportProfileRows.length === profiles.length, "report place table does not contain exactly 100 rows");
const companionNulls = COMPANION_KEYS.reduce(
  (sum, key) => sum + computedStats.companion_distribution[key].null,
  0,
);
const monthNulls = MONTH_KEYS.reduce(
  (sum, key) => sum + computedStats.month_distribution[key].null,
  0,
);
const extremeCount = profiles.filter((profile) =>
  [...Object.values(profile.companion_fit), ...Object.values(profile.month_fit)]
    .some((value) => value === 0 || value === 1),
).length;
const lowConfidenceCount = profiles.filter(
  (profile) =>
    profile.label_meta.confidence.companion_fit < 0.65 ||
    profile.label_meta.confidence.month_fit < 0.65,
).length;
assert(report.includes(`- 전체: ${profiles.length}건`), "report total summary differs");
assert(
  report.includes(`- companion null: ${formatRatio(companionNulls, profiles.length * COMPANION_KEYS.length)}`),
  "report companion null summary differs",
);
assert(
  report.includes(`- month null: ${formatRatio(monthNulls, profiles.length * MONTH_KEYS.length)}`),
  "report month null summary differs",
);
assert(report.includes(`0 또는 1이 하나라도 있는 ${extremeCount}건이다.`), "report extreme-value count differs");
assert(
  report.includes(`신뢰도 0.65 미만 또는 null로 사람 검수가 필요한 장소: ${lowConfidenceCount}건`),
  "report low-confidence count differs",
);
for (const axis of COMPANION_KEYS) {
  assert(
    report.includes(distributionReportRow(axis, computedStats.companion_distribution[axis])),
    `report companion distribution differs for ${axis}`,
  );
}
for (const month of MONTH_KEYS) {
  assert(
    report.includes(distributionReportRow(month, computedStats.month_distribution[month])),
    `report month distribution differs for ${month}`,
  );
}

console.log(
  JSON.stringify(
    {
      profiles: profiles.length,
      type_counts: typeCounts,
      direct_source_profiles: directSourceProfiles,
      total_source_refs: totalSourceRefs,
      null_companion_values: nullCompanionValues,
      null_month_values: nullMonthValues,
      source_hash_matches: true,
      schema_valid: true,
    },
    null,
    2,
  ),
);
