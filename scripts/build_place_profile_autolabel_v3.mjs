import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const v2Directory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v2-100",
);
const outputDirectory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v3-auto-100",
);
const scoringDirectory = path.join(outputDirectory, "scoring");
const assignmentPartPaths = [1, 2, 3].map((part) => path.join(scoringDirectory, `assignments_part_${part}.json`));

const VERSION = "place-profile-pilot-v3-auto";
const RULESET_VERSION = "companion-month-autolabel-rules-v1";
const CHECKED_AT = "2026-08-10";
const CLIMATE_FIXTURE_CANONICAL_SHA256 = "f4280833510c0a2180093fbfce6671b56d08aae21af034541daa8831653e3370";
const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const CLIMATE_METRIC_KEYS = ["mean_temperature_c", "mean_daily_max_c", "precipitation_mm", "mean_relative_humidity_pct", "mean_wind_ms"];
const MONTH_ARCHETYPE_KEYS = ["indoor_neutral", "outdoor_neutral", "mixed_neutral", "beach_water", "coast_photo", "forest_hike", "hot_spring", "camping_outdoor_sport", "festival_na"];
const LABEL_VALUES = [0, 0.25, 0.5, 0.75, 1];
const FESTIVAL_IDS = new Set(["3482354", "3014969", "3546882", "3554702"]);
const explicitMonthOverrides = {
  "1926379": { "9": 0.75, "10": 0.75, "11": 0.75 },
  "2765234": { "9": 0.75, "10": 0.75, "11": 0.75 },
  "2662743": { "3": 0.75, "4": 0.75, "5": 0.75 },
  "1889809": {
    "1": 0.75,
    "2": 0.75,
    "12": 0.75,
  },
  "2723542": { "3": 0.75, "4": 0.75, "5": 0.75, "6": 0.75, "7": 0.75, "8": 0.75 },
  "2742357": { "6": 0.75, "7": 0.75, "8": 0.75 },
  "2414812": { "3": 0.75, "4": 0.75, "5": 0.75 },
};
const rejectedV2CompanionDirect = new Set(["3396532:solo"]);
const companionContentOverrides = {
  "930345": {
    couple: { value: 0.5, reason: "일반 관광 체험이 아니라 등록형 해녀 양성 교육이므로 동행 강점을 중립으로 낮췄다." },
    friends: { value: 0.5, reason: "일반 관광 체험이 아니라 등록형 해녀 양성 교육이므로 그룹 강점을 중립으로 낮췄다." },
    kids: { value: 0.25, reason: "교육 참가 연령과 자격이 확인되지 않아 아동 동반 적합도를 보수화했다." },
  },
  "131106": {
    kids: { value: 0.25, reason: "테트라포드·방파제 밤낚시의 아동 안전·평탄 진입이 확인되지 않아 보수화했다." },
  },
  "2498698": {
    kids: { value: 0.25, reason: "경사면을 내려오는 익스트림 조브 활동이며 연령·건강 제한이 확인되지 않아 아동 축을 보수화했다." },
  },
  "2723542": {
    kids: { value: 0.5, reason: "대표 경험은 1.2km 해안 산책이고 카약은 선택 사항이라 수상활동 감점을 전체 방문에 적용하지 않았다." },
    parents: { value: 0.5, reason: "대표 경험은 1.2km 해안 산책이고 카약은 선택 사항이라 수상활동 감점을 전체 방문에 적용하지 않았다." },
  },
  "126449": {
    kids: { value: 0.25, reason: "파도가 잦고 높은 해변과 수상레저 중심 경험을 반영해 아동 축을 보수화했다." },
  },
  "2738721": {
    kids: { value: 0.5, reason: "365m 공개 동굴과 공원·식물원 복합 방문이라 장거리 hiking 감점을 적용하지 않았다." },
    parents: { value: 0.5, reason: "365m 공개 동굴과 공원·식물원 복합 방문이라 장거리 hiking 감점을 적용하지 않았다." },
  },
  "2738730": {
    kids: { value: 0.5, reason: "세 코스가 비교적 잘 조성되어 편하게 걸을 수 있다는 조사 사실을 반영했다." },
    parents: { value: 0.5, reason: "세 코스가 비교적 잘 조성되어 편하게 걸을 수 있다는 조사 사실을 반영했다." },
  },
  "128049": {
    solo: { value: 0.5, reason: "미니어처·캐릭터·공룡 전시가 중심이고 고카트는 선택형이므로 solo 감점을 완화했다." },
    kids: { value: 0.75, reason: "공룡·동화·캐릭터 전시와 가족 체험 단서를 반영했다." },
    parents: { value: 0.5, reason: "고카트는 선택형이므로 활동형 부모님 감점을 전체 공원에 적용하지 않았다." },
  },
  "3439423": {
    couple: { value: 0.5, reason: "아동 중심 키즈 공간이므로 일반 hands-on 유형의 커플 강점을 중립으로 낮췄다." },
    friends: { value: 0.5, reason: "아동 중심 키즈 공간이므로 일반 hands-on 유형의 친구 강점을 중립으로 낮췄다." },
  },
  "600584": {
    parents: { value: 0.5, reason: "실내 수영장·사우나·노천탕이 섞인 시설이라 수상활동 감점을 전체 경험에 적용하지 않았다." },
  },
  "3031541": {
    solo: { value: 0.5, reason: "트랙·그늘·공원 산책은 혼자 이용 가능하고 고강도 스포츠는 선택 사항이다." },
    parents: { value: 0.5, reason: "고강도 스포츠는 선택 사항이고 공원 산책·그늘 이용은 중립 경험이다." },
  },
  "129071": {
    parents: { value: 0.5, reason: "마을 산책이 기본이고 식산봉·유람선·낚시는 선택 경험이라 활동 감점을 완화했다." },
  },
  "2730822": {
    solo: { value: 0.5, reason: "1인 숙영 금지나 직접 안전 마찰 근거가 없어 camping 기본 중립으로 복원했다." },
  },
  "2744499": {
    solo: { value: 0.5, reason: "1인 숙영 금지나 직접 안전 마찰 근거가 없어 camping 기본 중립으로 복원했다." },
  },
  "2705373": {
    parents: { value: 0.5, reason: "자동 주행으로 페달 부담이 적다는 조사 사실을 반영해 부모님 축을 중립으로 완화했다." },
  },
  "3067072": {
    solo: { value: 0.5, reason: "개인이 말 한 필을 타는 승마이며 최소 동행 인원 근거가 없어 solo를 중립으로 완화했다." },
  },
  "126457": {
    parents: { value: 0.5, reason: "절벽 중턱 위치만 확인되고 실제 접근 거리·경사·계단이 미확인이라 역사 장소의 부모님 강점을 중립으로 낮췄다." },
  },
};

const companionProfiles = {
  schema_version: "companion-archetype-profiles-v1",
  scale: {
    "0": "핵심 경험이 명백히 불가능하거나 부적합",
    "0.25": "큰 마찰이 있어 낮음",
    "0.5": "무난한 중립",
    "0.75": "명확히 잘 맞음",
    "1": "대표적 강점이고 마찰이 거의 없음",
  },
  assumptions: {
    solo: "성인 1인",
    couple: "성인 2인",
    friends: "성인 2~5인",
    kids: "보행 가능한 만 4~12세 동반",
    parents: "평균 보행이 가능한 60대 이상 동반",
  },
  prior_extreme_policy: "직접 근거가 없는 archetype prior는 0.25~0.75로 제한한다.",
  profiles: {
    quiet_indoor_reading_or_meditation: { solo: 0.75, couple: 0.5, friends: 0.25, kids: 0.25, parents: 0.5 },
    indoor_culture_or_performance: { solo: 0.75, couple: 0.75, friends: 0.5, kids: 0.5, parents: 0.75 },
    hands_on_craft_or_education: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.5 },
    scenic_photo_or_light_stroll: { solo: 0.75, couple: 0.75, friends: 0.75, kids: 0.5, parents: 0.5 },
    history_or_religion: { solo: 0.75, couple: 0.5, friends: 0.5, kids: 0.25, parents: 0.75 },
    park_picnic_or_play: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.75 },
    beach_or_water: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.5 },
    hiking_or_trail: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.25, parents: 0.25 },
    spa_or_wellness: { solo: 0.75, couple: 0.75, friends: 0.5, kids: 0.5, parents: 0.75 },
    active_shared_ride_or_leisure: { solo: 0.25, couple: 0.75, friends: 0.75, kids: 0.5, parents: 0.25 },
    camping: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.25 },
    golf_or_team_play: { solo: 0.25, couple: 0.5, friends: 0.75, kids: 0.25, parents: 0.5 },
    transport_or_ferry: { solo: 0.5, couple: 0.5, friends: 0.5, kids: 0.5, parents: 0.5 },
    festival_or_event: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.5, parents: 0.5 },
    sports_spectator: { solo: 0.75, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.75 },
    unresolved_generic: { solo: 0.5, couple: 0.5, friends: 0.5, kids: 0.5, parents: 0.5 },
  },
};

const climateInputPath = path.join(
  workspaceRoot,
  "data",
  "climate",
  "kma",
  "1991-2020",
  "jeju_four_station_monthly_normals.json",
);
const climateInputFixture = readJson(climateInputPath);
verifyClimateInputFixture(climateInputFixture);
const climateInputSha256 = sha256File(climateInputPath);
const climateBaseline = buildClimateBaseline(climateInputFixture, climateInputSha256);
const monthProfiles = buildMonthProfiles(climateInputFixture, climateInputSha256);

const companionArchetypeLabels = {
  quiet_indoor_reading_or_meditation: "조용한 실내 독서·명상",
  indoor_culture_or_performance: "실내 문화·공연 관람",
  hands_on_craft_or_education: "참여형 공예·교육 체험",
  scenic_photo_or_light_stroll: "경관·사진·가벼운 산책",
  history_or_religion: "역사·종교 관람",
  park_picnic_or_play: "공원·피크닉·놀이",
  beach_or_water: "해변·수상 경험",
  hiking_or_trail: "오름·숲·트레일",
  spa_or_wellness: "스파·웰니스",
  active_shared_ride_or_leisure: "함께하는 탑승·액티비티",
  camping: "캠핑·야외 숙영",
  golf_or_team_play: "골프·팀 활동",
  transport_or_ferry: "교통·여객선",
  festival_or_event: "축제·행사",
  sports_spectator: "스포츠 관람",
  unresolved_generic: "중립 일반 경험",
};

const monthArchetypeLabels = {
  indoor_neutral: "실내 연중 중립",
  outdoor_neutral: "일반 야외 기후",
  mixed_neutral: "실내외 혼합 기후",
  beach_water: "해변·수상 계절",
  coast_photo: "해안 경관·산책 계절",
  forest_hike: "숲·오름·트레킹 계절",
  hot_spring: "온천·웰니스 계절",
  camping_outdoor_sport: "캠핑·야외 스포츠 계절",
  festival_na: "개최일 종속 축제",
};

const flagLabels = {
  long_walk: "긴 보행",
  high_effort: "높은 체력 부담",
  steep_stairs: "급경사·계단",
  quiet_small_space: "조용한 소규모 공간",
  scenic_photo: "경관·사진 중심",
  shared_activity: "공동 활동",
  kids_specific: "아동 중심",
  kids_friendly: "아동 친화 직접 단서",
  senior_friendly: "고령자 친화 직접 단서",
  family_friendly: "가족 친화 직접 단서",
  min_party_2: "최소 2인 조건",
  solo_safety: "혼자 방문 안전 마찰",
  overnight: "숙영 경험",
  water_activity: "수상 활동",
  weather_gate: "기상 조건",
  aggregate: "여러 하위 경험의 집합",
  uncertain_environment: "공간 성격 불확실",
  coordinate_anomaly: "좌표 품질 이상",
  reservation_gate: "예약 조건",
  seasonal_operation: "계절 운영 조건",
};

const flagModifiers = {
  long_walk: { kids: -0.25, parents: -0.25 },
  high_effort: { kids: -0.25, parents: -0.25 },
  steep_stairs: { kids: -0.25, parents: -0.25 },
  quiet_small_space: { solo: 0.25, friends: -0.25 },
  scenic_photo: { couple: 0.25 },
  shared_activity: { friends: 0.25 },
  kids_specific: { kids: 0.25 },
  kids_friendly: { kids: 0.25 },
  family_friendly: { kids: 0.25 },
  senior_friendly: { parents: 0.25 },
  solo_safety: { solo: -0.25 },
  overnight: { solo: -0.25, parents: -0.25 },
  water_activity: { parents: -0.25 },
};

const constraintScopes = {
  reservation: {
    "635593": "5인 이상 천연염색 체험",
    "635460": "도자기 체험행사·단체 안내",
    "128443": "물홍보관·공장 견학",
    "745449": "족욕 체험",
    "130180": "단체 전시 설명",
    "930345": "해녀 양성 교육 프로그램",
  },
  seasonal_operation: {
    "3071875": "감귤·레드향·천혜향 수확 체험",
    "129400": "해수욕 개장기 시설",
    "1918639": "해수욕·수상 체험과 개장기 시설",
    "126447": "해수욕과 샤워실·탈의실",
    "126449": "해수욕 개장·수상레저별 운영",
  },
  weather: {
    "128150": "차밭 야외 관람",
    "128802": "마라도 여객선 운항",
    "127052": "폭포 관람·수량",
    "126449": "해수욕·수상레저",
    "228854": "용머리해안 탐방로 입장",
    "131829": "제트보트·파라세일링·배낚시",
    "2705373": "레일바이크 탑승",
    "2414827": "숲길 탐방",
    "2498698": "빅볼·조브 야외 탑승",
  },
  mobility: {
    "2765227": "가파른 바리메오름 탐방 구간",
    "577461": "급경사 다랑쉬오름 탐방 구간",
    "2704351": "영주산의 긴 계단을 포함한 동쪽 탐방로",
    "228854": "휴게소에서 해안 입구로 내려가는 좁은 파식대 탐방로",
    "126452": "1km 공개 동굴 탐방 구간",
    "3031541": "운동시설·고강도 스포츠 참여",
    "129071": "올레 2코스·식산봉 오름 선택 구간",
    "130474": "전통가옥·체험장 도보 관람 동선",
    "1839451": "15.1km 올레 1코스와 오름 구간",
    "1839709": "11.8km 올레 9코스와 가파른 월라봉 구간",
    "2370834": "10km 이상 지질트레일 코스",
    "2806561": "7.5km 하영올레 도보 코스",
  },
};

const seasonalConstraintOverrides = {
  "126449": {
    condition: "해수욕장 개장 기간과 수상레저별 운영 조건은 확인되지 않았다.",
    status: "unknown",
  },
};

const optionalEffortAggregateIds = new Set(["127863"]);

const customConstraintSpecs = {
  "127863": [
    { kind: "weather_operation", applies_to: "추자도 여객선 입도", condition: "배편 시간표와 기상에 따른 결항 여부는 확인되지 않았다.", status: "unknown", action: "verify", rule_id: "GATE-CHUJA-FERRY" },
    { kind: "mobility_access", applies_to: "추자올레 선택 코스", condition: "추자올레의 선택 코스 거리·경사·소요시간과 접근 편의를 확인해야 한다.", status: "unknown", action: "verify", rule_id: "GATE-CHUJA-OLLE" },
  ],
  "3396532": [
    { kind: "age", applies_to: "싱잉볼 사운드힐링 체험", condition: "체험 가능 연령은 8세 이상이다.", status: "confirmed", action: "exclude", rule_id: "GATE-AGE-8" },
  ],
  "131829": [
    { kind: "age", applies_to: "제주제트 해양 레저", condition: "이용자는 만 5세 이상이어야 하며 종목별 신장·보호자 조건은 추가 확인한다.", status: "confirmed", action: "exclude", rule_id: "GATE-AGE-5" },
  ],
  "2498698": [
    { kind: "age_health", applies_to: "빅볼·조브 탑승", condition: "익스트림 비탈 하강 활동의 세부 연령·신장·건강 제한을 방문 전 확인해야 한다.", status: "unknown", action: "verify", rule_id: "GATE-EXTREME-ELIGIBILITY" },
  ],
  "930345": [
    { kind: "program_eligibility", applies_to: "해녀 양성 교육 프로그램", condition: "일반 관광 체험이 아닌 교육 프로그램이므로 모집 대상·연령·참가 자격과 운영 여부를 확인해야 한다.", status: "unknown", action: "verify", rule_id: "GATE-PROGRAM-ELIGIBILITY" },
  ],
  "131106": [
    { kind: "mobility_access", applies_to: "테트라포드·방파제 야간 낚시", condition: "테트라포드 접근 안전과 평탄 진입 동선이 확인되지 않았다.", status: "unknown", action: "verify", rule_id: "GATE-BREAKWATER-ACCESS" },
  ],
  "1839784": [
    { kind: "safety_time", applies_to: "올레 코스 단독 보행", condition: "혼자 걷는 여행자는 오전 9시 무렵 다른 사람과 출발을 맞추고 늦은 출발을 피하라는 안전수칙을 확인해야 한다.", status: "confirmed", action: "verify", rule_id: "GATE-OLLE-SOLO-TIME" },
  ],
  "1839451": [
    { kind: "safety_time", applies_to: "올레 코스 단독 보행", condition: "혼자 걷는 여행자는 오전 9시 무렵 출발하고 위치·안전을 알리며 늦은 출발을 피해야 한다.", status: "confirmed", action: "verify", rule_id: "GATE-OLLE-SOLO-TIME" },
  ],
  "1839709": [
    { kind: "safety_time", applies_to: "올레 코스 단독 보행", condition: "혼자 걷는 여행자는 오전 9시 무렵 출발하고 위치·안전을 알리며 늦은 출발을 피해야 한다.", status: "confirmed", action: "verify", rule_id: "GATE-OLLE-SOLO-TIME" },
  ],
};

function values(monthValues) {
  return Object.fromEntries(MONTH_KEYS.map((month, index) => [month, monthValues[index]]));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalFixtureSha256(fixture) {
  const { canonical_sha256: ignoredCanonicalSha256, ...payload } = fixture;
  void ignoredCanonicalSha256;
  return crypto.createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}

function exactKeys(value, expectedKeys, message) {
  assert(value && typeof value === "object" && !Array.isArray(value), message);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort()), message);
}

function oneDecimalMean(valuesToAverage) {
  const tenths = valuesToAverage.map((value) => Math.round(value * 10));
  return Math.round(tenths.reduce((sum, value) => sum + value, 0) / tenths.length) / 10;
}

function verifyClimateInputFixture(fixture) {
  assert(fixture.schema_version === "kma-jeju-four-station-climate-input-v1", "Climate fixture schema differs");
  assert(fixture.baseline_period === "1991-2020", "Climate fixture period differs");
  assert(fixture.checked_at === CHECKED_AT, "Climate fixture checked_at differs");
  assert(
    fixture.canonicalization === "SHA-256 of UTF-8 recursive lexicographic-key JSON for this object with canonical_sha256 omitted",
    "Climate fixture canonicalization differs",
  );
  const computedCanonicalSha256 = canonicalFixtureSha256(fixture);
  assert(fixture.canonical_sha256 === computedCanonicalSha256, "Climate fixture canonical SHA-256 is invalid");
  assert(fixture.canonical_sha256 === CLIMATE_FIXTURE_CANONICAL_SHA256, "Climate fixture is not the pinned input version");
  assert(JSON.stringify(fixture.month_order) === JSON.stringify(MONTH_KEYS), "Climate fixture month order differs");

  const expectedSourceIds = [
    "kma_normals_definition",
    "kma_climate_table_pdf",
    "kma_rainy_season",
    "kma_typhoon_statistics",
    "kma_jeju_region_climate",
  ];
  assert(Array.isArray(fixture.sources), "Climate fixture sources must be an array");
  assert(JSON.stringify(fixture.sources.map((source) => source.id)) === JSON.stringify(expectedSourceIds), "Climate fixture source IDs differ");
  for (const source of fixture.sources) {
    assert(/^https:\/\/(?:data\.kma\.go\.kr|www\.weather\.go\.kr)\//.test(source.url), `Non-KMA climate source: ${source.url}`);
    assert(source.publisher && source.title && source.claim, `Incomplete climate source: ${source.id}`);
  }
  const pdfSource = fixture.sources.find((source) => source.id === "kma_climate_table_pdf");
  assert(/^[0-9a-f]{64}$/.test(pdfSource.document_sha256), "KMA climate table document hash is invalid");
  assert(Number.isInteger(pdfSource.document_size_bytes) && pdfSource.document_size_bytes > 0, "KMA climate table document size is invalid");

  const expectedStations = [
    ["184", "제주", ["II-79", "II-80"], [147, 148]],
    ["185", "고산", ["II-81", "II-82"], [149, 150]],
    ["188", "성산", ["II-83", "II-84"], [151, 152]],
    ["189", "서귀포", ["II-85", "II-86"], [153, 154]],
  ];
  assert(Array.isArray(fixture.stations) && fixture.stations.length === 4, "Climate fixture must have four stations");
  fixture.stations.forEach((station, stationIndex) => {
    const [stationId, stationName, printedPages, pdfPages] = expectedStations[stationIndex];
    assert(station.station_id === stationId && station.station_name === stationName, `Climate station identity differs at ${stationIndex}`);
    assert(station.source_id === "kma_climate_table_pdf", `Climate station source differs for ${stationId}`);
    assert(JSON.stringify(station.printed_pages) === JSON.stringify(printedPages), `Printed table pages differ for ${stationId}`);
    assert(JSON.stringify(station.pdf_pages_1_based) === JSON.stringify(pdfPages), `PDF table pages differ for ${stationId}`);
    exactKeys(station.monthly, CLIMATE_METRIC_KEYS, `Climate metric set differs for ${stationId}`);
    for (const metric of CLIMATE_METRIC_KEYS) {
      const metricValues = station.monthly[metric];
      assert(Array.isArray(metricValues) && metricValues.length === 12, `${stationId} ${metric} must have 12 months`);
      assert(metricValues.every((value) => Number.isFinite(value)), `${stationId} ${metric} contains a non-number`);
      if (metric === "mean_relative_humidity_pct") {
        assert(metricValues.every((value) => value >= 0 && value <= 100), `${stationId} relative humidity is out of range`);
      } else if (metric === "precipitation_mm" || metric === "mean_wind_ms") {
        assert(metricValues.every((value) => value >= 0), `${stationId} ${metric} is negative`);
      }
    }
  });

  assert(fixture.typhoon_korea_impact_monthly.source_id === "kma_typhoon_statistics", "Typhoon source differs");
  exactKeys(fixture.typhoon_korea_impact_monthly.values, MONTH_KEYS, "Typhoon monthly keys differ");
  assert(Object.values(fixture.typhoon_korea_impact_monthly.values).every((value) => Number.isFinite(value) && value >= 0), "Typhoon monthly values are invalid");
  assert(fixture.rainy_season_jeju_1991_2020.source_id === "kma_rainy_season", "Rainy-season source differs");
  assert(Number.isFinite(fixture.rainy_season_jeju_1991_2020.precipitation_mm), "Rainy-season value is invalid");

  exactKeys(fixture.product_policy.outdoor_comfort, MONTH_KEYS, "Outdoor-comfort month keys differ");
  assert(Object.values(fixture.product_policy.outdoor_comfort).every((value) => LABEL_VALUES.includes(value)), "Outdoor-comfort value is invalid");
  exactKeys(fixture.product_policy.month_profiles, MONTH_ARCHETYPE_KEYS, "Month-profile archetypes differ");
  for (const archetype of MONTH_ARCHETYPE_KEYS) {
    const vector = fixture.product_policy.month_profiles[archetype];
    assert(Array.isArray(vector) && vector.length === 12, `Month-profile vector must have 12 values: ${archetype}`);
    if (archetype === "festival_na") {
      assert(vector.every((value) => value === null), "Festival month-profile vector must be N/A");
    } else {
      assert(vector.every((value) => LABEL_VALUES.includes(value)), `Month-profile vector contains an invalid value: ${archetype}`);
    }
  }
  assert(
    JSON.stringify(values(fixture.product_policy.month_profiles.outdoor_neutral)) === JSON.stringify(fixture.product_policy.outdoor_comfort),
    "Outdoor-comfort and outdoor-neutral vectors differ",
  );
}

function fixtureProvenance(fixture, fileSha256) {
  return {
    path: relativePath(climateInputPath),
    sha256: fileSha256,
    canonical_sha256: fixture.canonical_sha256,
  };
}

function buildClimateBaseline(fixture, fileSha256) {
  const monthlyNormals = {
    metric_note: "공식 4지점 월표의 단순 산술평균. typhoon_korea_impact는 제주 전용 통계가 아니다.",
  };
  for (const [monthIndex, month] of MONTH_KEYS.entries()) {
    monthlyNormals[month] = {
      mean_temperature_c: oneDecimalMean(fixture.stations.map((station) => station.monthly.mean_temperature_c[monthIndex])),
      precipitation_mm: oneDecimalMean(fixture.stations.map((station) => station.monthly.precipitation_mm[monthIndex])),
      mean_wind_ms: oneDecimalMean(fixture.stations.map((station) => station.monthly.mean_wind_ms[monthIndex])),
      typhoon_korea_impact: fixture.typhoon_korea_impact_monthly.values[month],
    };
  }

  const summerHeatHumidity = {
    metric_note: "한국기후표 4지점의 평균 일최고기온과 평균 상대습도를 단순 산술평균한 여름·초가을 보조값",
  };
  for (const month of ["6", "7", "8", "9"]) {
    const monthIndex = Number(month) - 1;
    summerHeatHumidity[month] = {
      mean_daily_max_c: oneDecimalMean(fixture.stations.map((station) => station.monthly.mean_daily_max_c[monthIndex])),
      mean_relative_humidity_pct: oneDecimalMean(fixture.stations.map((station) => station.monthly.mean_relative_humidity_pct[monthIndex])),
    };
  }

  return {
    schema_version: "jeju-monthly-climate-comfort-v1",
    baseline_period: fixture.baseline_period,
    checked_at: fixture.checked_at,
    input_fixture: fixtureProvenance(fixture, fileSha256),
    station_scope: `${fixture.station_scope.description} 월평년의 단순 산술평균`,
    station_scope_note: `이 평균은 ${fixture.station_scope.disclosure}.`,
    data_kind: "기후평년값이며 실시간 예보가 아님",
    sources: fixture.sources,
    station_tables: fixture.stations.map((station) => ({
      station_id: station.station_id,
      station_name: station.station_name,
      source_id: station.source_id,
      printed_pages: station.printed_pages,
      pdf_pages_1_based: station.pdf_pages_1_based,
    })),
    rainy_season_jeju_1991_2020: fixture.rainy_season_jeju_1991_2020,
    monthly_normals_four_station_mean: monthlyNormals,
    summer_heat_humidity_four_station_mean: summerHeatHumidity,
    outdoor_comfort: fixture.product_policy.outdoor_comfort,
    policy_thresholds: fixture.product_policy.policy_thresholds,
    interpretation: fixture.product_policy.interpretation,
  };
}

function buildMonthProfiles(fixture, fileSha256) {
  return {
    schema_version: "month-archetype-profiles-v1",
    baseline_ref: "climate_baseline.json",
    input_fixture: fixtureProvenance(fixture, fileSha256),
    prior_extreme_policy: "직접 계절 근거가 없는 month prior는 0.25~0.75로 제한한다.",
    profiles: Object.fromEntries(
      MONTH_ARCHETYPE_KEYS.map((archetype) => [archetype, values(fixture.product_policy.month_profiles[archetype])]),
    ),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clampPrior(value) {
  return Math.max(0.25, Math.min(0.75, value));
}

function quarter(value) {
  const candidates = [0.25, 0.5, 0.75];
  return [...candidates].sort((left, right) => {
    const distance = Math.abs(left - value) - Math.abs(right - value);
    return distance || Math.abs(left - 0.5) - Math.abs(right - 0.5);
  })[0];
}

function confidenceSummary(axisMap) {
  const numeric = Object.values(axisMap).map((axis) => axis.confidence).filter((value) => typeof value === "number");
  if (!numeric.length) return null;
  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return [0, 0.25, 0.5, 0.75, 1].filter((value) => value <= average).at(-1) ?? 0;
}

function directCompanionAxis(profile, research, key) {
  const value = profile.companion_fit[key];
  if (value === null || rejectedV2CompanionDirect.has(`${profile.contentid}:${key}`)) return null;
  return {
    value,
    confidence: Math.max(0.5, research.confidence?.companion_fit ?? 0.75),
    inference_level: "direct_evidence",
    rationale: research.companion_rationale[key],
    evidence_ids: [`web_research:${research.contentid}`],
    rule_ids: ["COMP-DIRECT-V2"],
  };
}

function priorCompanionAxis(assignment, key) {
  const contentOverride = companionContentOverrides[assignment.contentid]?.[key];
  if (contentOverride) {
    return {
      value: contentOverride.value,
      confidence: 0.5,
      inference_level: "researched_inference",
      rationale: contentOverride.reason,
      evidence_ids: [`web_research:${assignment.contentid}`],
      rule_ids: ["COMP-CONTENTID-EXCEPTION"],
    };
  }
  const profile = companionProfiles.profiles[assignment.companion_archetype];
  let raw = profile[key];
  const appliedFlags = [];
  for (const flag of assignment.flags) {
    const delta = flagModifiers[flag]?.[key];
    if (typeof delta !== "number") continue;
    raw += delta;
    appliedFlags.push(flag);
  }

  if (key === "kids" && assignment.flags.includes("water_activity") && !assignment.flags.some((flag) => ["kids_specific", "kids_friendly", "family_friendly"].includes(flag))) {
    raw -= 0.25;
    appliedFlags.push("water_activity");
  }

  const isConfirmedMinimumParty = key === "solo" && assignment.flags.includes("min_party_2");
  const value = isConfirmedMinimumParty ? 0 : quarter(clampPrior(raw));
  const inferenceLevel = isConfirmedMinimumParty ? "direct_evidence" : appliedFlags.length ? "researched_inference" : "archetype_prior";
  const confidence = isConfirmedMinimumParty ? 0.75 : 0.5;
  const modifierText = isConfirmedMinimumParty
    ? " 조사 페이지의 대표 경험에 기본 2인 탑승이 명시되어 1인 solo를 불가로 적용했다."
    : appliedFlags.length
      ? ` 조사 사실에서 ${[...new Set(appliedFlags)].map((flag) => flagLabels[flag]).join("·")} 보정을 적용했다.`
      : " 직접 동행 추천 문장은 없어 유형 사전값을 적용했다.";
  return {
    value,
    confidence,
    inference_level: inferenceLevel,
    rationale: `${companionArchetypeLabels[assignment.companion_archetype]}의 ${key} 기본값에서 시작했다.${modifierText} 필수 조건은 별도 제약으로 확인한다.`,
    evidence_ids: [`web_research:${assignment.contentid}`],
    rule_ids: [
      `COMP-ARCHETYPE-${assignment.companion_archetype.toUpperCase()}`,
      ...[...new Set(appliedFlags)].map((flag) => `COMP-MOD-${flag.toUpperCase()}`),
      ...(isConfirmedMinimumParty ? ["COMP-HARD-MIN-PARTY-2"] : []),
    ],
  };
}

function directMonthAxis(research, month) {
  const value = explicitMonthOverrides[research.contentid]?.[month];
  if (value === undefined) return null;
  return {
    value,
    confidence: 0.75,
    inference_level: "direct_evidence",
    rationale: `${month}월은 웹 본문의 '${research.facts.seasonality}' 계절 단서를 우선 적용했다.`,
    evidence_ids: [`web_research:${research.contentid}`],
    rule_ids: ["MONTH-DIRECT-SEASON"],
  };
}

function priorMonthAxis(assignment, month) {
  const value = monthProfiles.profiles[assignment.month_archetype][month];
  const indoor = assignment.month_archetype === "indoor_neutral";
  return {
    value,
    confidence: assignment.flags.includes("uncertain_environment") ? 0.25 : 0.5,
    inference_level: indoor ? "archetype_prior" : "climate_heuristic",
    rationale: `${month}월은 ${monthArchetypeLabels[assignment.month_archetype]} 프로필과 1991~2020 제주 기후평년 규칙을 적용한 AI 사전값이다. 실시간 예보·휴무·운영기간은 반영하지 않았다.`,
    evidence_ids: ["climate_baseline:1991-2020", `web_research:${assignment.contentid}`],
    rule_ids: [`MONTH-ARCHETYPE-${assignment.month_archetype.toUpperCase()}`],
  };
}

function festivalMonthAxis(assignment, month) {
  return {
    value: null,
    confidence: null,
    inference_level: "not_applicable",
    null_reason: "date_gated_not_applicable",
    rationale: `${month}월 점수는 개최일이 먼저 확정돼야 하는 축제에 적용하지 않는다. 과거 개최월을 평년 적합도로 재사용하지 않고 확정 날짜 제약으로 처리한다.`,
    evidence_ids: [`web_research:${assignment.contentid}`],
    rule_ids: ["MONTH-FESTIVAL-DATE-GATED-NA"],
  };
}

function makeHardConstraints(assignment, research) {
  const constraints = [];
  const source = research.sources[0]?.url ?? null;
  const add = (kind, appliesTo, condition, status, action, ruleId) => constraints.push({
    kind,
    applies_to: appliesTo,
    condition,
    status,
    action,
    source,
    checked_at: research.checked_at,
    rule_id: ruleId,
  });

  if (FESTIVAL_IDS.has(assignment.contentid)) {
    add("date_or_operation", "축제 참가", `다음 개최일과 운영 여부 확인 필요. 조사 당시 정보: ${research.facts.availability ?? "과거 행사 정보"}`, "stale", "verify", "GATE-FESTIVAL-DATE");
  }
  if (assignment.flags.includes("reservation_gate")) {
    add("reservation", constraintScopes.reservation[assignment.contentid] ?? "예약형 체험·프로그램", research.facts.availability ?? "사전 예약 여부를 확인해야 한다.", "confirmed", "verify", "GATE-RESERVATION");
  }
  if (assignment.flags.includes("min_party_2")) {
    add("party_size", "빅볼·조브 탑승", "기본 탑승은 최소 2인으로 안내된다.", "confirmed", "exclude", "GATE-MIN-PARTY");
  }
  if (assignment.flags.includes("weather_gate")) {
    add("weather", constraintScopes.weather[assignment.contentid] ?? "기상 영향을 받는 핵심 경험", research.facts.rain ?? research.facts.wind ?? research.facts.availability ?? "기상에 따른 통제 여부를 확인해야 한다.", "confirmed", "verify", "GATE-WEATHER");
  }
  if (assignment.flags.includes("seasonal_operation")) {
    const override = seasonalConstraintOverrides[assignment.contentid];
    add(
      "date_or_operation",
      constraintScopes.seasonal_operation[assignment.contentid] ?? "계절형 체험·부대시설",
      override?.condition ?? research.facts.availability ?? "계절 운영 기간을 확인해야 한다.",
      override?.status ?? "confirmed",
      "verify",
      "GATE-SEASONAL-OPERATION",
    );
  }
  if (assignment.flags.some((flag) => ["long_walk", "high_effort", "steep_stairs"].includes(flag))) {
    add("mobility_access", constraintScopes.mobility[assignment.contentid] ?? "보행·경사 부담이 있는 핵심 탐방 구간", [research.facts.walking, research.facts.stairs_slopes].filter(Boolean).join(" ") || "보행 부담을 확인해야 한다.", "confirmed", "verify", "GATE-MOBILITY");
  }
  for (const spec of customConstraintSpecs[assignment.contentid] ?? []) {
    add(spec.kind, spec.applies_to, spec.condition, spec.status, spec.action, spec.rule_id);
  }
  return constraints;
}

function reviewPriority(assignment, hardConstraints, companionFit, baseProfile) {
  const highFlags = ["uncertain_environment", "coordinate_anomaly", "solo_safety"];
  const mediumFlags = [
    "aggregate",
    "long_walk",
    "high_effort",
    "steep_stairs",
    "min_party_2",
    "overnight",
    "water_activity",
    "weather_gate",
    "reservation_gate",
    "seasonal_operation",
  ];
  const reasons = [];
  const explicitHighIds = new Set(["131829", "2498698", "131106", "129071"]);
  if (FESTIVAL_IDS.has(assignment.contentid)) reasons.push("다음 개최일이 확정돼야 하는 축제다.");
  for (const flag of highFlags) if (assignment.flags.includes(flag)) reasons.push(flagLabels[flag]);
  const compoundedSafetyRisk =
    (assignment.flags.includes("high_effort") && assignment.flags.includes("steep_stairs")) ||
    (assignment.flags.includes("weather_gate") && assignment.flags.includes("water_activity"));
  if (compoundedSafetyRisk) reasons.push("두 개 이상의 안전·접근 조건이 함께 적용된다.");
  if (explicitHighIds.has(assignment.contentid)) reasons.push("연령·안전·접근 또는 복합 활동 조건을 우선 확인해야 한다.");
  if (FESTIVAL_IDS.has(assignment.contentid) || explicitHighIds.has(assignment.contentid) || compoundedSafetyRisk || highFlags.some((flag) => assignment.flags.includes(flag))) {
    return { priority: "high", reasons };
  }
  for (const flag of mediumFlags) if (assignment.flags.includes(flag)) reasons.push(flagLabels[flag]);
  const inferredSensitiveAxes = ["kids", "parents"].filter((key) => companionFit[key].inference_level !== "direct_evidence" && companionFit[key].value !== 0.5);
  if (inferredSensitiveAxes.length) reasons.push(`직접 근거가 아닌 ${inferredSensitiveAxes.join("·")} 비중립값을 확인해야 한다.`);
  if (baseProfile.label_evidence.physical_effort >= 0.75 && !optionalEffortAggregateIds.has(assignment.contentid)) {
    reasons.push("조사된 체력 부담이 높아 접근 적합도를 확인해야 한다.");
  }
  if (hardConstraints.length || reasons.length) return { priority: "medium", reasons: reasons.length ? reasons : ["필수 조건을 우선 확인해야 한다."] };
  return { priority: "low", reasons: ["직접 충돌·안전 제약이 없고 고정된 장소 유형 규칙으로 설명된다."] };
}

function makeProposal(profile, research, assignment) {
  const companionFit = Object.fromEntries(COMPANION_KEYS.map((key) => [
    key,
    directCompanionAxis(profile, research, key) ?? priorCompanionAxis(assignment, key),
  ]));
  const festival = FESTIVAL_IDS.has(profile.contentid);
  const monthFit = Object.fromEntries(MONTH_KEYS.map((month) => [
    month,
    festival
      ? festivalMonthAxis(assignment, month)
      : directMonthAxis(research, month) ?? priorMonthAxis(assignment, month),
  ]));
  const hardConstraints = makeHardConstraints(assignment, research);
  const priority = reviewPriority(assignment, hardConstraints, companionFit, profile);

  return {
    contentid: profile.contentid,
    title: profile.title,
    algorithm_version: RULESET_VERSION,
    companion_archetype: assignment.companion_archetype,
    month_archetype: assignment.month_archetype,
    flags: assignment.flags,
    assignment_rationale: assignment.assignment_rationale,
    companion_fit: companionFit,
    month_fit: monthFit,
    hard_constraints: hardConstraints,
    review_priority: priority.priority,
    review_reasons: priority.reasons,
  };
}

function profileFromProposal(baseProfile, proposal, researchHash) {
  const companionFit = Object.fromEntries(COMPANION_KEYS.map((key) => [key, proposal.companion_fit[key].value]));
  const monthFit = Object.fromEntries(MONTH_KEYS.map((month) => [month, proposal.month_fit[month].value]));
  return {
    ...baseProfile,
    companion_fit: companionFit,
    month_fit: monthFit,
    label_evidence: {
      ...baseProfile.label_evidence,
      companion_basis: COMPANION_KEYS.map((key) => proposal.companion_fit[key].rationale),
      month_basis: MONTH_KEYS.map((month) => proposal.month_fit[month].rationale),
      hard_constraints: proposal.hard_constraints,
    },
    label_meta: {
      version: VERSION,
      method: RULESET_VERSION,
      research_record_sha256: researchHash,
      confidence: {
        companion_fit: confidenceSummary(proposal.companion_fit),
        month_fit: confidenceSummary(proposal.month_fit),
      },
      review_status: "needs_human_review",
      review_priority: proposal.review_priority,
      review_reasons: proposal.review_reasons,
    },
  };
}

function distribution(items, getter) {
  const counts = {};
  for (const item of items) {
    const key = String(getter(item));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function reportMarkdown(proposals, profiles, assignments, v2ProfilesHash, researchHash) {
  const companionAxes = proposals.flatMap((proposal) => Object.values(proposal.companion_fit));
  const monthAxes = proposals.flatMap((proposal) => Object.values(proposal.month_fit));
  const companionDirect = companionAxes.filter((axis) => axis.inference_level === "direct_evidence").length;
  const monthDirect = monthAxes.filter((axis) => axis.inference_level === "direct_evidence").length;
  const festivalNa = monthAxes.filter((axis) => axis.inference_level === "not_applicable").length;
  return `# 장소 프로필 v3 자동 라벨 보고서\n\n` +
    `- 상태: AI 초안 — 사람 검수 전\n` +
    `- 규칙 버전: \`${RULESET_VERSION}\`\n` +
    `- 기준일: ${CHECKED_AT}\n` +
    `- 입력 v2 프로필 SHA-256: \`${v2ProfilesHash}\`\n` +
    `- 웹 조사 SHA-256: \`${researchHash}\`\n\n` +
    `## 완성도\n\n` +
    `- 장소: ${profiles.length}건\n` +
    `- companion: 500/500 수치, 직접 근거 ${companionDirect}, 보완 추론 ${500 - companionDirect}\n` +
    `- 비축제 month: 1,152/1,152 수치, 직접 근거 ${monthDirect}, 보완 추론 ${1152 - monthDirect}\n` +
    `- 축제 month: ${festivalNa}/48 N/A(date-gated)\n\n` +
    `## 분포\n\n` +
    `- 검수 우선순위: ${JSON.stringify(distribution(proposals, (item) => item.review_priority))}\n` +
    `- companion archetype: ${JSON.stringify(distribution(assignments, (item) => item.companion_archetype))}\n` +
    `- month archetype: ${JSON.stringify(distribution(assignments, (item) => item.month_archetype))}\n` +
    `- companion 추론 수준: ${JSON.stringify(distribution(companionAxes, (axis) => axis.inference_level))}\n` +
    `- month 추론 수준: ${JSON.stringify(distribution(monthAxes, (axis) => axis.inference_level))}\n\n` +
    `## 해석 주의\n\n` +
    `- v2의 웹 조사 facts는 그대로 보존했다. v2 수치도 실제 직접 근거에 매핑되는지 다시 검증하고, 나머지 축은 archetype·조사 사실·기후 규칙으로 완성했다.\n` +
    `- prior와 기후 휴리스틱은 직접 추천 문장이 아니며, UI에서 근거 수준을 구분해 표시한다.\n` +
    `- 예약·연령·인원·기상·운영 조건은 점수와 별도 hard constraint다. 높은 적합도가 조건을 상쇄하지 않는다.\n` +
    `- 월 적합도는 평년의 정상 운영을 가정하며 실시간 예보가 아니다. 축제는 개최일이 확정된 뒤 날짜 필터로 처리한다.\n`;
}

const v2ProfilesPath = path.join(v2Directory, "place_profiles.json");
const researchPath = path.join(v2Directory, "place_web_research.json");
const v2ManifestPath = path.join(v2Directory, "manifest.json");
const v2Profiles = readJson(v2ProfilesPath);
const researchItems = readJson(researchPath);
const v2Manifest = readJson(v2ManifestPath);
const assignmentParts = assignmentPartPaths.map((filePath) => {
  assert(fs.existsSync(filePath), `Missing assignment input: ${relativePath(filePath)}`);
  return readJson(filePath);
});
const assignments = assignmentParts.flat();

assert(v2Profiles.length === 100, "Expected 100 v2 profiles");
assert(researchItems.length === 100, "Expected 100 web research records");
assert(assignments.length === 100, "Expected 100 archetype assignments");
const profileIds = v2Profiles.map((profile) => clean(profile.contentid));
assert(new Set(profileIds).size === 100, "v2 contentid values must be unique");
for (let index = 0; index < 100; index += 1) {
  const expectedId = profileIds[index];
  assert(
    JSON.stringify(Object.keys(assignments[index]).sort()) === JSON.stringify(["contentid", "title", "companion_archetype", "month_archetype", "flags", "assignment_rationale"].sort()),
    `Assignment structure differs at index ${index}`,
  );
  assert(clean(researchItems[index].contentid) === expectedId, `Research order differs at index ${index}`);
  assert(clean(assignments[index].contentid) === expectedId, `Assignment order differs at index ${index}`);
  assert(clean(assignments[index].title) === clean(v2Profiles[index].title), `Assignment title differs at index ${index}`);
  assert(companionProfiles.profiles[assignments[index].companion_archetype], `Unknown companion archetype at index ${index}`);
  assert(monthProfiles.profiles[assignments[index].month_archetype], `Unknown month archetype at index ${index}`);
  assert(Array.isArray(assignments[index].flags), `Assignment flags must be an array at index ${index}`);
  assert(new Set(assignments[index].flags).size === assignments[index].flags.length, `Assignment flags repeat at index ${index}`);
  for (const flag of assignments[index].flags) assert(flagLabels[flag], `Unknown assignment flag ${flag} at index ${index}`);
  assert(clean(assignments[index].assignment_rationale), `Assignment rationale is empty at index ${index}`);
  const festival = FESTIVAL_IDS.has(expectedId);
  assert(festival === (v2Profiles[index].source_place.contenttypeid === "15"), `Festival identity differs at index ${index}`);
  assert(festival === (assignments[index].month_archetype === "festival_na"), `Festival month archetype differs at index ${index}`);
}

const v2ProfilesHash = sha256File(v2ProfilesPath);
const researchHash = sha256File(researchPath);
assert(v2Manifest.files?.["place_profiles.json"]?.sha256 === v2ProfilesHash, "v2 profile hash differs from manifest");
assert(v2Manifest.files?.["place_web_research.json"]?.sha256 === researchHash, "web research hash differs from manifest");

const proposals = v2Profiles.map((profile, index) => makeProposal(profile, researchItems[index], assignments[index]));
const profiles = v2Profiles.map((profile, index) => profileFromProposal(profile, proposals[index], profile.label_meta.research_record_sha256));

fs.mkdirSync(scoringDirectory, { recursive: true });
const climatePath = path.join(outputDirectory, "climate_baseline.json");
const companionProfilesPath = path.join(scoringDirectory, "companion_profiles.json");
const monthProfilesPath = path.join(scoringDirectory, "month_profiles.json");
const assignmentsPath = path.join(scoringDirectory, "archetype_assignments.json");
const proposalsPath = path.join(outputDirectory, "auto_label_proposals.json");
const profilesPath = path.join(outputDirectory, "place_profiles.json");
const reportPath = path.join(outputDirectory, "review_report.md");
const manifestPath = path.join(outputDirectory, "manifest.json");

writeJson(climatePath, climateBaseline);
writeJson(companionProfilesPath, companionProfiles);
writeJson(monthProfilesPath, monthProfiles);
writeJson(assignmentsPath, assignments);
writeJson(proposalsPath, proposals);
writeJson(profilesPath, profiles);
fs.writeFileSync(reportPath, reportMarkdown(proposals, profiles, assignments, v2ProfilesHash, researchHash), "utf8");

const manifestFiles = {};
for (const filePath of [climatePath, companionProfilesPath, monthProfilesPath, assignmentsPath, proposalsPath, profilesPath, reportPath]) {
  const value = { path: relativePath(filePath), sha256: sha256File(filePath) };
  if (filePath.endsWith(".json") && [assignmentsPath, proposalsPath, profilesPath].includes(filePath)) value.count = 100;
  manifestFiles[path.relative(outputDirectory, filePath).replaceAll("\\", "/")] = value;
}

const companionAxes = proposals.flatMap((proposal) => Object.values(proposal.companion_fit));
const monthAxes = proposals.flatMap((proposal) => Object.values(proposal.month_fit));
const manifest = {
  schema_version: "place-profile-autolabel-manifest-v3",
  status: "ai_draft",
  label_version: VERSION,
  algorithm_version: RULESET_VERSION,
  checked_at: CHECKED_AT,
  source: v2Manifest.source,
  base_v2: {
    profile_path: relativePath(v2ProfilesPath),
    profile_sha256: v2ProfilesHash,
    research_path: relativePath(researchPath),
    research_sha256: researchHash,
    count: 100,
  },
  climate_baseline: {
    period: climateBaseline.baseline_period,
    path: relativePath(climatePath),
    sha256: manifestFiles["climate_baseline.json"].sha256,
    input_fixture: fixtureProvenance(climateInputFixture, climateInputSha256),
    source_urls: climateBaseline.sources.map((source) => source.url),
  },
  month_profiles: {
    path: relativePath(monthProfilesPath),
    sha256: manifestFiles["scoring/month_profiles.json"].sha256,
    input_fixture_canonical_sha256: climateInputFixture.canonical_sha256,
  },
  stats: {
    total: 100,
    companion_numeric: companionAxes.filter((axis) => LABEL_VALUES.includes(axis.value)).length,
    companion_direct: companionAxes.filter((axis) => axis.inference_level === "direct_evidence").length,
    companion_inferred: companionAxes.filter((axis) => axis.inference_level !== "direct_evidence").length,
    nonfestival_month_numeric: proposals.filter((proposal) => !FESTIVAL_IDS.has(proposal.contentid)).flatMap((proposal) => Object.values(proposal.month_fit)).filter((axis) => LABEL_VALUES.includes(axis.value)).length,
    nonfestival_month_direct: proposals.filter((proposal) => !FESTIVAL_IDS.has(proposal.contentid)).flatMap((proposal) => Object.values(proposal.month_fit)).filter((axis) => axis.inference_level === "direct_evidence").length,
    festival_month_na: monthAxes.filter((axis) => axis.inference_level === "not_applicable").length,
    review_priority: distribution(proposals, (proposal) => proposal.review_priority),
  },
  files: manifestFiles,
};
writeJson(manifestPath, manifest);

console.log(JSON.stringify({
  output: relativePath(outputDirectory),
  label_version: VERSION,
  companion_numeric: manifest.stats.companion_numeric,
  nonfestival_month_numeric: manifest.stats.nonfestival_month_numeric,
  festival_month_na: manifest.stats.festival_month_na,
  review_priority: manifest.stats.review_priority,
  profile_sha256: manifest.files["place_profiles.json"].sha256,
}, null, 2));
