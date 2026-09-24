#!/usr/bin/env node
// Build a separate server-only public place catalog; never modifies recommendation data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function options(argv) {
  const settings = { source: path.join(ROOT, 'map-ui/data/jeju-places.js'),
    operating: path.join(ROOT, 'data/itinerary/operating'),
    insights: path.join(ROOT, 'server/travel-feedback/data/visit_insights.json'),
    'review-database': path.join(ROOT, 'server/travel-feedback/data/kakao_reviews.sqlite3'),
    output: path.join(ROOT, 'server/travel-feedback/data/itinerary_catalog.json') };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in settings) || !argv[i + 1]) throw new Error('Expected --source|operating|insights|output PATH');
    settings[key] = path.resolve(argv[i + 1]);
  }
  return settings;
}

function assignment(source, name) {
  const marker = `window.${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = source.indexOf(';\n', start);
  return JSON.parse(source.slice(start + marker.length, end < 0 ? source.length : end).trim().replace(/;$/, ''));
}

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;
function checkIntervals(intervals) {
  if (!Array.isArray(intervals)) throw new Error('Operating intervals must be an array');
  for (const interval of intervals) {
    if (!interval || !TIME.test(interval.open) || interval.open === '24:00' || !TIME.test(interval.close) ||
      interval.open === interval.close || (interval.lastAdmission != null && !TIME.test(interval.lastAdmission))) {
      throw new Error('Invalid operating interval');
    }
  }
}
function checkWeekly(weekly) {
  if (!weekly || typeof weekly !== 'object' || Array.isArray(weekly)) throw new Error('Invalid operating weekly data');
  for (const [key, intervals] of Object.entries(weekly)) {
    if (!/^[1-7]$/.test(key)) throw new Error('Weekdays must use ISO 1..7');
    checkIntervals(intervals);
  }
}
function operatingData(row) {
  const info = row?.operatingInfo;
  if (!info) return { status: 'unknown', checkedAt: null, sourceRefs: [], weekly: {}, exceptions: {}, seasonal: [], unknownReasons: ['not_collected'] };
  if (!['known', 'unknown', 'conflict'].includes(info.status)) throw new Error('Invalid operating status');
  if (info.status === 'known' && (!info.sourceRefs?.length || !info.checkedAt || !Number.isFinite(Date.parse(info.checkedAt)))) {
    throw new Error('Known operating info needs source and timestamp');
  }
  checkWeekly(info.weekly || {});
  for (const [date, exception] of Object.entries(info.exceptions || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('Invalid exception date');
    if (typeof exception.closed !== 'boolean') throw new Error('Exception needs explicit closed flag');
    checkIntervals(exception.intervals || []);
  }
  for (const season of info.seasonal || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(season.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(season.endDate) || season.endDate < season.startDate) {
      throw new Error('Invalid seasonal dates');
    }
    checkWeekly(season.weekly);
  }
  return info;
}

function build(settings) {
  const source = fs.readFileSync(settings.source, 'utf8');
  const meta = assignment(source, 'JEJU_DATA_META');
  const places = assignment(source, 'JEJU_PLACES');
  const insightFile = fs.existsSync(settings.insights) ? readJSON(settings.insights) : { version: 'not_analyzed', places: {} };
  if (fs.existsSync(settings.insights)) {
    const validation = spawnSync('python3', [path.join(ROOT, 'scripts/build_visit_insights.py'), '--validate-only',
      '--output', settings.insights, '--database', settings['review-database']], { encoding: 'utf8', timeout: 30_000 });
    if (validation.status !== 0) throw new Error('Visit insights failed provenance or authorized review evidence validation');
  }
  const ids = new Set();
  const coverage = { total: 0, recommendationReady: 0, operatingKnown: 0, operatingUnknown: 0, operatingConflict: 0, reviewInferred: 0 };
  const catalogPlaces = places.map((place) => {
    if (!/^\d+$/.test(place.id) || ids.has(place.id)) throw new Error('Duplicate or invalid public place ID');
    ids.add(place.id);
    if (![place.lng, place.lat].every(Number.isFinite) || place.lng < 125 || place.lng > 127.5 || place.lat < 32.5 || place.lat > 34.5) throw new Error('Invalid Jeju coordinates');
    const operatingPath = path.join(settings.operating, `${place.id}.json`);
    const sidecar = fs.existsSync(operatingPath) ? readJSON(operatingPath) : null;
    if (sidecar && sidecar.placeId !== place.id) throw new Error('Operating sidecar place mismatch');
    const operatingInfo = operatingData(sidecar);
    const officialDwellMinutes = sidecar?.officialDwellMinutes || null;
    if (officialDwellMinutes && (!Number.isInteger(officialDwellMinutes.minutes) || officialDwellMinutes.minutes < 10 || officialDwellMinutes.minutes > 720 ||
      !officialDwellMinutes.sourceRefs?.length || !Number.isFinite(Date.parse(officialDwellMinutes.checkedAt)))) throw new Error('Unverified official dwell duration');
    const visitInsights = insightFile.places[place.id] || { status: 'unknown', preferredPeriods: [], dwellMinutes: null, evidenceReviewIds: [], unknownReason: 'no_reviews', kind: 'review_inference' };
    const recommendationReady = Boolean(place.v5 && place.fit);
    coverage.total += 1;
    coverage.recommendationReady += Number(recommendationReady);
    coverage[{ known: 'operatingKnown', unknown: 'operatingUnknown', conflict: 'operatingConflict' }[operatingInfo.status]] += 1;
    coverage.reviewInferred += Number(visitInsights.status === 'inferred');
    return { placeId: place.id, title: place.title, lng: place.lng, lat: place.lat, primaryType: place.primaryType || 'unknown',
      contentTypeId: String(place.type), recommendationReady, operatingInfo, officialDwellMinutes, visitInsights };
  });
  if (coverage.recommendationReady !== meta.recommendationReadyCount) throw new Error('Recommendation eligibility coverage drift');
  const contentHash = hash(JSON.stringify(catalogPlaces));
  const catalog = { schemaVersion: 'itinerary-catalog-v1', version: contentHash,
    mapVersion: `${meta.sourceDate}:${meta.primaryTypeVersion}`, sourceDate: meta.sourceDate,
    sourceHash: hash(source), primaryTypeVersion: meta.primaryTypeVersion, reviewVersion: insightFile.version,
    reviewCollectedAt: insightFile.sourceMetadata?.collectedAt || null,
    operatingVersion: hash(JSON.stringify(catalogPlaces.map((p) => [p.placeId, p.operatingInfo, p.officialDwellMinutes]))),
    coverage, places: catalogPlaces };
  fs.mkdirSync(path.dirname(settings.output), { recursive: true });
  const temporary = `${settings.output}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.renameSync(temporary, settings.output);
  console.log(JSON.stringify({ version: catalog.version, coverage }));
}

build(options(process.argv.slice(2)));
