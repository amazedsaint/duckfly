"""Compare our equations against arrays emitted by untouched official MATLAB code."""
from pathlib import Path
import hashlib
import importlib.util
import json
import numpy as np
from scipy.io import loadmat

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dd_equations', HERE / 'ddmodel-equations.py')
dd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dd)
ATOL, RTOL = 1e-9, 1e-6
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
source = HERE / '.cache/ddmodel/models/DDModel2DbyEpoch.m'
assert sha(source) == '076a14156c9b8275e2dd132dff6961e1bea362411f715e0283fbdf6c637d4584'
receipts = []
for group in ['Fig4L_LocalFlickers', 'Fig4F_SizeTuning']:
    path = HERE.parent / 'reports' / f'candidates-dd-{group}-oracle.mat'
    if not path.exists():
        raise RuntimeError(f'Original-code oracle not available: {path}; do not substitute our own output')
    oracle = loadmat(path, simplify_cells=True)['oracle']
    epochs = dd.load_epochs(HERE / '.cache/ddmodel/stimuli' / group)
    python = dd.dd_response(dd.published_epoch(epochs[0][1]), retain_stages=True)
    stages = {}
    for key, actual in python.items():
        expected = oracle['firstEpoch'][key]
        stages[key] = {'shape': list(actual.shape), 'maxAbsoluteError': float(np.max(np.abs(actual - expected))),
                       'allclose': bool(np.allclose(actual, expected, atol=ATOL, rtol=RTOL))}
        assert actual.shape == expected.shape and stages[key]['allclose'], f'Original-code mismatch: {group}/{key}'
    name = 'flicker' if 'Flicker' in group else 'size'
    own = json.loads((HERE.parent / 'reports' / f'candidates-dd-{name}-equations.json').read_text())
    centers = np.array([r['trace'] for r in own['traces']])
    expected = oracle['centerTraces']
    match = np.allclose(centers, expected, atol=ATOL, rtol=RTOL)
    assert centers.shape == expected.shape and match, f'Center response mismatch: {group}'
    receipts.append({'group': group, 'oracleFileSha256': sha(path), 'octaveVersion': oracle['octaveVersion'],
                     'stages': stages, 'allEpochCenterTraceError': float(np.max(np.abs(centers - expected))),
                     'allEpochCenterTracesMatch': bool(match), 'epochCount': len(epochs)})
report = {'upstreamCommit': 'c98d06aae1c16b3ad7ed92c609a6b43c617a296a', 'upstreamSourceSha256': sha(source),
          'equationImplementationSha256': sha(HERE / 'ddmodel-equations.py'),
          'oracleHarnessSha256': sha(HERE / 'run-ddmodel-oracle.m'),
          'absoluteTolerance': ATOL, 'relativeTolerance': RTOL, 'receipts': receipts,
          'numericalEquivalenceToOriginalCode': True, 'physiologicalValidation': False,
          'bodyBridge': False, 'productionPromotion': False}
(HERE.parent / 'reports/candidates-dd-original-code-parity.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
