import json, glob
seen = {}; order=[]
for f in sorted(glob.glob(r'data/labeling/jeju/2026-08-09/place-fit-relabel-v2/batches/test_direct_*.jsonl')):
    for line in open(f, encoding='utf8'):
        x=json.loads(line); cid=str(x['contentid'])
        if cid not in seen: seen[cid]=x; order.append(cid)
print('unique',len(order))
for i,cid in enumerate(order[:45]):
    x=seen[cid]; print(i,cid,x.get('title'))
