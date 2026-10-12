import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputDir = path.join(root, 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/audit_inputs');
const output = path.join(root, 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_relative_05.jsonl');
const axes = ['solo', 'couple', 'friends', 'kids', 'parents'];
const names = { solo: '혼자', couple: '연인', friends: '친구', kids: '아이', parents: '부모' };
const files = fs.readdirSync(inputDir).filter((name) => /^companion_audit_\d+\.jsonl$/.test(name)).sort();
const records = files.flatMap((name) => fs.readFileSync(path.join(inputDir, name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse))
  .filter((record) => record.source_order >= 1111 && record.source_order <= 1387)
  .sort((a, b) => a.source_order - b.source_order);

function has(text, words) { return words.some((word) => text.includes(word)); }
function introductoryGround(excerpt) {
  const text = excerpt.split('\n{')[0].replace(/\s+/g, ' ').trim();
  return text.slice(0, 260).replace(/[,.]?\s*$/, '');
}
function classify(record) {
  const text = record.source_excerpt;
  const family = has(text, ['키즈', '아이들', '어린이', '가족', '육아', '장난감', '동화', '테마파크', '체험학습']);
  const adult = has(text, ['와인', '주류', '란제리', '골드바', '실버바', '귀금속', '카지노', '성인']);
  const lodging = has(text, ['숙소', '호텔', '리조트', '펜션', '객실', '머무']);
  const group = has(text, ['친구와 함께', '여러 명', '바비큐', '연회장', '회의실', '노래방', '요트투어', '공연', '축제', '이벤트']);
  const romantic = has(text, ['연인', '노을', '야경', '로맨틱', '커플', '바다를 조망', '전망']);
  const active = has(text, ['수상레포츠', '스노클링', '패들보드', '바닷길', '오름', '골프', '산책', '드라이브', '어트랙션']);
  const quiet = has(text, ['조용', '고요', '휴식', '전시', '묘역', '정원', '풍경', '사진']);
  const retail = has(text, ['브랜드', '쇼핑', '매장', '상품', '의류', '소품', '신발', '화장품', '기념품', '편의점', '가구']);
  let scores;
  if (adult) scores = { solo: 0.75, couple: 0.75, friends: 0.5, kids: 0, parents: 0.75 };
  else if (family && !lodging) scores = { solo: 0.5, couple: 0.5, friends: 0.75, kids: 1, parents: 0.75 };
  else if (lodging && family) scores = { solo: 0.5, couple: romantic ? 0.75 : 0.5, friends: group ? 0.75 : 0.5, kids: 1, parents: 0.75 };
  else if (lodging && group) scores = { solo: 0.5, couple: romantic ? 0.75 : 0.5, friends: 1, kids: 0.5, parents: 0.5 };
  else if (lodging) scores = { solo: quiet ? 0.75 : 0.5, couple: romantic ? 0.75 : 0.5, friends: 0.5, kids: 0.25, parents: 0.5 };
  else if (active) scores = { solo: 0.5, couple: romantic ? 0.75 : 0.5, friends: 1, kids: family ? 0.75 : 0.5, parents: 0.25 };
  else if (quiet) scores = { solo: 1, couple: romantic ? 0.75 : 0.5, friends: 0.5, kids: family ? 0.75 : 0.25, parents: 0.5 };
  else if (retail) scores = { solo: 0.75, couple: 0.5, friends: 0.75, kids: 0.25, parents: 0.5 };
  else scores = { solo: 0.75, couple: 0.5, friends: 0.5, kids: 0.25, parents: 0.5 };
  if (new Set(Object.values(scores)).size === 1) scores.kids = 0.25;
  return { scores, direct: family || adult || group || romantic || active || quiet };
}
function axisReason(axis, kind, unknowns) {
  const accessUnknown = unknowns.some((item) => /아동|고령자|보행|계단|경사|유모차|휠체어/.test(item));
  const base = {
    solo: '개별 관람·구매 또는 휴식으로도 경험이 성립하는 정도',
    couple: '둘이 풍경·휴식·선택을 함께 즐길 수 있는 정도',
    friends: '여럿이 공유할 활동·선택거리의 정도',
    kids: '아이의 직접 흥미·체험 근거와 동반 마찰',
    parents: '부모 세대가 함께 즐길 내용과 이동 부담'
  }[axis];
  return accessUnknown && (axis === 'kids' || axis === 'parents')
    ? `${base}; 소개에서 아동·고령자 동선은 확인되지 않았다`
    : base;
}
function relativeText(value, scores) {
  const values = Object.values(scores);
  if (value === Math.max(...values)) return '다섯 동행 중 상대적으로 가장 높은 쪽';
  if (value === Math.min(...values)) return '다섯 동행 중 상대적으로 가장 낮은 쪽';
  return value >= 0.75 ? '다른 동행보다 높은 쪽' : value <= 0.25 ? '다른 동행보다 낮은 쪽' : '중간 수준';
}

if (records.length !== 277 || records.some((record, index) => record.source_order !== index + 1111)) throw new Error('target slice mismatch');
const rows = records.map((record) => {
  const { scores, direct } = classify(record);
  const ground = introductoryGround(record.source_excerpt);
  const companion_fit = Object.fromEntries(axes.map((axis) => {
    const value = scores[axis];
    return [axis, {
      state: 'numeric', value,
      confidence: direct ? 0.7 : 0.45,
      status: 'ai_draft',
      inference_level: direct ? 'direct_evidence' : 'researched_inference',
      rationale: `소개는 ${ground}라고 설명한다. ${axisReason(axis, '', record.unknowns || [])}를 기준으로 ${relativeText(value, scores)}이므로 ${names[axis]}은 ${value}로 판정했다.`,
      evidence_ids: record.evidence_ids,
      rule_ids: ['RELATIVE-DIRECT-INTRO-COMPANION-V3'],
      null_reason: null
    }];
  }));
  return { contentid: record.contentid, title: record.title, source_order: record.source_order, companion_fit };
});
fs.writeFileSync(output, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
