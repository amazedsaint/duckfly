from pathlib import Path
import hashlib, zipfile
import gdown
root=Path(__file__).resolve().parent/'.cache'
archive=root/'results_pretrained_models.zip'
if not archive.exists():gdown.download(id='13cJr2nMn89j-jBAd5RduYRJpBcXwoNrC',output=str(archive))
expected='71c78d4070556a536b13b23ee3139cd2788aa2a9d07d430a223b4edead281db1'
if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise RuntimeError('Published model archive checksum differs; do not use it')
output=(root/'reference').resolve()
with zipfile.ZipFile(archive) as z:
    if any(not (output/name).resolve().is_relative_to(output) for name in z.namelist()):raise RuntimeError('Unsafe archive path')
    z.extractall(output)
print('Verified published archive:',expected)
