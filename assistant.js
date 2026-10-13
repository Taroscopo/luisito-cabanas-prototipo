/*
 * Asistente del chat: motor de reglas, sin IA generativa. Entiende lo que escribe la persona (personas, fechas, ubicación,
 * tipo de plan, nombre de la cabaña, amenidades) y responde con datos del catálogo y con el motor de precios.
 *
 * Reglas de honestidad:
 *  - No confirma disponibilidad (no hay calendario): lo dice y deriva al asesor.
 *  - No inventa precios: usa `DemoPricing`; si algo requiere cotización a medida, lo indica.
 *  - No da la dirección exacta: solo el municipio.
 *  - Lo que no sabe (horarios, mascotas, medios de pago…) lo deriva a WhatsApp con la pregunta de la persona.
 *
 * API: DemoAssistant.create({ config, pricing, today }).respond(texto, memoria) → { memory, messages, chips, handoff }
 *  - messages: [{ type: 'text', text } | { type: 'cards', cards } | { type: 'quote', quote }]
 *  - chips:    [{ label, send } | { label, action: 'handoff' }]  (send = texto que se envía como si lo escribiera la persona)
 *  - handoff:  null | { auto: boolean }  (auto = la persona pidió hablar con un asesor)
 */
(function (root) {
  'use strict';

  const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const MONTH_RE = Object.keys(MONTHS).join('|');
  const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const NUMBER_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, cien: 100 };
  const NUMBER_RE = Object.keys(NUMBER_WORDS).join('|');
  const AMENITIES = [
    ['piscina', /piscina|alberca/], ['jacuzzi', /jacuzzi|jacuzi/], ['aire acondicionado', /aire acondicionado|aire acond|\ba\/?c\b|clima/], ['wifi', /wifi|internet/],
    ['parqueadero', /parqueadero|parquear|estacionamiento/], ['cocina equipada', /cocina/], ['zona de asados', /asador|asado|bbq|barbacoa|parrilla/], ['sonido', /sonido|parlante|musica/],
    ['billar', /billar/], ['cancha de fútbol', /cancha|futbol/], ['hamacas', /hamaca/], ['fogata', /fogata/], ['terraza con vista', /terraza/], ['kiosco', /kiosco|rancho/],
    ['frente al mar', /frente al mar|vista al mar|playa|orilla/], ['paseos a caballo', /caballo/], ['cuatrimoto', /cuatrimoto/]
  ];
  const AMENITY_MATCH = {
    'piscina': /piscina/, 'jacuzzi': /jacuzzi/, 'aire acondicionado': /aire acond/, 'wifi': /wifi/, 'parqueadero': /parqueadero/, 'cocina equipada': /cocina/,
    'zona de asados': /asado|asador|fogata/, 'sonido': /sonido/, 'billar': /billar/, 'cancha de fútbol': /cancha|futbol/, 'hamacas': /hamaca/, 'fogata': /fogata/,
    'terraza con vista': /terraza|vista/, 'kiosco': /kiosco|rancho/, 'frente al mar': /mar|playa|orilla/, 'paseos a caballo': /caballo/, 'cuatrimoto': /cuatrimoto/
  };

  const norm = value => String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!,;:()"“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
  const money = (value, locale = 'es-CO') => new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value).replace(/ /g, ' ');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const DAY_MS = 86400000;
  const parseIso = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const toIso = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (iso, n) => toIso(parseIso(iso) + n * DAY_MS);
  const weekdayOf = iso => new Date(parseIso(iso)).getUTCDay();
  const pad = n => String(n).padStart(2, '0');
  const validDay = (y, m, d) => { const ms = Date.UTC(y, m - 1, d); const c = new Date(ms); return c.getUTCFullYear() === y && c.getUTCMonth() === m - 1 && c.getUTCDate() === d; };
  const nextWeekday = (today, dow, includeToday = true) => { let d = includeToday ? today : addDays(today, 1); while (weekdayOf(d) !== dow) d = addDays(d, 1); return d; };

  /** Cambia «doce personas», «dos noches» o «somos quince» por cifras. */
  function digits(text) {
    return text
      .replace(new RegExp(`\\b(${NUMBER_RE})\\b(?=\\s+(?:personas?|pax|invitados?|amigos?|adultos?|noches?|dias?|huespedes?|asistentes))`, 'g'), (_, w) => NUMBER_WORDS[w])
      .replace(new RegExp(`\\b(somos|seremos|grupo de|familia de|unos|para)\\s+(${NUMBER_RE})\\b(?!\\s+de\\s+(?:${MONTH_RE}))`, 'g'), (_, p, w) => `${p} ${NUMBER_WORDS[w]}`);
  }

  function parsePeople(t) {
    let match = /\b(\d{1,3})\s*(?:personas?|pax|invitados?|adultos?|amigos?|gente|huespedes?|asistentes)\b/.exec(t);
    if (!match) match = /\b(?:somos|seremos|grupo de|familia de|unos|para)\s+(\d{1,3})\b(?!\s*(?:de\b|\/|-|noches?|dias?|am\b|pm\b))/.exec(t);
    const n = match ? Number(match[1]) : 0;
    return n >= 1 && n <= 300 ? n : 0;
  }

  /** Fechas: rangos («del 15 al 17 de noviembre»), día suelto, d/m, y expresiones como «este fin de semana» o «el sábado». */
  function parseDates(t, today) {
    const year = Number(today.slice(0, 4));
    const fix = (m, d, y) => {
      let yy = y ? (y < 100 ? 2000 + y : y) : year;
      if (!validDay(yy, m, d)) return '';
      let iso = `${yy}-${pad(m)}-${pad(d)}`;
      if (!y && iso < today) { yy += 1; if (!validDay(yy, m, d)) return ''; iso = `${yy}-${pad(m)}-${pad(d)}`; }
      return iso;
    };
    let match = new RegExp(`\\b(?:del\\s+)?(\\d{1,2})\\s*(?:al|a|-|hasta el)\\s*(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?\\b`).exec(t);
    if (match) {
      const m = MONTHS[match[3]];
      const date = fix(m, Number(match[1]), match[4] && Number(match[4]));
      let departure = fix(m, Number(match[2]), match[4] && Number(match[4]));
      if (date && departure && departure < date) departure = '';
      if (date) return { date, departure: departure || '' };
    }
    match = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?\\b`).exec(t);
    if (match) { const date = fix(MONTHS[match[2]], Number(match[1]), match[3] && Number(match[3])); if (date) return { date, departure: '' }; }
    match = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/.exec(t);
    if (match && Number(match[2]) <= 12) { const date = fix(Number(match[2]), Number(match[1]), match[3] && Number(match[3])); if (date) return { date, departure: '' }; }
    if (/pasado manana/.test(t)) return { date: addDays(today, 2), departure: '' };
    if (/\bmanana\b/.test(t)) return { date: addDays(today, 1), departure: '' };
    if (/\bhoy\b/.test(t)) return { date: today, departure: '' };
    if (/ano nuevo|fin de ano|31 de diciembre/.test(t)) { const d = fix(12, 31); return { date: d, departure: addDays(d, 2) }; }
    if (/navidad/.test(t)) { const d = fix(12, 24); return { date: d, departure: addDays(d, 2) }; }
    if (/fin de semana|finde/.test(t)) {
      let friday = nextWeekday(today, 5);
      if (/proximo|siguiente|otro/.test(t) && !/este/.test(t)) friday = addDays(friday, 7);
      return { date: friday, departure: addDays(friday, 2), weekend: true };
    }
    match = new RegExp(`\\b(?:el|este|proximo|siguiente)?\\s*(${Object.keys(WEEKDAYS).join('|')})\\b`).exec(t);
    if (match) return { date: nextWeekday(today, WEEKDAYS[match[1]], false), departure: '' };
    return null;
  }

  const parseNights = t => {
    const match = /\b(\d{1,2})\s*noches?\b/.exec(t);
    const n = match ? Number(match[1]) : (/\buna noche\b/.test(t) ? 1 : 0);
    return n >= 1 && n <= 30 ? n : 0;
  };

  function create({ config, pricing, today }) {
    const properties = config.properties;
    const locale = config.brand.locale;
    const depositPct = config.brand.defaultDepositPercent;
    const fmt = value => money(value, locale);

    const supports = (p, mode) => mode === 'evento' ? (p.category === 'evento' || (p.amenities || []).some(a => /evento/i.test(a))) : p.categories.includes(mode);
    const capacityFor = (p, mode) => mode === 'pasadia' ? (p.dayPassCapacity || p.capacity) : p.capacity;
    const modeOf = (p, mem) => {
      if (mem.type && supports(p, mem.type)) return mem.type;
      if (mem.date && mem.departure && mem.departure > mem.date && supports(p, 'alojamiento')) return 'alojamiento';
      if (p.category === 'evento') return 'evento';
      if (p.categories.includes('alojamiento')) return mem.date && !mem.departure && supports(p, 'pasadia') ? 'pasadia' : 'alojamiento';
      return 'pasadia';
    };

    /* ---- catálogo: ubicaciones y nombres ---- */
    const GENERIC = /^(atlantico|costa caribe|cerca de barranquilla)$/;
    const placeTerms = p => {
      const raw = [p.city, ...String(p.location).split(',')].map(norm).map(s => s.replace(/^(a \d+ min de|cerca de)\s+/, '')).filter(Boolean);
      return [...new Set(raw)].filter(s => !GENERIC.test(s));
    };
    const cityTerms = [...new Set(properties.flatMap(placeTerms))];
    const matchCities = t => cityTerms.filter(term => new RegExp(`\\b${term}\\b`).test(t));
    const propsInTerms = terms => properties.filter(p => placeTerms(p).some(term => terms.includes(term)));
    const nameTokens = p => {
      const full = norm(p.name);
      const tokens = full.split(' ').filter(w => w.length >= 5 && !['villa', 'casa', 'cabana'].includes(w));
      return { full, tokens };
    };
    const matchProperties = t => properties.filter(p => {
      const { full, tokens } = nameTokens(p);
      if (new RegExp(`\\b${full}\\b`).test(t)) return true;
      return tokens.some(token => new RegExp(`\\b${token}\\b`).test(t) && properties.filter(o => nameTokens(o).tokens.includes(token)).length === 1);
    });
    // Nombre para mostrar de una zona (con tildes y mayúsculas), tomado de las propiedades.
    const showTerm = term => { const hit = properties.find(p => placeTerms(p).includes(term)); return hit ? (norm(hit.city) === term ? hit.city : (String(hit.location).split(',').map(x => x.trim()).find(x => norm(x).endsWith(term)) || term)) : term; };
    const cityLine = p => p.city;

    /* ---- precios ---- */
    const quoteFor = (p, mem) => {
      const mode = modeOf(p, mem);
      if (!mem.people || !mem.date) return null;
      const departure = mode === 'alojamiento' ? mem.departure : (mem.departure || mem.date);
      if (mode === 'alojamiento' && !departure) return null;
      const result = pricing.calculateQuote({ property: p, mode, date: mem.date, departure, people: mem.people }, today, depositPct);
      return { mode, departure, result };
    };
    const fromPrice = (p, mem) => {
      const mode = modeOf(p, mem);
      if (mode === 'evento') return p.eventFrom ? `Desde ${fmt(p.eventFrom)} por persona` : 'Cotización a medida';
      if (mode === 'pasadia' && p.dayPassPrice) return `${fmt(p.dayPassPrice)} por persona`;
      const tier = (p.rates || []).find(r => mem.people && mem.people >= r.min && mem.people <= r.max) || (p.rates || [])[0];
      return tier ? `Desde ${fmt(tier.nightly)} por noche` : 'Cotización a medida';
    };
    const dateText = mem => {
      const f = iso => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)).replace('.', '');
      return mem.departure && mem.departure !== mem.date ? `${f(mem.date)} – ${f(mem.departure)}` : f(mem.date);
    };

    const cardFor = (p, mem) => {
      const mode = modeOf(p, mem);
      const q = quoteFor(p, mem);
      const estimate = q && q.result.valid && !q.result.needsManual ? q.result.total : null;
      return {
        id: p.id, name: p.name, image: p.image, city: cityLine(p),
        capacity: `Hasta ${capacityFor(p, mode)} personas${mode === 'pasadia' ? ' · pasadía' : mode === 'evento' ? ' · evento' : ''}`,
        price: estimate ? `Estimado ${fmt(estimate)}` : fromPrice(p, mem)
      };
    };

    /* ---- piezas de respuesta ---- */
    const text = value => ({ type: 'text', text: value });
    const ASK_PEOPLE = [4, 8, 12, 20].map(n => ({ label: `${n} personas`, send: `${n} personas` }));
    const HANDOFF = { label: 'Continuar en WhatsApp', action: 'handoff', primary: true };
    const ADVISOR_NOTE = 'La disponibilidad no la puedo confirmar yo: la revisa un asesor con el propietario, sin ningún cobro.';

    const startChips = () => [
      { label: 'Cotizar un plan', send: 'Quiero cotizar un plan' },
      { label: 'Cabañas por capacidad', send: 'Qué cabañas hay según la capacidad' },
      { label: 'Preguntas frecuentes', send: 'Preguntas frecuentes' },
      { label: 'Hablar con un asesor', action: 'handoff' }
    ];
    const faqChips = () => [
      { label: '¿Cómo funciona el anticipo?', send: 'Cómo funciona el anticipo' },
      { label: '¿Puedo ir solo por el día?', send: 'Puedo ir solo por el día' },
      { label: '¿Queda reservada mi fecha?', send: 'Queda reservada mi fecha al enviar la solicitud' },
      { label: '¿Aceptan mascotas?', send: 'Aceptan mascotas' }
    ];

    function askMissing(mem, p) {
      const mode = p ? modeOf(p, mem) : (mem.type || '');
      if (!mem.people) return { messages: [text('¿Para cuántas personas es el plan?')], chips: ASK_PEOPLE };
      if (!mem.date) {
        const chips = [{ label: 'Este fin de semana', send: 'este fin de semana' }, { label: 'Próximo fin de semana', send: 'el próximo fin de semana' }];
        if (!p || supports(p, 'pasadia')) chips.push({ label: 'Solo por el día', send: 'pasadía este sábado' });
        return { messages: [text('¿Qué fechas tienes en mente? Puedes escribir «del 15 al 17 de noviembre», «este fin de semana» o «el sábado».')], chips };
      }
      if (!mem.departure && mode !== 'pasadia' && mode !== 'evento') {
        const chips = [1, 2, 3].map(n => ({ label: plural(n, 'noche', 'noches'), send: plural(n, 'noche', 'noches') }));
        if (!p || supports(p, 'pasadia')) chips.unshift({ label: 'Pasadía', send: 'pasadía' });
        return { messages: [text(`¿Es un pasadía o te quedas a dormir? Si te quedas, dime cuántas noches desde el ${dateText(mem)}.`)], chips };
      }
      return null;
    }

    /** Cotización de una cabaña concreta con lo que ya se sabe; si falta algo, lo pregunta. */
    function quoteReply(p, mem) {
      const missing = askMissing(mem, p);
      if (missing) {
        const lead = `Con gusto cotizo ${p.name}. `;
        missing.messages[0] = text(lead + missing.messages[0].text);
        return missing;
      }
      const q = quoteFor(p, mem);
      const { result } = q;
      const messages = [];
      if (!result.valid) messages.push(text(result.message));
      else if (result.needsManual) messages.push(text(`${p.name}: ${result.message}`));
      else {
        messages.push({ type: 'quote', quote: {
          id: p.id, name: p.name, image: p.image, when: dateText(mem), people: mem.people, mode: q.mode,
          nights: q.mode === 'alojamiento' ? result.nights : null, total: fmt(result.total), deposit: fmt(result.deposit), depositPercent: result.depositPercent,
          lines: result.lines.map(line => `${line.quantity} × ${line.label.toLowerCase()} · ${fmt(line.unit)}`)
        } });
        messages.push(text(`Es un valor estimado. ${ADVISOR_NOTE}`));
      }
      return { messages, chips: [HANDOFF, { label: 'Ver ficha', action: 'open-property', id: p.id }, { label: 'Ver otras opciones', send: 'otras opciones' }], handoff: result.needsManual ? { auto: false } : null };
    }

    /** Recomienda cabañas según personas, ubicación y tipo de plan. */
    function recommend(mem, t) {
      const missing = !mem.people ? askMissing(mem, null) : null;
      if (missing) {
        const lead = mem.cities && mem.cities.length ? `Tengo opciones en ${mem.cities.map(showTerm).join(' y ')}. ` : '';
        missing.messages[0] = text(lead + missing.messages[0].text);
        return missing;
      }
      const mode = mem.type || (mem.date && mem.departure && mem.departure > mem.date ? 'alojamiento' : '');
      const inCity = list => mem.cities && mem.cities.length ? list.filter(p => propsInTerms(mem.cities).includes(p)) : list;
      // Sin tipo de plan elegido, cada cabaña se ofrece en el primer tipo en el que le cabe el grupo.
      const fitMode = p => (mode ? [mode] : ['alojamiento', 'pasadia', 'evento']).find(m => supports(p, m) && capacityFor(p, m) >= mem.people) || '';
      const fits = p => Boolean(fitMode(p));
      let list = inCity(properties).filter(fits);
      let relaxed = false;
      if (!list.length && mem.cities && mem.cities.length) { list = properties.filter(fits); relaxed = true; }
      if (/otras? opcion|mas opciones|otra cabana|siguientes/.test(t)) list = list.filter(p => !(mem.shown || []).includes(p.id));
      list.sort((a, b) => (capacityFor(a, fitMode(a)) - capacityFor(b, fitMode(b))) || ((a.rates?.[0]?.nightly || a.dayPassPrice || 0) - (b.rates?.[0]?.nightly || b.dayPassPrice || 0)));
      if (!list.length) {
        const biggest = properties.reduce((m, p) => Math.max(m, capacityFor(p, 'alojamiento')), 0);
        return { messages: [text(`Para ${plural(mem.people, 'persona', 'personas')} no tengo una opción que encaje por aquí${mem.people > biggest ? `; la más grande recibe hasta ${biggest} personas` : ''}. Un asesor puede armarte una propuesta a medida o dividir el grupo.`)], chips: [HANDOFF, { label: 'Cambiar personas', send: 'cambiar el número de personas' }], handoff: { auto: false } };
      }
      const top = list.slice(0, 3);
      mem.shown = [...new Set([...(mem.shown || []), ...top.map(p => p.id)])];
      const where = mem.cities && mem.cities.length && !relaxed ? ` en ${mem.cities.map(showTerm).join(' y ')}` : '';
      const lead = relaxed
        ? `No tengo cabañas en esa zona para ${plural(mem.people, 'persona', 'personas')}, pero estas sí encajan:`
        : `Para ${plural(mem.people, 'persona', 'personas')}${where}${mode === 'pasadia' ? ' en pasadía' : mode === 'evento' ? ' en un evento' : ''} te recomiendo:`;
      const messages = [text(lead), { type: 'cards', cards: top.map(p => cardFor(p, { ...mem, type: fitMode(p) })) }];
      const follow = [];
      if (!mem.date) follow.push(text('Dime las fechas y te calculo el valor estimado de cada una.'));
      else follow.push(text(`Los valores son estimados. ${ADVISOR_NOTE}`));
      return { messages: [...messages, ...follow], chips: [HANDOFF, !mem.date ? { label: 'Este fin de semana', send: 'este fin de semana' } : { label: 'Cambiar fechas', send: 'cambiar las fechas' }, { label: 'Ver otras opciones', send: 'otras opciones' }] };
    }

    function respond(input, previous) {
      const raw = String(input || '').trim();
      const t = digits(norm(raw));
      const mem = { ...(previous || {}), asked: [...((previous && previous.asked) || []), raw].slice(-8), unanswered: [...((previous && previous.unanswered) || [])] };

      /* ---- entidades ---- */
      const people = parsePeople(t);
      if (people) mem.people = people;
      const nights = parseNights(t);
      const dates = parseDates(t, today);
      if (/pasadia|por el dia|solo el dia|dia de sol|ir y volver|dia completo/.test(t)) mem.type = 'pasadia';
      else if (/evento|cumple|boda|matrimonio|quinceanera|despedida|celebracion|fiesta|reunion|empresarial|bautizo|aniversario|grado/.test(t)) mem.type = 'evento';
      else if (/dormir|alojamiento|hospedaje|quedarnos|quedarme|\bnoches?\b|fin de semana|habitaciones/.test(t) && !/pasadia/.test(t)) mem.type = mem.type === 'evento' ? 'evento' : 'alojamiento';
      if (dates) { mem.date = dates.date; mem.departure = dates.departure; if (dates.weekend && mem.type === 'pasadia') mem.date = addDays(dates.date, 1); }
      if (nights && mem.date) { mem.departure = addDays(mem.date, nights); if (mem.type === 'pasadia') mem.type = 'alojamiento'; }
      if (mem.type === 'pasadia' && mem.date) mem.departure = '';
      const cities = matchCities(t);
      const regional = /atlantico/.test(t) && !cities.length;
      if (cities.length) { mem.cities = cities; mem.cityNames = cities.map(showTerm); }
      if (/cambiar la ubicacion|otra zona|otra ubicacion/.test(t)) { mem.cities = []; mem.cityNames = []; }
      if (/cambiar (?:el numero|las personas)|otro numero de personas/.test(t)) mem.people = 0;
      if (/cambiar las fechas|otras fechas|otra fecha/.test(t)) { mem.date = ''; mem.departure = ''; }
      const named = matchProperties(t);
      if (named.length === 1) mem.propertyId = named[0].id;
      const subject = mem.propertyId ? properties.find(p => p.id === mem.propertyId) : null;
      const ask = (re) => re.test(t);
      const done = (result, answered = true) => {
        if (!answered) mem.unanswered.push(raw);
        return { memory: mem, messages: result.messages, chips: result.chips || [], handoff: result.handoff || null };
      };

      /* ---- intenciones ---- */
      if (ask(/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos)$/) ) {
        return done({ messages: [text('¡Hola! Cuéntame qué buscas. Puedo recomendarte cabañas según las personas y la ubicación, calcular un valor estimado y resolver dudas frecuentes.')], chips: startChips() });
      }
      if (ask(/^(gracias|muchas gracias|listo gracias|ok gracias|perfecto gracias|chao|adios|hasta luego)$/)) {
        return done({ messages: [text('¡Con gusto! Si quieres seguir con un asesor, puedo dejar tu mensaje listo en WhatsApp.')], chips: [HANDOFF, { label: 'Cotizar un plan', send: 'Quiero cotizar un plan' }] });
      }
      if (ask(/asesor|agente|humano|persona real|hablar con alguien|llamar|llamada|whatsapp|wasap|contactar/)) {
        return done({ messages: [text('Claro, te paso con un asesor por WhatsApp. Solo necesito unos datos para dejar tu mensaje listo.')], handoff: { auto: true } });
      }
      if (ask(/preguntas frecuentes|^faq$|dudas frecuentes|que puedo preguntar/)) {
        return done({ messages: [text('Estas son las dudas más comunes. Toca una o escríbeme la tuya.')], chips: faqChips() });
      }
      if (ask(/^(quiero cotizar|cotizar un plan|cotizar|quiero reservar|reservar)( un plan)?$/)) {
        return done(mem.people ? recommend(mem, t) : askMissing(mem, null));
      }
      /* políticas: se contestan lo que se sabe y lo demás va al asesor */
      if (ask(/anticipo|abono|separar|apartar|adelanto/) || (ask(/reserva|reservar/) && ask(/como|cuando|que necesito|pago|pagar/))) {
        return done({ messages: [text(`Para separar la fecha se paga un anticipo del ${depositPct} % una vez el asesor confirma la disponibilidad con el propietario. El saldo y las condiciones dependen de cada cabaña, y te los confirma antes de que pagues. Primero no se cobra nada.`)], chips: [HANDOFF, { label: 'Cotizar un plan', send: 'Quiero cotizar un plan' }] });
      }
      if (ask(/queda reservada|fecha reservada|se reserva|quedo reservado|quedo reservada/)) {
        return done({ messages: [text('No. Al enviar tu solicitud la fecha no queda reservada: primero un asesor confirma la disponibilidad con el propietario y te responde antes de que hagas cualquier pago.')], chips: [HANDOFF, { label: 'Cotizar un plan', send: 'Quiero cotizar un plan' }] });
      }
      if (ask(/cancel|reembolso|devolu|cambio de fecha|reprogram/)) {
        return done({ messages: [text('Las condiciones de cancelación y cambio de fecha dependen de cada cabaña. Un asesor te las confirma antes de cualquier pago.')], chips: [HANDOFF], handoff: { auto: false } });
      }
      if (ask(/check ?in|check ?out|hora de (?:llegada|salida|entrada)|horario|a que hora|desde que hora|hasta que hora/)) {
        return done({ messages: [text('Los horarios de entrada y de salida los define cada propietario. No los tengo a la mano: un asesor te los confirma por WhatsApp.')], chips: [HANDOFF], handoff: { auto: false } }, false);
      }
      if (ask(/mascota|perro|gato|animales de compania|ninos|bebes?|menores/)) {
        return done({ messages: [text('Eso depende de cada propietario (mascotas, niños y reglas de la casa). Un asesor te lo confirma por WhatsApp.')], chips: [HANDOFF], handoff: { auto: false } }, false);
      }
      if (ask(/medio de pago|metodos? de pago|formas? de pago|tarjeta|nequi|daviplata|transferencia|efectivo|pse|factura/)) {
        return done({ messages: [text('Los medios de pago se acuerdan con el asesor una vez confirmada la disponibilidad. No se cobra nada antes de eso.')], chips: [HANDOFF], handoff: { auto: false } }, false);
      }
      if (ask(/como funciona|como funcionan|que incluye el servicio|que hacen ustedes|quienes son/)) {
        return done({ messages: [text('Elijo cabañas, pasadías y espacios para eventos en la costa Caribe. Tú me dices cuántos son y cuándo, te muestro las opciones con un valor estimado y un asesor confirma la disponibilidad con el propietario. No se cobra nada hasta que esté confirmado.')], chips: [{ label: 'Cotizar un plan', send: 'Quiero cotizar un plan' }, HANDOFF] });
      }
      if (ask(/favorit/) || (named.length > 1 && ask(/interesan|compar|elegir|cotizar|opciones/))) {
        const wanted = named.length > 1 ? named : (previous && previous.favoriteIds || []).map(id => properties.find(p => p.id === id)).filter(Boolean);
        if (wanted.length) {
          return done({ messages: [text(`Estas son las opciones que te interesan. Si me dices cuántos son y las fechas, calculo el valor estimado de cada una.`), { type: 'cards', cards: wanted.slice(0, 4).map(p => cardFor(p, mem)) }, ...(mem.people && mem.date ? [] : [text(!mem.people ? '¿Para cuántas personas?' : '¿Qué fechas tienes en mente?')])], chips: !mem.people ? ASK_PEOPLE : [HANDOFF] });
        }
        return done({ messages: [text('Aún no has guardado favoritas. Toca el corazón de una cabaña y la comparamos aquí.')], chips: [{ label: 'Cotizar un plan', send: 'Quiero cotizar un plan' }] });
      }
      /* consultas sobre una cabaña concreta o sobre el catálogo */
      const wantsAvailability = ask(/disponib|libre|disponible|hay cupo|hay espacio|esta ocupad/);
      const wantsPrice = ask(/precio|cuanto cuesta|cuanto vale|cuanto sale|tarifa|valor|costo|cotiz|presupuesto|barat|economic/);
      const wantsCapacity = ask(/capacidad|cuantas personas|cuantos pueden|cupo|caben|cabemos|aforo|maximo de personas|cuantos caben/);
      const wantsPlace = ask(/donde (?:queda|esta|se ubica)|ubicacion|ubicad|como llegar|direccion|en que ciudad|que tan lejos|queda cerca/);
      const wantsRooms = ask(/habitacion|cuartos|camas|literas|dormitorios/);
      const amenity = AMENITIES.find(([, re]) => re.test(t));

      if (wantsPlace && !wantsPrice) {
        if (subject) return done({ messages: [text(`${subject.name} queda en ${cityLine(subject)}. La ubicación exacta la comparte el asesor cuando se confirma la reserva.`)], chips: [{ label: 'Cotizar ' + subject.name, send: `Cotizar ${subject.name}` }, { label: 'Ver ficha', action: 'open-property', id: subject.id }] });
        if (cities.length) {
          const list = propsInTerms(cities);
          if (list.length) return done({ messages: [text(`En esa zona tengo ${plural(list.length, 'opción', 'opciones')}:`), { type: 'cards', cards: list.slice(0, 4).map(p => cardFor(p, mem)) }], chips: !mem.people ? ASK_PEOPLE : [HANDOFF] });
        }
        const places = [...new Set(properties.map(p => p.city))];
        return done({ messages: [text(`Tengo cabañas en: ${places.join(', ')}. ¿Qué zona te interesa?`)], chips: places.slice(0, 5).map(c => ({ label: c, send: `Cabañas en ${c}` })) });
      }
      if (wantsRooms && subject) {
        const rooms = (subject.facts || []).find(f => /habitaci/i.test(f.label));
        return done({ messages: [text(rooms ? `${subject.name} tiene ${rooms.value} habitaciones.` : `${subject.name}: ${subject.rooms}.`)], chips: [{ label: 'Cotizar ' + subject.name, send: `Cotizar ${subject.name}` }, HANDOFF] });
      }
      if (amenity && !wantsPrice) {
        const [label] = amenity;
        const match = AMENITY_MATCH[label];
        const has = p => (p.amenities || []).some(a => match.test(norm(a)));
        if (subject) {
          const yes = has(subject);
          return done({ messages: [text(yes ? `Sí, ${subject.name} cuenta con ${label}.` : `No tengo ${label} registrado en ${subject.name}. Un asesor puede confirmártelo con el propietario.`)], chips: yes ? [{ label: 'Cotizar ' + subject.name, send: `Cotizar ${subject.name}` }] : [HANDOFF] }, yes);
        }
        let list = properties.filter(has);
        if (cities.length) list = list.filter(p => propsInTerms(cities).includes(p));
        if (mem.people) list = list.filter(p => capacityFor(p, 'alojamiento') >= mem.people || capacityFor(p, 'pasadia') >= mem.people);
        if (!list.length) return done({ messages: [text(`No encuentro cabañas con ${label} que encajen con lo que buscas. Un asesor puede revisar más opciones.`)], chips: [HANDOFF], handoff: { auto: false } }, false);
        return done({ messages: [text(`Con ${label} tengo ${plural(list.length, 'opción', 'opciones')}${list.length > 4 ? '; estas son algunas' : ''}:`), { type: 'cards', cards: list.slice(0, 4).map(p => cardFor(p, mem)) }], chips: !mem.people ? ASK_PEOPLE : [HANDOFF] });
      }
      if (wantsCapacity && !people) {
        if (subject) {
          const parts = [];
          if (subject.categories.includes('alojamiento') && subject.category !== 'evento') parts.push(`${capacityFor(subject, 'alojamiento')} personas para alojamiento`);
          if (subject.categories.includes('pasadia')) parts.push(`${capacityFor(subject, 'pasadia')} para pasadía`);
          if (subject.category === 'evento') parts.push(`${subject.capacity} personas para eventos`);
          return done({ messages: [text(`${subject.name} recibe hasta ${parts.join(' y ')}.`)], chips: [{ label: 'Cotizar ' + subject.name, send: `Cotizar ${subject.name}` }, HANDOFF] });
        }
        const caps = properties.map(p => capacityFor(p, 'alojamiento'));
        return done({ messages: [text(`Tengo opciones desde ${Math.min(...caps)} hasta ${Math.max(...caps)} personas. Dime cuántos son y te recomiendo las que encajan.`)], chips: ASK_PEOPLE });
      }
      if (subject && (wantsPrice || wantsAvailability || people || dates || nights || mem.type || ask(/^(cotizar|quiero cotizar)/))) {
        const lead = wantsAvailability ? [text(ADVISOR_NOTE + ' Mientras tanto, te armo la cotización.')] : [];
        const reply = quoteReply(subject, mem);
        return done({ ...reply, messages: [...lead, ...reply.messages] });
      }
      if (wantsAvailability && !people && !dates && !cities.length && !subject) {
        const reply = askMissing(mem, null) || recommend(mem, t);
        return done({ messages: [text(ADVISOR_NOTE), ...reply.messages], chips: reply.chips });
      }
      if (people || dates || nights || cities.length || regional || mem.type || wantsPrice || wantsAvailability || wantsCapacity || ask(/^(quiero cotizar|cotizar|cabanas?|busco|necesito|quiero)\b|opcion|recomiend|sugier|que cabanas|otras? opcion|mas opciones/)) {
        // Si venimos de elegir noches o pasadía sobre una lista ya mostrada, se mantiene el contexto.
        const reply = recommend(mem, t);
        return done({ ...reply, messages: (wantsAvailability ? [text(ADVISOR_NOTE)] : []).concat(reply.messages) });
      }
      /* sin respuesta: se deriva al asesor con la pregunta ya guardada */
      mem.unanswered.push(raw);
      return { memory: mem, messages: [text('Esa consulta la atiende mejor un asesor, porque necesito confirmarla con el propietario. No te preocupes: dejo tu pregunta lista para que sigas tu cotización en WhatsApp. Toca el botón de abajo.')], chips: [HANDOFF], handoff: { auto: false } };
    }

    return { respond, startChips, faqChips };
  }

  const api = { create, norm, parsePeople, parseDates, parseNights, digits };
  root.DemoAssistant = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
