import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'data/labeling/jeju/2026-08-09'; OUT=BASE/'place-fit-relabel-v2'; OK={0,.25,.5,.75,1}; COMP={'solo','couple','friends','kids','parents'}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output',default=str(OUT)); out=Path(ap.parse_args().output)
    rows=[json.loads(x) for x in (out/'place_fit_labels.jsonl').read_text(encoding='utf-8').splitlines() if x.strip()]; non=json.loads((BASE/'non_restaurants.json').read_text(encoding='utf-8')); rest=[x for x in json.loads((BASE/'restaurants.json').read_text(encoding='utf-8')) if x.get('lclsSystm2')=='FD05']; places=non+rest
    assert len(rows)==len(places)==1664; assert [r['contentid'] for r in rows]==[p['contentid'] for p in places]; assert len({r['contentid'] for r in rows})==1664
    n=0
    for r in rows:
        assert set(r['companion_fit'])==COMP and set(r['month_fit'])=={str(i) for i in range(1,13)}
        for g in (r['companion_fit'],r['month_fit']):
            for a in g.values():
                n+=1; assert a['status']=='ai_draft' and a['rationale'] and a['evidence_ids'] and a['rule_ids'] and 0<=a['confidence']<=1
                if a['state']=='numeric': assert a['value'] in OK
                else: assert a['state']=='not_applicable' and a['value'] is None and a['inference_level'] in ('not_applicable','unknown') and 'DATE-GATE' in a['rule_ids'][0]
                if a['value'] in (0,1): assert a['inference_level'] in ('direct_evidence','researched_inference','climate_heuristic','unknown')
    assert n==28288; man=json.loads((out/'manifest.json').read_text(encoding='utf-8')); assert man['output_sha256']==sha(out/'place_fit_labels.jsonl'); assert man['counts']['axis_count']==n
    for rel,digest in man['inputs_sha256'].items(): assert sha(ROOT/rel)==digest, f'input hash mismatch: {rel}'
    print(f'VALID: {len(rows)} places, {n} axes, IDs/order/schema/provenance checked')
if __name__=='__main__':
    try: main()
    except Exception as e: print('INVALID:',e); sys.exit(1)
