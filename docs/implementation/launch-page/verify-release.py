"""Compare the public web entry, worker, and illustration assets with the tested build."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

BASE = 'https://duckfly.vercel.app'
ROOT = Path(__file__).resolve().parents[3]


def get(path):
    with urlopen(Request(BASE + path, headers={'Cache-Control': 'no-cache'}), timeout=45) as response:
        assert response.status == 200, (path, response.status)
        return response.read()


if __name__ == '__main__':
    html = get('/')
    assert html == (ROOT / 'web/dist/index.html').read_bytes(), 'Public HTML differs from tested build'
    paths = re.findall(r'(?:src|href)="(/assets/index-[^"]+)"', html.decode())
    assert len(paths) == 2, paths
    entry = next(path for path in paths if path.endswith('.js'))
    script = get(entry).decode()
    worker = re.search(r'/assets/lab\.worker-[A-Za-z0-9_-]+\.js', script)
    assert worker, 'Public script does not link the expected physics worker'
    paths += [worker.group(), '/launch/duck-hero.png', '/launch/fly-hero.png']
    receipt = {'url': BASE, 'verifiedAt': datetime.now(timezone.utc).isoformat(), 'files': []}
    for path in paths:
        remote = get(path)
        local = (ROOT / 'web/dist' / path.lstrip('/')).read_bytes()
        assert remote == local, 'Public asset differs from tested build: ' + path
        receipt['files'].append({'path': path, 'bytes': len(remote), 'sha256': hashlib.sha256(remote).hexdigest()})
    output = Path(__file__).with_name('production-assets.json')
    output.write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified public HTML and', len(paths), 'entry, worker, and artwork files')
