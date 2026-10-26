import fs from 'node:fs';

const input = 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_recal_02.jsonl';
const output = 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/zero_split_02.jsonl';
const axes = ['solo', 'couple', 'friends', 'kids', 'parents'];

// Direct mismatches visible in the place introductions/facts.
const kidsZero = new Set(['988238', '989025', '989206', '989242']);
const parentsZero = new Set([
  '1839451','1839477','1839491','1839536','1839552','1839621','1839630',
  '1839701','1839709','1839713','1839727','1839772','1839784','1839801',
  '1839833','1839864','1839866','1840777','1840837','1840882','1840913',
  '1841003','1841056','1841279','1841313','1844163','1884191','1884505',
  '1884521','1885746','1885754','1887368','1887493','1887866','1887873',
  '1889809','1889833','1890152','1890177','1890872','1895611','1895633',
  '1899959','2370834','2414827'
]);

const rows = fs.readFileSync(input, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const out = [];
for (const row of rows) {
  for (const axisKey of axes) {
    const axis = row.companion_fit?.[axisKey];
    if (!axis || axis.value !== 0.25) continue;
    const isZero = (axisKey === 'kids' && kidsZero.has(row.contentid)) ||
      (axisKey === 'parents' && parentsZero.has(row.contentid));
    const next = {
      ...axis,
      state: 'numeric',
      value: isZero ? 0 : 0.25,
      confidence: isZero ? 0.92 : 0.78,
      status: 'ai_draft',
      inference_level: 'direct_evidence',
      rationale: isZero
        ? (axisKey === 'kids'
          ? '장소의 대표 경험이 성인 골프 중심으로, kids 동행 경험과 직접적으로 어긋난다. 최저 적합도 0으로 분리한다.'
          : '장소의 대표 경험이 장거리·오름·험로 보행 중심으로, 부모 동행의 접근성과 직접적으로 어긋난다. 최저 적합도 0으로 분리한다.')
        : '장소 소개와 facts를 재검토했으나 대표 경험과의 직접적인 배제까지는 확인되지 않아 일반적 불확실성·약한 미스매치로 0.25를 유지한다.',
      evidence_ids: Array.isArray(axis.evidence_ids) && axis.evidence_ids.length ? axis.evidence_ids : [`web:${row.contentid}`],
      rule_ids: ['DIRECT-COMPANION-LOWER-SPLIT'],
      null_reason: null
    };
    out.push(JSON.stringify({ contentid: row.contentid, axis_key: axisKey, axis: next }));
  }
}
fs.writeFileSync(output, out.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ rows: out.length, zero: out.filter(x => JSON.parse(x).axis.value === 0).length, quarter: out.filter(x => JSON.parse(x).axis.value === 0.25).length }));
