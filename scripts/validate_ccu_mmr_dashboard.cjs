"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const CCU = require("../map-ui/ccu-mmr.js");
const Preference = require("../map-ui/preference-elicitation.js");

const workspaceRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
const htmlPath = path.join(workspaceRoot, "map-ui", "index.html");
const appPath = path.join(workspaceRoot, "map-ui", "app.js");
const stylesPath = path.join(workspaceRoot, "map-ui", "styles.css");
const preferencePath = path.join(workspaceRoot, "map-ui", "preference-elicitation.js");
const dashboardHtml = fs.readFileSync(htmlPath, "utf8");
const dashboardApp = fs.readFileSync(appPath, "utf8");
const dashboardStyles = fs.readFileSync(stylesPath, "utf8");
const preferenceSource = fs.readFileSync(preferencePath, "utf8");
for (const id of [
  "headerTravelMbtiButton", "travelMbtiLaunch", "startTravelMbtiButton", "travelMbtiApplied", "restartTravelMbtiButton", "travelMbtiDialog",
  "travelMbtiProgressLabel", "travelMbtiProgressBar", "travelMbtiBody", "travelMbtiBackButton", "travelMbtiSkipButton",
  "detailPlaceId", "detailReviews", "detailMedia", "detailImageBackdrop", "detailImageButton", "detailImage", "detailMobileFeedback",
  "placeImageDialog", "placeImageDialogTitle", "placeImageDialogImage", "placeImageDialogCloseButton",
  "sidebarCollapseButton", "sidebarExpandButton",
  "participantNamePanel", "participantName", "participantNameStatus",
  "feedbackSavePanel", "feedbackCompletionStatus", "feedbackSaveHelp",
]) {
  assert.match(dashboardHtml, new RegExp(`id=["']${id}["']`, "u"), `${id}: travel MBTI DOM contract`);
}
assert.ok(dashboardHtml.indexOf("./preference-elicitation.js") < dashboardHtml.indexOf("./ccu-mmr.js"), "preference module must load before ranker");
assert.ok(dashboardHtml.indexOf("./ccu-mmr.js") < dashboardHtml.indexOf("./app.js"), "ranker must load before app");
assert.doesNotMatch(`${dashboardApp}\n${preferenceSource}`, /localStorage|sessionStorage|sendBeacon|XMLHttpRequest/u, "profile must not use browser persistence or background transport");
assert.equal([...dashboardApp.matchAll(/fetch\s*\(/gu)].length, 2, "only feedback autosave and review lookup may use fetch");
assert.doesNotMatch(preferenceSource, /fetch\s*\(/u, "preference engine remains network-free");
assert.equal(Preference.QUESTIONS.length, 18);
assert.equal(Object.keys(Preference.ARCHETYPES).length, 8);
assert.match(dashboardHtml, /검사하러 가기/u, "unapplied preference step only offers the MBTI entry point");
assert.doesNotMatch(dashboardHtml, /data-preset=|id="preferenceRows"|id="addPreferenceButton"|세부 취향을 직접 조정|취향 없이 골고루/u, "manual preference presets and rows are removed");
assert.doesNotMatch(dashboardHtml, /id="clearTravelMbtiButton"/u, "applied MBTI is replaced through retesting instead of a manual preference fallback");
assert.match(dashboardApp, /function createTravelMbtiBothChoices\(/u, "shared both-like and both-dislike controls");
assert.match(dashboardApp, /\["both_like", "♡", "둘 다 좋아요"/u, "both-like option");
assert.match(dashboardApp, /\["both_dislike", "×", "둘 다 마음에 안 들어요"/u, "both-dislike option");
assert.match(dashboardApp, /return preferenceEngine\.materializePreferences\(state\.preferenceProfile\)/u, "recommendation preferences come only from the applied MBTI profile");
assert.match(dashboardApp, /complete: Boolean\(state\.preferenceProfile && preferences\.length\)/u, "preference requirement needs an applied MBTI profile");
assert.match(dashboardApp, /focusWizardChoice\("#startTravelMbtiButton"\)/u, "missing preference returns to the MBTI entry point");
assert.doesNotMatch(dashboardApp, /PRESETS|syncPresetCards|renderPreferenceRows|addPreferenceRow|\[data-preset\]/u, "manual preference code path is removed");
assert.match(dashboardStyles, /\.mbti-both-actions/u, "four-way MBTI response layout");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(bundlePath, "utf8"), sandbox, { filename: bundlePath });

const places = sandbox.window.JEJU_PLACES;
const metadata = sandbox.window.JEJU_DATA_META;
assert.ok(Array.isArray(places));
assert.equal(places.length, 2153);
assert.equal(metadata.recommendationReadyCount, 1663);
assert.equal(metadata.recommendationUnscoredCount, 490);
assert.equal(metadata.v5ReviewSourceCount, 1664);
assert.equal(metadata.v5ReviewAttachedCount, 1663);
assert.equal(metadata.fitLabelSourceCount, 1664);
assert.equal(metadata.fitLabelAttachedCount, 1663);
assert.equal(metadata.researchSourceCount, 1664);
assert.equal(metadata.researchAttachedCount, 1663);
assert.equal(metadata.recommendationResearchReadyCount, 1663);
assert.equal(metadata.hardConstraintAttachedCount, 1517);
assert.equal(metadata.algorithmVersion, CCU.ALGORITHM_VERSION);

assert.equal((dashboardHtml.match(/data-wizard-step="[1-5]"/gu) || []).length, 5, "five wizard steps");
for (const id of [
  "wizardStepLabel", "wizardProgressBar", "wizardBackButton", "wizardNextButton", "dateUndecided", "dateEventRequirement", "reviewSummary",
  "companionType", "destinationRegion", "tripIntent", "transportMode", "runRecommendationButton",
  "requiredOverview", "requiredProgressText", "requiredProgressTrack", "requiredProgressBar", "requiredMissingText",
]) {
  assert.match(dashboardHtml, new RegExp(`id="${id}"`, "u"), `${id}: wizard control`);
}
for (const target of ["companionType", "destinationRegion", "tripIntent", "transportMode"]) {
  assert.match(dashboardHtml, new RegExp(`data-choice-target="${target}"`, "u"), `${target}: choice cards`);
}
assert.match(dashboardApp, /function validateWizardStep\(step\)/u, "wizard validation");
assert.match(dashboardApp, /function validateMobileWizardFlow\(\)/u, "mobile stacked flow validation");
assert.match(dashboardHtml, /id="sidebarCollapseButton"[\s\S]*?aria-controls="sidebar"[\s\S]*?aria-expanded="true"/u, "desktop sidebar collapse control");
assert.match(dashboardHtml, /id="sidebarExpandButton"[\s\S]*?aria-controls="sidebar"[\s\S]*?aria-expanded="false"/u, "desktop sidebar expand control");
assert.match(dashboardApp, /sidebarCollapsed: false/u, "desktop sidebar starts expanded");
assert.match(dashboardApp, /function setDesktopSidebarCollapsed\(collapsed, \{ focus = true \} = \{\}\)/u, "desktop sidebar state transition");
assert.match(dashboardApp, /document\.body\.classList\.toggle\("sidebar-collapsed", collapsed\)/u, "desktop sidebar body state");
assert.match(dashboardApp, /state\.map\?\.invalidateSize\(\)/u, "sidebar layout refreshes Leaflet map");
assert.match(dashboardApp, /else if \(state\.sidebarCollapsed\) setDesktopSidebarCollapsed\(false, \{ focus: false \}\)/u, "responsive boundary clears desktop collapse");
assert.match(dashboardStyles, /@media \(min-width: 1241px\)[\s\S]*body\.sidebar-collapsed \.workspace\s*\{\s*grid-template-columns: 0 minmax\(420px, 1fr\) var\(--output-width\);/u, "collapsed desktop grid expands map");
assert.match(dashboardStyles, /body\.sidebar-collapsed \.sidebar-expand-button:not\(\[hidden\]\)\s*\{\s*display: inline-flex;/u, "collapsed desktop shows expand control");
assert.match(dashboardStyles, /@media \(max-width: 1240px\)[\s\S]*\.sidebar-collapse-button,[\s\S]*\.sidebar-expand-button\s*\{\s*display: none !important;/u, "new controls stay out of tablet and mobile flows");
assert.match(dashboardHtml, /id="detailImageButton"[\s\S]*aria-haspopup="dialog"/u, "detail image opens an accessible dialog");
assert.doesNotMatch(dashboardHtml, /id="detailLabels"|id="detailConstraintNote"|장소 41개 라벨/u, "internal labels and constraints are removed from place detail DOM");
assert.doesNotMatch(dashboardApp, /renderPlaceLabels|renderConstraintNote|장소 라벨|변동·제약 정보/u, "place detail no longer renders internal labels or free-text constraints");
assert.doesNotMatch(dashboardHtml, /id="detailScoreTrace"|class="detail-score-trace"/u, "internal recommendation trace is removed from place detail DOM");
assert.doesNotMatch(dashboardApp, /renderScoreTrace|scorePill|내부 추천 상세|활성 블록:/u, "place detail no longer renders recommendation score traces");
assert.match(dashboardHtml, /id="placeImageDialog"[\s\S]*aria-labelledby="placeImageDialogTitle"/u, "large image dialog labeling");
assert.match(dashboardApp, /function openPlaceImageDialog\(\)/u, "large image dialog open behavior");
assert.match(dashboardApp, /function closePlaceImageDialog\(\{ restoreFocus = true \} = \{\}\)/u, "large image dialog focus restoration");
assert.match(dashboardApp, /state\.detailImageLoadToken === loadToken && state\.selectedPlace\?\.id === place\.id/u, "stale detail image guard");
assert.match(dashboardApp, /const imageLoader = new Image\(\)/u, "detail image preloads before display");
assert.match(dashboardApp, /dom\.detailMedia\.classList\.toggle\("is-low-resolution", scale > 1\.35\)/u, "low-resolution upscaling guard");
assert.match(dashboardStyles, /\.detail-media\s*\{[\s\S]*?aspect-ratio: 4 \/ 3;[\s\S]*?align-self: start;/u, "desktop image keeps an independent 4:3 frame");
assert.match(dashboardStyles, /\.detail-image-button > img\s*\{[\s\S]*?object-fit: contain;/u, "detail image remains fully visible");
assert.match(dashboardStyles, /@media \(max-width: 760px\)[\s\S]*?\.detail-media\s*\{[\s\S]*?min-height: 200px;[\s\S]*?aspect-ratio: 16 \/ 9;/u, "mobile image uses a larger 16:9 frame");
assert.match(dashboardApp, /const MOBILE_STACKED_MEDIA = "\(max-width: 760px\)"/u, "mobile stacked flow breakpoint");
assert.match(dashboardApp, /dom\.outputPanel\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/u, "mobile result scroll");
assert.match(dashboardApp, /section\.hidden = stacked \? false : !active/u, "mobile exposes every wizard section");
assert.match(dashboardStyles, /body:not\(\.has-recommendation\) \.output-panel\s*\{\s*display: none;/u, "mobile hides empty output panel");
assert.match(dashboardStyles, /\.sidebar\s*\{\s*order: 1;/u, "mobile input order");
assert.match(dashboardStyles, /\.output-panel\s*\{\s*order: 2;/u, "mobile result order");
assert.match(dashboardStyles, /\.map-shell\s*\{\s*order: 3;/u, "mobile map order");
assert.equal((dashboardHtml.match(/data-requirement-key="(?:companion|date|region|intent|transport|preference)"/gu) || []).length, 6, "six required input groups");
assert.equal((dashboardHtml.match(/data-requirement-status="(?:companion|date|region|intent|transport|preference)"/gu) || []).length, 6, "six live required statuses");
assert.match(dashboardHtml, /추천 결과 설정 <span class="optional-badge">선택<\/span>/u, "optional output settings label");
assert.match(dashboardApp, /function requiredInputStates\(\)/u, "required input state model");
assert.match(dashboardApp, /function updateRequiredInputState\(/u, "required input status synchronization");
assert.match(dashboardApp, /function clearRecommendation\([^)]*\) \{\s*hideFormError\(\);/u, "input changes clear stale validation alerts");
assert.match(dashboardApp, /const eventRequiresDates = dom\.tripIntent\.value === "event"/u, "event intent requires explicit dates");
assert.match(dashboardApp, /step === 2 && dom\.tripIntent\.value === "event" && dom\.dateUndecided\.checked/u, "event and undecided date cross-field validation");
assert.match(dashboardApp, /if \(validateWizardFlow\(\{ stacked: false \}\)\) runRecommendation\(\)/u, "desktop final submit revalidates every required step");
assert.match(dashboardApp, /`필수 조건 \$\{missing\.length\}개 확인하기`/u, "missing count call to action");
assert.match(dashboardApp, /state\.recommendationResult\s*\? "이 조건으로 다시 추천받기"\s*: "추천 결과 아래에서 보기"/u, "ready and rerun call to action states");
assert.match(dashboardApp, /state\.requiredValidationAttempted = true;\s*updateRequiredInputState\(\{ renderReview: true \}\)/u, "mobile submit marks every missing group");
assert.match(dashboardApp, /hasBothDates[\s\S]*?: "미선택";/u, "unselected dates remain visibly unselected");
assert.match(dashboardApp, /function preferenceSummary\(\)[\s\S]*?: "미선택";/u, "unselected preference remains visibly unselected");
assert.match(dashboardStyles, /\.review-summary-item\.is-missing/u, "review summary missing state");
assert.match(dashboardStyles, /\.has-required-error/u, "inline required error state");
assert.match(dashboardStyles, /\.choice-card\[aria-pressed="true"\]::after,[\s\S]*?content: "";/u, "selected checkmark stays decorative");
assert.doesNotMatch(dashboardApp, /dom\.runRecommendationButton\.textContent = "이 조건으로 장소 추천받기"/u, "dirty input must not imply readiness");
assert.match(dashboardApp, /function renderReviewSummary\(/u, "review summary");
assert.doesNotMatch(dashboardApp, /initMap\(\);\s*runRecommendation\(/u, "recommendation must not auto-run on initialize");
const travelMbtiApplySource = dashboardApp.match(/function applyTravelMbtiProfile\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function clearTravelMbtiProfile/u)?.[1] || "";
assert.ok(travelMbtiApplySource, "travel MBTI apply function");
assert.doesNotMatch(travelMbtiApplySource, /runRecommendation\(/u, "travel MBTI apply must wait for final wizard confirmation");
assert.match(dashboardHtml, /만족도나 의견을 남기면 여행 조건과 추천 결과가 서버에 자동 저장돼요\./u, "feedback autosave notice");
assert.doesNotMatch(dashboardHtml, /id="saveFeedbackLogButton"/u, "manual feedback save button is removed");
assert.match(dashboardHtml, /자동 전송되어 90일간 보관/u, "feedback retention notice");
assert.match(dashboardHtml, /id="participantName"[^>]*maxlength="30"/u, "participant name length boundary");
assert.match(dashboardHtml, /실명 대신 별칭을 사용해도 되며 연락처는 입력하지 마세요/u, "participant privacy notice");
assert.match(dashboardApp, /const FEEDBACK_OPTIONS = Object\.freeze/u, "five-point feedback options");
assert.match(dashboardApp, /recommendationFeedback: new Map\(\)/u, "feedback is memory-only state");
assert.match(dashboardApp, /getRecommendationFeedback: \(\) => Object\.fromEntries\(state\.recommendationFeedback\)/u, "feedback inspection boundary");
const feedbackComponentStart = dashboardApp.indexOf("function createRecommendationFeedback(place, contextKey)");
const feedbackComponentEnd = dashboardApp.indexOf("function createRecommendationCard(item)", feedbackComponentStart);
const feedbackComponentSource = feedbackComponentStart >= 0 && feedbackComponentEnd > feedbackComponentStart
  ? dashboardApp.slice(feedbackComponentStart, feedbackComponentEnd)
  : "";
assert.ok(feedbackComponentSource, "shared place feedback component");
assert.match(feedbackComponentSource, /recommendation-feedback-option/u, "per-place satisfaction controls");
assert.match(feedbackComponentSource, /aria-pressed/u, "feedback pressed state");
assert.match(feedbackComponentSource, /createElement\("textarea"\)/u, "per-place free-text feedback");
assert.match(feedbackComponentSource, /commentInput\.maxLength = 300/u, "feedback comment length boundary");
assert.match(feedbackComponentSource, /recommendationFeedback\.set\(feedbackKey, \{ \.\.\.current, comment: commentInput\.value \}\)/u, "feedback comment memory state");
assert.match(feedbackComponentSource, /syncRecommendationFeedback\(feedbackKey, commentInput\)/u, "feedback instances synchronize comments");
assert.match(dashboardHtml, /id="detailMobileFeedback"[^>]*hidden/u, "mobile detail feedback mount starts hidden");
const mobileDetailFeedbackStart = dashboardApp.indexOf("function renderMobileDetailFeedback(place, recommendation)");
const mobileDetailFeedbackEnd = dashboardApp.indexOf("function renderDetail(place)", mobileDetailFeedbackStart);
const mobileDetailFeedbackSource = mobileDetailFeedbackStart >= 0 && mobileDetailFeedbackEnd > mobileDetailFeedbackStart
  ? dashboardApp.slice(mobileDetailFeedbackStart, mobileDetailFeedbackEnd)
  : "";
assert.ok(mobileDetailFeedbackSource, "mobile place detail feedback renderer");
assert.match(mobileDetailFeedbackSource, /createRecommendationFeedback\(place, "mobile-detail"\)/u, "recommended mobile detail uses shared feedback");
assert.match(mobileDetailFeedbackSource, /state\.recommendationResult/u, "mobile detail distinguishes recommendation eligibility guidance");
assert.match(mobileDetailFeedbackSource, /이번 추천 결과에 포함된 장소만/u, "non-target place guidance");
assert.match(mobileDetailFeedbackSource, /여행 추천을 완료하면/u, "pre-recommendation guidance");
assert.match(dashboardApp, /renderMobileDetailFeedback\(place, recommendation\)/u, "place detail renders mobile feedback state");
assert.match(dashboardStyles, /\.detail-mobile-feedback\s*\{\s*display: none;/u, "mobile detail feedback stays hidden on desktop");
assert.match(dashboardStyles, /@media \(max-width: 760px\)[\s\S]*?\.detail-mobile-feedback\s*\{[\s\S]*?display: block;/u, "mobile detail feedback becomes visible at mobile breakpoint");
assert.match(dashboardStyles, /\.detail-mobile-feedback \.recommendation-feedback-option\s*\{[\s\S]*?min-height: 44px;/u, "mobile feedback score targets are touch sized");
assert.match(dashboardStyles, /\.detail-mobile-feedback \.recommendation-feedback-comment textarea\s*\{[\s\S]*?font-size: 16px;/u, "mobile feedback comment avoids input zoom");
const recommendationCardStart = dashboardApp.indexOf("function createRecommendationCard(item)");
const recommendationCardEnd = dashboardApp.indexOf("function renderWarnings", recommendationCardStart);
const recommendationCardSource = recommendationCardStart >= 0 && recommendationCardEnd > recommendationCardStart
  ? dashboardApp.slice(recommendationCardStart, recommendationCardEnd)
  : "";
assert.ok(recommendationCardSource, "recommendation card function");
assert.match(recommendationCardSource, /recommendation-detail-button/u, "explicit place detail button");
assert.match(recommendationCardSource, /createRecommendationFeedback\(place, "recommendation"\)/u, "recommendation card uses shared feedback");
assert.doesNotMatch(recommendationCardSource, /ID |MMR|연결 출처|seed:|sim |recommendation-score-row|recommendation-relevance/u, "beta card must hide internal trace");
const schedulePlaceStart = dashboardApp.indexOf("function createSchedulePlaceCard(item, dayIndex)");
const schedulePlaceEnd = dashboardApp.indexOf("function renderSchedule(schedule)", schedulePlaceStart);
const schedulePlaceSource = schedulePlaceStart >= 0 && schedulePlaceEnd > schedulePlaceStart
  ? dashboardApp.slice(schedulePlaceStart, schedulePlaceEnd)
  : "";
assert.ok(schedulePlaceSource, "schedule place card function");
assert.match(schedulePlaceSource, /schedule-place-card/u, "schedule place is a non-button container");
assert.match(schedulePlaceSource, /createRecommendationFeedback\(place, `schedule-\$\{dayIndex\}`\)/u, "schedule place uses shared feedback");
assert.match(dashboardApp, /function syncRecommendationFeedback\(feedbackKey, sourceInput = null\)/u, "same-place feedback synchronization");
const clearRecommendationStart = dashboardApp.indexOf("function clearRecommendation(");
const clearRecommendationEnd = dashboardApp.indexOf("function fitBoundsForPlaces", clearRecommendationStart);
const clearRecommendationSource = clearRecommendationStart >= 0 && clearRecommendationEnd > clearRecommendationStart
  ? dashboardApp.slice(clearRecommendationStart, clearRecommendationEnd)
  : "";
assert.match(clearRecommendationSource, /state\.recommendationFeedback\.clear\(\)/u, "new recommendation conditions clear feedback");
assert.match(dashboardApp, /function recommendationFeedbackTargets\(result = state\.recommendationResult\)/u, "unique feedback target calculation");
assert.match(dashboardApp, /function recommendationFeedbackCompletion\(\)/u, "feedback completion calculation");
assert.match(dashboardApp, /function buildFeedbackLog\(revision = state\.feedbackAutoSave\.revision\)/u, "feedback log builder");
assert.match(dashboardApp, /schema_version: "travel-recommendation-feedback-log-v3"/u, "feedback log schema version");
assert.match(dashboardApp, /participant_name: participantNameValue\(\) \|\| null/u, "participant name feedback field");
assert.match(dashboardApp, /if \(!participantNameValue\(\) && !allowBlankParticipant\)/u, "blank participant blocks initial feedback transmission");
assert.match(dashboardApp, /dom\.participantName\.addEventListener\("input", handleParticipantNameInput\)/u, "participant name changes update feedback log");
assert.match(dashboardApp, /session_id: autosave\.sessionId/u, "feedback session id");
assert.match(dashboardApp, /revision,/u, "monotonic feedback revision");
assert.match(dashboardApp, /method: "server_autosave"/u, "feedback autosave storage");
assert.match(dashboardApp, /endpoint: "\/travel\/api\/feedback"/u, "same-origin feedback endpoint");
assert.match(dashboardApp, /server_transmitted: true/u, "feedback server transmission");
assert.match(dashboardApp, /web_storage_used: false/u, "no feedback Web Storage");
assert.match(dashboardApp, /await fetch\("\/travel\/api\/feedback"/u, "feedback POST request");
assert.match(dashboardApp, /fetch\(`api\/places\/\$\{encodeURIComponent\(placeId\)\}\/reviews\?limit=5&offset=0`/u, "same-origin review lookup");
assert.match(dashboardApp, /schema_version !== "kakao-place-reviews-v1"/u, "review response contract");
assert.match(dashboardApp, /state\.reviewRequest\.controller\?\.abort\(\)/u, "stale review request cancellation");
assert.match(dashboardApp, /credentials: "omit"/u, "feedback request omits credentials");
assert.match(dashboardApp, /autosave\.pendingPayload\?\.revision === sendingRevision/u, "failed feedback retries reuse payload");
assert.match(feedbackComponentSource, /scheduleFeedbackAutoSave\(0\)/u, "score selection saves immediately");
assert.match(feedbackComponentSource, /scheduleFeedbackAutoSave\(800\)/u, "comment input is debounced");
assert.match(dashboardApp, /function queueFeedbackAutoSaveRetry\(autosave\)/u, "failed autosave retries automatically");
assert.match(dashboardApp, /getFeedbackCompletion: \(\) => recommendationFeedbackCompletion\(\)/u, "feedback completion inspection boundary");
assert.match(dashboardApp, /getParticipantName: \(\) => participantNameValue\(\)/u, "participant name inspection boundary");
assert.match(dashboardApp, /buildFeedbackLog: \(\) => buildFeedbackLog\(Math\.max\(1, state\.feedbackAutoSave\.revision\)\)/u, "feedback log inspection boundary");

const readyPlaces = places.filter((place) => place.v5 && place.fit);
assert.equal(readyPlaces.length, 1663);
for (const place of readyPlaces) {
  assert.equal(place.v5.labels.length, 24, `${place.id}: preference axes`);
  assert.equal(place.fit.companion.length, 5, `${place.id}: companion axes`);
  assert.equal(place.fit.month.length, 12, `${place.id}: month axes`);
  const uniqueLabels = new Set(place.v5.labels.map((record) => record.label));
  assert.equal(uniqueLabels.size, 24, `${place.id}: unique preference axes`);
  assert.equal([...uniqueLabels].filter((label) => label.startsWith("derived_style.")).length, 6, `${place.id}: derived axes`);
  assert.ok(place.fit.companion.every((axis) => axis.state === "numeric" && Number.isFinite(axis.value)));
  assert.ok(place.fit.month.every((axis) =>
    (axis.state === "numeric" && Number.isFinite(axis.value)) ||
    (axis.state === "not_applicable" && axis.value === null)
  ));
  assert.equal(place.research.status, "ai_draft", `${place.id}: research status`);
  assert.ok(["claim_available", "metadata_only"].includes(place.research.coverage), `${place.id}: research coverage`);
  assert.ok(place.research.highlights.length >= 1 && place.research.highlights.length <= 2, `${place.id}: research highlights`);
  assert.ok(place.research.sources.length >= 1, `${place.id}: research sources`);
  const researchSourceIds = new Set(place.research.sources.map((source) => source.id));
  assert.ok(place.research.sources.every((source) => /^https:\/\//u.test(source.url)), `${place.id}: secure research URLs`);
  assert.ok(place.research.highlights.every((highlight) =>
    highlight.text && researchSourceIds.has(highlight.sourceId) && highlight.tier >= 1 && highlight.tier <= 6
  ), `${place.id}: research claim provenance`);
  assert.ok(
    place.research.highlights.every((highlight) => !highlight.dynamic) || place.research.coverage === "metadata_only",
    `${place.id}: changing information must be avoided or explicitly downgraded`
  );
}

const legacyResearch = readyPlaces.find((place) => place.id === "1906211")?.research;
assert.ok(legacyResearch?.highlights.some((highlight) => highlight.text.includes("골목")), "legacy evidence fallback");

for (const contentId of [
  "140930", "129076", "126438", "2948051",
  "132160", "132556", "992261", "1690237", "2730822", "3512205", "131784", "2411625",
]) {
  const research = readyPlaces.find((place) => place.id === contentId)?.research;
  assert.ok(research?.highlights?.length, `${contentId}: changing-information regression place`);
  assert.ok(
    research.highlights.every((highlight) => !highlight.dynamic) || research.coverage === "metadata_only",
    `${contentId}: changing information must be avoided or marked as metadata-only`
  );
}

function featureKey(label) {
  return String(label).split(".").at(-1);
}

const rankedInput = places.map((place) => {
  const atomicFeatures = Object.fromEntries(
    (place.v5?.labels || [])
      .filter((record) => ["theme.", "environment.", "style_evidence."].some((prefix) => record.label.startsWith(prefix)))
      .map((record) => [featureKey(record.label), record.value]),
  );
  return {
    ...place,
    atomicFeatures,
    companionScores: Object.fromEntries((place.fit?.companion || []).map((axis) => [axis.key, axis.value])),
    monthScores: Object.fromEntries((place.fit?.month || []).map((axis) => [axis.key, axis.value])),
    recommendationReady: Boolean(place.v5 && place.fit && CCU.ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
  };
});

const request = {
  destinationRegion: "jeju_all",
  intent: "visit",
  travelWindow: { startDate: "2026-08-20", endDate: "2026-08-22" },
  transportMode: "car",
  requiredPlaceIds: ["126435"],
  companionType: "parents",
  preferences: [
    { feature: "ocean", mode: "benefit", weight: 4 },
    { feature: "physical_ease", mode: "benefit", weight: 2 },
    { feature: "local_embeddedness", mode: "benefit", weight: 2 },
    { feature: "photo_value", mode: "benefit", weight: 1 },
  ],
  resultCount: 10,
  diversity: "balanced",
};

const first = CCU.rank(rankedInput, request, { random: () => 0.65 });
const second = CCU.rank(rankedInput, request, { random: () => 0.65 });
assert.equal(first.summary.inputCandidates, 2153);
assert.equal(
  first.summary.scoredCandidates + first.verificationCandidates.length + first.summary.filteredByIntent + first.summary.unscored,
  2153,
);
assert.equal(first.items.length, 10);
assert.deepEqual(first.items.map((item) => item.placeId), second.items.map((item) => item.placeId));
assert.equal(first.seedSelection.strategy, "weighted-precomputed-top-relevance-3");
assert.equal(first.seedSelection.selectedRelevanceRank, 2);
assert.equal(first.seedSelection.selectedProbability, 0.3);
assert.equal(first.seedSelection.selectedPlaceId, first.items[0].placeId);
assert.ok(first.seedSelection.candidates.some((candidate) => candidate.placeId === first.items[0].placeId));
assert.equal(first.courseVariants.length, 3);
assert.deepEqual(first.courseVariants.map((variant) => variant.seedRelevanceRank), [1, 2, 3]);
assert.deepEqual(first.courseVariants.map((variant) => variant.placeIds[0]), first.courseVariants.map((variant) => variant.seedPlaceId));
assert.equal(first.courseVariant.variantId, "seed-rank-2");
assert.ok(!first.request.diversityFeatureKeys.includes("ocean"));
assert.ok(first.items.every((item) => Number.isFinite(item.relevance) && Number.isFinite(item.mmrScore)));
assert.ok(first.items.every((item) => readyPlaces.find((place) => place.id === item.placeId)?.research?.highlights?.length));
assert.equal(first.schedule.radiusKm, 15);
assert.equal(first.schedule.dailyCapacity, 6);
assert.equal(first.schedule.status, "feasible");
assert.equal(first.schedule.dayClusters.length, 3);
assert.equal(first.schedule.dayClusters[0].requiredPlaceIds[0], "126435");
assert.equal(first.schedule.courseVariantId, first.courseVariant.variantId);
assert.equal(first.schedule.autoAnchorCount, 2);
assert.ok(first.schedule.dayClusters.every((day) => day.usedCapacity <= 6));
assert.ok(first.schedule.dayClusters.every((day) => day.maxCenterDistanceKm <= 15));
assert.ok(first.schedule.dayClusters.slice(1).every((day) => ["variant_anchor", "fallback_anchor"].includes(day.centerType)));

const explicitThird = CCU.rank(rankedInput, request, { variantId: "seed-rank-3" });
assert.equal(explicitThird.courseVariant.variantId, "seed-rank-3");
assert.equal(explicitThird.items[0].placeId, explicitThird.courseVariants[2].seedPlaceId);
assert.notDeepEqual(
  first.schedule.dayClusters.map((day) => day.anchorPlaceId),
  explicitThird.schedule.dayClusters.map((day) => day.anchorPlaceId),
);

console.log(JSON.stringify({
  places: places.length,
  recommendationReady: readyPlaces.length,
  labelsPerReadyPlace: 41,
  researchCoverage: metadata.recommendationResearchReadyCount,
  returned: first.items.length,
  verificationCandidates: first.verificationCandidates.length,
  scheduleStatus: first.schedule.status,
  scheduledDays: first.schedule.dayClusters.length,
  topPlaceIds: first.items.map((item) => item.placeId),
}, null, 2));
