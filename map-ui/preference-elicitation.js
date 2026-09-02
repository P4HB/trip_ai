(function exposeTravelPreference(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TRAVEL_PREFERENCE = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTravelPreference() {
  "use strict";

  const PROFILE_SCHEMA_VERSION = "traveler-preference-profile-v2-three-axis";
  const QUESTIONNAIRE_VERSION = "travel-mbti-questions-v5-four-way";
  const PAIR_CATALOG_VERSION = "travel-mbti-content-pairs-v3-four-way";
  const ESTIMATOR_VERSION = "axis-feature-evidence-v3-ambivalent";
  const ARCHETYPE_CATALOG_VERSION = "travel-mbti-8-v4-three-axis";
  const MAX_PAIR_QUESTIONS = 3;
  const MAX_ACTIVE_FEATURES = 8;
  const EVIDENCE_SATURATION = 4.8;
  const PAIR_EVIDENCE_WEIGHT = 1.25;
  const QUESTION_BOTH_EVIDENCE_WEIGHT = 0.75;
  const PAIR_BOTH_EVIDENCE_WEIGHT = 0.6;

  const ATOMIC_FEATURES = Object.freeze([
    "mountain", "ocean", "activity", "culture_history", "theme_park", "cafe",
    "traditional_market", "festival", "indoor_ratio", "weather_sensitivity",
    "restfulness", "physical_ease", "visit_duration_flexibility", "scenic_value",
    "distinctiveness", "local_embeddedness", "landmark_significance", "photo_value",
  ]);

  const FEATURE_LABELS = Object.freeze({
    mountain: "산", ocean: "바다", activity: "활동", culture_history: "문화·역사",
    theme_park: "테마 공간", cafe: "카페", traditional_market: "전통시장", festival: "축제",
    indoor_ratio: "실내", weather_sensitivity: "날씨 타는 야외 경험", restfulness: "휴식",
    physical_ease: "편한 동선", visit_duration_flexibility: "체류 유연성", scenic_value: "경관",
    distinctiveness: "독특함", local_embeddedness: "제주 로컬성", landmark_significance: "랜드마크",
    photo_value: "사진 가치",
  });

  const QUESTIONS = Object.freeze([
    {
      id: "q01_arrival_energy",
      axisId: "energy",
      prompt: "제주에 도착한 첫 시간, 더 끌리는 시작은?",
      options: [
        { id: "a", icon: "🥾", label: "해안이나 오름을 걸으며 몸부터 깨운다", axisValue: 1, effects: { activity: 0.75, ocean: 0.3, mountain: 0.25, scenic_value: 0.2 } },
        { id: "b", icon: "☕", label: "카페나 숙소에서 쉬며 천천히 시작한다", axisValue: -1, effects: { cafe: 0.7, restfulness: 0.8, physical_ease: 0.4, activity: -0.35 } },
      ],
    },
    {
      id: "q02_fair_weather_space",
      axisId: "environment",
      prompt: "날씨가 좋은 오후, 같은 두 시간을 보낸다면?",
      options: [
        { id: "a", icon: "🌤️", label: "바람과 햇빛을 느낄 수 있는 야외 공간을 고른다", axisValue: 1, effects: { weather_sensitivity: 0.85, indoor_ratio: -0.65, scenic_value: 0.25 } },
        { id: "b", icon: "🏛️", label: "쾌적하게 둘러볼 수 있는 실내 공간을 고른다", axisValue: -1, effects: { indoor_ratio: 0.85, weather_sensitivity: -0.65, culture_history: 0.2 } },
      ],
    },
    {
      id: "q03_first_region_choice",
      axisId: "discovery",
      prompt: "처음 가는 지역에서 먼저 확인할 곳은?",
      options: [
        { id: "a", icon: "⭐", label: "놓치면 아쉬운 대표 명소부터 확인한다", axisValue: -1, effects: { landmark_significance: 0.9, photo_value: 0.65, local_embeddedness: -0.25 } },
        { id: "b", icon: "🛤️", label: "지역색이 강한 골목과 작은 가게부터 찾아본다", axisValue: 1, effects: { local_embeddedness: 0.9, distinctiveness: 0.6, traditional_market: 0.3, landmark_significance: -0.25 } },
      ],
    },
    {
      id: "q04_memory_energy",
      axisId: "energy",
      prompt: "여행 후 가장 오래 남았으면 하는 기억은?",
      options: [
        { id: "a", icon: "🌿", label: "조용한 풍경을 오래 바라보며 충분히 쉬었던 순간", axisValue: -1, effects: { restfulness: 0.8, scenic_value: 0.35, physical_ease: 0.35, activity: -0.35 } },
        { id: "b", icon: "🎉", label: "직접 참여한 체험이나 축제의 신나는 순간", axisValue: 1, effects: { activity: 0.85, festival: 0.55, theme_park: 0.35, restfulness: -0.35 } },
      ],
    },
    {
      id: "q05_rainy_day_space",
      axisId: "environment",
      prompt: "비가 오락가락하는 날, 더 마음이 가는 선택은?",
      options: [
        { id: "a", icon: "🖼️", label: "전시관이나 실내 테마 공간으로 일정을 바꾼다", axisValue: -1, effects: { indoor_ratio: 0.9, weather_sensitivity: -0.75, culture_history: 0.3 } },
        { id: "b", icon: "🌦️", label: "약한 비라면 우산을 쓰고 야외 명소를 계속 본다", axisValue: 1, effects: { weather_sensitivity: 0.85, indoor_ratio: -0.7, scenic_value: 0.25 } },
      ],
    },
    {
      id: "q06_place_reputation",
      axisId: "discovery",
      prompt: "처음 보는 두 장소 중 더 끌리는 곳은?",
      options: [
        { id: "a", icon: "🧺", label: "현지인의 생활 풍경과 지역 이야기가 느껴지는 곳", axisValue: 1, effects: { local_embeddedness: 0.85, distinctiveness: 0.5, traditional_market: 0.35 } },
        { id: "b", icon: "📸", label: "놓치면 아쉽다고 알려진 유명 명소", axisValue: -1, effects: { landmark_significance: 0.85, photo_value: 0.5, local_embeddedness: -0.2 } },
      ],
    },
    {
      id: "q07_free_half_day",
      axisId: "energy",
      prompt: "여행 중 반나절이 비었다면 무엇을 추가할까요?",
      options: [
        { id: "a", icon: "🚣", label: "레포츠나 참여형 테마 체험을 하나 더 넣는다", axisValue: 1, effects: { activity: 0.85, theme_park: 0.6, festival: 0.25, restfulness: -0.25 } },
        { id: "b", icon: "🌾", label: "정원이나 전망 공간에서 충분히 쉬며 보낸다", axisValue: -1, effects: { restfulness: 0.8, scenic_value: 0.4, physical_ease: 0.35, activity: -0.3 } },
      ],
    },
    {
      id: "q08_story_environment",
      axisId: "environment",
      prompt: "지역 이야기를 접하는 방식으로 더 좋은 것은?",
      options: [
        { id: "a", icon: "🚶", label: "야외 길을 걸으며 현장 해설을 듣는다", axisValue: 1, effects: { weather_sensitivity: 0.75, indoor_ratio: -0.55, culture_history: 0.25, activity: 0.15 } },
        { id: "b", icon: "📚", label: "실내 전시와 자료를 천천히 살펴본다", axisValue: -1, effects: { indoor_ratio: 0.8, weather_sensitivity: -0.6, culture_history: 0.4, physical_ease: 0.15 } },
      ],
    },
    {
      id: "q09_photo_story",
      axisId: "discovery",
      prompt: "여행에서 남기고 싶은 사진과 이야기는?",
      options: [
        { id: "a", icon: "📷", label: "누구나 알아보는 대표 명소의 사진", axisValue: -1, effects: { photo_value: 0.9, landmark_significance: 0.75, local_embeddedness: -0.2 } },
        { id: "b", icon: "📝", label: "나만 발견한 장소와 그곳에서 만난 이야기", axisValue: 1, effects: { distinctiveness: 0.8, local_embeddedness: 0.75, landmark_significance: -0.2 } },
      ],
    },
    {
      id: "q10_after_three_places",
      axisId: "energy",
      prompt: "두세 곳을 둘러본 뒤 시간이 남았다면?",
      options: [
        { id: "a", icon: "🪑", label: "편한 장소에서 쉬며 여유롭게 마무리한다", axisValue: -1, effects: { restfulness: 0.75, physical_ease: 0.55, cafe: 0.3, activity: -0.35 } },
        { id: "b", icon: "🧗", label: "체력이 남았다면 활동 하나를 더 추가한다", axisValue: 1, effects: { activity: 0.8, theme_park: 0.35, restfulness: -0.3 } },
      ],
    },
    {
      id: "q11_unplanned_two_hours",
      axisId: "environment",
      prompt: "예상하지 못한 두 시간의 자유 시간이 생겼다면?",
      options: [
        { id: "a", icon: "🏢", label: "넓은 실내 공간을 찾아 천천히 둘러본다", axisValue: -1, effects: { indoor_ratio: 0.85, weather_sensitivity: -0.65, physical_ease: 0.2 } },
        { id: "b", icon: "🌬️", label: "목적지 없이 야외를 걸으며 주변을 발견한다", axisValue: 1, effects: { weather_sensitivity: 0.8, indoor_ratio: -0.7, activity: 0.2, scenic_value: 0.2 } },
      ],
    },
    {
      id: "q12_souvenir_place",
      axisId: "discovery",
      prompt: "여행 기념품을 고른다면 어디로 갈까요?",
      options: [
        { id: "a", icon: "🧵", label: "지역 시장이나 작은 작업실에서 고른다", axisValue: 1, effects: { traditional_market: 0.8, local_embeddedness: 0.7, distinctiveness: 0.45 } },
        { id: "b", icon: "🛍️", label: "유명 테마 공간이나 대표 매장에서 고른다", axisValue: -1, effects: { theme_park: 0.65, landmark_significance: 0.6, photo_value: 0.3 } },
      ],
    },
    {
      id: "q13_effort_tradeoff",
      axisId: "energy",
      prompt: "둘 중 한 장소만 고른다면?",
      options: [
        { id: "a", icon: "🧗", label: "조금 힘들어도 직접 체험할 것이 많은 장소", axisValue: 1, effects: { activity: 0.9, theme_park: 0.5, physical_ease: -0.4 } },
        { id: "b", icon: "🛋️", label: "볼거리가 적어도 동선이 편하고 오래 머물 수 있는 장소", axisValue: -1, effects: { physical_ease: 0.8, restfulness: 0.7, visit_duration_flexibility: 0.35, activity: -0.4 } },
      ],
    },
    {
      id: "q14_weather_dependency",
      axisId: "environment",
      prompt: "장소를 고를 때 더 끌리는 설명은?",
      options: [
        { id: "a", icon: "🌅", label: "날씨와 시간대에 따라 분위기가 크게 달라지는 곳", axisValue: 1, effects: { weather_sensitivity: 0.95, indoor_ratio: -0.75, scenic_value: 0.3 } },
        { id: "b", icon: "🏛️", label: "날씨와 관계없이 경험이 안정적인 곳", axisValue: -1, effects: { indoor_ratio: 0.9, weather_sensitivity: -0.75, culture_history: 0.2 } },
      ],
    },
    {
      id: "q15_review_count",
      axisId: "discovery",
      prompt: "검색 결과가 서로 다르다면 어떤 곳을 선택할까요?",
      options: [
        { id: "a", icon: "🔎", label: "리뷰가 적어도 개성이 뚜렷한 장소를 시도한다", axisValue: 1, effects: { distinctiveness: 0.9, local_embeddedness: 0.75, landmark_significance: -0.2 } },
        { id: "b", icon: "🏅", label: "방문 후기가 많고 검증된 인기 장소를 우선한다", axisValue: -1, effects: { landmark_significance: 0.8, photo_value: 0.6, distinctiveness: -0.2 } },
      ],
    },
    {
      id: "q16_last_night_energy",
      axisId: "energy",
      prompt: "제주에서 마지막 밤을 보낸다면?",
      options: [
        { id: "a", icon: "🌙", label: "조용한 카페나 노을을 보며 마무리한다", axisValue: -1, effects: { cafe: 0.65, restfulness: 0.8, scenic_value: 0.25, activity: -0.3 } },
        { id: "b", icon: "🎪", label: "공연·축제·야시장처럼 활기찬 곳에서 마무리한다", axisValue: 1, effects: { festival: 0.8, activity: 0.7, theme_park: 0.35, restfulness: -0.3 } },
      ],
    },
    {
      id: "q17_last_morning_space",
      axisId: "environment",
      prompt: "여행 마지막 오전을 보낼 공간은?",
      options: [
        { id: "a", icon: "☕", label: "실내 공간에서 여유롭게 여행을 정리한다", axisValue: -1, effects: { indoor_ratio: 0.8, cafe: 0.3, weather_sensitivity: -0.65 } },
        { id: "b", icon: "🌊", label: "마지막까지 바람과 햇빛을 느끼며 야외에서 보낸다", axisValue: 1, effects: { weather_sensitivity: 0.85, indoor_ratio: -0.7, scenic_value: 0.3 } },
      ],
    },
    {
      id: "q18_final_place",
      axisId: "discovery",
      prompt: "여행의 마지막 한 곳을 정한다면?",
      options: [
        { id: "a", icon: "🏆", label: "제주를 상징하는 대표 명소로 정한다", axisValue: -1, effects: { landmark_significance: 0.95, photo_value: 0.65, local_embeddedness: -0.2 } },
        { id: "b", icon: "🏘️", label: "여행 중 우연히 발견한 동네로 정한다", axisValue: 1, effects: { local_embeddedness: 0.9, distinctiveness: 0.75, landmark_significance: -0.25 } },
      ],
    },
  ]);

  const PAIRS = Object.freeze([
    {
      id: "p01_panorama_or_story",
      dimensions: ["mountain", "ocean", "scenic_value", "culture_history", "traditional_market"],
      cardA: { id: "p01_a", icon: "🌊", title: "바람 전망지대", description: "바다와 산 능선, 탁 트인 경관을 한눈에 보는 가상 여행지", features: { mountain: 0.75, ocean: 0.85, scenic_value: 1, culture_history: 0.1, traditional_market: 0.05 } },
      cardB: { id: "p01_b", icon: "🏺", title: "섬 생활 이야기관", description: "지역의 역사와 생활 도구, 장터 이야기를 따라가는 가상 여행지", features: { mountain: 0.05, ocean: 0.15, scenic_value: 0.25, culture_history: 1, traditional_market: 0.75 } },
    },
    {
      id: "p02_geology_or_life_history",
      dimensions: ["mountain", "ocean", "scenic_value", "culture_history", "local_embeddedness"],
      cardA: { id: "p02_a", icon: "🪨", title: "지층 생태 관찰길", description: "바위와 바다 생태가 만들어진 과정을 현장에서 보는 가상 여행지", features: { mountain: 0.7, ocean: 0.75, scenic_value: 0.8, culture_history: 0.1, local_embeddedness: 0.25 } },
      cardB: { id: "p02_b", icon: "🧵", title: "마을 생활사 공방", description: "주민의 생활 이야기와 전통 기술을 직접 접하는 가상 여행지", features: { mountain: 0.05, ocean: 0.1, scenic_value: 0.2, culture_history: 0.9, local_embeddedness: 0.85 } },
    },
    {
      id: "p03_scenery_or_culture_archive",
      dimensions: ["scenic_value", "photo_value", "culture_history", "traditional_market"],
      cardA: { id: "p03_a", icon: "📷", title: "빛과 색 전망정원", description: "계절의 색과 넓은 풍경을 사진으로 남기는 가상 여행지", features: { scenic_value: 1, photo_value: 0.85, culture_history: 0.1, traditional_market: 0.05 } },
      cardB: { id: "p03_b", icon: "📚", title: "지역 문화 아카이브", description: "옛 사진과 구술 기록, 시장 문화를 살펴보는 가상 여행지", features: { scenic_value: 0.2, photo_value: 0.35, culture_history: 1, traditional_market: 0.65 } },
    },
    {
      id: "p04_market_or_coast",
      dimensions: ["traditional_market", "culture_history", "ocean", "scenic_value"],
      cardA: { id: "p04_a", icon: "🧺", title: "생활 장터 골목", description: "지역 먹거리와 상인들의 생활 풍경이 이어지는 가상 여행지", features: { traditional_market: 1, culture_history: 0.7, ocean: 0.05, scenic_value: 0.25 } },
      cardB: { id: "p04_b", icon: "🌅", title: "해안 빛 산책길", description: "수평선과 바람, 시간대별 경관을 따라 걷는 가상 여행지", features: { traditional_market: 0.05, culture_history: 0.1, ocean: 1, scenic_value: 0.9 } },
    },
    {
      id: "p05_ecology_or_craft",
      dimensions: ["mountain", "ocean", "activity", "culture_history", "local_embeddedness"],
      cardA: { id: "p05_a", icon: "🌿", title: "숲과 바다 탐사교실", description: "지질과 생태를 관찰하며 직접 기록하는 가상 프로그램", features: { mountain: 0.75, ocean: 0.65, activity: 0.55, culture_history: 0.05, local_embeddedness: 0.2 } },
      cardB: { id: "p05_b", icon: "🧶", title: "지역 공예 배움터", description: "생활사 이야기를 듣고 전통 재료를 다뤄보는 가상 프로그램", features: { mountain: 0.05, ocean: 0.05, activity: 0.5, culture_history: 0.9, local_embeddedness: 0.8 } },
    },
    {
      id: "p06_nature_memory_or_culture_memory",
      dimensions: ["mountain", "ocean", "scenic_value", "culture_history", "distinctiveness"],
      cardA: { id: "p06_a", icon: "🎨", title: "자연색 관찰언덕", description: "바다와 숲의 색, 빛의 변화를 오래 기억하게 되는 가상 여행지", features: { mountain: 0.65, ocean: 0.75, scenic_value: 1, culture_history: 0.05, distinctiveness: 0.5 } },
      cardB: { id: "p06_b", icon: "🏘️", title: "동네 기억 전시마을", description: "지역 사람들의 문화 이야기와 공간의 흔적이 남는 가상 여행지", features: { mountain: 0.05, ocean: 0.1, scenic_value: 0.35, culture_history: 0.95, distinctiveness: 0.75 } },
    },
  ]);

  const ARCHETYPES = Object.freeze({
    AOL: { name: "바람길 탐험가", description: "로컬 야외 공간을 찾아 몸으로 경험하며 제주를 발견한다.", emoji: "🧭" },
    AOH: { name: "버킷리스트 어드벤처", description: "대표 야외 명소와 체험을 놓치지 않고 활기차게 누빈다.", emoji: "🏆" },
    AIL: { name: "로컬 콘텐츠 탐험가", description: "지역색이 강한 실내 공간과 참여형 콘텐츠를 찾아간다.", emoji: "🗺️" },
    AIH: { name: "핫플 콘텐츠 체이서", description: "인기 실내 명소와 테마 콘텐츠를 에너지 있게 즐긴다.", emoji: "🎟️" },
    ROL: { name: "느린 풍경 기록가", description: "로컬 야외 풍경과 마을의 결을 천천히 바라보고 기록한다.", emoji: "📓" },
    ROH: { name: "풍경 명소 큐레이터", description: "대표 야외 경관을 편안하게 골라 오래 감상한다.", emoji: "📸" },
    RIL: { name: "동네 취향 아카이버", description: "조용한 로컬 실내 공간에서 지역의 취향을 차분히 모은다.", emoji: "🗂️" },
    RIH: { name: "감성 콘텐츠 큐레이터", description: "유명 실내 문화 공간과 분위기를 여유롭게 골라 즐긴다.", emoji: "🖼️" },
  });

  const AXIS_DEFINITIONS = Object.freeze([
    { id: "energy", name: "에너지", positiveCode: "A", positiveLabel: "활동", negativeCode: "R", negativeLabel: "휴식" },
    { id: "environment", name: "환경", positiveCode: "O", positiveLabel: "야외", negativeCode: "I", negativeLabel: "실내" },
    { id: "discovery", name: "발견", positiveCode: "L", positiveLabel: "로컬", negativeCode: "H", negativeLabel: "핫스폿" },
  ]);

  function clamp(value, min = -1, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 6) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function emptyAccumulator(keys) {
    return Object.fromEntries(keys.map((key) => [key, { sum: 0, evidence: 0, quiz: 0, pairwise: 0 }]));
  }

  function addEvidence(record, value, source) {
    if (!Number.isFinite(value) || value === 0) return;
    record.sum += value;
    record.evidence += Math.abs(value);
    record[source] += Math.abs(value);
  }

  function normalizedQuestionAnswers(input = []) {
    if (!Array.isArray(input)) throw new Error("질문 응답은 배열이어야 합니다.");
    const byId = new Map(QUESTIONS.map((question) => [question.id, question]));
    const seen = new Set();
    const answers = input.map((answer) => {
      const questionId = String(answer?.questionId || "");
      const optionId = String(answer?.optionId || "skip");
      const question = byId.get(questionId);
      if (!question) throw new Error(`알 수 없는 질문입니다: ${questionId || "(비어 있음)"}`);
      if (seen.has(questionId)) throw new Error(`질문 응답이 중복되었습니다: ${questionId}`);
      seen.add(questionId);
      if (!["skip", "both_like", "both_dislike"].includes(optionId) && !question.options.some((option) => option.id === optionId)) {
        throw new Error(`알 수 없는 질문 선택지입니다: ${questionId}/${optionId}`);
      }
      return { questionId, optionId };
    });
    const order = new Map(QUESTIONS.map((question, index) => [question.id, index]));
    return answers.sort((left, right) => order.get(left.questionId) - order.get(right.questionId));
  }

  function normalizedPairAnswers(input = []) {
    if (!Array.isArray(input)) throw new Error("가상 장소 응답은 배열이어야 합니다.");
    const byId = new Map(PAIRS.map((pair) => [pair.id, pair]));
    const seen = new Set();
    return input.map((answer) => {
      const pairId = String(answer?.pairId || "");
      const choice = String(answer?.choice || "skip");
      if (!byId.has(pairId)) throw new Error(`알 수 없는 가상 장소 pair입니다: ${pairId || "(비어 있음)"}`);
      if (seen.has(pairId)) throw new Error(`가상 장소 pair 응답이 중복되었습니다: ${pairId}`);
      if (!["a", "b", "both_like", "both_dislike", "tie", "skip"].includes(choice)) throw new Error(`알 수 없는 pair 선택입니다: ${choice}`);
      seen.add(pairId);
      return { pairId, choice };
    });
  }

  function estimateProfile(questionnaireAnswers = [], pairAnswers = []) {
    const questionnaire = normalizedQuestionAnswers(questionnaireAnswers);
    const pairwise = normalizedPairAnswers(pairAnswers);
    const featureAccumulator = emptyAccumulator(ATOMIC_FEATURES);
    const axisAccumulator = emptyAccumulator(AXIS_DEFINITIONS.map((axis) => axis.id));
    const questionsById = new Map(QUESTIONS.map((question) => [question.id, question]));
    for (const answer of questionnaire) {
      if (answer.optionId === "skip") continue;
      const question = questionsById.get(answer.questionId);
      if (["both_like", "both_dislike"].includes(answer.optionId)) {
        const direction = answer.optionId === "both_like" ? 1 : -1;
        const features = new Set(question.options.flatMap((option) => Object.keys(option.effects || {})));
        for (const feature of features) {
          const average = question.options.reduce((sum, option) => sum + Number(option.effects?.[feature] || 0), 0) / question.options.length;
          addEvidence(featureAccumulator[feature], direction * average * QUESTION_BOTH_EVIDENCE_WEIGHT, "quiz");
        }
        continue;
      }
      const option = question.options.find((item) => item.id === answer.optionId);
      for (const [feature, value] of Object.entries(option.effects || {})) addEvidence(featureAccumulator[feature], Number(value), "quiz");
      addEvidence(axisAccumulator[question.axisId], Number(option.axisValue), "quiz");
    }

    const pairsById = new Map(PAIRS.map((pair) => [pair.id, pair]));
    for (const answer of pairwise) {
      const pair = pairsById.get(answer.pairId);
      if (["both_like", "both_dislike"].includes(answer.choice)) {
        const direction = answer.choice === "both_like" ? 1 : -1;
        const features = new Set([...Object.keys(pair.cardA.features), ...Object.keys(pair.cardB.features)]);
        for (const feature of features) {
          const average = (Number(pair.cardA.features[feature] || 0) + Number(pair.cardB.features[feature] || 0)) / 2;
          addEvidence(featureAccumulator[feature], direction * average * PAIR_BOTH_EVIDENCE_WEIGHT, "pairwise");
        }
        continue;
      }
      if (!["a", "b"].includes(answer.choice)) continue;
      const direction = answer.choice === "a" ? 1 : -1;
      const features = new Set([...Object.keys(pair.cardA.features), ...Object.keys(pair.cardB.features)]);
      for (const feature of features) {
        const delta = Number(pair.cardA.features[feature] || 0) - Number(pair.cardB.features[feature] || 0);
        addEvidence(featureAccumulator[feature], direction * delta * PAIR_EVIDENCE_WEIGHT, "pairwise");
      }
    }

    const featureEstimates = {};
    for (const feature of ATOMIC_FEATURES) {
      const record = featureAccumulator[feature];
      const mean = record.evidence ? clamp(record.sum / record.evidence) : 0;
      const uncertainty = 1 - Math.min(1, record.evidence / EVIDENCE_SATURATION);
      const confidence = 1 - uncertainty;
      const signal = Math.abs(mean) * confidence;
      const source = record.quiz && record.pairwise ? "quiz_pairwise" : record.pairwise ? "pairwise" : record.quiz ? "quiz" : "unmeasured";
      featureEstimates[feature] = {
        mean: round(mean),
        uncertainty: round(uncertainty),
        confidence: round(confidence),
        evidenceCount: round(record.evidence),
        signal: round(signal),
        active: false,
        source,
      };
    }

    const activeFeatures = Object.entries(featureEstimates)
      .filter(([, estimate]) => estimate.evidenceCount >= 0.75 && Math.abs(estimate.mean) >= 0.3 && estimate.signal >= 0.12)
      .sort((left, right) => right[1].signal - left[1].signal || left[0].localeCompare(right[0]))
      .slice(0, MAX_ACTIVE_FEATURES)
      .map(([feature]) => feature);
    for (const feature of activeFeatures) featureEstimates[feature].active = true;

    const axisEstimates = {};
    for (const definition of AXIS_DEFINITIONS) {
      const record = axisAccumulator[definition.id];
      const mean = record.evidence ? clamp(record.sum / record.evidence) : 0;
      const completion = Math.min(1, record.evidence / 4);
      const confidence = Math.abs(mean) * completion;
      axisEstimates[definition.id] = {
        mean: round(mean),
        uncertainty: round(1 - confidence),
        confidence: round(confidence),
        answeredCount: record.evidence,
      };
    }
    const displaySummary = summarizeArchetype(axisEstimates, featureEstimates);
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      scope: "browser-memory-session",
      status: questionnaire.length === QUESTIONS.length ? "complete" : "partial",
      versions: {
        questionnaire: QUESTIONNAIRE_VERSION,
        pairCatalog: PAIR_CATALOG_VERSION,
        estimator: ESTIMATOR_VERSION,
        archetypeCatalog: ARCHETYPE_CATALOG_VERSION,
      },
      featureEstimates,
      axisEstimates,
      answers: { questionnaire, pairwise },
      displaySummary,
    };
  }

  function summarizeArchetype(axisEstimates, featureEstimates) {
    const axes = AXIS_DEFINITIONS.map((definition) => {
      const estimate = axisEstimates[definition.id];
      const score = estimate?.mean || 0;
      const positive = score >= 0;
      return {
        id: definition.id,
        name: definition.name,
        code: positive ? definition.positiveCode : definition.negativeCode,
        label: positive ? definition.positiveLabel : definition.negativeLabel,
        oppositeLabel: positive ? definition.negativeLabel : definition.positiveLabel,
        score: round(score),
        confidence: estimate?.confidence || 0,
      };
    });
    const archetypeId = axes.map((axis) => axis.code).join("");
    const archetype = ARCHETYPES[archetypeId];
    const ranked = Object.entries(featureEstimates)
      .filter(([, estimate]) => estimate.active)
      .sort((left, right) => right[1].signal - left[1].signal || left[0].localeCompare(right[0]));
    return {
      archetypeId,
      archetypeName: archetype.name,
      description: archetype.description,
      emoji: archetype.emoji,
      axes,
      topPreferences: ranked.filter(([, estimate]) => estimate.mean > 0).slice(0, 3).map(([feature]) => feature),
      topAvoidances: ranked.filter(([, estimate]) => estimate.mean < 0).slice(0, 2).map(([feature]) => feature),
    };
  }

  function materializePreferences(profile) {
    if (!profile || profile.schemaVersion !== PROFILE_SCHEMA_VERSION) throw new Error("유효한 여행 취향 프로필이 아닙니다.");
    const active = Object.entries(profile.featureEstimates || {})
      .filter(([feature, estimate]) => ATOMIC_FEATURES.includes(feature) && estimate?.active)
      .sort((left, right) => right[1].signal - left[1].signal || left[0].localeCompare(right[0]))
      .slice(0, MAX_ACTIVE_FEATURES);
    if (!active.length) return [];
    const maxSignal = Math.max(...active.map(([, estimate]) => estimate.signal), Number.EPSILON);
    return active.map(([feature, estimate]) => ({
      feature,
      mode: estimate.mean >= 0 ? "benefit" : "avoid",
      weight: round(1 + 3 * (estimate.signal / maxSignal), 3),
      confidence: estimate.confidence,
      source: estimate.source,
    }));
  }

  function nextAdaptivePair(profile, answeredPairIds = []) {
    if (!profile || profile.schemaVersion !== PROFILE_SCHEMA_VERSION) throw new Error("유효한 여행 취향 프로필이 아닙니다.");
    const answered = new Set(answeredPairIds);
    const estimates = profile.featureEstimates;
    const candidates = PAIRS.filter((pair) => !answered.has(pair.id)).map((pair) => {
      const features = new Set([...Object.keys(pair.cardA.features), ...Object.keys(pair.cardB.features)]);
      let uncertaintySum = 0;
      let predicted = 0;
      let magnitude = 0;
      for (const feature of features) {
        const delta = Number(pair.cardA.features[feature] || 0) - Number(pair.cardB.features[feature] || 0);
        if (!delta) continue;
        uncertaintySum += estimates[feature]?.uncertainty ?? 1;
        predicted += (estimates[feature]?.mean || 0) * delta;
        magnitude += Math.abs(delta);
      }
      const comparable = [...features].filter((feature) => (pair.cardA.features[feature] || 0) !== (pair.cardB.features[feature] || 0)).length || 1;
      const uncertaintyCoverage = uncertaintySum / comparable;
      const normalizedPrediction = magnitude ? predicted / magnitude : 0;
      const boundary = 1 - Math.min(1, Math.abs(normalizedPrediction));
      const informationScore = uncertaintyCoverage * (0.5 + 0.5 * boundary);
      return { pair, informationScore: round(informationScore), uncertaintyCoverage: round(uncertaintyCoverage), predictedPreference: round(normalizedPrediction) };
    });
    candidates.sort((left, right) => right.informationScore - left.informationScore || left.pair.id.localeCompare(right.pair.id));
    return candidates[0] || null;
  }

  function publicShareText(profile) {
    if (!profile?.displaySummary) throw new Error("공유할 여행 MBTI 결과가 없습니다.");
    const summary = profile.displaySummary;
    return `[여행 MBTI] ${summary.archetypeId} · ${summary.archetypeName}\n${summary.description}\n#여행MBTI #제주여행`;
  }

  return Object.freeze({
    PROFILE_SCHEMA_VERSION,
    QUESTIONNAIRE_VERSION,
    PAIR_CATALOG_VERSION,
    ESTIMATOR_VERSION,
    ARCHETYPE_CATALOG_VERSION,
    MAX_PAIR_QUESTIONS,
    MAX_ACTIVE_FEATURES,
    QUESTION_BOTH_EVIDENCE_WEIGHT,
    PAIR_BOTH_EVIDENCE_WEIGHT,
    ATOMIC_FEATURES,
    FEATURE_LABELS,
    QUESTIONS,
    PAIRS,
    ARCHETYPES,
    AXIS_DEFINITIONS,
    estimateProfile,
    materializePreferences,
    nextAdaptivePair,
    publicShareText,
  });
});
