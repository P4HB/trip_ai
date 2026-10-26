"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { gunzipSync } = require("node:zlib");
const { createHash } = require("node:crypto");
const Itinerary = require("../map-ui/itinerary.js");
const Domain = require("../map-ui/domain.js");
const root = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "map-ui/data/jeju-places.js"), "utf8"), sandbox);
const meta = sandbox.window.JEJU_DATA_META;
const evidenceBytes = gunzipSync(fs.readFileSync(path.join(root, meta.evidencePath)));
assert.equal(createHash("sha256").update(evidenceBytes).digest("hex"), meta.evidenceHash);
const evidence = JSON.parse(evidenceBytes);
let ready = 0;
for (const place of sandbox.window.JEJU_PLACES) {
  if (!place.v5 || !place.fit) continue;
  ready++;
  const full = evidence.places[place.id];
  assert.equal(place.v5.labels.length, 24);
  for (const axis of place.v5.labels) {
    assert.equal(axis.value, full.v5.labels.find(row => row.label === axis.label).value);
    assert.deepEqual(Object.keys(axis).sort(), ["label", "value"]);
  }
  for (const group of ["companion", "month"]) for (const axis of place.fit[group]) {
    const original = full.fit[group].find(row => row.key === axis.key);
    assert.equal(axis.state, original.state);
    assert.equal(axis.value, original.value);
  }
  assert.ok(full.v5.sources.length);
  assert.ok(full.v5.labels.every(axis => "rationale" in axis && "confidence" in axis));
}
assert.equal(ready, 1663);
assert.equal(Itinerary.PREFERENCE_FEATURES, Domain.ATOMIC_FEATURES);

const day = {legs:[{fromId:"A",toId:"B",durationMinutes:7,departureTime:"10:40",arrivalTime:"10:47"}],
  mealSlots:[{slotId:"lunch",beforeLocation:{placeId:"A",title:"앞 장소"},afterLocation:{placeId:"B",title:"뒤 장소"}}]};
const selection = {restaurantId:"kakao:1",title:"선택 식당",candidate:{insertion:{basis:"distance_estimate",
  departPrevious:"11:55",arrival:"12:00",mealEnd:"13:00",nextArrival:"13:05",toRestaurantMinutes:5,fromRestaurantMinutes:5}}};
const original = JSON.stringify(day);
const selected = Itinerary.selectedMealRoutes(day,new Map([["lunch",selection]]));
assert.deepEqual(selected.legs.map(leg => [leg.fromId,leg.toId,leg.departureTime,leg.arrivalTime]),
  [["A","kakao:1","11:55","12:00"],["kakao:1","B","13:00","13:05"]]);
assert.equal(JSON.stringify(day),original,"selection never rewrites the provider proposal");
assert.deepEqual(Itinerary.selectedMealRoutes(day,new Map()).legs,day.legs,"unselect restores original leg");
const doubleMeal={...day,mealSlots:[...day.mealSlots,{...day.mealSlots[0],slotId:"dinner"}]};
const conflict=Itinerary.selectedMealRoutes(doubleMeal,new Map([["lunch",selection],["dinner",selection]]));
assert.equal(conflict.legs.length,0,"cannot assert independent insertions in the same gap as one route");
assert.equal(conflict.warnings.length,1);
console.log("PASS: compact bundle preserves 41-axis values/full evidence; shared vocabulary; selected meal replaces old direct legs and detects conflicting insertions");
