import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const datasetRoot = path.join(workspaceRoot, "data", "tourapi", "jeju");
const outputPath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");
const labelOutputPath = path.join(workspaceRoot, "map-ui", "data", "jeju-place-labels.js");
const SCORE_SCALE = [0, 0.25, 0.5, 0.75, 1];
const LABEL_GROUPS = {
  theme: [
    "mountain",
    "ocean",
    "activity",
    "culture_history",
    "theme_park",
    "cafe",
    "traditional_market",
    "festival",
  ],
  environment: ["indoor_ratio", "weather_sensitivity"],
  style_evidence: [
    "restfulness",
    "physical_ease",
    "visit_duration_flexibility",
    "scenic_value",
    "distinctiveness",
    "local_embeddedness",
    "landmark_significance",
    "photo_value",
  ],
  derived_style: [
    "healing_slow",
    "scenic_immersion",
    "discovery_explorer",
    "local_immersion",
    "iconic_highlight",
    "photo_mood",
  ],
};
const LABEL_PATHS = Object.entries(LABEL_GROUPS).flatMap(([group, labels]) =>
  labels.map((label) => `${group}.${label}`),
);

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

function loadPlaceLabels(sourceDate) {
  const labelDirectory = path.join(
    workspaceRoot,
    "data",
    "labeling",
    "jeju",
    sourceDate,
    "place-preference-label-v2",
  );
  const labelPath = path.join(labelDirectory, "place_labels.jsonl");
  const manifestPath = path.join(labelDirectory, "manifest.json");

  if (!fs.existsSync(labelPath) || !fs.existsSync(manifestPath)) {
    return {
      metadata: {
        available: false,
        sourceDate,
        labelVersion: "",
        labeledPlaces: 0,
        paths: LABEL_PATHS,
        scoreScale: SCORE_SCALE,
      },
      labels: {},
      sourcePath: labelPath,
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.snapshot_date !== sourceDate) {
    throw new Error(
      `Label snapshot ${manifest.snapshot_date} does not match map snapshot ${sourceDate}`,
    );
  }

  const allowedValues = new Set(SCORE_SCALE);
  const labels = {};
  const lines = fs
    .readFileSync(labelPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  for (const [index, line] of lines.entries()) {
    const record = JSON.parse(line);
    const contentid = clean(record.contentid);
    if (!contentid) throw new Error(`Label record ${index + 1} has no contentid`);
    if (Object.hasOwn(labels, contentid)) {
      throw new Error(`Duplicate label contentid: ${contentid}`);
    }

    const values = LABEL_PATHS.map((labelPathKey) => {
      const [group, label] = labelPathKey.split(".");
      const value = record[group]?.[label]?.value;
      if (!allowedValues.has(value)) {
        throw new Error(`${contentid} ${labelPathKey} has invalid value: ${value}`);
      }
      return value;
    });
    labels[contentid] = values;
  }

  return {
    metadata: {
      available: true,
      sourceDate,
      labelVersion: clean(manifest.label_version),
      labeledPlaces: lines.length,
      paths: LABEL_PATHS,
      scoreScale: SCORE_SCALE,
    },
    labels,
    sourcePath: labelPath,
  };
}

const source = findLatestDataset();
const rawPlaces = JSON.parse(fs.readFileSync(source.file, "utf8"));
const labelDataset = loadPlaceLabels(source.date);
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
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `/* Generated from ${path.relative(workspaceRoot, source.file).replaceAll("\\", "/")} */\n` +
    `window.JEJU_DATA_META = ${JSON.stringify(metadata)};\n` +
    `window.JEJU_PLACES = ${JSON.stringify(places)};\n`,
  "utf8",
);

fs.writeFileSync(
  labelOutputPath,
  `/* Generated from ${path.relative(workspaceRoot, labelDataset.sourcePath).replaceAll("\\", "/")} */\n` +
    `window.JEJU_LABEL_META = ${JSON.stringify(labelDataset.metadata)};\n` +
    `window.JEJU_PLACE_LABELS = ${JSON.stringify(labelDataset.labels)};\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      input: source.file,
      output: outputPath,
      labelOutput: labelOutputPath,
      total: rawPlaces.length,
      validCoordinates: places.length,
      labeledPlaces: labelDataset.metadata.labeledPlaces,
      excluded,
    },
    null,
    2,
  ),
);
