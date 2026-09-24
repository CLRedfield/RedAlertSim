#!/usr/bin/env python3
"""Self-contained browser pages. The same simulation runs in browser and server."""
from pathlib import Path
import hashlib, re
root=Path(__file__).resolve().parents[1]
# The build identity covers actual shared source, not just a human-chosen version.
data_path=root/'web/src/data.js'
data=data_path.read_text(encoding='utf-8')
normalized=re.sub(r"R.SOURCE_HASH='[^']*'", "R.SOURCE_HASH='<build>'", data)
h=hashlib.sha256(normalized.encode())
for name in ['sim.js','tactics.js','operations.js','wire.js','authority.js','mqtt-wire.js','mqtt-room.js']:
    h.update(name.encode());h.update((root/'web/src'/name).read_bytes())
data_path.write_text(re.sub(r"R.SOURCE_HASH='[^']*'", "R.SOURCE_HASH='"+h.hexdigest()+"'", data),encoding='utf-8')
page=(root/'web/template.html').read_text(encoding='utf-8')
sources={'STYLE':['web/style.css','web/command.css','web/release.css'],'DATA':['web/src/data.js'],'SIM':['web/src/sim.js','web/src/tactics.js','web/src/operations.js'],'GEOMETRY':['web/src/geometry.js'],'ART':['web/src/art.js','web/src/art-expanded.js'],'RENDERER':['web/src/renderer.js'],'CAMERA':['web/src/camera.js'],'WIRE':['web/src/wire.js'],'AUTHORITY':['web/src/authority.js'],'NET':['web/src/net.js','web/src/mqtt-wire.js','web/src/mqtt-room.js'],'HQ':['web/src/headquarters.js','web/src/release-ui.js'],'APP':['web/src/app.js']}
for token, paths in sources.items():
    content='\n'.join((root/p).read_text(encoding='utf-8') for p in paths)
    if token!='STYLE': content=content.replace('</script','<\\/script')
    page=page.replace('/*'+token+'*/',content)
(root/'PLAY.html').write_text(page,encoding='utf-8')
(root/'web/index.html').write_text(page,encoding='utf-8')
print(f'Built two self-contained pages, {len(page.encode()):,} bytes each')
