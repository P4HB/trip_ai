"use strict";
// Read-only investigation: load historical modules into isolated VMs; no product files changed.
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const historical = (ref, file) => cp.execFileSync('git', ['show', `${ref}:${file}`], {encoding:'utf8', maxBuffer:80*1024*1024});
function engine(text) { const box={module:{exports:{}}}; vm.runInNewContext(text,box); return box.module.exports; }
function rawData(text) { const box={window:{}}; vm.runInNewContext(text,box); return box.window.JEJU_PLACES; }
const old = engine(historical('7270b2a^','map-ui/ccu-mmr.js'));
const now = require(path.join(root,'map-ui/ccu-mmr.js'));
const pref = require(path.join(root,'map-ui/preference-elicitation.js'));
const raw = rawData(fs.readFileSync('map-ui/data/jeju-places.js','utf8'));
const rawOld = rawData(historical('7270b2a^','map-ui/data/jeju-places.js'));
const normalizeData=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['primaryType','primaryTypeLabel'].includes(k)));
const dataEqual=JSON.stringify(raw.map(normalizeData))===JSON.stringify(rawOld.map(normalizeData));
const places=raw.map(p=>{
 const atomicFeatures=Object.fromEntries((p.v5?.labels||[]).filter(r=>['theme.','environment.','style_evidence.'].some(prefix=>r.label.startsWith(prefix))).filter(r=>Number.isFinite(r.value)).map(r=>[r.label.split('.').at(-1),r.value]));
 const scores=rows=>Object.fromEntries((rows||[]).map(r=>[r.key,r.state==='numeric'?r.value:null]));
 return {...p,atomicFeatures,companionScores:scores(p.fit?.companion),monthScores:scores(p.fit?.month),recommendationReady:!!(p.v5&&p.fit&&now.ATOMIC_FEATURES.every(k=>Number.isFinite(atomicFeatures[k])))};
});
const byId=new Map(places.map(p=>[p.id,p]));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
function metrics(r) {
 const rows=r.schedule.dayClusters.flatMap(d=>d.places);
 return {count:rows.length,meanRelevance:mean(rows.map(p=>p.relevance)),meanDistance:mean(rows.map(p=>p.distanceKm)),preferredCount:rows.filter(p=>p.variantPreferred).length,emptySlots:r.schedule.dayClusters.reduce((s,d)=>s+d.remainingCapacity,0),typeCount:mean(r.schedule.dayClusters.map(d=>new Set(d.places.map(p=>byId.get(p.placeId).primaryType)).size)),dayCounts:r.schedule.dayClusters.map(d=>d.usedCapacity)};
}
function detail(r) {return r.schedule.dayClusters.map(d=>({day:d.dayIndex,center:d.center,places:d.places.map(p=>({id:p.placeId,title:p.title,type:byId.get(p.placeId).primaryTypeLabel,relevance:p.relevance,distanceKm:p.distanceKm,preferred:p.variantPreferred,indoor:byId.get(p.placeId).atomicFeatures.indoor_ratio,weather:byId.get(p.placeId).atomicFeatures.weather_sensitivity}))}));}
const profiles=[];
for(const energy of [1,-1]) for(const environment of [1,-1]) for(const discovery of [1,-1]) {
 const axis={energy,environment,discovery};
 const answers=pref.QUESTIONS.map(q=>({questionId:q.id,optionId:q.options.find(o=>o.axisValue===axis[q.axisId]).id}));
 const profile=pref.estimateProfile(answers,[]);
 profiles.push({name:profile.displaySummary.archetypeId,request:{schemaVersion:now.PERSONALIZED_REQUEST_SCHEMA_VERSION,preferenceProfile:profile,preferences:pref.materializePreferences(profile)}});
}
for(const feature of ['ocean','mountain','restfulness','indoor_ratio']) profiles.push({name:feature,request:{preferences:[{feature,mode:'benefit',weight:4}]}});
const rows=[];
for(const profile of profiles) for(const transportMode of ['car','no_car']) for(const days of [1,2,3]) for(const month of [1,9]) for(const seed of [1,2,3]) {
 const m=String(month).padStart(2,'0');
 const request={...profile.request,intent:'visit',companionType:'friends',transportMode,travelWindow:{startDate:`2026-${m}-15`,endDate:`2026-${m}-${14+days}`},resultCount:10,diversity:'balanced'};
 const runtime={variantId:`seed-rank-${seed}`};
 const a=old.rank(places,request,runtime),b=now.rank(places,request,runtime);
 const ma=metrics(a),mb=metrics(b),oldIds=new Set(a.schedule.dayClusters.flatMap(d=>d.placeIds)),newIds=new Set(b.schedule.dayClusters.flatMap(d=>d.placeIds));
 const replaced=[...oldIds].filter(id=>!newIds.has(id)).length;
 rows.push({profile:profile.name,transportMode,days,month,seed,rankingIdentical:JSON.stringify(a.items)===JSON.stringify(b.items),anchorsIdentical:JSON.stringify(a.schedule.autoAnchorIds)===JSON.stringify(b.schedule.autoAnchorIds),before:ma,after:mb,deltaRelevance:mb.meanRelevance-ma.meanRelevance,replaced,beforeDays:detail(a),afterDays:detail(b)});
}
function summary(rs) {return {scenarios:rs.length,rankingIdentical:rs.filter(r=>r.rankingIdentical).length,anchorsIdentical:rs.filter(r=>r.anchorsIdentical).length,scheduleChanged:rs.filter(r=>r.replaced>0||r.before.count!==r.after.count).length,meanBeforeRelevance:mean(rs.map(r=>r.before.meanRelevance)),meanAfterRelevance:mean(rs.map(r=>r.after.meanRelevance)),lowerMeanRelevance:rs.filter(r=>r.deltaRelevance<-1e-10).length,higherMeanRelevance:rs.filter(r=>r.deltaRelevance>1e-10).length,meanBeforeTypeCount:mean(rs.map(r=>r.before.typeCount)),meanAfterTypeCount:mean(rs.map(r=>r.after.typeCount)),fewerPlaces:rs.filter(r=>r.before.count>r.after.count).length,meanBeforeCount:mean(rs.map(r=>r.before.count)),meanAfterCount:mean(rs.map(r=>r.after.count)),meanBeforePreferred:mean(rs.map(r=>r.before.preferredCount)),meanAfterPreferred:mean(rs.map(r=>r.after.preferredCount)),meanBeforeDistance:mean(rs.map(r=>r.before.meanDistance)),meanAfterDistance:mean(rs.map(r=>r.after.meanDistance))};}
const result={baseline:'7270b2a^',current:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dataEqualExceptPrimaryType:dataEqual,places:places.length,recommendationReady:places.filter(p=>p.recommendationReady).length,summary:summary(rows),byProfile:Object.fromEntries(profiles.map(p=>[p.name,summary(rows.filter(r=>r.profile===p.name))])),mbtiSummary:summary(rows.filter(r=>!['ocean','mountain','restfulness','indoor_ratio'].includes(r.profile))),rows};
fs.writeFileSync(path.join(__dirname,'comparison.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:undefined},null,2));
console.log('Largest relevance drops:',JSON.stringify([...rows].sort((a,b)=>a.deltaRelevance-b.deltaRelevance).slice(0,3)));
