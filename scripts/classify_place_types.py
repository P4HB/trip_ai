"""Build a non-destructive, versioned primary visit-type sidecar (SPEC-075)."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config/place_type_taxonomy.v1.json'
RAW = ROOT / 'data/tourapi/jeju/2026-08-09/jeju_places.json'
BUNDLE = ROOT / 'map-ui/data/jeju-places.js'
OUTPUT = ROOT / 'data/labeling/jeju/2026-09-11/place-types-v1'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_bundle():
    code = "const fs=require('fs'),vm=require('vm');let s={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),s);process.stdout.write(JSON.stringify(s.window.JEJU_PLACES));"
    result = subprocess.run(['node', '-e', code, str(BUNDLE)], check=True, capture_output=True, encoding='utf-8')
    return json.loads(result.stdout)


def classify(raw, place, config):
    code = raw.get('lclsSystm3', '')
    kind = config['code_map'].get(code)
    rule = 'code:' + code
    evidence = [{'field': 'lclsSystm3', 'value': code}]
    review_reasons = []
    method = 'source_code_mapping'
    if kind is None:
        for prefix, target in config['prefix_map'].items():
            if code.startswith(prefix):
                kind, rule = target, 'prefix:' + prefix
                break
    if kind is None:
        kind = 'unknown'
        review_reasons.append('unmapped_source_code')
    override = config['overrides'].get(place['id'])
    if override:
        kind = override['type']
        method = 'evidence_override'
        rule = 'override:' + place['id']
        evidence.append({'field': 'classification_decision', 'value': override['reason']})
        if override.get('review'):
            review_reasons.append(override['review'])
    # A code group spans unrelated experiences: require a per-place decision.
    elif code in config['review_codes']:
        review_reasons.append('broad_or_mixed_source_category')
    if kind == 'unknown' and not review_reasons:
        review_reasons.append('insufficient_representative_experience_evidence')
    if kind not in config['types']:
        raise ValueError(f'Undefined type: {kind}')
    confirmation = (override or {}).get('user_confirmation')
    if confirmation:
        if not confirmation.get('date') or not confirmation.get('instruction'):
            raise ValueError('Incomplete user confirmation')
        review_reasons = []
        method = 'user_confirmation'
        rule = 'user:' + place['id']
        evidence.append({'field': 'user_confirmation', 'value': confirmation})
    research = place.get('research') or {}
    return {
        'schema_version': 'place-primary-type-v1',
        'taxonomy_version': config['version'],
        'place_id': place['id'], 'provider': 'tourapi',
        'title': place['title'], 'primary_type': kind,
        'primary_type_label': config['types'][kind]['label'],
        'classification_status': 'user_confirmed' if confirmation else ('needs_review' if review_reasons else 'rule_classified'),
        'human_reviewed': bool(confirmation),
        'user_confirmation': confirmation,
        'method': method, 'rule_id': rule, 'evidence': evidence,
        'review_reasons': review_reasons,
        'recommendation_ready': bool(place.get('v5') and place.get('fit')),
        'source_classification': {k: raw.get(k, '') for k in ['contenttypeid', 'lclsSystm1', 'lclsSystm2', 'lclsSystm3', 'cat1', 'cat2', 'cat3']},
        'research_highlights': research.get('highlights', []),
        'research_sources': research.get('sources', []),
    }


def jsonl(path, rows):
    path.write_text(''.join(json.dumps(r, ensure_ascii=False, sort_keys=True) + '\n' for r in rows), encoding='utf-8')


def build(output=OUTPUT):
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    raw_rows = json.loads(RAW.read_text(encoding='utf-8'))
    places = read_bundle()
    raw = {str(p['contentid']): p for p in raw_rows}
    ids = [p['id'] for p in places]
    if len(raw) != len(raw_rows) or len(set(ids)) != len(ids):
        raise ValueError('Duplicate input ID')
    if len(ids) != 2153:
        raise ValueError('Scope changed: expected 2153 map places')
    if not set(config['overrides']).issubset(ids):
        raise ValueError('Override refers to a place outside the map scope')
    rows = [classify(raw[p['id']], p, config) for p in places]
    output.mkdir(parents=True, exist_ok=True)
    jsonl(output / 'place_types.jsonl', rows)
    queue = [r for r in rows if r['classification_status'] == 'needs_review']
    jsonl(output / 'review_queue.jsonl', queue)
    # A fresh sibling database keeps reruns byte-stable and never mutates a source DB.
    temp = output / 'place_types.build.sqlite3'
    if temp.exists():
        raise FileExistsError(f'Unfinished build exists: {temp}')
    with sqlite3.connect(temp) as conn:
        conn.execute('CREATE TABLE place_types (place_id TEXT PRIMARY KEY, title TEXT NOT NULL, primary_type TEXT NOT NULL, classification_status TEXT NOT NULL, recommendation_ready INTEGER NOT NULL, record_json TEXT NOT NULL)')
        conn.executemany('INSERT INTO place_types VALUES (?,?,?,?,?,?)', [(r['place_id'], r['title'], r['primary_type'], r['classification_status'], int(r['recommendation_ready']), json.dumps(r, ensure_ascii=False, sort_keys=True)) for r in rows])
        conn.execute('CREATE INDEX place_types_type_idx ON place_types(primary_type)')
    conn.close()
    temp.replace(output / 'place_types.sqlite3')
    counts = collections.Counter(r['primary_type'] for r in rows)
    ready_counts = collections.Counter(r['primary_type'] for r in rows if r['recommendation_ready'])
    lines = ['# 기존 지도 장소 대표 유형 분류', '', 'SPEC-075 / ' + config['version'], '',
             '기존 지도 2,153곳의 규칙 기반 분류 초안. 사람 전수 검수·일일 상한 적용은 아직 하지 않았다.',
             '원본 분류 코드와 기존 조사 근거를 사용했다. rule_classified는 자동 판정, user_confirmed는 사용자가 대표 유형을 확정한 항목이다.',
             'primary_type 한 개를 향후 하루 횟수 집계 단위로 사용한다. unknown 및 needs_review는 검토 전 확정 상한 집계에 사용하지 않는다.', '',
             f"- 전체: {len(rows)} / 추천 준비: {sum(r['recommendation_ready'] for r in rows)} / 사용자 확정: {sum(r['human_reviewed'] for r in rows)} / 검토 필요: {len(queue)} / 미분류: {counts['unknown']}", '',
             '| 유형 ID | 이름 | 전체 | 추천 준비 | 정의 |', '|---|---|---:|---:|---|']
    for key, spec in config['types'].items():
        lines.append(f"| {key} | {spec['label']} | {counts[key]} | {ready_counts[key]} | {spec['definition']} |")
    lines.extend(['', '## 검토 필요', '', '| ID | 장소 | 임시 유형 | 사유 |', '|---|---|---|---|'])
    for r in queue:
        lines.append(f"| {r['place_id']} | {r['title'].replace('|', '/')} | {r['primary_type_label']} | {', '.join(r['review_reasons'])} |")
    lines.extend(['', '## 전체 장소', '', '| ID | 장소 | 대표 유형 | 판정 |', '|---|---|---|---|'])
    for r in rows:
        lines.append(f"| {r['place_id']} | {r['title'].replace('|', '/')} | {r['primary_type_label']} | {r['classification_status']} |")
    (output / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    manifest = {'schema_version': 'place-primary-type-manifest-v1', 'taxonomy_version': config['version'],
                'scope': 'existing_map_2153_only', 'total': len(rows), 'recommendation_ready': sum(r['recommendation_ready'] for r in rows),
                'review_count': len(queue), 'user_confirmed_count': sum(r['human_reviewed'] for r in rows), 'counts': dict(sorted(counts.items())),
                'inputs': {p.relative_to(ROOT).as_posix(): digest(p) for p in [RAW, BUNDLE, CONFIG, Path(__file__)]},
                'outputs': {name: digest(output / name) for name in ['place_types.jsonl', 'review_queue.jsonl', 'place_types.sqlite3', 'report.md']}}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    summary = build(args.output)
    print(json.dumps({k: summary[k] for k in ['total', 'recommendation_ready', 'review_count', 'counts']}, ensure_ascii=False, indent=2))
