import argparse,hashlib,json
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'data/labeling/jeju/2026-08-09'; OUT=BASE/'place-fit-relabel-v2'; COMP=['solo','couple','friends','kids','parents']
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def tx(x):
 if isinstance(x,str): return x
 if isinstance(x,list): return ' '.join(tx(v) for v in x)
 if isinstance(x,dict): return ' '.join(tx(v) for v in x.values())
 return '' if x is None else str(x)
def lab(name,t,pos,neg,sp=(),sn=(),eids=()):
 p=[x for x in pos if x in t]; n=[x for x in neg if x in t]; a=[x for x in sp if x in t]; b=[x for x in sn if x in t]
 if b and not a:v,lev,rule=0,'direct_evidence','R-'+name.upper()+'-STRONG_NEG'
 elif a and not b:v,lev,rule=1,'direct_evidence','R-'+name.upper()+'-STRONG_POS'
 elif len(p)>=2 and len(p)>len(n):v,lev,rule=.75,'researched_inference','R-'+name.upper()+'-POS'
 elif len(n)>=2 and len(n)>len(p):v,lev,rule=.25,'researched_inference','R-'+name.upper()+'-NEG'
 else:v,lev,rule=.5,'archetype_prior','R-'+name.upper()+'-NEUTRAL'
 terms=(a+b+p+n)[:4]; return {'state':'numeric','value':v,'confidence':.9 if v in (0,1) else .75 if v in (.25,.75) else .55,'status':'ai_draft','inference_level':lev,'rationale':('강한 ' + ('적합' if v==1 else '부적합')+' 근거: ' if v in (0,1) else '소개·facts 기반 신호: ')+((', '.join(terms)) if terms else '직접 근거 부족'),'evidence_ids':list(eids) if terms and eids else ['research:insufficient'],'rule_ids':[rule],'null_reason':None}
def comp(k,t,eids=()):
 pos={'solo':['산책','전시','사진','휴식','카페'],'couple':['풍경','사진','카페','해변','데이트'],'friends':['체험','시장','해변','오름','친구'],'kids':['체험','공원','동물','어린이','가족'],'parents':['산책','관람','정원','전시','휴식']}[k]
 neg={'solo':['단체','가족 중심'],'couple':['어린이','단체'],'friends':['조용한 명상'],'kids':['위험','절벽','음주','성인','긴 코스'],'parents':['긴 코스','등산','계단']}[k]
 core={'solo':['혼자 즐기','1인 여행'],'couple':['연인과','커플 추천','데이트 명소'],'friends':['친구와','친구 모임','단체 활동'],'kids':['아이와','어린이 동반','가족 체험'],'parents':['어르신과','부모님과','시니어 추천']}[k]
 hard=['어린이 출입 불가','미성년자 출입 금지','위험 구간'] if k=='kids' else ['단체 전용','2인 이상 필수'] if k in ('solo','couple') else ['1인 전용'] if k=='friends' else ['고령자 출입 불가','보행 불가']
 return lab(k,t,pos+['관람','체험','풍경'],neg+['야간','예약 필수']+hard,core,hard,eids)
def mon(m,t,eids=()):
 season={'1':['겨울','1월'],'2':['겨울','2월'],'3':['봄','3월','유채'],'4':['봄','4월','벚꽃'],'5':['봄','5월','철쭉'],'6':['여름','6월'],'7':['여름','7월','장마'],'8':['여름','8월'],'9':['가을','9월','억새'],'10':['가을','10월','단풍'],'11':['가을','11월'],'12':['겨울','12월']}[m]
 outdoor=['야외','옥외','바다','해변','오름','등산','트레킹','레포츠','수상','폭포','정원']; adverse={'1':['한파','폭설','겨울 휴장'],'2':['한파','폭설'],'7':['장마','폭우','태풍'],'8':['폭염','태풍']}.get(m,[])
 strong=[x for x in season[2:] if x in t]
 limited=['비수기','우천','날씨 영향','동절기','하절기 운영 제한']
 return lab('month-'+m,t,season+([x for x in outdoor if x in t][:2]),['폐장','휴무']+adverse+limited,strong,tuple(adverse),eids)
def na(): return {'state':'not_applicable','value':None,'confidence':1.0,'status':'ai_draft','inference_level':'not_applicable','rationale':'축제 개최일을 월 적합도로 일반화하지 않음','evidence_ids':['source_place:contenttypeid=15'],'rule_ids':['R-MONTH-DATE-GATE'],'null_reason':'event_date_not_generalizable'}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',default=str(OUT));out=Path(ap.parse_args().output);out.mkdir(parents=True,exist_ok=True)
 non=json.loads((BASE/'non_restaurants.json').read_text(encoding='utf-8'));rest=[x for x in json.loads((BASE/'restaurants.json').read_text(encoding='utf-8')) if x.get('lclsSystm2')=='FD05'];places=non+rest
 research={};
 for line in (BASE/'full/place-profile-v1-all-1434/place_web_research.jsonl').read_text(encoding='utf-8').splitlines(): d=json.loads(line);research[d['contentid']]=d
 reviews={};
 for p in (BASE/'place-preference-label-v5-researched/reviews').glob('*.json'): d=json.loads(p.read_text(encoding='utf-8'));reviews[d['contentid']]=d
 rows=[]
 for p in places:
  d=research.get(p['contentid'],{});r=reviews.get(p['contentid'],{});t=' '.join([tx(p),tx({k:d.get(k) for k in ('summary','typical_visit','facts','unknowns','sources')}),tx([s.get('facts') for s in r.get('sources',[])])]);eids=[s.get('source_id') or s.get('id') for s in list(d.get('sources') or [])+list(r.get('sources') or []) if s.get('source_id') or s.get('id')];eids=eids or [f'place:{p["contentid"]}'];months={str(i):mon(str(i),t,eids) for i in range(1,13)}
  if str(p.get('contenttypeid'))=='15':months={str(i):na() for i in range(1,13)}
  rows.append({'contentid':p['contentid'],'title':p.get('title',''),'source_place':{'contenttypeid':str(p.get('contenttypeid','')),'lclsSystm2':p.get('lclsSystm2','')},'companion_fit':{k:comp(k,t,eids) for k in COMP},'month_fit':months,'label_meta':{'version':'place-fit-relabel-v2','status':'ai_draft','method':'expanded deterministic keyword rules and festival date gate'}})
 jl=out/'place_fit_labels.jsonl';jl.write_text('\n'.join(json.dumps(r,ensure_ascii=False,separators=(',',':')) for r in rows)+'\n',encoding='utf-8')
 files=[BASE/'non_restaurants.json',BASE/'restaurants.json',BASE/'full/place-profile-v1-all-1434/place_web_research.jsonl']+sorted((BASE/'place-preference-label-v5-researched/reviews').glob('*.json'));inputs={str(p.relative_to(ROOT)):sha(p) for p in files};vals=[a for r in rows for g in ('companion_fit','month_fit') for a in r[g].values()];dist=Counter(str(a['value']) if a['state']=='numeric' else a['state'] for a in vals);num=Counter(str(a['value']) for a in vals if a['state']=='numeric');counts={'place_count':len(rows),'companion_axes':len(rows)*5,'month_axes':len(rows)*12,'axis_count':len(vals),'numeric_axis_count':sum(num.values()),'not_applicable_axis_count':sum(a['state']=='not_applicable' for a in vals),'value_distribution':dict(dist),'numeric_value_distribution':dict(num)}
 (out/'coverage_report.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(out/'manifest.json').write_text(json.dumps({'version':'place-fit-relabel-v2','generated_at':datetime.now(timezone.utc).isoformat(),'inputs_sha256':inputs,'output_sha256':sha(jl),'counts':counts},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(out/'review_report.md').write_text('# place-fit-relabel-v2 review report\n\n- 상태: `ai_draft`\n- 확장 키워드 규칙과 축제 date gate를 적용했다.\n- 분포는 근거가 있는 경우에만 차등화하며 사람 검토가 필요하다.\n',encoding='utf-8')
if __name__=='__main__':main()
