#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node 22+ is required for hosting. PLAY.html remains fully offline without Node.' >&2
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo 'Please use Node 22+' >&2; exit 1; }
exec node server/server.cjs --host 0.0.0.0 --open "$@"
