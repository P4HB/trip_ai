import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const pilotDirectory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v3-auto-100",
);
const profilesPath = path.join(pilotDirectory, "place_profiles.json");
const manifestPath = path.join(pilotDirectory, "manifest.json");
const proposalsPath = path.join(pilotDirectory, "auto_label_proposals.json");
const climatePath = path.join(pilotDirectory, "climate_baseline.json");
const researchPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v2-100",
  "place_web_research.json",
);
const sourcePath = path.join(
  workspaceRoot,
  "data",
  "tourapi",
  "jeju",
  "2026-08-09",
  "jeju_places.json",
);
const sourceDirectory = path.join(workspaceRoot, "labeling-review", "src");
const templatePath = path.join(sourceDirectory, "index.template.html");
const stylesPath = path.join(sourceDirectory, "styles.css");
const modelPath = path.join(sourceDirectory, "review-model.js");
const appPath = path.join(sourceDirectory, "app.js");
const outputPath = path.join(workspaceRoot, "labeling-review", "index.html");

const EXPECTED_PROFILE_COUNT = 100;
const UI_VERSION = "place-profile-review-ui-v3";
const DATASET_SCHEMA_VERSION = "place-profile-review-dataset-v2";
const TYPE_NAMES = { "12": "관광지", "14": "문화시설", "15": "축제", "28": "레포츠" };
const REGION_NAMES = { "110": "제주시", "130": "서귀포시" };
const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function normalizeHttpUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.protocol === "http:") url.protocol = "https:";
    return url.href;
  } catch {
    return "";
  }
}

function replaceExactlyOnce(source, marker, value) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`Template marker must occur exactly once: ${marker}`);
  }
  return source.replace(marker, () => value);
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value, null, 2).replace(/[<>&\u2028\u2029]/g, (character) => {
    const codePoint = character.codePointAt(0).toString(16).padStart(4, "0");
    return `\\u${codePoint}`;
  });
}

function assertNoClosingTag(source, tagName, filePath) {
  const pattern = new RegExp(`<\\/${tagName}`, "i");
  if (pattern.test(source)) throw new Error(`${relativePath(filePath)} contains a literal </${tagName} sequence`);
}

const profiles = readJson(profilesPath);
const manifest = readJson(manifestPath);
const proposals = readJson(proposalsPath);
const climateBaseline = readJson(climatePath);
const researchItems = readJson(researchPath);
const sourcePlaces = readJson(sourcePath);

if (!Array.isArray(profiles) || profiles.length !== EXPECTED_PROFILE_COUNT) {
  throw new Error(`Expected ${EXPECTED_PROFILE_COUNT} pilot profiles`);
}
if (!Array.isArray(sourcePlaces)) throw new Error("TourAPI source must be a JSON array");
if (!Array.isArray(researchItems) || researchItems.length !== EXPECTED_PROFILE_COUNT) {
  throw new Error(`Expected ${EXPECTED_PROFILE_COUNT} web research records`);
}
if (!Array.isArray(proposals) || proposals.length !== EXPECTED_PROFILE_COUNT) {
  throw new Error(`Expected ${EXPECTED_PROFILE_COUNT} auto-label proposals`);
}

const actualProfilesHash = sha256File(profilesPath);
const actualProposalsHash = sha256File(proposalsPath);
const actualClimateHash = sha256File(climatePath);
const actualResearchHash = sha256File(researchPath);
const declaredProfilesHash = manifest.files?.["place_profiles.json"]?.sha256;
if (actualProfilesHash !== declaredProfilesHash) {
  throw new Error("Pilot profile hash differs from its manifest");
}
if (actualProposalsHash !== manifest.files?.["auto_label_proposals.json"]?.sha256) {
  throw new Error("Auto-label proposal hash differs from its manifest");
}
if (actualClimateHash !== manifest.files?.["climate_baseline.json"]?.sha256) {
  throw new Error("Climate baseline hash differs from its manifest");
}
if (actualResearchHash !== manifest.base_v2?.research_sha256) {
  throw new Error("Web research hash differs from its manifest");
}

const sourceById = new Map(sourcePlaces.map((place) => [clean(place.contentid), place]));
const seenIds = new Set();
const items = profiles.map((profile, index) => {
  const contentid = clean(profile.contentid);
  if (!contentid || seenIds.has(contentid)) throw new Error(`Invalid or duplicate profile contentid at index ${index}`);
  seenIds.add(contentid);
  const source = sourceById.get(contentid);
  if (!source) throw new Error(`Profile ${contentid} is missing from the TourAPI source`);
  const research = researchItems[index];
  if (clean(research?.contentid) !== contentid || clean(research?.title) !== clean(profile.title)) {
    throw new Error(`Web research identity differs for profile ${contentid}`);
  }
  const autoLabel = proposals[index];
  if (clean(autoLabel?.contentid) !== contentid || clean(autoLabel?.title) !== clean(profile.title)) {
    throw new Error(`Auto-label proposal identity differs for profile ${contentid}`);
  }

  const address = [clean(source.addr1), clean(source.addr2)].filter(Boolean).join(" ");
  const image = normalizeHttpUrl(source.firstimage || source.firstimage2);
  return {
    contentid,
    title: clean(profile.title),
    source_place: profile.source_place,
    display: {
      type_name: TYPE_NAMES[clean(profile.source_place.contenttypeid)] ?? clean(profile.source_place.contenttypeid),
      region_name: REGION_NAMES[clean(profile.source_place.region_code)] ?? clean(profile.source_place.region_code),
      address,
      telephone: clean(source.tel),
      image,
      classification: [
        clean(profile.source_place.lclsSystm1),
        clean(profile.source_place.lclsSystm2),
        clean(profile.source_place.lclsSystm3),
      ].filter(Boolean),
    },
    companion_fit: profile.companion_fit,
    month_fit: profile.month_fit,
    label_evidence: profile.label_evidence,
    label_meta: profile.label_meta,
    auto_label: autoLabel,
    web_research: research,
  };
});

const typeCounts = {};
for (const item of items) {
  const type = item.source_place.contenttypeid;
  typeCounts[type] = (typeCounts[type] ?? 0) + 1;
}

const reviewBaseComponents = {
  profile_sha256: actualProfilesHash,
  proposal_sha256: actualProposalsHash,
  climate_sha256: actualClimateHash,
  research_sha256: actualResearchHash,
  ui_version: UI_VERSION,
};
const reviewBaseHash = crypto.createHash("sha256").update(JSON.stringify(reviewBaseComponents)).digest("hex");

const dataset = {
  schema_version: DATASET_SCHEMA_VERSION,
  ui_version: UI_VERSION,
  label_version: manifest.label_version,
  profile_path: relativePath(profilesPath),
  profile_sha256: actualProfilesHash,
  review_base_sha256: reviewBaseHash,
  review_base_components: reviewBaseComponents,
  snapshot_date: manifest.source.snapshot_date,
  stats: {
    total: items.length,
    by_content_type: typeCounts,
    profiles_with_direct_sources: items.filter((item) => item.label_evidence.source_refs.length > 0).length,
    companion_null_places: items.filter((item) => COMPANION_KEYS.some((key) => item.companion_fit[key] === null)).length,
    month_null_places: items.filter((item) => MONTH_KEYS.some((key) => item.month_fit[key] === null && item.auto_label.month_fit[key].inference_level !== "not_applicable")).length,
    month_na_places: items.filter((item) => MONTH_KEYS.some((key) => item.auto_label.month_fit[key].inference_level === "not_applicable")).length,
    by_review_priority: Object.fromEntries(
      ["low", "medium", "high"].map((priority) => [priority, items.filter((item) => item.auto_label.review_priority === priority).length]),
    ),
    by_research_status: Object.fromEntries(
      ["matched", "uncertain", "not_found"].map((status) => [status, items.filter((item) => item.web_research.research_status === status).length]),
    ),
    total_research_sources: items.reduce((sum, item) => sum + item.web_research.sources.length, 0),
  },
  climate_baseline: climateBaseline,
  items,
};

let template = fs.readFileSync(templatePath, "utf8");
const styles = fs.readFileSync(stylesPath, "utf8").trim();
const reviewModel = fs.readFileSync(modelPath, "utf8").trim();
const app = fs.readFileSync(appPath, "utf8").trim();

assertNoClosingTag(styles, "style", stylesPath);
assertNoClosingTag(reviewModel, "script", modelPath);
assertNoClosingTag(app, "script", appPath);

template = replaceExactlyOnce(template, "__INLINE_STYLES__", styles);
template = replaceExactlyOnce(template, "__REVIEW_DATA__", escapeJsonForHtml(dataset));
template = replaceExactlyOnce(template, "__REVIEW_MODEL__", reviewModel);
template = replaceExactlyOnce(template, "__APP_SCRIPT__", app);

fs.writeFileSync(outputPath, `${template.trimEnd()}\n`, "utf8");

console.log(JSON.stringify({
  output: relativePath(outputPath),
  places: dataset.stats.total,
  profile_sha256: dataset.profile_sha256,
  review_base_sha256: dataset.review_base_sha256,
  direct_source_places: dataset.stats.profiles_with_direct_sources,
  companion_null_places: dataset.stats.companion_null_places,
  month_null_places: dataset.stats.month_null_places,
  month_na_places: dataset.stats.month_na_places,
  review_priority: dataset.stats.by_review_priority,
}, null, 2));
