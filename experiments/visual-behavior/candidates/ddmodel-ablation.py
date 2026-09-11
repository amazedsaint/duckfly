"""Mechanism check on published inputs, after baseline original-code equivalence.

Ablations are equation interventions, not neuron silencing. Their outputs are
not substitutes for an original-code oracle and do not validate physiology.
"""
from pathlib import Path
import importlib.util
import json
import hashlib
import numpy as np

HERE=Path(__file__).resolve().parent;REPORTS=HERE.parent/'reports'
spec=importlib.util.spec_from_file_location('dd_equations',HERE/'ddmodel-equations.py')
dd=importlib.util.module_from_spec(spec);spec.loader.exec_module(dd)
records=[]
for group in ['Fig4L_LocalFlickers','Fig4F_SizeTuning']:
    for name,samples in dd.load_epochs(HERE/'.cache/ddmodel/stimuli'/group):
        for variant in ['no-adaptation','no-surround']:
            result=dd.dd_response(dd.published_epoch(samples),adaptation=variant!='no-adaptation',surround=variant!='no-surround')['Rout']
            trace=result[10,10,:]
            records.append(dict(group=group,name=name,variant=variant,mean=float(trace.mean()),peak=float(trace.max()),trace=trace.tolist()))
            print(group,name,variant,float(trace.mean()),flush=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
report=dict(equationSourceSha256=sha(HERE/'ddmodel-equations.py'),ablationSourceSha256=sha(__file__),baselineOracleReceiptSha256=sha(REPORTS/'candidates-dd-original-code-parity.json'),
            interpretation='Independent equation interventions; baseline original-code numerical parity is established separately. No neuron or physiological ablation claim.',records=records)
(REPORTS/'candidates-dd-ablation.json').write_text(json.dumps(report)+'\n')
