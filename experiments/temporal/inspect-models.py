"""Retain diagnostics and a compact visual replay of measured validation inputs."""
import base64, gzip, hashlib, json
from pathlib import Path
import numpy as np
import torch
from train import ROOT, load, examples, evaluate

def load_model(mode):
    artifact = json.loads((ROOT / f'models/v1/{mode}.json').read_text())
    model = torch.nn.Sequential(torch.nn.Linear(1320, 64), torch.nn.ReLU(), torch.nn.Linear(64, 32), torch.nn.ReLU(), torch.nn.Linear(32, 1))
    with torch.no_grad():
        for index, layer in zip([0, 2, 4], artifact['layers']):
            model[index].weight.copy_(torch.tensor(layer['weights'])); model[index].bias.copy_(torch.tensor(layer['bias']))
    return model

if __name__ == '__main__':
    data = load(ROOT / 'reports/temporal-validation-v1.json.gz')
    scores = {}; diagnostics = {}
    for mode in ['temporal', 'static', 'no-pose']:
        model = load_model(mode)
        x, _, _, _ = examples(data, mode)
        with torch.no_grad(): scores[mode] = model(x).sigmoid().squeeze(-1).numpy()
    full = load_model('temporal')
    for mode in ['temporal', 'wrong-pose', 'reverse-time']:
        diagnostics[mode] = evaluate(full, data, mode, selected=.98)[0]
    (ROOT / 'reports/full-model-diagnostic.json').write_text(json.dumps({'status': 'Failed-model diagnostic, fixed threshold 0.98, not eligible for promotion', 'conditions': diagnostics}, indent=2) + '\n')
    rows = []; offset = 0
    for trial in data['trials']:
        fs = []
        for f in trial['frames']:
            if f['contact'] or f['fallen']: break
            fs.append({'time': f['time'], 'truth': f['risk'], 'retina': [round(v, 3) for v in f['snapshot'][:256]],
                       'speed': f['snapshot'][261] * .3, 'scores': {mode: float(p[offset]) for mode, p in scores.items()}})
            offset += 1
        rows.append({'id': trial['id'], 'family': trial['family'], 'frames': fs})
    assert offset == len(scores['temporal'])
    payload = {'validation': json.loads((ROOT / 'models/v1/validation.json').read_text()), 'diagnostics': diagnostics,
               'sourceSha256': hashlib.sha256((ROOT / 'reports/temporal-validation-v1.json.gz').read_bytes()).hexdigest(), 'trials': rows}
    (ROOT / 'reports/replay-data.json.gz').write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), mtime=0))
    template = (ROOT / 'replay-template.html').read_text()
    embedded = json.dumps(payload, separators=(',', ':')).replace('<', '\\u003c')
    physical = ''
    if (ROOT / 'reports/physical-summary.json').exists():
        summary = json.loads((ROOT / 'reports/physical-summary.json').read_text())
        baseline = round(summary['summaries']['motion']['hazards']['contact'] * 64)
        candidate = round(summary['summaries']['temporal-hazard']['hazards']['contact'] * 64)
        stops = round(summary['summaries']['temporal-hazard']['controls']['gf'] * 64)
        images = ''.join('<img style="max-width:100%;height:auto;margin-top:18px" alt="' + label + '" src="data:image/png;base64,' + base64.b64encode((ROOT / 'reports' / filename).read_bytes()).decode() + '">' for filename, label in [('physical-results.png', 'Matched physical outcomes'), ('stop-resume-trace.png', 'Recorded stop and resume trace')])
        physical = f'<section><div class="row"><h2>The feedback loop prevents premature restarts</h2><span class="pill">Research prototype</span></div><p style="margin-bottom:12px">Contact trials fell from <strong>{baseline}/64 to {candidate}/64</strong> in potential-hazard scenes. The same decoder with the old timer had 14/64 contact trials. The prototype still fails the false-stop gate: GF events occurred in <strong>{stops}/64 control scenes</strong>. It is not enabled in the app.</p><details><summary style="cursor:pointer;color:#8fe2c0">See the matched outcomes and stop/resume trace</summary>{images}<p><small>768 matched five-second trials. The documented capture-cadence deviation applies. Ten control stops followed visual pulses; two were GF events without a decoder pulse.</small></p></details></section>'
    (ROOT / 'replay.html').write_text(template.replace('/*__EVIDENCE__*/null', embedded).replace('<!--__PHYSICAL__-->', physical))
    print(json.dumps({k: {'auroc': round(v['auroc'], 4), 'timely': v['selected']['timelyDetection'], 'falseTrigger': v['selected']['falseTrigger']} for k, v in diagnostics.items()}, indent=2))
