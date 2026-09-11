"""Apply the frozen DD score/threshold to the additional real-renderer cohort."""
from pathlib import Path
import base64
import gzip
import hashlib
import importlib.util
import json
import time
import numpy as np

HERE=Path(__file__).resolve().parent
REPORTS=HERE.parent/'reports'
spec=importlib.util.spec_from_file_location('dd_transfer',HERE/'ddmodel-transfer.py')
transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
frozen=json.loads((REPORTS/'candidates-dd-transfer-frozen.json').read_text())
for name,expected in frozen['sources'].items():
    if sha(HERE/name)!=expected:raise ValueError('Frozen transfer source changed')
source=REPORTS/'candidates-arena-dd-v1.json.gz'
artifact=json.loads(gzip.decompress(source.read_bytes()))
threshold=frozen['threshold'];records=[];started=time.monotonic()
for item in artifact['records']:
    rgba=np.array([np.frombuffer(base64.b64decode(f['rgba']),np.uint8).reshape(64,96,4) for f in item['frames']])
    gray=(rgba[:,:,:,:3]*np.array([.299,.587,.114])).sum(axis=3)/255
    movie=dict(id=item['id'],family=item['family'],times=np.array([f['time'] for f in item['frames']]),gray=gray,source='actual-arena-dd-v1',inputSha256=sha(source))
    for condition in ['original','frozen','reversed']:
        r=transfer.run(movie,condition);records.append(r)
        print(r['id'],condition,r['score'],flush=True)
groups={}
times=np.arange(1800)/180
for r in records:
    key=f"{r['family']}/{r['condition']}"
    g=groups.setdefault(key,dict(movies=0,responses=0,scores=[],delays=[]))
    g['movies']+=1;g['responses']+=int(r['score']>=threshold);g['scores'].append(r['score'])
    hit=np.flatnonzero((times>=4.24)&(times<=5.8)&(np.array(r['trace'])-r['baseline']>=threshold))
    if len(hit):g['delays'].append(float(times[hit[0]]-4.24))
summary=dict(sourceArtifactSha256=sha(source),sourceHashes=frozen['sources'],threshold=threshold,
             analysisSha256=sha(__file__),groups=groups,elapsedSeconds=time.monotonic()-started,
             biologicalLC11=False,flyvisInputs=False,physicalUsefulness=False,productionPromotion=False,
             limitation='Posed camera and scene objects; frozen threshold transferred without recalibration. Camera motion may move a static target on retina; report separately from empty scene rotation.')
output=REPORTS/'candidates-dd-arena-screen-v1.json.gz'
output.write_bytes(gzip.compress(json.dumps(dict(summary=summary,records=records)).encode(),mtime=0))
summary['traceArtifactSha256']=sha(output)
(REPORTS/'candidates-dd-arena-screen-v1-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
