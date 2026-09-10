"""Summarize paired physical trials, retaining falls and contact outcomes."""
import argparse, gzip, json, random, statistics
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('report');p.add_argument('--candidate',default='coordinated');p.add_argument('--ablation',default='no-pose');a=p.parse_args()
path=Path(a.report); data=json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_text())
assert data['complete'], 'Incomplete studies cannot be promoted'
trials=data['trials']; conditions=data['conditions']; families=sorted(set(t['family'] for t in trials))
mean=statistics.mean
lookup={(t['id'],t['condition']):t for t in trials}
def delta(candidate,baseline,metric='finalError'):
    pairs={f:[lookup[(t['id'],baseline)][metric]-t[metric] for t in trials if t['condition']==candidate and t['family']==f] for f in families}
    assert all(pairs.values())
    rng=random.Random(190319);boot=[]
    for _ in range(2000):
        boot.append(mean([rng.choice(v) for v in pairs.values() for _ in v]))
    boot.sort()
    return {'candidate':candidate,'baseline':baseline,'improvement':mean([v for row in pairs.values() for v in row]),'ci95':[boot[49],boot[1949]],'family':{f:mean(v) for f,v in pairs.items()}}
summary={c:{'trials':len(rows:=[t for t in trials if t['condition']==c]),'finalError':mean(t['finalError'] for t in rows),'lateError':mean(t['lateError'] for t in rows),'visibleFraction':mean(t['visibleFraction'] for t in rows),'headingError':mean(t['headingError'] for t in rows),'falls':sum(t['fallen'] for t in rows),'contactTrials':sum(t['contacts']>0 for t in rows),'unsafeTicks':sum(t['unsafeForward'] for t in rows)} for c in conditions}
pairs=[delta(c,'original') for c in conditions if c!='original']
causal=delta(a.candidate,a.ablation) if a.candidate in conditions and a.ablation in conditions else None
if a.candidate in summary:
    gain=delta(a.candidate,'original');c=summary[a.candidate];b=summary['original']
    gates={'effectSize':gain['improvement']>=.03,'positiveInterval':gain['ci95'][0]>0,'familyNonRegression':min(gain['family'].values())>=-.02,'noExtraFalls':c['falls']<=b['falls'],'contacts':c['contactTrials']/c['trials']-b['contactTrials']/b['trials']<=.05,'causalPose':causal is not None and causal['ci95'][0]>0,'forwardGate':c['unsafeTicks']==0}
else:gates={}
result={'split':data['split'],'summary':summary,'paired':pairs,'causal':causal,'gates':gates,'physicalPromotion':bool(gates) and all(gates.values()),'note':'Physical gates only; production requires guard and replay verification.'}
out=path.with_name(path.name.split('.')[0]+'-summary.json');out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
