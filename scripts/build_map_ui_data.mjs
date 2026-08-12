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
const outputPath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");

function normalizeLabelEntries(review) {
  if (review.atomic_labels) {
    return [...Object.entries(review.atomic_labels), ...Object.entries(review.derived_labels ?? review.derived_style ?? {})];
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
    if (!id || labels.length !== 24 || reviews.has(id)) {
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
const rawPlaces = JSON.parse(fs.readFileSync(source.file, "utf8"));
const v5Reviews = loadV5Reviews();
const excluded = [];

const places = rawPlaces.flatMap((place) => {
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
      v5: v5Reviews.get(clean(place.contentid)) ?? null,
    },
  ];
});

const metadata = {
  source: "한국관광공사 TourAPI",
  sourceDate: source.date,
  total: rawPlaces.length,
  validCoordinates: places.length,
  excludedCoordinates: excluded.length,
  excluded,
  v5ReviewCount: v5Reviews.size,
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
      v5ReviewCount: v5Reviews.size,
      excluded,
    },
    null,
    2,
  ),
);
