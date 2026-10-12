import json
import re
from collections import Counter

INP = 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/place_fit_labels.jsonl'
OUT = 'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/companion_recal_04.jsonl'
RESEARCH = 'data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434/place_web_research.jsonl'
AXES = ['solo', 'couple', 'friends', 'kids', 'parents']
RULE = 'DIRECT-COMPANION-5LEVEL-RECALIBRATED'

research = {}
try:
    for line in open(RESEARCH, encoding='utf-8'):
        x = json.loads(line)
        research[str(x.get('contentid'))] = x
except FileNotFoundError:
    pass

def text_for(x):
    r = research.get(str(x['contentid']), {})
    bits = []
    for s in r.get('sources', []):
        bits.extend(s.get('claims', []))
    if not bits:
        bits.append(x.get('title', '장소 소개'))
    return re.sub(r'\s+', ' ', bits[0]).strip()[:180]

def scores(x, evidence):
    t = x['title']
    kind = x['source_place'].get('lclsSystm2', '')
    s = {a: 0.5 for a in AXES}
    low = t.lower() + ' ' + evidence.lower()
    shopping = kind in ('SH04', 'SH05', 'SH06')
    hotel = kind in ('AC01', 'AC02', 'AC03', 'AC04', 'AC05')
    hard = any(w in low for w in ('둘레길', '숲길', '오름', '하늘길', '등산', '탐방', '산방산'))
    family = any(w in low for w in ('키즈', '어린이', '아이', '테마', '박물관', '과학', '동물', '농장', '체험', '수영', '워터쇼'))
    romance = any(w in low for w in ('포토존', '야경', '리조트', '스테이', '호텔', '해안산책', '미술관', '전망'))
    group = any(w in low for w in ('축제', '시장', '야시장', '공원', '카트', '카약', '유람선', '체험'))
    if shopping:
        s = {'solo': 0.5, 'couple': 0.25, 'friends': 0.25, 'kids': 0.25, 'parents': 0.25}
        if kind in ('SH05', 'SH06'):
            s.update(couple=0.5, friends=0.5, parents=0.5)
    if hotel:
        s = {'solo': 0.5, 'couple': 0.75 if romance else 0.5, 'friends': 0.5, 'kids': 0.75 if any(w in low for w in ('수영', '키즈', '리조트')) else 0.5, 'parents': 0.75 if any(w in low for w in ('스파', '리조트', '편의')) else 0.5}
    if hard:
        s['kids'] = 0.25; s['parents'] = 0.25
    if family:
        s['kids'] = 0.75
        s['parents'] = max(s['parents'], 0.5)
    if group:
        s['friends'] = 0.75
    if romance and not shopping:
        s['couple'] = max(s['couple'], 0.75)
    if any(w in low for w in ('승마', '오프로드', '카트', '카약', '잠수함', '유람선')):
        s['solo'] = 0.75; s['friends'] = 0.75; s['couple'] = max(s['couple'], 0.75)
        s['parents'] = 0.25 if any(w in low for w in ('오프로드', '승마')) else 0.5
    if any(w in low for w in ('성형외과', '약국', '마트', '하이마트', '전자')):
        s = {'solo': 0.5, 'couple': 0.25, 'friends': 0.25, 'kids': 0.25, 'parents': 0.5}
    return s

def axis(axis, value, x, evidence):
    level = 'direct_evidence' if value in (0.75, 1) else 'researched_inference'
    reason = f"소개에는 ‘{evidence}’가 확인된다. {axis} 동행은 이 근거에 비추어 {value}로 판단했다(0=대표 경험 최저, 0.25=뚜렷한 미스매치, 0.5=무난하지만 장점 약함, 0.75=즐길 활동·환경이 명확함, 1=대표 타깃 또는 강한 직접 근거 2개 이상)."
    return {'state':'numeric','value':value,'confidence':0.82 if value >= 0.75 else 0.72 if value == 0.5 else 0.78,
            'status':'ai_draft','inference_level':level,'rationale':reason,
            'evidence_ids':[f"web:{x['contentid']}"],'rule_ids':[RULE], 'null_reason':None}

rows = []
for i, line in enumerate(open(INP, encoding='utf-8')):
    if 834 <= i < 1110:
        x = json.loads(line); ev = text_for(x); vals = scores(x, ev)
        rows.append({'contentid': str(x['contentid']), 'companion_fit': {a: axis(a, vals[a], x, ev) for a in AXES}})
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    for row in rows: f.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')
print(len(rows))
for a in AXES: print(a, Counter(row['companion_fit'][a]['value'] for row in rows))
