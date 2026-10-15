#!/bin/bash
# Avvio EVIL in locale su macOS/Linux (doppio clic su macOS).
cd "$(dirname "$0")" || exit 1
echo "=== EVIL - piattaforma locale (http://localhost:5000) ==="
if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js non trovato. Installa Node.js 22 da https://nodejs.org e riprova."
  read -r -n1 -p "Premi un tasto per chiudere..."
  exit 1
fi
[ -f .env ] || node scripts/setup-local.js
( sleep 3; (open http://localhost:5000 >/dev/null 2>&1 || xdg-open http://localhost:5000 >/dev/null 2>&1) ) &
echo "[*] Avvio server (CTRL+C per fermare)..."
node js/server.js
