"""Audit retained inputs, frozen artifacts, and every physical condition."""
import gzip, hashlib, json, math, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):
    p = ROOT / 'reports' / name
    d = json.loads(gzip.decompress(p.read_bytes()))
    assert d['complete'] and len(d['trials']) == d['expectedTrials']
    assert len({(t['id'], t['condition']) for t in d['trials']}) == len(d['trials'])
    receipt = {'path': str(p.relative_to(REPO)), 'sha256': sha(p), 'trials': len(d['trials']), 'complete': True}
    raw = p.with_suffix('').with_suffix('.jsonl')
    if raw.exists():
        events = [json.loads(line) for line in raw.read_text().splitlines()]
        assert events[0]['event'] == 'start' and events[-1]['event'] == 'complete'
        assert [e['data'] for e in events if e['event'] == 'trial'] == d['trials']
        receipt['incrementalSha256'] = sha(raw); receipt['losslessWorkingLogMatch'] = True
    return d, receipt

if __name__ == '__main__':
    receipts = []; ids = set(); total_frames = 0
    for name, count in [('temporal-train-v1.json.gz', 256), ('temporal-validation-v1.json.gz', 64)]:
        d, receipt = read(name); assert len(d['trials']) == count
        assert not ids.intersection(t['id'] for t in d['trials']); ids.update(t['id'] for t in d['trials'])
        n = 0
        for t in d['trials']:
            regular = {round(i * .04, 8) for i in range(125)}
            actual = [round(f['time'], 8) for f in t['frames']]
            assert regular.issubset(actual) and len(set(actual)) == len(actual)
            assert 125 <= len(actual) <= 127
            assert all(round(time / .02) * .02 - time < 1e-8 for time in actual)
            if t['family'] != 'incoming': assert len(actual) == 125
            for i, f in enumerate(t['frames']):
                assert len(f['snapshot']) == 264 and all(math.isfinite(x) for x in f['snapshot'])
                assert f['risk'] in [0, 1]
                n += 1
        total_frames += n; receipt['stereoFrames'] = n; receipts.append(receipt)
    validation = json.loads((ROOT / 'models/v1/validation.json').read_text())
    assert validation['trainSha256'] == receipts[0]['sha256']
    assert validation['validationSha256'] == receipts[1]['sha256']
    for mode in ['temporal', 'static', 'no-pose']:
        m = json.loads((ROOT / f'models/v1/{mode}.json').read_text())
        assert m['trainingDataSha256'] == validation['trainSha256'] and m['validationDataSha256'] == validation['validationSha256']
        assert m['epoch'] == validation['models'][mode]['bestEpoch']
    assert validation['models']['temporal']['perceptionGate'] is False
    assert validation['models']['no-pose']['perceptionGate'] is True
    physical_name = 'temporal-physical-confirm-v1.json.gz'
    physical = None
    if (ROOT / 'reports' / physical_name).exists():
        physical, receipt = read(physical_name); receipts.append(receipt)
        assert len(physical['trials']) == 768
        assert physical['decoderName'] == 'no-pose'
        assert physical['trainSha256'] == validation['trainSha256'] and physical['validationSha256'] == validation['validationSha256']
        script = "const fs=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1])))).digest('hex'))"
        artifact_hash = subprocess.check_output(['node', '-e', script, str(ROOT / 'models/v1/no-pose.json')], text=True)
        assert physical['artifactHash'] == artifact_hash
        counts = {}; motor_ticks = 0
        for t in physical['trials']:
            counts[t['family'], t['condition']] = counts.get((t['family'], t['condition']), 0) + 1
            assert t['id'] not in ids and len(t['trace']) == 250
            gf_seen = False
            for i, row in enumerate(t['trace']):
                assert abs(row['time'] - i * .02) < 1e-9
                assert abs(row['neuralTime'] - (i + 1) * .02) < 1e-9
                assert all(math.isfinite(row[key]) for key in ['speed', 'heading', 'rawVx'])
                assert row['risk'] is None or 0 <= row['risk'] <= 1
                gf_seen |= row['gfEvent']
                if row['held']:
                    assert gf_seen and row['command']['vx'] == row['command']['yaw'] == 0
                if t['condition'] == 'temporal-gf-silenced': assert not row['gfEvent'] and not row['held']
                motor_ticks += 1
            assert t['summary']['contact'] == (t['trace'][-1]['contacts'] > 0)
            assert t['summary']['gf'] == gf_seen
            assert t['summary']['fallen'] == t['trace'][-1]['fallen']
        assert len(counts) == 48 and set(counts.values()) == {16}
        receipt['motorTicks'] = motor_ticks; receipt['simulatedSeconds'] = motor_ticks * .02; receipt['artifactHashMatches'] = True
    for filename in ['training-frozen.sha256', 'physical-frozen.sha256']:
        for line in (ROOT / filename).read_text().splitlines():
            digest, path = line.split(maxsplit=1)
            archived = ROOT / 'sources/executed' / path
            actual = ROOT / 'sources/intended/scenes.js' if path == 'experiments/temporal/scenes.js' else archived if archived.exists() else REPO / path
            assert sha(actual) == digest, path
    for line in (ROOT / 'executed-frozen.sha256').read_text().splitlines():
        digest, path = line.split(maxsplit=1)
        assert sha(ROOT / 'sources/executed' / path) == digest, path
    subprocess.run(['shasum', '-a', '256', '-c', 'experiments/feedback/fixed-controller.sha256'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    guarded, guard_receipt = read('temporal-guard-check-v1.json.gz')
    assert guarded['sourceGuardVersion'] == 1 and len(guarded['trials']) == 8
    archived = json.loads(gzip.decompress((ROOT / 'reports/temporal-guard-check-v1.sources.json.gz').read_bytes()))
    assert set(guarded['sourceHashes']) == set(archived['sources'])
    for path, source in archived['sources'].items():
        assert hashlib.sha256(source['code'].encode()).hexdigest() == source['sha256'] == guarded['sourceHashes'][path]
    rejection = json.loads((ROOT / 'reports/source-guard-rejection.json').read_text())
    assert 'Stale research module: web/tests/temporal-harness.js' in rejection['status']
    assert not (ROOT / 'reports/temporal-guard-reject-v1.jsonl').exists()
    subprocess.run(['shasum', '-a', '256', '-c', str(ROOT / 'guarded-frozen.sha256')], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    guard_receipt['executedSourceReceiptVerified'] = True; receipts.append(guard_receipt)
    output = {'sourceGuardAcceptedFreshAndRejectedStale': True, 'completePhysicalStudy': physical is not None, 'stereoTrainingValidationFrames': total_frames, 'receipts': receipts,
              'intendedSourcesArchived': True, 'executedSourcesMatch': True, 'verifiedAgainstArchivedStudySources': True, 'sourceDeviation': json.loads((ROOT / 'reports/source-deviation.json').read_text()), 'circuitAndWalkingPolicyUnchanged': True}
    (ROOT / 'reports/verification.json').write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps(output, indent=2))
