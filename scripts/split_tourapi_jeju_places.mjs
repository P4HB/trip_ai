import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const datasetRoot = path.join(workspaceRoot, "data", "tourapi", "jeju");
const labelingRoot = path.join(workspaceRoot, "data", "labeling", "jeju");

const RESTAURANT_CONTENT_TYPE = "39";
const NON_RESTAURANT_CONTENT_TYPES = ["12", "14", "15", "25", "28", "32", "38"];
const SUPPORTED_CONTENT_TYPES = new Set([
  ...NON_RESTAURANT_CONTENT_TYPES,
  RESTAURANT_CONTENT_TYPE,
]);
const CONTENT_TYPE_NAMES = {
  "12": "관광지",
  "14": "문화시설",
  "15": "축제공연행사",
  "25": "여행코스",
  "28": "레포츠",
  "32": "숙박",
  "38": "쇼핑",
  "39": "음식점",
};

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function clean(value) {
  return String(value ?? "").trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function findLatestDataset() {
  if (!fs.existsSync(datasetRoot)) {
    throw new Error(`Dataset directory does not exist: ${datasetRoot}`);
  }

  const candidates = fs
    .readdirSync(datasetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => ({
      date: entry.name,
      directory: path.join(datasetRoot, entry.name),
      placesFile: path.join(datasetRoot, entry.name, "jeju_places.json"),
      manifestFile: path.join(datasetRoot, entry.name, "manifest.json"),
    }))
    .filter((candidate) => fs.existsSync(candidate.placesFile))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!candidates.length) {
    throw new Error(`No dated jeju_places.json found under ${datasetRoot}`);
  }

  return candidates[0];
}

function readSourceManifest(source, sourceHash) {
  if (!fs.existsSync(source.manifestFile)) {
    return { fetchedAt: null, manifestPath: null, manifestHash: null };
  }

  const manifestBytes = fs.readFileSync(source.manifestFile);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const declaredHash = clean(manifest?.files?.["jeju_places.json"]?.sha256);

  if (declaredHash && declaredHash !== sourceHash) {
    throw new Error(
      `Source hash differs from ${relativePath(source.manifestFile)}: ` +
        `expected ${declaredHash}, received ${sourceHash}`,
    );
  }

  return {
    fetchedAt: clean(manifest.fetched_at) || null,
    manifestPath: relativePath(source.manifestFile),
    manifestHash: sha256(manifestBytes),
  };
}

function partitionPlaces(rawPlaces) {
  if (!Array.isArray(rawPlaces)) {
    throw new Error("jeju_places.json must contain a top-level JSON array");
  }

  const seenIds = new Set();
  const restaurants = [];
  const nonRestaurants = [];
  const contentTypeCounts = Object.fromEntries(
    Object.entries(CONTENT_TYPE_NAMES).map(([id, name]) => [id, { name, count: 0 }]),
  );

  rawPlaces.forEach((place, index) => {
    if (!place || typeof place !== "object" || Array.isArray(place)) {
      throw new Error(`Record at index ${index} must be a JSON object`);
    }

    const contentId = clean(place.contentid);
    const contentTypeId = clean(place.contenttypeid);

    if (!contentId) {
      throw new Error(`Record at index ${index} has an empty contentid`);
    }
    if (seenIds.has(contentId)) {
      throw new Error(`Duplicate contentid: ${contentId}`);
    }
    if (!contentTypeId) {
      throw new Error(`Record ${contentId} has an empty contenttypeid`);
    }
    if (!SUPPORTED_CONTENT_TYPES.has(contentTypeId)) {
      throw new Error(`Record ${contentId} has unsupported contenttypeid: ${contentTypeId}`);
    }

    seenIds.add(contentId);
    contentTypeCounts[contentTypeId].count += 1;

    if (contentTypeId === RESTAURANT_CONTENT_TYPE) {
      restaurants.push(place);
    } else {
      nonRestaurants.push(place);
    }
  });

  const restaurantIds = new Set(restaurants.map((place) => clean(place.contentid)));
  const nonRestaurantIds = new Set(nonRestaurants.map((place) => clean(place.contentid)));
  const overlap = [...restaurantIds].filter((contentId) => nonRestaurantIds.has(contentId));

  if (overlap.length) {
    throw new Error(`Partition overlap detected: ${overlap.join(", ")}`);
  }
  if (restaurantIds.size + nonRestaurantIds.size !== seenIds.size) {
    throw new Error("Partition union does not match the source contentid set");
  }
  if (restaurants.length + nonRestaurants.length !== rawPlaces.length) {
    throw new Error("Partition counts do not add up to the source record count");
  }

  return { restaurants, nonRestaurants, contentTypeCounts };
}

const source = findLatestDataset();
const sourceBytes = fs.readFileSync(source.placesFile);
const sourceHash = sha256(sourceBytes);
const sourceManifest = readSourceManifest(source, sourceHash);
const rawPlaces = JSON.parse(sourceBytes.toString("utf8"));
const { restaurants, nonRestaurants, contentTypeCounts } = partitionPlaces(rawPlaces);

const outputDirectory = path.join(labelingRoot, source.date);
const restaurantsPath = path.join(outputDirectory, "restaurants.json");
const nonRestaurantsPath = path.join(outputDirectory, "non_restaurants.json");
const manifestPath = path.join(outputDirectory, "manifest.json");
const restaurantsJson = serialize(restaurants);
const nonRestaurantsJson = serialize(nonRestaurants);

const manifest = {
  schema_version: "tourapi-jeju-place-partition-v1",
  source: {
    path: relativePath(source.placesFile),
    snapshot_date: source.date,
    fetched_at: sourceManifest.fetchedAt,
    sha256: sourceHash,
    manifest_path: sourceManifest.manifestPath,
    manifest_sha256: sourceManifest.manifestHash,
  },
  partition: {
    field: "contenttypeid",
    restaurant_value: RESTAURANT_CONTENT_TYPE,
    non_restaurant_values: NON_RESTAURANT_CONTENT_TYPES,
    unsupported_value_policy: "error",
  },
  counts: {
    total: rawPlaces.length,
    restaurants: restaurants.length,
    non_restaurants: nonRestaurants.length,
    by_content_type: contentTypeCounts,
  },
  integrity: {
    unique_contentids: rawPlaces.length,
    partition_overlap_count: 0,
    preserves_source_records: true,
    preserves_source_order: true,
    coordinate_filter_applied: false,
  },
  files: {
    "restaurants.json": {
      count: restaurants.length,
      sha256: sha256(restaurantsJson),
    },
    "non_restaurants.json": {
      count: nonRestaurants.length,
      sha256: sha256(nonRestaurantsJson),
    },
  },
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(restaurantsPath, restaurantsJson, "utf8");
fs.writeFileSync(nonRestaurantsPath, nonRestaurantsJson, "utf8");
fs.writeFileSync(manifestPath, serialize(manifest), "utf8");

console.log(
  JSON.stringify(
    {
      input: relativePath(source.placesFile),
      output_directory: relativePath(outputDirectory),
      total: rawPlaces.length,
      restaurants: restaurants.length,
      non_restaurants: nonRestaurants.length,
    },
    null,
    2,
  ),
);
