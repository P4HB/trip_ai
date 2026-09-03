const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../map-ui');
const fixture = `window.FEEDBACK_TEST = {
  setup() {
    clearRecommendation();
    const result = algorithm.rank(places, {
      destinationRegion: 'jeju_all', intent: 'visit',
      travelWindow: { startDate: '2026-09-10', endDate: '2026-09-12' },
      transportMode: 'car', requiredPlaceIds: [], companionType: 'parents',
      preferences: [{feature:'ocean',mode:'benefit',weight:4}], resultCount:10, diversity:'balanced'
    }, { random: () => 0.65 });
    renderRecommendationOutput(result);
    return result.items.map(item => item.placeId);
  },
  guard(id) { completeRecommendationFeedback(id, 'mobile-dialog'); },
  clear: () => clearRecommendation()
};`;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    let body = fs.readFileSync(file);
    if (file === path.join(root, 'app.js')) body = body.toString().replace('window.CCU_MMR_DASHBOARD = {', fixture + '\nwindow.CCU_MMR_DASHBOARD = {');
    const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png'};
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const options = { headless: true };
    if (process.env.FEEDBACK_TEST_CHROMIUM) options.executablePath = process.env.FEEDBACK_TEST_CHROMIUM;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const posts = [];
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('/travel/api/feedback')) {
        const payload = route.request().postDataJSON(); posts.push(payload);
        await route.fulfill({json: {ok:true, session_id:payload.session_id, revision:payload.revision}});
      } else if (url.includes('/travel/api/places/')) {
        await route.fulfill({json:{total:0,reviews:[]}});
      } else if (!url.startsWith('http://127.0.0.1:')) {
        await route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#e7efed"/></svg>'});
      } else await route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.FEEDBACK_TEST && window.CCU_MMR_DASHBOARD);
    const ids = await page.evaluate(() => FEEDBACK_TEST.setup());
    const id = ids[0];
    const card = page.locator(`.recommendation-card[data-place-id="${id}"]`);
    const badges = page.locator(`[data-feedback-badge-place-id="${id}"]`);
    const dialog = page.locator('#mobileRecommendationFeedbackDialog');
    const complete = dialog.locator('.recommendation-feedback-complete');
    const comment = dialog.locator('textarea');
    const score = n => dialog.locator(`[data-score="${n}"]`);
    assert.ok(await badges.count() >= 2, 'recommendation and itinerary share badge state');
    assert.ok((await badges.allTextContents()).every(text => text === '미평가'));
    await card.locator('.recommendation-card-top').click();
    const scrollY = await page.evaluate(() => scrollY);
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await complete.isVisible(), false);
    assert.equal(await dialog.getByText('점수와 의견은 같은 장소의 추천 결과에 바로 반영되고 이름·별칭과 함께 자동 저장됩니다.', {exact:true}).count(), 0);
    await comment.fill('의견만 먼저 입력');
    assert.equal(await complete.isVisible(), false);
    await page.evaluate(id => FEEDBACK_TEST.guard(id), id);
    assert.equal(await dialog.isVisible(), true, 'scoreless completion must be rejected');
    await comment.fill('');
    await score(4).click();
    assert.equal(await complete.isVisible(), true);
    assert.ok((await badges.allTextContents()).every(text => text === '4점 · 완료 전'));
    await complete.click();
    assert.equal(await dialog.isVisible(), false);
    assert.ok((await badges.allTextContents()).every(text => text === '✓ 평가 완료 · 4점'));
    await page.waitForFunction(() => !document.body.classList.contains('mobile-feedback-open'));
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollY) < 2, 'completion preserves result position');
    await card.locator('.recommendation-card-top').click();
    assert.equal(await score(4).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.ok((await badges.allTextContents()).every(text => text === '✓ 평가 완료 · 4점'));
    await card.locator('.recommendation-card-top').click();
    await comment.fill('다시 작성한 의견');
    assert.ok((await badges.allTextContents()).every(text => text === '4점 · 완료 전'));
    await score(5).click();
    await complete.click();
    assert.ok((await badges.allTextContents()).every(text => text === '✓ 평가 완료 · 5점'));
    assert.equal(posts.length, 0, 'unnamed participant remains pending');
    await page.locator('#participantName').fill('local-test');
    await page.waitForFunction(() => CCU_MMR_DASHBOARD.getFeedbackAutoSaveState().status === 'saved');
    assert.ok(posts.length > 0);
    assert.ok(posts.every(payload => payload.feedback.entries.every(entry => !('completed' in entry))), 'v3 schema unchanged');
    await page.setViewportSize({width:1440,height:1000});
    const desktopFeedback = card.locator('.recommendation-feedback');
    await desktopFeedback.locator('[data-score="3"]').click();
    assert.ok((await badges.allTextContents()).every(text => text === '3점 · 완료 전'));
    await desktopFeedback.locator('.recommendation-feedback-complete').click();
    assert.ok((await badges.allTextContents()).every(text => text === '✓ 평가 완료 · 3점'));
    await page.setViewportSize({width:390,height:844});
    await card.scrollIntoViewIfNeeded();
    const output = path.resolve(__dirname, '../artifacts/feedback-completion');
    fs.mkdirSync(output, {recursive:true});
    await page.screenshot({path:path.join(output, 'completed.png')});
    await card.locator('.recommendation-card-top').click();
    await page.screenshot({path:path.join(output, 'dialog.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => FEEDBACK_TEST.clear());
    assert.deepEqual(await page.evaluate(() => CCU_MMR_DASHBOARD.getRecommendationFeedback()), {});
    assert.equal(await dialog.isVisible(), false);
    await page.evaluate(() => FEEDBACK_TEST.setup());
    assert.ok((await page.locator('.recommendation-feedback-badge').allTextContents()).every(text => text === '미평가'));
    assert.deepEqual(errors, []);
    console.log('PASS: score required, optional comment, completion/return, shared badges, edit/reopen, autosave schema, desktop, reset, no overflow or page errors');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
