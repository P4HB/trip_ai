import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "labeling" / "jeju" / "2026-08-09" / "place-fit-relabel-v2"
OUT = BASE / "viewer.html"

places_path = ROOT / "data" / "labeling" / "jeju" / "2026-08-09" / "non_restaurants.json"
restaurants_path = ROOT / "data" / "labeling" / "jeju" / "2026-08-09" / "restaurants.json"
places = json.loads(places_path.read_text(encoding="utf-8"))
places += [p for p in json.loads(restaurants_path.read_text(encoding="utf-8")) if p.get("lclsSystm2") == "FD05"]
order = {str(place["contentid"]): index for index, place in enumerate(places)}

records = {}
batch_paths = [
    *sorted((BASE / "batches").glob("redo2_direct_*.jsonl")),
    *sorted((BASE / "batches").glob("full_direct_*.jsonl")),
]
for path in batch_paths:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            contentid = str(record["contentid"])
            if contentid not in records:
                records[contentid] = record

data = [records[contentid] for contentid in sorted(records, key=lambda cid: order.get(cid, 10**9))]
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

html = r'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trip AI · 직접 판정 라벨 결과</title>
<style>
:root{color-scheme:light;--ink:#17211f;--muted:#64736e;--line:#dbe4df;--paper:#f7faf8;--card:#fff;--accent:#147d68;--accent-soft:#e4f3ed;--warn:#a45b12}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;background:var(--paper)}header{padding:28px 32px 22px;background:#123d35;color:#fff}header h1{margin:0 0 8px;font-size:25px}header p{margin:0;color:#c9e4dc;font-size:14px}.layout{display:grid;grid-template-columns:330px minmax(0,1fr);min-height:calc(100vh - 128px)}aside{border-right:1px solid var(--line);background:#fff;padding:18px;overflow:auto}.search{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;font-size:14px;margin-bottom:12px}.stats{font-size:12px;color:var(--muted);margin-bottom:14px}.place{display:block;width:100%;text-align:left;padding:11px 12px;border:0;border-bottom:1px solid #edf2ef;background:transparent;color:var(--ink);cursor:pointer}.place:hover,.place.active{background:var(--accent-soft)}.place strong{display:block;font-size:14px}.place span{font-size:11px;color:var(--muted)}main{padding:26px;max-width:1200px;width:100%;margin:0 auto}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px}.hero h2{margin:0 0 6px;font-size:26px}.hero p{margin:0;color:var(--muted);font-size:13px}.badge{padding:7px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:12px;white-space:nowrap}.notice{background:#fff8ed;border:1px solid #f0d8b5;color:#7e4e1e;border-radius:10px;padding:12px 14px;font-size:13px;margin-bottom:18px}.group{margin-top:20px}.group h3{font-size:14px;margin:0 0 9px;color:#41625b}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.label{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px}.label-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.label-name{font-size:13px;font-weight:650}.score{font-size:20px;font-weight:750;color:var(--accent)}.meta{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--muted)}.pill{padding:3px 6px;border-radius:5px;background:#eef3f0}.rationale{margin:10px 0 0;font-size:12px;line-height:1.55;color:#33413d}.evidence{margin:9px 0 0;font-size:11px;color:#56746b}.empty{padding:40px;text-align:center;color:var(--muted)}@media(max-width:800px){.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);max-height:300px}.hero{display:block}.badge{display:inline-block;margin-top:12px}main{padding:18px}}
</style>
</head>
<body>
<header><h1>Trip AI · 5단계 재판정 라벨 결과</h1><p>장소 소개를 읽고 재판정한 5단계 결과 · 기존 canonical JSONL/SQLite 미반영</p></header>
<div class="layout"><aside><input id="search" class="search" placeholder="장소명 또는 contentid 검색"><div id="stats" class="stats"></div><div id="places"></div></aside><main id="main"><div class="empty">장소를 선택하세요.</div></main></div>
<script>
const DATA = __PAYLOAD__;
const names={theme:'Theme',environment:'Environment',style_evidence:'Style evidence',derived_style:'Derived style',solo:'혼자',couple:'커플',friends:'친구',kids:'아이 동반',parents:'부모님 동반'};
const groups=[['companion_fit','Companion'],['month_fit','Month']];
const labelName=(key)=>key.replaceAll('_',' ');
const groupFor=(key)=>key.startsWith('month')?'월별 적합도':key.includes('companion')?'동행자 적합도':'라벨';
const state={selected:DATA[0]?.contentid||null,query:''};
const $=(id)=>document.getElementById(id);
function value(a){return a.state==='not_applicable'?'N/A':String(a.value)}
function flat(record){return [...Object.entries(record.companion_fit||{}).map(([k,v])=>[k,v,'companion_fit']),...Object.entries(record.month_fit||{}).map(([k,v])=>[k,v,'month_fit'])]}
function renderList(){const q=state.query.toLocaleLowerCase('ko');const list=DATA.filter(p=>`${p.title} ${p.contentid}`.toLocaleLowerCase('ko').includes(q));$('stats').textContent=`직접 판정 장소 ${DATA.length}곳 · 검색 결과 ${list.length}곳`;$('places').replaceChildren(...list.map(p=>{const b=document.createElement('button');b.className='place'+(p.contentid===state.selected?' active':'');b.innerHTML=`<strong>${p.title}</strong><span>${p.contentid} · ${p.source_place?.contenttypeid||''}</span>`;b.onclick=()=>{state.selected=p.contentid;renderList();renderMain()};return b}))}
function renderCards(title,items){const section=document.createElement('section');section.className='group';section.innerHTML=`<h3>${title}</h3>`;const grid=document.createElement('div');grid.className='grid';for(const [key,a,type] of items){const card=document.createElement('article');card.className='label';const status=a.state==='not_applicable'?'N/A':a.status==='ai_draft'?'AI 초안':a.status;card.innerHTML=`<div class="label-head"><span class="label-name">${type==='month_fit'?key+'월':names[key]||labelName(key)}</span><span class="score">${value(a)}</span></div><div class="meta"><span class="pill">${status}</span><span class="pill">신뢰도 ${a.confidence??'미기록'}</span><span class="pill">${a.inference_level||''}</span></div><p class="rationale">${a.rationale||a.null_reason||'사유 미기록'}</p><div class="evidence">근거: ${(a.evidence_ids||[]).join(', ')}</div>`;grid.append(card)}section.append(grid);return section}
function renderMain(){const p=DATA.find(x=>x.contentid===state.selected);if(!p){$('main').innerHTML='<div class="empty">검색 결과가 없습니다.</div>';return}const main=$('main');main.replaceChildren();const hero=document.createElement('div');hero.className='hero';hero.innerHTML=`<div><h2>${p.title}</h2><p>contentid ${p.contentid} · contenttypeid ${p.source_place?.contenttypeid||''} · ${p.source_place?.lclsSystm2||''}</p></div><span class="badge">5단계 재판정 · AI 초안</span>`;main.append(hero);const notice=document.createElement('div');notice.className='notice';notice.textContent='이 화면은 현재까지 생성된 5단계 재판정 batch만 보여줍니다. 기존 운영 라벨과 SQLite에는 아직 반영되지 않았습니다.';main.append(notice);main.append(renderCards('Companion · 동행자 적합도',Object.entries(p.companion_fit||{}).map(([k,v])=>[k,v,'companion_fit'])));main.append(renderCards('Month · 월별 적합도',Object.entries(p.month_fit||{}).map(([k,v])=>[k,v,'month_fit'])))}
$('search').oninput=(e)=>{state.query=e.target.value;renderList()};renderList();renderMain();
</script>
</body></html>'''.replace('__PAYLOAD__', payload)
OUT.write_text(html, encoding="utf-8")
print(f"viewer: {len(data)} places -> {OUT}")
