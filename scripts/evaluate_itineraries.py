#!/usr/bin/env python3
"""Offline real-place sample audit. Routes/proposals are synthetic, never API quality evidence."""
from __future__ import annotations
import argparse
import itertools
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'server/travel-feedback'))
from itinerary_validation import choose_duration, validate_day

# This is the current ranker's real daily assignment, not a Top-N fixture.
RANK_SCRIPT = r'''
const fs=require('fs'),vm=require('vm'),C=require('./map-ui/ccu-mmr.js');
const box={window:{}};vm.runInNewContext(fs.readFileSync('map-ui/data/jeju-places.js','utf8'),box);
const places=box.window.JEJU_PLACES.map(p=>({...p,recommendationReady:!!(p.v5&&p.fit),
 atomicFeatures:Object.fromEntries((p.v5?.labels||[]).filter(r=>!r.label.startsWith('derived')).map(r=>[r.label.split('.').pop(),r.value])),
 companionScores:Object.fromEntries((p.fit?.companion||[]).map(r=>[r.key,r.value])),
 monthScores:Object.fromEntries((p.fit?.month||[]).map(r=>[r.key,r.value]))}));
const result=C.rank(places,{intent:'visit',transportMode:'car',companionType:'friends',
 travelWindow:{startDate:'2026-10-01',endDate:'2026-10-04'},
 preferences:[{feature:'ocean',mode:'benefit',weight:4}]},{variantId:'seed-rank-1'});
console.log(JSON.stringify({places:places.map(p=>({placeId:p.id,title:p.title,lng:p.lng,lat:p.lat,primaryType:p.primaryType})),days:result.schedule.dayClusters}));
'''

def km(a,b):
    p,q=math.radians(a['lat']),math.radians(b['lat'])
    lat=p-q; lng=math.radians(a['lng']-b['lng'])
    return 6371*2*math.asin(min(1,math.sqrt(math.sin(lat/2)**2+math.cos(p)*math.cos(q)*math.sin(lng/2)**2)))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    data=json.loads(subprocess.check_output(['node','-e',RANK_SCRIPT],cwd=ROOT,text=True))
    policy=json.loads((ROOT/'server/travel-feedback/itinerary_policy.json').read_text())
    places={p['placeId']:p for p in data['places']}
    report={'mode':'offline_synthetic_proposals_and_routes_with_real_dayClusters',
      'liveApiVerified':False,'routeQualityVerified':False,
      'qualityGate': {'version': 'spec083-quality-gate-20260924', 'status': 'not_evaluated',
        'criteriaSource': 'docs/spec_083.md#itinerary-quality-gate',
        'reason': '모의 경로·고정 시간표는 실제 생성 성공률·장소 보존·이동·지연·비용의 합격 증거가 아닙니다.',
        'pendingMetrics': ['tripSuccessRate', 'mandatoryRetention', 'weightedPlaceRetention',
          'matchedPlaceRouteRatio', 'dailyLatencyP95', 'sevenDayLatencyP95', 'costPerCompletedDayUsd',
          'falseSuccessCount', 'fabricatedEvidenceCount', 'missingUnknownCount', 'expectedFailureAccuracy']},
      'limitations':['운영정보와 리뷰 분석 미수집 상태를 그대로 검사합니다.',
       '이동 10분은 테스트용 고정값이며 실제 도로 이동시간이 아닙니다.',
       '왕복 지표는 직선거리 진단이며 도로 최적성이나 실제 LLM 품질을 뜻하지 않습니다.'], 'days':[]}
    for cluster in data['days']:
        day={key:cluster[key] for key in ('dayIndex','date','placeIds','requiredPlaceIds','anchorPlaceId')}
        ids=day['placeIds']; selected=ids[:4]
        mandatory=set(day['requiredPlaceIds'])|{day['anchorPlaceId']}
        assert mandatory<=set(selected)
        day.update(startLocation={'placeId':selected[0]},endLocation={'placeId':selected[-1]},startTime='08:00',endTime='21:00')
        stops=[]; durations=[]
        for pid,start in zip(selected,('08:10','10:30','14:30','16:50')):
            dwell=choose_duration(places[pid],day['date'],policy)
            # Unknown long/session visits deliberately remain unknown, not certified by 120.
            minutes=dwell['minutes'] or 120
            total=int(start[:2])*60+int(start[3:])+minutes
            stops.append({'placeId':pid,'arrival':start,'departure':f'{total//60:02}:{total%60:02}','evidenceReviewIds':[]})
        for pid in ids:
            dwell=choose_duration(places[pid],day['date'],policy)
            durations.append({'placeId':pid,'title':places[pid]['title'],'primaryType':places[pid]['primaryType'],**dwell})
        proposal={'stops':stops,'mealSlots':[{'kind':'lunch','start':'12:50','end':'13:50'},
          {'kind':'dinner','start':'19:00','end':'20:00'}],
          'unscheduledPlaces':[{'placeId':pid,'reason':'모의 표본은 식사·체류 여유를 보존하기 위해 4곳까지만 배정'} for pid in ids if pid not in selected]}
        def route(a,b,departure):
            seconds=0 if a==b else 600
            return {'durationSeconds':seconds,'provider':'fixture_only','routeRef':f'fixture:{a}:{b}',
              'queriedAt':'2026-09-22T00:00:00+09:00','predictionBasis':'synthetic_fixture', 'path':[]}
        result=validate_day(day,proposal,places,route,policy['mealPreferences'],policy)
        assert not result['violations'], result['violations']
        assert result['status']!='validated' and result['unknowns']
        assert len(result['mealSlots'])==2 and all(s['durationMinutes']==60 for s in result['mealSlots'])
        assert len(result['stops'])+len(result['unscheduledPlaces'])==len(ids)
        def length(order): return sum(km(places[a],places[b]) for a,b in zip(order,order[1:]))
        # Enumerating four sample points is a diagnostic reference, never a production planner.
        observed=length(selected)
        optimum=min(length([selected[0],*middle,selected[-1]]) for middle in itertools.permutations(selected[1:-1]))
        ratio=observed/optimum if optimum else 1
        report['days'].append({'dayIndex':day['dayIndex'],'candidateCount':len(ids),'status':result['status'],
          'dwellAudit':durations,'meals':[{k:m[k] for k in ('kind','start','end','durationMinutes','maxDetourMinutes')} for m in result['mealSlots']],
          'scheduledCount':len(result['stops']),'unscheduledPlaces':result['unscheduledPlaces'],
          'unknownCount':len(result['unknowns']),'violations':result['violations'],
          'chordDistanceKm':round(observed,2),'chordOrderRatio':round(ratio,2),'backtrackingReviewNeeded':ratio>1.3})
    report['candidateCount']=sum(day['candidateCount'] for day in report['days'])
    assert report['candidateCount']==24
    rendered=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.output: args.output.write_text(rendered)
    print(json.dumps({'candidateCount':report['candidateCount'],'days':len(report['days']),
      'scheduled':sum(d['scheduledCount'] for d in report['days']),
      'unknownDwell':sum(p['basis']=='unknown' for d in report['days'] for p in d['dwellAudit']),
      'backtrackingFlags':sum(d['backtrackingReviewNeeded'] for d in report['days']),
      'hardViolations':0,'liveApiVerified':False,'qualityGateStatus':report['qualityGate']['status']},ensure_ascii=False))

if __name__=='__main__': main()
