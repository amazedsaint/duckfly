"""Bounded transfer screen of published DD equations, never a biological action claim.

Frozen choices before this candidate's first run: sample a 70-degree square at
5-degree spacing within the actual camera FOV; causal frame hold at model180Hz;
4s first-frame conditioning; local peak output above its prestimulus maximum;
threshold selected for <=5% calibration confounds, then require >=90% recall.
Original retained movie cohorts are immutable and have been used by other
candidates, so this is transfer validation, not an untouched project-level set.
"""
from pathlib import Path
import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import time
import numpy as np
from scipy.ndimage import map_coordinates

HERE = Path(__file__).resolve().parent
REPORTS = HERE.parent / 'reports'
spec = importlib.util.spec_from_file_location('dd_equations', HERE / 'ddmodel-equations.py')
dd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dd)
POSITIVE = ['small-pass', 'small-step']
NEGATIVE = ['large-bar', 'stationary-flicker', 'global-flash']
FAMILIES = POSITIVE + NEGATIVE + ['textured-small-pass', 'background-rotation']
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()


def load_movies(split):
    data = json.loads(gzip.decompress((REPORTS / f'candidates-{split}-traces.json.gz').read_bytes()))
    raw = gzip.decompress((REPORTS / f'candidates-{split}-movies.gray8.gz').read_bytes())
    for r in data['records']:
        if r['family'] not in FAMILIES:
            continue
        b = raw[r['byteOffset']:r['byteOffset'] + r['byteLength']]
        if hashlib.sha256(b).hexdigest() != r['movieSha256']:
            raise ValueError('Retained movie changed')
        yield dict(id=r['id'], family=r['family'], times=np.array(r['frameTimes']),
                   gray=np.frombuffer(b, np.uint8).reshape((-1, 64, 96)) / 255,
                   source=split, inputSha256=r['movieSha256'])


def arena_movies():
    p = REPORTS / 'candidates-arena-transfer.json.gz'
    a = json.loads(gzip.decompress(p.read_bytes()))
    for r in a['records']:
        rgba = np.array([np.frombuffer(base64.b64decode(f['rgba']), np.uint8).reshape(64, 96, 4) for f in r['frames']])
        gray = (rgba[:, :, :, :3] * np.array([.299, .587, .114])).sum(axis=3) / 255
        yield dict(id=r['id'], family=r['family'], times=np.array([f['time'] for f in r['frames']]),
                   gray=gray, source='actual-arena', inputSha256=sha(p))


def sample(photos):
    # Same pinhole law as shared/vision/retina.js; no values outside camera FOV.
    angles = np.arange(-32.5, 33, 5)
    x, y = np.meshgrid(angles, angles[::-1])
    px = (1 + np.tan(np.deg2rad(x)) / (np.tan(np.deg2rad(75 / 2)) * 1.5)) * 95 / 2
    py = (1 - np.tan(np.deg2rad(y)) / np.tan(np.deg2rad(75 / 2))) * 63 / 2
    assert px.min() >= 0 and px.max() <= 95 and py.min() >= 0 and py.max() <= 63
    return np.stack([map_coordinates(frame, [py, px], order=1, mode='nearest') for frame in photos], axis=2)


def run(movie, condition):
    gray = movie['gray']
    if condition == 'frozen':
        gray = np.repeat(gray[:1], len(gray), axis=0)
    elif condition == 'reversed':
        gray = gray[::-1]
    frames = sample(gray)
    t = np.arange(1800) / 180
    indices = np.clip(np.searchsorted(movie['times'], t - 4, side='right') - 1, 0, len(gray) - 1)
    contrast = (frames[:, :, indices] - .5) / .5
    output = dd.dd_response(contrast)['Rout']
    trace = output.max(axis=(0, 1))
    baseline = float(trace[(t >= 3.2) & (t < 4.24)].max())
    observed = (t >= 4.24) & (t <= 5.8)
    score = max(0., float(trace[observed].max()) - baseline)
    return dict(id=movie['id'], family=movie['family'], source=movie['source'], condition=condition,
                inputSha256=movie['inputSha256'], baseline=baseline, score=score,
                trace=trace.tolist(), peakTime=float(t[np.flatnonzero(observed)[np.argmax(trace[observed])]]) - 4.24)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('split', choices=['calibration', 'heldout', 'arena'])
    args = parser.parse_args()
    started = time.monotonic()
    sources = {p.name: sha(p) for p in [Path(__file__), HERE / 'ddmodel-equations.py']}
    frozen_path = REPORTS / 'candidates-dd-transfer-frozen.json'
    if args.split == 'heldout':
        frozen = json.loads(frozen_path.read_text())
        if frozen['sources'] != sources:
            raise ValueError('Frozen DD transfer source mismatch')
        if not frozen['calibrationPass']:
            raise ValueError('Calibration gate failed; no heldout threshold validation')
    records = []
    movies = arena_movies() if args.split == 'arena' else load_movies(args.split)
    for movie in movies:
        for condition in (['original', 'frozen', 'reversed'] if args.split == 'arena' else ['original', 'frozen']):
            r = run(movie, condition)
            records.append(r)
            print(r['id'], condition, r['score'], flush=True)
    threshold = None
    calibration_pass = False
    if args.split == 'calibration':
        negatives = np.array([r['score'] for r in records if r['condition'] == 'original' and r['family'] in NEGATIVE])
        allowed_false = int(np.floor(.05 * len(negatives)))
        threshold = float(np.nextafter(np.sort(negatives)[-(allowed_false + 1)], np.inf))
        positive = [r for r in records if r['condition'] == 'original' and r['family'] in POSITIVE]
        calibration_pass = np.mean([r['score'] >= threshold for r in positive]) >= .9
        frozen_path.write_text(json.dumps(dict(sources=sources, threshold=threshold, calibrationPass=bool(calibration_pass)), indent=2) + '\n')
    elif frozen_path.exists():
        threshold = json.loads(frozen_path.read_text())['threshold']
    groups = {}
    for r in records:
        key = f"{r['family']}/{r['condition']}"
        g = groups.setdefault(key, dict(movies=0, responses=0, scores=[]))
        g['movies'] += 1
        g['responses'] += int(threshold is not None and r['score'] >= threshold)
        g['scores'].append(r['score'])
    summary = dict(split=args.split, sources=sources, threshold=threshold, groups=groups,
                   calibrationPass=bool(calibration_pass) if args.split == 'calibration' else None,
                   sampling='14x14 at5deg centers[-32.5,32.5], actual75deg pinhole, causal25Hz or native capture hold to180Hz',
                   conditioningSeconds=4, baselineWindow=[3.2,4.24], observedWindow=[4.24,5.8],
                   originalCodeParityReport=sha(REPORTS / 'candidates-dd-original-code-parity.json') if (REPORTS / 'candidates-dd-original-code-parity.json').exists() else None,
                   elapsedSeconds=time.monotonic()-started, productionPromotion=False,
                   biologicalLC11=False, flyvisInputs=False, physicalUsefulness=False)
    tracepath = REPORTS / f'candidates-dd-transfer-{args.split}.json.gz'
    tracepath.write_bytes(gzip.compress(json.dumps(dict(summary=summary, records=records)).encode(), mtime=0))
    summary['tracesSha256'] = sha(tracepath)
    (REPORTS / f'candidates-dd-transfer-{args.split}-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
