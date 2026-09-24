#!/usr/bin/env python3
"""Import the explicitly supplied, hash-pinned original archive exactly once."""
from __future__ import annotations
import hashlib
import json
import os
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 'baf95b95f08674006ad16fedd41b140f2d02f7e983dd0718bc2a7ad1a0d5be36'
PREFIX = 'RedAlert3D_Command_v1.0.0'
REQUIRED = ('web/template.html', 'web/index.html', 'web/src/mqtt-room.js',
            'tools/build.py', 'package.json', 'LICENSE.txt')

def report(ready: bool, imported: bool, message: str) -> None:
    print(message)
    if path := os.environ.get('GITHUB_OUTPUT'):
        with open(path, 'a', encoding='utf-8') as out:
            out.write(f'ready={str(ready).lower()}\nimported={str(imported).lower()}\n')
    if path := os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(path, 'a', encoding='utf-8') as out:
            out.write(f'## Game import\n\n{message}\n')

def import_game(root: Path = ROOT) -> tuple[bool, bool, str]:
    game = root / 'game'
    if all((game / name).is_file() for name in REQUIRED):
        return True, False, 'Existing game source found. The old ZIP will not overwrite source edits.'
    if game.exists():
        raise ValueError('game/ exists but is incomplete. Refusing to overwrite it.')
    candidates = sorted(root.glob('*.zip')) + sorted((root / 'uploads').glob('*.zip'))
    archive = None
    for path in candidates:
        if path.stat().st_size > 100 * 1024 * 1024:
            continue
        with path.open('rb') as data:
            digest = hashlib.file_digest(data, 'sha256').hexdigest()
        if digest == EXPECTED:
            archive = path
            break
    if archive is None:
        if candidates:
            raise ValueError('No uploaded ZIP matches the original SHA-256. Upload the unchanged original archive.')
        return False, False, ('Waiting for the original ZIP. Upload RedAlert3D_Command_v1.0.0_Full(2).zip '
                              'or the byte-identical RedAlertSim-upload.zip to the repository root and commit to main. '
                              'No game has been deployed by this run.')
    with zipfile.ZipFile(archive) as zf, tempfile.TemporaryDirectory(prefix='.import-', dir=root) as tmp:
        entries = zf.infolist()
        if len(entries) > 2000 or sum(i.file_size for i in entries) > 250 * 1024 * 1024:
            raise ValueError('Archive exceeds import safety limits.')
        seen: set[str] = set()
        for item in entries:
            if '\\' in item.filename or '\x00' in item.filename:
                raise ValueError('Invalid ZIP path.')
            name = PurePosixPath(item.filename)
            if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] != PREFIX:
                raise ValueError('Unexpected ZIP path or root directory.')
            rel = PurePosixPath(*name.parts[1:])
            if not name.parts[1:]:
                continue
            if '.git' in rel.parts or '.github' in rel.parts or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('Repository metadata and symbolic links are not allowed in the import.')
            if item.is_dir():
                continue
            if str(rel) in seen:
                raise ValueError('Duplicate ZIP entry.')
            seen.add(str(rel))
            target = Path(tmp).joinpath(*rel.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(item) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst)
        if not all((Path(tmp) / name).is_file() for name in REQUIRED):
            raise ValueError('Archive is missing required game files.')
        (Path(tmp) / 'IMPORT_INFO.json').write_text(json.dumps({
            'source_archive': archive.name, 'sha256': EXPECTED,
            'version': '1.0.0', 'original_files': len(seen),
            'note': 'Original project imported once; later source edits are preserved.'
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        shutil.move(tmp, game)
    return True, True, f'Imported {len(seen)} original files into game/ after SHA-256 verification.'

if __name__ == '__main__':
    try:
        report(*import_game())
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        raise SystemExit(f'Import failed: {exc}') from exc
