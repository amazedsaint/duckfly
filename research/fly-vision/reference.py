"""Pinned Flyvis oracle. Exports the full sparse graph and continuation fixtures.

No fitting, pruning or stepping changes. Run through run-reference.sh.
"""
from pathlib import Path
import hashlib, json, os, time, gzip
os.environ['PYTHON_DOTENV_DISABLED']='1'
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
os.environ['FLYVIS_ROOT_DIR']=str(HERE/'.cache/reference')
import numpy as np
import torch
import flyvis
DT=.002
OUT=HERE/'artifacts';OUT.mkdir(exist_ok=True)
torch.set_num_threads(1)
print('Loading verified published checkpoint',flush=True)
view=flyvis.NetworkView(flyvis.results_dir/'flow/0000/000')
network=view.init_network()
source_checkpoint=view.dir.path/'best_chkpt'
published=torch.load(source_checkpoint,map_location='cpu',weights_only=True)['network']
assert all(torch.equal(network.state_dict()[k].cpu(),v.cpu()) for k,v in published.items()), 'Loaded checkpoint differs from published weights'
network.eval();network.clamp()
params=network._param_api()
print('Network',network.n_nodes,len(network._source_indices),flush=True)
def array(v,dtype='<f4'):
    if hasattr(v,'detach'):v=v.detach().cpu().numpy()
    return np.asarray(v,dtype=dtype)
arrays={
 'source':array(network._source_indices,'<u4'),
 'target':array(network._target_indices,'<u4'),
 'weight':array(params.edges.weight),
 'bias':array(params.nodes.bias),
 'timeConstant':array(params.nodes.time_const),
 'inputIndex':array(network.stimulus.input_index,'<u4').reshape(-1),
}
nodes=network.connectome.nodes
types=nodes.type[:].astype(str).tolist()
u=nodes.u[:].astype(int);v=nodes.v[:].astype(int)
coordinates=[[int(u[i]),int(v[i])] for i in network.stimulus.input_index[0]]
readouts={t:[i for i,x in enumerate(types) if x==t] for t in ['T4a','T4b','T4c','T4d','T5a','T5b','T5c','T5d']}
metadata={
 'format':'duckfly-flyvis-sparse','version':1,'sourceCommit':'92b3845cc426dd309a1a0e1b3890156c42e14021',
 'checkpoint':'flow/0000/000/best_chkpt','checkpointSha256':hashlib.sha256(source_checkpoint.read_bytes()).hexdigest(),
 'loadedCheckpoint':str(Path(view.get_checkpoint()).relative_to(flyvis.results_dir)),
 'loadedCheckpointSha256':hashlib.sha256(Path(view.get_checkpoint()).read_bytes()).hexdigest(),'publishedWeightsEqual':True,
 'archiveSha256':'71c78d4070556a536b13b23ee3139cd2788aa2a9d07d430a223b4edead281db1',
 'nodes':network.n_nodes,'edges':len(arrays['source']),'dt':DT,'fadeInSeconds':1,'activityUnits':'model continuous activity; not spikes or calcium',
 'inputCoordinates':coordinates,'readouts':readouts,'readoutCoordinates':{t:[[int(u[i]),int(v[i])] for i in idx] for t,idx in readouts.items()},
 'arrays':{},'validation':{'numericalParity':False,'physiologicalReproduction':False,'bodyBridge':False},
}
with torch.no_grad():
    # Exact upstream fade-in API, from gray to the first gray image, 1 second at 500 Hz.
    state=network.fade_in_state(1,DT,torch.full((1,1,721),.5))
    arrays['steadyState']=array(state.nodes.activity[0])
    x=torch.zeros((1,network.n_nodes));fixture_inputs=[];states=[];costs=[]
    for step in range(1000):
        # Fixed structured pattern, polarity reversal and lateral drift, then gray.
        stimulus=np.array([.5+.4*np.sin((a*.4+step*.12))*np.cos(b*.3) if step<80 else .5 for a,b in coordinates],dtype=np.float32)
        x.zero_();x[:,network.stimulus.input_index]=torch.from_numpy(stimulus)
        start=time.perf_counter();state=network._next_state(params,state,x,DT);costs.append((time.perf_counter()-start)*1000)
        fixture_inputs.append(stimulus)
        if step<120 or step in [499,999]:states.append(array(state.nodes.activity[0]).copy())
    arrays['fixtureInput']=np.stack(fixture_inputs).reshape(-1)
    arrays['fixtureState']=np.stack(states).reshape(-1)
    arrays['fixtureTicks']=np.array([*range(120),499,999],dtype='<u4')
    # Independently initialize each direction/polarity presentation. This is a tuning
    # probe; comparison to measured physiology needs a separate observation model.
    tuning=[]
    for polarity in [-1,1]:
      for direction in [0,90,180,270]:
        angle=np.deg2rad(direction);projection=u*np.cos(angle)+v*np.sin(angle)
        state=network.fade_in_state(1,DT,torch.full((1,1,721),.5))
        baseline=array(state.nodes.activity[0]).copy();peaks={t:0. for t in readouts}
        for step in range(300):
          cut=-14+28*step/299
          values=np.array([.5+polarity*.4 if a*np.cos(angle)+b*np.sin(angle)<cut else .5 for a,b in coordinates],dtype=np.float32)
          x.zero_();x[:,network.stimulus.input_index]=torch.from_numpy(values)
          state=network._next_state(params,state,x,DT)
          activity=array(state.nodes.activity[0])
          for t,idx in readouts.items():
            central=[i for i in idx if abs(u[i])<=3 and abs(v[i])<=3]
            peaks[t]=max(peaks[t],float(np.maximum(activity[central]-baseline[central],0).mean()))
        tuning.append({'polarity':polarity,'directionDegrees':direction,'peaks':peaks})
        print('Tuning',polarity,direction,flush=True)
    metadata['referenceTimingMs']={'median':float(np.median(costs)),'p95':float(np.percentile(costs,95)),'threads':1}
    metadata['tuning']=tuning
for name,a in arrays.items():
    data=a.tobytes();filename=f'{name}.bin.gz';(OUT/filename).write_bytes(gzip.compress(data,mtime=0))
    metadata['arrays'][name]={'file':filename,'dtype':a.dtype.str,'length':a.size,'sha256':hashlib.sha256(data).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps({'nodes':metadata['nodes'],'edges':metadata['edges'],'timing':metadata['referenceTimingMs'],'output':str(OUT)},indent=2),flush=True)
