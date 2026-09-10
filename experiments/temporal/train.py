"""Fit frozen-capacity decoders on disjoint, recorded walking trajectories."""
import argparse, gzip, hashlib, json
from pathlib import Path
import numpy as np
import torch
from sklearn.metrics import roc_auc_score, average_precision_score

ROOT = Path(__file__).resolve().parent
SEED = 20260910
THRESHOLDS = [.6, .7, .8, .9, .95, .98]
torch.set_num_threads(4)
torch.use_deterministic_algorithms(True)

def load(path):
    data = json.loads(gzip.decompress(path.read_bytes()))
    assert data['complete'] and len(data['trials']) == data['expectedTrials']
    assert len({t['id'] for t in data['trials']}) == len(data['trials'])
    return data

def examples(data, mode):
    xs, ys, weights, groups = [], [], [], []
    for t in data['trials']:
        history, start = [], len(xs)
        contact = next((f['time'] for f in t['frames'] if f['contact'] or f['fallen']), None)
        for f in t['frames']:
            history.append(f['snapshot'])
            if contact is not None and f['time'] >= contact:
                continue
            last = len(history) - 1
            frames = np.array([history[max(0, last - (0 if mode == 'static' else k * 3))] for k in range(4, -1, -1)], dtype=np.float32)
            if mode == 'no-pose': frames[:, 256:261] = 0
            if mode == 'wrong-pose': frames[:, 256:261] *= -1
            if mode == 'reverse-time': frames = frames[::-1]
            xs.append(frames.reshape(-1)); ys.append(f['risk'])
        stop = len(xs)
        assert stop > start
        weights.extend([1 / (stop - start)] * (stop - start))
        groups.append({'id': t['id'], 'family': t['family'], 'start': start, 'stop': stop,
                       'times': [f['time'] for f in t['frames'] if contact is None or f['time'] < contact], 'contact': contact})
    w = np.array(weights, np.float32)
    w *= len(w) / w.sum()
    return torch.from_numpy(np.array(xs)), torch.from_numpy(np.array(ys, np.float32)), torch.from_numpy(w), groups

def trajectory_metrics(p, y, groups, threshold):
    rows = []
    for g in groups:
        a, b = g['start'], g['stop']; truth, pred = y[a:b], p[a:b]; times = np.array(g['times'])
        positive = np.flatnonzero(truth)
        hazard = bool(len(positive)); timely = False
        if hazard:
            onset = times[positive[0]]
            deadline = min(onset + .5, g['contact'] - .12 if g['contact'] is not None else float('inf'))
            timely = bool(np.any((pred >= threshold) & (times >= onset - .5 - 1e-8) & (times <= deadline + 1e-8)))
        rows.append({'id': g['id'], 'family': g['family'], 'hazard': hazard, 'trigger': bool(np.any(pred >= threshold)), 'timely': timely})
    hazards = [r for r in rows if r['hazard']]; harmless = [r for r in rows if not r['hazard']]
    return {'threshold': threshold, 'hazardTrajectories': len(hazards), 'harmlessTrajectories': len(harmless),
            'timelyDetection': sum(r['timely'] for r in hazards) / max(1, len(hazards)),
            'falseTrigger': sum(r['trigger'] for r in harmless) / max(1, len(harmless)), 'trajectories': rows}

def evaluate(model, data, mode, selected=None):
    x, y, w, groups = examples(data, mode)
    with torch.no_grad(): p = model(x).sigmoid().squeeze(-1).numpy()
    y = y.numpy()
    candidates = [trajectory_metrics(p, y, groups, th) for th in THRESHOLDS]
    feasible = [c for c in candidates if c['falseTrigger'] <= .1]
    choice = next(c for c in candidates if c['threshold'] == selected) if selected is not None else max(feasible, key=lambda c: (c['timelyDetection'], c['threshold']), default=None)
    return {'auroc': float(roc_auc_score(y, p, sample_weight=w.numpy())), 'averagePrecision': float(average_precision_score(y, p, sample_weight=w.numpy())),
            'frames': len(y), 'positiveFrames': int(y.sum()), 'selected': choice,
            'thresholds': [{k: v for k, v in c.items() if k != 'trajectories'} for c in candidates]}, p

def fit(train, val, mode):
    torch.manual_seed(SEED); np.random.seed(SEED)
    x, y, w, groups = examples(train, mode); vx, vy, vw, _ = examples(val, mode)
    model = torch.nn.Sequential(torch.nn.Linear(1320, 64), torch.nn.ReLU(), torch.nn.Linear(64, 32), torch.nn.ReLU(), torch.nn.Linear(32, 1))
    opt = torch.optim.Adam(model.parameters(), lr=.001)
    best, saved, epochs = float('inf'), None, []
    for epoch in range(40):
        order = torch.randperm(len(x)); losses = []
        for ids in order.split(256):
            opt.zero_grad(); loss = (torch.nn.functional.binary_cross_entropy_with_logits(model(x[ids]).squeeze(-1), y[ids], reduction='none') * w[ids]).mean()
            loss.backward(); opt.step(); losses.append(float(loss.detach()))
        with torch.no_grad(): vl = float((torch.nn.functional.binary_cross_entropy_with_logits(model(vx).squeeze(-1), vy, reduction='none') * vw).mean())
        epochs.append({'epoch': epoch + 1, 'trainLoss': float(np.mean(losses)), 'validationLoss': vl})
        if vl < best:
            best = vl; saved = {k: v.clone() for k, v in model.state_dict().items()}; best_epoch = epoch + 1
        if (epoch + 1) % 10 == 0: print(mode, epoch + 1, round(vl, 5), flush=True)
    model.load_state_dict(saved)
    metrics, predictions = evaluate(model, val, mode)
    choice = metrics['selected']
    metrics.update({'mode': mode, 'bestEpoch': best_epoch, 'epochs': epochs, 'perceptionGate': bool(choice and metrics['auroc'] >= .9 and choice['timelyDetection'] >= .8)})
    layers = [{'weights': model[i].weight.detach().tolist(), 'bias': model[i].bias.detach().tolist()} for i in [0, 2, 4]]
    artifact = {'format': 'duckfly-temporal-decoder', 'version': 1, 'mode': mode, 'input': 1320, 'snapshot': 264, 'window': 5, 'stride': 3,
                'threshold': choice['threshold'] if choice else None, 'layers': layers, 'seed': SEED, 'epoch': best_epoch,
                'provenance': 'Engineered collision-risk adapter trained on DuckFly walking-camera sequences; not a reconstructed fly visual circuit.'}
    checks = []
    with torch.no_grad():
        for i in np.linspace(0, len(vx) - 1, 8, dtype=int):
            checks.append({'input': vx[i].tolist(), 'probability': float(model(vx[i]).sigmoid()[0])})
    return model, artifact, metrics, checks

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--train', type=Path, default=ROOT / 'reports/temporal-train-v1.json.gz'); parser.add_argument('--validation', type=Path, default=ROOT / 'reports/temporal-validation-v1.json.gz'); parser.add_argument('--out', type=Path, default=ROOT / 'models/v1'); args = parser.parse_args()
    train, val = load(args.train), load(args.validation)
    assert not ({t['id'] for t in train['trials']} & {t['id'] for t in val['trials']})
    args.out.mkdir(parents=True, exist_ok=False)
    report = {'seed': SEED, 'trainSha256': hashlib.sha256(args.train.read_bytes()).hexdigest(), 'validationSha256': hashlib.sha256(args.validation.read_bytes()).hexdigest(), 'models': {}}
    for mode in ['temporal', 'static', 'no-pose']:
        model, artifact, metrics, checks = fit(train, val, mode)
        artifact['trainingDataSha256'] = report['trainSha256']; artifact['validationDataSha256'] = report['validationSha256']
        (args.out / f'{mode}.json').write_text(json.dumps(artifact, separators=(',', ':')) + '\n')
        (args.out / f'{mode}-parity.json').write_text(json.dumps(checks, separators=(',', ':')) + '\n')
        if mode == 'temporal' and metrics['selected']:
            for intervention in ['wrong-pose', 'reverse-time']:
                im, _ = evaluate(model, val, intervention, metrics['selected']['threshold']); metrics[intervention] = im
        report['models'][mode] = metrics
        print(json.dumps({k: v for k, v in metrics.items() if k not in ['epochs', 'thresholds', 'wrong-pose', 'reverse-time']}), flush=True)
        (args.out / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
