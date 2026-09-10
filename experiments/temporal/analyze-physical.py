"""Matched physical outcomes. Incomplete studies cannot pass promotion."""
import argparse, gzip, json
from pathlib import Path
import numpy as np
HAZARDS = {'incoming', 'parked', 'crossing', 'retreat'}
CONTROLS = {'near-miss', 'receding', 'empty', 'scan'}
CONDITIONS = ['motion', 'motion-both', 'temporal-timed', 'temporal-hazard', 'static-hazard', 'temporal-gf-silenced']

def paired(rows, a, b, families, field):
    ids = sorted({t['id'] for t in rows if t['family'] in families})
    lookup = {(t['id'], t['condition']): t['summary'] for t in rows}
    values = np.array([float(lookup[i, a][field]) - float(lookup[i, b][field]) for i in ids])
    rng = np.random.default_rng(20260910)
    boot = values[rng.integers(len(values), size=(10000, len(values)))].mean(axis=1)
    return {'pairs': len(ids), 'mean': float(values.mean()), 'ci95': np.quantile(boot, [.025, .975]).tolist()}

def analyze(data):
    rows = data['trials']; lookup = {(t['id'], t['condition']): t for t in rows}
    assert len(lookup) == len(rows), 'Duplicate case/condition'
    assert data['complete'] and len(rows) == data['expectedTrials'], 'Incomplete report'
    counts = {}
    for t in rows: counts[t['family'], t['condition']] = counts.get((t['family'], t['condition']), 0) + 1
    full = all(counts.get((family, condition), 0) == 16 for family in HAZARDS | CONTROLS for condition in CONDITIONS)
    summaries = {}
    for condition in data['conditions']:
        groups = {}
        for label, families in [('hazards', HAZARDS), ('controls', CONTROLS)] + [(f, {f}) for f in sorted(HAZARDS | CONTROLS)]:
            selected = [t['summary'] for t in rows if t['condition'] == condition and t['family'] in families]
            groups[label] = {'trials': len(selected), **{key: float(np.mean([t[key] for t in selected])) for key in ['contact', 'fallen', 'progress', 'gf', 'heldSeconds', 'releases']}}
        summaries[condition] = groups
    comparisons = {condition: paired(rows, 'motion', condition, HAZARDS, 'contact') for condition in data['conditions'] if condition != 'motion'}
    candidate, baseline = summaries['temporal-hazard'], summaries['motion']
    effect = comparisons['temporal-hazard']
    gates = {'fullStudy': full, 'contactReduction': effect['mean'] >= .2 and effect['ci95'][0] > 0,
             'noExtraFalls': sum(t['summary']['fallen'] for t in rows if t['condition'] == 'temporal-hazard') <= sum(t['summary']['fallen'] for t in rows if t['condition'] == 'motion'),
             'controlFalseStops': candidate['controls']['gf'] <= .1 and candidate['controls']['gf'] <= baseline['controls']['gf'] + .05,
             'controlProgress': candidate['controls']['progress'] >= .9 * baseline['controls']['progress'],
             'feedbackContacts': candidate['hazards']['contact'] <= summaries['temporal-timed']['hazards']['contact']}
    return {'promote': all(gates.values()), 'gates': gates, 'summaries': summaries, 'contactReductionVsMotion': comparisons,
            'feedbackContactReductionVsTimer': paired(rows, 'temporal-timed', 'temporal-hazard', HAZARDS, 'contact'),
            'temporalContactReductionVsStatic': paired(rows, 'static-hazard', 'temporal-hazard', HAZARDS, 'contact'),
            'gfAblationContactIncrease': paired(rows, 'temporal-gf-silenced', 'temporal-hazard', HAZARDS, 'contact')}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('report', type=Path); parser.add_argument('--output', type=Path); args = parser.parse_args()
    result = analyze(json.loads(gzip.decompress(args.report.read_bytes())))
    output = json.dumps(result, indent=2) + '\n'
    if args.output: args.output.write_text(output)
    print(json.dumps({'promote': result['promote'], 'gates': result['gates'], 'contactReduction': result['contactReductionVsMotion']['temporal-hazard']}, indent=2))
