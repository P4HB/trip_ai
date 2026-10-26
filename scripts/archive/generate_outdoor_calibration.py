"""Generate SPEC-030 outdoor_nature Companion calibration sidecar."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[2]
src=root/'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/calibration_sample.jsonl'
out=root/'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/calibrate_outdoor.jsonl'
axes=('solo','couple','friends','kids','parents'); rule='CALIBRATED-DIRECT-COMPANION-V1'
# values: solo, couple, friends, kids, parents; fact is from source_excerpt.
labels={
'126434':((.75,.5,.5,.5,.5),'해안 절벽·화석층, 수월정 전망대와 차귀도·낙조 조망',None),'126435':((.75,.5,.5,.5,.5),'해발 180m 분화구·정상 일출 경관, 파고라·상가와 자연유산 해설',None),'126436':((.75,.5,.5,0,0),'성판악탐방로가 정상까지 9.6km·4시간 30분이며 입산·하산 통제가 있음','긴 고강도 등산이 대표 경험이라 아이·부모에는 최저 적합도'),'126437':((.5,.5,.5,.5,.5),'바다로 직접 떨어지는 폭포·무지개 경관과 편의점·안내시설',None),'126438':((.5,.5,.5,.5,.5),'기암절벽·폭포·화석과 휴게소·상점·문화관광해설사',None),'126439':((.5,.5,.5,.5,.5),'세 폭포와 주상절리·연못을 관람',None),'126440':((.5,.5,.5,.25,.25),'계곡 절반이 수직 단애이고 협곡에 주상절리·판상절리가 발달','수직 단애·협곡 때문에 아이·부모에는 낮은 적합도'),'126441':((.75,.5,.5,.5,.5),'산책로를 따라 약 20분 걸어 원앙폭포와 맑은 물·피서 경관을 만남',None),'126443':((.75,.5,.75,1,.5),'여름 야외수영장의 슬라이딩 미끄럼틀로 아이들과 물놀이 가능','아이들과 물놀이가 직접 명시되어 kids 최고 적합도'),'126444':((.75,.5,.5,.25,.25),'사람이 살지 않는 무인도이며 배로 약 10분, 주변 바다는 수심이 깊음','무인도·깊은 바다 때문에 아이·부모에는 낮은 적합도'),'126445':((.5,.5,.5,.25,.25),'바위로 둘러싸인 천연기념물 문주란 자생지이며 주차·화장실 없음','바위 섬과 주차·화장실 부재로 아이·부모에는 낮은 적합도'),'126446':((.75,.5,.75,.5,.5),'오르막 없는 1~2시간 도보 일주, 자전거 대여와 청보리 걷기·보물찾기·공연',None),'126447':((.75,.5,.75,1,.5),'잔잔한 파도·고운 모래에서 어린이도 안심하고 해수욕, 개장 시 샤워실·탈의실','어린이 안전 해수욕이 직접 명시되어 kids 최고 적합도'),'126448':((.75,.5,.75,.5,.5),'완만한 백사장과 야영에 적합한 소나무 숲, 편의시설',None),'126450':((.75,.5,.5,.5,.5),'배로 약 30분 가는 평평한 섬, 가을 억새·해식동굴·최남단비',None),'126451':((.75,.5,.5,.5,.5),'맑은 물·하얀 모래와 주차장·화장실·안내·피난시설',None),'126452':((.75,.5,.5,.5,.5),'공개 제2입구 1km를 걸어 용암 생성물·7.6m 석주 관찰, 약 1시간 해설',None),'126454':((.75,.5,.75,.5,.5),'낮은 동산 공원의 산책·운동과 배드민턴장·축구장·운동장·팔각정',None),'126455':((.75,.5,.75,.75,.75),'야자수길·동굴·민속마을·조류원 등 9개 테마와 앵무새 먹이체험',None),'126456':((.75,.5,.5,.5,.5),'템플스테이·명상여행·만다라 체험과 9.3km 한라산 등산로',None),'126457':((.75,.5,.5,.25,.25),'산방산 절벽 중턱 해발 150m 동굴 사찰까지 올라 해안 경관 관람','절벽 중턱까지 오르는 경험이며 아이·고령자 보행 접근성은 unknown이라 낮은 적합도'),'126459':((.75,.5,.5,.5,.5),'세 기념탑과 정돈된 숲길의 역사 산책',None),'126461':((.5,.5,.5,.5,.5),'500~600년 추정의 큰 곰솔 8그루와 주변 수목 관찰',None),'126462':((.5,.5,.5,.5,.5),'제주 교학에 공헌한 5현을 기리는 제단과 역사 유적',None),'126463':((.5,.5,.5,.5,.5),'바닷가 조선시대 정자·유형문화재와 객사 역사',None),'126465':((.5,.5,.5,.5,.5),'탐라 시조 혼례 전설 연못과 전통혼례관·신방굴·생활사료관',None),'126466':((.75,.75,.75,.75,.5),'남녀노소 요트 마리나 프로그램·씨푸드 다이닝·문화이벤트',None),'126467':((.5,.5,.5,.5,.5),'약 25km 하천의 협곡·화산 지형과 작은 폭포 경관',None),'126468':((.75,.5,.5,.5,.5),'참꽃산책로·쉼터·전망대가 있는 전설·경관 방문지',None),'126469':((.75,.5,.5,.5,.5),'5.8km·약 2시간 30분 영실 등산로가 초보자에게 추천되고 안내소·매점 있음',None)}
rows=[json.loads(x) for x in src.read_text(encoding='utf8').splitlines() if x.strip()]; rows=[x for x in rows if x['calibration_family']=='outdoor_nature']
assert len(rows)==30 and {x['contentid'] for x in rows}==set(labels)
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('w',encoding='utf8',newline='\n') as f:
 for x in rows:
  vals,fact,low=labels[x['contentid']]; cf={}
  for axis,val in zip(axes,vals):
   r=f'소개에 {fact}이(가) 명시되어 있다. unknown: {"; ".join(x["unknowns"])}.'
   if low and axis in ('kids','parents'): r+=f' {low}.'
   cf[axis]={'state':'numeric','value':val,'confidence':.9 if val in (0,1) else .78,'status':'ai_draft','inference_level':'direct_evidence','rationale':r,'evidence_ids':x['evidence_ids'],'rule_ids':[rule],'null_reason':None}
  f.write(json.dumps({k:x[k] for k in ('contentid','title','source_order','calibration_family')}|{'companion_fit':cf},ensure_ascii=False,separators=(',',':'))+'\n')
