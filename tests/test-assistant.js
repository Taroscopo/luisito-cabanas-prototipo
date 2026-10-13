/* Pruebas del asistente del chat (motor de reglas). Ejecutar: node tests/test-assistant.js */
'use strict';
const assert = require('node:assert/strict');
global.window = {};
require('../data.js');
const Pricing = require('../pricing.js');
const Assistant = require('../assistant.js');

const config = window.DEMO_CONFIG;
const TODAY = '2026-10-12'; // lunes
const bot = Assistant.create({ config, pricing: Pricing, today: TODAY });
let passed = 0;
function group(name, fn) {
  try { fn(); passed += 1; } catch (error) { console.error(`FAIL · ${name}\n  ${error.message}`); process.exitCode = 1; }
}
const textOf = reply => reply.messages.filter(m => m.type === 'text').map(m => m.text).join(' ');
const cardsOf = reply => (reply.messages.find(m => m.type === 'cards') || { cards: [] }).cards;
const quoteOf = reply => (reply.messages.find(m => m.type === 'quote') || {}).quote;
const hasHandoffChip = reply => reply.chips.some(c => c.action === 'handoff');
const byId = id => config.properties.find(p => p.id === id);

group('personas: cifras, palabras y sin confundir con fechas', () => {
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('Somos 12'))), 12);
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('20 personas'))), 20);
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('para doce personas'))), 12);
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('somos quince'))), 15);
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('para el 15 de octubre'))), 0, 'una fecha no es un número de personas');
  assert.equal(Assistant.parsePeople(Assistant.digits(Assistant.norm('2 noches'))), 0);
});

group('fechas: rangos, día suelto, relativas y año siguiente', () => {
  const d = text => Assistant.parseDates(Assistant.norm(text), TODAY);
  assert.deepEqual(d('del 15 al 17 de noviembre'), { date: '2026-11-15', departure: '2026-11-17' });
  assert.deepEqual(d('15 de octubre'), { date: '2026-10-15', departure: '' });
  assert.equal(d('1 de octubre').date, '2027-10-01', 'una fecha ya pasada salta al año siguiente');
  assert.equal(d('el 15/11').date, '2026-11-15');
  assert.equal(d('mañana').date, '2026-10-13');
  assert.equal(d('este fin de semana').date, '2026-10-16');
  assert.equal(d('este fin de semana').departure, '2026-10-18');
  assert.equal(d('el sábado').date, '2026-10-17');
  assert.equal(d('el próximo fin de semana').date, '2026-10-23');
  assert.equal(d('31 de febrero'), null, 'fechas inexistentes se ignoran');
  assert.equal(d('hola'), null);
  assert.equal(Assistant.parseNights('dos noches'), 0, 'las palabras se convierten antes con digits()');
  assert.equal(Assistant.parseNights(Assistant.digits('dos noches')), 2);
});

group('recomienda por capacidad y ubicación, con valor estimado cuando hay fechas', () => {
  const reply = bot.respond('Somos 12 en Coveñas del 20 al 22 de noviembre');
  const cards = cardsOf(reply);
  assert.ok(cards.length >= 1, 'debe haber tarjetas');
  assert.ok(cards.every(c => ['casa-aledam', 'los-flamencos'].includes(c.id)), 'solo cabañas de Coveñas: ' + cards.map(c => c.id));
  assert.equal(cards[0].id, 'casa-aledam', 'primero la que mejor encaja (capacidad más ajustada)');
  const expected = Pricing.calculateQuote({ property: byId('casa-aledam'), mode: 'alojamiento', people: 12, date: '2026-11-20', departure: '2026-11-22' }, TODAY, 30);
  assert.ok(cards[0].price.includes(String(expected.total).replace(/\B(?=(\d{3})+(?!\d))/g, '.')), `precio de la tarjeta ${cards[0].price} vs motor ${expected.total}`);
  assert.match(textOf(reply), /no la puedo confirmar|asesor/i, 'aclara que la disponibilidad la confirma un asesor');
  assert.ok(hasHandoffChip(reply), 'ofrece continuar en WhatsApp');
});

group('no recomienda cabañas que no caben ni inventa opciones', () => {
  const reply = bot.respond('Somos 200 personas');
  assert.equal(cardsOf(reply).length, 0);
  assert.ok(reply.handoff && hasHandoffChip(reply), 'deriva al asesor');
  const small = bot.respond('Somos 30 personas');
  const capacityShown = card => Number(/Hasta (\d+)/.exec(card.capacity)[1]);
  assert.ok(cardsOf(small).length > 0 && cardsOf(small).every(c => capacityShown(c) >= 30), 'la capacidad que muestra cada tarjeta cubre al grupo: ' + cardsOf(small).map(c => c.capacity));
});

group('pregunta lo que falta: personas, fechas y noches o pasadía', () => {
  let reply = bot.respond('Quiero cotizar un plan');
  assert.match(textOf(reply), /cuántas personas/i);
  assert.ok(reply.chips.length >= 3 && reply.chips.every(c => c.send));
  reply = bot.respond('8 personas', reply.memory);
  assert.ok(cardsOf(reply).length > 0 && /fechas/i.test(textOf(reply)), 'con personas muestra opciones y pide fechas');
  reply = bot.respond('Cotizar Casa Aledam', reply.memory);
  assert.match(textOf(reply), /fechas/i);
  reply = bot.respond('15 de noviembre', reply.memory);
  assert.match(textOf(reply), /pasadía o te quedas a dormir|noches/i, 'con una sola fecha pregunta noches o pasadía');
  reply = bot.respond('2 noches', reply.memory);
  const quote = quoteOf(reply);
  assert.ok(quote, 'ahora sí hay cotización');
  const expected = Pricing.calculateQuote({ property: byId('casa-aledam'), mode: 'alojamiento', people: 8, date: '2026-11-15', departure: '2026-11-17' }, TODAY, 30);
  assert.equal(quote.nights, 2);
  assert.ok(quote.total.replace(/\D/g, '') === String(expected.total), `total ${quote.total} vs motor ${expected.total}`);
  assert.ok(hasHandoffChip(reply) && reply.chips.some(c => c.action === 'open-property'));
});

group('cotiza un pasadía sin pedir salida', () => {
  let reply = bot.respond('Villa Cristal para 10 personas el 15 de noviembre');
  const quote = quoteOf(reply);
  assert.ok(quote && quote.mode === 'pasadia', 'Villa Cristal solo ofrece pasadía');
  assert.equal(quote.total.replace(/\D/g, ''), '700000');
});

group('los eventos se derivan a cotización a medida sin inventar precio', () => {
  const reply = bot.respond('Los Canaguates para 40 personas el 20 de diciembre');
  assert.equal(quoteOf(reply), undefined);
  assert.match(textOf(reply), /a medida/i);
  assert.ok(reply.handoff);
});

group('responde ubicación solo con el municipio', () => {
  const reply = bot.respond('¿Dónde queda Casa Mare?');
  assert.match(textOf(reply), /Cartagena/);
  assert.doesNotMatch(textOf(reply), /Bolívar|dirección exacta es/i);
  assert.match(textOf(reply), /ubicación exacta la comparte el asesor/i);
});

group('responde capacidad y habitaciones de una cabaña', () => {
  assert.match(textOf(bot.respond('¿Cuántas personas caben en La Modelo?')), /40 personas/);
  assert.match(textOf(bot.respond('¿Cuántas habitaciones tiene La Modelo?')), /7 habitaciones/);
  assert.match(textOf(bot.respond('capacidad de Los Flamencos')), /120/);
});

group('responde amenidades: sí, no registrado, y búsqueda por amenidad', () => {
  assert.match(textOf(bot.respond('¿Tiene piscina Villa Cristal?')), /Sí, Villa Cristal cuenta con piscina/);
  const no = bot.respond('¿Tiene jacuzzi Villa Sol?');
  assert.match(textOf(no), /No tengo jacuzzi registrado/);
  assert.ok(hasHandoffChip(no));
  const list = bot.respond('¿Qué cabañas tienen billar?');
  assert.ok(cardsOf(list).length >= 2 && cardsOf(list).every(c => (byId(c.id).amenities || []).some(a => /billar/i.test(a))));
});

group('políticas: responde lo que sabe y deriva lo que no', () => {
  const anticipo = bot.respond('¿Cómo funciona el anticipo?');
  assert.match(textOf(anticipo), /30 %/);
  assert.deepEqual(anticipo.memory.unanswered, [], 'una pregunta respondida no queda pendiente');
  const reserva = bot.respond('¿Queda reservada mi fecha al enviar la solicitud?');
  assert.match(textOf(reserva), /^No\./);
  for (const question of ['¿Aceptan mascotas?', '¿A qué hora es el check in?', '¿Qué medios de pago aceptan?']) {
    const reply = bot.respond(question);
    assert.ok(hasHandoffChip(reply), question + ' → debe ofrecer el asesor');
    assert.equal(reply.memory.unanswered.at(-1), question, 'la pregunta queda guardada para WhatsApp');
  }
});

group('disponibilidad: no la afirma, la deriva y cotiza si puede', () => {
  const reply = bot.respond('¿Hay disponibilidad el 15 de noviembre?');
  assert.match(textOf(reply), /no la puedo confirmar|asesor/i);
  assert.match(textOf(reply), /cuántas personas/i, 'sigue pidiendo lo que falta');
  assert.doesNotMatch(textOf(reply), /sí hay disponibilidad|está disponible/i);
});

group('pedir un asesor inicia el traspaso; lo que no entiende también', () => {
  const asked = bot.respond('Quiero hablar con un asesor');
  assert.deepEqual(asked.handoff, { auto: true });
  const lost = bot.respond('asdf qwerty zxcv');
  assert.ok(lost.handoff && hasHandoffChip(lost));
  assert.match(textOf(lost), /asesor/);
  assert.equal(lost.memory.unanswered.at(-1), 'asdf qwerty zxcv');
});

group('compara las favoritas y las opciones mencionadas por nombre', () => {
  const mem = { favoriteIds: ['casa-karkinos', 'coralito'] };
  const reply = bot.respond('Compara mis favoritas', mem);
  assert.deepEqual(cardsOf(reply).map(c => c.id), ['casa-karkinos', 'coralito']);
  const named = bot.respond('Hola, me interesan estas opciones: Casa Karkinos, Cabaña Exclusive, Coralito. ¿Me ayudan a elegir y a cotizar?');
  assert.equal(cardsOf(named).length, 3);
});

group('saludo, gracias y preguntas frecuentes', () => {
  assert.ok(bot.respond('hola').chips.length >= 4);
  assert.ok(hasHandoffChip(bot.respond('gracias')));
  assert.equal(bot.respond('preguntas frecuentes').chips.length, 4);
  assert.deepEqual(bot.startChips().map(c => c.label), ['Cotizar un plan', 'Cabañas por capacidad', 'Preguntas frecuentes', 'Hablar con un asesor']);
});

group('una sola cabaña por nombre parcial; nombres repetidos no se confunden', () => {
  assert.equal(bot.respond('cotizar karkinos').memory.propertyId, 'casa-karkinos');
  assert.equal(bot.respond('cuánto cuesta la exclusive').memory.propertyId, 'cabana-exclusive');
  assert.equal(bot.respond('villa').memory.propertyId, undefined, 'una palabra genérica no identifica una cabaña');
});

if (!process.exitCode) console.log(`PASS: ${passed} grupos de pruebas del asistente (personas, fechas, recomendación, cotización, políticas y derivación)`);
