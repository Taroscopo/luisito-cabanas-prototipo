#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
PORT="${1:-8080}"
printf '\nLuisito el Viajero — prototipo local\n'
printf 'Abre: http://localhost:%s\n' "$PORT"
printf 'Pulsa Ctrl+C para detener el servidor.\n\n'
python3 serve.py "$PORT"
