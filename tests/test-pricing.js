'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../data.js');
const { calculateQuote, nightsBetween, parseIso } = require('../pricing.js');
const [marAzul, vistaPalma, laReserva] = global.DEMO_CONFIG.properties;
const today = '2026-10-12'; // lunes
let groups = 0;
function group(name, fn) { fn(); groups += 1; }
function quote(property, mode, people, date, out = '') {
  return calculateQuote({ property, mode, people, date, departure: out }, today, 30);
}
const sumLines = q => q.lines.reduce((sum, line) => sum + line.subtotal, 0);

group('tarifa por rango, anticipo y saldo (entre semana)', () => {
  const q = quote(marAzul, 'alojamiento', 10, '2026-10-19', '2026-10-21');
  assert.equal(q.total, 2400000, '10 huéspedes × 2 noches a $1.2m por noche');
  assert.equal(q.deposit, 720000, 'anticipo ilustrativo del 30%');
  assert.equal(q.balance, 1680000, 'saldo igual al total menos el anticipo');
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].quantity, 2);
  assert.equal(quote(marAzul, 'alojamiento', 12, '2026-10-19', '2026-10-21').total, 3000000, '12 huéspedes usan el segundo rango');
});

group('capacidad excedida y rango sin tarifa van a cotización manual', () => {
  const q = quote(marAzul, 'alojamiento', 13, '2026-10-19', '2026-10-21');
  assert.equal(q.needsManual, true);
  assert.equal(q.total, null, 'no inventa un total por encima de la capacidad');
  const gap = { ...marAzul, rates: [{ min: 1, max: 4, nightly: 1000000 }] };
  assert.equal(quote(gap, 'alojamiento', 6, '2026-10-19', '2026-10-21').needsManual, true);
});

group('pasadía por persona', () => {
  const q = quote(vistaPalma, 'pasadia', 4, '2026-10-17');
  assert.equal(q.total, 280000);
  assert.equal(q.deposit, 84000);
  assert.equal(q.lines[0].quantity, 4);
});

group('eventos siempre a cotización manual', () => {
  const q = quote(laReserva, 'evento', 20, '2026-10-17');
  assert.equal(q.needsManual, true);
  assert.equal(q.total, null);
});

group('validación de fechas', () => {
  assert.equal(quote(marAzul, 'alojamiento', 10, '2026-10-19', '2026-10-19').valid, false, 'salida igual a llegada');
  assert.equal(quote(marAzul, 'alojamiento', 10, '2026-10-01', '2026-10-03').valid, false, 'fecha pasada');
  assert.equal(quote(marAzul, 'alojamiento', 10, '2026-02-31', '2026-03-02').valid, false, 'fecha inexistente');
  assert.equal(quote(marAzul, 'alojamiento', 10, '', '').valid, false, 'sin fecha');
  assert.equal(nightsBetween('2026-10-19', '2026-10-21'), 2);
  assert.equal(nightsBetween('2026-10-19', 'basura'), 0);
  assert.equal(nightsBetween('2026-03-28', '2026-03-30'), 2, 'cambio de horario no altera las noches');
  assert(Number.isNaN(parseIso('2026-13-01')));
});

group('recargo de fin de semana (viernes y sábado)', () => {
  const sat = quote(marAzul, 'alojamiento', 10, '2026-10-17', '2026-10-19'); // sáb + dom
  assert.equal(sat.total, 1320000 + 1200000);
  assert.equal(sat.lines.length, 2);
  const fri = quote(marAzul, 'alojamiento', 10, '2026-10-16', '2026-10-18'); // vie + sáb
  assert.equal(fri.total, 2640000);
  assert.equal(fri.lines.length, 1, 'noches idénticas se agrupan');
  assert.equal(fri.lines[0].quantity, 2);
});

group('noche festiva', () => {
  const q = quote(marAzul, 'alojamiento', 10, '2026-11-01', '2026-11-02');
  assert.equal(q.total, 1500000, '25% sobre $1.2m');
  assert.match(q.lines[0].label, /festiva/);
});

group('festivo y fin de semana no se acumulan: gana el mayor recargo', () => {
  const base = { ...marAzul, peakNights: ['2026-10-17'], seasons: [] }; // sábado
  assert.equal(quote({ ...base, peakSurchargePercent: 25 }, 'alojamiento', 10, '2026-10-17', '2026-10-18').total, 1500000);
  assert.equal(quote({ ...base, peakSurchargePercent: 5 }, 'alojamiento', 10, '2026-10-17', '2026-10-18').total, 1320000);
});

group('temporada alta, incluida la que cruza de año y su borde', () => {
  const inSeason = quote(marAzul, 'alojamiento', 10, '2026-12-14', '2026-12-17'); // lun base, mar+mié temporada
  assert.equal(inSeason.total, 1200000 + 1440000 + 1440000);
  const edge = quote(marAzul, 'alojamiento', 10, '2027-01-14', '2027-01-17'); // jue, vie (último día), sáb (fuera)
  assert.equal(edge.total, 1440000 + 1584000 + 1320000, 'temporada y fin de semana se combinan; 16-ene ya no es temporada');
});

group('las líneas siempre suman el total', () => {
  for (const [from, to] of [['2026-10-16', '2026-10-20'], ['2026-12-10', '2026-12-20'], ['2026-12-30', '2027-01-03']]) {
    const q = quote(marAzul, 'alojamiento', 11, from, to);
    assert.equal(sumLines(q), q.total, `${from} → ${to}`);
    assert.equal(q.lines.reduce((n, line) => n + line.quantity, 0), q.nights);
  }
});

group('estancias muy largas se derivan a cotización manual', () => {
  const q = quote(marAzul, 'alojamiento', 10, '2026-10-19', '2026-11-03'); // 15 noches > maxNights 14
  assert.equal(q.needsManual, true);
  assert.equal(q.total, null);
  assert.equal(quote(marAzul, 'alojamiento', 10, '2026-10-19', '2026-11-02').needsManual, false, '14 noches sí se calcula');
});

group('los importes siempre son pesos enteros', () => {
  const odd = { ...marAzul, rates: [{ min: 1, max: 12, nightly: 100001 }], seasons: [], peakNights: [] };
  const q = quote(odd, 'alojamiento', 3, '2026-10-16', '2026-10-17');
  assert(Number.isInteger(q.total) && Number.isInteger(q.deposit) && Number.isInteger(q.balance));
});

console.log(`PASS: ${groups} grupos de pruebas de precios, temporadas, recargos, anticipo y límites`);
