"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Itinerary = require("../map-ui/itinerary.js");

function recommendation() {
  return { request: { travelWindow: { startDate: "2026-10-01", endDate: "2026-10-01" }, transportMode: "car", excludedPlaceIds: ["x"], preferences: [{ private: "PRIVATE_MBTI" }], participantName: "PRIVATE_NAME" },
    items: [{ placeId: "top-only" }], courseVariant: { variantId: "variant-1" }, schedule: { status: "complete", dayClusters: [{ dayIndex: 1, date: "2026-10-01", placeIds: ["required", "anchor", "outside-top"], requiredPlaceIds: ["required"], anchorPlaceId: "anchor" }] } };
}
function options() {
  return { requestId: "request-1", recommendationRevision: "1", days: [{ dayIndex: 1, startLocation: { placeId: "airport" }, endLocation: { placeId: "hotel" }, startTime: "09:00", endTime: "20:00" }], mealPreferences: Itinerary.DEFAULT_MEALS };
}
function response(payload, extra = {}) {
  return { status: "verification_required", requestId: payload.requestId, recommendationRevision: payload.recommendationRevision,
    days: payload.days.map(day => ({ dayIndex: day.dayIndex, date: day.date, status: "verification_required", stops: [], legs: [], mealSlots: [], violations: [], unknowns: [], assumptions: [] })), ...extra };
}
async function unitTests() {
  const result = recommendation(), snapshot = JSON.stringify(result);
  const request = Itinerary.buildRequest(result, options());
  assert.deepEqual(request.days[0].placeIds, ["required", "anchor", "outside-top"]);
  assert.equal(JSON.stringify(result), snapshot, "original recommendations remain immutable");
  assert.ok(!JSON.stringify(request).includes("PRIVATE_"));
  assert.equal(request.mealPreferences.maxDetourMinutes, 20);
  assert.deepEqual(request.days[0].mealModes, { lunch: "auto", dinner: "auto" });
  assert.equal(Itinerary.buildRequest(result, { ...options(), days: [{ ...options().days[0], mealModes: { lunch: "excluded" } }] }).days[0].mealModes.lunch, "excluded");
  assert.throws(() => Itinerary.buildRequest({ ...result, request: { tripDays: 1 } }, options()), /실제 출발일/u);
  assert.throws(() => Itinerary.buildRequest({ ...result, request: { ...result.request, travelWindow: { startDate: "2026-02-30", endDate: "2026-03-02" } } }, options()), /실제 출발일/u);
  assert.throws(() => Itinerary.buildRequest({ ...result, request: { ...result.request, travelWindow: { startDate: "2026-10-02", endDate: "2026-10-01" } } }, options()), /빠를/u);
  assert.throws(() => Itinerary.buildRequest({ ...result, request: { ...result.request, transportMode: "no_car" } }, options()), /자동차/u);
  assert.throws(() => Itinerary.buildRequest({ ...result, schedule: { ...result.schedule, dayClusters: [] } }, options()), /모든 날짜/u);
  assert.throws(() => Itinerary.buildRequest(result, { ...options(), days: [] }), /출발·종료 장소/u);
  assert.throws(() => Itinerary.buildRequest(result, { ...options(), mealPreferences: { ...Itinerary.DEFAULT_MEALS, lunch: { windowStart: "13:30", windowEnd: "14:00", durationMinutes: 60 } } }), /점심/u);
  const duplicated = { ...result, request: { ...result.request, travelWindow: { startDate: "2026-10-01", endDate: "2026-10-02" } },
    schedule: { ...result.schedule, dayClusters: [result.schedule.dayClusters[0], { ...result.schedule.dayClusters[0], dayIndex: 2, date: "2026-10-02" }] } };
  assert.throws(() => Itinerary.buildRequest(duplicated, { ...options(), days: [options().days[0], { ...options().days[0], dayIndex: 2 }] }), /중복/u);
  const queue = [];
  const client = Itinerary.createClient({ fetchImpl: (url, init) => new Promise(resolve => queue.push({ url, init, resolve })) });
  const first = client.generate(request);
  const next = { ...request, requestId: "request-2", recommendationRevision: "2" };
  const second = client.generate(next);
  assert.equal(queue[0].init.signal.aborted, true);
  queue[1].resolve({ ok: true, json: async () => response(JSON.parse(queue[1].init.body)) }); await second;
  queue[0].resolve({ ok: true, json: async () => response(JSON.parse(queue[0].init.body), { status: "validated" }) }); await first;
  assert.equal(client.getState().result.requestId, "request-2", "late previous response cannot replace current itinerary");
  const changed = client.generate(request); client.invalidate();
  queue[2].resolve({ ok: true, json: async () => response(JSON.parse(queue[2].init.body)) }); await changed;
  assert.equal(client.getState().status, "idle", "invalidated response discarded even if provider ignores abort");
  const mismatch = client.generate(request);
  queue[3].resolve({ ok: true, json: async () => response(next) }); await mismatch;
  assert.equal(client.getState().status, "error", "response identity enforced");
  const timeout = Itinerary.createClient({ timeoutMs: 1, fetchImpl: (_, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))) });
  await timeout.generate(request);
  assert.match(timeout.getState().error, /시간이 초과/u);
  const seven = { ...request, travelWindow: { startDate: "2026-10-01", endDate: "2026-10-07" },
    days: Array.from({ length: 7 }, (_, i) => ({ ...request.days[0], dayIndex: i + 1, date: `2026-10-0${i + 1}` })) };
  const posted = [], progress = [];
  const multiple = Itinerary.createClient({ onChange: state => { if (state.progress) progress.push([state.progress.completed, state.result?.days.length || 0]); },
    fetchImpl: async (_, init) => {
      const daily = JSON.parse(init.body); posted.push(daily);
      if (daily.days[0].dayIndex === 3) throw new Error("일시적인 연결 끊김");
      return { ok: true, json: async () => response(daily) };
    } });
  const multiResult = await multiple.generate(seven);
  assert.equal(posted.length, 7);
  assert.ok(posted.every(item => item.generationScope === "day" && item.days.length === 1));
  assert.deepEqual(progress, Array.from({ length: 7 }, (_, i) => [i, i]));
  assert.equal(multiResult.days[2].status, "unavailable");
  assert.equal(multiResult.days.filter(day => day.status === "verification_required").length, 6);
  assert.equal(multiResult.requestId, seven.requestId);
  assert.equal(multiResult.provenance.calls, null, "transport failures have unknown call cost, not zero");
  let cancellationCalls = 0;
  const cancelled = Itinerary.createClient({ onChange: state => { if (state.progress?.completed === 1) cancelled.invalidate(); },
    fetchImpl: async (_, init) => { cancellationCalls += 1; return { ok: true, json: async () => response(JSON.parse(init.body)) }; } });
  await cancelled.generate(seven);
  assert.equal(cancellationCalls, 1, "invalidation between days stops later calls");
  assert.equal(cancelled.getState().status, "idle");
  let limitedCalls = 0;
  const limited = Itinerary.createClient({ fetchImpl: async () => { limitedCalls += 1; return { ok: false, status: 429, json: async () => ({ message: "호출 한도" }) }; } });
  const limitedResult = await limited.generate(seven);
  assert.equal(limitedCalls, 1, "rate-limit response stops further day calls");
  assert.equal(limitedResult.days.length, 7, "every unattempted day has a visible failure reason");
  console.log("PASS: itinerary input/privacy gates, dayClusters beyond Top-N, immutable recommendation, reversed/stale responses, timeout");
}

const mapRoot = path.resolve(__dirname, "../map-ui");
const fixture = `window.ITINERARY_TEST = {
  setup(mode = 'exact') {
    clearRecommendation();
    const request = {destinationRegion:'jeju_all',intent:'visit',travelWindow:mode === 'duration' ? null : {startDate:'2026-10-01',endDate:mode === 'multi' ? '2026-10-03' : '2026-10-01'},tripDays: mode === 'duration' ? 1 : null, transportMode:mode === 'no_car' ? 'no_car' : 'car',requiredPlaceIds:[],companionType:'parents',preferences:[{feature:'ocean',mode:'benefit',weight:4}],resultCount:1,diversity:'balanced'};
    const result = algorithm.rank(places, request, {random:()=>0.65});
    dom.travelStartDate.value = '2026-10-01'; dom.travelEndDate.value = '2026-10-01';
    renderRecommendationOutput(result);
    return {ids: result.items.map(item=>item.placeId), dayIds:result.schedule.dayClusters[0]?.placeIds, labels:places.slice(0,2).map(itineraryPlaceLabel)};
  },
  select(id) { selectPlace(placeById.get(id)); },
  clear: () => clearRecommendation()
};`;
async function browserTests() {
  const { chromium } = require("playwright");
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(mapRoot, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(mapRoot + path.sep)) { res.writeHead(403).end(); return; }
    try {
      let body = fs.readFileSync(file);
      if (file === path.join(mapRoot, "app.js")) body = body.toString().replace("window.CCU_MMR_DASHBOARD = {", fixture + "\nwindow.CCU_MMR_DASHBOARD = {");
      res.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css" })[path.extname(file)] || "application/octet-stream" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.FEEDBACK_TEST_CHROMIUM ? { executablePath: process.env.FEEDBACK_TEST_CHROMIUM } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url.includes("/travel/api/feedback")) { const data = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, session_id: data.session_id, revision: data.revision } }); }
      else if (url.includes("/api/places/")) await route.fulfill({ json: { schema_version: "kakao-place-reviews-v1", total: 0, reviews: [] } });
      else if (!url.startsWith("http://127.0.0.1:")) await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
      else await route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.ITINERARY_TEST && window.CCU_MMR_DASHBOARD);
    await page.evaluate(() => {
      const original = window.fetch;
      window.ITINERARY_PENDING = [];
      window.fetch = (url, init) => String(url).includes("/api/itineraries") ? new Promise(resolve => window.ITINERARY_PENDING.push({payload:JSON.parse(init.body), signal:init.signal, resolve})) : original(url, init);
      window.resolveItinerary = (index, status = "verification_required") => {
        const pending = window.ITINERARY_PENDING[index], payload = pending.payload, day = payload.days[0];
        pending.resolve({ok: true, json: async () => ({status,requestId:payload.requestId,recommendationRevision:payload.recommendationRevision,days:[{dayIndex:day.dayIndex,date:day.date,status,stops:[{placeId:day.placeIds[0],title:"테스트 방문 장소",arrival:day.date+"T09:30:00+09:00",departure:day.date+"T11:00:00+09:00",dwellMinutes:90,dwellBasis:"temporary_default",bufferMinutes:10,operatingStatus:"unknown",evidenceReviewIds:["review-fixture-1"]}],mealSlots:[{kind:"lunch",start:day.date+"T12:00:00+09:00",end:day.date+"T13:00:00+09:00",durationMinutes:60,maxDetourMinutes:20,beforeLocation:{title:"앞 장소"},afterLocation:{title:"뒤 장소"}}],unscheduledPlaces:[{placeId:day.placeIds[1],reason:"시간 부족"}],unknowns:[{code:"operating_unknown",message:"운영시간 확인 필요"}],violations:[],legs:[],assumptions:[]}]})});
      };
    });
    await page.evaluate(() => ITINERARY_TEST.setup("duration"));
    assert.match(await page.locator("#itineraryGate").textContent(), /실제 출발일/u);
    assert.equal(await page.locator("#itineraryForm").isVisible(), false);
    await page.evaluate(() => CCU_MMR_DASHBOARD.generateItinerary());
    assert.equal(await page.evaluate(() => ITINERARY_PENDING.length), 0);
    await page.evaluate(() => ITINERARY_TEST.setup("no_car"));
    assert.match(await page.locator("#itineraryGate").textContent(), /자동차/u);
    const setup = await page.evaluate(() => ITINERARY_TEST.setup());
    assert.ok(setup.dayIds.some(id => !setup.ids.includes(id)), "real recommendation has day places outside Top-N");
    await page.getByLabel("1일차 출발 장소", { exact: true }).fill(setup.labels[0]);
    await page.getByLabel("1일차 종료 장소", { exact: true }).fill(setup.labels[1]);
    await page.locator("#participantName").fill("PRIVATE_NAME");
    const card = page.locator(`.recommendation-card[data-place-id="${setup.ids[0]}"]`);
    await card.locator('[data-score="4"]').click();
    await card.locator("textarea").fill("PRIVATE_FEEDBACK");
    await page.evaluate(id => ITINERARY_TEST.select(id), setup.ids[0]);
    const before = await page.evaluate(() => ({feedback:CCU_MMR_DASHBOARD.getRecommendationFeedback(),session:CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().sessionId,name:CCU_MMR_DASHBOARD.getParticipantName(),selected:CCU_MMR_DASHBOARD.getSelectedPlace().id,result:JSON.stringify(CCU_MMR_DASHBOARD.getResult())}));
    await page.locator("#generateItineraryButton").click();
    assert.equal(await page.locator("#generateItineraryButton").isDisabled(), true);
    const payload = await page.evaluate(() => ITINERARY_PENDING[0].payload);
    assert.deepEqual(payload.days[0].placeIds, setup.dayIds);
    assert.ok(!JSON.stringify(payload).includes("PRIVATE_"));
    await page.evaluate(() => resolveItinerary(0));
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getItinerary().status === "ready");
    assert.match(await page.locator("#itineraryResults").textContent(), /유형별 임시값/u);
    assert.match(await page.locator("#itineraryResults").textContent(), /review-fixture-1/u);
    assert.match(await page.locator("#itineraryResults").textContent(), /식당 미선정/u);
    assert.match(await page.locator("#itineraryResults").textContent(), /시간 부족/u);
    const after = await page.evaluate(() => ({feedback:CCU_MMR_DASHBOARD.getRecommendationFeedback(),session:CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().sessionId,name:CCU_MMR_DASHBOARD.getParticipantName(),selected:CCU_MMR_DASHBOARD.getSelectedPlace().id,result:JSON.stringify(CCU_MMR_DASHBOARD.getResult())}));
    assert.deepEqual(after, before, "response preserves feedback session/name/selected place and original recommendation");
    assert.ok(!JSON.stringify(await page.evaluate(() => CCU_MMR_DASHBOARD.buildFeedbackLog())).includes("mealPreferences"), "feedback log remains independent of itinerary inputs");
    await page.evaluate(() => { void CCU_MMR_DASHBOARD.generateItinerary(); });
    await page.getByLabel("1일차 종료 시각", { exact:true }).fill("21:00");
    assert.equal(await page.locator("#itineraryResults").textContent(), "");
    await page.evaluate(() => { void CCU_MMR_DASHBOARD.generateItinerary(); });
    await page.evaluate(() => resolveItinerary(2));
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getItinerary().status === "ready");
    const newestId = await page.evaluate(() => CCU_MMR_DASHBOARD.getItinerary().result.requestId);
    await page.evaluate(() => resolveItinerary(1, "validated"));
    assert.equal(await page.evaluate(() => CCU_MMR_DASHBOARD.getItinerary().result.requestId), newestId);
    await page.evaluate(() => { void CCU_MMR_DASHBOARD.generateItinerary(); });
    await page.evaluate(() => ITINERARY_PENDING[3].resolve({ok:false,json:async()=>({message:"경로 API 일시 중단"})}));
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getItinerary().status === "error");
    assert.equal(await page.evaluate(() => JSON.stringify(CCU_MMR_DASHBOARD.getResult())), before.result);
    assert.equal(await page.evaluate(() => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().sessionId), before.session);
    await page.evaluate(() => { void CCU_MMR_DASHBOARD.generateItinerary(); });
    await page.evaluate(() => resolveItinerary(4));
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getItinerary().status === "ready");
    await page.setViewportSize({width:390,height:844});
    await page.locator("#itinerarySection").scrollIntoViewIfNeeded();
    await page.screenshot({path:process.env.ITINERARY_TEST_SCREENSHOT || "/tmp/trip-ai-itinerary-mobile.png"});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { void CCU_MMR_DASHBOARD.generateItinerary(); });
    await page.locator("#travelStartDate").fill("2026-10-02");
    await page.evaluate(() => resolveItinerary(5));
    assert.equal(await page.evaluate(() => CCU_MMR_DASHBOARD.getItinerary().status), "idle");
    assert.equal(await page.locator("#itinerarySection").isVisible(), false);
    await page.evaluate(() => {
      const setup = ITINERARY_TEST.setup();
      const fields = document.querySelectorAll('[data-itinerary-field$="Location"]');
      fields.forEach((field, index) => { field.value = setup.labels[index]; field.dispatchEvent(new Event("input", {bubbles:true})); });
      void CCU_MMR_DASHBOARD.generateItinerary();
      ITINERARY_TEST.setup();
      resolveItinerary(6);
    });
    assert.equal(await page.evaluate(() => CCU_MMR_DASHBOARD.getItinerary().status), "idle", "new recommendation rejects old response");
    assert.equal(await page.locator("#itineraryResults").textContent(), "");
    const multiStart = await page.evaluate(() => {
      const setup = ITINERARY_TEST.setup("multi");
      document.querySelectorAll('[data-itinerary-field$="Location"]').forEach((field, index) => { field.value = setup.labels[index % 2]; });
      document.querySelector('[data-itinerary-field="meal_lunch"]').value = "excluded";
      const start = ITINERARY_PENDING.length;
      void CCU_MMR_DASHBOARD.generateItinerary();
      return start;
    });
    assert.equal(await page.evaluate(index => ITINERARY_PENDING[index].payload.days[0].mealModes.lunch, multiStart), "excluded");
    await page.evaluate(index => resolveItinerary(index), multiStart);
    await page.waitForFunction(index => ITINERARY_PENDING.length === index + 2, multiStart);
    assert.match(await page.locator("#itineraryStatus").textContent(), /1\/3일 처리/u);
    assert.equal(await page.locator(".itinerary-day-card").count(), 1, "completed day remains visible during next request");
    await page.evaluate(index => resolveItinerary(index, "generation_failed"), multiStart + 1);
    await page.waitForFunction(index => ITINERARY_PENDING.length === index + 3, multiStart);
    assert.equal(await page.locator(".itinerary-day-card").count(), 2);
    assert.equal(await page.locator(".itinerary-day-card").nth(1).locator(".itinerary-timeline").count(), 0, "failed proposal is hidden");
    await page.evaluate(index => resolveItinerary(index), multiStart + 2);
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getItinerary().status === "ready");
    assert.equal(await page.locator(".itinerary-day-card").count(), 3);
    assert.equal(await page.locator(".itinerary-timeline").count(), 2);
    assert.match(await page.locator("#itineraryStatus").textContent(), /찾지 못함/u);
    assert.deepEqual(errors, []);
    console.log("PASS: real browser dates/car gates, controls, pending/failed/reversed responses, feedback/name/selection survival, mobile layout and date invalidation");
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => { await unitTests(); if (!process.argv.includes("--unit-only")) await browserTests(); })().catch(error => { console.error(error); process.exitCode = 1; });
