import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const profilesPath = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v1-100",
  "place_profiles.json",
);
const outputPath = path.join(
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

const PATH_BY_TYPE = {
  "12": "tourspot",
  "14": "culture",
  "15": "festival",
  "28": "leisure",
};

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
    .replace(/<\/p\s*>/gi, "\n")
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

function extractInfo(html) {
  const info = {};
  const pairPattern = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  for (const match of html.matchAll(pairPattern)) {
    const key = textFromHtml(match[1]);
    const value = textFromHtml(match[2]);
    if (!key || !value) continue;
    const values = info[key] ?? [];
    if (!values.includes(value)) values.push(value);
    info[key] = values;
  }
  return info;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
          "user-agent": "TripAIResearch/1.0 (+public place labeling research)",
        },
        signal: controller.signal,
      });
      const html = await response.text();
      clearTimeout(timer);
      return { response, html };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function fetchPlace(profile, index) {
  const contentType = profile.source_place.contenttypeid;
  const section = PATH_BY_TYPE[contentType];
  if (!section) throw new Error(`Unsupported content type ${contentType}`);
  const url = `https://www.ktriptips.com/kor/${section}/${profile.contentid}`;
  try {
    const { response, html } = await fetchWithRetry(url);
    const overview = firstMatch(html, /<p\b[^>]*class=["'][^"']*\boverview\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const pageTitle = firstMatch(html, /<h1\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      || firstMatch(html, /<h2\b[^>]*class=["'][^"']*\bcontent-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
    const modified = firstMatch(html, /갱신\s*:\s*([\d-]+\s+[\d:]+)/i);
    const metaDescription = decodeHtml(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? "").trim();
    return {
      index,
      contentid: profile.contentid,
      expected_title: profile.title,
      contenttypeid: contentType,
      source_url: url,
      publisher: "K-TRIP TIPS",
      source_type: "reputable_secondary",
      fetched_on: "2026-08-10",
      http_status: response.status,
      page_title: pageTitle,
      title_matches: pageTitle === profile.title,
      overview,
      meta_description: metaDescription,
      info: extractInfo(html),
      source_modified: modified || null,
      page_sha256: sha256(html),
      retrieval_error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      index,
      contentid: profile.contentid,
      expected_title: profile.title,
      contenttypeid: contentType,
      source_url: url,
      publisher: "K-TRIP TIPS",
      source_type: "reputable_secondary",
      fetched_on: "2026-08-10",
      http_status: null,
      page_title: "",
      title_matches: false,
      overview: "",
      meta_description: "",
      info: {},
      source_modified: null,
      page_sha256: null,
      retrieval_error: error instanceof Error ? error.message : String(error),
    };
  }
}

const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
if (!Array.isArray(profiles) || profiles.length !== 100) throw new Error("Expected 100 v1 profiles");

const results = new Array(profiles.length);
let nextIndex = 0;
async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= profiles.length) return;
    results[index] = await fetchPlace(profiles[index], index);
    const result = results[index];
    console.log(`${String(index + 1).padStart(3, "0")}/100 ${result.http_status ?? "ERR"} ${profiles[index].title}`);
  }
}

await Promise.all(Array.from({ length: 5 }, () => worker()));

const output = {
  schema_version: "place-web-page-extract-v1",
  fetched_on: "2026-08-10",
  source: "https://www.ktriptips.com/",
  items: results,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: path.relative(workspaceRoot, outputPath).replaceAll("\\", "/"),
  total: results.length,
  http_ok: results.filter((item) => item.http_status >= 200 && item.http_status < 300).length,
  title_matches: results.filter((item) => item.title_matches).length,
  with_overview: results.filter((item) => item.overview).length,
  errors: results.filter((item) => item.retrieval_error).map((item) => ({ contentid: item.contentid, error: item.retrieval_error })),
}, null, 2));
