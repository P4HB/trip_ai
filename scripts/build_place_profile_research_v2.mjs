import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const snapshotRoot = path.join(workspaceRoot, "data", "labeling", "jeju", "2026-08-09", "pilots");
const v1Directory = path.join(snapshotRoot, "place-profile-v1-100");
const v2Directory = path.join(snapshotRoot, "place-profile-v2-100");
const researchDirectory = path.join(v2Directory, "research");
const sourcePath = path.join(workspaceRoot, "data", "tourapi", "jeju", "2026-08-09", "jeju_places.json");
const v1ProfilesPath = path.join(v1Directory, "place_profiles.json");
const selectionPath = path.join(v1Directory, "selection_ids.json");
const partPaths = [1, 2, 3].map((part) => path.join(researchDirectory, `part_${part}.json`));
const webPagesPath = path.join(researchDirectory, "web_pages.json");
const researchOutputPath = path.join(v2Directory, "place_web_research.json");
const profilesOutputPath = path.join(v2Directory, "place_profiles.json");
const reportOutputPath = path.join(v2Directory, "review_report.md");
const manifestOutputPath = path.join(v2Directory, "manifest.json");

const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const LABEL_VALUES = new Set([null, 0, 0.25, 0.5, 0.75, 1]);
const EXPECTED_PART_COUNTS = [34, 33, 33];
const LABEL_VERSION = "place-profile-pilot-v2-web";

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  assert(!raw.includes("\uFFFD") && !/\?{3,}/.test(raw), `text encoding appears damaged: ${relativePath(filePath)}`);
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertLabelMap(value, keys, fieldPath) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${fieldPath} must be an object`);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${fieldPath} keys differ`);
  for (const key of keys) assert(LABEL_VALUES.has(value[key]), `${fieldPath}.${key} has an invalid value`);
}

function escapeTable(value) {
  return clean(value).replaceAll("|", "\\|");
}

fs.mkdirSync(v2Directory, { recursive: true });

const v1Profiles = readJson(v1ProfilesPath);
const selection = readJson(selectionPath);
assert(Array.isArray(v1Profiles) && v1Profiles.length === 100, "v1 profile input must contain 100 records");
assert(Array.isArray(selection.contentids) && selection.contentids.length === 100, "selection input must contain 100 IDs");
assert(
  JSON.stringify(v1Profiles.map((profile) => profile.contentid)) === JSON.stringify(selection.contentids),
  "v1 profile order differs from the selection",
);

const partFiles = partPaths.map((partPath, index) => {
  assert(fs.existsSync(partPath), `research part is missing: ${relativePath(partPath)}`);
  const part = readJson(partPath);
  assert(part.schema_version === "place-web-research-v1", `part_${index + 1} has an invalid schema version`);
  assert(part.batch_id === `part_${index + 1}`, `part_${index + 1} has an invalid batch_id`);
  assert(part.checked_at === "2026-08-10", `part_${index + 1} has an invalid checked_at`);
  assert(Array.isArray(part.items) && part.items.length === EXPECTED_PART_COUNTS[index], `part_${index + 1} count differs`);
  return part;
});
assert(fs.existsSync(webPagesPath), `web page extract is missing: ${relativePath(webPagesPath)}`);
const webPages = readJson(webPagesPath);
assert(webPages.schema_version === "place-web-page-extract-v1", "web page extract has an invalid schema version");
assert(Array.isArray(webPages.items) && webPages.items.length === 100, "web page extract must contain 100 records");

const researchItems = partFiles.flatMap((part) => part.items);
assert(researchItems.length === 100, "merged research must contain 100 records");
assert(new Set(researchItems.map((item) => clean(item.contentid))).size === 100, "research IDs must be unique");
assert(
  JSON.stringify(researchItems.map((item) => clean(item.contentid))) === JSON.stringify(selection.contentids),
  "research IDs or order differ from the selection",
);

const profiles = researchItems.map((research, index) => {
  const v1 = v1Profiles[index];
  assert(clean(research.title) === v1.title, `research title differs at index ${index}`);
  assertLabelMap(research.proposed_companion_fit, COMPANION_KEYS, `research[${index}].proposed_companion_fit`);
  assertLabelMap(research.proposed_month_fit, MONTH_KEYS, `research[${index}].proposed_month_fit`);
  const evidence = research.evidence_scores;
  assert(evidence && typeof evidence === "object", `research[${index}].evidence_scores is missing`);

  const limitations = [...research.unknowns];
  if (research.research_status !== "matched") {
    limitations.unshift(`웹 조사 상태가 ${research.research_status}이므로 장소 식별 또는 현재 정보가 확정되지 않음`);
  }

  return {
    contentid: v1.contentid,
    title: v1.title,
    source_place: v1.source_place,
    companion_fit: research.proposed_companion_fit,
    month_fit: research.proposed_month_fit,
    label_evidence: {
      environment: research.facts.environment,
      physical_effort: evidence.physical_effort,
      indoor_ratio: evidence.indoor_ratio,
      rain_sensitivity: evidence.rain_sensitivity,
      wind_sensitivity: evidence.wind_sensitivity,
      heat_sensitivity: evidence.heat_sensitivity,
      cold_sensitivity: evidence.cold_sensitivity,
      seasonal_peak_months: evidence.seasonal_peak_months,
      companion_basis: COMPANION_KEYS.map((key) => `${key}: ${research.companion_rationale[key]}`),
      month_basis: [research.month_rationale],
      source_refs: research.sources.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        source_type: source.source_type,
        checked_at: source.checked_at,
        claims: source.claims,
      })),
      limitations,
      availability_separate: evidence.availability_separate,
    },
    label_meta: {
      version: LABEL_VERSION,
      method: "place_web_research_v1",
      research_record_sha256: sha256Json(research),
      confidence: {
        companion_fit: research.confidence.companion_fit,
        month_fit: research.confidence.month_fit,
      },
      review_status: "needs_human_review",
    },
  };
});

writeJson(researchOutputPath, researchItems);
writeJson(profilesOutputPath, profiles);

const statusCounts = {};
const sourceTypeCounts = {};
let totalSources = 0;
let totalUnknowns = 0;
for (const item of researchItems) {
  statusCounts[item.research_status] = (statusCounts[item.research_status] ?? 0) + 1;
  totalSources += item.sources.length;
  totalUnknowns += item.unknowns.length;
  for (const source of item.sources) sourceTypeCounts[source.source_type] = (sourceTypeCounts[source.source_type] ?? 0) + 1;
}

const reportLines = [
  "# Place profile v2 웹 조사 검토 보고서",
  "",
  `- 조사 대상: ${researchItems.length}건`,
  `- 조사 상태: matched ${statusCounts.matched ?? 0}, uncertain ${statusCounts.uncertain ?? 0}, not_found ${statusCounts.not_found ?? 0}`,
  `- 확인한 조사 출처: ${totalSources}개`,
  `- 열린 페이지 제목 일치: ${webPages.items.filter((item) => item.title_matches).length}건, 별칭·표기 차이: ${webPages.items.filter((item) => !item.title_matches).length}건`,
  `- 명시한 미확인 사항: ${totalUnknowns}개`,
  "- 이 결과는 사람 검수 전 AI 제안이며 운영용 골드 라벨이 아니다.",
  "",
  "| # | contentid | 장소 | 조사 상태 | 출처 | companion 비-null | month 비-null | 미확인 |",
  "|---:|---|---|---|---:|---:|---:|---:|",
  ...researchItems.map((item, index) => `| ${index + 1} | ${item.contentid} | ${escapeTable(item.title)} | ${item.research_status} | ${item.sources.length} | ${Object.values(item.proposed_companion_fit).filter((value) => value !== null).length} | ${Object.values(item.proposed_month_fit).filter((value) => value !== null).length} | ${item.unknowns.length} |`),
];
fs.writeFileSync(reportOutputPath, `${reportLines.join("\n")}\n`, "utf8");

const manifest = {
  schema_version: "place-profile-web-research-manifest-v2",
  status: "ai_draft",
  label_version: LABEL_VERSION,
  checked_at: "2026-08-10",
  source: {
    path: relativePath(sourcePath),
    snapshot_date: "2026-08-09",
    sha256: sha256File(sourcePath),
  },
  base_profile: {
    path: relativePath(v1ProfilesPath),
    count: v1Profiles.length,
    sha256: sha256File(v1ProfilesPath),
  },
  selection: {
    path: relativePath(selectionPath),
    count: selection.contentids.length,
    sha256: sha256File(selectionPath),
  },
  research_parts: partPaths.map((partPath, index) => ({
    path: relativePath(partPath),
    count: partFiles[index].items.length,
    sha256: sha256File(partPath),
  })),
  web_pages: {
    path: relativePath(webPagesPath),
    source: webPages.source,
    count: webPages.items.length,
    http_ok: webPages.items.filter((item) => item.http_status >= 200 && item.http_status < 300).length,
    exact_title_matches: webPages.items.filter((item) => item.title_matches).length,
    title_aliases: webPages.items.filter((item) => !item.title_matches).length,
    sha256: sha256File(webPagesPath),
  },
  stats: {
    total: researchItems.length,
    by_research_status: statusCounts,
    total_sources: totalSources,
    by_source_type: sourceTypeCounts,
    total_unknowns: totalUnknowns,
  },
  files: {
    "place_web_research.json": {
      path: relativePath(researchOutputPath),
      count: researchItems.length,
      sha256: sha256File(researchOutputPath),
    },
    "place_profiles.json": {
      path: relativePath(profilesOutputPath),
      count: profiles.length,
      sha256: sha256File(profilesOutputPath),
    },
    "review_report.md": {
      path: relativePath(reportOutputPath),
      sha256: sha256File(reportOutputPath),
    },
  },
};
writeJson(manifestOutputPath, manifest);

console.log(JSON.stringify({
  output: relativePath(v2Directory),
  places: researchItems.length,
  research_status: statusCounts,
  sources: totalSources,
  profile_sha256: manifest.files["place_profiles.json"].sha256,
}, null, 2));
