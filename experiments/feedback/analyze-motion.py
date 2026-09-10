"""Paired rotation-study report. Positive deltas mean fewer false reflexes."""
import json,gzip,argparse,statistics,random
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('report');p.add_argument('--baseline',default='original');a=p.parse_args();path=Path(a.report)
d=json.loads(gzip.decompress(path.read_bytes()));assert d['complete'];ts=d['trials'];cs=d['conditions'];lookup={(t['id'],t['condition']):t for t in ts}
control=lambda t:t['family']!='approach'
def detection(t):return t['firstGF'] is not None and (t['firstContactAt'] is None or t['firstGF']<t['firstContactAt'])
def paired(baseline):
 groups=[[int(lookup[(t['id'],baseline)]['firstGF'] is not None)-int(t['firstGF'] is not None) for t in ts if t['condition']=='rotation' and t['family']==f] for f in ['scan','walking','lateral']]
 rng=random.Random(731097);boot=sorted(statistics.mean([rng.choice(v) for v in groups for _ in v]) for _ in range(2000))
 return {'baseline':baseline,'falseAlarmReduction':statistics.mean(sum(groups,[])),'ci95':[boot[49],boot[1949]]}
summary={c:{'trials':len(rows:=[t for t in ts if t['condition']==c]),'falls':sum(t['fallen'] for t in rows),'controlTrials':len(ctrl:=[t for t in rows if control(t)]),'falseGF':sum(t['firstGF'] is not None for t in ctrl),'approachTrials':len(app:=[t for t in rows if not control(t)]),'approachContacts':sum(t['firstContactAt'] is not None for t in app),'approachPreContactStops':sum(detection(t) for t in app),'families':{f:{'trials':len(frows:=[t for t in rows if t['family']==f]),'gfAlarms':sum(t['firstGF'] is not None for t in frows),'meanPeakLoom':statistics.mean(t['peakLoom'] for t in frows)} for f in ['scan','walking','approach','lateral']}} for c in cs}
comp=paired(a.baseline);inv=paired('inverted');matched=paired('original');r=summary['rotation'];b=summary[a.baseline];gates={'falseAlarmReduction':comp['falseAlarmReduction']>=.2,'falseAlarmCI':comp['ci95'][0]>0,'poseSpecificCI':inv['ci95'][0]>0,'matchedGainCI':matched['ci95'][0]>0,'approachContacts':r['approachContacts']<=b['approachContacts'],'approachDetection':r['approachPreContactStops']/r['approachTrials']>=b['approachPreContactStops']/b['approachTrials']-.05,'noExtraFalls':r['falls']<=b['falls']}
result={'split':d['split'],'summary':summary,'paired':[comp,inv,matched],'gates':gates,'physicalPromotion':all(gates.values()),'note':'Perceptual filtering cannot promote a controller that misses real approach stops.'}
path.with_name(path.name.split('.')[0]+'-summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
