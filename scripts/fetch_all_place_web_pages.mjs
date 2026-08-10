import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

const DEFAULT_INPUT_PATH = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "non_restaurants.json",
);
const DEFAULT_OUTPUT_PATH = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "full",
  "place-profile-v1-all-1434",
  "research",
  "web_pages.jsonl",
);
const DEFAULT_SEED_PATH = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v2-100",
  "research",
  "web_pages.json",
);

const PATH_BY_TYPE = Object.freeze({
  "12": "tourspot",
  "14": "culture",
  "15": "festival",
  "28": "leisure",
  "32": "stay",
  "38": "shopping",
});
const EXPECTED_TYPE_COUNTS = Object.freeze({
  "12": 566,
  "14": 97,
  "15": 28,
  "28": 137,
  "32": 209,
  "38": 397,
});
const SCHEMA_VERSION = "place-web-page-extract-v2";
const RETRYABLE_STATUS = new Set([408, 429]);

function usage() {
  return `Usage: node scripts/fetch_all_place_web_pages.mjs [options]

Options:
  --input PATH               Source non_restaurants.json
  --output PATH              Destination web_pages.jsonl
  --seed PATH                Legacy pilot web_pages.json seed/cache
  --base-url URL             Detail site base (default: https://www.ktriptips.com/kor)
  --concurrency N            Concurrent requests, 1..5 (default: 3)
  --attempts N               Attempts for retryable failures (default: 3)
  --timeout-ms N             Per-attempt timeout (default: 20000)
  --request-delay-ms N       Per-worker delay after a request (default: 300)
  --checkpoint-every N       Atomic checkpoint interval (default: 20)
  --refresh                  Fetch every place, including successful cache entries
  --dry-run                  Validate inputs/cache and print the planned work only
  --help                     Show this help
`;
}

function optionValue(argv, index, option) {
  const argument = argv[index];
  const prefix = `${option}=`;
  if (argument.startsWith(prefix)) return { value: argument.slice(prefix.length), consumed: 0 };
  if (argument === option) {
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
      throw new Error(`${option} requires a value`);
    }
    return { value: argv[index + 1], consumed: 1 };
  }
  return null;
}

function positiveInteger(value, option, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${option} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${option} must be between ${min} and ${max}`);
  }
  return parsed;
}

function nonnegativeInteger(value, option) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${option} must be a non-negative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${option} is too large`);
  return parsed;
}

function resolveCliPath(value) {
  return path.resolve(process.cwd(), value);
}

function parseArgs(argv) {
  const options = {
    inputPath: DEFAULT_INPUT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    seedPath: DEFAULT_SEED_PATH,
    baseUrl: "https://www.ktriptips.com/kor",
    concurrency: 3,
    attempts: 3,
    timeoutMs: 20_000,
    requestDelayMs: 300,
    checkpointEvery: 20,
    refresh: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }

    let parsed = optionValue(argv, index, "--input");
    if (parsed) {
      options.inputPath = resolveCliPath(parsed.value);
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--output");
    if (parsed) {
      options.outputPath = resolveCliPath(parsed.value);
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--seed");
    if (parsed) {
      options.seedPath = resolveCliPath(parsed.value);
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--base-url");
    if (parsed) {
      options.baseUrl = parsed.value.replace(/\/+$/, "");
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--concurrency");
    if (parsed) {
      options.concurrency = positiveInteger(parsed.value, "--concurrency", { max: 5 });
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--attempts");
    if (parsed) {
      options.attempts = positiveInteger(parsed.value, "--attempts", { max: 10 });
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--timeout-ms");
    if (parsed) {
      options.timeoutMs = positiveInteger(parsed.value, "--timeout-ms", { min: 100, max: 300_000 });
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--request-delay-ms");
    if (parsed) {
      options.requestDelayMs = nonnegativeInteger(parsed.value, "--request-delay-ms");
      index += parsed.consumed;
      continue;
    }
    parsed = optionValue(argv, index, "--checkpoint-every");
    if (parsed) {
      options.checkpointEvery = positiveInteger(parsed.value, "--checkpoint-every", { max: 1_434 });
      index += parsed.consumed;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  let parsedBase;
  try {
    parsedBase = new URL(options.baseUrl);
  } catch {
    throw new Error("--base-url must be an absolute HTTP(S) URL");
  }
  if (!new Set(["http:", "https:"]).has(parsedBase.protocol)) {
    throw new Error("--base-url must use HTTP or HTTPS");
  }
  return options;
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hexadecimal) => String.fromCodePoint(Number.parseInt(hexadecimal, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function textFromHtml(value) {
  return decodeHtml(String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|li|p|section)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? textFromHtml(match[1]) : "";
}

function attributeValue(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return decodeHtml(tag.match(pattern)?.[1] ?? "").trim();
}

function metaContent(html, attributeName, attributeValueExpected) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attributeValue(tag, attributeName).toLowerCase() !== attributeValueExpected.toLowerCase()) continue;
    return attributeValue(tag, "content");
  }
  return "";
}

function normalizeCandidateUrl(value, sourceUrl) {
  let candidate = decodeHtml(value).trim().replace(/[),.;]+$/, "");
  if (!candidate) return null;
  if (candidate.startsWith("www.")) candidate = `https://${candidate}`;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  try {
    const parsed = new URL(candidate, sourceUrl);
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) return null;
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function urlCandidatesFromText(value, sourceUrl) {
  const text = decodeHtml(value);
  const matches = text.match(/(?:https?:\/\/|www\.)[a-z0-9.-]+(?::\d+)?(?:\/[a-z0-9\-._~%!$&'()*+,;=:@/?#]*)?/gi) ?? [];
  return matches.map((candidate) => normalizeCandidateUrl(candidate, sourceUrl)).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function extractInfoAndHomepageCandidates(html, sourceUrl) {
  const info = {};
  const homepageCandidates = [];
  const pairPattern = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  for (const match of html.matchAll(pairPattern)) {
    const key = textFromHtml(match[1]);
    const rawValue = match[2];
    const value = textFromHtml(rawValue);
    if (!key) continue;
    const isHomepage = key.replace(/\s+/g, "").includes("홈페이지");
    if (isHomepage) {
      for (const anchor of rawValue.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
        const candidate = normalizeCandidateUrl(anchor[1], sourceUrl);
        if (candidate) homepageCandidates.push(candidate);
      }
      homepageCandidates.push(...urlCandidatesFromText(value, sourceUrl));
    }
    if (!value) continue;
    const values = info[key] ?? [];
    if (!values.includes(value)) values.push(value);
    info[key] = values;
  }
  return { info, homepageCandidates: unique(homepageCandidates) };
}

function homepageCandidatesFromInfo(info, sourceUrl) {
  const candidates = [];
  for (const [key, rawValues] of Object.entries(info ?? {})) {
    if (!key.replace(/\s+/g, "").includes("홈페이지")) continue;
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const value of values) candidates.push(...urlCandidatesFromText(value, sourceUrl));
  }
  return unique(candidates);
}

function extractPageTitle(html) {
  const heading = firstMatch(html, /<h1\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    || firstMatch(html, /<h2\b[^>]*class=["'][^"']*\bcontent-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
  if (heading) return heading;
  const openGraphTitle = metaContent(html, "property", "og:title");
  if (openGraphTitle) return textFromHtml(openGraphTitle).replace(/\s*::\s*KOREA TRIP TIPS.*$/i, "").trim();
  return firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i)
    .replace(/\s*::\s*KOREA TRIP TIPS.*$/i, "")
    .trim();
}

function extractOverview(html, metaDescription) {
  const bodyOverview = firstMatch(html, /<p\b[^>]*class=["'][^"']*\boverview\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
    || firstMatch(html, /<(?:div|section)\b[^>]*class=["'][^"']*\boverview\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (bodyOverview) return { overview: bodyOverview, overviewSource: "body_overview" };
  if (metaDescription) return { overview: textFromHtml(metaDescription), overviewSource: "meta_description" };
  return { overview: "", overviewSource: null };
}

function normalizeIdentityText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeAddress(value) {
  return normalizeIdentityText(String(value ?? "").replace(/^\s*\[?\d{5,6}\]?\s*/, ""));
}

function firstInfoValue(info, targetKey) {
  for (const [key, values] of Object.entries(info ?? {})) {
    if (key.replace(/\s+/g, "") !== targetKey) continue;
    if (Array.isArray(values)) return String(values[0] ?? "").trim();
    return String(values ?? "").trim();
  }
  return "";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 60_000);
  }
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(500 * (2 ** (attempt - 1)) + jitter, 30_000);
}

function isRetryableStatus(status) {
  return RETRYABLE_STATUS.has(status) || (status >= 500 && status <= 599);
}

function conciseError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 1_000);
  return String(error).slice(0, 1_000);
}

async function fetchWithRetry(url, options) {
  let lastError = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
          "user-agent": "TripAIResearch/2.0 (+public place labeling research)",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      const html = await response.text();
      clearTimeout(timer);
      if (isRetryableStatus(response.status) && attempt < options.attempts) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }
      return { response, html, attemptCount: attempt };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < options.attempts) {
        await sleep(retryDelayMs(null, attempt));
        continue;
      }
      const wrapped = new Error(conciseError(lastError));
      wrapped.attemptCount = attempt;
      throw wrapped;
    }
  }
  throw new Error(conciseError(lastError));
}

function sourceUrlFor(place, baseUrl) {
  const contentType = String(place.contenttypeid ?? "");
  const section = PATH_BY_TYPE[contentType];
  if (!section) throw new Error(`Unsupported content type ${contentType} for ${place.contentid}`);
  return `${baseUrl}/${section}/${encodeURIComponent(String(place.contentid))}`;
}

function baseRecord(place, sourceOrder, sourceUrl) {
  return {
    schema_version: SCHEMA_VERSION,
    source_order: sourceOrder,
    contentid: String(place.contentid),
    expected_title: String(place.title),
    expected_address: [place.addr1, place.addr2].filter(Boolean).join(" ").trim(),
    contenttypeid: String(place.contenttypeid),
    source_url: sourceUrl,
    publisher: "K-TRIP TIPS",
    source_type: "reputable_secondary",
  };
}

function pageIdentityFields(place, pageTitle, info) {
  const pageAddress = firstInfoValue(info, "주소");
  const expectedAddress = [place.addr1, place.addr2].filter(Boolean).join(" ").trim();
  const normalizedExpectedAddress = normalizeAddress(expectedAddress);
  const normalizedPageAddress = normalizeAddress(pageAddress);
  return {
    page_title: pageTitle,
    title_matches: pageTitle === String(place.title),
    normalized_title_matches: Boolean(pageTitle)
      && normalizeIdentityText(pageTitle) === normalizeIdentityText(place.title),
    page_address: pageAddress,
    address_matches: pageAddress
      ? normalizedExpectedAddress.includes(normalizedPageAddress)
        || normalizedPageAddress.includes(normalizedExpectedAddress)
      : null,
  };
}

async function fetchPlace(place, sourceOrder, options) {
  const sourceUrl = sourceUrlFor(place, options.baseUrl);
  const common = baseRecord(place, sourceOrder, sourceUrl);
  try {
    const { response, html, attemptCount } = await fetchWithRetry(sourceUrl, options);
    const finalUrl = response.url || sourceUrl;
    const unexpectedRedirect = finalUrl !== sourceUrl;
    const metaDescription = metaContent(html, "name", "description")
      || metaContent(html, "property", "og:description");
    const { overview, overviewSource } = extractOverview(html, metaDescription);
    const { info, homepageCandidates } = extractInfoAndHomepageCandidates(html, sourceUrl);
    const pageTitle = extractPageTitle(html);
    const sourceModified = firstMatch(html, /갱신\s*:\s*([\d-]+\s+[\d:]+)/i)
      || firstInfoValue(info, "최종수정일")
      || null;
    return {
      ...common,
      fetched_on: isoDate(),
      http_status: response.status,
      final_url: finalUrl,
      redirected: Boolean(response.redirected),
      response_content_type: response.headers.get("content-type"),
      response_bytes: Buffer.byteLength(html, "utf8"),
      attempt_count: attemptCount,
      ...pageIdentityFields(place, pageTitle, info),
      overview,
      overview_source: overviewSource,
      meta_description: textFromHtml(metaDescription),
      info,
      homepage_urls: homepageCandidates,
      source_modified: sourceModified,
      page_sha256: sha256(html),
      retrieval_error: !response.ok
        ? `HTTP ${response.status} ${response.statusText}`.trim()
        : unexpectedRedirect
          ? `Unexpected redirect: ${sourceUrl} -> ${finalUrl}`
          : null,
      cache_origin: "network",
    };
  } catch (error) {
    return {
      ...common,
      fetched_on: isoDate(),
      http_status: null,
      final_url: null,
      redirected: false,
      response_content_type: null,
      response_bytes: null,
      attempt_count: Number(error?.attemptCount ?? options.attempts),
      ...pageIdentityFields(place, "", {}),
      overview: "",
      overview_source: null,
      meta_description: "",
      info: {},
      homepage_urls: [],
      source_modified: null,
      page_sha256: null,
      retrieval_error: conciseError(error),
      cache_origin: "network",
    };
  }
}

function parseJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

function validatePlaces(value) {
  if (!Array.isArray(value)) throw new Error("Input must be a JSON array");
  if (value.length !== 1_434) throw new Error(`Expected 1,434 input places, received ${value.length}`);
  const ids = new Set();
  const typeCounts = Object.fromEntries(Object.keys(EXPECTED_TYPE_COUNTS).map((key) => [key, 0]));
  for (const [index, place] of value.entries()) {
    const contentid = String(place.contentid ?? "");
    const contentType = String(place.contenttypeid ?? "");
    if (!contentid) throw new Error(`Input row ${index} has no contentid`);
    if (ids.has(contentid)) throw new Error(`Duplicate input contentid ${contentid}`);
    ids.add(contentid);
    if (!(contentType in PATH_BY_TYPE)) {
      throw new Error(`Unsupported input contenttypeid ${contentType} at row ${index}`);
    }
    if (!String(place.title ?? "").trim()) throw new Error(`Input row ${index} has no title`);
    typeCounts[contentType] += 1;
  }
  for (const [contentType, expected] of Object.entries(EXPECTED_TYPE_COUNTS)) {
    if (typeCounts[contentType] !== expected) {
      throw new Error(`Expected ${expected} type ${contentType} places, received ${typeCounts[contentType]}`);
    }
  }
  return { ids, typeCounts };
}

function parseJsonl(pathname) {
  if (!fs.existsSync(pathname)) return [];
  const records = [];
  const lines = fs.readFileSync(pathname, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid JSONL at ${pathname}:${index + 1}: ${conciseError(error)}`);
    }
  }
  return records;
}

function validSha256(value) {
  return /^[0-9a-f]{64}$/i.test(String(value ?? ""));
}

function isSuccessful(record) {
  return Number.isInteger(record?.http_status)
    && record.http_status >= 200
    && record.http_status < 300
    && validSha256(record.page_sha256)
    && !record.retrieval_error
    && /^https?:\/\//i.test(String(record.source_url ?? ""))
    && String(record.final_url ?? "") === String(record.source_url ?? "");
}

function loadOutputRecords(outputPath, placesById) {
  const records = new Map();
  for (const record of parseJsonl(outputPath)) {
    const contentid = String(record.contentid ?? "");
    const placeEntry = placesById.get(contentid);
    if (!placeEntry) throw new Error(`Output cache contains unknown contentid ${contentid || "<missing>"}`);
    if (records.has(contentid)) throw new Error(`Output cache contains duplicate contentid ${contentid}`);
    if (Number(record.source_order) !== placeEntry.sourceOrder) {
      throw new Error(`Output cache source_order mismatch for ${contentid}`);
    }
    records.set(contentid, record);
  }
  return records;
}

function legacySeedRecords(seedPath, placesById, baseUrl) {
  if (!fs.existsSync(seedPath)) return new Map();
  const payload = parseJson(seedPath);
  const items = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(items)) throw new Error("Seed cache must be an array or contain items[]");
  const records = new Map();
  for (const item of items) {
    const contentid = String(item.contentid ?? "");
    const placeEntry = placesById.get(contentid);
    if (!placeEntry) continue;
    if (records.has(contentid)) throw new Error(`Seed cache contains duplicate contentid ${contentid}`);
    const { place, sourceOrder } = placeEntry;
    const sourceUrl = item.source_url || sourceUrlFor(place, baseUrl);
    const info = item.info && typeof item.info === "object" ? item.info : {};
    const pageTitle = String(item.page_title ?? "");
    const record = {
      ...baseRecord(place, sourceOrder, sourceUrl),
      fetched_on: item.fetched_on ?? null,
      http_status: Number.isInteger(item.http_status) ? item.http_status : null,
      final_url: sourceUrl,
      redirected: false,
      response_content_type: null,
      response_bytes: null,
      attempt_count: 0,
      ...pageIdentityFields(place, pageTitle, info),
      overview: String(item.overview ?? ""),
      overview_source: item.overview ? "body_overview" : null,
      meta_description: String(item.meta_description ?? ""),
      info,
      homepage_urls: homepageCandidatesFromInfo(info, sourceUrl),
      source_modified: item.source_modified ?? null,
      page_sha256: item.page_sha256 ?? null,
      retrieval_error: item.retrieval_error ?? null,
      cache_origin: "pilot_seed",
      seed_schema_version: payload.schema_version ?? "place-web-page-extract-v1",
    };
    records.set(contentid, record);
  }
  return records;
}

function orderedRecords(places, recordsById) {
  const result = [];
  for (const place of places) {
    const record = recordsById.get(String(place.contentid));
    if (record) result.push(record);
  }
  return result;
}

function writeAtomicJsonl(outputPath, records) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  const body = records.length > 0
    ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
    : "";
  try {
    const descriptor = fs.openSync(tempPath, "wx");
    try {
      fs.writeFileSync(descriptor, body, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(tempPath, outputPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function validateFinalRecords(places, records) {
  if (records.length !== places.length) {
    throw new Error(`Expected ${places.length} output records, received ${records.length}`);
  }
  const ids = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const expectedId = String(places[index].contentid);
    if (String(record.contentid) !== expectedId || Number(record.source_order) !== index) {
      throw new Error(`Output order mismatch at row ${index}`);
    }
    if (ids.has(expectedId)) throw new Error(`Duplicate output contentid ${expectedId}`);
    ids.add(expectedId);
    if (!record.retrieval_error && !validSha256(record.page_sha256)) {
      throw new Error(`Output ${expectedId} has neither a page hash nor an error`);
    }
  }
}

function workspaceRelative(value) {
  const relative = path.relative(workspaceRoot, value).replaceAll("\\", "/");
  return relative && !relative.startsWith("..") ? relative : value;
}

function printSummary(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const places = parseJson(options.inputPath);
  const { typeCounts } = validatePlaces(places);
  const placesById = new Map(places.map((place, sourceOrder) => [
    String(place.contentid),
    { place, sourceOrder },
  ]));
  const outputRecords = loadOutputRecords(options.outputPath, placesById);
  const seedRecords = legacySeedRecords(options.seedPath, placesById, options.baseUrl);
  const recordsById = new Map(outputRecords);
  for (const [contentid, record] of seedRecords) {
    if (!isSuccessful(recordsById.get(contentid)) && isSuccessful(record)) {
      recordsById.set(contentid, record);
    }
  }

  const cachedSuccessCount = [...recordsById.values()].filter(isSuccessful).length;
  const queue = places
    .map((place, sourceOrder) => ({ place, sourceOrder }))
    .filter(({ place }) => options.refresh || !isSuccessful(recordsById.get(String(place.contentid))));

  if (options.dryRun) {
    printSummary({
      mode: "dry-run",
      input: workspaceRelative(options.inputPath),
      output: workspaceRelative(options.outputPath),
      seed: workspaceRelative(options.seedPath),
      total: places.length,
      type_counts: typeCounts,
      existing_output_records: outputRecords.size,
      seed_records: seedRecords.size,
      cached_success: cachedSuccessCount,
      to_fetch: queue.length,
      refresh: options.refresh,
      concurrency: options.concurrency,
    });
    return;
  }

  let nextQueueIndex = 0;
  let fetchedThisRun = 0;
  let stopRequested = false;
  let checkpointInProgress = false;
  const checkpoint = () => {
    if (checkpointInProgress) return;
    checkpointInProgress = true;
    try {
      writeAtomicJsonl(options.outputPath, orderedRecords(places, recordsById));
    } finally {
      checkpointInProgress = false;
    }
  };
  const requestStop = () => {
    if (stopRequested) {
      process.exit(130);
    }
    stopRequested = true;
    process.stderr.write("Stop requested; finishing active requests and writing an atomic checkpoint.\n");
  };
  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  async function worker() {
    while (!stopRequested) {
      const queueIndex = nextQueueIndex;
      nextQueueIndex += 1;
      if (queueIndex >= queue.length) return;
      const { place, sourceOrder } = queue[queueIndex];
      const result = await fetchPlace(place, sourceOrder, options);
      recordsById.set(String(place.contentid), result);
      fetchedThisRun += 1;
      const status = result.http_status ?? "ERR";
      process.stdout.write(
        `${String(fetchedThisRun).padStart(4, "0")}/${String(queue.length).padStart(4, "0")} ${status} ${place.contentid} ${place.title}\n`,
      );
      if (fetchedThisRun % options.checkpointEvery === 0) checkpoint();
      if (options.requestDelayMs > 0 && !stopRequested) await sleep(options.requestDelayMs);
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  const finalRecords = orderedRecords(places, recordsById);
  if (!stopRequested) validateFinalRecords(places, finalRecords);
  writeAtomicJsonl(options.outputPath, finalRecords);

  const successful = finalRecords.filter(isSuccessful).length;
  const errors = finalRecords.filter((record) => !isSuccessful(record));
  printSummary({
    mode: stopRequested ? "checkpointed" : "complete",
    output: workspaceRelative(options.outputPath),
    total_records: finalRecords.length,
    successful,
    errors: errors.length,
    fetched_this_run: fetchedThisRun,
    reused_success: options.refresh ? 0 : cachedSuccessCount,
    with_overview: finalRecords.filter((record) => record.overview).length,
    with_homepage_urls: finalRecords.filter((record) => record.homepage_urls?.length > 0).length,
    strict_title_matches: finalRecords.filter((record) => record.title_matches).length,
    normalized_title_matches: finalRecords.filter((record) => record.normalized_title_matches).length,
    output_sha256: sha256(fs.readFileSync(options.outputPath)),
  });
  if (stopRequested) process.exitCode = 130;
}

main().catch((error) => {
  process.stderr.write(`ERROR: ${conciseError(error)}\n`);
  process.exitCode = 1;
});
