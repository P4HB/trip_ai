import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const modelPath = path.join(workspaceRoot, "labeling-review", "src", "review-model.js");
const htmlPath = path.join(workspaceRoot, "labeling-review", "index.html");
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

const TIMESTAMPS = Object.freeze({
  created: "2026-08-10T00:00:00.000Z",
  edited: "2026-08-10T00:01:00.000Z",
  completed: "2026-08-10T00:02:00.000Z",
  exported: "2026-08-10T00:03:00.000Z",
});

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractDatasetJson(html) {
  const matches = [...html.matchAll(/<script\b[^>]*\bid=(["'])review-dataset\1[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(matches.length, 1, "generated HTML must contain exactly one review-dataset script");
  assert.match(matches[0][0], /\btype=(["'])application\/json\1/i, "review-dataset must be application/json");
  return matches[0][2];
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonEqual(actual, expected, message) {
  assert.deepEqual(toPlain(actual), toPlain(expected), message);
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const modelSource = readUtf8(modelPath);
const html = readUtf8(htmlPath);
const datasetJson = extractDatasetJson(html);
const parsedDataset = JSON.parse(datasetJson);
const context = vm.createContext({ URL });
context.__DATASET_JSON__ = datasetJson;
vm.runInContext(modelSource, context, { filename: modelPath });
vm.runInContext("globalThis.__TEST_DATASET__ = JSON.parse(__DATASET_JSON__);", context);
delete context.__DATASET_JSON__;

const model = context.TRIP_AI_REVIEW_MODEL;
const dataset = context.__TEST_DATASET__;
assert.ok(model, "review model must attach itself in the vm context");

const passed = [];
function test(name, callback) {
  try {
    callback();
    passed.push(name);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function newBundle(sessionId = "test-session") {
  return model.createBundle(dataset, TIMESTAMPS.created, sessionId);
}

function alternativeNumericValue(original) {
  const value = [0, 0.25, 0.5, 0.75, 1].find((candidate) => !Object.is(candidate, original));
  assert.notEqual(value, undefined, "a different label value must exist");
  return value;
}

function reviewFor(bundle, contentid) {
  const review = bundle.reviews.find((candidate) => candidate.contentid === contentid);
  assert.ok(review, `review ${contentid} must exist`);
  return review;
}

function defaultFilters(overrides = {}) {
  return {
    query: "",
    type: "all",
    status: "all",
    priority: "all",
    no_source: false,
    changed: false,
    companion_null: false,
    month_null: false,
    ...overrides,
  };
}

function makeRoundTripBundle() {
  const bundle = newBundle("roundtrip-session");
  const first = dataset.items[0];
  const second = dataset.items[1];
  const third = dataset.items[2];
  model.completeReview(bundle, first.contentid, TIMESTAMPS.edited);
  model.setOverride(
    bundle,
    dataset,
    second.contentid,
    "companion_fit",
    "solo",
    alternativeNumericValue(second.companion_fit.solo),
    TIMESTAMPS.edited,
  );
  model.completeReview(bundle, second.contentid, TIMESTAMPS.completed);
  model.setComment(bundle, third.contentid, "공식 시설 정보를 추가로 확인해야 함", TIMESTAMPS.edited);
  model.setReviewStatus(bundle, third.contentid, "needs_research", TIMESTAMPS.completed);
  return bundle;
}

const invalidImports = [];
function expectImportRejected(name, text, size = byteLength(text)) {
  const result = model.parseImportText(text, size, dataset);
  assert.equal(result.ok, false, `${name} import must fail`);
  assert.equal(result.bundle, null, `${name} import must not expose a bundle`);
  assert.ok(Array.isArray(result.errors) && result.errors.length > 0, `${name} import must explain the failure`);
  invalidImports.push(name);
}

test("generated dataset identity and exact source order", () => {
  assert.equal(parsedDataset.schema_version, "place-profile-review-dataset-v2");
  assert.equal(dataset.items.length, 100);
  assert.equal(new Set(dataset.items.map((item) => item.contentid)).size, 100);

  const profilesRaw = readUtf8(profilesPath);
  const profiles = JSON.parse(profilesRaw);
  assert.equal(profiles.length, 100);
  assert.equal(
    dataset.profile_sha256,
    crypto.createHash("sha256").update(profilesRaw).digest("hex"),
    "HTML dataset hash must match the source profile bytes",
  );
  assert.match(dataset.review_base_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    [...dataset.items].map((item) => item.contentid),
    profiles.map((profile) => String(profile.contentid)),
    "HTML dataset IDs and order must match place_profiles.json",
  );
  assert.deepEqual(
    [...dataset.items].map((item) => item.title),
    profiles.map((profile) => profile.title),
    "HTML dataset title snapshots must match place_profiles.json",
  );
});

test("initial progress is 0 of 100", () => {
  const bundle = newBundle();
  const summary = model.computeSummary(bundle);
  jsonEqual(summary, {
    total: 100,
    processed: 0,
    approved: 0,
    needs_research: 0,
    skipped: 0,
    in_progress: 0,
    unreviewed: 100,
    changed: 0,
    by_status: {
      unreviewed: 100,
      in_progress: 0,
      approved_as_is: 0,
      approved_with_changes: 0,
      needs_research: 0,
      skipped: 0,
    },
  });
  assert.ok(bundle.reviews.every((review) => review.status === "unreviewed"));
  assert.ok(bundle.reviews.every((review) => model.countOverrides(review) === 0));
});

test("override set, AI restore, and explicit null remain distinct", () => {
  const item = dataset.items.find((candidate) => candidate.companion_fit.solo !== null);
  assert.ok(item);
  const original = item.companion_fit.solo;
  const replacement = alternativeNumericValue(original);
  const bundle = newBundle("override-session");
  const review = reviewFor(bundle, item.contentid);

  assert.equal(
    model.setOverride(bundle, dataset, item.contentid, "companion_fit", "solo", original, TIMESTAMPS.edited),
    false,
    "choosing the unchanged AI value must not create an override",
  );
  assert.equal(review.status, "unreviewed");
  assert.equal(Object.hasOwn(review.overrides.companion_fit, "solo"), false);

  assert.equal(model.setOverride(bundle, dataset, item.contentid, "companion_fit", "solo", replacement, TIMESTAMPS.edited), true);
  assert.equal(review.status, "in_progress");
  jsonEqual(review.overrides.companion_fit.solo, { from: original, to: replacement });
  assert.equal(model.getResolvedValue(item, review, "companion_fit", "solo"), replacement);

  assert.equal(model.setOverride(bundle, dataset, item.contentid, "companion_fit", "solo", original, TIMESTAMPS.completed), true);
  assert.equal(Object.hasOwn(review.overrides.companion_fit, "solo"), false, "restoring AI must remove the override key");
  assert.equal(model.getResolvedValue(item, review, "companion_fit", "solo"), original);
  assert.equal(review.status, "in_progress", "restoring a value still leaves an audit-visible started review");

  const nullBundle = newBundle("explicit-null-session");
  const nullReview = reviewFor(nullBundle, item.contentid);
  model.setOverride(nullBundle, dataset, item.contentid, "companion_fit", "solo", null, TIMESTAMPS.edited);
  assert.equal(Object.hasOwn(nullReview.overrides.companion_fit, "solo"), true);
  assert.equal(nullReview.overrides.companion_fit.solo.from, original);
  assert.equal(nullReview.overrides.companion_fit.solo.to, null);
  assert.equal(model.getResolvedValue(item, nullReview, "companion_fit", "solo"), null);
  model.setOverride(nullBundle, dataset, item.contentid, "companion_fit", "solo", original, TIMESTAMPS.completed);
  assert.equal(Object.hasOwn(nullReview.overrides.companion_fit, "solo"), false);

  assert.throws(() => model.setOverride(nullBundle, dataset, item.contentid, "companion_fit", "solo", "0.75"));
  assert.throws(() => model.setOverride(nullBundle, dataset, item.contentid, "companion_fit", "unknown", 0.75));
});

test("review status transitions enforce override rules", () => {
  const item = dataset.items[0];
  const original = item.companion_fit.solo;
  const replacement = alternativeNumericValue(original);

  const asIs = newBundle("as-is-session");
  assert.equal(model.completeReview(asIs, item.contentid, TIMESTAMPS.completed), "approved_as_is");
  assert.equal(reviewFor(asIs, item.contentid).completed_at, TIMESTAMPS.completed);
  assert.throws(() => model.setReviewStatus(asIs, item.contentid, "approved_with_changes", TIMESTAMPS.completed));
  assert.throws(() => model.setReviewStatus(asIs, item.contentid, "unreviewed", TIMESTAMPS.completed));

  const changed = newBundle("changed-session");
  model.setOverride(changed, dataset, item.contentid, "companion_fit", "solo", replacement, TIMESTAMPS.edited);
  assert.throws(() => model.setReviewStatus(changed, item.contentid, "approved_as_is", TIMESTAMPS.completed));
  assert.equal(model.completeReview(changed, item.contentid, TIMESTAMPS.completed), "approved_with_changes");
  assert.equal(reviewFor(changed, item.contentid).completed_at, TIMESTAMPS.completed);

  model.setComment(changed, item.contentid, "승인 뒤 코멘트 수정", TIMESTAMPS.exported);
  const reopened = reviewFor(changed, item.contentid);
  assert.equal(reopened.status, "in_progress", "editing a terminal review must reopen it");
  assert.equal(reopened.completed_at, null);

  model.resetReview(changed, dataset, item.contentid, TIMESTAMPS.exported);
  const reset = reviewFor(changed, item.contentid);
  assert.equal(reset.status, "unreviewed");
  assert.equal(reset.comment, "");
  assert.equal(model.countOverrides(reset), 0);
  assert.equal(reset.started_at, null);
});

test("low/medium bulk approval is explicit and leaves edited, completed, or high-risk places untouched", () => {
  const bundle = newBundle("bulk-low-risk-session");
  const lowItems = [...dataset.items].filter((item) => item.auto_label.review_priority === "low");
  const higherRiskItems = [...dataset.items].filter((item) => item.auto_label.review_priority !== "low");
  assert.equal(lowItems.length, dataset.stats.by_review_priority.low);
  assert.ok(lowItems.length > 2);

  const edited = lowItems[0];
  model.setOverride(
    bundle,
    dataset,
    edited.contentid,
    "companion_fit",
    "solo",
    alternativeNumericValue(edited.companion_fit.solo),
    TIMESTAMPS.edited,
  );
  const alreadyApproved = lowItems[1];
  model.completeReview(bundle, alreadyApproved.contentid, TIMESTAMPS.edited);

  const approvedIds = model.bulkApproveLowRisk(bundle, dataset, TIMESTAMPS.completed);
  assert.equal(approvedIds.length, lowItems.length - 2);
  assert(!approvedIds.includes(edited.contentid));
  assert(!approvedIds.includes(alreadyApproved.contentid));
  assert.equal(reviewFor(bundle, edited.contentid).status, "in_progress");
  assert.equal(reviewFor(bundle, alreadyApproved.contentid).status, "approved_as_is");
  assert.ok(approvedIds.every((contentid) => reviewFor(bundle, contentid).status === "approved_as_is"));
  assert.ok(higherRiskItems.every((item) => reviewFor(bundle, item.contentid).status === "unreviewed"));
  const mediumItems = higherRiskItems.filter((item) => item.auto_label.review_priority === "medium");
  const highItems = higherRiskItems.filter((item) => item.auto_label.review_priority === "high");
  const mediumApproved = model.bulkApprovePriority(bundle, dataset, "medium", TIMESTAMPS.completed);
  assert.equal(mediumApproved.length, mediumItems.length);
  assert.ok(mediumItems.every((item) => reviewFor(bundle, item.contentid).status === "approved_as_is"));
  assert.ok(highItems.every((item) => reviewFor(bundle, item.contentid).status === "unreviewed"));
  assert.throws(() => model.bulkApprovePriority(bundle, dataset, "high", TIMESTAMPS.completed));
  assert.equal(model.validateBundle(bundle, dataset).ok, true);
});

test("festival month N/A is not editable or counted as actionable null", () => {
  const festival = dataset.items.find((item) => item.source_place.contenttypeid === "15");
  assert.ok(festival);
  assert.ok(model.MONTH_KEYS.every((month) => festival.auto_label.month_fit[month].inference_level === "not_applicable"));
  const bundle = newBundle("festival-na-session");
  assert.throws(() => model.setOverride(bundle, dataset, festival.contentid, "month_fit", "1", 0.5, TIMESTAMPS.edited));
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ month_null: true })).length, 0);
});

test("comment requirements and limits are enforced", () => {
  const item = dataset.items[0];
  const research = newBundle("research-session");
  assert.throws(() => model.setReviewStatus(research, item.contentid, "needs_research", TIMESTAMPS.completed));
  model.setComment(research, item.contentid, "   ", TIMESTAMPS.edited);
  assert.throws(() => model.setReviewStatus(research, item.contentid, "needs_research", TIMESTAMPS.completed));
  model.setComment(research, item.contentid, "시설 접근성을 공식 출처에서 확인해야 함", TIMESTAMPS.edited);
  assert.equal(model.setReviewStatus(research, item.contentid, "needs_research", TIMESTAMPS.completed), "needs_research");

  const skipped = newBundle("skip-session");
  assert.throws(() => model.setReviewStatus(skipped, item.contentid, "skipped", TIMESTAMPS.completed));
  model.setComment(skipped, item.contentid, "현재 검수 범위에서 제외", TIMESTAMPS.edited);
  assert.equal(model.setReviewStatus(skipped, item.contentid, "skipped", TIMESTAMPS.completed), "skipped");

  const limited = newBundle("comment-limit-session");
  model.setComment(limited, item.contentid, "가".repeat(model.MAX_COMMENT_LENGTH), TIMESTAMPS.edited);
  const before = JSON.stringify(limited);
  assert.throws(() => model.setComment(limited, item.contentid, "가".repeat(model.MAX_COMMENT_LENGTH + 1), TIMESTAMPS.completed));
  assert.equal(JSON.stringify(limited), before, "rejected comments must not partially mutate the review");
});

let validExport;
test("export and import round-trip preserve all review state", () => {
  const bundle = makeRoundTripBundle();
  const beforeExport = JSON.stringify(bundle);
  validExport = model.makeExportBundle(bundle, dataset, TIMESTAMPS.exported);
  assert.equal(JSON.stringify(bundle), beforeExport, "export must not mutate the live bundle");
  assert.equal(validExport.session.exported_at, TIMESTAMPS.exported);
  assert.equal(validExport.session.updated_at, bundle.session.updated_at, "export must preserve the last review edit time");
  assert.equal(validExport.reviews.length, 100);
  assert.deepEqual(
    [...validExport.reviews].map((review) => review.contentid),
    [...dataset.items].map((item) => item.contentid),
  );

  const text = JSON.stringify(validExport, null, 2);
  const imported = model.parseImportText(text, byteLength(text), dataset);
  assert.equal(imported.ok, true);
  assert.equal(imported.errors.length, 0);
  assert.equal(JSON.stringify(imported.bundle), JSON.stringify(validExport));
  assert.equal(model.validateBundle(imported.bundle, dataset).ok, true);
  assert.deepEqual(
    [...imported.bundle.reviews].map((review) => review.status),
    [...validExport.reviews].map((review) => review.status),
  );
});

test("invalid imports are rejected atomically", () => {
  const current = makeRoundTripBundle();
  const currentBefore = JSON.stringify(current);
  const validText = JSON.stringify(validExport);

  const fixtures = [];
  const addFixture = (name, mutate) => {
    const fixture = model.clone(validExport);
    mutate(fixture);
    fixtures.push([name, JSON.stringify(fixture)]);
  };

  addFixture("unexported-draft", (fixture) => {
    fixture.session.exported_at = null;
  });

  addFixture("wrong-profile-hash", (fixture) => {
    fixture.base.profile_sha256 = "0".repeat(64);
  });
  addFixture("wrong-review-base-hash", (fixture) => {
    fixture.base.review_base_sha256 = "0".repeat(64);
  });
  addFixture("99-reviews", (fixture) => {
    fixture.reviews.pop();
  });
  addFixture("duplicate-contentid", (fixture) => {
    fixture.reviews[1].contentid = fixture.reviews[0].contentid;
  });
  addFixture("wrong-review-order", (fixture) => {
    [fixture.reviews[0], fixture.reviews[1]] = [fixture.reviews[1], fixture.reviews[0]];
  });
  addFixture("numeric-string-label", (fixture) => {
    fixture.reviews[1].overrides.companion_fit.solo.to = "0.75";
  });
  addFixture("unknown-label-key", (fixture) => {
    fixture.reviews[1].overrides.companion_fit.unknown = { from: 0.5, to: 0.75 };
  });
  addFixture("festival-na-override", (fixture) => {
    const festivalIndex = dataset.items.findIndex((item) => item.source_place.contenttypeid === "15");
    fixture.reviews[festivalIndex].status = "in_progress";
    fixture.reviews[festivalIndex].started_at = TIMESTAMPS.edited;
    fixture.reviews[festivalIndex].updated_at = TIMESTAMPS.edited;
    fixture.reviews[festivalIndex].overrides.month_fit["1"] = { from: null, to: 0.5 };
  });
  addFixture("invalid-status", (fixture) => {
    fixture.reviews[0].status = "done";
  });
  addFixture("overlong-comment", (fixture) => {
    fixture.reviews[0].comment = "x".repeat(model.MAX_COMMENT_LENGTH + 1);
  });
  addFixture("unknown-top-level-key", (fixture) => {
    fixture.unknown = true;
  });

  for (const [name, text] of fixtures) {
    const parsed = model.parseImportText(text, byteLength(text), dataset);
    assert.equal(parsed.ok, false, `${name} must be rejected`);
    const selected = parsed.ok ? parsed.bundle : current;
    assert.strictEqual(selected, current, `${name} must not replace the current object`);
    assert.equal(JSON.stringify(current), currentBefore, `${name} must not mutate current state`);
    invalidImports.push(name);
  }

  expectImportRejected("oversize-file", validText, model.MAX_IMPORT_BYTES + 1);
  expectImportRejected("damaged-json", "{not valid json", byteLength("{not valid json"));
  assert.equal(JSON.stringify(current), currentBefore, "all failed imports must leave the current object unchanged");
});

test("memory storage saves, restores, and falls back safely", () => {
  const bundle = makeRoundTripBundle();
  const bundleBefore = JSON.stringify(bundle);
  const key = model.createStorageKey(dataset);
  assert.equal(key, `trip-ai:place-profile-review:v2:${dataset.review_base_sha256}`);
  const changedReviewBase = { ...dataset, review_base_sha256: "0".repeat(64) };
  assert.notEqual(model.createStorageKey(changedReviewBase), key, "proposal or climate changes must isolate browser storage");

  const storage = new MemoryStorage();
  const empty = model.loadBundle(storage, key, dataset);
  assert.equal(empty.ok, true);
  assert.equal(empty.bundle, null);
  assert.equal(empty.reason, "empty");

  const saved = model.saveBundle(storage, key, bundle, dataset);
  assert.equal(saved.ok, true);
  const loaded = model.loadBundle(storage, key, dataset);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.reason, "loaded");
  assert.equal(JSON.stringify(loaded.bundle), JSON.stringify(bundle));
  assert.equal(JSON.stringify(bundle), bundleBefore, "storage round-trip must not mutate the live object");

  storage.setItem(key, "{broken");
  const damaged = model.loadBundle(storage, key, dataset);
  assert.equal(damaged.ok, false);
  assert.equal(damaged.bundle, null);

  const saveFailure = model.saveBundle({
    setItem() {
      throw new Error("quota exceeded");
    },
  }, key, bundle, dataset);
  assert.equal(saveFailure.ok, false);
  assert.equal(JSON.stringify(bundle), bundleBefore, "storage write errors must leave memory state intact");

  const loadFailure = model.loadBundle({
    getItem() {
      throw new Error("storage disabled");
    },
  }, key, dataset);
  assert.equal(loadFailure.ok, false);
  assert.equal(loadFailure.bundle, null);
});

const filterSummary = {};
test("initial filters, null counts, and search match the embedded data", () => {
  const bundle = newBundle("filter-session");
  const typeCounts = Object.fromEntries(["12", "14", "15", "28"].map((type) => [
    type,
    model.filterItems(dataset, bundle, defaultFilters({ type })).length,
  ]));
  assert.deepEqual(typeCounts, { "12": 68, "14": 12, "15": 4, "28": 16 });

  const navigationBundle = newBundle("filtered-navigation-session");
  const festivals = model.filterItems(dataset, navigationBundle, defaultFilters({ type: "15" }));
  model.completeReview(navigationBundle, festivals[0].contentid, TIMESTAMPS.completed);
  const nextFestivalId = model.nextVisibleOpenId(
    dataset,
    navigationBundle,
    defaultFilters({ type: "15" }),
    festivals[0].contentid,
  );
  assert.notEqual(nextFestivalId, festivals[0].contentid);
  assert.equal(dataset.items.find((item) => item.contentid === nextFestivalId)?.source_place.contenttypeid, "15");
  assert.equal(
    model.nextVisibleOpenId(dataset, navigationBundle, defaultFilters({ query: "__no_matching_place__" }), festivals[0].contentid),
    null,
  );

  const companionNull = model.filterItems(dataset, bundle, defaultFilters({ companion_null: true })).length;
  const monthNull = model.filterItems(dataset, bundle, defaultFilters({ month_null: true })).length;
  const noSource = model.filterItems(dataset, bundle, defaultFilters({ no_source: true })).length;
  const priorityCounts = Object.fromEntries(["low", "medium", "high"].map((priority) => [
    priority,
    model.filterItems(dataset, bundle, defaultFilters({ priority })).length,
  ]));
  assert.equal(companionNull, dataset.stats.companion_null_places);
  assert.equal(monthNull, dataset.stats.month_null_places);
  assert.equal(noSource, 100 - dataset.stats.profiles_with_direct_sources);
  assert.equal(noSource, 0, "every v2 place must expose at least one opened detail source");
  jsonEqual(priorityCounts, dataset.stats.by_review_priority);
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ changed: true })).length, 0);

  const uniqueIdItem = dataset.items.find((item) => {
    const results = model.filterItems(dataset, bundle, defaultFilters({ query: item.contentid }));
    return results.length === 1 && results[0].contentid === item.contentid;
  });
  assert.ok(uniqueIdItem, "at least one contentid must have a unique search result");
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ query: `  ${uniqueIdItem.contentid}  ` })).length, 1);

  const uniqueTitleItem = dataset.items.find((item) => {
    const results = model.filterItems(dataset, bundle, defaultFilters({ query: item.title }));
    return results.length === 1 && results[0].contentid === item.contentid;
  });
  assert.ok(uniqueTitleItem, "at least one title must have a unique search result");
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ query: uniqueTitleItem.title })).length, 1);

  const wrongType = ["12", "14", "15", "28"].find((type) => type !== uniqueIdItem.source_place.contenttypeid);
  assert.equal(
    model.filterItems(dataset, bundle, defaultFilters({ query: uniqueIdItem.contentid, type: wrongType })).length,
    0,
    "query and type filters must combine with AND semantics",
  );

  const replacement = alternativeNumericValue(uniqueIdItem.companion_fit.solo);
  model.setOverride(bundle, dataset, uniqueIdItem.contentid, "companion_fit", "solo", replacement, TIMESTAMPS.edited);
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ changed: true })).length, 1);
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ status: "in_progress" })).length, 1);
  model.completeReview(bundle, uniqueIdItem.contentid, TIMESTAMPS.completed);
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ status: "approved" })).length, 1);
  assert.equal(model.filterItems(dataset, bundle, defaultFilters({ status: "approved_with_changes" })).length, 1);

  Object.assign(filterSummary, {
    type_counts: typeCounts,
    companion_null_places: companionNull,
    month_null_places: monthNull,
    no_source_places: noSource,
    priority_counts: priorityCounts,
    search_by_id: true,
    search_by_title: true,
  });
});

test("external URL policy rejects active and local schemes", () => {
  assert.equal(model.safeExternalUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(model.safeExternalUrl("http://example.com/path"), "http://example.com/path");
  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "not a url",
    "",
  ]) {
    assert.equal(model.safeExternalUrl(unsafe), null, `${unsafe} must be rejected`);
  }
});

console.log(JSON.stringify({
  ok: true,
  suite: "labeling-review-model",
  passed_groups: passed.length,
  groups: passed,
  dataset: {
    places: dataset.items.length,
    profile_sha256: dataset.profile_sha256,
    initial_progress: "0/100",
    filters: filterSummary,
  },
  invalid_imports_rejected: invalidImports,
  storage: {
    memory_roundtrip: true,
    damaged_json_fallback: true,
    exception_fallback: true,
  },
}, null, 2));
