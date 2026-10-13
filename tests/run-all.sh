#!/usr/bin/env sh
# Ejecuta todas las comprobaciones. Uso: ./tests/run-all.sh
# El smoke test de navegador necesita Chromium o Chrome; si no hay, se omite con un aviso.
set -u
cd "$(dirname "$0")/.."
status=0
step() { printf '\n== %s ==\n' "$1"; }

step 'Sintaxis JavaScript'
for f in app.js data.js pricing.js assistant.js; do node --check "$f" && echo "ok  $f" || status=1; done

step 'Precios'
node tests/test-pricing.js || status=1

step 'Asistente del chat'
node tests/test-assistant.js || status=1

step 'Auditoría estática'
python3 tests/audit-static.py || status=1

step 'Smoke test de navegador'
BROWSER=""
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER="$candidate"; break; fi
done
if [ -z "$BROWSER" ]; then
  echo 'OMITIDO: no se encontró Chromium/Chrome. Abre http://localhost:8080/tests/browser-smoke.html a mano.'
else
  PORT=8799
  python3 serve.py "$PORT" >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
  sleep 1
  if node -e 'process.exit(typeof WebSocket === "function" ? 0 : 1)' 2>/dev/null; then
    # Lanzador por DevTools (Node 22+): termina siempre y cierra el navegador.
    node tests/run-smoke.mjs "$BROWSER" "http://127.0.0.1:$PORT/tests/browser-smoke.html" || status=1
  else
    OUT=$(timeout 120 "$BROWSER" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=30000 --dump-dom "http://127.0.0.1:$PORT/tests/browser-smoke.html" 2>/dev/null)
    echo "$OUT" | grep -o 'class="\(pass\|fail\)"[^>]*>[^<]*' | sed 's/class="[a-z]*">//' || true
    # Se lee el <title> final: el texto «SMOKE-PASS» también aparece en el código fuente de la página.
    if echo "$OUT" | grep -q '<title>SMOKE-PASS</title>'; then echo 'OK  smoke test'; else echo 'FALLO smoke test'; status=1; fi
  fi
fi

echo
[ "$status" -eq 0 ] && echo 'TODO CORRECTO' || echo 'HAY FALLOS'
exit "$status"
