"""Fixed ridge decoder; whole trajectories separated before model fitting."""
import gzip, hashlib, json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent
data={s:json.load(gzip.open(ROOT/f'reports/features-{s}.json.gz')) for s in ['train','validation']}
def arrays(split,kind,reverse=False):
    xs=[];ys=[]
    for t in data[split]['trials']:
        frames=t['frames'];x=[f[kind] for f in frames]
        xs.extend(x[::-1] if reverse else x);ys.extend(f['target'] for f in frames)
    return np.array(xs),np.array(ys)
result={};models={}
for kind in ['raw','flyvis']:
    x,y=arrays('train',kind);mean=x.mean(0);std=np.maximum(x.std(0),1e-5)
    design=np.c_[(x-mean)/std,np.ones(len(x))]
    regularizer=np.eye(65)*10;regularizer[-1,-1]=0
    weights=np.linalg.solve(design.T@design+regularizer,design.T@y)
    models[kind]={'mean':mean.tolist(),'std':std.tolist(),'weights':weights.tolist(),'ridge':10}
    for control in ['aligned','reverse-time','shuffled']:
        v,truth=arrays('validation',kind,reverse=control=='reverse-time')
        if control=='shuffled':v=v[np.random.default_rng(6129).permutation(len(v))]
        prediction=np.c_[(v-mean)/std,np.ones(len(v))]@weights
        per_frame=((prediction-truth)**2).mean(1)
        result[f'{kind}/{control}']={'mse':float(per_frame.mean()),'frames':len(v),'visibilityMAE':float(np.abs(prediction[:,0]-truth[:,0]).mean()),'visibleBearingMAE':float(np.abs(prediction[truth[:,0]>0,1]-truth[truth[:,0]>0,1]).mean())}
raw=result['raw/aligned']['mse'];fly=result['flyvis/aligned']['mse']
report={'format':'duckfly-flyvis-decoder-gate','version':1,'method':'64 features, two outputs, identical ridge=10; no validation tuning; whole-trajectory train/validation split','results':result,'relativeImprovement':1-fly/raw,'gate':fly<=raw*.9 and fly<result['flyvis/shuffled']['mse'] and fly<result['flyvis/reverse-time']['mse'],'biologicalValidation':False,'closedLoopValidation':False,'models':models,'sources':{s:hashlib.sha256((ROOT/f'reports/features-{s}.json.gz').read_bytes()).hexdigest() for s in data}}
(ROOT/'reports/decoder.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['models','sources']},indent=2))
