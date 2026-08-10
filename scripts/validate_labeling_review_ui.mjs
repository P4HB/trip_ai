import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const reviewRoot = path.join(workspaceRoot, "labeling-review");
const htmlPath = path.join(reviewRoot, "index.html");
const templatePath = path.join(reviewRoot, "src", "index.template.html");
const stylesPath = path.join(reviewRoot, "src", "styles.css");
const modelPath = path.join(reviewRoot, "src", "review-model.js");
const appPath = path.join(reviewRoot, "src", "app.js");
const profilesPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v3-auto-100",
  "place_profiles.json",
);
const manifestPath = path.join(path.dirname(profilesPath), "manifest.json");
const proposalsPath = path.join(path.dirname(profilesPath), "auto_label_proposals.json");
const climatePath = path.join(path.dirname(profilesPath), "climate_baseline.json");
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

const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const LABEL_VALUES = new Set([null, 0, 0.25, 0.5, 0.75, 1]);
const EXPECTED_TYPE_COUNTS = { "12": 68, "14": 12, "15": 4, "28": 16 };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const html = fs.readFileSync(htmlPath, "utf8");
const template = fs.readFileSync(templatePath, "utf8");
const styles = fs.readFileSync(stylesPath, "utf8").trim();
const modelSource = fs.readFileSync(modelPath, "utf8").trim();
const appSource = fs.readFileSync(appPath, "utf8").trim();
const profiles = readJson(profilesPath);
const manifest = readJson(manifestPath);
const proposals = readJson(proposalsPath);
const climate = readJson(climatePath);
const researchItems = readJson(researchPath);
const sourcePlaces = readJson(sourcePath);
const sourceById = new Map(sourcePlaces.map((place) => [clean(place.contentid), place]));

assert(!html.includes("__INLINE_STYLES__"), "generated HTML still contains the styles marker");
assert(!html.includes("__REVIEW_DATA__"), "generated HTML still contains the data marker");
assert(!html.includes("__REVIEW_MODEL__"), "generated HTML still contains the model marker");
assert(!html.includes("__APP_SCRIPT__"), "generated HTML still contains the app marker");
assert(template.includes("__REVIEW_DATA__"), "source template is missing the data marker");
assert(html.includes(styles), "generated HTML styles differ from the source stylesheet");
assert(html.includes(modelSource), "generated HTML model differs from the source model");
assert(html.includes(appSource), "generated HTML app differs from the source app");
assert(appSource.includes("선택 경험에 한정"), "aggregate physical-effort scope disclosure is missing");
assert(appSource.includes("GATE-CHUJA-OLLE"), "Chuja optional-effort disclosure is not scoped to its rule");

const dataMatch = html.match(/<script id="review-dataset" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
assert(dataMatch, "embedded review dataset was not found");
const rawDataBlock = dataMatch[1];
assert(!/[<>&\u2028\u2029]/u.test(rawDataBlock), "embedded dataset contains an unescaped HTML-sensitive character");
const dataset = JSON.parse(rawDataBlock);

assert.equal(dataset.schema_version, "place-profile-review-dataset-v2");
assert.equal(dataset.ui_version, "place-profile-review-ui-v3");
assert.equal(dataset.label_version, "place-profile-pilot-v3-auto");
assert.equal(dataset.profile_path, "data/labeling/jeju/2026-08-09/pilots/place-profile-v3-auto-100/place_profiles.json");
assert.equal(dataset.profile_sha256, sha256File(profilesPath));
assert.equal(dataset.profile_sha256, manifest.files["place_profiles.json"].sha256);
assert.equal(sha256File(proposalsPath), manifest.files["auto_label_proposals.json"].sha256);
assert.equal(sha256File(climatePath), manifest.files["climate_baseline.json"].sha256);
assert.equal(sha256File(researchPath), manifest.base_v2.research_sha256);
const expectedReviewBaseComponents = {
  profile_sha256: sha256File(profilesPath),
  proposal_sha256: sha256File(proposalsPath),
  climate_sha256: sha256File(climatePath),
  research_sha256: sha256File(researchPath),
  ui_version: "place-profile-review-ui-v3",
};
assert.deepEqual(dataset.review_base_components, expectedReviewBaseComponents);
assert.equal(dataset.review_base_sha256, crypto.createHash("sha256").update(JSON.stringify(expectedReviewBaseComponents)).digest("hex"));
assert(Array.isArray(dataset.items));
assert.equal(dataset.items.length, 100);
assert.equal(new Set(dataset.items.map((item) => item.contentid)).size, 100);
assert.deepEqual(dataset.items.map((item) => item.contentid), profiles.map((profile) => profile.contentid));

const typeCounts = {};
let directSourcePlaces = 0;
let companionNullPlaces = 0;
let monthNullPlaces = 0;
let monthNaPlaces = 0;
const priorityCounts = { low: 0, medium: 0, high: 0 };
dataset.items.forEach((item, index) => {
  const profile = profiles[index];
  const source = sourceById.get(item.contentid);
  assert(source, `source place is missing for ${item.contentid}`);
  assert.equal(item.title, profile.title);
  assert.deepEqual(item.source_place, profile.source_place);
  assert.deepEqual(item.companion_fit, profile.companion_fit);
  assert.deepEqual(item.month_fit, profile.month_fit);
  assert.deepEqual(item.label_evidence, profile.label_evidence);
  assert.deepEqual(item.label_meta, profile.label_meta);
  assert.deepEqual(item.auto_label, proposals[index]);
  assert.deepEqual(item.web_research, researchItems[index]);
  assert.equal(item.display.address, [clean(source.addr1), clean(source.addr2)].filter(Boolean).join(" "));
  assert.deepEqual(item.display.classification, [
    clean(profile.source_place.lclsSystm1),
    clean(profile.source_place.lclsSystm2),
    clean(profile.source_place.lclsSystm3),
  ].filter(Boolean));
  assert.equal(typeof item.display.image, "string");
  if (item.display.image) assert(/^https:\/\//i.test(item.display.image), `image URL is not HTTPS for ${item.contentid}`);

  assert.deepEqual(Object.keys(item.companion_fit).sort(), [...COMPANION_KEYS].sort());
  assert.deepEqual(Object.keys(item.month_fit).sort(), [...MONTH_KEYS].sort());
  for (const value of Object.values(item.companion_fit)) assert(LABEL_VALUES.has(value));
  for (const value of Object.values(item.month_fit)) assert(LABEL_VALUES.has(value));

  const type = item.source_place.contenttypeid;
  typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  if (item.label_evidence.source_refs.length) directSourcePlaces += 1;
  if (Object.values(item.companion_fit).includes(null)) companionNullPlaces += 1;
  if (MONTH_KEYS.some((key) => item.month_fit[key] === null && item.auto_label.month_fit[key].inference_level !== "not_applicable")) monthNullPlaces += 1;
  if (MONTH_KEYS.some((key) => item.auto_label.month_fit[key].inference_level === "not_applicable")) monthNaPlaces += 1;
  priorityCounts[item.auto_label.review_priority] += 1;
});

assert.deepEqual(typeCounts, EXPECTED_TYPE_COUNTS);
assert.equal(directSourcePlaces, 100);
assert.deepEqual(dataset.stats.by_content_type, EXPECTED_TYPE_COUNTS);
assert.equal(dataset.stats.total, 100);
assert.equal(dataset.stats.profiles_with_direct_sources, directSourcePlaces);
assert.equal(dataset.stats.companion_null_places, companionNullPlaces);
assert.equal(dataset.stats.month_null_places, monthNullPlaces);
assert.equal(dataset.stats.month_na_places, monthNaPlaces);
assert.deepEqual(dataset.stats.by_review_priority, priorityCounts);
assert.deepEqual(dataset.climate_baseline, climate);
assert.equal(monthNaPlaces, 4);
assert.equal(dataset.stats.total_research_sources, researchItems.reduce((sum, item) => sum + item.sources.length, 0));
assert.deepEqual(dataset.stats.by_research_status, Object.fromEntries(
  ["matched", "uncertain", "not_found"].map((status) => [status, researchItems.filter((item) => item.research_status === status).length]),
));

const scriptOpenTags = [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => match[1]);
assert.equal(scriptOpenTags.length, 3, "HTML must contain dataset, model and app scripts only");
assert(scriptOpenTags.every((attributes) => !/\bsrc\s*=/i.test(attributes)), "external script source is not allowed");
assert(!/<link\b[^>]*rel=["']?stylesheet/i.test(html), "external stylesheet is not allowed");
assert(!/@import\s|url\(\s*["']?https?:/i.test(styles), "stylesheet must not load external resources");
assert(/Content-Security-Policy/i.test(html), "CSP meta is required");
assert(/script-src 'unsafe-inline'/.test(html), "CSP must allow only the generated inline scripts");
assert(/connect-src 'none'/.test(html), "CSP must block network requests");

const forbiddenSourcePatterns = [
  [/\bfetch\s*\(/, "fetch"],
  [/\.innerHTML\b/, "innerHTML"],
  [/\.outerHTML\b/, "outerHTML"],
  [/insertAdjacentHTML\b/, "insertAdjacentHTML"],
  [/document\.write\b/, "document.write"],
  [/\beval\s*\(/, "eval"],
  [/new\s+Function\b/, "new Function"],
];
for (const [pattern, label] of forbiddenSourcePatterns) {
  assert(!pattern.test(modelSource), `review model uses forbidden ${label}`);
  assert(!pattern.test(appSource), `review app uses forbidden ${label}`);
}
assert(/\.textContent\s*=/.test(appSource), "review app must render data with textContent");
assert(/safeExternalUrl/.test(appSource), "review app must validate external URLs");
assert(/rel\s*=\s*["']noopener noreferrer["']/.test(appSource), "external links must use noopener noreferrer");
assert(/nextVisibleOpenId\(dataset, bundle, filters, currentId\)/.test(appSource), "next action must stay inside the active filters");
assert(/addEventListener\(["']pagehide["'],\s*flushPendingSave\)/.test(appSource), "pending edits must flush on pagehide");
assert(/structuredEvidence\(item\)/.test(appSource), "structured label evidence must be rendered");
assert(/buildResearchSection\(item\)/.test(appSource), "web research section must be rendered before labels");
assert(/research\.sources\.forEach/.test(appSource), "web research source claims must be rendered");
assert(/bulkApproveLowRisk/.test(modelSource), "review model must support explicit low-risk bulk approval");
assert(/bulkApprovePriority/.test(modelSource), "review model must isolate low/medium priority bulk approval");
assert(/confirmBulkApproveLowRisk/.test(appSource), "review app must confirm low-risk bulk approval");
assert(/confirmBulkApproveMediumRisk/.test(appSource), "review app must separately confirm medium-risk bulk approval");
assert(/inferenceNames/.test(appSource), "review app must render per-axis inference levels");
assert(/not_applicable/.test(appSource), "review app must render festival N/A semantics");

new vm.Script(modelSource, { filename: "review-model.js" });
new vm.Script(appSource, { filename: "app.js" });

const requiredHtmlPatterns = [
  [/<main\b[^>]*id="review-main"/, "review main landmark"],
  [/<aside\b[^>]*id="review-sidebar"/, "review sidebar"],
  [/<progress\b[^>]*id="review-progress"/, "native progress"],
  [/<input\b[^>]*id="place-search"[^>]*type="search"/, "search input"],
  [/<input\b[^>]*id="import-file"[^>]*type="file"/, "JSON file input"],
  [/<div\b[^>]*id="modal-backdrop"/, "confirmation modal"],
  [/<option\s+value="approved_as_is">/, "AI approval status filter"],
  [/<option\s+value="approved_with_changes">/, "changed approval status filter"],
  [/<select\b[^>]*id="priority-filter"/, "review priority filter"],
  [/<button\b[^>]*id="bulk-approve-button"/, "low-risk bulk approval button"],
  [/<button\b[^>]*id="bulk-approve-medium-button"/, "medium-risk bulk approval button"],
];
for (const [pattern, label] of requiredHtmlPatterns) assert(pattern.test(html), `HTML is missing ${label}`);
assert(/@media\s*\([^)]*max-width:\s*760px/i.test(styles), "mobile layout breakpoint is missing");
assert(/prefers-reduced-motion/.test(styles), "reduced-motion support is missing");
assert(/:focus-visible/.test(styles), "focus-visible styling is missing");
assert(/min-height:\s*44px/.test(styles), "44px touch target rule is missing");

console.log(JSON.stringify({
  html: path.relative(workspaceRoot, htmlPath).replaceAll("\\", "/"),
  html_bytes: fs.statSync(htmlPath).size,
  places: dataset.items.length,
  type_counts: typeCounts,
  direct_source_places: directSourcePlaces,
  companion_null_places: companionNullPlaces,
  month_null_places: monthNullPlaces,
  month_na_places: monthNaPlaces,
  review_priority: priorityCounts,
  profile_sha256_matches: true,
  single_file: true,
  unsafe_dom_sinks: 0,
}, null, 2));
