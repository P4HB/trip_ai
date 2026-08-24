import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(workspaceRoot, "data", "tourapi", "jeju");
const v5ReviewRoot = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "place-preference-label-v5-researched",
  "reviews",
);
const fitLabelPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "place-fit-relabel-v2",
  "place_fit_labels.jsonl",
);
const hardConstraintPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "full",
  "place-profile-v1-all-1434",
  "hard_constraints.jsonl",
);
const outputPath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
const LABEL_SNAPSHOT_DATE = "2026-08-09";
const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const ATOMIC_LABEL_KEYS = [
  "theme.mountain", "theme.ocean", "theme.activity", "theme.culture_history",
  "theme.theme_park", "theme.cafe", "theme.traditional_market", "theme.festival",
  "environment.indoor_ratio", "environment.weather_sensitivity",
  "style_evidence.restfulness", "style_evidence.physical_ease",
  "style_evidence.visit_duration_flexibility", "style_evidence.scenic_value",
  "style_evidence.distinctiveness", "style_evidence.local_embeddedness",
  "style_evidence.landmark_significance", "style_evidence.photo_value",
];
const DERIVED_LABEL_KEYS = [
  "derived_style.healing_slow", "derived_style.scenic_immersion",
  "derived_style.discovery_explorer", "derived_style.local_immersion",
  "derived_style.iconic_highlight", "derived_style.photo_mood",
];
const EXPECTED_LABEL_KEYS = new Set([...ATOMIC_LABEL_KEYS, ...DERIVED_LABEL_KEYS]);
const RESEARCH_SEMANTIC_PATTERN = /정원|공원|해변|바다|오름|산|폭포|동굴|숲|산책|탐방|트레일|조망|전망|경관|일출|일몰|관람|감상|체험|박물관|미술관|전시|공연|문화|작품|기념관|갤러리|축제|행사|프로그램|퍼레이드|마켓|레저|낚시|수영|서핑|승마|골프|캠핑|트레킹|투어|자전거|요트|다이빙|숙박|객실|호텔|리조트|펜션|게스트하우스|조식|수영장|스파|휴식|쇼핑|시장|매장|판매|구매|취급|상품|특산품|기념품|의류|면세|브랜드|생활용품|약국|소매|음식|메뉴|요리|식당|카페|커피|디저트|베이커리|흑돼지|해산물|국수|전복|갈치|식사|즐길|둘러|볼 수|맛볼|먹을|마실|머물|촬영|선보/u;
const RESEARCH_CATALOG_PATTERN = /contentid|TourAPI|관광 분류|주소는|주소와|주소를|주소가|위치는|장소명|명칭은|수록|기록한다|기재|일치|목록|검색 결과|교차 확인|기준점|등록|데이터/u;
const RESEARCH_DYNAMIC_PATTERN = /영업|이용시간|운영|관람시간|휴무|주차|전화|문의|예약|체크인|체크아웃|입장|마감|개최|행사기간|일정|장날|운항|상시 개방|연중무휴|요금|가격|무료|유료|매주|매월|매년[^,.]{0,24}(?:열|개최|행사|축제|공연|운영)|\d{1,2}[·,]\d{1,2}일장|유효기간|시즌별|요일[^,.]{0,20}\d{1,2}(?:시|:)|\b\d{1,2}:\d{2}\b|20\d{2}년\s*\d{1,2}월/u;

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`JSONL input is missing: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function compactAxisRecord(key, record) {
  if (!record || typeof record !== "object") throw new Error(`Axis record is missing for ${key}`);
  const state = clean(record.state);
  if (!new Set(["numeric", "not_applicable"]).has(state)) {
    throw new Error(`Axis state is invalid for ${key}: ${state || "(missing)"}`);
  }
  const value = state === "numeric" ? Number(record.value) : null;
  if (state === "numeric" && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`Numeric axis value is invalid for ${key}: ${record.value}`);
  }
  if (state === "not_applicable" && record.value !== null) {
    throw new Error(`Not-applicable axis must have a null value for ${key}`);
  }
  return {
    key,
    state,
    value,
    confidence: Number.isFinite(record?.confidence) ? Number(record.confidence) : null,
    status: clean(record?.status) || "unknown",
    inferenceLevel: clean(record?.inference_level) || "unknown",
  };
}

function loadFitLabels() {
  const fitById = new Map();
  for (const record of readJsonLines(fitLabelPath)) {
    const id = clean(record.contentid);
    if (!id || fitById.has(id)) {
      throw new Error(`Invalid or duplicate fit label: ${id || "(missing contentid)"}`);
    }
    const companion = COMPANION_KEYS.map((key) => compactAxisRecord(key, record.companion_fit?.[key]));
    const month = MONTH_KEYS.map((key) => compactAxisRecord(key, record.month_fit?.[key]));
    if (companion.some((axis) => axis.state !== "numeric" || !Number.isFinite(axis.value))) {
      throw new Error(`Companion axes must be numeric for ${id}`);
    }
    fitById.set(id, {
      version: clean(record.label_meta?.version) || "place-fit-relabel-v2",
      status: clean(record.label_meta?.status) || "ai_draft",
      companion,
      month,
    });
  }
  return fitById;
}

function loadHardConstraints() {
  const constraintsById = new Map();
  let count = 0;
  for (const record of readJsonLines(hardConstraintPath)) {
    const id = clean(record.contentid);
    if (!id) throw new Error("Hard constraint is missing contentid");
    const records = constraintsById.get(id) ?? [];
    records.push({
      id: clean(record.constraint_id),
      kind: clean(record.kind),
      appliesTo: clean(record.applies_to),
      condition: clean(record.condition),
      status: clean(record.status) || "unknown",
      action: clean(record.action) || "verify",
      checkedAt: clean(record.checked_at),
      experienceScope: clean(record.experience_scope),
      ruleId: clean(record.rule_id),
      sourceUrl: clean(record.source_url || record.source),
    });
    constraintsById.set(id, records);
    count += 1;
  }
  return { constraintsById, count };
}

function normalizeLabelEntries(review) {
  if (review.atomic_labels) {
    const derived = review.derived_labels
      ? Object.entries(review.derived_labels)
      : Object.entries(review.derived_style ?? {}).map(([key, value]) => [
        key.startsWith("derived_style.") ? key : `derived_style.${key}`,
        value,
      ]);
    return [...Object.entries(review.atomic_labels), ...derived];
  }

  return [
    ...Object.entries(review.theme ?? {}).map(([key, value]) => [`theme.${key}`, value]),
    ...Object.entries(review.environment ?? {}).map(([key, value]) => [`environment.${key}`, value]),
    ...Object.entries(review.style_evidence ?? {}).map(([key, value]) => [`style_evidence.${key}`, value]),
    ...Object.entries(review.derived_style ?? {}).map(([key, value]) => [`derived_style.${key}`, value]),
  ];
}

function normalizeReviewSources(review) {
  const usedIds = new Set();
  return (review.sources ?? []).map((source, sourceIndex) => {
    const baseId = clean(source.id) || `legacy-source-${sourceIndex + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const rawClaims = Array.isArray(source.facts) && source.facts.length
      ? source.facts
      : clean(source.evidence)
        ? [source.evidence]
        : [];
    return {
      id,
      publisher: clean(source.publisher) || "출처 미기록",
      url: safeHttpUrl(source.url),
      checkedAt: clean(source.checked_at),
      sourceIndex,
      claims: rawClaims.map((claim) => clean(claim)).filter(Boolean),
    };
  });
}

function researchTier(text) {
  const semantic = RESEARCH_SEMANTIC_PATTERN.test(text);
  const catalogOnly = RESEARCH_CATALOG_PATTERN.test(text);
  const dynamic = RESEARCH_DYNAMIC_PATTERN.test(text);
  if (semantic && !catalogOnly && !dynamic) return 1;
  if (semantic && !catalogOnly) return 2;
  if (!catalogOnly && !dynamic) return 3;
  if (semantic) return 4;
  if (!catalogOnly) return 5;
  return 6;
}

function buildCompactResearch(review, normalizedSources) {
  const candidates = [];
  const seenTexts = new Set();
  for (const source of normalizedSources) {
    if (!source.url) continue;
    source.claims.forEach((text, factIndex) => {
      if (seenTexts.has(text)) return;
      seenTexts.add(text);
      candidates.push({
        text,
        sourceId: source.id,
        tier: researchTier(text),
        dynamic: RESEARCH_DYNAMIC_PATTERN.test(text),
        language: /[가-힣]/u.test(text) ? "ko" : "other",
        sourceIndex: source.sourceIndex,
        factIndex,
      });
    });
  }
  candidates.sort((left, right) =>
    left.tier - right.tier ||
    (left.language === "ko" ? 0 : 1) - (right.language === "ko" ? 0 : 1) ||
    left.sourceIndex - right.sourceIndex ||
    left.factIndex - right.factIndex
  );
  let selected = candidates.filter((claim) => !claim.dynamic && claim.tier <= 3).slice(0, 2);
  if (!selected.length) selected = candidates.filter((claim) => !claim.dynamic).slice(0, 1);
  if (!selected.length) selected = candidates.slice(0, 1);
  const selectedSourceIds = new Set(selected.map((claim) => claim.sourceId));
  return {
    status: "ai_draft",
    reviewedAt: clean(review.reviewed_at),
    coverage: selected.length && selected.every((claim) => claim.tier <= 3 && !claim.dynamic) ? "claim_available" : "metadata_only",
    highlights: selected.map(({ text, sourceId, tier, dynamic, language }) => ({ text, sourceId, tier, dynamic, language })),
    sources: normalizedSources
      .filter((source) => selectedSourceIds.has(source.id))
      .map(({ id, publisher, url, checkedAt }) => ({ id, publisher, url, checkedAt })),
  };
}

function loadV5Reviews() {
  if (!fs.existsSync(v5ReviewRoot)) {
    throw new Error(`v5 review directory is missing: ${v5ReviewRoot}`);
  }

  const reviews = new Map();
  for (const entry of fs.readdirSync(v5ReviewRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const review = JSON.parse(fs.readFileSync(path.join(v5ReviewRoot, entry.name), "utf8"));
    const id = clean(review.contentid);
    const normalizedSources = normalizeReviewSources(review);
    const labels = normalizeLabelEntries(review).map(([label, record]) => ({
      label,
      value: record.value,
      confidence: record.confidence ?? null,
      status: record.review_status ?? record.status ?? "unknown",
      rationale: clean(record.rationale),
      hold_reason: clean(record.hold_reason),
      source_ids: Array.isArray(record.source_ids) ? record.source_ids : [],
      calculation: clean(record.calculation),
    }));
    const labelKeys = new Set(labels.map((record) => record.label));
    const valuesAreValid = labels.every((record) => Number.isFinite(record.value) && record.value >= 0 && record.value <= 1);
    const exactKeys = labelKeys.size === EXPECTED_LABEL_KEYS.size && [...EXPECTED_LABEL_KEYS].every((key) => labelKeys.has(key));
    if (!id || labels.length !== 24 || !exactKeys || !valuesAreValid || reviews.has(id)) {
      throw new Error(`Invalid or duplicate v5 review: ${entry.name}`);
    }
    reviews.set(id, {
      labels,
      sources: normalizedSources.map(({ id: sourceId, publisher, url, checkedAt }) => ({
        id: sourceId,
        publisher,
        url,
        checkedAt,
      })),
      research: buildCompactResearch(review, normalizedSources),
    });
  }
  return reviews;
}

function findLatestDataset() {
  const candidates = fs
    .readdirSync(datasetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      date: entry.name,
      file: path.join(datasetRoot, entry.name, "jeju_places.json"),
    }))
    .filter((candidate) => fs.existsSync(candidate.file))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!candidates.length) {
    throw new Error(`No jeju_places.json found under ${datasetRoot}`);
  }

  return candidates[0];
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function secureImageUrl(value) {
  const image = clean(value);
  if (!/^https?:\/\//i.test(image)) return "";
  return image.replace(/^http:\/\//i, "https://");
}

function safeHttpUrl(value) {
  const url = clean(value);
  if (/^https:\/\//iu.test(url)) return url;
  if (/^http:\/\//iu.test(url)) return url.replace(/^http:\/\//iu, "https://");
  return "";
}

function regionForPlace(place) {
  const sigunguCode = clean(place.sigungucode);
  if (sigunguCode === "4") return "jeju_city";
  if (sigunguCode === "3") return "seogwipo_city";
  const address = `${clean(place.addr1)} ${clean(place.addr2)}`;
  if (address.includes("서귀포시")) return "seogwipo_city";
  if (address.includes("제주시")) return "jeju_city";
  return "unknown";
}

function isValidJejuCoordinate(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= 125.5 &&
    lng <= 127.5 &&
    lat >= 32.5 &&
    lat <= 34.2
  );
}

const source = findLatestDataset();
if (source.date !== LABEL_SNAPSHOT_DATE) {
  throw new Error(`TourAPI snapshot ${source.date} does not match label snapshot ${LABEL_SNAPSHOT_DATE}`);
}
const rawPlaces = JSON.parse(fs.readFileSync(source.file, "utf8"));
const v5Reviews = loadV5Reviews();
const fitLabels = loadFitLabels();
const { constraintsById, count: hardConstraintCount } = loadHardConstraints();
const excluded = [];

const places = rawPlaces.flatMap((place, sourceOrder) => {
  const lng = Number(place.mapx);
  const lat = Number(place.mapy);

  if (!isValidJejuCoordinate(lng, lat)) {
    excluded.push({
      id: clean(place.contentid),
      title: clean(place.title),
      lng: place.mapx,
      lat: place.mapy,
    });
    return [];
  }

  const placeId = clean(place.contentid);
  const v5Review = v5Reviews.get(placeId) ?? null;
  return [
    {
      id: placeId,
      sourceOrder,
      type: clean(place.contenttypeid),
      title: clean(place.title) || "이름 없는 장소",
      address: [clean(place.addr1), clean(place.addr2)].filter(Boolean).join(" "),
      phone: clean(place.tel),
      lng,
      lat,
      image: secureImageUrl(place.firstimage || place.firstimage2),
      thumbnail: secureImageUrl(place.firstimage2 || place.firstimage),
      modified: clean(place.modifiedtime),
      category: [clean(place.cat1), clean(place.cat2), clean(place.cat3)],
      region: regionForPlace(place),
      v5: v5Review ? { labels: v5Review.labels, sources: v5Review.sources } : null,
      research: v5Review?.research ?? null,
      fit: fitLabels.get(placeId) ?? null,
      constraints: constraintsById.get(placeId) ?? [],
      constraintCoverage: clean(place.contenttypeid) === "39" ? "not_collected" : "covered",
    },
  ];
});

const recommendationReadyCount = places.filter((place) => {
  const labels = new Map((place.v5?.labels ?? []).map((record) => [record.label, record.value]));
  return Boolean(
    place.fit &&
    ATOMIC_LABEL_KEYS.every((key) => Number.isFinite(labels.get(key))) &&
    place.fit.companion.length === COMPANION_KEYS.length &&
    place.fit.month.length === MONTH_KEYS.length
  );
}).length;
const recommendationUnscoredCount = places.length - recommendationReadyCount;
const attachedConstraintCount = places.reduce((sum, place) => sum + place.constraints.length, 0);
const attachedConstraintPlaceCount = places.filter((place) => place.constraints.length).length;
const researchAttachedCount = places.filter((place) => place.research?.highlights?.length).length;
const recommendationResearchReadyCount = places.filter((place) => place.v5 && place.fit && place.research?.highlights?.length).length;

const metadata = {
  source: "한국관광공사 TourAPI",
  sourceDate: source.date,
  labelSnapshotDate: LABEL_SNAPSHOT_DATE,
  total: rawPlaces.length,
  validCoordinates: places.length,
  excludedCoordinates: excluded.length,
  excluded,
  v5ReviewSourceCount: v5Reviews.size,
  v5ReviewAttachedCount: places.filter((place) => place.v5).length,
  fitLabelSourceCount: fitLabels.size,
  fitLabelAttachedCount: places.filter((place) => place.fit).length,
  recommendationReadyCount,
  recommendationUnscoredCount,
  researchSourceCount: [...v5Reviews.values()].filter((review) => review.research?.highlights?.length).length,
  researchAttachedCount,
  recommendationResearchReadyCount,
  hardConstraintSourceCount: hardConstraintCount,
  hardConstraintAttachedCount: attachedConstraintCount,
  hardConstraintAttachedPlaceCount: attachedConstraintPlaceCount,
  datasetStatus: "ai_draft",
  algorithmVersion: "ccu-mmr-v6-travel-mbti-three-axis",
  fitLabelVersion: "place-fit-relabel-v2-relative-five-level-companion",
  preferenceLabelVersion: "place-preference-label-v5-researched",
  researchVersion: "place-preference-label-v5-researched-sources-v1",
  hardConstraintVersion: "place-profile-v1-all-1434",
  companionKeys: COMPANION_KEYS,
  monthKeys: MONTH_KEYS,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `/* Generated from ${path.relative(workspaceRoot, source.file).replaceAll("\\", "/")} */\n` +
    `window.JEJU_DATA_META = ${JSON.stringify(metadata)};\n` +
    `window.JEJU_PLACES = ${JSON.stringify(places)};\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      input: source.file,
      output: outputPath,
      total: rawPlaces.length,
      validCoordinates: places.length,
      v5ReviewSourceCount: v5Reviews.size,
      v5ReviewAttachedCount: metadata.v5ReviewAttachedCount,
      fitLabelSourceCount: fitLabels.size,
      fitLabelAttachedCount: metadata.fitLabelAttachedCount,
      recommendationReadyCount,
      recommendationUnscoredCount,
      researchAttachedCount,
      recommendationResearchReadyCount,
      hardConstraintSourceCount: hardConstraintCount,
      hardConstraintAttachedCount: attachedConstraintCount,
      excluded,
    },
    null,
    2,
  ),
);
