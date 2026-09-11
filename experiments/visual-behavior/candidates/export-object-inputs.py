"""Read-only reference export of T2/T3 indices. Does not rewrite model assets."""
from pathlib import Path
import gzip
import hashlib
import json
import os

ROOT = Path(__file__).resolve().parents[3]
REFERENCE = ROOT / 'research/fly-vision'
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
os.environ['FLYVIS_ROOT_DIR'] = str(REFERENCE / '.cache/reference')
os.chdir('/tmp')
import numpy as np
import torch
import flyvis

torch.set_num_threads(1)
manifest_bytes = (ROOT / 'shared/vision/models/flyvis-000/manifest.json').read_bytes()
manifest = json.loads(manifest_bytes)
view = flyvis.NetworkView(flyvis.results_dir / 'flow/0000/000')
network = view.init_network()
published_file = view.dir.path / 'best_chkpt'
published = torch.load(published_file, map_location='cpu', weights_only=True)['network']
assert all(torch.equal(network.state_dict()[k].cpu(), value.cpu()) for k, value in published.items())
network.eval()
network.clamp()
params = network._param_api()
def arr(value, dtype='<f4'):
    if hasattr(value, 'detach'):
        value = value.detach().cpu().numpy()
    return np.asarray(value, dtype=dtype)
def sha(value):
    return hashlib.sha256(value).hexdigest()
assert sha(published_file.read_bytes()) == manifest['checkpointSha256']
arrays = {'source': arr(network._source_indices, '<u4'), 'target': arr(network._target_indices, '<u4'),
          'weight': arr(params.edges.weight), 'bias': arr(params.nodes.bias), 'timeConstant': arr(params.nodes.time_const),
          'inputIndex': arr(network.stimulus.input_index, '<u4').reshape(-1)}
for name, value in arrays.items():
    assert sha(value.tobytes()) == manifest['arrays'][name]['sha256'], f'Changed graph or row ordering: {name}'
nodes = network.connectome.nodes
types = nodes.type[:].astype(str).tolist()
u = nodes.u[:].astype(int)
v = nodes.v[:].astype(int)
for name, indices in manifest['readouts'].items():
    assert indices == [i for i, kind in enumerate(types) if kind == name]
    assert manifest['readoutCoordinates'][name] == [[int(u[i]), int(v[i])] for i in indices]
populations = {}
for name in ['T2', 'T3']:
    indices = [i for i, kind in enumerate(types) if kind == name]
    assert len(indices) == 721
    coordinates = [[int(u[i]), int(v[i])] for i in indices]
    assert len(set(map(tuple, coordinates))) == 721
    populations[name] = {'nodeIndices': indices, 'axialCoordinates': coordinates}
result = {'format': 'duckfly-object-input-sidecar', 'version': 1,
          'sourceCommit': manifest['sourceCommit'], 'checkpointSha256': manifest['checkpointSha256'],
          'packagedManifestSha256': sha(manifest_bytes), 'nodes': len(types),
          'arrayHashesVerified': {name: sha(value.tobytes()) for name, value in arrays.items()},
          'existingEightReadoutsMatch': True, 'publishedWeightsEqual': True,
          'nodeTypeCoordinateSha256': sha(json.dumps(list(zip(types, u.tolist(), v.tolist()))).encode()),
          'exportScriptSha256': sha(Path(__file__).read_bytes()), 'populations': populations,
          'interpretation': 'Actual reference node types/coordinates. T2/T3 continuous model activity; no LC11 added and no physiological tuning validation.'}
path = ROOT / 'experiments/visual-behavior/candidates/object-input-indices.json'
path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'path': str(path), 'sha256': sha(path.read_bytes()), 'populations': {k: len(v['nodeIndices']) for k,v in populations.items()}}))
