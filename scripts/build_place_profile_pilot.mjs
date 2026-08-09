import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const pilotDirectory = path.join(
  workspaceRoot,
  "data",
  "labeling",
  "jeju",
  "2026-08-09",
  "pilots",
  "place-profile-v1-100",
);
const selectionPath = path.join(pilotDirectory, "selection_ids.json");
const researchDirectory = path.join(pilotDirectory, "research");
const targetedSourcesPath = path.join(researchDirectory, "targeted_sources.json");
const profilesPath = path.join(pilotDirectory, "place_profiles.json");
const manifestPath = path.join(pilotDirectory, "manifest.json");
const reportPath = path.join(pilotDirectory, "review_report.md");

const COMPANION_KEYS = ["solo", "couple", "friends", "kids", "parents"];
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const LABEL_VALUES = new Set([0, 0.25, 0.5, 0.75, 1, null]);
const EVIDENCE_VALUE_KEYS = [
  "physical_effort",
  "indoor_ratio",
  "rain_sensitivity",
  "wind_sensitivity",
  "heat_sensitivity",
  "cold_sensitivity",
];
const DISALLOWED_SOURCE_URLS_BY_CONTENTID = {
  "1839451": new Set([
    "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_000000000021303",
  ]),
  "2414827": new Set([
    "https://www.visitjeju.net/kr/themtour/view?contentsid=CNTS_000002000000000000",
  ]),
  "3030351": new Set([
    "https://www.visitjeju.net/en/themtour/view?contentsid=CNTS_300000000014401&menuId=DOM_700000000010790",
  ]),
};

const MONTH_TEMPLATES = {
  neutral: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  outdoor: [0.25, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.5, 0.75, 1, 0.75, 0.25],
  forest: [0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.5, 0.75, 1, 0.75, 0.25],
  coast: [0.25, 0.25, 0.5, 0.75, 0.75, 0.75, 0.75, 0.75, 1, 1, 0.5, 0.25],
  beach: [0.25, 0.25, 0.25, 0.5, 0.75, 1, 1, 1, 0.75, 0.5, 0.25, 0.25],
  hot_spring: [1, 1, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.75, 0.75, 1],
  cherry_blossom: [0.25, 0.5, 1, 1, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
  unavailable: Array(12).fill(null),
};

function monthObject(templateName) {
  return Object.fromEntries(MONTH_KEYS.map((month, index) => [month, MONTH_TEMPLATES[templateName][index]]));
}

function makePrior({
  name,
  companion,
  monthTemplate,
  environment,
  physicalEffort,
  indoorRatio,
  rain,
  wind,
  heat,
  cold,
  companionBasis,
  monthBasis,
}) {
  const months = monthObject(monthTemplate);
  return {
    name,
    companion,
    months,
    evidence: {
      environment,
      physical_effort: physicalEffort,
      indoor_ratio: indoorRatio,
      seasonal_peak_months: MONTH_KEYS.filter((month) => months[month] === 1).map(Number),
      rain_sensitivity: rain,
      wind_sensitivity: wind,
      heat_sensitivity: heat,
      cold_sensitivity: cold,
      companion_basis: [companionBasis],
      month_basis: [monthBasis],
      limitations: [
        "장소별 상세 근거가 없거나 세부 점수 축까지 뒷받침하지 못해 TourAPI 제목·신분류 기반 사전값을 적용함",
      ],
    },
  };
}

function categoryPrior(source) {
  const title = clean(source.title);
  const type = clean(source.contenttypeid);
  const l1 = clean(source.lclsSystm1);
  const l2 = clean(source.lclsSystm2);

  if (type === "15") {
    return makePrior({
      name: "event_availability_unknown",
      companion: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.5, parents: 0.5 },
      monthTemplate: "unavailable",
      environment: "mixed",
      physicalEffort: 0.25,
      indoorRatio: 0.5,
      rain: 0.5,
      wind: 0.5,
      heat: 0.5,
      cold: 0.5,
      companionBasis: "행사 유형의 일반적인 공동 관람 특성",
      monthBasis: "개최기간을 확인하지 못해 월별 적합도를 판단하지 않음",
    });
  }

  if (/벚꽃/.test(title)) {
    return makePrior({
      name: "cherry_blossom",
      companion: { solo: 0.75, couple: 1, friends: 0.75, kids: 0.75, parents: 0.75 },
      monthTemplate: "cherry_blossom",
      environment: "outdoor",
      physicalEffort: 0.25,
      indoorRatio: 0,
      rain: 0.75,
      wind: 0.75,
      heat: 0.5,
      cold: 0.5,
      companionBasis: "꽃길·야외 경관형 장소의 일반 동행 적합도",
      monthBasis: "장소명에 명시된 벚꽃 계절성을 적용한 초안",
    });
  }

  if (/온천|스파|해수랜드/.test(title)) {
    return makePrior({
      name: "hot_spring_wellness",
      companion: { solo: 0.75, couple: 0.75, friends: 0.5, kids: 0.5, parents: 0.75 },
      monthTemplate: "hot_spring",
      environment: "mixed",
      physicalEffort: 0.25,
      indoorRatio: 0.75,
      rain: 0.25,
      wind: 0.25,
      heat: 0.25,
      cold: 0,
      companionBasis: "온천·스파형 휴식 장소의 일반 동행 적합도",
      monthBasis: "추운 달의 상대적 체험 매력을 반영한 사전값",
    });
  }

  if (/키즈|공룡|아쿠아나/.test(title)) {
    return makePrior({
      name: "kids_venue",
      companion: { solo: 0.25, couple: 0.5, friends: 0.5, kids: 1, parents: 0.5 },
      monthTemplate: "neutral",
      environment: "mixed",
      physicalEffort: 0.25,
      indoorRatio: 0.75,
      rain: 0.25,
      wind: 0.25,
      heat: 0.25,
      cold: 0.25,
      companionBasis: "장소명에 어린이 중심 시설 특성이 명시됨",
      monthBasis: "운영기간을 제외하면 계절 중립으로 두는 초안",
    });
  }

  if (/책방|서점/.test(title)) {
    return makePrior({
      name: "book_space",
      companion: { solo: 1, couple: 0.5, friends: 0.25, kids: null, parents: null },
      monthTemplate: "neutral",
      environment: "indoor",
      physicalEffort: 0.25,
      indoorRatio: 1,
      rain: 0.25,
      wind: 0.25,
      heat: 0.25,
      cold: 0.25,
      companionBasis: "장소명에서 확인되는 소규모 책 공간의 일반 이용 특성",
      monthBasis: "실내 책 공간의 계절 중립 사전값",
    });
  }

  if (/박물관|미술관|역사관|홍보관|예술의전당|뮤지엄/.test(title) || type === "14") {
    const isOutdoorMuseum = /민속촌/.test(title);
    return makePrior({
      name: isOutdoorMuseum ? "outdoor_museum" : "museum",
      companion: { solo: 0.75, couple: 0.75, friends: 0.5, kids: 0.5, parents: 0.75 },
      monthTemplate: isOutdoorMuseum ? "outdoor" : "neutral",
      environment: isOutdoorMuseum ? "mixed" : "indoor",
      physicalEffort: isOutdoorMuseum ? 0.5 : 0.25,
      indoorRatio: isOutdoorMuseum ? 0.25 : 0.75,
      rain: isOutdoorMuseum ? 0.5 : 0.25,
      wind: isOutdoorMuseum ? 0.5 : 0.25,
      heat: isOutdoorMuseum ? 0.5 : 0.25,
      cold: isOutdoorMuseum ? 0.5 : 0.25,
      companionBasis: "문화시설의 관람·학습 중심 일반 동행 적합도",
      monthBasis: isOutdoorMuseum ? "야외 관람 비중을 고려한 계절 사전값" : "실내 문화시설의 계절 중립 사전값",
    });
  }

  if (/동굴|만장굴|미천굴/.test(title)) {
    return makePrior({
      name: "cave",
      companion: { solo: 0.75, couple: 0.75, friends: 0.75, kids: null, parents: null },
      monthTemplate: "neutral",
      environment: "indoor",
      physicalEffort: 0.5,
      indoorRatio: 1,
      rain: 0.25,
      wind: 0,
      heat: 0,
      cold: 0.25,
      companionBasis: "장소명에서 확인되는 동굴 관람과 보행 부담의 일반 특성",
      monthBasis: "운영·통제 기간 근거가 없어 동굴 내부 기후를 계절 중립으로 둔 사전값",
    });
  }

  if (/오름|어승생|숲길|\[제주올레|올레\s*\d+코스|하영올레|지질트레일|곶자왈/.test(title)) {
    return makePrior({
      name: "walking_hiking",
      companion: { solo: 0.75, couple: 0.75, friends: 0.75, kids: 0.25, parents: 0.25 },
      monthTemplate: /숲길|곶자왈/.test(title) ? "forest" : "outdoor",
      environment: "outdoor",
      physicalEffort: 0.75,
      indoorRatio: 0,
      rain: 0.75,
      wind: 0.75,
      heat: 0.5,
      cold: 0.75,
      companionBasis: "야외 걷기·등산형 장소의 체력 부담을 반영한 사전값",
      monthBasis: "제주 야외 걷기의 평년 계절 노출을 반영한 사전값",
    });
  }

  if (/해수욕장|해변/.test(title)) {
    return makePrior({
      name: "beach",
      companion: { solo: 0.75, couple: 1, friends: 1, kids: 0.75, parents: 0.5 },
      monthTemplate: "beach",
      environment: "outdoor",
      physicalEffort: 0.25,
      indoorRatio: 0,
      rain: 1,
      wind: 1,
      heat: 0.75,
      cold: 1,
      companionBasis: "해변 경관과 물놀이의 일반 동행 적합도",
      monthBasis: "여름 물놀이와 해안 기상 노출을 반영한 사전값",
    });
  }

  if (/해안|포구|제주항|등대|돌염전|추자도|마라도가는여객선/.test(title) || l2 === "NA02") {
    return makePrior({
      name: "coastal_scenic",
      companion: { solo: 0.75, couple: 1, friends: 0.75, kids: 0.5, parents: 0.5 },
      monthTemplate: "coast",
      environment: "outdoor",
      physicalEffort: 0.25,
      indoorRatio: 0,
      rain: 0.75,
      wind: 1,
      heat: 0.5,
      cold: 0.75,
      companionBasis: "해안 경관·포구형 장소의 일반 동행 적합도",
      monthBasis: "해안의 바람·비 노출과 봄·가을 경관을 반영한 사전값",
    });
  }

  if (/골프/.test(title)) {
    return makePrior({
      name: "golf",
      companion: { solo: 0.25, couple: 0.5, friends: 1, kids: null, parents: null },
      monthTemplate: "outdoor",
      environment: "outdoor",
      physicalEffort: 0.5,
      indoorRatio: 0,
      rain: 1,
      wind: 0.75,
      heat: 0.75,
      cold: 0.75,
      companionBasis: "동반 플레이 중심 야외 골프 활동의 일반 특성",
      monthBasis: "야외 스포츠의 봄·가을 적합도 사전값",
    });
  }

  if (/캠핑|카라반|글램핑/.test(title) || l1 === "AC") {
    return makePrior({
      name: "camping",
      companion: { solo: 0.5, couple: 0.75, friends: 1, kids: 0.75, parents: 0.25 },
      monthTemplate: "outdoor",
      environment: "outdoor",
      physicalEffort: 0.5,
      indoorRatio: 0.25,
      rain: 1,
      wind: 0.75,
      heat: 0.75,
      cold: 0.75,
      companionBasis: "숙영·공동 활동 중심 캠핑의 일반 동행 적합도",
      monthBasis: "야외 숙영의 봄·가을 적합도 사전값",
    });
  }

  if (/레일바이크/.test(title)) {
    return makePrior({
      name: "railbike",
      companion: { solo: 0.5, couple: 0.75, friends: 0.75, kids: null, parents: null },
      monthTemplate: "outdoor",
      environment: "outdoor",
      physicalEffort: 0.5,
      indoorRatio: 0,
      rain: 1,
      wind: 0.75,
      heat: 0.75,
      cold: 0.75,
      companionBasis: "장소명에서 확인되는 공동 탑승형 야외 레포츠 특성",
      monthBasis: "야외 탑승 활동의 기상 노출을 반영한 사전값",
    });
  }

  if (/제트|어드벤쳐|빅볼|승마/.test(title) || l1 === "LS") {
    return makePrior({
      name: "active_leisure",
      companion: { solo: 0.5, couple: 0.75, friends: 1, kids: null, parents: null },
      monthTemplate: /제트/.test(title) ? "beach" : "outdoor",
      environment: "outdoor",
      physicalEffort: 0.5,
      indoorRatio: 0,
      rain: 1,
      wind: /제트/.test(title) ? 1 : 0.75,
      heat: 0.75,
      cold: 0.75,
      companionBasis: "참여형 야외 레포츠의 활동성과 체력 부담을 반영한 사전값",
      monthBasis: "야외 레포츠의 기상 노출을 반영한 사전값",
    });
  }

  if (l1 === "HS") {
    return makePrior({
      name: "historic_site",
      companion: { solo: 0.75, couple: 0.5, friends: 0.5, kids: 0.25, parents: 0.75 },
      monthTemplate: "outdoor",
      environment: "mixed",
      physicalEffort: 0.25,
      indoorRatio: 0.25,
      rain: 0.5,
      wind: 0.5,
      heat: 0.5,
      cold: 0.5,
      companionBasis: "역사·종교 유적의 조용한 관람 특성을 반영한 사전값",
      monthBasis: "야외 관람 비중을 고려한 평년 계절 사전값",
    });
  }

  if (l1 === "EX") {
    return makePrior({
      name: "hands_on_experience",
      companion: { solo: 0.5, couple: 0.75, friends: 0.75, kids: 0.75, parents: 0.5 },
      monthTemplate: "neutral",
      environment: "mixed",
      physicalEffort: 0.25,
      indoorRatio: 0.5,
      rain: 0.5,
      wind: 0.5,
      heat: 0.5,
      cold: 0.5,
      companionBasis: "참여형 체험 장소의 공동 활동 특성을 반영한 사전값",
      monthBasis: "세부 운영·계절 근거가 없어 중립으로 둔 사전값",
    });
  }

  if (l1 === "NA" || l2 === "NA04") {
    return makePrior({
      name: "nature_outdoor",
      companion: { solo: 0.75, couple: 1, friends: 0.75, kids: 0.5, parents: 0.5 },
      monthTemplate: "forest",
      environment: "outdoor",
      physicalEffort: 0.5,
      indoorRatio: 0,
      rain: 0.75,
      wind: 0.5,
      heat: 0.5,
      cold: 0.5,
      companionBasis: "자연 경관형 장소의 일반 동행 적합도",
      monthBasis: "자연 경관의 봄·가을 적합도를 반영한 사전값",
    });
  }

  return makePrior({
    name: "generic_visit",
    companion: { solo: 0.5, couple: 0.75, friends: 0.5, kids: 0.5, parents: 0.5 },
    monthTemplate: "neutral",
    environment: "unknown",
    physicalEffort: null,
    indoorRatio: null,
    rain: null,
    wind: null,
    heat: null,
    cold: null,
    companionBasis: "TourAPI 기본 유형만 사용한 보수적 사전값",
    monthBasis: "계절 근거가 없어 중립으로 둔 사전값",
  });
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function relativePath(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll("\\", "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function normalizeLabelValue(value, fieldPath) {
  if (value === undefined || value === "" || value === "unknown") return null;
  const normalized = value === null ? null : Number(value);
  if (!LABEL_VALUES.has(normalized)) {
    throw new Error(`${fieldPath} has unsupported label value: ${value}`);
  }
  return normalized;
}

function normalizeLabelGroup(group, keys, fieldPath) {
  const source = group && typeof group === "object" ? group : {};
  return Object.fromEntries(
    keys.map((key) => [key, normalizeLabelValue(source[key], `${fieldPath}.${key}`)]),
  );
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))];
}

function normalizePeakMonths(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
    .sort((a, b) => a - b);
}

function normalizeEnvironment(value) {
  const normalized = clean(value).toLowerCase();
  return ["indoor", "outdoor", "mixed"].includes(normalized) ? normalized : "unknown";
}

function normalizeSourceRefs(item, additionalCandidates = []) {
  const evidence = item.label_evidence ?? item.evidence ?? {};
  const rawCandidates =
    evidence.source_refs ?? item.source_refs ?? item.web_evidence?.source_refs ?? [];
  const candidates = [
    ...(Array.isArray(rawCandidates) ? rawCandidates : []),
    ...(Array.isArray(additionalCandidates) ? additionalCandidates : []),
  ];

  const seen = new Set();
  const refs = [];
  const contentid = clean(item.contentid ?? item.id);
  const disallowedUrls = DISALLOWED_SOURCE_URLS_BY_CONTENTID[contentid] ?? new Set();
  for (const candidate of candidates) {
    const source = typeof candidate === "string" ? { url: candidate } : candidate ?? {};
    const url = clean(source.url ?? source.href);
    let isGenericPortal = false;
    try {
      const parsed = new URL(url);
      isGenericPortal =
        /(^|\.)visitjeju\.net$/i.test(parsed.hostname) &&
        /^\/(?:en|kr)?\/?$/i.test(parsed.pathname);
    } catch {
      isGenericPortal = false;
    }
    if (
      !/^https?:\/\//i.test(url) ||
      /\/search\/|search_list\.do/i.test(url) ||
      isGenericPortal ||
      disallowedUrls.has(url) ||
      seen.has(url)
    ) {
      continue;
    }
    seen.add(url);
    refs.push({
      title: clean(source.title ?? source.name ?? source.claim) || "출처 페이지",
      url,
      source_type: clean(source.source_type ?? source.type) || "web",
      checked_at: clean(source.checked_at ?? source.checkedAt) || "2026-08-09",
    });
  }
  return refs;
}

function normalizeConfidence(item, key) {
  const raw = item.label_meta?.confidence ?? item.confidence ?? {};
  let value;
  if (typeof raw === "number") {
    value = raw;
  } else {
    value = raw[key] ?? raw[key.replace("_fit", "")] ?? null;
  }
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0.4;
  return Math.min(1, Math.max(0, Math.round(normalized * 100) / 100));
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) ?? {};
}

function mergeResearchParts() {
  if (!fs.existsSync(researchDirectory)) {
    throw new Error(`Research directory does not exist: ${relativePath(researchDirectory)}`);
  }
  const files = fs
    .readdirSync(researchDirectory)
    .filter((name) => /^part_\d+\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!files.length) {
    throw new Error(`No part_*.json files found under ${relativePath(researchDirectory)}`);
  }

  const items = [];
  for (const file of files) {
    const content = readJson(path.join(researchDirectory, file));
    if (!Array.isArray(content)) {
      throw new Error(`${file} must contain a JSON array`);
    }
    items.push(...content);
  }
  return { files, items };
}

function labelValueKey(value) {
  return value === null ? "null" : String(value);
}

function emptyDistribution() {
  return { "0": 0, "0.25": 0, "0.5": 0, "0.75": 0, "1": 0, null: 0 };
}

function incrementDistribution(distribution, value) {
  distribution[labelValueKey(value)] += 1;
}

function createStats(profiles) {
  const byContentType = {};
  const byRegion = {};
  const byReviewStatus = {};
  const companionDistribution = Object.fromEntries(
    COMPANION_KEYS.map((key) => [key, emptyDistribution()]),
  );
  const monthDistribution = Object.fromEntries(MONTH_KEYS.map((key) => [key, emptyDistribution()]));
  let profilesWithWebSources = 0;
  let totalSourceRefs = 0;
  let companionConfidenceSum = 0;
  let monthConfidenceSum = 0;

  for (const profile of profiles) {
    const type = profile.source_place.contenttypeid;
    const region = profile.source_place.region_code;
    const status = profile.label_meta.review_status;
    byContentType[type] = (byContentType[type] ?? 0) + 1;
    byRegion[region] = (byRegion[region] ?? 0) + 1;
    byReviewStatus[status] = (byReviewStatus[status] ?? 0) + 1;
    if (profile.label_evidence.source_refs.length) profilesWithWebSources += 1;
    totalSourceRefs += profile.label_evidence.source_refs.length;
    companionConfidenceSum += profile.label_meta.confidence.companion_fit;
    monthConfidenceSum += profile.label_meta.confidence.month_fit;
    for (const key of COMPANION_KEYS) {
      incrementDistribution(companionDistribution[key], profile.companion_fit[key]);
    }
    for (const key of MONTH_KEYS) {
      incrementDistribution(monthDistribution[key], profile.month_fit[key]);
    }
  }

  return {
    total: profiles.length,
    by_content_type: byContentType,
    by_region: byRegion,
    by_review_status: byReviewStatus,
    profiles_with_web_sources: profilesWithWebSources,
    total_source_refs: totalSourceRefs,
    average_confidence: {
      companion_fit: Math.round((companionConfidenceSum / profiles.length) * 1000) / 1000,
      month_fit: Math.round((monthConfidenceSum / profiles.length) * 1000) / 1000,
    },
    companion_distribution: companionDistribution,
    month_distribution: monthDistribution,
  };
}

function compactCompanion(profile) {
  const format = (value) => (value === null ? "?" : String(value));
  return COMPANION_KEYS.map((key) => format(profile.companion_fit[key])).join("/");
}

function favorableMonths(profile) {
  const months = MONTH_KEYS.filter((month) => {
    const value = profile.month_fit[month];
    return value === 0.75 || value === 1;
  });
  return months.length ? months.join(",") : "-";
}

function countDistributionValue(distributionByAxis, value) {
  const key = labelValueKey(value);
  return Object.values(distributionByAxis).reduce(
    (sum, distribution) => sum + distribution[key],
    0,
  );
}

function formatRatio(count, total) {
  return `${count}/${total} (${((count / total) * 100).toFixed(1)}%)`;
}

function distributionTableRows(distributionByAxis, axes) {
  return axes.map((axis) => {
    const distribution = distributionByAxis[axis];
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    return `| ${axis} | ${distribution["0"]} | ${distribution["0.25"]} | ${distribution["0.5"]} | ${distribution["0.75"]} | ${distribution["1"]} | ${distribution.null} | ${formatRatio(distribution.null, total)} |`;
  });
}

function extremeLabels(profile, value) {
  const companion = COMPANION_KEYS
    .filter((key) => profile.companion_fit[key] === value)
    .map((key) => `C.${key}`);
  const months = MONTH_KEYS
    .filter((month) => profile.month_fit[month] === value)
    .map((month) => `M.${month}`);
  return [...companion, ...months].join(", ") || "-";
}

function createReport(profiles, stats, sourcePath, researchFiles) {
  const typeNames = { "12": "관광지", "14": "문화시설", "15": "축제", "28": "레포츠" };
  const companionValueCount = profiles.length * COMPANION_KEYS.length;
  const monthValueCount = profiles.length * MONTH_KEYS.length;
  const companionNulls = countDistributionValue(stats.companion_distribution, null);
  const monthNulls = countDistributionValue(stats.month_distribution, null);
  const extremeProfiles = profiles.filter(
    (profile) =>
      [...Object.values(profile.companion_fit), ...Object.values(profile.month_fit)]
        .some((value) => value === 0 || value === 1),
  );
  const lowConfidenceProfiles = profiles.filter(
    (profile) =>
      profile.label_meta.confidence.companion_fit < 0.65 ||
      profile.label_meta.confidence.month_fit < 0.65,
  );
  const lines = [
    "# Companion·월별 적합도 100건 파일럿 결과",
    "",
    "- 상태: AI 보조 초안, 사람 검수 전",
    "- 라벨 버전: `place-profile-pilot-v1`",
    `- 원본: \`${relativePath(sourcePath)}\``,
    `- 웹 조사 조각: ${researchFiles.map((file) => `\`${file}\``).join(", ")}`,
    `- 취약 사례 보강 출처: \`${relativePath(targetedSourcesPath)}\``,
    "- 월별 값 의미: 장소 내 연중 중립 `0.5`를 기준으로 한 상대적 계절 조정",
    "",
    "## 표본과 근거 요약",
    "",
    `- 전체: ${stats.total}건`,
    `- 관광지/문화시설/축제/레포츠: ${stats.by_content_type["12"] ?? 0}/${stats.by_content_type["14"] ?? 0}/${stats.by_content_type["15"] ?? 0}/${stats.by_content_type["28"] ?? 0}`,
    `- 제주시/서귀포시: ${stats.by_region["110"] ?? 0}/${stats.by_region["130"] ?? 0}`,
    `- 최종 증거에 장소별 상세·공식 출처가 연결된 장소: ${stats.profiles_with_web_sources}건`,
    `- 상세 출처 없이 분류 사전값만 사용한 장소: ${stats.total - stats.profiles_with_web_sources}건`,
    `- 출처 URL: ${stats.total_source_refs}개`,
    `- 평균 신뢰도(companion/month): ${stats.average_confidence.companion_fit}/${stats.average_confidence.month_fit}`,
    `- companion null: ${formatRatio(companionNulls, companionValueCount)}`,
    `- month null: ${formatRatio(monthNulls, monthValueCount)}`,
    `- 신뢰도 0.65 미만 또는 null로 사람 검수가 필요한 장소: ${lowConfidenceProfiles.length}건`,
    "",
    "## 읽는 법",
    "",
    "- Companion 열은 `solo/couple/friends/kids/parents` 순서다.",
    "- `?`는 근거 부족으로 `null`을 사용한 값이다.",
    "- 좋은 달은 `month_fit`이 `0.75` 또는 `1`인 달만 표시한다.",
    "- 축제 개최기간은 별도 가용성 제약이며 월별 점수로 대체하지 않는다.",
    "",
    "## Companion 값 분포",
    "",
    "| 축 | 0 | 0.25 | 0.5 | 0.75 | 1 | null | null률 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...distributionTableRows(stats.companion_distribution, COMPANION_KEYS),
    "",
    "## 월별 값 분포",
    "",
    "| 월 | 0 | 0.25 | 0.5 | 0.75 | 1 | null | null률 |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...distributionTableRows(stats.month_distribution, MONTH_KEYS),
    "",
    "## 극단값 검토 목록",
    "",
    `0 또는 1이 하나라도 있는 ${extremeProfiles.length}건이다. \`C\`는 companion, \`M\`은 월을 뜻한다.`,
    "",
    "| contentid | 장소 | 0인 축 | 1인 축 |",
    "|---|---|---|---|",
    ...extremeProfiles.map((profile) =>
      `| ${profile.contentid} | ${profile.title.replaceAll("|", "\\|")} | ${extremeLabels(profile, 0)} | ${extremeLabels(profile, 1)} |`,
    ),
    "",
    "모든 장소가 적어도 한 축에서 신뢰도 0.65 미만이거나 null을 포함하므로, 아래 100건 전체가 사람 검수 대상이다.",
    "",
    "## 장소별 초안",
    "",
    "| # | contentid | 장소 | 유형 | Companion | 좋은 달 | 신뢰도 C/M | 출처 | 상태 |",
    "|---:|---|---|---|---|---|---|---:|---|",
  ];

  profiles.forEach((profile, index) => {
    const safeTitle = profile.title.replaceAll("|", "\\|");
    lines.push(
      `| ${index + 1} | ${profile.contentid} | ${safeTitle} | ${typeNames[profile.source_place.contenttypeid] ?? profile.source_place.contenttypeid} | ${compactCompanion(profile)} | ${favorableMonths(profile)} | ${profile.label_meta.confidence.companion_fit}/${profile.label_meta.confidence.month_fit} | ${profile.label_evidence.source_refs.length} | ${profile.label_meta.review_status} |`,
    );
  });

  lines.push(
    "",
    "## 알려진 제한",
    "",
    "- 이 결과는 저비용 웹 조사 에이전트와 분류 사전을 이용한 초안이며 사람 간 일치도를 측정한 골드셋이 아니다.",
    "- 공식 상세정보를 찾지 못한 장소는 TourAPI 제목·신분류 기반 사전값을 사용해 신뢰도를 낮췄다.",
    "- 연령·접근성·편의시설 근거가 부족한 사전값 항목은 `kids`와 `parents`를 주로 `null`로 보류했다.",
    "- 원시 조사 파일의 검색 결과·일반 포털 링크는 탐색 단서일 뿐이며, 최종 `source_refs`에는 장소가 대응되는 상세 페이지만 남겼다.",
    "- 운영기간, 휴장, 당일 비·강풍·폭염은 `month_fit`이 아니라 별도 필터와 동적 검증에서 처리해야 한다.",
    "- 숙박·쇼핑·음식점은 이번 표본에 포함하지 않았다.",
    "",
  );
  return lines.join("\n");
}

const selection = readJson(selectionPath);
if (!Array.isArray(selection.contentids) || selection.contentids.length !== 100) {
  throw new Error("selection_ids.json must contain exactly 100 contentids");
}

const sourcePath = path.resolve(workspaceRoot, selection.source_snapshot);
if (!sourcePath.startsWith(`${workspaceRoot}${path.sep}`)) {
  throw new Error(`Source path escapes workspace: ${selection.source_snapshot}`);
}
const sourcePlaces = readJson(sourcePath);
if (!Array.isArray(sourcePlaces)) {
  throw new Error("Source places must be a JSON array");
}
const sourceById = new Map(sourcePlaces.map((place) => [clean(place.contentid), place]));
const { files: researchFiles, items: researchItems } = mergeResearchParts();
const targetedSources = readJson(targetedSourcesPath);
if (!Array.isArray(targetedSources)) {
  throw new Error("targeted_sources.json must contain a JSON array");
}
const targetedSourcesById = new Map();
for (const item of targetedSources) {
  const contentid = clean(item.contentid);
  if (!contentid) throw new Error("Targeted source item has an empty contentid");
  if (targetedSourcesById.has(contentid)) throw new Error(`Duplicate targeted source item: ${contentid}`);
  targetedSourcesById.set(contentid, item);
}
const researchById = new Map();
for (const item of researchItems) {
  const contentid = clean(item.contentid ?? item.id);
  if (!contentid) throw new Error("Research item has an empty contentid");
  if (researchById.has(contentid)) throw new Error(`Duplicate research item: ${contentid}`);
  researchById.set(contentid, item);
}

const profiles = selection.contentids.map((contentid, index) => {
  const source = sourceById.get(contentid);
  const research = researchById.get(contentid);
  if (!source) throw new Error(`Selected contentid is missing from source: ${contentid}`);
  if (!research) throw new Error(`Selected contentid is missing from research parts: ${contentid}`);

  const targetedSource = targetedSourcesById.get(contentid) ?? {};
  const sourceRefs = normalizeSourceRefs(research, targetedSource.source_refs);
  const prior = categoryPrior(source);
  const researchCompanionConfidence = normalizeConfidence(research, "companion_fit");
  const researchMonthConfidence = normalizeConfidence(research, "month_fit");
  const usesCompanionPrior = sourceRefs.length === 0 || researchCompanionConfidence < 0.65;
  const usesMonthPrior = sourceRefs.length === 0 || researchMonthConfidence < 0.65;
  const usesOnlyCategoryEvidence = sourceRefs.length === 0;
  const rawEvidence = usesOnlyCategoryEvidence
    ? prior.evidence
    : firstObject(research.label_evidence, research.evidence);
  const rawCompanionFit = normalizeLabelGroup(
    usesCompanionPrior
      ? prior.companion
      : firstObject(research.companion_fit, research.proposed_companion_fit),
    COMPANION_KEYS,
    `items[${index}].companion_fit`,
  );
  const companionFit = { ...rawCompanionFit };
  if (usesCompanionPrior) {
    if (prior.name === "kids_venue") {
      companionFit.parents = null;
    } else if (prior.name === "railbike" && targetedSource.family_suitability_supported === true) {
      companionFit.kids = 0.75;
      companionFit.parents = null;
    } else if (prior.name !== "walking_hiking") {
      companionFit.kids = null;
      companionFit.parents = null;
    }
  }
  const monthFit = normalizeLabelGroup(
    usesMonthPrior
      ? prior.months
      : firstObject(research.month_fit, research.proposed_month_fit),
    MONTH_KEYS,
    `items[${index}].month_fit`,
  );
  const evidenceForAttributes =
    usesCompanionPrior || usesMonthPrior ? prior.evidence : rawEvidence;
  const rawLimitations = normalizeStringList(
    rawEvidence.limitations ?? research.limitations ?? research.web_evidence?.limitations ?? [],
  );
  const reconciledRawLimitations = Array.isArray(targetedSource.source_refs) && targetedSource.source_refs.length
    ? rawLimitations.filter(
        (limitation) =>
          !/공식 상세 출처 미확인|No specific official detail page located/i.test(limitation),
      )
    : rawLimitations;
  const limitations = normalizeStringList([
    ...reconciledRawLimitations,
    ...(targetedSource.limitations ?? []),
    ...((usesCompanionPrior || usesMonthPrior) ? prior.evidence.limitations : []),
  ]);
  if (!usesOnlyCategoryEvidence && (usesCompanionPrior || usesMonthPrior)) {
    limitations.push("웹 근거 초안의 신뢰도가 0.65 미만인 특징군은 공통 분류 사전값으로 정규화함");
  }
  if (
    usesCompanionPrior &&
    (companionFit.kids === null || companionFit.parents === null)
  ) {
    limitations.push("연령·접근성·편의시설의 필드별 근거가 부족한 동반자 축은 null로 보류함");
  }

  const companionBasis = normalizeStringList([
    ...(usesCompanionPrior ? prior.evidence.companion_basis : []),
    ...(rawEvidence.companion_basis ?? research.companion_basis ?? research.web_evidence?.facts ?? []),
    ...(targetedSource.companion_facts ?? []),
  ]);
  const monthBasis = normalizeStringList([
    ...(usesMonthPrior ? prior.evidence.month_basis : []),
    ...(rawEvidence.month_basis ?? research.month_basis ?? research.web_evidence?.seasonal_facts ?? []),
    ...(targetedSource.month_facts ?? []),
  ]);
  const evidenceValues = Object.fromEntries(
    EVIDENCE_VALUE_KEYS.map((key) => [
      key,
      normalizeLabelValue(evidenceForAttributes[key], `items[${index}].label_evidence.${key}`),
    ]),
  );

  const explicitPrior = [
    "cherry_blossom",
    "hot_spring_wellness",
    "kids_venue",
    "museum",
    "outdoor_museum",
    "book_space",
    "cave",
    "walking_hiking",
    "beach",
    "coastal_scenic",
    "golf",
    "camping",
    "railbike",
    "active_leisure",
  ].includes(prior.name);
  let companionConfidence = usesCompanionPrior
    ? clean(source.contenttypeid) === "15"
      ? 0.35
      : explicitPrior
        ? 0.55
        : 0.45
    : researchCompanionConfidence;
  let monthConfidence = usesMonthPrior
    ? clean(source.contenttypeid) === "15"
      ? 0.2
      : explicitPrior
        ? 0.55
        : 0.4
    : researchMonthConfidence;
  const hasNull = [...Object.values(companionFit), ...Object.values(monthFit)].includes(null);
  const needsReview =
    hasNull ||
    !sourceRefs.length ||
    companionConfidence < 0.65 ||
    monthConfidence < 0.65 ||
    clean(source.contenttypeid) === "15";

  return {
    contentid,
    title: clean(source.title),
    source_place: {
      contenttypeid: clean(source.contenttypeid),
      lclsSystm1: clean(source.lclsSystm1),
      lclsSystm2: clean(source.lclsSystm2),
      lclsSystm3: clean(source.lclsSystm3),
      region_code: clean(source.lDongSignguCd),
    },
    companion_fit: companionFit,
    month_fit: monthFit,
    label_evidence: {
      environment: normalizeEnvironment(evidenceForAttributes.environment),
      ...evidenceValues,
      seasonal_peak_months: MONTH_KEYS.filter((month) => monthFit[month] === 1).map(Number),
      companion_basis: companionBasis,
      month_basis: monthBasis,
      source_refs: sourceRefs,
      limitations: [...new Set(limitations)],
      availability_separate: clean(source.contenttypeid) === "15",
    },
    label_meta: {
      version: "place-profile-pilot-v1",
      method:
        usesCompanionPrior || usesMonthPrior
          ? sourceRefs.length
            ? `web_evidence_plus_rule_based_category_prior:${prior.name}`
            : `rule_based_category_prior:${prior.name}`
          : "gpt-5.6-luna_web_research_plus_category_prior",
      confidence: {
        companion_fit: companionConfidence,
        month_fit: monthConfidence,
      },
      review_status: needsReview ? "needs_human_review" : "ai_draft",
    },
  };
});

if (researchById.size !== profiles.length) {
  const selectedIds = new Set(selection.contentids);
  const extras = [...researchById.keys()].filter((contentid) => !selectedIds.has(contentid));
  if (extras.length) throw new Error(`Research parts contain unselected IDs: ${extras.join(", ")}`);
}

const stats = createStats(profiles);
const profilesJson = serialize(profiles);
const report = createReport(profiles, stats, sourcePath, researchFiles);
const manifest = {
  schema_version: "place-profile-pilot-manifest-v1",
  status: "ai_draft",
  label_version: "place-profile-pilot-v1",
  source: {
    path: relativePath(sourcePath),
    snapshot_date: "2026-08-09",
    sha256: sha256File(sourcePath),
  },
  selection: {
    path: relativePath(selectionPath),
    version: clean(selection.selection_version),
    count: selection.contentids.length,
    sha256: sha256File(selectionPath),
  },
  research_parts: researchFiles.map((file) => ({
    path: relativePath(path.join(researchDirectory, file)),
    sha256: sha256File(path.join(researchDirectory, file)),
  })),
  targeted_sources: {
    path: relativePath(targetedSourcesPath),
    count: targetedSources.length,
    sha256: sha256File(targetedSourcesPath),
  },
  stats,
  files: {
    "place_profiles.json": {
      count: profiles.length,
      sha256: sha256(profilesJson),
    },
    "review_report.md": {
      sha256: sha256(report),
    },
  },
};

fs.writeFileSync(profilesPath, profilesJson, "utf8");
fs.writeFileSync(reportPath, report, "utf8");
fs.writeFileSync(manifestPath, serialize(manifest), "utf8");

console.log(
  JSON.stringify(
    {
      profiles: profiles.length,
      output: relativePath(profilesPath),
      report: relativePath(reportPath),
      profiles_with_web_sources: stats.profiles_with_web_sources,
      needs_human_review: stats.by_review_status.needs_human_review ?? 0,
    },
    null,
    2,
  ),
);
