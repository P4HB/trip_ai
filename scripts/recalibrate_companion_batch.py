import json
import re
from collections import Counter
from pathlib import Path

BASE = Path('data/labeling/jeju/2026-08-09')
OUT = BASE / 'place-fit-relabel-v2/batches/companion_recal_03.jsonl'
RULE = 'DIRECT-COMPANION-5LEVEL-RECALIBRATED'
AXES = ('solo', 'couple', 'friends', 'kids', 'parents')
VALUES = (0, 0.25, 0.5, 0.75, 1)

def load_jsonl(p):
    return [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines() if x.strip()]

def evidence_text(rec, restaurant=False):
    if restaurant:
        return f"{rec.get('title','')} FD05 카페·찻집"
    facts = rec.get('facts') or {}
    return ' '.join(str(x) for x in [rec.get('summary',''), rec.get('typical_visit',''), facts])

def score(text, axis, restaurant):
    t = text.lower()
    explicit = {
        'kids': r'아이|어린이|유아|가족|키즈|체험가능연령|동물 먹이|놀이|승마|목장|수족관|테마파크',
        'parents': r'어르신|경로|무장애|평탄|편안|휴식|벤치|실내|엘리베이터|장애인',
        'couple': r'연인|데이트|로맨|사진|포토존|야경|노을|카페|정원|산책|풍경',
        'friends': r'친구|단체|액티비티|체험|트레킹|등반|서핑|카약|승마|공연|시장|쇼핑',
        'solo': r'혼자|1인|명상|치유|산책|전시|박물관|관람|카페|자연|사색',
    }
    friction = {
        'kids': r'성인전용|성인만|험로|등산|급경사|위험|장시간|예약 필수',
        'parents': r'험로|등산|급경사|계단|장시간|주차 불가|주차 공간.{0,8}없',
        'solo': r'최소.{0,8}인|2인 이상|단체만|예약 필수|동반 필수',
        'couple': r'최소.{0,8}인|단체만|어린이|키즈|험로|장시간',
        'friends': r'성인전용|어린이|유아|가족|조용한 명상|주차 불가',
    }
    strong = bool(re.search(explicit[axis], t))
    bad = bool(re.search(friction[axis], t))
    if bad and not strong:
        return 0.25, 'researched_inference', 0.72
    if strong:
        # 1 is reserved for two strong cues or explicit target/facility language.
        hits = len(re.findall(explicit[axis], t))
        return (1 if hits >= 2 and re.search(r'대표|추천|전 연령|가족|연인|친구', t) else 0.75), 'direct_evidence', 0.86
    if restaurant:
        return ({'solo': 0.75, 'couple': 0.75, 'friends': 0.5, 'kids': 0.5, 'parents': 0.5}[axis], 'archetype_prior', 0.62)
    kind = 'outdoor' if re.search(r'자연|숲|해안|오름|분화구|폭포|공원|정원|산책|경관', t) else 'general'
    defaults = {'outdoor': {'solo': .75, 'couple': .75, 'friends': .5, 'kids': .5, 'parents': .5},
                'general': {'solo': .5, 'couple': .5, 'friends': .5, 'kids': .25, 'parents': .5}}
    return defaults[kind][axis], 'researched_inference', 0.58

def main():
    places = json.loads((BASE/'non_restaurants.json').read_text(encoding='utf-8'))
    restaurants = json.loads((BASE/'restaurants.json').read_text(encoding='utf-8'))
    fd05 = [x for x in restaurants if x.get('lclsSystm2') == 'FD05'][:230]
    research = {x['contentid']: x for x in load_jsonl(BASE/'full/place-profile-v1-all-1434/place_web_research.jsonl')}
    merged = places + fd05
    selected = merged[556:834]
    rows = []
    for p in selected:
        cid = str(p['contentid']); r = research.get(cid); is_rest = r is None
        text = evidence_text(p if is_rest else r, is_rest)
        fit = {}
        for axis in AXES:
            value, level, conf = score(text, axis, is_rest)
            fit[axis] = {'state':'numeric', 'value':value, 'confidence':conf, 'status':'ai_draft',
                'inference_level':level,
                'rationale':f"{text[:180]} 근거로 {axis} 동행은 {value}로 판정(5단계 기준: {'대표 타깃·강한 근거' if value==1 else '명확한 활동·환경' if value==.75 else '뚜렷한 미스매치' if value==.25 else '무난하지만 특화 근거 약함'}).",
                'evidence_ids':[f"{'source:restaurant' if is_rest else 'web'}:{cid}"], 'rule_ids':[RULE], 'null_reason':None}
        rows.append({'contentid':cid, 'companion_fit':fit})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(json.dumps(x, ensure_ascii=False, separators=(',',':')) for x in rows)+'\n', encoding='utf-8')
    for a in AXES: print(a, dict(sorted(Counter(x['companion_fit'][a]['value'] for x in rows).items())))
    print('rows', len(rows), 'first', rows[0]['contentid'], 'last', rows[-1]['contentid'])

if __name__ == '__main__': main()
