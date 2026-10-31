"""Build a standalone delivery archive without any local financial data."""
from pathlib import Path
import json,zipfile,hashlib
root=Path(__file__).resolve().parent
version=json.loads((root/'package.json').read_text())['version']
folder=root/'releases';folder.mkdir(exist_ok=True)
target=folder/f'Le-bas-de-laine-{version}.zip'
allowed_dirs={'public','migrations','docs','tests'}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for p in sorted(root.rglob('*')):
  if not p.is_file() or p.is_symlink():continue
  relative=p.relative_to(root)
  if any(part in {'data','node_modules','__pycache__','releases','.git'} for part in relative.parts):continue
  if p.name.endswith(('.sqlite','.sqlite-wal','.sqlite-shm','.pyc')) or p.name in {'private-access.json','shared-view.json'}:continue
  if len(relative.parts)>1 and relative.parts[0] not in allowed_dirs:continue
  if len(relative.parts)==1 and not (p.suffix in {'.js','.sh','.md','.py'} or p.name in {'package.json','.gitignore'}):continue
  info=zipfile.ZipInfo(f'Le-bas-de-laine-{version}/'+relative.as_posix(),date_time=(2026,10,30,12,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100755 if p.suffix=='.sh' else 0o100644)<<16
  archive.writestr(info,p.read_bytes())
with zipfile.ZipFile(target) as archive:
 assert archive.testzip() is None
 assert any(n.endswith('migrations/001-initial.sql') for n in archive.namelist())
digest=hashlib.sha256(target.read_bytes()).hexdigest()
(folder/'SHA256SUMS.txt').write_text(digest+'  '+target.name+'\n')
print(str(target));print('SHA-256:',digest);print('Octets:',target.stat().st_size)
