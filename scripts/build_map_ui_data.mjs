import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const datasetRoot = path.join(workspaceRoot, "data", "tourapi", "jeju");
const outputPath = path.join(workspaceRoot, "map-ui", "data", "jeju-places.js");

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

console.log(
  JSON.stringify(
    {
      input: source.file,
      output: outputPath,
      total: rawPlaces.length,
      validCoordinates: places.length,
      excluded,
    },
    null,
    2,
  ),
);
