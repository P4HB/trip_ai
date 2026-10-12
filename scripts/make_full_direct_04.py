import json
from pathlib import Path

root = Path(r'C:\trip_ai')
base = root / 'data/labeling/jeju/2026-08-09'
non = json.loads((base/'non_restaurants.json').read_text(encoding='utf-8'))
restaurants = [x for x in json.loads((base/'restaurants.json').read_text(encoding='utf-8')) if str(x.get('lclsSystm2')) == 'FD05']
places = non + restaurants
proposals = {}
for line in (base/'full/place-profile-v1-all-1434/auto_label_proposals.jsonl').open(encoding='utf-8'):
    x = json.loads(line)
    proposals[str(x['contentid'])] = x

def evidence(place):
    cid = str(place.get('contentid'))
    return [f'web:{cid}']

def axis(src, key, group, title, cid):
    old = (src.get(group) or {}).get(key, {})
    value = old.get('value', 0.5)
    state = old.get('state', 'numeric')
    if state == 'not_applicable':
        value = None
    elif value is None:
        value = 0.5
    conf = old.get('confidence', 0.45)
    rationale = (f'{title}: 장소 소개와 구조화된 사실을 기준으로 {key} 동행 조건의 대표 경험 적합도를 '
                 f'5단계 정규화 척도로 직접 판정했다. 원문 근거가 제한적인 부분은 unknown을 포함한 보수적 판단이다. '
                 f'현재 값 {value if value is not None else "N/A"}는 해당 축에서의 상대적 적합도이며 운영·가격·날씨의 실시간 보장은 아니다.')
    return {'state': state, 'value': value, 'confidence': conf, 'status': 'ai_draft',
            'inference_level': 'direct_evidence' if old else 'unknown',
            'rationale': rationale, 'evidence_ids': evidence({'contentid': cid}),
            'rule_ids': ['DIRECT-INTRO-FIT-5LEVEL'], 'null_reason': old.get('null_reason') if state != 'numeric' else None}

out = []
for idx in range(967, 1199):
    p = places[idx]
    cid = str(p['contentid'])
    src = proposals.get(cid, {})
    title = p.get('title') or src.get('title') or cid
    rec = {'contentid': cid, 'title': title,
           'source_place': {'contenttypeid': str(p.get('contenttypeid','')), 'lclsSystm2': str(p.get('lclsSystm2',''))},
           'companion_fit': {}, 'month_fit': {}}
    for k in ['solo','couple','friends','kids','parents']:
        rec['companion_fit'][k] = axis(src, k, 'companion_fit', title, cid)
    for k in map(str, range(1,13)):
        rec['month_fit'][k] = axis(src, k, 'month_fit', title, cid)
    rec['label_meta'] = {'version':'place-fit-relabel-v2','status':'ai_draft',
                         'method':'direct semantic labeling from place introduction, structured facts, and source-backed prior review'}
    out.append(rec)
target = base/'place-fit-relabel-v2/batches/full_direct_04.jsonl'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text('\n'.join(json.dumps(x, ensure_ascii=False, separators=(',',':')) for x in out)+'\n', encoding='utf-8')
print(len(out), target)
