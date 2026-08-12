import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { buildReviewUiData, serializeReviewUiData, sha256Text } from "./lib/review_ui_data.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  let snapshotDate = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot-date") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--snapshot-date 값이 필요합니다.");
      snapshotDate = value;
      index += 1;
    } else if (argv[index] === "--help") {
      console.log("Usage: node scripts/validate_review_ui_data.mjs [--snapshot-date YYYY-MM-DD]");
      process.exit(0);
    } else {
      throw new Error(`지원하지 않는 인자입니다: ${argv[index]}`);
    }
  }
  if (snapshotDate && !/^\d{4}-\d{2}-\d{2}$/u.test(snapshotDate)) {
    throw new Error(`잘못된 snapshot date입니다: ${snapshotDate}`);
  }
  return snapshotDate;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const snapshotDate = parseArguments(process.argv.slice(2));
const data = buildReviewUiData({ workspaceRoot, snapshotDate });
const expected = serializeReviewUiData(data);
const generatedPath = path.join(workspaceRoot, "review-ui", "data", "review-data.js");
assert(fs.existsSync(generatedPath), `생성 번들이 없습니다: ${generatedPath}`);
const actual = fs.readFileSync(generatedPath, "utf8");
assert(actual === expected, "review-data.js가 현재 입력에서 재구성한 결과와 다릅니다.");

const keys = new Set();
let actionableRows = 0;
let pilotRows = 0;
for (const place of data.places) {
  assert(place.all_labels.length === 24, `${place.contentid}의 전체 라벨이 24개가 아닙니다.`);
  for (const item of place.queue_items) {
    assert(item.priority >= 1 && item.priority <= 3, `${item.review_key}에 비-actionable priority가 있습니다.`);
    assert(!keys.has(item.review_key), `review_key가 중복됩니다: ${item.review_key}`);
    keys.add(item.review_key);
    actionableRows += 1;
    if (place.pilot_review_sample) pilotRows += 1;
    const fullRecord = place.all_labels.find((record) => record.label === item.label);
    assert(fullRecord, `${item.review_key}의 전체 라벨 레코드가 없습니다.`);
    assert(Object.is(fullRecord.value, item.value), `${item.review_key}의 전체 라벨 값이 다릅니다.`);
  }
}

assert(actionableRows === data.queue_summary.actionable_rows, "actionable row 요약이 다릅니다.");
assert(pilotRows === data.queue_summary.pilot_actionable_rows, "파일럿 row 요약이 다릅니다.");
assert(
  data.queue_summary.total_rows ===
    data.queue_summary.actionable_rows + data.queue_summary.system_backlog_rows,
  "전체 큐 건수 분해가 맞지 않습니다.",
);

const html = fs.readFileSync(path.join(workspaceRoot, "review-ui", "index.html"), "utf8");
assert(html.includes("./data/v5-researched-data.js"), "index.html이 v5 생성 번들을 참조하지 않습니다.");
assert(html.includes("./app.js"), "index.html이 app.js를 참조하지 않습니다.");
for (const requiredId of ["placeSearch", "placeList", "labelGrid", "labelEvidence"]) {
  assert(html.includes(`id="${requiredId}"`), `index.html에 ${requiredId}가 없습니다.`);
}
for (const relativePath of ["review-ui/index.html", "review-ui/app.js"]) {
  const source = fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
  assert(!/\bfetch\s*\(/u.test(source), `${relativePath}에 fetch 호출이 있습니다.`);
}

const v5BundlePath = path.join(workspaceRoot, "review-ui", "data", "v5-researched-data.js");
assert(fs.existsSync(v5BundlePath), `v5 생성 번들이 없습니다: ${v5BundlePath}`);
const v5Source = fs.readFileSync(v5BundlePath, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(v5Source, sandbox, { filename: v5BundlePath });
const v5 = sandbox.window.JEJU_V5_RESEARCHED_DATA;
assert(v5?.schema_version === "place-preference-label-v5-researched-viewer-data-v1", "v5 번들 스키마가 다릅니다.");
assert(v5.place_count === 1664 && v5.places.length === 1664, "v5 장소 건수가 1,664가 아닙니다.");
const v5Ids = new Set();
for (const place of v5.places) {
  assert(!v5Ids.has(place.contentid), `v5 contentid 중복: ${place.contentid}`);
  v5Ids.add(place.contentid);
  assert(place.labels.length === 24, `${place.contentid}의 v5 라벨 수가 24가 아닙니다.`);
  assert(place.sources.length >= 1, `${place.contentid}에 v5 출처가 없습니다.`);
  for (const label of place.labels) {
    assert([0, 0.25, 0.5, 0.75, 1].includes(label.value), `${place.contentid} ${label.label}의 허용되지 않은 점수`);
  }
}
const nexon = v5.places.find((place) => place.contentid === "2472824");
assert(nexon?.labels.length === 24 && nexon.sources.length === 2, "넥슨컴퓨터박물관 v5 뷰어 데이터가 불완전합니다.");

console.log(
  JSON.stringify(
    {
      valid: true,
      snapshot_date: data.snapshot_date,
      actionable_rows: actionableRows,
      actionable_places: data.places.length,
      system_backlog_rows: data.queue_summary.system_backlog_rows,
      pilot_rows: pilotRows,
      output_bytes: Buffer.byteLength(actual),
      output_sha256: sha256Text(actual),
      v5_places: v5.places.length,
      v5_output_bytes: Buffer.byteLength(v5Source),
    },
    null,
    2,
  ),
);
