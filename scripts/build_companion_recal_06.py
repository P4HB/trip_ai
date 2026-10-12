import json, re
from pathlib import Path

BASE=Path('data/labeling/jeju/2026-08-09')
OUT=BASE/'place-fit-relabel-v2/batches/companion_recal_06.jsonl'
RULE='DIRECT-COMPANION-5LEVEL-RECALIBRATED'
AXES=['solo','couple','friends','kids','parents']

def load_json(p): return json.loads(p.read_text(encoding='utf-8'))
non=load_json(BASE/'non_restaurants.json')
rest=load_json(BASE/'restaurants.json')
merged=non+[x for x in rest if x.get('lclsSystm2')=='FD05']
target=merged[1388:1664]
research={}
rp=BASE/'full/place-profile-v1-all-1434/place_web_research.jsonl'
for line in rp.read_text(encoding='utf-8').splitlines():
    if line.strip():
        x=json.loads(line); research[str(x.get('contentid'))]=x
current={}
for line in (BASE/'place-fit-relabel-v2/place_fit_labels.jsonl').read_text(encoding='utf-8').splitlines():
    if line.strip():
        x=json.loads(line); current[str(x['contentid'])]=x

def text_for(x):
    cid=str(x['contentid']); bits=[x.get('title',''),x.get('addr1','')]
    r=research.get(cid,{})
    for k in ('summary','typical_visit','facts','unknowns'):
        v=r.get(k,'')
        bits.append(json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else str(v))
    return ' '.join(bits)

def axis_score(t, axis, cafe):
    # Explicit activity/facility signals drive 0.75/1; mismatch signals drive 0/0.25.
    low=t.lower()
    hard={
      'kids': ('키즈|어린이|아이|아동|가족|놀이|체험|동물|목장|감귤따기|해피월드|하리보', '성인|주류|바|험로|오름|등산'),
      'parents': ('무장애|엘리베이터|휴식|정원|박물관|전시|홍보관|호텔|리조트|찻집|다원', '오름|등산|험로|트레킹|장시간'),
      'couple': ('데이트|연인|로맨틱|노을|바다|전망|정원|감성|촬영지|산책|해안|테마', '약국|편의점|다이소|골프|스포츠용품'),
      'friends': ('체험|공연|축제|시장|쇼핑|전시|카페|베이커리|목장|동물|바다|골프', '약국|편의점|정관장|다이소'),
      'solo': ('책방|박물관|전시|홍보관|산책|정원|카페|서점|쇼핑|아카이브', '가족|키즈|단체|최소 인원|험로|등산'),
    }
    pos,neg=hard[axis]
    p=len(re.findall(pos,low)); n=len(re.findall(neg,low))
    if n>=2 and p==0: return 0.25,'소개에 해당 동행을 위한 활동·편의보다 불편 또는 미스매치 단서가 두드러진다.'
    if n>=1 and p==0: return 0.25,'소개에 해당 동행과 맞지 않을 수 있는 이용 환경이 명시되어 있다.'
    if not cafe and p>=2: return 1.0,'소개에 해당 동행이 대표적으로 즐길 활동·시설·환경의 직접 단서가 둘 이상 명확히 드러난다.'
    if p>=1: return 0.75,'소개에 해당 동행이 즐길 활동·시설·환경이 명확히 드러난다.'
    # Cafes are not promoted as universal fits: neutral only when evidence is weak.
    if cafe and axis in ('couple','friends') and re.search('카페|커피|베이커리|디저트',low):
        return 0.75,'카페·커피·디저트 공간이라는 소개가 있어 함께 머무는 경험이 명확하다.'
    if cafe and axis=='solo' and re.search('무인|로스터|커피|카페',low):
        return 0.75,'카페·커피 공간이라는 소개가 있어 혼자 머물 수 있는 대표 경험이 드러난다.'
    return 0.5,'장소 소개에서 해당 동행을 위한 뚜렷한 장점이나 불편 근거가 충분히 확인되지 않는다.'

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    dist={a:{v:0 for v in (0,0.25,0.5,0.75,1)} for a in AXES}
    with OUT.open('w',encoding='utf-8',newline='\n') as f:
      for x in target:
        cid=str(x['contentid']); t=text_for(x); cafe=x.get('lclsSystm2')=='FD05'
        fits={}
        for a in AXES:
          v,reason=axis_score(t,a,cafe); dist[a][v]+=1
          fits[a]={'state':'numeric','value':v,'confidence':0.8 if v in (0,0.25,0.75,1) else 0.6,
            'status':'ai_draft','inference_level':'direct_evidence' if v!=0.5 else 'researched_inference',
            'rationale':f"{x.get('title','')} 소개·facts를 기준으로 판단: {reason} 점수 {v}는 5단계 중 해당 동행 적합도의 {'최저' if v==0 else '뚜렷한 불편/미스매치' if v==0.25 else '무난하지만 뚜렷한 장점 없음' if v==0.5 else '명확한 활동·시설 근거' if v==0.75 else '대표 타깃 또는 강한 직접 근거 둘 이상'}를 뜻한다.",
            'evidence_ids':[f"web:{cid}"], 'rule_ids':[RULE], 'null_reason':None}
        f.write(json.dumps({'contentid':cid,'companion_fit':fits},ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'count':len(target),'distribution':dist},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
