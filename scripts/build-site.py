#!/usr/bin/env python3
"""Build only static web files. Never expose server config or local secrets."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'game'
OUT = ROOT / '_site'
subprocess.run([sys.executable, str(GAME / 'tools/build.py')], cwd=GAME, check=True)
OUT.mkdir(exist_ok=True)
page = (GAME / 'web/index.html').read_text(encoding='utf-8')
if page.count('</body>') != 1:
    raise SystemExit('Unexpected page structure; refusing to publish.')
# Inline this small adapter to keep the game a self-contained static page.
adapter = (ROOT / 'site/github-pages.js').read_text(encoding='utf-8').replace('</script', '<\\/script')
page = page.replace('</head>', '<meta name="referrer" content="no-referrer">\n</head>', 1)
page = page.replace('</body>', '<script>\n' + adapter + '\n</script>\n</body>', 1)
(OUT / 'index.html').write_text(page, encoding='utf-8')
shutil.copyfile(GAME / 'web/online.json', OUT / 'online.json')
(OUT / '.nojekyll').touch()
(OUT / 'build-info.json').write_text(json.dumps({
    'version': '1.0.0', 'hosting': 'GitHub Pages', 'transport': 'MQTT/browser-host',
    'index_sha256': hashlib.sha256(page.encode()).hexdigest()
}, indent=2) + '\n', encoding='utf-8')
print(f'Static site built: {len(page.encode()):,} bytes. Public relay still requires reachable WSS.')
