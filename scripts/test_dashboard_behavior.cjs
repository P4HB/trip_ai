"use strict";
/*
 * SPEC-113 REQ-001: browser behavior contract for the map dashboard. These checks replace the former
 * source-text regexes of validate_ccu_mmr_dashboard.cjs with rendered DOM, computed styles and the
 * network calls the page actually makes, so moving code between modules does not break them.
 *
 *   node scripts/test_dashboard_behavior.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const MAP_ROOT = path.resolve(__dirname, "../map-ui");
const DESKTOP = { width: 1440, height: 1000 };
const TABLET = { width: 1024, height: 900 };
const MOBILE = { width: 390, height: 844 };
const REVIEWS = {
  schema_version: "kakao-place-reviews-v1",
  total: 1,
  collected_at: "2026-09-03T12:00:00+09:00",
  collection_limit_per_place: 5,
  kakao_places: [{ place_url: "https://place.map.kakao.com/1" }],
  reviews: [{ rating: 4, date: "2026.08.30", content: "fixture review text", tags: ["풍경"], likes: 2, place_url: "https://place.map.kakao.com/1" }],
};
const INTERNAL_TRACE = /ID \d|MMR|연결 출처|seed:|sim \d|활성 블록:|내부 추천 상세|장소 라벨|변동·제약 정보/u;

function startServer() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(MAP_ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(MAP_ROOT + path.sep)) { res.writeHead(403).end(); return; }
    try {
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }).end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function svg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#e7efed"/></svg>`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openDashboard(browser, baseUrl, viewport, { testHook = true } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: "trip_ai_probe", value: "1", url: baseUrl }]);
  const page = await context.newPage();
  const harness = {
    page, context, errors: [], apiRequests: [], posts: [], failed: [], documentHeaders: null, reviewHeaders: [],
    reviewMode: "ok", reviewDelayMs: 0, image: { width: 1600, height: 1200 }, imageDelays: new Map(),
  };
  page.on("pageerror", (error) => harness.errors.push(error.message));
  page.on("request", (request) => {
    if (["fetch", "xhr", "beacon", "eventsource", "websocket"].includes(request.resourceType())) harness.apiRequests.push(request);
  });
  page.on("requestfailed", (request) => harness.failed.push({ url: request.url(), error: request.failure()?.errorText || "" }));
  const origin = new URL(baseUrl).origin;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === "/travel/api/feedback") {
      const payload = request.postDataJSON();
      harness.posts.push({ payload, at: Date.now(), method: request.method(), headers: await request.allHeaders() });
      await route.fulfill({ json: { ok: true, session_id: payload.session_id, revision: payload.revision } });
    } else if (url.origin === origin && /^\/api\/places\/[^/]+\/reviews$/u.test(url.pathname)) {
      harness.reviewHeaders.push(await request.allHeaders());
      if (harness.reviewDelayMs) await sleep(harness.reviewDelayMs);
      // The broken variant differs only in its schema version, so only the contract check can reject it.
      const body = harness.reviewMode === "ok" ? REVIEWS : { ...REVIEWS, schema_version: "kakao-place-reviews-v0" };
      await route.fulfill({ json: body }).catch(() => {});
    } else if (url.origin !== origin) {
      const delay = harness.imageDelays.get(request.url()) || 0;
      const { width, height } = harness.image;
      if (delay) await sleep(delay);
      await route.fulfill({ contentType: "image/svg+xml", body: svg(width, height) }).catch(() => {});
    } else {
      if (request.resourceType() === "document") harness.documentHeaders = await request.allHeaders();
      await route.continue();
    }
  });
  if (testHook) await page.addInitScript(() => { window.__TRIP_AI_TEST__ = true; });
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.CCU_MMR_DASHBOARD);
  return harness;
}

// --- Page helpers -------------------------------------------------------------------------------

const dashboard = (page, expression) => page.evaluate(expression);

async function style(page, selector, property, pseudo = null) {
  return page.evaluate(([target, name, pseudoElement]) => {
    const element = document.querySelector(target);
    return element ? getComputedStyle(element, pseudoElement).getPropertyValue(name).trim() : null;
  }, [selector, property, pseudo]);
}

async function choose(page, target, value) {
  await page.locator(`[data-choice-target="${target}"][data-choice-value="${value}"]`).click();
}

async function visibleWizardSteps(page) {
  return page.locator("[data-wizard-step]").evaluateAll((sections) => sections.filter((section) => !section.hidden).map((section) => section.dataset.wizardStep));
}

async function requirementStatus(page, key) {
  return page.locator(`[data-requirement-status="${key}"]`).first().textContent();
}

async function completeTravelMbti(page, startSelector) {
  await page.locator(startSelector).click();
  const dialog = page.locator("#travelMbtiDialog");
  await dialog.waitFor({ state: "visible" });
  const both = dialog.locator(".mbti-both-actions .mbti-both-option");
  assert.equal(await both.count(), 2, "MBTI offers both-like and both-dislike answers");
  assert.ok((await both.nth(0).textContent()).includes("♡") && (await both.nth(0).textContent()).includes("둘 다 좋아요"), "both-like option");
  assert.ok((await both.nth(1).textContent()).includes("×") && (await both.nth(1).textContent()).includes("둘 다 마음에 안 들어요"), "both-dislike option");
  assert.equal(await both.nth(0).isVisible(), true, "four-way MBTI response layout is visible");
  for (let step = 0; step < 40; step += 1) {
    const apply = dialog.getByRole("button", { name: "이 취향 적용하기" });
    if (await apply.count()) {
      await apply.click();
      await dialog.waitFor({ state: "hidden" });
      return;
    }
    const option = dialog.locator(".mbti-option").first();
    if (await option.count()) { await option.click(); continue; }
    const card = dialog.locator(".mbti-place-card").first();
    if (await card.count()) { await card.click(); continue; }
    await sleep(20);
  }
  throw new Error("travel MBTI flow did not reach the apply step");
}

async function waitForPostsAfter(harness, since, count = 1, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const posts = harness.posts.filter((post) => post.at >= since);
    if (posts.length >= count) return posts;
    await sleep(25);
  }
  throw new Error(`expected ${count} feedback POST(s) within ${timeout}ms`);
}

function assertOnlyAllowedNetwork(harness, label) {
  for (const request of harness.apiRequests) {
    const url = new URL(request.url());
    const allowed = (request.method() === "POST" && url.pathname === "/travel/api/feedback")
      || (request.method() === "GET" && /^\/api\/places\/[^/]+\/reviews$/u.test(url.pathname) && url.search === "?limit=5&offset=0");
    assert.ok(allowed, `${label}: unexpected background request ${request.method()} ${url.pathname}${url.search}`);
  }
}

async function assertNoBrowserPersistence(page, label) {
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0], `${label}: no Web Storage`);
}

// --- Scenarios ----------------------------------------------------------------------------------

async function hookIsOptIn(browser, baseUrl) {
  const harness = await openDashboard(browser, baseUrl, DESKTOP, { testHook: false });
  const { page } = harness;
  assert.equal(await dashboard(page, () => typeof window.__TRIP_AI_INTERNALS__), "undefined", "internals stay hidden without the test flag");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null, "recommendation must not auto-run on initialize");
  assert.deepEqual(harness.errors, []);
  await harness.context.close();
}

async function desktopFlow(browser, baseUrl) {
  const harness = await openDashboard(browser, baseUrl, DESKTOP);
  const { page } = harness;
  const internals = (fn, arg) => page.evaluate(fn, arg);
  assert.ok(await dashboard(page, () => Boolean(window.__TRIP_AI_INTERNALS__)), "test flag exposes internals");
  const dashboardApi = await dashboard(page, () => Object.keys(CCU_MMR_DASHBOARD).filter((key) => typeof CCU_MMR_DASHBOARD[key] === "function"));
  for (const name of ["run", "reroll", "getResult", "getItinerary", "generateItinerary", "getSelectedPlace", "getSidebarCollapsed", "getMapPlaceIds",
    "getHighlightedScheduleDay", "getPreferenceProfile", "getRecommendationFeedback", "getParticipantName", "getFeedbackCompletion",
    "buildFeedbackLog", "getFeedbackAutoSaveState", "startTravelMbti"]) {
    assert.ok(dashboardApi.includes(name), `CCU_MMR_DASHBOARD.${name} inspection boundary`);
  }
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null, "no automatic recommendation");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getSidebarCollapsed()), false, "desktop sidebar starts expanded");
  assert.deepEqual(await visibleWizardSteps(page), ["1"], "desktop shows one wizard step");
  assert.equal(await page.locator("#wizardStepLabel").textContent(), "1 / 5 · 동행자");
  assert.equal(await page.locator("#runRecommendationButton").isVisible(), false);

  // Step validation keeps the user on the step and explains what is missing.
  await page.locator("#wizardNextButton").click();
  assert.match(await page.locator("#formError").textContent(), /함께 가는 사람/u);
  assert.deepEqual(await visibleWizardSteps(page), ["1"]);
  await choose(page, "companionType", "parents");
  assert.equal(await page.locator('[data-choice-target="companionType"][data-choice-value="parents"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#formError").isVisible(), false, "a new choice hides the stale validation alert");
  assert.equal(await style(page, '[data-choice-target="companionType"][aria-pressed="true"]', "content", "::after"), '""', "selected checkmark is decorative");
  await page.locator("#wizardNextButton").click();
  assert.deepEqual(await visibleWizardSteps(page), ["2"]);

  // Duration-only and exact dates are mutually exclusive.
  assert.equal((await style(page, ".duration-choice-grid", "grid-template-columns")).split(" ").length, 3, "three-column duration choices");
  await choose(page, "tripDurationDays", "3");
  assert.equal(await requirementStatus(page, "date"), "✓ 완료");
  await page.locator("#wizardNextButton").click();
  await choose(page, "destinationRegion", "jeju_all");
  await choose(page, "tripIntent", "event");
  await choose(page, "transportMode", "car");
  assert.equal(await page.locator("#dateEventRequirement").evaluate((element) => element.hidden), false, "event intent asks for real dates");
  await page.locator("#wizardNextButton").click();
  assert.deepEqual(await visibleWizardSteps(page), ["4"]);
  await page.locator("#wizardNextButton").click();
  assert.match(await page.locator("#formError").textContent(), /여행 MBTI 검사를 완료/u);
  await page.waitForFunction(() => document.activeElement?.id === "startTravelMbtiButton");

  await completeTravelMbti(page, "#startTravelMbtiButton");
  const profile = await dashboard(page, () => CCU_MMR_DASHBOARD.getPreferenceProfile());
  assert.ok(profile?.displaySummary?.archetypeId, "applied MBTI profile");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null, "applying MBTI waits for the final confirmation");
  assert.equal(await requirementStatus(page, "preference"), "✓ 완료");
  assert.equal(await page.locator("#travelMbtiApplied").isVisible(), true);

  await page.locator("#wizardNextButton").click();
  assert.deepEqual(await visibleWizardSteps(page), ["5"]);
  const dateItem = page.locator('#reviewSummary [data-requirement-key="date"]');
  assert.equal(await dateItem.locator("strong").textContent(), "축제 날짜 필요");
  assert.match(await dateItem.getAttribute("class"), /is-missing/u);
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "필수 조건 1개 확인하기");
  await page.locator("#runRecommendationButton").click();
  assert.deepEqual(await visibleWizardSteps(page), ["2"], "final submit revalidates every step");
  assert.match(await page.locator("#formError").textContent(), /축제·행사 추천은 실제 출발일/u);

  await page.locator("#travelStartDate").fill("2026-09-10");
  assert.equal(await page.locator('[data-choice-target="tripDurationDays"][aria-pressed="true"]').count(), 0, "exact dates clear duration mode");
  await page.locator("#travelEndDate").fill("2026-09-12");
  await page.locator("#wizardNextButton").click();
  await choose(page, "tripIntent", "visit");
  await page.locator("#wizardNextButton").click();
  await page.locator("#wizardNextButton").click();
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "추천 결과 아래에서 보기");
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="date"] strong').textContent(), "2026.09.10 → 2026.09.12");
  await page.locator("#runRecommendationButton").click();

  const result = await dashboard(page, () => CCU_MMR_DASHBOARD.getResult());
  assert.ok(result?.items?.length, "recommendation result");
  assert.equal(result.request.tripDays, null, "exact dates send no duration-only field");
  assert.deepEqual(result.request.preferences, await dashboard(page, () => TRAVEL_PREFERENCE.materializePreferences(CCU_MMR_DASHBOARD.getPreferenceProfile())),
    "recommendation preferences come only from the applied MBTI profile");
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "이 조건으로 다시 추천받기");

  // Beta cards hide internal traces and share one feedback component with the schedule.
  const cards = page.locator(".recommendation-card");
  assert.equal(await cards.count(), result.items.length);
  for (const card of await cards.all()) {
    assert.doesNotMatch(await card.innerText(), INTERNAL_TRACE, "recommendation card hides internal trace");
    assert.equal(await card.locator(".recommendation-detail-button").count(), 1, "explicit place detail button");
    assert.equal(await card.locator(".recommendation-feedback .recommendation-feedback-option").count(), 5, "five-point feedback");
    assert.equal(await card.locator(".recommendation-feedback textarea").getAttribute("maxlength"), "300");
  }
  const schedulePlaces = page.locator(".schedule-place-card");
  assert.ok(await schedulePlaces.count() > 0);
  assert.deepEqual([...new Set(await schedulePlaces.evaluateAll((items) => items.map((item) => item.tagName)))], ["ARTICLE"], "schedule place is a non-button container");
  assert.equal(await schedulePlaces.first().locator(".recommendation-feedback").count(), 1, "schedule place uses shared feedback");
  const sharedId = await page.evaluate(() => [...document.querySelectorAll(".schedule-place-card")].map((card) => card.dataset.placeId)
    .find((id) => document.querySelector(`.recommendation-card[data-place-id="${id}"]`)));
  assert.ok(sharedId, "a place appears in both the list and the schedule");
  const cardFeedback = page.locator(`.recommendation-card[data-place-id="${sharedId}"] .recommendation-feedback`);
  const scheduleFeedback = page.locator(`.schedule-place-card[data-place-id="${sharedId}"] .recommendation-feedback`);
  await cardFeedback.locator("textarea").fill("synchronized comment");
  assert.equal(await scheduleFeedback.locator("textarea").inputValue(), "synchronized comment", "same-place comments stay synchronized");
  await scheduleFeedback.locator('[data-score="4"]').click();
  assert.equal(await cardFeedback.locator('[data-score="4"]').getAttribute("aria-pressed"), "true", "same-place scores stay synchronized");
  await sleep(1000);
  assert.equal(harness.posts.length, 0, "blank participant blocks the first feedback transmission");

  // Autosave: immediate on score, debounced on comment, same-origin POST without credentials.
  await page.locator("#participantName").fill("behavior-test");
  const named = await waitForPostsAfter(harness, 0);
  const log = named.at(-1).payload;
  assert.equal(log.schema_version, "travel-recommendation-feedback-log-v3");
  assert.equal(log.participant_name, "behavior-test");
  assert.deepEqual(log.storage, { method: "server_autosave", endpoint: "/travel/api/feedback", server_transmitted: true, web_storage_used: false });
  assert.equal(log.session_id, (await dashboard(page, () => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState())).sessionId);
  assert.equal(named.at(-1).method, "POST");
  assert.ok(harness.documentHeaders?.cookie?.includes("trip_ai_probe"), "cookie probe reaches same-origin documents");
  assert.ok(named.every((post) => !post.headers.cookie), "feedback request omits credentials");
  await page.waitForFunction(() => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().status === "saved");
  let since = Date.now();
  await cardFeedback.locator('[data-score="5"]').click();
  const scored = await waitForPostsAfter(harness, since);
  // Lower/upper bounds around the 800ms comment debounce that page load cannot invert.
  assert.ok(scored[0].at - since < 800, "score selection saves without the comment debounce");
  await page.waitForFunction(() => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().status === "saved");
  since = Date.now();
  await cardFeedback.locator("textarea").fill("debounced comment");
  const commented = await waitForPostsAfter(harness, since);
  assert.ok(commented[0].at - since >= 700, "comment input is debounced");
  assert.equal(commented.at(-1).payload.feedback.entries.find((entry) => entry.place_id === sharedId).comment, "debounced comment");
  assert.ok(commented.at(-1).payload.revision > log.revision, "monotonic feedback revision");

  // Desktop opens the map detail instead of the mobile dialog.
  const placeWithImage = await internals(() => {
    const { placeById } = window.__TRIP_AI_INTERNALS__;
    return CCU_MMR_DASHBOARD.getResult().items.map((item) => placeById.get(item.placeId)).filter((place) => String(place.image || "").trim()).map((place) => ({ id: place.id, title: place.title, image: place.image }));
  });
  assert.ok(placeWithImage.length >= 2, "two recommended places with images");
  const [first, second] = placeWithImage;
  await page.locator(`.recommendation-card[data-place-id="${first.id}"] .recommendation-card-top`).click();
  assert.equal((await dashboard(page, () => CCU_MMR_DASHBOARD.getSelectedPlace()))?.id, first.id);
  assert.equal(await page.locator("#mobileRecommendationFeedbackDialog").isVisible(), false);
  assert.equal(await page.locator("#detailPanel").isVisible(), true);
  assert.equal(await page.locator("#detailTitle").textContent(), first.title);
  assert.doesNotMatch(await page.locator("#detailPanel").innerText(), /장소 라벨|변동·제약 정보|내부 추천 상세|활성 블록:/u, "detail hides internal labels and traces");
  assert.equal(await page.locator("#detailPanel .detail-score-trace, #detailLabels, #detailConstraintNote").count(), 0);
  assert.equal(await style(page, "#detailMobileFeedback", "display"), "none", "mobile detail feedback stays hidden on desktop");
  await page.locator("#detailReviews .review-card").waitFor();
  assert.match(await page.locator("#detailReviews").innerText(), /fixture review text/u, "same-origin review lookup renders reviews");

  // Detail image: preloaded, full-frame, large dialog with focus restoration.
  await page.locator("#detailImageButton").waitFor({ state: "visible" });
  assert.equal(await page.locator("#detailImage").getAttribute("src"), first.image.trim());
  assert.doesNotMatch(await page.locator("#detailMedia").getAttribute("class"), /is-low-resolution/u);
  assert.equal(await style(page, "#detailMedia", "aspect-ratio"), "4 / 3", "desktop image keeps a 4:3 frame");
  assert.equal(await style(page, "#detailMedia", "align-self"), "start");
  assert.equal(await style(page, "#detailImage", "object-fit"), "contain", "detail image stays fully visible");
  await page.locator("#detailImageButton").click();
  assert.equal(await page.locator("#placeImageDialog").isVisible(), true);
  assert.equal(await page.locator("#placeImageDialogTitle").textContent(), `${first.title} 사진`);
  await page.waitForFunction(() => document.activeElement?.id === "placeImageDialogCloseButton");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#placeImageDialog").isVisible(), false);
  await page.waitForFunction(() => document.activeElement?.id === "detailImageButton", null, { timeout: 2000 });

  // Low-resolution guard and stale-image protection.
  harness.image = { width: 40, height: 30 };
  harness.imageDelays.set(first.image.trim(), 0);
  await page.locator(`.recommendation-card[data-place-id="${second.id}"] .recommendation-card-top`).click();
  await page.waitForFunction((src) => document.querySelector("#detailImage")?.getAttribute("src") === src, second.image.trim());
  assert.match(await page.locator("#detailMedia").getAttribute("class"), /is-low-resolution/u, "low-resolution upscaling guard");
  harness.image = { width: 1600, height: 1200 };
  harness.reviewMode = "broken";
  const cacheBust = (url) => `${url}${url.includes("?") ? "&" : "?"}stale=${Date.now()}`;
  const [slowImage, fastImage] = [cacheBust(first.image.trim()), cacheBust(second.image.trim())];
  harness.imageDelays.set(slowImage, 700);
  await internals(([firstId, slow, secondId, fast]) => {
    const { placeById, selectPlace } = window.__TRIP_AI_INTERNALS__;
    selectPlace({ ...placeById.get(firstId), image: slow });
    selectPlace({ ...placeById.get(secondId), image: fast });
  }, [first.id, slowImage, second.id, fastImage]);
  await page.waitForFunction((src) => document.querySelector("#detailImage")?.getAttribute("src") === src, fastImage);
  await sleep(900);
  assert.equal(await page.locator("#detailImage").getAttribute("src"), fastImage, "stale detail image response is ignored");
  await page.locator("#detailReviews .review-card, #detailReviews .review-status.is-error").first().waitFor({ timeout: 5000 });
  assert.match(await page.locator("#detailReviews").innerText(), /후기를 불러오지 못했습니다/u, "review response contract is enforced");
  harness.reviewMode = "ok";

  // Input changes clear stale recommendation and feedback.
  await page.locator('#reviewSummary [data-requirement-key="companion"]').click();
  await choose(page, "companionType", "friends");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null, "changed input clears the recommendation");
  assert.deepEqual(await dashboard(page, () => CCU_MMR_DASHBOARD.getRecommendationFeedback()), {}, "new conditions clear feedback");
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "추천 결과 아래에서 보기", "dirty input does not claim the old result");
  assert.ok(harness.reviewHeaders.length && harness.reviewHeaders.every((headers) => !headers.cookie), "review lookup omits credentials");

  // Desktop sidebar collapse and the responsive boundary.
  const mapWidthBeforeCollapse = await page.evaluate(() => window.__TRIP_AI_INTERNALS__.state.map.getSize().x);
  await page.locator("#sidebarCollapseButton").click();
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getSidebarCollapsed()), true);
  assert.match(await page.locator("body").getAttribute("class"), /sidebar-collapsed/u);
  assert.equal(await page.locator("#sidebarExpandButton").isVisible(), true, "collapsed desktop shows the expand control");
  assert.equal(await page.locator("#sidebarCollapseButton").getAttribute("aria-expanded"), "false");
  await page.waitForFunction(() => /^0px /u.test(getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns), null, { timeout: 2000 })
    .catch(async () => assert.fail(`collapsed desktop grid gives the space to the map: ${await style(page, ".workspace", "grid-template-columns")}`));
  await page.waitForFunction(() => document.activeElement?.id === "sidebarExpandButton", null, { timeout: 2000 });
  // The app's last invalidateSize (240ms) can land shortly before the grid transition ends, so the final
  // Leaflet width may trail the container by a timing-dependent margin; without any resize it stays unchanged.
  await page.waitForFunction((before) => {
    const width = window.__TRIP_AI_INTERNALS__.state.map.getSize().x;
    return width > before + 300 && width >= 0.9 * document.getElementById("map").clientWidth;
  }, mapWidthBeforeCollapse, { timeout: 2000 })
    .catch(async () => assert.fail(`sidebar layout change refreshes the Leaflet map size: ${JSON.stringify(await page.evaluate(() => [window.__TRIP_AI_INTERNALS__.state.map.getSize().x, document.getElementById("map").clientWidth]))}`));
  await page.setViewportSize(TABLET);
  await page.waitForFunction(() => !document.body.classList.contains("sidebar-collapsed"));
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getSidebarCollapsed()), false, "responsive boundary clears desktop collapse");
  assert.equal(await style(page, "#sidebarCollapseButton", "display"), "none", "collapse controls stay out of tablet flows");
  assert.equal(await style(page, "#sidebarExpandButton", "display"), "none");
  await page.setViewportSize(DESKTOP);

  assertOnlyAllowedNetwork(harness, "desktop");
  await assertNoBrowserPersistence(page, "desktop");
  assert.deepEqual(harness.errors, []);
  await harness.context.close();
}

// Paths that cross module boundaries: anchor reruns, required places, selection markers and the full reset.
async function crossModuleFlows(browser, baseUrl) {
  const harness = await openDashboard(browser, baseUrl, DESKTOP);
  const { page } = harness;
  await page.evaluate(() => {
    const { dom, state } = window.__TRIP_AI_INTERNALS__;
    for (const [key, value] of Object.entries({ companionType: "parents", destinationRegion: "jeju_all", tripIntent: "visit", transportMode: "car",
      travelStartDate: "2026-09-10", travelEndDate: "2026-09-12" })) dom[key].value = value;
    const engine = window.TRAVEL_PREFERENCE;
    state.preferenceProfile = engine.estimateProfile(engine.QUESTIONS.map((question) => ({ questionId: question.id, optionId: question.options[0].id })));
  });
  for (let step = 1; step < 5; step += 1) await page.locator("#wizardNextButton").click();
  assert.deepEqual(await visibleWizardSteps(page), ["5"]);
  await page.locator(".output-options-section > summary").click();
  await page.locator("#diversityPreset").selectOption("off");
  await page.locator("#runRecommendationButton").click();
  const unanchored = await dashboard(page, () => CCU_MMR_DASHBOARD.getResult());
  assert.equal(unanchored.schedule.status, "needs_anchor_selection", "diversity off leaves days for manual centers");
  const sessionId = (await dashboard(page, () => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState())).sessionId;

  // Choosing and removing a day center reruns with the same course session.
  assert.equal(await page.locator("#anchorCandidatePanel").isVisible(), true);
  await page.locator(".anchor-candidate-button").first().click();
  const anchored = await dashboard(page, () => CCU_MMR_DASHBOARD.getResult());
  assert.equal(anchored.request.anchorPlaceIds.length, 1, "anchor candidate reruns with the chosen center");
  assert.ok(anchored.schedule.dayClusters.some((day) => day.centerType === "user_anchor"));
  assert.equal((await dashboard(page, () => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState())).sessionId, sessionId, "anchor rerun keeps the session");
  await page.locator(".remove-anchor-button").first().click();
  assert.deepEqual((await dashboard(page, () => CCU_MMR_DASHBOARD.getResult())).request.anchorPlaceIds, [], "removing the center reruns without it");

  // Selecting places moves the selected marker; Escape clears the selection.
  const [firstId, secondId] = anchored.items.slice(0, 2).map((item) => item.placeId);
  const selectedIcons = () => page.evaluate((ids) => ids.map((id) => window.__TRIP_AI_INTERNALS__.state.markerById.get(id)?.options.icon.options.className.includes("is-selected")), [firstId, secondId]);
  await page.locator(`.recommendation-card[data-place-id="${firstId}"] .recommendation-card-top`).click();
  assert.deepEqual(await selectedIcons(), [true, false]);
  await page.locator(`.recommendation-card[data-place-id="${secondId}"] .recommendation-card-top`).click();
  assert.deepEqual(await selectedIcons(), [false, true], "only the current place marker is selected");
  await page.keyboard.press("Escape");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getSelectedPlace()), null);
  assert.deepEqual(await selectedIcons(), [false, false], "clearing the selection resets its marker");

  // Adding a required place invalidates the result; removing it updates the picker.
  const requiredPlace = await page.evaluate(() => window.__TRIP_AI_INTERNALS__.places.find((place) => place.recommendationReady && ["12", "14"].includes(String(place.type))));
  await page.locator(".advanced-section:not(.output-options-section) > summary").click();
  await page.locator("#requiredPlaceSearch").fill(String(requiredPlace.id));
  await page.locator(`.required-place-result[data-place-id="${requiredPlace.id}"]`).click();
  assert.deepEqual(await page.evaluate(() => [...window.__TRIP_AI_INTERNALS__.state.requiredPlaceIds]), [String(requiredPlace.id)]);
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null, "required place change clears the result");
  assert.equal(await page.locator("#recommendationSummary").textContent(), "필수 장소가 바뀌었습니다. 추천을 다시 실행해 주세요.");
  await page.locator(".remove-required-place").click();
  assert.deepEqual(await page.evaluate(() => [...window.__TRIP_AI_INTERNALS__.state.requiredPlaceIds]), []);
  assert.equal(await page.locator("#requiredPlaceStatus").textContent(), "선택된 필수 장소가 없습니다.");

  // Reset clears the result, the applied MBTI profile and every choice.
  await page.locator("#runRecommendationButton").click();
  assert.ok(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()));
  await page.locator("#resetRecommendationButton").click();
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null);
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getPreferenceProfile()), null, "reset clears the MBTI profile");
  assert.deepEqual(await visibleWizardSteps(page), ["1"]);
  assert.equal(await page.locator("#recommendationSummary").textContent(), "여행 조건을 모두 고르면 여기에 추천 장소가 나타나요.");
  assert.equal(await page.locator('[data-choice-target][aria-pressed="true"]').count(), 0, "reset clears every choice");
  assert.equal(await page.locator("#diversityPreset").inputValue(), "balanced");
  assert.equal(await requirementStatus(page, "preference"), "선택 전");

  assertOnlyAllowedNetwork(harness, "cross-module");
  assert.deepEqual(harness.errors, []);
  await harness.context.close();
}

async function mobileFlow(browser, baseUrl) {
  const harness = await openDashboard(browser, baseUrl, MOBILE);
  const { page } = harness;
  assert.deepEqual(await visibleWizardSteps(page), ["1", "2", "3", "4", "5"], "mobile exposes every wizard section");
  assert.match(await page.locator("body").getAttribute("class"), /mobile-stacked-flow/u);
  assert.equal(await style(page, ".output-panel", "display"), "none", "mobile hides the empty output panel");
  assert.deepEqual([await style(page, ".sidebar", "order"), await style(page, ".output-panel", "order"), await style(page, ".map-shell", "order")], ["1", "2", "3"], "mobile input, result, map order");
  assert.equal(await style(page, "#detailMedia", "aspect-ratio"), "16 / 9", "mobile image uses a 16:9 frame");
  assert.equal(await style(page, "#detailMedia", "min-height"), "200px");

  // Pre-recommendation detail guidance.
  const nonRecommendedId = await page.evaluate(() => {
    const { places, selectPlace } = window.__TRIP_AI_INTERNALS__;
    const place = places.find((item) => item.recommendationReady && String(item.type) === "39") || places[0];
    selectPlace(place);
    return place.id;
  });
  assert.match(await page.locator("#detailMobileFeedback").innerText(), /여행 추천을 완료하면/u, "pre-recommendation guidance");
  assert.equal(await style(page, "#detailMobileFeedback", "display"), "block", "mobile detail feedback is visible on mobile");

  // Submitting with nothing selected marks every missing group.
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "필수 조건 6개 확인하기");
  await page.locator("#runRecommendationButton").click();
  for (const key of ["companion", "date", "region", "intent", "transport", "preference"]) {
    const group = page.locator(`[data-requirement-key="${key}"]:not(.review-summary-item)`);
    assert.match(await group.getAttribute("class"), /has-required-error/u, `${key}: inline required error`);
    assert.equal(await group.getAttribute("aria-invalid"), "true");
    assert.equal(await requirementStatus(page, key), "확인 필요");
    assert.match(await page.locator(`#reviewSummary [data-requirement-key="${key}"]`).getAttribute("class"), /is-missing/u);
  }
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="date"] strong').textContent(), "미선택", "unselected dates stay visibly unselected");
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="preference"] strong').textContent(), "MBTI 검사 필요");
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getResult()), null);

  await choose(page, "companionType", "couple");
  await page.locator("#dateUndecided").check();
  await choose(page, "tripIntent", "event");
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="date"] strong').textContent(), "축제 날짜 필요", "event rejects undecided dates");
  await choose(page, "tripIntent", "visit");
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="date"] strong').textContent(), "기간 미정");
  await choose(page, "tripDurationDays", "3");
  assert.equal(await page.locator("#dateUndecided").isChecked(), false, "duration choice replaces the undecided state");
  assert.equal(await page.locator('#reviewSummary [data-requirement-key="date"] strong').textContent(), "2박 3일");
  await choose(page, "destinationRegion", "jeju_all");
  await choose(page, "transportMode", "car");
  await completeTravelMbti(page, "#startTravelMbtiButton");
  assert.equal(await page.locator("#runRecommendationButton").textContent(), "추천 결과 아래에서 보기");
  await page.locator("#runRecommendationButton").click();
  const result = await dashboard(page, () => CCU_MMR_DASHBOARD.getResult());
  assert.ok(result?.items?.length, "mobile recommendation result");
  assert.equal(result.request.travelWindow, null);
  assert.equal(result.request.tripDays, 3, "duration-only request field");
  await page.waitForFunction(() => Math.abs(document.querySelector("#outputPanel").getBoundingClientRect().top) < 80, null, { timeout: 4000 });
  assert.equal(await style(page, ".output-heading", "position"), "relative", "mobile result heading scrolls in document flow");
  assert.equal(await style(page, ".recommendation-card > .recommendation-feedback", "display"), "none", "mobile cards defer feedback to the dialog");

  // Mobile detail distinguishes recommended and other places.
  await page.evaluate((id) => { const { placeById, selectPlace } = window.__TRIP_AI_INTERNALS__; selectPlace(placeById.get(String(id))); }, nonRecommendedId);
  assert.match(await page.locator("#detailMobileFeedback").innerText(), /이번 추천 결과에 포함된 장소만/u, "non-target place guidance");
  const recommendedId = result.items[0].placeId;
  await page.evaluate((id) => { const { placeById, selectPlace } = window.__TRIP_AI_INTERNALS__; selectPlace(placeById.get(id)); }, recommendedId);
  assert.equal(await page.locator("#detailMobileFeedback .recommendation-feedback").count(), 1, "recommended mobile detail uses shared feedback");
  assert.ok(parseFloat(await style(page, "#detailMobileFeedback .recommendation-feedback-option", "min-height")) >= 44, "touch-sized detail score targets");
  assert.equal(await style(page, "#detailMobileFeedback .recommendation-feedback-comment textarea", "font-size"), "16px", "detail comment avoids input zoom");
  // Completing a rating in the mobile detail closes the detail and returns to the results.
  await page.locator("#detailMobileFeedback [data-score=\"4\"]").click();
  await page.locator("#detailMobileFeedback .recommendation-feedback-complete").click();
  assert.equal(await dashboard(page, () => CCU_MMR_DASHBOARD.getSelectedPlace()), null, "mobile detail completion clears the selection");
  assert.equal(await page.locator("#detailPanel").isVisible(), false);
  assert.equal(await page.locator(`[data-feedback-badge-place-id="${recommendedId}"]`).first().textContent(), "✓ 평가 완료 · 4점");
  await page.waitForFunction(() => Math.abs(document.querySelector("#outputPanel").getBoundingClientRect().top) < 80, null, { timeout: 4000 });

  // Mobile card opens the feedback dialog with image, research and reviews.
  const dialogPlace = await page.evaluate(() => {
    const { placeById } = window.__TRIP_AI_INTERNALS__;
    return CCU_MMR_DASHBOARD.getResult().items.map((item) => placeById.get(item.placeId)).find((place) => String(place.image || "").trim());
  });
  assert.ok(dialogPlace, "a recommended place with an image");
  const reviewCountBefore = harness.apiRequests.length;
  await page.locator(`.recommendation-card[data-place-id="${dialogPlace.id}"] .recommendation-card-top`).click();
  const dialog = page.locator("#mobileRecommendationFeedbackDialog");
  assert.equal(await dialog.isVisible(), true);
  await page.locator("#mobileRecommendationFeedbackImage").waitFor({ state: "visible" });
  assert.equal(await page.locator("#mobileRecommendationFeedbackImage").getAttribute("src"), dialogPlace.image.trim(), "dialog renders the place image");
  assert.equal(await dialog.locator("#mobileRecommendationFeedbackMount .recommendation-feedback").count(), 1, "dialog reuses shared feedback");
  assert.equal(await page.locator("#mobileRecommendationFeedbackResearch").isVisible(), true, "dialog reuses the research renderer");
  await page.locator("#mobileRecommendationFeedbackReviews .review-card").waitFor();
  assert.ok(harness.apiRequests.slice(reviewCountBefore).some((request) => request.url().includes(`/api/places/${encodeURIComponent(dialogPlace.id)}/reviews`)), "dialog loads reviews");
  assert.ok(parseFloat(await style(page, "#mobileRecommendationFeedbackMount .recommendation-feedback-option", "min-height")) >= 48, "dialog score controls are touch sized");
  assert.equal(await style(page, "#mobileRecommendationFeedbackMount textarea", "font-size"), "16px");
  assert.equal(await style(page, "#mobileRecommendationFeedbackMedia", "aspect-ratio"), "16 / 9");
  assert.equal(await style(page, "#mobileRecommendationFeedbackImage", "object-fit"), "contain");
  assert.doesNotMatch(await dialog.innerText(), INTERNAL_TRACE, "dialog hides internal trace");
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false);

  // Closing the dialog aborts its in-flight review request.
  harness.reviewDelayMs = 800;
  const secondId = result.items[1].placeId;
  await page.locator(`.recommendation-card[data-place-id="${secondId}"] .recommendation-card-top`).click();
  await sleep(100);
  await page.locator("#mobileRecommendationFeedbackCloseButton").click();
  await sleep(1000);
  harness.reviewDelayMs = 0;
  assert.ok(harness.failed.some((item) => item.url.includes(`/api/places/${encodeURIComponent(secondId)}/reviews`)), "closing the dialog aborts its review request");

  assertOnlyAllowedNetwork(harness, "mobile");
  await assertNoBrowserPersistence(page, "mobile");
  assert.deepEqual(harness.errors, []);
  await harness.context.close();
}

(async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.FEEDBACK_TEST_CHROMIUM ? { executablePath: process.env.FEEDBACK_TEST_CHROMIUM } : {}) });
    await hookIsOptIn(browser, baseUrl);
    await desktopFlow(browser, baseUrl);
    await crossModuleFlows(browser, baseUrl);
    await mobileFlow(browser, baseUrl);
    console.log("PASS: dashboard behavior — opt-in test hook, wizard validation, MBTI apply, event dates, feedback sync/autosave, detail image/reviews, sidebar, anchors, required places, markers, reset, mobile flow, network/storage limits");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
