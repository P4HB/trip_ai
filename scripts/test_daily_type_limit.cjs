"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const C = require("../map-ui/ccu-mmr.js");

function place(id, primaryType, lng = 126.5) {
  return { id, title: id, primaryType, type: "12", region: "jeju_city", lng, lat: 33.4,
    sourceOrder: Number(id), recommendationReady: true,
    atomicFeatures: Object.fromEntries(C.ATOMIC_FEATURES.map(k => [k, .8])),
    companionScores: { friends: .8 }, monthScores: { 9: .8 } };
}
const fixture = [place("1", "garden"), place("2", "garden"), place("3", "cafe"), place("4", "cafe"), place("5", "forest"), place("6", "unknown"), place("7", undefined)];
function run(places, extra = {}) {
  return C.rank(places, { intent: "visit", transportMode: "car",
    travelWindow: { startDate: "2026-09-15", endDate: "2026-09-16" },
    preferences: [{ feature: "restfulness", mode: "benefit", weight: 2 }], ...extra }, { variantId: "seed-rank-1" });
}
function check(schedule) {
  assert.equal(schedule.dailyTypeLimit, 1);
  for (const day of schedule.dayClusters) {
    const types = day.places.map(p => p.primaryType);
    assert.equal(new Set(types).size, types.length);
    assert.ok(types.every(t => t && t !== "unknown"));
    assert.ok(day.usedCapacity <= schedule.dailyCapacity);
    assert.ok(day.maxCenterDistanceKm <= schedule.radiusKm + 1e-9);
  }
}
let r = run(fixture, { requiredPlaceIds: ["1", "2"] });
check(r.schedule);
assert.equal(r.schedule.status, "feasible");
assert.equal(r.schedule.dayClusters.length, 2);
assert.ok(r.schedule.dayClusters.every(d => d.places.filter(p => p.primaryType === "garden").length === 1));
assert.ok(r.schedule.dayClusters.every(d => d.usedCapacity < 6));
assert.equal(r.schedule.dayClusters.flatMap(d => d.placeIds).includes("6"), false);
r = run(fixture, { requiredPlaceIds: ["1", "2"], travelWindow: { startDate: "2026-09-15", endDate: "2026-09-15" } });
assert.equal(r.schedule.status, "infeasible");
check(r.schedule);
assert.deepEqual(r.schedule.dayClusters.flatMap(d => d.requiredPlaceIds).sort(), ["1", "2"]);
assert.throws(() => run(fixture, { requiredPlaceIds: ["6"] }), /대표 유형/);
assert.throws(() => run(fixture, { anchorPlaceIds: ["7"] }), /대표 유형/);
check(run(fixture, { diversity: "off", requiredPlaceIds: ["1"] }).schedule);
let anchored = run(fixture, { anchorPlaceIds: ["1"] }).schedule;
check(anchored);
assert.equal(anchored.dayClusters[0].places.filter(p => p.primaryType === "garden").length, 1);
const absent = run([place("1", "unknown"), place("2", undefined)]).schedule;
assert.equal(absent.dayClusters.length, 0);
assert.equal(absent.anchorCandidates.length, 0);
check(run(fixture).schedule); // Automatic anchor also occupies its type.

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync("map-ui/data/jeju-places.js", "utf8"), sandbox);
const sidecar = new Map(fs.readFileSync("data/labeling/jeju/2026-09-11/place-types-v1/place_types.jsonl", "utf8").trim().split(/\r?\n/).map(line => { const r = JSON.parse(line); return [r.place_id, r]; }));
const places = sandbox.window.JEJU_PLACES.map(p => {
  assert.equal(p.primaryType, sidecar.get(p.id).primary_type);
  return { ...p, recommendationReady: !!(p.v5 && p.fit),
    atomicFeatures: Object.fromEntries((p.v5?.labels || []).filter(r => !r.label.startsWith("derived")).map(r => [r.label.split(".").pop(), r.value])),
    companionScores: Object.fromEntries((p.fit?.companion || []).map(r => [r.key, r.value])),
    monthScores: Object.fromEntries((p.fit?.month || []).map(r => [r.key, r.value])) };
});
let scenarios = 0;
for (const feature of ["ocean", "mountain", "restfulness", "indoor_ratio"])
  for (const transportMode of ["car", "no_car"])
    for (const days of [1, 3])
      for (let seed = 1; seed <= 3; seed++) {
        const result = C.rank(places, { intent: "visit", transportMode, companionType: "friends", travelWindow: { startDate: "2026-09-15", endDate: `2026-09-${14 + days}` }, preferences: [{ feature, mode: "benefit", weight: 4 }] }, { variantId: `seed-rank-${seed}` });
        check(result.schedule);
        const ids = result.schedule.dayClusters.flatMap(d => d.placeIds);
        assert.equal(new Set(ids).size, ids.length);
        scenarios++;
      }
console.log(`PASS: daily type gates, required splits, infeasible preservation, anchors, unknown, diversity off; ${scenarios} real-data scenarios`);
