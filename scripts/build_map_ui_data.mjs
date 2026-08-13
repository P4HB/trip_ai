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

function loadV5Reviews() {
  if (!fs.existsSync(v5ReviewRoot)) {
    throw new Error(`v5 review directory is missing: ${v5ReviewRoot}`);
  }

  const reviews = new Map();
  for (const entry of fs.readdirSync(v5ReviewRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const review = JSON.parse(fs.readFileSync(path.join(v5ReviewRoot, entry.name), "utf8"));
    const id = clean(review.contentid);
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
      sources: (review.sources ?? []).map((source) => ({
        id: clean(source.id),
        publisher: clean(source.publisher),
        url: clean(source.url),
      })),
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

  return [
    {
      id: clean(place.contentid),
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
      v5: v5Reviews.get(clean(place.contentid)) ?? null,
      fit: fitLabels.get(clean(place.contentid)) ?? null,
      constraints: constraintsById.get(clean(place.contentid)) ?? [],
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
  hardConstraintSourceCount: hardConstraintCount,
  hardConstraintAttachedCount: attachedConstraintCount,
  hardConstraintAttachedPlaceCount: attachedConstraintPlaceCount,
  datasetStatus: "ai_draft",
  algorithmVersion: "ccu-mmr-v0-demo",
  fitLabelVersion: "place-fit-relabel-v2-relative-five-level-companion",
  preferenceLabelVersion: "place-preference-label-v5-researched",
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
      hardConstraintSourceCount: hardConstraintCount,
      hardConstraintAttachedCount: attachedConstraintCount,
      excluded,
    },
    null,
    2,
  ),
);
