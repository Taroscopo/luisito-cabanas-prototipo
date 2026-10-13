// Ejecuta tests/browser-smoke.html en Chromium/Chrome sin interfaz mediante el protocolo DevTools (sin dependencias).
// Uso: node tests/run-smoke.mjs <navegador> <url>. Necesita Node 22 o superior (WebSocket integrado).
// Se usa en lugar de --dump-dom porque este modo puede quedarse esperando indefinidamente y no cierra el navegador.
import { spawn } from 'node:child_process';

const [browser, url] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let tabs;
for (let i = 0; i < 150 && !tabs; i += 1) {
  try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find(tab => tab.type === 'page')) tabs = list; } catch { /* el navegador aún arranca */ }
  if (!tabs) await sleep(200);
}
if (!tabs) { console.log('FALLO: no se pudo iniciar el navegador'); process.exit(1); }

const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let nextId = 0;
const pending = new Map();
ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
const send = (method, params = {}) => new Promise(resolve => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });

await send('Page.navigate', { url });
const read = 'document.title + "\\n" + [...document.querySelectorAll("#results li")].map(li => li.textContent).join("\\n")';
let report = '';
for (let i = 0; i < 120; i += 1) {
  await sleep(1000);
  const reply = await Promise.race([send('Runtime.evaluate', { expression: read, returnByValue: true }), sleep(4000).then(() => null)]);
  report = reply?.result?.result?.value || report;
  if (/^SMOKE-(PASS|FAIL)/.test(report)) break;
}
try { await send('Browser.close'); } catch { /* ya cerrado */ }
try { proc.kill(); } catch { /* sin permiso: el navegador ya se cerró por DevTools */ }

const [title, ...lines] = report.split('\n');
lines.forEach(line => console.log(line));
if (title === 'SMOKE-PASS') { console.log(`OK  smoke test (${lines.length} comprobaciones)`); process.exit(0); }
console.log(title ? 'FALLO smoke test' : 'FALLO smoke test: sin respuesta del navegador (tiempo agotado)');
process.exit(1);
