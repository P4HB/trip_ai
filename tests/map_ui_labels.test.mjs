import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "..");
const builderPath = path.join(workspaceRoot, "scripts", "build_map_ui_data.mjs");
const labelBundlePath = path.join(workspaceRoot, "map-ui", "data", "jeju-place-labels.js");
const placeBundlePath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
const sourceLabelPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "place-preference-label-v2",
  "place_labels.jsonl",
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function build() {
  execFileSync(process.execPath, [builderPath], { cwd: workspaceRoot, stdio: "pipe" });
}

function loadLabelBundle() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(labelBundlePath, "utf8"), context, {
    filename: labelBundlePath,
  });
  return {
    metadata: context.window.JEJU_LABEL_META,
    labels: context.window.JEJU_PLACE_LABELS,
  };
}

function loadPlaceBundle() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(placeBundlePath, "utf8"), context, {
    filename: placeBundlePath,
  });
  return context.window.JEJU_PLACES;
}

test("map label bundle is deterministic and contains 1,664 complete vectors", () => {
  build();
  const firstHash = sha256(labelBundlePath);
  build();
  const secondHash = sha256(labelBundlePath);
  assert.equal(secondHash, firstHash);

  const { metadata, labels } = loadLabelBundle();
  assert.equal(metadata.available, true);
  assert.equal(metadata.sourceDate, "2026-08-09");
  assert.equal(metadata.labelVersion, "place-preference-label-v2");
  assert.equal(metadata.paths.length, 24);
  assert.equal(new Set(metadata.paths).size, 24);
  assert.deepEqual(Array.from(metadata.scoreScale), [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(metadata.labeledPlaces, 1664);
  assert.equal(Object.keys(labels).length, 1664);

  const allowed = new Set(metadata.scoreScale);
  for (const [contentid, values] of Object.entries(labels)) {
    assert.ok(contentid);
    assert.equal(values.length, 24, contentid);
    assert.ok(values.every((value) => allowed.has(value)), contentid);
  }
});

test("compact map labels preserve every source value in fixed path order", () => {
  const { metadata, labels } = loadLabelBundle();
  const records = fs
    .readFileSync(sourceLabelPath, "utf8")
    .trimEnd()
    .split(/\r?\n/)
    .map(JSON.parse);
  assert.equal(records.length, 1664);

  for (const record of records) {
    const expected = Array.from(metadata.paths, (labelPath) => {
      const [group, label] = labelPath.split(".");
      return record[group][label].value;
    });
    assert.deepEqual(Array.from(labels[record.contentid]), expected, record.contentid);
  }
});

test("1,663 visible places have labels and 490 out-of-scope restaurants do not", () => {
  const { labels } = loadLabelBundle();
  const places = loadPlaceBundle();
  const labeledVisible = places.filter((place) => Object.hasOwn(labels, place.id));
  const unlabeled = places.filter((place) => !Object.hasOwn(labels, place.id));
  assert.equal(places.length, 2153);
  assert.equal(labeledVisible.length, 1663);
  assert.equal(unlabeled.length, 490);
  assert.ok(unlabeled.every((place) => place.type === "39"));
});

test("reviewed environment decisions are present in the map bundle", () => {
  const { metadata, labels } = loadLabelBundle();
  const indoorIndex = metadata.paths.indexOf("environment.indoor_ratio");
  const weatherIndex = metadata.paths.indexOf("environment.weather_sensitivity");
  assert.equal(labels["2767778"][indoorIndex], 0);
  assert.equal(labels["2798882"][weatherIndex], 1);
  assert.equal(labels["4026831"][indoorIndex], 0.5);
  assert.equal(labels["4026831"][weatherIndex], 0.5);
});

test("map HTML loads labels before the app and exposes label detail regions", () => {
  const html = fs.readFileSync(path.join(workspaceRoot, "map-ui", "index.html"), "utf8");
  const placesIndex = html.indexOf("./data/jeju-places.js");
  const labelsIndex = html.indexOf("./data/jeju-place-labels.js");
  const appIndex = html.indexOf("./app.js");
  assert.ok(placesIndex >= 0 && labelsIndex > placesIndex && appIndex > labelsIndex);
  assert.match(html, /id="detailLabelGroups"/);
  assert.match(html, /id="labelTooltip"[^>]*role="tooltip"/);
});
