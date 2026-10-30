#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 fehlt. Bitte die offizielle Node-24-Laufzeit installieren."
  read -r "?Enter zum Schließen …"
  exit 2
fi
node scripts/launch.mjs
read -r "?Enter zum Schließen …"
