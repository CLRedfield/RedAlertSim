#!/usr/bin/env python3
"""Verify installed release files against SHA256SUMS.txt without network access."""
from pathlib import Path
import hashlib,sys
root=Path(__file__).resolve().parents[1]
manifest=root/'SHA256SUMS.txt'
if not manifest.is_file():raise SystemExit('Missing SHA256SUMS.txt')
count=0;errors=[]
for line in manifest.read_text(encoding='utf-8').splitlines():
 if not line.strip():continue
 try:
  expected,name=line.split('  ',1);p=(root/name).resolve()
  if root not in p.parents:raise ValueError('Path escapes release directory')
  if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise ValueError('SHA256 mismatch')
  count+=1
 except Exception as e:errors.append(f'{line[-140:]}: {e}')
if errors:print('\n'.join(errors),file=sys.stderr);raise SystemExit(1)
print(f'OK: {count} files verified; PLAY.html == web/index.html: '+str((root/'PLAY.html').read_bytes()==(root/'web/index.html').read_bytes()))
