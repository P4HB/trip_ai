"use strict";
const fs=require('node:fs'), vm=require('node:vm'), cp=require('node:child_process'),path=require('node:path');
process.chdir(path.resolve(__dirname,'../..'));
const C=require('../../map-ui/ccu-mmr.js');
const oldBox={module:{exports:{}}};
vm.runInNewContext(cp.execFileSync('git',['show','7270b2a^:map-ui/ccu-mmr.js'],{encoding:'utf8'}),oldBox);
const O=oldBox.module.exports;
const box={window:{}};
vm.runInNewContext(fs.readFileSync('map-ui/data/jeju-places.js','utf8'),box);
const places=box.window.JEJU_PLACES.map(p=>{
 const atomicFeatures=Object.fromEntries((p.v5?.labels||[]).filter(r=>['theme.','environment.','style_evidence.'].some(prefix=>r.label.startsWith(prefix))).map(r=>[r.label.split('.').at(-1),r.value]));
 const scores=rows=>Object.fromEntries((rows||[]).map(r=>[r.key,r.state==='numeric'?r.value:null]));
 return {...p,atomicFeatures,companionScores:scores(p.fit?.companion),monthScores:scores(p.fit?.month),recommendationReady:!!(p.v5&&p.fit&&C.ATOMIC_FEATURES.every(k=>Number.isFinite(atomicFeatures[k])))};
});
const base={intent:'visit',transportMode:'car',companionType:'friends',preferences:[{feature:'restfulness',mode:'benefit',weight:2}],travelWindow:{startDate:'2026-09-15',endDate:'2026-09-15'}};
const compact=r=>({status:r.schedule.status,requiredDays:r.schedule.requiredDayClusterCount,days:r.schedule.dayClusters.map(d=>({day:d.dayIndex,center:d.center,required:d.requiredPlaceIds,places:d.places.map(p=>p.title)})),violations:r.schedule.violations});
const beaches={};
for(const days of [1,2]) {
 const request={...base,requiredPlaceIds:['127490','591866'],travelWindow:{startDate:'2026-09-15',endDate:`2026-09-${14+days}`}};
 beaches[days]={before:compact(O.rank(places,request,{variantId:'seed-rank-1'})),after:compact(C.rank(places,request,{variantId:'seed-rank-1'}))};
}
const types=['garden','forest','museum_exhibition','cafe','park','viewpoint','coast_beach','coast_beach'];
const synthetic=types.map((primaryType,i)=>({id:String(i+1),title:String(i+1),type:'12',region:'jeju_city',sourceOrder:i,primaryType,lat:33.4+.0001*Math.cos(-3+i*.8),lng:126.5+.0001*Math.sin(-3+i*.8),recommendationReady:true,atomicFeatures:Object.fromEntries(C.ATOMIC_FEATURES.map(k=>[k,.8])),companionScores:{friends:.8},monthScores:{9:.8}}));
const req={...base,requiredPlaceIds:synthetic.map(p=>p.id),travelWindow:{startDate:'2026-09-15',endDate:'2026-09-16'}};
const alternatives=[['1','2','3','4','7'],['5','6','8']];
const alternativeValid=alternatives.every(ids=>ids.length<=6&&new Set(ids.map(id=>synthetic.find(p=>p.id===id).primaryType)).size===ids.length&&ids.every(id=>C.haversineKm({lat:33.4,lng:126.5},synthetic.find(p=>p.id===id))<=15));
const greedy={before:compact(O.rank(synthetic,req,{variantId:'seed-rank-1'})),after:compact(C.rank(synthetic,req,{variantId:'seed-rank-1'})),alternative:alternatives,alternativeValid};
const result={beachDistanceKm:C.haversineKm(places.find(p=>p.id==='127490'),places.find(p=>p.id==='591866')),beaches,greedy};
fs.writeFileSync(path.join(__dirname,'edge-cases.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
