"""Independent retained-evidence checks and compact run receipts."""
from pathlib import Path
import argparse,gzip,hashlib,json,math
root=Path(__file__).parent; reports=root/'reports'
studies={'pilot-v1':(128,300),'pursuit-heldout-v1':(384,300),'motion-pilot-v1':(48,150),'motion-gain10-pilot-v1':(64,150)}
receipts={};total=0;steps=0
prior=json.loads((reports/'verification.json').read_text()) if (reports/'verification.json').exists() else {}
for name,(count,ticks) in studies.items():
 path=reports/(name+'.json.gz');d=json.loads(gzip.decompress(path.read_bytes()));trials=d['trials']
 assert d['complete'] and len(trials)==count
 assert len({(t['id'],t['condition']) for t in trials})==count
 assert set(t['condition'] for t in trials)==set(d['conditions'])
 for t in trials:
  trace=t['trace'];assert len(trace)==ticks
  assert abs(trace[-1]['time']-ticks*.02)<1e-8
  assert all(abs(r['time']-(i+1)*.02)<1e-8 for i,r in enumerate(trace))
  assert all(len(r['cameraPose'])==7 and all(math.isfinite(v) for v in r['cameraPose']) for r in trace)
  assert len(t['id'])<=40
  if 'unsafeForward' in t:assert t['unsafeForward']==sum((not r['visible'] or not r['fresh']) and r['command'][0]>0 for r in trace)
 job=reports/(name+'.jsonl')
 if job.exists():
  events=[json.loads(s) for s in job.read_text().splitlines()]
  assert [r['data'] for r in events if r['event']=='trial']==trials
 else:
  saved=prior['studies'][name];assert saved['sha256']==hashlib.sha256(path.read_bytes()).hexdigest();events=saved['events']
 receipts[name]={'trials':count,'motorTicks':count*ticks,'falls':sum(t['fallen'] for t in trials),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'events':[e for e in events if e['event']!='trial']}
 total+=count;steps+=count*ticks
parser=argparse.ArgumentParser();parser.add_argument('--mac-assets',type=Path);args=parser.parse_args();assets=args.mac_assets
local=root.parent.parent/'web/dist/assets'
for name in (['index-CODtnlZL.js','index-B_P9AJdR.css','lab.worker-BHhtWCca.js'] if assets else []):
 assert (local/name).read_bytes()==(assets/name).read_bytes(), 'Production app changed: '+name
result={'completeTrials':total,'motorTicks':steps,'simulatedSeconds':steps*.02,'sameInstalledMacBundles':True if assets else None,'checks':'Unique paired cases; complete 20 ms traces; raw/gzip equality; camera poses finite; gate metric recomputed; unchanged release bundles.','studies':receipts}
(reports/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='studies'},indent=2))
smoke=reports/'smoke.json'
if smoke.exists():(reports/'smoke.json.gz').write_bytes(gzip.compress(smoke.read_bytes(),mtime=0))
