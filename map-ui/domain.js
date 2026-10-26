(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TRAVEL_DOMAIN = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
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
  const INTENT_TYPES = Object.freeze({
    visit: new Set(["12", "14", "25", "28"]),
    shopping: new Set(["38"]),
    stay: new Set(["32"]),
    event: new Set(["15"]),
  });
  const REGIONS = Object.freeze({ jeju_all: "제주 전체", jeju_city: "제주시", seogwipo_city: "서귀포시" });
  return { ATOMIC_FEATURES, FEATURE_LABELS, INTENT_TYPES, REGIONS };
});
