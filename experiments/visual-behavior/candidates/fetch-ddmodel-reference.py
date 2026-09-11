"""Fetch pinned research inputs into ignored cache; never vendor unlicensed code."""
from pathlib import Path
import hashlib
import io
import json
import shutil
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
COMMIT = 'c98d06aae1c16b3ad7ed92c609a6b43c617a296a'
FILES = {
    'models/DDModel2DbyEpoch.m': '076a14156c9b8275e2dd132dff6961e1bea362411f715e0283fbdf6c637d4584',
    'stimuli.zip': '820ed8ef0d252f2fce9c106cabef492e9db83c7f840417c577caa34afd2d09ca',
    'README.md': '6d1bdd88063fb83f9d7573182a97537b782a137e75ffd9d7904eb9efdf6e4fd9',
}

def prepare():
    cache = HERE / '.cache/ddmodel'
    receipts = []
    for name, expected in FILES.items():
        url = f'https://raw.githubusercontent.com/ClarkLabCode/DDModel/{COMMIT}/{name}'
        path = cache / name
        data = path.read_bytes() if path.exists() else urllib.request.urlopen(url).read()
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            raise ValueError(f'Pinned source hash mismatch: {name}')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        receipts.append(dict(path=name, url=url, sha256=actual, bytes=len(data)))
    with zipfile.ZipFile(io.BytesIO((cache / 'stimuli.zip').read_bytes())) as archive:
        for name in archive.namelist():
            p = Path(name)
            if p.is_absolute() or '..' in p.parts:
                raise ValueError('Unsafe archive member')
        archive.extractall(cache)
    adapters = []
    for group in ['Fig4L_LocalFlickers', 'Fig4F_SizeTuning']:
        src, dst = cache / 'stimuli' / group, cache / 'octave-stimuli' / group
        dst.mkdir(parents=True, exist_ok=True)
        lines = (src / 'xtPlot.xtp').read_text().splitlines()
        if not all(line.endswith(',') for line in lines):
            raise ValueError('Unexpected published CSV format')
        # The official function discards this terminal field. MATLAB retains
        # the empty field but Octave drops it, so explicitly encode its zero.
        encoded = ('\n'.join(line + '0' for line in lines) + '\n').encode()
        (dst / 'xtPlot.xtp').write_bytes(encoded)
        shutil.copyfile(src / 'epochNames.mat', dst / 'epochNames.mat')
        adapters.append(dict(group=group, sourceSha256=hashlib.sha256((src / 'xtPlot.xtp').read_bytes()).hexdigest(),
                             adaptedSha256=hashlib.sha256(encoded).hexdigest(),
                             change='Only unused trailing empty field becomes numeric zero'))
    report = dict(commit=COMMIT, sources=receipts, octaveInputAdapters=adapters,
                  license='No license file or repository license metadata found at inspected commit. Source stays in ignored cache.',
                  originalModelSourceModified=False)
    (HERE.parent / 'reports/candidates-dd-reference-inputs.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    prepare()
