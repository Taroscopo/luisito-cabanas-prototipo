/*
 * Motor de precios puro y verificable: no hace afirmaciones de disponibilidad.
 *
 * Reglas de alojamiento (todas opcionales salvo `rates`):
 *  - rates:                    [{ min, max, nightly }] tarifa base por noche según huéspedes.
 *  - seasons:                  [{ name, from: 'MM-DD', to: 'MM-DD', multiplier }] multiplica la tarifa; admite rangos que cruzan año.
 *  - weekendSurchargePercent:  recargo para las noches de viernes y sábado.
 *  - peakNights / peakSurchargePercent: fechas ISO de noches festivas y su recargo.
 *    Si una noche es de fin de semana y festiva, se aplica el mayor recargo (no se acumulan).
 *  - minimumNights / maxNights: límites; por encima de maxNights se deriva a cotización manual.
 */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const DEFAULT_MAX_NIGHTS = 30;

  /** Convierte 'YYYY-MM-DD' a milisegundos UTC; devuelve NaN si el texto o la fecha no son válidos. */
  function parseIso(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!match) return NaN;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const ms = Date.UTC(y, m - 1, d);
    const check = new Date(ms);
    // Rechaza fechas inexistentes como 2026-02-31, que Date normalizaría en silencio.
    return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? ms : NaN;
  }

  function toIso(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function nightsBetween(start, end) {
    const a = parseIso(start);
    const b = parseIso(end);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    return Math.round((b - a) / DAY_MS);
  }

  function inSeason(season, isoDate) {
    const monthDay = isoDate.slice(5);
    return season.from <= season.to
      ? monthDay >= season.from && monthDay <= season.to
      : monthDay >= season.from || monthDay <= season.to;
  }

  /** Describe cómo se cobra la noche que empieza en `isoDate`. */
  function describeNight(property, isoDate) {
    const weekday = new Date(parseIso(isoDate)).getUTCDay(); // 0 domingo … 5 viernes, 6 sábado
    const isWeekend = weekday === 5 || weekday === 6;
    const isPeak = (property.peakNights || []).includes(isoDate);
    const weekendPct = isWeekend ? property.weekendSurchargePercent || 0 : 0;
    const peakPct = isPeak ? property.peakSurchargePercent || 0 : 0;
    const season = (property.seasons || []).find(item => inSeason(item, isoDate)) || null;
    let kind = 'base';
    if (isPeak && peakPct >= weekendPct && peakPct > 0) kind = 'peak';
    else if (weekendPct > 0) kind = 'weekend';
    return { kind, surchargePercent: Math.max(weekendPct, peakPct), season };
  }

  const NIGHT_LABELS = { base: 'Noche entre semana', weekend: 'Noche de fin de semana', peak: 'Noche festiva' };

  function priceNights(property, tier, startMs, nights) {
    const groups = new Map();
    for (let i = 0; i < nights; i += 1) {
      const iso = toIso(startMs + i * DAY_MS);
      const info = describeNight(property, iso);
      const multiplier = info.season ? info.season.multiplier : 1;
      const unit = Math.round(tier.nightly * multiplier * (1 + info.surchargePercent / 100));
      const label = NIGHT_LABELS[info.kind] + (info.season ? ` · ${info.season.name}` : '');
      const key = `${label}|${unit}`;
      const line = groups.get(key) || { label, quantity: 0, unit, subtotal: 0, unitLabel: 'noche' };
      line.quantity += 1;
      line.subtotal += unit;
      groups.set(key, line);
    }
    return [...groups.values()];
  }

  function withDeposit(result, property, defaultDepositPercent, extra) {
    const depositPercent = property.depositPercent ?? defaultDepositPercent;
    const deposit = Math.round(extra.total * depositPercent / 100);
    return { ...result, ...extra, deposit, balance: extra.total - deposit, depositPercent };
  }

  function calculateQuote(state, todayIso, defaultDepositPercent = 30) {
    const property = state.property;
    const people = Number(state.people);
    const result = {
      valid: true, kind: state.mode, total: null, deposit: null, balance: null,
      nights: 0, rate: null, lines: [], needsManual: false, message: '', people
    };
    const isEvent = state.mode === 'evento' || property.pricingModel === 'manual';
    if (!state.date || Number.isNaN(parseIso(state.date))) return { ...result, valid: false, message: 'Elige una fecha para continuar.' };
    if (state.date < todayIso) return { ...result, valid: false, message: 'Elige una fecha de hoy en adelante.' };
    if (!Number.isFinite(people) || people < 1) return { ...result, valid: false, message: 'Indica una cantidad de personas válida.' };
    if (isEvent) return { ...result, needsManual: true, message: 'Los eventos se cotizan a medida. Pulsa el botón y un asesor te envía la propuesta.' };

    const cap = state.mode === 'pasadia' ? (property.dayPassCapacity || property.capacity) : property.capacity;
    if (people > cap) {
      return { ...result, needsManual: true, message: `El grupo supera la capacidad (${cap} personas). Solicita una cotización a medida.` };
    }

    if (state.mode === 'pasadia') {
      if (state.departure && state.departure < state.date) return { ...result, valid: false, message: 'La salida debe ser igual o posterior a la llegada.' };
      if (state.departure && state.departure > state.date) return { ...result, needsManual: true, message: 'Un pasadía es de un solo día. Para varios días, solicita una cotización a medida.' };
      if (!property.dayPassPrice) return { ...result, needsManual: true, message: 'Esta propiedad cotiza el pasadía a medida. Pulsa el botón y un asesor te responde.' };
      const total = property.dayPassPrice * people;
      const lines = [{ label: 'Pasadía por persona', quantity: people, unit: property.dayPassPrice, subtotal: total, unitLabel: 'persona' }];
      return withDeposit(result, property, defaultDepositPercent, { total, rate: property.dayPassPrice, nights: 1, lines });
    }

    if (!state.departure) return { ...result, valid: false, message: 'Elige la fecha de salida para calcular las noches.' };
    const nights = nightsBetween(state.date, state.departure);
    if (nights <= 0) return { ...result, valid: false, message: 'La fecha de salida debe ser posterior a la llegada.' };
    if (nights < (property.minimumNights || 1)) {
      return { ...result, valid: false, message: `La estancia mínima es de ${property.minimumNights} noche(s).` };
    }
    if (nights > (property.maxNights || DEFAULT_MAX_NIGHTS)) {
      return { ...result, needsManual: true, message: `Las estancias de más de ${property.maxNights || DEFAULT_MAX_NIGHTS} noches se cotizan a medida.` };
    }
    const tier = (property.rates || []).find(rate => people >= rate.min && people <= rate.max);
    if (!tier) return { ...result, needsManual: true, message: 'Para esta cantidad de personas la cotización es a medida. Pulsa el botón y te respondemos.' };

    const lines = priceNights(property, tier, parseIso(state.date), nights);
    const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
    return withDeposit(result, property, defaultDepositPercent, { total, rate: tier.nightly, nights, lines });
  }

  const api = { calculateQuote, nightsBetween, parseIso };
  root.DemoPricing = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
