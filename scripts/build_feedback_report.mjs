import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(repoRoot, "travel-feedback-anonymized-since-0903 copy.json");
const outputPath = path.join(repoRoot, "reports", "travel-feedback-since-0903.html");
const checkOnly = process.argv.includes("--check");

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateInput(raw);

const sessions = raw.logs.map((log) => {
  const profile = log.input?.preferenceProfile?.displaySummary ??
    log.travel_mbti?.applied_profile?.displaySummary ??
    log.travel_mbti?.generated_profile?.displaySummary ?? {};
  const schedule = log.input?.scheduleConfig ?? {};
  return {
    user: log.user,
    logNumber: log.log_number,
    recordType: log.record_type,
    preset: log.selected_preset,
    companion: log.input?.companionType ?? null,
    transport: log.input?.transportMode ?? null,
    tripDays: schedule.tripDays ?? null,
    dailyCapacity: schedule.dailyCapacity ?? null,
    radiusKm: schedule.radiusKm ?? null,
    mbtiCode: profile.archetypeId ?? null,
    mbtiName: profile.archetypeName ?? null,
    mbtiEmoji: profile.emoji ?? "",
    mbtiDescription: profile.description ?? null,
    mbtiAxes: profile.axes ?? [],
    topPreferences: profile.topPreferences ?? [],
    topAvoidances: profile.topAvoidances ?? [],
    summary: log.summary,
    reviews: log.reviews.map((review) => ({
      placeId: review.place_id,
      place: review.place,
      rating: review.rating,
      text: review.text ?? "",
      contexts: review.contexts ?? [],
    })),
  };
});

const reviews = sessions.flatMap((session) => session.reviews.map((review) => ({
  ...review,
  user: session.user,
  logNumber: session.logNumber,
  mbtiCode: session.mbtiCode,
  mbtiName: session.mbtiName,
}))); 
const rated = reviews.filter((review) => Number.isInteger(review.rating));
const comments = rated.filter((review) => review.text.trim());
const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((score) => [score, rated.filter((review) => review.rating === score).length]));
const average = rated.length ? rated.reduce((sum, review) => sum + review.rating, 0) / rated.length : null;
const users = [...new Set(sessions.map((session) => session.user))];

const interpretationByUser = {
  "사용자 A": {
    headline: "편안한 실내 문화·휴식 장소를 선호",
    preference: "휴식(R)·실내(I) 성향이 매우 뚜렷하고, 로컬 탐색보다는 알려진 명소(H)를 고르는 편입니다. 미술관·전시·스파처럼 몸의 부담이 적고 콘텐츠가 분명한 장소가 잘 맞습니다.",
    evaluation: "17곳을 모두 평가했습니다. 미술관·박물관과 온천·다리 등 편하게 즐기는 장소에는 주로 4~5점을 줬고, 야외 활동이나 볼거리 밀도가 낮다고 느낀 장소는 2~3점이었습니다.",
    lowReasons: [
      { title: "야외·체력 부담", detail: "새별오름에 ‘야외활동은 힘들어요’라고 적어 강한 실내·휴식 성향과 일치합니다." },
      { title: "기대보다 약한 콘텐츠", detail: "테디베어하우스 테지움은 ‘은근 볼게없음’, 산방산탄산온천은 야외온천이 아쉽다고 평가했습니다." },
    ],
    caveat: "자유 의견은 3건이므로 세부 취향보다 실내/야외와 신체 부담 신호가 더 확실합니다.",
  },
  "사용자 B": {
    headline: "유명하고 새로운 체험은 좋아하지만 일정 반복과 누적 피로에 민감",
    preference: "활동(A)과 핫스폿(H)을 선호하되 실내 쪽으로도 약간 기웁니다. 대표 명소, 레이싱·미로·카약·유람선처럼 목적과 재미가 분명한 체험을 좋아합니다.",
    evaluation: "30곳을 모두 평가했고 평균은 2점대 후반입니다. 한라산 백록담·성산일출봉 같은 대표 명소와 메이즈랜드·유람선 같은 뚜렷한 체험은 5점이지만, 일정 후반에 자연·걷기·비슷한 활동이 반복되자 점수가 크게 떨어졌습니다.",
    lowReasons: [
      { title: "자연·걷기 코스의 과다 반복", detail: "‘자연 너무많다’, ‘그만 오를래’, ‘계속 길 자연 숲’처럼 같은 야외 테마의 누적을 반복해서 지적했습니다." },
      { title: "일정 순서와 체력 배분", detail: "이미 산·미로·레일바이크·동굴을 경험한 뒤 다시 오름을 배치한 점, 실내 휴식이 부족한 점을 낮게 봤습니다." },
      { title: "비슷한 체험과 장소 중복", detail: "레이싱을 이틀 연속 배치하거나 우도·우도마을·우도 올레처럼 차이가 불명확한 추천을 문제로 봤습니다." },
      { title: "장소 자체의 매력 부족", detail: "우도마을·수월봉·해안 일부를 ‘볼거없어보임’이라고 평가했습니다." },
    ],
    caveat: "활동형이라고 해서 활동량이 무제한인 것은 아닙니다. 이 사용자는 ‘새로운 활동’과 ‘일정 전체의 리듬’을 함께 중요하게 봅니다.",
  },
  "사용자 C": {
    headline: "사진이 되는 야외 풍경과 가벼운 액티비티를 선호",
    preference: "활동(A)·야외(O)·핫스폿(H) 조합입니다. 바다 풍경, 사진 가치, 해방감이 있으면서 카약처럼 체험 요소가 있는 장소에 끌립니다.",
    evaluation: "16곳 중 12곳을 평가했습니다. 서우봉둘레길·투명카약·용두암해안도로처럼 풍경과 체험이 결합된 곳은 5점이었고, 인공적이거나 감동이 약해 보이는 풍경과 비슷한 해변의 반복은 낮게 평가했습니다.",
    lowReasons: [
      { title: "하루 안에서 같은 콘셉트 반복", detail: "오름·해변·올레가 연속되면 ‘너무 자연자연’, ‘하루 일정이 아예 동일한 컨셉’이라며 지루함을 예상했습니다." },
      { title: "이미 본 풍경과의 중복", detail: "협재해수욕장과 협재포구는 이미 바다를 많이 본 뒤라 매력이 줄었다고 설명했습니다." },
      { title: "시각적 감동 부족", detail: "수월봉은 큰 감동이 없을 것 같고, 서부두방파제는 인공적이며 볼거리가 적어 보인다고 평가했습니다." },
    ],
    caveat: "미평가 4건이 있어 전체 추천 목록에 대한 완결된 평가는 아닙니다.",
  },
  "사용자 D": {
    headline: "잘 알려진 야외 해안 풍경에 높은 만족",
    preference: "휴식(R)과 활동의 차이는 작지만 야외(O)가 매우 강하고, 로컬보다 알려진 명소(H)를 조금 더 선호합니다. 해변·해안도로·포구처럼 탁 트인 풍경을 편하게 감상하는 코스에 가깝습니다.",
    evaluation: "비슷한 추천 목록을 두 세션에서 평가했고, 평가한 15건 대부분에 4~5점을 줬습니다. 성산일출봉·형제해안도로·광치기해변을 두 번 모두 5점으로 평가해 대표 해안 명소에 대한 선호는 일관됩니다.",
    lowReasons: [],
    caveat: "자유 의견이 전혀 없고 두 세션의 추천이 많이 겹칩니다. 높은 만족은 확인되지만 왜 좋았는지, 미평가 장소를 왜 건너뛰었는지는 단정할 수 없습니다.",
  },
  "사용자 E": {
    headline: "실내·휴식형이지만 이번 응답은 제품 사용성 피드백 중심",
    preference: "휴식(R)·실내(I)·핫스폿(H) 성향입니다. 알려진 실내 문화 공간과 분위기를 느긋하게 즐기는 유형으로 해석됩니다.",
    evaluation: "10곳 중 4곳만 평가해 여행지 선호를 판단하기에는 표본이 적습니다. 평가 점수는 3~4점이었고, 장소 자체보다 리뷰 제공 방식·완료 상태·일정 구성 기능에 대한 의견을 자세히 남겼습니다.",
    lowReasons: [
      { title: "장소 저평가 근거는 없음", detail: "1~2점 응답이 없어서 특정 여행지를 싫어하는 이유는 확인되지 않습니다." },
      { title: "완료 상태의 가시성", detail: "완료 버튼을 여러 번 눌렀다며 완료 여부가 더 명확히 보여야 한다고 요청했습니다." },
      { title: "리뷰 품질과 노출 한도", detail: "폐업 여부가 의심되는 리뷰를 걸러내고, 리뷰가 최대 5개만 보이는 제한을 미리 안내해 달라고 했습니다." },
      { title: "완성형 일정 요구", detail: "장소 추천을 넘어 하루 코스를 완전히 짜주는 기능을 원했습니다." },
    ],
    caveat: "이 사용자의 문장은 여행 취향 분석보다 제품 UX 개선 근거로 보는 편이 타당합니다.",
  },
  "사용자 F": {
    headline: "편안하게 보는 유명 해안 풍경을 매우 선호",
    preference: "휴식(R)·야외(O)·핫스폿(H) 성향입니다. 강도 높은 활동보다는 검증된 해변·해안길·전망을 여유롭게 보는 여행에 가깝습니다.",
    evaluation: "10곳을 모두 평가해 평균 4.5점으로 만족도가 높습니다. 해수욕장·해안산책로·해안도로 대부분에 4~5점을 줬고, 접근 부담이나 사진상 매력이 약한 두 곳만 3점이었습니다.",
    lowReasons: [
      { title: "추가 이동과 접근 부담", detail: "가파도 올레는 배를 새로 타야 하고 멀다는 점 때문에 상대적으로 낮은 3점을 줬습니다." },
      { title: "첫인상의 재미 부족", detail: "수월봉은 ‘사진만 봤을 때 재미가 없어보임’이라고 평가했습니다." },
    ],
    caveat: "1~2점은 없으므로 여기의 ‘낮은 이유’는 이 사용자 안에서 상대적으로 낮은 3점의 이유입니다.",
  },
  "사용자 G": {
    headline: "느린 로컬 풍경형 결과지만 실제 평가 근거는 거의 없음",
    preference: "휴식(R)·로컬(L) 쪽으로 약하게 기울고 실내/야외는 중립입니다. MBTI 결과상 유명 명소를 빠르게 도는 것보다 동네와 풍경을 천천히 보는 유형입니다.",
    evaluation: "36곳 중 메이즈랜드 1곳만 1점으로 평가했고 나머지 35곳은 미평가입니다. 이 한 점만으로 추천 목록 전체 만족도나 여행 선호를 해석할 수 없습니다.",
    lowReasons: [],
    caveat: "자유 의견이 없어 메이즈랜드에 1점을 준 이유도 알 수 없습니다. 평균 1.0은 전체 취향이 아니라 응답 1건의 값입니다.",
  },
  "사용자 H": {
    headline: "차량 없는 휴식형에게 걷기·섬 이동이 과하게 배치됨",
    preference: "휴식(R)·핫스폿(H) 성향이고 실내/야외는 중립입니다. 유명 풍경을 선호하더라도 이동 피로가 적고 장소별 차이가 분명한 코스가 필요합니다.",
    evaluation: "23곳을 모두 평가했지만 평균은 2점대 중반입니다. 특히 차량 없음 조건에서 가파도와 걷기 코스가 반복 배치된 점이 낮은 평가와 직접 연결됩니다.",
    lowReasons: [
      { title: "차량 없는 여행의 접근 부담", detail: "가파도는 ‘가기도 힘든데’라고 했고, 배 이동이 필요한 섬 안팎 장소가 같은 날 여러 개 묶였습니다." },
      { title: "걷기 코스 과다", detail: "송악산둘레길에 ‘너무 다 걷는곳만 추천해줘요’라고 적었습니다." },
      { title: "같은 권역·장소의 과도한 반복", detail: "가파도·가파도 올레·가파도 전망대가 함께 제시되자 ‘가파도 그만가고싶어요’라고 했습니다." },
      { title: "장소 매력 대비 이동 비용", detail: "가파도에 대해 이동은 어려운데 볼거리는 적어 보인다고 평가했습니다." },
    ],
    caveat: "자유 의견은 4건이지만 모두 이동 부담과 반복성을 같은 방향으로 지적해 신호가 비교적 선명합니다.",
  },
  "사용자 I": {
    headline: "재미가 분명한 유명 액티비티를 선호하고 관심 밖 카테고리는 단호히 제외",
    preference: "활동(A)·핫스폿(H)이 강하고 실내/야외는 중립입니다. 유명하면서 무엇을 하는 곳인지 분명한 체험·테마파크를 선호합니다.",
    evaluation: "21곳을 모두 평가해 평균은 3점대 후반입니다. 9.81파크·메이즈랜드·카트·보트 등 재미가 예상되는 활동에는 4~5점을 줬지만, 개인 관심사와 맞지 않거나 매력이 불명확한 장소에는 1~3점을 줬습니다.",
    lowReasons: [
      { title: "명확한 비관심 카테고리", detail: "골프장은 ‘골프 안쳐요’, 농어촌 체험마을은 ‘농어촌은 관심 없어요’라며 1점을 줬습니다." },
      { title: "사진상 매력 부족", detail: "휴애리와 다랑쉬오름은 덜 끌리거나 예뻐 보이지 않는다는 이유로 2점이었습니다." },
      { title: "무엇을 하는 곳인지 불명확", detail: "점보빌리지는 ‘뭐하는 곳인지 잘 모르겠음’이라며 3점을 줬습니다." },
    ],
    caveat: "추천 전 카테고리 비선호를 필수 제외 조건으로 받을 수 있다면 골프·농어촌 같은 명백한 불일치를 줄일 가능성이 큽니다.",
  },
};

const userAnalyses = users.map((user) => {
  const userSessions = sessions.filter((session) => session.user === user);
  const userReviews = reviews.filter((review) => review.user === user);
  const userRated = userReviews.filter((review) => review.rating != null);
  const profile = userSessions[0];
  const uniquePlaces = (items) => [...new Map(items.map((review) => [review.placeId, review])).values()];
  return {
    user,
    ...interpretationByUser[user],
    mbtiCode: profile.mbtiCode,
    mbtiName: profile.mbtiName,
    mbtiEmoji: profile.mbtiEmoji,
    mbtiDescription: profile.mbtiDescription,
    mbtiAxes: profile.mbtiAxes,
    companion: [...new Set(userSessions.map((session) => session.companion).filter(Boolean))],
    transport: [...new Set(userSessions.map((session) => session.transport).filter(Boolean))],
    sessions: userSessions.length,
    required: userReviews.length,
    rated: userRated.length,
    comments: userRated.filter((review) => review.text.trim()).length,
    average: userRated.length ? userRated.reduce((sum, review) => sum + review.rating, 0) / userRated.length : null,
    highPlaces: uniquePlaces(userRated.filter((review) => review.rating >= 4).sort((a, b) => b.rating - a.rating)).slice(0, 6).map((review) => ({ place: review.place, rating: review.rating })),
    lowPlaces: uniquePlaces(userRated.filter((review) => review.rating <= 2)).slice(0, 6).map((review) => ({ place: review.place, rating: review.rating, text: review.text })),
  };
});

const placeMap = new Map();
for (const review of rated) {
  const item = placeMap.get(review.placeId) ?? { placeId: review.placeId, place: review.place, ratings: [], comments: 0 };
  item.ratings.push(review.rating);
  if (review.text.trim()) item.comments += 1;
  placeMap.set(review.placeId, item);
}
const placeStats = [...placeMap.values()].map((item) => ({
  ...item,
  count: item.ratings.length,
  average: item.ratings.reduce((sum, rating) => sum + rating, 0) / item.ratings.length,
}));

const report = {
  schema: raw.schema,
  sourceStatus: raw.source_status,
  notes: raw.notes,
  sourceSummary: raw.summary,
  computed: {
    users: users.length,
    sessions: sessions.length,
    required: reviews.length,
    rated: rated.length,
    unrated: reviews.length - rated.length,
    comments: comments.length,
    completedSessions: sessions.filter((session) => session.summary?.all_completed).length,
    average,
    distribution,
  },
  users,
  sessions,
  reviews,
  placeStats,
  userAnalyses,
};

assertCounts(report);
const html = buildHtml(report);

if (checkOnly) {
  const requiredMarkers = ["피드백 한눈에 보기", "user-analysis-list", "feedback-list", "session-list", "filter-user", "download-csv"];
  for (const marker of requiredMarkers) {
    if (!html.includes(marker)) throw new Error(`HTML 필수 마커 누락: ${marker}`);
  }
  if (report.userAnalyses.length !== report.computed.users) throw new Error("사용자 분석 수가 사용자 수와 다릅니다.");
  if (report.userAnalyses.some((analysis) => !analysis.preference || !analysis.evaluation || !analysis.caveat)) throw new Error("사용자 분석 필수 내용이 누락됐습니다.");
  console.log(`검증 완료: ${report.computed.users}명, ${report.computed.sessions}개 세션, ${report.computed.rated}개 평가, ${report.computed.comments}개 의견`);
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
  console.log(`생성 완료: ${path.relative(repoRoot, outputPath)}`);
}

function validateInput(data) {
  if (data?.schema !== "anonymized-feedback-v1") throw new Error(`지원하지 않는 스키마: ${data?.schema ?? "없음"}`);
  if (!Array.isArray(data.logs)) throw new Error("logs가 배열이 아닙니다.");
  for (const [index, log] of data.logs.entries()) {
    if (typeof log.user !== "string" || !log.user) throw new Error(`logs[${index}].user가 올바르지 않습니다.`);
    if (!Array.isArray(log.reviews)) throw new Error(`logs[${index}].reviews가 배열이 아닙니다.`);
  }
}

function assertCounts(data) {
  const { sourceSummary: source, computed } = data;
  const checks = [
    ["user_count", computed.users],
    ["log_count", computed.sessions],
    ["completed_logs", computed.completedSessions],
    ["rated_reviews", computed.rated],
    ["text_reviews", computed.comments],
    ["required_places", computed.required],
    ["unrated_places", computed.unrated],
  ];
  for (const [key, value] of checks) {
    if (source[key] !== value) throw new Error(`집계 불일치: summary.${key}=${source[key]}, 계산값=${value}`);
  }
}

function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function buildHtml(data) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Trip AI 테스터 피드백 리포트</title>
  <style>
    :root { --ink:#17211b; --muted:#647067; --line:#dce5dd; --paper:#fbfcf8; --card:#fff; --green:#1d6b4b; --green-soft:#e7f3ec; --orange:#c45d28; --orange-soft:#fff0e7; --red:#b83c35; --red-soft:#fdebea; --gold:#e5a92f; --shadow:0 12px 34px rgba(31,55,42,.08); }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; font-family:Inter, Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:linear-gradient(150deg,#f4f8f3 0,#fbfcf8 36%,#fff8f0 100%); }
    button,input,select { font:inherit; }
    button { cursor:pointer; }
    .shell { width:min(1440px,100%); margin:0 auto; padding:36px 28px 80px; }
    .hero { display:flex; justify-content:space-between; align-items:flex-end; gap:28px; padding:24px 4px 30px; }
    .eyebrow { color:var(--green); font-size:13px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:8px 0 10px; font-size:clamp(32px,5vw,58px); line-height:1.03; letter-spacing:-.045em; }
    .lead { margin:0; max-width:700px; color:var(--muted); font-size:17px; line-height:1.7; }
    .hero-note { flex:0 0 270px; padding:16px 18px; border:1px solid var(--line); border-radius:18px; color:var(--muted); background:rgba(255,255,255,.66); font-size:13px; line-height:1.6; }
    .stats { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:18px; }
    .stat,.panel { border:1px solid rgba(207,220,209,.9); background:rgba(255,255,255,.92); box-shadow:var(--shadow); }
    .stat { min-height:132px; padding:20px; border-radius:22px; }
    .stat-label { color:var(--muted); font-size:13px; font-weight:700; }
    .stat-value { margin-top:13px; font-size:32px; font-weight:850; letter-spacing:-.04em; }
    .stat-sub { margin-top:5px; color:var(--muted); font-size:12px; }
    .grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(320px,.75fr); gap:18px; margin-bottom:18px; }
    .panel { border-radius:24px; padding:24px; overflow:hidden; }
    .panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
    h2 { margin:0; font-size:21px; letter-spacing:-.025em; }
    .hint { margin:5px 0 0; color:var(--muted); font-size:13px; line-height:1.5; }
    .distribution { display:grid; gap:11px; }
    .bar-row { display:grid; grid-template-columns:44px 1fr 44px; gap:10px; align-items:center; font-size:13px; }
    .bar-label { font-weight:750; }
    .bar-track { height:12px; border-radius:99px; background:#edf1ec; overflow:hidden; }
    .bar-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--orange),var(--gold)); }
    .bar-count { text-align:right; color:var(--muted); font-variant-numeric:tabular-nums; }
    .takeaways { display:grid; gap:10px; }
    .takeaway { padding:14px 15px; border-radius:16px; background:#f5f8f4; }
    .takeaway strong { display:block; font-size:14px; }
    .takeaway span { display:block; margin-top:4px; color:var(--muted); font-size:12px; line-height:1.5; }
    .analysis-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .analysis-card { padding:20px; border:1px solid var(--line); border-radius:20px; background:#fff; }
    .analysis-top { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
    .analysis-user { color:var(--green); font-size:13px; font-weight:850; }
    .analysis-headline { margin:5px 0 0; font-size:19px; line-height:1.35; letter-spacing:-.025em; }
    .analysis-score { flex:0 0 auto; text-align:right; }
    .analysis-score strong { display:block; font-size:23px; letter-spacing:-.03em; }
    .analysis-score span { color:var(--muted); font-size:11px; }
    .mbti-box { margin-top:15px; padding:15px; border-radius:16px; background:var(--green-soft); }
    .mbti-title { display:flex; align-items:center; gap:8px; font-weight:850; }
    .mbti-title .emoji { font-size:24px; }
    .mbti-box > p { margin:7px 0 0; color:#476052; font-size:12px; line-height:1.55; }
    .axis-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .axis-pill { padding:6px 9px; border:1px solid #c9dfd1; border-radius:10px; background:#fff; color:#315641; font-size:11px; line-height:1.35; }
    .analysis-section { margin-top:16px; }
    .analysis-label { display:block; margin-bottom:6px; color:var(--muted); font-size:11px; font-weight:850; letter-spacing:.08em; }
    .analysis-copy { margin:0; color:#334139; font-size:13px; line-height:1.68; word-break:keep-all; }
    .place-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .place-chip { padding:6px 9px; border-radius:10px; background:#f5f7f3; color:#45534a; font-size:11px; }
    .reason-list { display:grid; gap:8px; }
    .reason { padding:11px 12px; border-left:3px solid var(--orange); border-radius:4px 12px 12px 4px; background:var(--orange-soft); }
    .reason strong { display:block; color:#7c3f23; font-size:12px; }
    .reason span { display:block; margin-top:4px; color:#694f42; font-size:12px; line-height:1.55; }
    .caveat { margin-top:15px; padding:10px 12px; border-radius:12px; color:#687069; background:#f2f3f0; font-size:11px; line-height:1.55; }
    .priority-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .quote-card { padding:17px; border:1px solid #f1d7ca; border-radius:18px; background:var(--orange-soft); }
    .quote-meta { display:flex; justify-content:space-between; gap:12px; color:#86513a; font-size:12px; }
    .quote-place { margin-top:8px; font-weight:800; }
    .quote-text { margin:7px 0 0; line-height:1.62; white-space:pre-wrap; word-break:keep-all; }
    .rating { white-space:nowrap; color:#946713; font-weight:800; }
    .toolbar { position:sticky; top:10px; z-index:5; display:grid; grid-template-columns:minmax(220px,1.8fr) repeat(3,minmax(130px,.7fr)) auto; gap:9px; padding:12px; margin:0 -2px 16px; border:1px solid var(--line); border-radius:18px; background:rgba(251,252,248,.94); backdrop-filter:blur(14px); }
    .control { width:100%; min-height:42px; padding:0 12px; border:1px solid #cfd9d1; border-radius:12px; color:var(--ink); background:#fff; }
    .control:focus { outline:3px solid rgba(29,107,75,.14); border-color:var(--green); }
    .btn { min-height:42px; padding:0 15px; border:0; border-radius:12px; color:#fff; background:var(--green); font-weight:750; }
    .result-count { margin:0 0 12px; color:var(--muted); font-size:13px; }
    .feedback-list { display:grid; gap:8px; }
    .feedback-row { display:grid; grid-template-columns:150px minmax(180px,.8fr) 84px minmax(240px,1.7fr) 120px; gap:14px; align-items:center; padding:14px 16px; border:1px solid var(--line); border-radius:16px; background:#fff; }
    .feedback-row.is-low { border-color:#f0c8c5; background:#fffafa; }
    .feedback-user { font-size:13px; font-weight:750; }
    .feedback-user small,.feedback-place small { display:block; margin-top:3px; color:var(--muted); font-weight:500; }
    .feedback-place { font-weight:720; }
    .feedback-score { font-size:15px; font-weight:850; }
    .feedback-text { color:#344139; font-size:14px; line-height:1.55; white-space:pre-wrap; }
    .feedback-text.empty { color:#a1aaa3; }
    .context { color:var(--muted); font-size:12px; }
    .empty-state { padding:36px; border:1px dashed #cbd7cd; border-radius:18px; text-align:center; color:var(--muted); }
    .session-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    details.session { border:1px solid var(--line); border-radius:18px; background:#fff; overflow:hidden; }
    details.session[open] { grid-column:1 / -1; box-shadow:0 10px 28px rgba(31,55,42,.07); }
    summary { list-style:none; cursor:pointer; padding:18px; }
    summary::-webkit-details-marker { display:none; }
    .session-title { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .session-name { font-weight:820; }
    .badge { display:inline-flex; align-items:center; min-height:24px; padding:2px 9px; border-radius:99px; color:var(--green); background:var(--green-soft); font-size:11px; font-weight:800; }
    .session-meta { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:9px; color:var(--muted); font-size:12px; }
    .progress { height:7px; margin-top:13px; border-radius:99px; background:#edf1ec; overflow:hidden; }
    .progress > span { display:block; height:100%; background:var(--green); }
    .session-body { padding:0 18px 18px; }
    .profile { display:flex; gap:16px; align-items:flex-start; padding:16px; margin-bottom:14px; border-radius:16px; background:#f4f8f4; }
    .profile-emoji { font-size:28px; }
    .profile p { margin:5px 0 0; color:var(--muted); font-size:13px; line-height:1.5; }
    .mini-table { width:100%; border-collapse:collapse; font-size:13px; }
    .mini-table th,.mini-table td { padding:11px 8px; border-bottom:1px solid #e6ece7; text-align:left; vertical-align:top; }
    .mini-table th { color:var(--muted); font-size:11px; }
    .mini-table td:nth-child(2) { white-space:nowrap; font-weight:800; }
    .notes { margin-top:18px; color:var(--muted); font-size:12px; line-height:1.6; }
    .notes ul { margin:7px 0 0; padding-left:18px; }
    @media (max-width:1000px) { .stats { grid-template-columns:repeat(3,1fr); } .grid,.analysis-list { grid-template-columns:1fr; } .feedback-row { grid-template-columns:120px minmax(160px,.8fr) 70px minmax(220px,1.5fr); } .context { display:none; } .toolbar { grid-template-columns:1fr 1fr 1fr; } .toolbar input { grid-column:1 / -1; } }
    @media (max-width:700px) { .shell { padding:22px 14px 60px; } .hero { align-items:flex-start; flex-direction:column; } .hero-note { flex:auto; width:100%; } .stats { grid-template-columns:repeat(2,1fr); } .stat { min-height:112px; padding:16px; } .stat-value { font-size:27px; } .panel { padding:18px 14px; } .analysis-card { padding:16px; } .analysis-top { display:block; } .analysis-score { margin-top:10px; text-align:left; } .priority-list,.session-list { grid-template-columns:1fr; } .toolbar { position:static; grid-template-columns:1fr 1fr; } .toolbar input,.toolbar button { grid-column:1 / -1; } .feedback-row { grid-template-columns:1fr auto; gap:7px 12px; } .feedback-user { grid-column:1; } .feedback-score { grid-column:2; grid-row:1; } .feedback-place,.feedback-text { grid-column:1 / -1; } .feedback-place { padding-top:7px; border-top:1px solid #edf1ec; } details.session[open] { grid-column:auto; } .mini-table th:nth-child(4),.mini-table td:nth-child(4) { display:none; } }
    @media print { body { background:#fff; } .shell { width:100%; padding:0; } .toolbar,.btn { display:none !important; } .panel,.stat { box-shadow:none; break-inside:avoid; } details.session:not([open]) { display:none; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <div class="eyebrow">Trip AI · Beta Feedback</div>
        <h1>피드백 한눈에 보기</h1>
        <p class="lead">9월 3일 이후 익명 테스터 로그를 전체 경향부터 개별 의견까지 빠르게 읽을 수 있도록 정리했습니다.</p>
      </div>
      <div class="hero-note">사용자별 분석은 MBTI 결과와 실제 점수·의견을 함께 읽은 해석입니다. 관찰 근거가 부족한 경우에는 별도로 표시했습니다.</div>
    </header>

    <section class="stats" id="stats"></section>

    <section class="grid">
      <article class="panel">
        <div class="panel-head"><div><h2>점수 분포</h2><p class="hint">평가가 입력된 장소만 집계</p></div></div>
        <div class="distribution" id="distribution"></div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h2>데이터 체크</h2><p class="hint">해석 전 먼저 볼 수집 상태</p></div></div>
        <div class="takeaways" id="takeaways"></div>
      </article>
    </section>

    <section class="panel" style="margin-bottom:18px">
      <div class="panel-head"><div><h2>사용자별 여행 취향과 추천 평가 해석</h2><p class="hint">MBTI 세 축을 풀어 쓰고, 높은 점수 패턴과 낮은 점수의 이유를 응답 근거와 함께 정리</p></div><span class="badge">근거 기반 해석</span></div>
      <div class="analysis-list" id="user-analysis-list"></div>
    </section>

    <section class="panel" style="margin-bottom:18px">
      <div class="panel-head"><div><h2>먼저 볼 낮은 점수 의견</h2><p class="hint">1~2점을 주면서 이유를 적은 응답 · 원문 그대로</p></div><span class="badge" id="low-comment-count"></span></div>
      <div class="priority-list" id="priority-list"></div>
    </section>

    <section class="panel" style="margin-bottom:18px">
      <div class="panel-head"><div><h2>전체 장소 피드백</h2><p class="hint">사용자·점수·의견 여부를 조합하거나 장소와 의견을 검색하세요.</p></div></div>
      <div class="toolbar">
        <input class="control" id="filter-query" type="search" placeholder="장소명 또는 의견 검색" aria-label="장소명 또는 의견 검색">
        <select class="control" id="filter-user" aria-label="사용자 필터"></select>
        <select class="control" id="filter-score" aria-label="점수 필터">
          <option value="all">모든 점수</option><option value="low">낮은 점수 (1~2)</option><option value="1">1점</option><option value="2">2점</option><option value="3">3점</option><option value="4">4점</option><option value="5">5점</option><option value="unrated">미평가</option>
        </select>
        <select class="control" id="filter-text" aria-label="의견 필터"><option value="all">의견 전체</option><option value="with">의견 있음</option><option value="without">의견 없음</option></select>
        <button class="btn" id="download-csv" type="button">보이는 결과 CSV</button>
      </div>
      <p class="result-count" id="result-count"></p>
      <div class="feedback-list" id="feedback-list"></div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>사용자별 세션</h2><p class="hint">여행 조건과 세션 안의 모든 장소 평가를 함께 확인</p></div></div>
      <div class="session-list" id="session-list"></div>
      <div class="notes"><strong>원본 주석</strong><ul id="source-notes"></ul></div>
    </section>
  </main>

  <script>const REPORT = ${jsonForScript(data)};</script>
  <script>
    const companionLabels = { alone:"혼자", solo:"혼자", couple:"연인", friends:"친구", family:"가족", parents:"부모님", children:"아이 동반" };
    const transportLabels = { car:"자동차", no_car:"차량 없음", public_transport:"대중교통", mixed:"혼합" };
    const featureLabels = { activity:"활동", restfulness:"휴식", indoor_ratio:"실내", weather_sensitivity:"날씨 영향 적음", physical_ease:"이동 편의", landmark_significance:"대표 명소", photo_value:"사진", scenic_value:"풍경", culture_history:"문화·역사", local_embeddedness:"로컬", distinctiveness:"독특함", theme_park:"테마파크", festival:"축제", cafe:"카페", ocean:"바다", mountain:"산", traditional_market:"전통시장", visit_duration_flexibility:"시간 유연성" };
    const axisLabels = {
      A:["활동","몸을 움직이고 체험하는 일정"], R:["휴식","여유롭고 부담이 적은 일정"],
      O:["야외","자연과 열린 공간"], I:["실내","날씨 영향이 적은 실내 공간"],
      L:["로컬","덜 알려진 동네와 발견"], H:["핫스폿","검증되고 알려진 대표 장소"],
    };
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[char]));
    const pct = (part, total) => total ? Math.round(part / total * 100) : 0;
    const stars = (rating) => rating == null ? "미평가" : "★".repeat(rating) + "☆".repeat(5-rating);
    const contextText = (contexts) => contexts.map((context) => context.kind === "recommendation" ? "추천 " + context.rank + "위" : (context.dayIndex ? context.dayIndex + "일차 일정" : "일정")).join(" · ");
    const featureText = (items) => items.map((item) => featureLabels[item] ?? item).join(", ") || "—";

    document.getElementById("stats").innerHTML = [
      ["참여 사용자", REPORT.computed.users + "명", REPORT.computed.sessions + "개 추천 세션"],
      ["평균 만족도", REPORT.computed.average.toFixed(2) + "점", "5점 만점 · 평가된 장소"],
      ["평가 완료", REPORT.computed.rated + " / " + REPORT.computed.required, pct(REPORT.computed.rated, REPORT.computed.required) + "% 완료"],
      ["자유 의견", REPORT.computed.comments + "건", "평가 중 " + pct(REPORT.computed.comments, REPORT.computed.rated) + "%"],
      ["완료 세션", REPORT.computed.completedSessions + " / " + REPORT.computed.sessions, "모든 장소 평가 완료"],
    ].map(([label,value,sub]) => '<article class="stat"><div class="stat-label">'+label+'</div><div class="stat-value">'+value+'</div><div class="stat-sub">'+sub+'</div></article>').join("");

    const maxDistribution = Math.max(...Object.values(REPORT.computed.distribution), 1);
    document.getElementById("distribution").innerHTML = [5,4,3,2,1].map((score) => {
      const count = REPORT.computed.distribution[score];
      return '<div class="bar-row"><span class="bar-label">'+score+'점</span><div class="bar-track"><div class="bar-fill" style="width:'+pct(count,maxDistribution)+'%"></div></div><span class="bar-count">'+count+'건</span></div>';
    }).join("");

    const low = REPORT.reviews.filter((review) => review.rating != null && review.rating <= 2);
    const lowComments = low.filter((review) => review.text.trim());
    const repeated = REPORT.placeStats.filter((place) => place.count >= 2).sort((a,b) => b.count-a.count || a.average-b.average);
    document.getElementById("takeaways").innerHTML = [
      ["미평가 " + REPORT.computed.unrated + "건", "전체 대상의 " + pct(REPORT.computed.unrated,REPORT.computed.required) + "%로, 점수 평균에서는 제외됩니다."],
      ["낮은 점수 " + low.length + "건", "1~2점 응답 중 이유가 적힌 의견은 " + lowComments.length + "건입니다."],
      ["반복 평가 장소 " + repeated.length + "곳", "같은 장소가 2개 이상 세션에 등장한 경우입니다. 사용자별 맥락을 함께 보세요."],
    ].map(([title,body]) => '<div class="takeaway"><strong>'+title+'</strong><span>'+body+'</span></div>').join("");

    document.getElementById("user-analysis-list").innerHTML = REPORT.userAnalyses.map((analysis) => {
      const axes = analysis.mbtiAxes.map((axis) => {
        const magnitude = Math.abs(Number(axis.score) || 0);
        const strength = magnitude <= .15 ? "중립" : magnitude <= .4 ? "약한 경향" : magnitude <= .7 ? "뚜렷한 경향" : "매우 강한 경향";
        return '<span class="axis-pill"><b>'+escapeHtml(axis.code)+' · '+escapeHtml(axis.label)+' · '+strength+'</b><br>'+escapeHtml(axisLabels[axis.code]?.[1] || "")+'</span>';
      }).join("");
      const highPlaces = analysis.highPlaces.length ? analysis.highPlaces.map((place) => '<span class="place-chip">'+place.rating+'점 · '+escapeHtml(place.place)+'</span>').join("") : '<span class="place-chip">고평가 근거 없음</span>';
      const reasons = analysis.lowReasons.length ? analysis.lowReasons.map((reason) => '<div class="reason"><strong>'+escapeHtml(reason.title)+'</strong><span>'+escapeHtml(reason.detail)+'</span></div>').join("") : '<div class="reason"><strong>직접 확인된 이유 없음</strong><span>낮은 점수의 자유 의견이 없어서 이유를 단정하지 않았습니다.</span></div>';
      const context = [analysis.companion.map((value) => companionLabels[value] || value).join("/"), analysis.transport.map((value) => transportLabels[value] || value).join("/"), analysis.sessions > 1 ? analysis.sessions+"개 세션" : "1개 세션"].filter(Boolean).join(" · ");
      return '<article class="analysis-card"><div class="analysis-top"><div><div class="analysis-user">'+escapeHtml(analysis.user)+' · '+escapeHtml(context)+'</div><h3 class="analysis-headline">'+escapeHtml(analysis.headline)+'</h3></div><div class="analysis-score"><strong>'+(analysis.average == null ? "—" : analysis.average.toFixed(2))+'점</strong><span>'+analysis.rated+'/'+analysis.required+' 평가 · 의견 '+analysis.comments+'건</span></div></div><div class="mbti-box"><div class="mbti-title"><span class="emoji">'+escapeHtml(analysis.mbtiEmoji || "🧭")+'</span><span>'+escapeHtml(analysis.mbtiCode || "—")+' · '+escapeHtml(analysis.mbtiName || "유형 미상")+'</span></div><p>'+escapeHtml(analysis.mbtiDescription || "MBTI 설명 없음")+'</p><div class="axis-list">'+axes+'</div></div><div class="analysis-section"><span class="analysis-label">MBTI를 실제 말로 풀면</span><p class="analysis-copy">'+escapeHtml(analysis.preference)+'</p></div><div class="analysis-section"><span class="analysis-label">추천 리스트를 어떻게 평가했나</span><p class="analysis-copy">'+escapeHtml(analysis.evaluation)+'</p></div><div class="analysis-section"><span class="analysis-label">높은 점수를 준 장소</span><div class="place-chips">'+highPlaces+'</div></div><div class="analysis-section"><span class="analysis-label">낮거나 상대적으로 낮은 점수의 이유</span><div class="reason-list">'+reasons+'</div></div><div class="caveat"><b>해석 범위:</b> '+escapeHtml(analysis.caveat)+'</div></article>';
    }).join("");

    document.getElementById("low-comment-count").textContent = lowComments.length + "건";
    document.getElementById("priority-list").innerHTML = lowComments.length ? lowComments.map((review) => '<article class="quote-card"><div class="quote-meta"><span>'+escapeHtml(review.user)+' · 세션 '+review.logNumber+'</span><span class="rating">'+stars(review.rating)+'</span></div><div class="quote-place">'+escapeHtml(review.place)+'</div><p class="quote-text">'+escapeHtml(review.text)+'</p></article>').join("") : '<div class="empty-state">낮은 점수와 함께 작성된 의견이 없습니다.</div>';

    const userSelect = document.getElementById("filter-user");
    userSelect.innerHTML = '<option value="all">모든 사용자</option>' + REPORT.users.map((user) => '<option value="'+escapeHtml(user)+'">'+escapeHtml(user)+'</option>').join("");
    const filterEls = ["filter-query","filter-user","filter-score","filter-text"].map((id) => document.getElementById(id));
    let visibleReviews = REPORT.reviews;
    filterEls.forEach((element) => element.addEventListener("input", renderReviews));
    renderReviews();

    function renderReviews() {
      const query = document.getElementById("filter-query").value.trim().toLocaleLowerCase("ko");
      const user = document.getElementById("filter-user").value;
      const score = document.getElementById("filter-score").value;
      const text = document.getElementById("filter-text").value;
      visibleReviews = REPORT.reviews.filter((review) => {
        if (user !== "all" && review.user !== user) return false;
        if (score === "low" && !(review.rating != null && review.rating <= 2)) return false;
        if (score === "unrated" && review.rating != null) return false;
        if (/^[1-5]$/.test(score) && review.rating !== Number(score)) return false;
        if (text === "with" && !review.text.trim()) return false;
        if (text === "without" && review.text.trim()) return false;
        if (query && !(review.place + " " + review.text).toLocaleLowerCase("ko").includes(query)) return false;
        return true;
      });
      document.getElementById("result-count").textContent = "총 " + visibleReviews.length + "건 표시 · 자유 의견 " + visibleReviews.filter((review) => review.text.trim()).length + "건";
      document.getElementById("feedback-list").innerHTML = visibleReviews.length ? visibleReviews.map((review) => '<article class="feedback-row '+(review.rating != null && review.rating <= 2 ? "is-low" : "")+'"><div class="feedback-user">'+escapeHtml(review.user)+'<small>세션 '+review.logNumber+' · '+escapeHtml(review.mbtiCode || "MBTI 미상")+'</small></div><div class="feedback-place">'+escapeHtml(review.place)+'<small>ID '+escapeHtml(review.placeId)+'</small></div><div class="feedback-score">'+stars(review.rating)+'</div><div class="feedback-text '+(!review.text.trim() ? "empty" : "")+'">'+(review.text.trim() ? escapeHtml(review.text) : "작성 의견 없음")+'</div><div class="context">'+escapeHtml(contextText(review.contexts))+'</div></article>').join("") : '<div class="empty-state">조건에 맞는 피드백이 없습니다.</div>';
    }

    document.getElementById("download-csv").addEventListener("click", () => {
      const rows = [["사용자","세션","여행 MBTI","장소 ID","장소","점수","의견","노출 맥락"], ...visibleReviews.map((review) => [review.user,review.logNumber,review.mbtiCode || "",review.placeId,review.place,review.rating ?? "",review.text,contextText(review.contexts)])];
      const csv = "\\ufeff" + rows.map((row) => row.map((cell) => '"'+String(cell).replaceAll('"','""')+'"').join(",")).join("\\n");
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); link.download = "travel-feedback-filtered.csv"; link.click(); URL.revokeObjectURL(link.href);
    });

    document.getElementById("session-list").innerHTML = REPORT.sessions.map((session) => {
      const completePct = pct(session.summary.rated,session.summary.required);
      const rows = session.reviews.map((review) => '<tr><td>'+escapeHtml(review.place)+'</td><td>'+stars(review.rating)+'</td><td>'+(review.text.trim() ? escapeHtml(review.text) : '<span style="color:#a1aaa3">—</span>')+'</td><td>'+escapeHtml(contextText(review.contexts))+'</td></tr>').join("");
      const meta = [companionLabels[session.companion] || session.companion || "동행 미지정", session.tripDays ? session.tripDays+"일" : "일수 미지정", transportLabels[session.transport] || session.transport || "이동수단 미지정", "평균 "+(session.summary.average == null ? "—" : Number(session.summary.average).toFixed(2))].join(" · ");
      return '<details class="session"><summary><div class="session-title"><div><div class="session-name">'+escapeHtml(session.user)+' · 세션 '+session.logNumber+'</div><div class="session-meta">'+escapeHtml(meta)+'</div></div><span class="badge">'+session.summary.rated+'/'+session.summary.required+' 완료</span></div><div class="progress"><span style="width:'+completePct+'%"></span></div></summary><div class="session-body"><div class="profile"><div class="profile-emoji">'+escapeHtml(session.mbtiEmoji || "🧭")+'</div><div><strong>'+escapeHtml((session.mbtiCode || "—") + (session.mbtiName ? " · "+session.mbtiName : ""))+'</strong><p>'+escapeHtml(session.mbtiDescription || "여행 MBTI 설명 없음")+'</p><p><b>선호:</b> '+escapeHtml(featureText(session.topPreferences))+' &nbsp; <b>비선호:</b> '+escapeHtml(featureText(session.topAvoidances))+'</p></div></div><div style="overflow:auto"><table class="mini-table"><thead><tr><th>장소</th><th>점수</th><th>의견</th><th>노출 맥락</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></details>';
    }).join("");
    document.getElementById("source-notes").innerHTML = REPORT.notes.map((note) => '<li>'+escapeHtml(note)+'</li>').join("");
  </script>
</body>
</html>\n`;
}
