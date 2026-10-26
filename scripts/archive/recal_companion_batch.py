import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'data/labeling/jeju/2026-08-09'
OUT = BASE / 'place-fit-relabel-v2/batches/companion_recal_05.jsonl'
AXES = ['solo', 'couple', 'friends', 'kids', 'parents']
RULE = 'DIRECT-COMPANION-5LEVEL-RECALIBRATED'

def load_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

places = load_json(BASE / 'non_restaurants.json')
restaurants = [x for x in load_json(BASE / 'restaurants.json') if x.get('lclsSystm2') == 'FD05']
merged = places + restaurants
research = {}
for line in (BASE / 'full/place-profile-v1-all-1434/place_web_research.jsonl').read_text(encoding='utf-8').splitlines():
    if line.strip():
        x = json.loads(line)
        research[str(x['contentid'])] = x

def text_for(place):
    cid = str(place['contentid'])
    if place.get('lclsSystm2') == 'FD05':
        return f"{place.get('title','')} (FD05 카페/음료점)", [f"restaurant:{cid}"]
    x = research.get(cid, {})
    bits = [x.get('summary',''), x.get('typical_visit',''), x.get('place_kind',''), x.get('environment','')]
    facts = x.get('facts', {})
    bits += [str(facts.get(k,'')) for k in ('environment','experience_scope')]
    for s in x.get('sources', []):
        bits += s.get('claims', [])[:3]
    return ' '.join(str(b) for b in bits if b), [f"web:{cid}"] if x else [f"tourapi:{cid}"]

def label(axis, title, txt, evid, place):
    t = (title + ' ' + txt).lower()
    # Explicit mismatch or demanding conditions.
    hard = {
        'kids': ['성인전용', '성인 전용', '주류', '야간 클럽'],
        'parents': ['험로', '등산로', '암벽', '서핑', '스쿠버', '패러글라이딩'],
    }
    if any(k in t for k in hard.get(axis, [])):
        value, meaning = 0.25, '대표 경험과 뚜렷한 미스매치가 있어 불편 가능성이 큰 수준'
    else:
        cat = place.get('cat3','')
        # A shop/clinic/pharmacy is usually not a destination experience for
        # a group with children, parents, or friends; do not turn missing
        # evidence into the neutral default.
        if place.get('lclsSystm2') == 'SH04' or cat == 'SH04':
            value = 0.5 if axis in ('solo','couple') else 0.25
            meaning = ('혼자 또는 둘이 필요한 물품을 볼 수 있지만 동행 자체를 위한 대표 경험 근거는 약한 수준'
                       if value == 0.5 else '쇼핑·생활시설이 대표 경험이라 해당 동행을 위한 활동 근거와 거리가 있는 수준')
            evidence = ' '.join(re.sub(r'\s+', ' ', txt).split())[:180]
            rationale = f"소개 근거: {evidence or title}. {meaning}."
            return {'state':'numeric','value':value,'confidence':0.70,'status':'ai_draft',
                    'inference_level':'direct_evidence' if evid[0].startswith(('web:','restaurant:')) else 'unknown',
                    'rationale':rationale,'evidence_ids':evid,'rule_ids':[RULE], 'null_reason':None}
        lcls = place.get('lclsSystm2','')
        if lcls.startswith('AC') or cat.startswith('AC'):
            hotel_value = {'solo':0.5,'couple':0.75,'friends':0.75,'kids':0.75,'parents':0.75}[axis]
            meaning = '숙박·휴식 시설이 있어 해당 동행의 체류에 명확히 유리한 수준' if hotel_value == 0.75 else '숙박은 가능하지만 해당 동행만의 직접 장점 근거는 약한 수준'
            evidence = ' '.join(re.sub(r'\s+', ' ', txt).split())[:180]
            rationale = f"소개 근거: {evidence or title}. {meaning}."
            return {'state':'numeric','value':hotel_value,'confidence':0.72,'status':'ai_draft',
                    'inference_level':'direct_evidence' if evid[0].startswith(('web:','restaurant:')) else 'unknown',
                    'rationale':rationale,'evidence_ids':evid,'rule_ids':[RULE], 'null_reason':None}
        if lcls in ('NA01','NA02','NA04','NA05','VE01','VE02','VE03','VE07','VE09','VE12','EX02','EX03','EX05','EX07','EV01','EV02','EV03','LS01','LS02'):
            if axis == 'couple' and any(k in t for k in ['경관','해변','바다','전망','축제','산책','섬','정원','마을','빛의']):
                value, meaning = 0.75, '경관·산책·공유 체험이 소개에 명확히 드러나는 수준'
            elif axis == 'solo' and any(k in t for k in ['박물관','미술관','도서관','서점','정원','전망','사색','명상']):
                value, meaning = 0.75, '혼자 관람·독서·사색할 대표 활동이 소개에 명확히 드러나는 수준'
            elif axis == 'friends' and any(k in t for k in ['축제','체험','테마파크','해변','오름','서핑']):
                value, meaning = 0.75, '친구와 공유할 활동·체험이 소개에 명확히 드러나는 수준'
            else:
                value, meaning = 0.5, '무난하게 가능하지만 해당 동행을 위한 뚜렷한 장점 근거가 약한 수준'
            evidence = ' '.join(re.sub(r'\s+', ' ', txt).split())[:180]
            rationale = f"소개 근거: {evidence or title}. {meaning}."
            return {'state':'numeric','value':value,'confidence':0.72 if value==0.75 else 0.62,'status':'ai_draft',
                    'inference_level':'direct_evidence' if evid[0].startswith(('web:','restaurant:')) else 'unknown',
                    'rationale':rationale,'evidence_ids':evid,'rule_ids':[RULE], 'null_reason':None}
        strong = {
            'solo': ['혼자', '1인', '사색', '명상', '힐링', '자기 자신'],
            'couple': ['연인', '커플', '데이트', '로맨틱', '둘이', '야경'],
            'friends': ['친구', '단체', '함께', '체험', '액티비티', '놀이'],
            'kids': ['어린이', '아이', '아동', '가족', '키즈', '유모차', '체험'],
            'parents': ['부모', '어르신', '경로', '가족', '산책', '휴식', '주차', '화장실'],
        }[axis]
        hits = [k for k in strong if k in t]
        if len(hits) >= 2 and any(k in t for k in ['대표', '전용', '추천', '대상', '가족', '연인', '어린이', '어르신']):
            value, meaning = 1, '해당 동행을 대표 타깃으로 보거나 강한 직접 근거가 둘 이상인 수준'
        elif hits:
            value, meaning = 0.75, '해당 동행이 즐길 활동·시설·환경이 소개에 명확히 드러나는 수준'
        else:
            value, meaning = 0.5, '무난하게 가능하지만 해당 동행을 위한 뚜렷한 장점 근거가 약한 수준'
    evidence = ' '.join(re.sub(r'\s+', ' ', txt).split())[:180]
    rationale = f"소개 근거: {evidence or title}. {meaning}."
    return {'state':'numeric','value':value,'confidence':0.82 if value in (0,1) else (0.76 if value==0.75 else 0.62),
            'status':'ai_draft','inference_level':'direct_evidence' if evid[0].startswith(('web:','restaurant:')) else 'unknown',
            'rationale':rationale,'evidence_ids':evid,'rule_ids':[RULE], 'null_reason':None}

rows = []
for place in merged[1111:1388]:
    title = str(place.get('title',''))
    txt, evid = text_for(place)
    rows.append({'contentid':str(place['contentid']), 'companion_fit': {a: label(a,title,txt,evid,place) for a in AXES}})
OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', encoding='utf-8', newline='\n') as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False, separators=(',',':'))+'\n')
print(f'wrote {len(rows)} rows to {OUT}')
