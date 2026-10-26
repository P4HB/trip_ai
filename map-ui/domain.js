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
  // TourAPI contentTypeId of festivals and events; their dates are unstructured text.
  const EVENT_CONTENT_TYPE = "15";
  const INTENT_TYPES = Object.freeze({
    visit: new Set(["12", "14", "25", "28"]),
    shopping: new Set(["38"]),
    stay: new Set(["32"]),
    event: new Set([EVENT_CONTENT_TYPE]),
  });
  const REGIONS = Object.freeze({ jeju_all: "제주 전체", jeju_city: "제주시", seogwipo_city: "서귀포시" });
  const COMPANION_TYPES = Object.freeze(["solo", "couple", "friends", "kids", "parents"]);
  const COMPANION_LABELS = Object.freeze({ solo: "혼자", couple: "연인·부부", friends: "친구", kids: "아이", parents: "부모님" });
  // Wizard summary wording for each trip choice.
  const TRIP_CHOICE_LABELS = Object.freeze({
    companionType: Object.freeze({
      none: "동행자 미정", solo: "혼자", couple: "연인·부부", friends: "친구", kids: "아이와", parents: "부모님과",
    }),
    destinationRegion: REGIONS,
    tripIntent: Object.freeze({ visit: "볼거리·체험", shopping: "쇼핑", stay: "숙소", event: "축제·행사" }),
    transportMode: Object.freeze({ car: "차량 이용", no_car: "차량 없이" }),
  });
  const ENRICHED_LABEL_PREFIXES = Object.freeze(["theme.", "environment.", "style_evidence."]);

  function isEventPlace(place) {
    return String(place?.type) === EVENT_CONTENT_TYPE;
  }

  function normalizeSearchText(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("ko-KR");
  }

  /** "YYYY-MM-DD" -> "YYYY.MM.DD"; anything else (including timestamps) -> null so callers pick their fallback. */
  function formatDotDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
  }

  function featureKey(label) {
    return String(label || "").split(".").at(-1);
  }

  function atomicFeaturesFor(place) {
    const atomic = {};
    for (const record of place.v5?.labels || []) {
      if (ENRICHED_LABEL_PREFIXES.some((prefix) => record.label.startsWith(prefix))) {
        if (Number.isFinite(record.value)) atomic[featureKey(record.label)] = Number(record.value);
      }
    }
    return atomic;
  }

  function contextScores(records) {
    return Object.fromEntries((records || []).map((record) => [record.key, record.state === "numeric" ? record.value : null]));
  }

  /** Bundle place -> ranker input: atomic features, companion/month scores, readiness and search text. */
  function enrichPlace(place) {
    const atomicFeatures = atomicFeaturesFor(place);
    return {
      ...place,
      atomicFeatures,
      companionScores: contextScores(place.fit?.companion),
      monthScores: contextScores(place.fit?.month),
      recommendationReady: Boolean(place.v5 && place.fit && ATOMIC_FEATURES.every((key) => Number.isFinite(atomicFeatures[key]))),
      searchText: normalizeSearchText(`${place.title || ""} ${place.address || ""}`),
    };
  }

  return {
    ATOMIC_FEATURES, FEATURE_LABELS, EVENT_CONTENT_TYPE, INTENT_TYPES, REGIONS, COMPANION_TYPES, COMPANION_LABELS, TRIP_CHOICE_LABELS,
    isEventPlace, normalizeSearchText, formatDotDate, featureKey, enrichPlace,
  };
});
