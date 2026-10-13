(() => {
  'use strict';

  const CONFIG = window.DEMO_CONFIG;
  const Pricing = window.DemoPricing;
  const Assistant = window.DemoAssistant;
  let assistantBot = null; // se crea al abrir el chat, con la fecha de ese momento
  const assistant = () => assistantBot || (assistantBot = Assistant.create({ config: CONFIG, pricing: Pricing, today: datePlus(0) }));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const propertyModal = $('#propertyModal');
  const contactModal = $('#contactModal');
  const toast = $('#toast');
  const propertyGrid = $('#propertyGrid');
  const fab = $('#waFab');
  const fabLabel = $('#waLabel');
  let activeLocation = 'all';
  let showFavorites = false;
  let page = 1;
  const PAGE_SIZE = Math.max(1, Number(CONFIG.brand.pageSize) || 9); // el catálogo se muestra de a 9 para que cargue ligero
  let activeProperty = null;
  let activeMode = 'alojamiento';
  let currentEstimate = null;
  const restoreFocusTo = new WeakMap(); // modal → elemento que tenía el foco al abrirlo
  let toastTimer = null;

  /* ---------- Favoritos (se guardan en el navegador de cada persona) ---------- */
  const FAVORITES_KEY = 'luisito:favoritos';
  const favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch (_) { return []; } })());
  const persistFavorites = () => { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch (_) { /* modo privado: solo dura la sesión */ } };

  /* ---------- Plantillas con escape automático ----------
   * `html` escapa todo valor interpolado salvo el marcado ya seguro (otra plantilla `html` o `raw`).
   * Así, aunque los datos de las propiedades vengan algún día de un CMS, no pueden inyectar HTML. */
  class Safe { constructor(markup) { this.markup = markup; } }
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const toMarkup = value => value instanceof Safe ? value.markup : Array.isArray(value) ? value.map(toMarkup).join('') : escapeHtml(value);
  const html = (strings, ...values) => new Safe(strings.reduce((out, chunk, i) => out + chunk + (i < values.length ? toMarkup(values[i]) : ''), ''));
  const raw = markup => new Safe(markup);
  const setHtml = (element, template) => { element.innerHTML = template.markup; };

  const formatCOP = value => new Intl.NumberFormat(CONFIG.brand.locale, {
    style: 'currency', currency: CONFIG.brand.currency, maximumFractionDigits: 0
  }).format(value).replace(/ /g, ' ');

  const shortDate = iso => new Intl.DateTimeFormat(CONFIG.brand.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)).replace('.', '');

  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

  /** Los iconos viven en el sprite de index.html (#i-nombre): una sola colección, un solo trazo. */
  const icon = (name, cls = '') => html`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

  /** Amenidad → icono, por palabra clave (sin tildes). Lo que no coincide usa una marca de verificación. */
  const AMENITY_ICONS = [
    [/piscina/, 'pool'], [/jacuzzi|jacuzi/, 'tub'], [/kiosco|rancho/, 'tent'], [/sonido|musica|parlante/, 'speaker'],
    [/hamaca/, 'palm'], [/terraza|vista/, 'sunset'], [/caballo/, 'horse'], [/cuatrimoto|moto/, 'moto'], [/parqueadero|estacionamiento/, 'car'], [/aire acond/, 'snow'],
    [/cocina/, 'pot'], [/wifi|internet/, 'wifi'], [/zonas? (de )?(verde|cesped)|jardin|animales/, 'trees'], [/billar/, 'billiard'],
    [/cancha|futbol/, 'goal'], [/juegos|columpio|trampolin|domino/, 'gamepad'], [/asado|asador|bbq|parrilla|fogata/, 'flame'],
    [/television|\btv\b/, 'tv'], [/restaurante|orilla/, 'utensils'], [/habitacion|literas/, 'bed'], [/evento|salon/, 'users'],
    [/pergola/, 'tent'], [/mar\b|playa/, 'waves']
  ];
  const amenityIcon = label => {
    const text = String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const match = AMENITY_ICONS.find(([pattern]) => pattern.test(text));
    return match ? match[1] : 'check';
  };

  /* ---------- Textos de precio ---------- */
  const modalPrice = (property, mode) => {
    if (mode === 'pasadia' && property.dayPassPrice) return { amount: formatCOP(property.dayPassPrice), suffix: 'por persona' };
    if (mode === 'evento' || property.category === 'evento') return { amount: `Desde ${formatCOP(property.eventFrom || 0)}`, suffix: property.eventPriceBasis || 'por evento' };
    const first = property.rates && property.rates[0];
    return first ? { amount: `Desde ${formatCOP(first.nightly)}`, suffix: 'por noche' } : { amount: 'Cotización requerida', suffix: '' };
  };

  const typeLabel = property => {
    if (property.category === 'evento') return 'Evento privado';
    if (property.categories.includes('pasadia')) return 'Alojamiento y pasadía';
    return 'Alojamiento';
  };

  /**
   * Precio de la tarjeta: «Desde» + el valor del plan más barato y, debajo, para cuántas personas es.
   * Alojamiento: tarifa por noche del primer rango. Pasadía y eventos (precio por persona): valor para un grupo de referencia.
   */
  const featuredPrice = property => {
    const group = cap => Math.min(10, cap);
    const people = count => plural(count, 'persona', 'personas');
    if (property.category === 'evento') {
      const n = group(property.capacity);
      return { amount: formatCOP((property.eventFrom || 0) * n), suffix: people(n) };
    }
    const first = property.rates && property.rates[0];
    if (first) return { amount: formatCOP(first.nightly), suffix: people(first.max) };
    if (property.dayPassPrice) {
      const n = group(property.dayPassCapacity || property.capacity);
      return { amount: formatCOP(property.dayPassPrice * n), suffix: people(n) };
    }
    return { amount: 'Cotizar', suffix: 'según el plan' };
  };

  /** Solo el municipio: la dirección exacta se comparte por el canal interno. */
  const cityOf = property => property.city || String(property.location).split(',')[0].trim();

  /* ---------- Catálogo ---------- */
  function propertyCardTemplate(property, index) {
    const price = featuredPrice(property);
    const specs = property.cardSpecs || [
      { icon: 'users', text: property.capacityLabel },
      { icon: property.category === 'evento' ? 'calendar' : 'bed', text: property.rooms },
      { icon: 'pool', text: property.amenities[0] || 'Experiencia privada' }
    ];
    return html`<article class="property-card reveal" style="--i:${index}" data-property-card="${property.id}">
      <div class="card-visual">
        <button class="card-image-button" data-open-property="${property.id}" aria-label="Abrir la ficha de ${property.name}">
          <img src="${property.image}" alt="${property.name}" loading="lazy" />
          <span class="card-overlay">
            <span class="card-overlay-main">
              <span class="card-title">${property.name}</span>
              <span class="card-location">${icon('pin')}<span>${property.location}</span></span>
            </span>
            <span class="card-price"><small>Desde</small><strong>${price.amount}</strong><small>${price.suffix}</small></span>
            <span class="card-arrow" aria-hidden="true">${icon('arrow-up-right')}</span>
          </span>
        </button>
        <button class="card-heart ${favorites.has(property.id) ? 'is-saved' : ''}" type="button" data-action="save-property" data-property-id="${property.id}" aria-label="Guardar ${property.name} en favoritos" aria-pressed="${favorites.has(property.id)}">${icon(favorites.has(property.id) ? 'heart-fill' : 'heart')}</button>
      </div>
      <div class="card-footer">
        <div class="card-specs">${specs.map(spec => html`<span class="card-spec">${icon(spec.icon)}<span>${spec.text}</span></span>`)}</div>
      </div>
    </article>`;
  }

  /* ---------- Filtro por ubicación ---------- */
  const locationButton = $('#locButton');
  const locationMenu = $('#locMenu');

  function locationCounts() {
    const counts = new Map();
    CONFIG.properties.forEach(property => counts.set(cityOf(property), (counts.get(cityOf(property)) || 0) + 1));
    return [...counts].sort((a, b) => a[0].localeCompare(b[0], CONFIG.brand.locale));
  }

  function renderLocationMenu() {
    const options = [['all', 'Todas las ubicaciones', CONFIG.properties.length], ...locationCounts().map(([city, count]) => [city, city, count])];
    setHtml(locationMenu, html`${options.map(([value, label, count], i) => html`<button type="button" role="option" class="loc-option" style="--i:${i}" data-location="${value}" aria-selected="${value === activeLocation}"><span>${label}</span><span class="loc-meta"><small>${count}</small>${icon('check')}</span></button>`)}`);
  }

  function setLocationMenu(open) {
    locationMenu.classList.toggle('is-open', open);
    locationButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const selected = $('[aria-selected="true"]', locationMenu) || $('.loc-option', locationMenu);
      window.setTimeout(() => selected && selected.focus({ preventScroll: true }), 40);
    }
  }

  function renderCards(location = activeLocation, targetPage = 1) {
    activeLocation = location;
    const visible = CONFIG.properties.filter(property => (location === 'all' || cityOf(property) === location) && (!showFavorites || favorites.has(property.id)));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    page = Math.min(Math.max(1, targetPage), pages);
    const shown = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    setHtml(propertyGrid, shown.length
      ? html`${shown.map(propertyCardTemplate)}`
      : showFavorites
        ? html`<div class="empty-state"><strong>Aún no tienes favoritas${location === 'all' ? '' : ' en esta ubicación'}</strong><span>Toca el corazón de una cabaña para guardarla aquí y compararla con calma.</span><button type="button" class="button button-outline" data-action="show-all">Ver todas las cabañas</button></div>`
        : html`<div class="empty-state"><strong>No hay opciones en esta ubicación</strong><button type="button" class="button button-outline" data-location="all">Ver todas las ubicaciones</button></div>`);
    renderPager(visible.length, pages);
    $('#locLabel').textContent = location === 'all' ? 'Ubicación' : location;
    locationButton.classList.toggle('is-filtered', location !== 'all');
    $('#resultCount').textContent = showFavorites ? plural(visible.length, 'favorita', 'favoritas') : plural(visible.length, 'opción', 'opciones');
    renderLocationMenu();
    syncFavorites();
    observeReveals();
  }

  /** Paginador del catálogo: «Anterior · 1 2 3 · Siguiente» (en móvil, «Página 2 de 3»). */
  function renderPager(total, pages) {
    const pager = $('#pager');
    pager.hidden = pages <= 1;
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, page * PAGE_SIZE);
    const numbers = Array.from({ length: pages }, (_, i) => i + 1).map(n => html`<button type="button" class="pager-number" data-page="${n}" aria-label="Página ${n}"${n === page ? html` aria-current="page"` : ''}>${n}</button>`);
    setHtml(pager, html`<p class="pager-info" aria-live="polite">Mostrando ${from}–${to} de ${total}</p>
      <div class="pager-controls">
        <button type="button" class="pager-step" data-page="${page - 1}"${page === 1 ? ' disabled' : ''}>${icon('caret-left')}<span>Anterior</span></button>
        <div class="pager-numbers">${numbers}</div>
        <span class="pager-status">Página ${page} de ${pages}</span>
        <button type="button" class="pager-step" data-page="${page + 1}"${page === pages ? ' disabled' : ''}><span>Siguiente</span>${icon('caret-right')}</button>
      </div>`);
  }

  /** Estado visible de los favoritos: contador, botón de la barra y botón flotante. */
  function syncFavorites() {
    const toggle = $('#favToggle');
    const count = $('#favCount');
    count.textContent = favorites.size;
    count.hidden = favorites.size === 0;
    toggle.setAttribute('aria-pressed', String(showFavorites));
    toggle.classList.toggle('is-active', showFavorites);
    toggle.setAttribute('aria-label', favorites.size ? `Ver mis favoritos (${favorites.size})` : 'Ver mis favoritos');
    syncFab();
  }

  function observeReveals() {
    const items = $$('.reveal:not(.is-observed)');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(item => item.classList.add('is-visible', 'is-observed'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entry.target.classList.add('is-observed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(item => observer.observe(item));
  }

  /* ---------- Fechas ---------- */
  function isoDate(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function datePlus(days) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return isoDate(d); }

  const addDays = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

  /* ---------- Ficha de propiedad ---------- */
  /** Pantalla vertical (9:16): el reel de la propiedad o, mientras no exista, un marcador con su foto principal. */
  function reelTemplate(property) {
    if (property.videoUrl) {
      return html`<video id="modalMainVideo" data-action="reel-toggle" playsinline loop preload="auto" poster="${property.gallery[0]}" aria-label="Reel de ${property.name}. Toca para pausar o reanudar."><source src="${property.videoUrl}" type="video/mp4" /></video>
        <div class="reel-controls">
          <button type="button" class="reel-btn reel-toggle" data-action="reel-toggle" aria-label="Pausar el reel"><span class="i-pause">${icon('pause')}</span><span class="i-play">${icon('play')}</span></button>
          <button type="button" class="reel-btn reel-sound" data-action="reel-sound" aria-label="Activar el sonido" aria-pressed="false"><span class="i-on">${icon('volume')}</span><span class="i-off">${icon('volume-off')}</span><span class="reel-sound-hint">Activar sonido</span></button>
        </div>
        <span class="reel-progress" aria-hidden="true"><i></i></span>`;
    }
    return html`<img id="modalMainImage" src="${property.gallery[0]}" alt="${property.name}, vista previa del reel" /><span class="reel-badge">Reel · demo</span>`;
  }

  /* Reel con sonido: se arranca dentro del clic que abrió la ficha, que es lo que permiten los navegadores.
     Si aun así el navegador lo bloquea, se reproduce en silencio y se invita a activar el sonido con un toque. */
  let reelSound = true; // preferencia de la persona durante la visita
  const reelVideo = () => $('#modalStage video', propertyModal);
  function syncReelUi(stage, video) {
    stage.classList.toggle('is-muted', video.muted);
    stage.classList.toggle('is-paused', video.paused);
    const sound = $('.reel-sound', stage);
    const toggle = $('.reel-toggle', stage);
    if (sound) { sound.setAttribute('aria-pressed', String(!video.muted)); sound.setAttribute('aria-label', video.muted ? 'Activar el sonido' : 'Silenciar el reel'); }
    if (toggle) toggle.setAttribute('aria-label', video.paused ? 'Reproducir el reel' : 'Pausar el reel');
  }
  function startReel() {
    const stage = $('#modalStage', propertyModal);
    const video = stage && $('video', stage);
    if (!video) return;
    video.muted = !reelSound;
    stage.classList.remove('needs-sound');
    ['play', 'pause', 'volumechange'].forEach(type => video.addEventListener(type, () => syncReelUi(stage, video)));
    video.addEventListener('timeupdate', () => { if (video.duration) stage.style.setProperty('--p', String(video.currentTime / video.duration)); });
    syncReelUi(stage, video);
    const attempt = video.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        video.muted = true; // el navegador exige un gesto para el sonido: se arranca en silencio
        syncReelUi(stage, video);
        if (reelSound) stage.classList.add('needs-sound');
        const retry = video.play();
        if (retry && retry.catch) retry.catch(() => {});
      });
    }
  }
  const pauseReels = () => $$('video', document).forEach(video => video.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseReels(); });

  /* Altura real visible (descuenta el teclado en el móvil) para que el chat y su campo de texto no queden tapados. */
  if (window.visualViewport) {
    const syncViewport = () => {
      const root = document.documentElement.style;
      root.setProperty('--vvh', `${Math.round(window.visualViewport.height)}px`);
      root.setProperty('--vvt', `${Math.round(window.visualViewport.offsetTop)}px`);
      const body = $('#chatBody');
      if (body && contactModal.classList.contains('is-open')) body.scrollTop = body.scrollHeight;
    };
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
    syncViewport();
  }

  function galleryStripTemplate(property) {
    const reelThumb = html`<button type="button" class="gallery-thumb is-selected" data-action="gallery" data-index="-1" aria-label="Ver el reel"><img src="${property.gallery[0]}" alt="" loading="lazy" /><span class="thumb-play" aria-hidden="true">${icon('play', 'icon-fill')}</span></button>`;
    const photos = property.gallery.map((image, i) => html`<button type="button" class="gallery-thumb" data-action="gallery" data-index="${i}" aria-label="Ver foto ${i + 1}"><img src="${image}" alt="" loading="lazy" /></button>`);
    return html`<div class="gallery-row" role="group" aria-label="Reel y fotos">${reelThumb}${photos}</div>`;
  }

  /** Datos clave en tarjetas compactas: habitaciones, capacidad por tipo de plan, etc. */
  const factsTemplate = property => (property.facts && property.facts.length)
    ? html`<ul class="facts">${property.facts.map((fact, i) => html`<li class="fact" style="--i:${i}">${icon(fact.icon)}<strong>${fact.value}</strong><span>${fact.label}</span></li>`)}</ul>`
    : '';

  const amenitiesTemplate = property => (property.amenities && property.amenities.length)
    ? html`<section class="pm-section" aria-labelledby="amenitiesTitle"><h3 class="pm-subtitle" id="amenitiesTitle">Amenidades</h3><ul class="amenities">${property.amenities.map((name, i) => html`<li class="amenity" style="--i:${i}">${icon(amenityIcon(name))}<span>${name}</span></li>`)}</ul></section>`
    : '';

  function renderPropertyModal(property) {
    activeProperty = property;
    const arrival = datePlus(7);
    const departure = supportsStay(property) ? datePlus(8) : arrival;
    activeMode = resolveMode(property, arrival, departure);
    currentEstimate = null;
    const price = modalPrice(property, activeMode);
    setHtml(propertyModal, html`<section class="modal-panel property-panel" role="dialog" aria-modal="true" aria-labelledby="propertyModalTitle">
      <div class="pm-topbar"><span class="pm-topbar-title">${property.name}</span><button class="modal-close" data-action="close-modal" aria-label="Cerrar ficha">${icon('x')}</button></div>
      <div class="pm-grid">
        <div class="pm-media">
          <div class="pm-stage" id="modalStage">${reelTemplate(property)}</div>
          ${galleryStripTemplate(property)}
        </div>
        <div class="pm-info">
          <h2 id="propertyModalTitle">${property.name}</h2>
          <p class="pm-meta">${icon('pin')}<span>${cityOf(property)}</span></p>
          <p class="pm-price"><strong id="modalPriceValue">${price.amount} <em>${price.suffix}</em></strong></p>
          ${factsTemplate(property)}
          ${amenitiesTemplate(property)}
          <div class="calculator-column">${calculatorTemplate(property, arrival, departure)}</div>
        </div>
      </div>
      <div class="pm-bar">
        <p class="pm-bar-price"><strong id="barTotal">${price.amount}</strong><span id="barNote">${price.suffix}</span></p>
        <button type="button" class="button button-cta" data-action="request-quote">${isEventProperty(property) ? 'Cotizar' : 'Consultar'}</button>
      </div>
    </section>`);
    openModal(propertyModal);
    startReel();
    refreshCalculation();
  }

  /* ---------- Calculadora ---------- */
  const EVENT_TYPES = ['Cumpleaños', 'Celebración familiar', 'Evento empresarial', 'Reunión de amigos', 'Otro'];

  const supportsStay = property => property.categories.includes('alojamiento') && property.category !== 'evento' && property.pricingModel !== 'manual';
  const supportsDayPass = property => property.categories.includes('pasadia');

  /**
   * El tipo de plan sale de las fechas, sin selector: con salida posterior a la llegada es alojamiento;
   * sin salida (o el mismo día) es un pasadía si la propiedad lo ofrece.
   */
  function resolveMode(property, date, departure) {
    if (property.category === 'evento' || property.pricingModel === 'manual') return 'evento';
    if (supportsStay(property) && supportsDayPass(property)) return departure && departure !== date ? 'alojamiento' : 'pasadia';
    return supportsStay(property) ? 'alojamiento' : 'pasadia';
  }

  /** Con pasadía o evento la salida puede ser el mismo día; solo el alojamiento exige al menos una noche. */
  const sameDayAllowed = property => supportsDayPass(property) || !supportsStay(property);
  const departureMin = (property, arrival) => sameDayAllowed(property) ? arrival : addDays(arrival, 1);
  const capacityFor = (property, mode) => mode === 'pasadia' ? (property.dayPassCapacity || property.capacity) : property.capacity;

  const isEventProperty = property => property.category === 'evento' || property.pricingModel === 'manual';
  const ctaLabel = property => isEventProperty(property) ? 'Solicitar cotización' : 'Consultar disponibilidad';

  function calculatorTemplate(property, arrival, departure) {
    const both = supportsStay(property) && supportsDayPass(property);
    const mode = resolveMode(property, arrival, departure);
    const defaultPeople = Math.min(10, capacityFor(property, mode));
    return html`<section class="calculator" aria-labelledby="calculatorTitle">
      <h3 class="calc-title" id="calculatorTitle">Cotiza tu plan</h3>
      <div class="booking-box">
        <div class="booking-dates">
          <div class="cell"><label for="calc-date">Llegada</label><input type="date" id="calc-date" min="${datePlus(0)}" value="${arrival}" data-prev="${arrival}" /></div>
          <div class="cell"><label for="calc-departure">Salida</label><input type="date" id="calc-departure" min="${departureMin(property, arrival)}" value="${departure}" />${both ? html`<button type="button" class="cell-clear" data-action="clear-departure" aria-label="Quitar la fecha de salida" ${departure ? '' : 'hidden'}>${icon('x')}</button>` : ''}</div>
        </div>
        <div class="cell cell-people">
          <span class="cell-label" id="peopleLabel">Personas</span>
          <div class="stepper" role="group" aria-labelledby="peopleLabel">
            <button type="button" data-action="people-step" data-step="-1" aria-label="Restar una persona">${icon('minus')}</button>
            <span class="stepper-value"><output id="calcPeopleOutput" for="calc-people">${defaultPeople}</output> <span id="calcPeopleWord">${defaultPeople === 1 ? 'persona' : 'personas'}</span></span>
            <button type="button" data-action="people-step" data-step="1" aria-label="Añadir una persona">${icon('plus')}</button>
          </div>
          <input type="hidden" id="calc-people" min="1" max="${capacityFor(property, mode)}" value="${defaultPeople}" />
        </div>
        ${mode === 'evento' ? html`<div class="cell"><label for="calc-event-type">Tipo de evento</label><select id="calc-event-type">${EVENT_TYPES.map(type => html`<option>${type}</option>`)}</select></div>` : ''}
      </div>
      <div class="calc-result" id="calcResult" aria-live="polite"></div>
      <button type="button" class="button button-cta" data-action="request-quote">${ctaLabel(property)}</button>
      <p class="calc-note">${icon('shield')}No se hace ningún cobro</p>
    </section>`;
  }

  function getCalculatorState() {
    if (!activeProperty) return null;
    const dateInput = $('#calc-date', propertyModal);
    const departureInput = $('#calc-departure', propertyModal);
    const peopleInput = $('#calc-people', propertyModal);
    const date = dateInput ? dateInput.value : '';
    const departure = departureInput ? departureInput.value : '';
    activeMode = resolveMode(activeProperty, date, departure);
    return {
      property: activeProperty,
      mode: activeMode,
      date,
      departure,
      people: peopleInput ? Number(peopleInput.value) : 1,
      eventType: $('#calc-event-type', propertyModal)?.value || '',
      estimate: null
    };
  }

  const calculateQuote = state => Pricing.calculateQuote(state, datePlus(0), CONFIG.brand.defaultDepositPercent);

  function quoteLineTemplate(line) {
    const unitWord = line.unitLabel === 'persona' ? plural(line.quantity, 'persona', 'personas') : plural(line.quantity, 'noche', 'noches');
    return html`<div class="result-row result-line"><span>${formatCOP(line.unit)} × ${unitWord}<small>${line.label}</small></span><strong>${formatCOP(line.subtotal)}</strong></div>`;
  }

  function quoteResultTemplate(estimate) {
    return html`${estimate.lines.map(quoteLineTemplate)}
      <div class="result-row result-total"><span>Total estimado</span><strong>${formatCOP(estimate.total)}</strong></div>
      <div class="result-row result-deposit"><span>Anticipo (${estimate.depositPercent} %)</span><strong>${formatCOP(estimate.deposit)}</strong></div>
      <p class="result-disclaimer">Valor estimado. La disponibilidad se confirma contigo.</p>`;
  }

  /** La barra inferior (móvil) resume siempre el total o, si aún no hay cálculo, el precio de referencia. */
  function renderPlanBar(state, estimate) {
    const total = $('#barTotal', propertyModal);
    const note = $('#barNote', propertyModal);
    if (!total || !note) return;
    if (estimate.valid && !estimate.needsManual && estimate.total) {
      total.textContent = formatCOP(estimate.total);
      note.textContent = state.mode === 'pasadia' ? `Pasadía · ${plural(state.people, 'persona', 'personas')}` : `${plural(estimate.nights, 'noche', 'noches')} · ${plural(state.people, 'persona', 'personas')}`;
    } else {
      const price = modalPrice(activeProperty, state.mode);
      total.textContent = price.amount;
      note.textContent = price.suffix;
    }
  }

  function refreshCalculation() {
    const resultEl = $('#calcResult', propertyModal);
    if (!activeProperty || !resultEl) return;
    const state = getCalculatorState();
    const estimate = calculateQuote(state);
    currentEstimate = { ...state, estimate };
    const peopleInput = $('#calc-people', propertyModal);
    if (peopleInput) peopleInput.max = String(capacityFor(activeProperty, state.mode));
    const output = $('#calcPeopleOutput', propertyModal);
    if (output) {
      $('#calcPeopleWord', propertyModal).textContent = state.people === 1 ? 'persona' : 'personas';
      if (output.textContent !== String(state.people)) {
        output.textContent = state.people;
        output.classList.remove('is-bumped'); void output.offsetWidth; output.classList.add('is-bumped');
      }
    }
    const clear = $('.cell-clear', propertyModal);
    const departureInput = $('#calc-departure', propertyModal);
    if (clear && departureInput) clear.hidden = !departureInput.value;
    if (departureInput) departureInput.closest('.cell').classList.toggle('is-empty', !departureInput.value);
    const price = modalPrice(activeProperty, state.mode);
    const priceValue = $('#modalPriceValue', propertyModal);
    if (priceValue) setHtml(priceValue, html`${price.amount} <em>${price.suffix}</em>`);
    renderPlanBar(state, estimate);
    if (!estimate.valid || estimate.needsManual) {
      setHtml(resultEl, html`<div class="calc-warning">${estimate.message}</div>`);
      return;
    }
    setHtml(resultEl, quoteResultTemplate(estimate));
  }

  /* ---------- Modales ---------- */
  function openModal(modal) {
    restoreFocusTo.set(modal, document.activeElement);
    if (modal === contactModal) pauseReels(); // el chat se abre sobre la ficha: que no siga sonando detrás
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const focusable = $('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]', modal);
    if (focusable) window.setTimeout(() => focusable.focus({ preventScroll: true }), 30);
  }

  function closeModal(modal) {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    $$('video', modal).forEach(video => video.pause());
    if (modal !== contactModal) modal.innerHTML = ''; // el chat se conserva para retomarlo
    if (![propertyModal, contactModal].some(item => item.classList.contains('is-open'))) document.body.classList.remove('modal-open');
    const back = restoreFocusTo.get(modal);
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }

  function showToast(message, action = null) {
    toast.textContent = message;
    toast.classList.toggle('has-action', Boolean(action));
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = action.label;
      button.addEventListener('click', () => { toast.classList.remove('is-visible'); action.run(); });
      toast.append(button);
    }
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), action ? 6000 : 4000);
  }

  /* ---------- Formulario de contacto ---------- */
  const MODE_NAMES = { alojamiento: 'Alojamiento', pasadia: 'Pasadía', evento: 'Evento' };
  const hasWhatsApp = () => /^\d{8,15}$/.test(CONFIG.brand.whatsappNumber || '');

  /** Dos líneas para el resumen del plan elegido en la ficha: cuándo y cuántos, y cuánto. */
  function planSummary(context) {
    const { mode, date, departure, people, estimate } = context;
    const who = plural(people, 'persona', 'personas');
    const when = mode === 'alojamiento' && departure
      ? `${shortDate(date)} – ${shortDate(departure)} · ${who}`
      : `${shortDate(date)} · ${MODE_NAMES[mode] || 'Plan'} · ${who}`;
    const price = estimate?.total ? `Total estimado ${formatCOP(estimate.total)}` : 'Cotización a medida';
    return { when, price };
  }

  /* ---------- Chat de contacto (estilo WhatsApp) ----------
   * Un asistente de reglas (assistant.js) responde dudas, recomienda cabañas y calcula un valor estimado. Cuando no puede
   * resolver algo, o la persona lo pide, se piden nombre → celular → autorización y se deja un mensaje personalizado listo
   * para continuar en WhatsApp. `chatTypingMs` en brand permite acortar la espera de «escribiendo…». */
  const typingMs = () => reduceMotion.matches ? 0 : (CONFIG.brand.chatTypingMs ?? 750);
  const clockTime = () => new Intl.DateTimeFormat(CONFIG.brand.locale, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  /* La conversación es persistente: sigue viva al cerrar la ventana (si el asesor estaba respondiendo, la respuesta llega
   * igual y el botón de WhatsApp avisa), se retoma al volver de una ficha y se guarda 24 h en el navegador de la persona. */
  let chat = null;
  const CHAT_KEY = 'luisito:chat';
  const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
  const hasUserTalked = () => Boolean(chat && chat.log.some(entry => entry.from === 'me'));
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  const planToData = context => ({ propertyId: context.property.id, mode: context.mode, date: context.date, departure: context.departure, people: Number(context.people), eventType: context.eventType || '', estimate: context.estimate && context.estimate.total ? { total: context.estimate.total, deposit: context.estimate.deposit } : null });
  const planFromData = data => {
    const property = CONFIG.properties.find(item => item.id === data.propertyId);
    return property ? { property, mode: data.mode, date: data.date, departure: data.departure, people: data.people, eventType: data.eventType, estimate: data.estimate } : null;
  };
  const planMemory = context => {
    const { property, mode, date, departure, people, estimate } = context;
    const memory = { propertyId: property.id, type: mode, date, departure: mode === 'alojamiento' ? departure : '', people: Number(people) };
    if (estimate && estimate.total) memory.lastQuote = { id: property.id, total: formatCOP(estimate.total), deposit: formatCOP(estimate.deposit) };
    return memory;
  };

  function persistChat() {
    if (!chat || !hasUserTalked()) return;
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), step: chat.stable, memory: chat.memory, values: chat.values, plan: chat.context ? planToData(chat.context) : null, replies: chat.replies, log: chat.log }));
    } catch (_) { /* modo privado o sin espacio: la conversación sigue viva mientras la página esté abierta */ }
  }
  const clearStoredChat = () => { try { localStorage.removeItem(CHAT_KEY); } catch (_) { /* sin almacenamiento */ } };
  function loadStoredChat() {
    try {
      const data = JSON.parse(localStorage.getItem(CHAT_KEY));
      return data && data.v === 1 && Array.isArray(data.log) && Date.now() - data.savedAt < CHAT_TTL_MS ? data : null;
    } catch (_) { return null; }
  }

  function chatTemplate() {
    // Campo trampa para bots: una persona no lo ve ni lo rellena. Solo se incluye si hay un endpoint que recibe datos.
    const honeypot = CONFIG.brand.leadsEndpoint ? html`<div class="hp-field" aria-hidden="true"><label>Sitio web<input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>` : '';
    return html`<section class="modal-panel chat-panel" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
      <header class="chat-head">
        <button class="chat-close" type="button" data-action="close-modal" aria-label="Cerrar el chat">${icon('x')}</button>
        <img class="chat-avatar" src="assets/avatar.webp" alt="" width="44" height="44" />
        <div class="chat-who"><h2 id="chatTitle">Luisito el Viajero</h2><p class="chat-status"><span class="chat-dot" aria-hidden="true"></span>Asesor · en línea</p></div>
        <button class="chat-reset" type="button" data-action="chat-reset" aria-label="Empezar una conversación nueva">${icon('reset')}<span class="chat-reset-label">¿Borrar?</span></button>
      </header>
      <div class="chat-body" id="chatBody" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="chat-replies" id="chatReplies"></div>
      <form class="chat-input" id="chatForm" novalidate>
        ${honeypot}
        <label class="sr-only" for="chatInput">Escribe un mensaje</label>
        <textarea id="chatInput" rows="1" maxlength="500" placeholder="Escribe un mensaje" enterkeyhint="send" autocomplete="off" disabled></textarea>
        <button class="chat-send" type="submit" aria-label="Enviar mensaje" disabled>${icon('send')}</button>
      </form>
    </section>`;
  }

  const miniCardTemplate = card => html`<article class="mini-card"><img src="${card.image}" alt="" width="64" height="64" loading="lazy" /><div class="mini-info"><strong>${card.name}</strong><span>${card.city} · ${card.capacity}</span><span class="mini-price">${card.price}</span></div><div class="mini-actions"><button type="button" data-action="chat-quick" data-value="Cotizar ${card.name}">Cotizar</button><button type="button" data-action="chat-open-property" data-value="${card.id}">Ver ficha</button></div></article>`;

  const quoteCardTemplate = quote => html`<div class="quote-card">
    <div class="quote-head"><img src="${quote.image}" alt="" width="48" height="48" /><div><small>Cotización estimada</small><strong>${quote.name}</strong></div></div>
    <p class="quote-when">${quote.when}${quote.nights ? ` · ${plural(quote.nights, 'noche', 'noches')}` : quote.mode === 'pasadia' ? ' · pasadía' : ''} · ${plural(quote.people, 'persona', 'personas')}</p>
    <ul>${quote.lines.map(line => html`<li>${line}</li>`)}</ul>
    <div class="quote-row quote-total"><span>Total estimado</span><strong>${quote.total}</strong></div>
    <div class="quote-row"><span>Anticipo (${quote.depositPercent} %)</span><strong>${quote.deposit}</strong></div>
  </div>`;

  const planCardTemplate = context => {
    const { property } = context;
    const summary = planSummary(context);
    return html`<div class="plan-card"><img src="${property.image}" alt="" width="64" height="64" /><div><strong>${property.name}</strong><span>${summary.when}</span><span class="plan-total">${summary.price}</span></div></div>`;
  };

  /**
   * Cada burbuja es un «registro» sencillo ({ from, kind, … }) que se pinta con las plantillas de arriba. Así la misma
   * conversación se puede guardar, restaurar tras recargar la página y pintar de nuevo sin animaciones.
   */
  function renderEntry(entry, { silent = false } = {}) {
    const body = $('#chatBody', contactModal);
    if (entry.kind === 'actions') {
      const actions = document.createElement('div');
      actions.className = 'chat-actions';
      actions.dataset.message = entry.message;
      setHtml(actions, html`<button type="button" class="chat-chip is-primary chat-chip-wide" data-action="chat-whatsapp">${icon('whatsapp')}Continuar en WhatsApp</button><button type="button" class="chat-chip" data-action="copy-again">Copiar mensaje</button>${CONFIG.brand.leadEmail ? html`<a class="chat-chip" href="${mailtoHref(entry.message)}">Enviar por correo</a>` : ''}`);
      body.append(actions);
      return actions;
    }
    let content = html`<p>${entry.text}</p>`;
    let extra = '';
    if (entry.kind === 'cards') { content = html`<div class="mini-cards">${entry.cards.map(miniCardTemplate)}</div>`; extra = 'bubble-cards'; }
    else if (entry.kind === 'quote') { content = quoteCardTemplate(entry.quote); extra = 'bubble-quote'; }
    else if (entry.kind === 'plan') { const plan = planFromData(entry.plan); content = plan ? planCardTemplate(plan) : html`<p>Plan consultado</p>`; }
    else if (entry.kind === 'preview') { content = html`<p class="preview-label">Así llegará tu mensaje</p><p>${entry.message}</p>`; extra = 'bubble-preview'; }
    const bubble = document.createElement('div');
    bubble.className = `bubble bubble-${entry.from} ${extra}`.trim();
    bubble.innerHTML = `${toMarkup(content)}<span class="bubble-meta"><time>${escapeHtml(entry.time)}</time>${entry.from === 'me' ? toMarkup(icon('checks', 'tick')) : ''}</span>`;
    if (silent) { bubble.style.animation = 'none'; if (entry.from === 'me') bubble.classList.add('is-read'); }
    else if (entry.from === 'me') window.setTimeout(() => bubble.classList.add('is-read'), reduceMotion.matches ? 0 : 900);
    body.append(bubble);
    if (!silent) body.scrollTo({ top: body.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    return bubble;
  }

  /** Registra y pinta un mensaje. Si llega con la ventana cerrada, queda como «sin leer» y el botón de WhatsApp lo avisa. */
  function say(entry) {
    entry.time = clockTime();
    chat.log.push(entry);
    renderEntry(entry);
    if (entry.from === 'agent' && !contactModal.classList.contains('is-open')) {
      chat.unread = (chat.unread || 0) + 1;
      nudgeFab();
    }
    persistChat();
    syncFab();
  }

  /** Muestra «escribiendo…» un momento. Devuelve false si la conversación se reinició mientras tanto. */
  async function typingPause() {
    const id = chat && chat.id;
    const ms = typingMs();
    if (ms) {
      const body = $('#chatBody', contactModal);
      const typing = document.createElement('div');
      typing.className = 'bubble bubble-agent bubble-typing';
      typing.setAttribute('aria-label', 'El asesor está escribiendo');
      typing.innerHTML = '<i></i><i></i><i></i>';
      body.append(typing);
      body.scrollTo({ top: body.scrollHeight });
      await wait(ms);
      typing.remove();
    }
    return Boolean(chat && chat.id === id);
  }

  /** El asesor «escribe» y luego muestra cada mensaje. */
  async function agentSay(...texts) {
    for (const text of texts) {
      if (!await typingPause()) return false;
      say({ from: 'agent', kind: 'text', text });
    }
    return true;
  }

  /** Pinta la respuesta del asistente (texto, tarjetas de cabañas, cotización) con su pausa de escritura. */
  async function renderReply(reply) {
    for (const message of reply.messages) {
      if (message.type === 'text') { if (!await agentSay(message.text)) return false; continue; }
      if (!await typingPause()) return false;
      if (message.type === 'cards') say({ from: 'agent', kind: 'cards', cards: message.cards });
      if (message.type === 'quote') { chat.memory.lastQuote = message.quote; say({ from: 'agent', kind: 'quote', quote: message.quote }); }
    }
    return true;
  }

  const PROMPTS = {
    chat: { placeholder: 'Escribe tu pregunta', mode: 'text' },
    name: { placeholder: 'Escribe tu nombre', mode: 'text' },
    phone: { placeholder: 'Tu número de celular', mode: 'tel' },
    consent: { placeholder: 'Confirma para continuar', mode: 'text' },
    wait: { placeholder: 'El asesor está escribiendo…', mode: 'text' }
  };

  function setStep(step) {
    chat.step = step;
    if (step !== 'wait') { chat.stable = step; persistChat(); }
    const form = $('#chatForm', contactModal);
    const input = $('#chatInput', contactModal);
    const send = $('.chat-send', form);
    const prompt = PROMPTS[step];
    const typing = ['chat', 'name', 'phone'].includes(step);
    form.dataset.step = step;
    input.disabled = !typing;
    send.disabled = !typing;
    input.placeholder = prompt.placeholder;
    input.setAttribute('inputmode', prompt.mode === 'tel' ? 'tel' : 'text');
    input.setAttribute('autocomplete', step === 'name' ? 'name' : step === 'phone' ? 'tel' : 'off');
    if (typing && contactModal.classList.contains('is-open') && !window.matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
    autoGrow(input);
  }

  function autoGrow(input) {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }

  /** Respuestas rápidas bajo la conversación. Cada una envía un texto, abre una ficha o inicia el traspaso a WhatsApp. */
  const CHIP_ACTIONS = { handoff: 'chat-handoff', 'open-property': 'chat-open-property', consent: 'chat-consent' };
  function setReplies(items) {
    chat.replies = items;
    const box = $('#chatReplies', contactModal);
    setHtml(box, html`${items.map((item, i) => html`<button type="button" class="chat-chip ${item.primary ? 'is-primary' : ''}" style="--i:${i}" data-action="${item.send ? 'chat-quick' : CHIP_ACTIONS[item.action]}" data-value="${item.send || item.id || ''}">${item.action === 'handoff' ? icon('whatsapp') : ''}${item.label}</button>`)}`);
    persistChat();
  }

  const newChatState = context => ({ id: Symbol('chat'), step: '', stable: '', context, values: {}, sending: false, unread: 0, log: [], replies: [], memory: { favoriteIds: [...favorites] } });

  /** Construye la ventana del chat y engancha sus eventos. */
  function mountChat() {
    setHtml(contactModal, chatTemplate());
    $('#chatForm', contactModal).addEventListener('submit', handleChatSubmit);
    const input = $('#chatInput', contactModal);
    input.addEventListener('input', () => autoGrow(input));
    input.addEventListener('keydown', event => {
      // En el computador Enter envía y Mayús+Enter baja de línea; en el móvil Enter baja de línea.
      if (event.key === 'Enter' && !event.shiftKey && !window.matchMedia('(pointer: coarse)').matches) { event.preventDefault(); $('#chatForm', contactModal).requestSubmit(); }
    });
  }

  async function startChat(context, note) {
    const property = context && context.property;
    if (property) {
      Object.assign(chat.memory, planMemory(context));
      if (!await agentSay('Hola, soy tu asesor de Luisito el Viajero.', `Vi que te interesa ${property.name}. Te confirmo disponibilidad y precio, sin ningún cobro.`)) return;
      say({ from: 'me', kind: 'plan', plan: planToData(context) });
      if (!await agentSay('Para seguir, ¿cómo te llamas?')) return;
      setStep('name');
      return;
    }
    const saved = CONFIG.properties.filter(item => favorites.has(item.id)).map(item => item.name);
    const intro = saved.length
      ? `Veo que guardaste ${saved.length === 1 ? saved[0] : `${saved.slice(0, -1).join(', ')} y ${saved.at(-1)}`}. Puedo compararlas, calcular un valor estimado o resolver tus dudas.`
      : 'Cuéntame qué buscas: te recomiendo cabañas según las personas y la ubicación, calculo un valor estimado y resuelvo tus dudas. No se hace ningún cobro.';
    if (!await agentSay('Hola, soy tu asesor de Luisito el Viajero.', intro)) return;
    setReplies(openingChips());
    setStep('chat');
    if (note) prefillNote(note);
  }

  /** Respuestas rápidas del inicio; con favoritas guardadas se suma «Comparar mis favoritas». */
  function openingChips() {
    const chips = assistant().startChips();
    if (favorites.size) chips.unshift({ label: 'Comparar mis favoritas', send: 'Compara mis favoritas' });
    return chips;
  }

  function prefillNote(note, { replace = false } = {}) {
    const input = $('#chatInput', contactModal);
    if (!input || input.disabled || (input.value && !replace)) return;
    input.value = note;
    autoGrow(input);
  }

  /** Espera a que el asesor termine de responder antes de añadir algo nuevo a la conversación. */
  async function whenIdle() {
    for (let i = 0; chat && chat.sending && i < 80; i += 1) await wait(100);
  }

  /** Pide el dato que falta para dejar el mensaje listo: nombre → celular → autorización. */
  async function askNextDetail(lead = '') {
    const { values } = chat;
    const first = values.name ? values.name.split(/\s+/)[0] : '';
    if (!values.name) {
      if (await agentSay(...(lead ? [lead] : []), 'Para dejar tu mensaje listo en WhatsApp, ¿cómo te llamas?')) setStep('name');
    } else if (!values.phone) {
      if (await agentSay(...(lead ? [lead] : []), `${first}, ¿a qué número de celular te escribimos?`)) setStep('phone');
    } else if (!values.consented) {
      if (await agentSay(...(lead ? [lead] : []), 'Último paso: necesito tu autorización para usar tus datos personales y atender esta solicitud.')) {
        setReplies([{ label: 'Autorizo y continuar', action: 'consent', primary: true }]);
        setStep('consent');
        if (contactModal.classList.contains('is-open')) $('.chat-chip', contactModal)?.focus({ preventScroll: true });
      }
    }
  }

  /** Pasa de la conversación a dejar el mensaje listo en WhatsApp (si ya dio sus datos antes, no se vuelven a pedir). */
  async function beginCapture() {
    if (!chat || chat.sending) return;
    chat.sending = true;
    setReplies([]);
    setStep('wait');
    const { values } = chat;
    chat.sending = false;
    if (values.name && values.phone && values.consented) { await finishChat({ force: true }); return; }
    chat.sending = true;
    await askNextDetail();
    if (chat) chat.sending = false;
  }

  /** Si la persona vuelve de una ficha con un plan (Consultar disponibilidad), el plan se suma a la misma conversación. */
  async function attachPlan(context) {
    await whenIdle();
    if (!chat) return;
    chat.sending = true;
    setReplies([]);
    setStep('wait');
    chat.context = context;
    Object.assign(chat.memory, planMemory(context));
    say({ from: 'me', kind: 'plan', plan: planToData(context) });
    const { values } = chat;
    if (values.name && values.phone && values.consented) {
      chat.sending = false;
      await finishChat({ force: true });
      return;
    }
    await askNextDetail(`Tomo nota de ${context.property.name}.`);
    if (chat) chat.sending = false;
  }

  function openContact(context = null, { note = '' } = {}) {
    const plan = context && context.property ? context : null;
    currentEstimate = plan;
    if (!chat) {
      chat = newChatState(plan);
      mountChat();
      openModal(contactModal);
      startChat(plan, note);
      return;
    }
    // Conversación en curso (o restaurada): se retoma donde quedó.
    openModal(contactModal);
    chat.unread = 0;
    chat.memory.favoriteIds = [...favorites];
    if (!hasUserTalked() && chat.step === 'chat') setReplies(openingChips()); // por si guardó favoritas desde la última vez
    syncFab();
    const body = $('#chatBody', contactModal);
    body.scrollTop = body.scrollHeight;
    const input = $('#chatInput', contactModal);
    if (!input.disabled && !window.matchMedia('(pointer: coarse)').matches) window.setTimeout(() => input.focus({ preventScroll: true }), 60);
    if (plan) attachPlan(plan);
    // Si aún no se ha hablado, el mensaje de partida más reciente (favoritas, ubicación) reemplaza al anterior.
    else if (note) prefillNote(note, { replace: !hasUserTalked() });
  }

  /** Borra la conversación (en pantalla y en el navegador) y, si estaba abierta, empieza una nueva. */
  function resetChat() {
    const wasOpen = contactModal.classList.contains('is-open');
    clearStoredChat();
    chat = null;
    contactModal.innerHTML = '';
    if (wasOpen) { closeModal(contactModal); openContact(null); }
    syncFab();
  }

  /** Al cargar la página: si hay una conversación guardada y reciente, se reconstruye (cerrada) sin animaciones. */
  function restoreChat() {
    const data = loadStoredChat();
    if (!data) { clearStoredChat(); return; }
    const plan = data.plan ? planFromData(data.plan) : null;
    chat = { ...newChatState(plan), values: data.values || {}, memory: { ...data.memory, favoriteIds: [...favorites] } };
    mountChat();
    const log = [...data.log];
    // Una autorización que se envió justo antes de cerrar la página no llegó a completarse: se pide de nuevo.
    if (data.step === 'consent' && log.at(-1) && log.at(-1).from === 'me') log.pop();
    log.forEach(entry => { chat.log.push(entry); renderEntry(entry, { silent: true }); });
    const body = $('#chatBody', contactModal);
    body.scrollTop = body.scrollHeight;
    setReplies(Array.isArray(data.replies) ? data.replies : []);
    setStep(PROMPTS[data.step] && data.step !== 'wait' ? data.step : 'chat');
    const last = chat.log.at(-1);
    if (last && last.from === 'me' && last.kind === 'text' && ['chat', 'name', 'phone'].includes(chat.step)) {
      say({ from: 'agent', kind: 'text', text: 'Perdona, se interrumpió mi respuesta. ¿Me lo escribes de nuevo?' });
    }
  }

  /**
   * Mensaje que llega al asesor por WhatsApp. Sin pregunta pendiente es «Hola, quisiera hacer una reserva»;
   * con una pregunta que el asistente no pudo responder, va esa pregunta tal como la escribió la persona.
   */
  function buildHandoffMessage({ name, phone, memory = {}, plan = null }) {
    const property = plan ? plan.property : CONFIG.properties.find(item => item.id === memory.propertyId);
    const question = (memory.unanswered || []).at(-1) || '';
    const lines = [`Hola, soy ${name}. ${question ? `Tengo esta consulta: «${question}»` : 'Quisiera hacer una reserva.'}`];
    const details = [];
    if (property) details.push(`Cabaña: ${property.name}`);
    if (memory.type) details.push(`Plan: ${MODE_NAMES[memory.type] || memory.type}`);
    if (memory.date) {
      const nights = memory.departure && memory.departure > memory.date ? Pricing.nightsBetween(memory.date, memory.departure) : 0;
      details.push(`Fechas: ${planLine(memory)}${nights ? ` (${plural(nights, 'noche', 'noches')})` : ''}`);
    }
    if (memory.people) details.push(`Personas: ${memory.people}`);
    if (memory.cityNames && memory.cityNames.length) details.push(`Ubicación: ${memory.cityNames.join(', ')}`);
    const quote = memory.lastQuote && property && memory.lastQuote.id === property.id ? memory.lastQuote : null;
    if (quote) details.push(`Valor estimado: ${quote.total}${CONFIG.brand.demoMode ? ' (de demostración)' : ''}`);
    if (details.length) lines.push('', ...details.map(item => `• ${item}`));
    lines.push('', `Mi celular: ${phone}`, '¿Me confirman disponibilidad, precio vigente y condiciones de reserva?');
    if (CONFIG.brand.demoMode) lines.push('Nota: los valores del prototipo son ficticios y deben validarse.');
    return lines.join('\n');
  }

  /** «15 – 17 oct» o «15 oct» a partir de fechas ISO. */
  function planLine({ date, departure }) {
    return departure && departure > date ? `${shortDate(date)} – ${shortDate(departure)}` : shortDate(date);
  }

  function validateContact(v) {
    if (v.name.length < 2) return 'Escribe tu nombre para continuar.';
    if (v.phone.replace(/\D/g, '').length < 7) return 'Revisa el número de celular; parece incompleto.';
    if (!v.consent) return 'Necesitamos tu autorización para usar estos datos en la solicitud.';
    return '';
  }

  /** Envía la solicitud al endpoint configurado. Nunca lanza: devuelve true si el servidor aceptó los datos. */
  async function submitLead(values, messageText) {
    const endpoint = CONFIG.brand.leadsEndpoint;
    if (!endpoint || !/^https:\/\//.test(endpoint)) return false;
    const { estimate, ...fields } = values;
    const payload = { ...fields, message: messageText, estimateTotal: estimate?.total ?? null, source: location.href, createdAt: new Date().toISOString() };
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function mailtoHref(messageText) {
    const subject = encodeURIComponent('Consulta de experiencia · Luisito el Viajero');
    return `mailto:${CONFIG.brand.leadEmail}?subject=${subject}&body=${encodeURIComponent(messageText)}`;
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    if (!chat || chat.sending) return;
    const input = $('#chatInput', contactModal);
    const text = input.value.trim();
    if (!text || input.disabled) return;
    const step = chat.step;
    const id = chat.id;
    chat.sending = true;
    input.value = '';
    autoGrow(input);
    say({ from: 'me', kind: 'text', text });
    setReplies([]);
    setStep('wait');
    const { values } = chat;
    if (step === 'chat') {
      // El asistente entiende la pregunta; si no puede resolverla, ofrece seguir en WhatsApp con ella ya escrita.
      const reply = assistant().respond(text, chat.memory);
      chat.memory = { ...reply.memory, lastQuote: chat.memory.lastQuote, favoriteIds: chat.memory.favoriteIds };
      // Si la conversación pasó a otra cabaña, el plan que venía de una ficha ya no describe lo que se está hablando.
      if (chat.context && chat.memory.propertyId !== chat.context.property.id) chat.context = null;
      if (await renderReply(reply) && chat && chat.id === id) {
        chat.sending = false;
        if (reply.handoff && reply.handoff.auto) await beginCapture();
        else { setReplies(reply.chips); setStep('chat'); }
      }
    } else if (step === 'name') {
      if (text.length < 2) { await agentSay('Escribe tu nombre completo, por favor.'); chat && chat.id === id && setStep('name'); }
      else {
        values.name = text;
        if (await agentSay(`Mucho gusto, ${text.split(/\s+/)[0]}. ¿A qué número de celular te escribimos?`)) setStep('phone');
      }
    } else if (step === 'phone') {
      if (text.replace(/\D/g, '').length < 7) { await agentSay('Revisa el número; parece incompleto. ¿Me lo escribes de nuevo?'); chat && chat.id === id && setStep('phone'); }
      else {
        values.phone = text;
        chat.sending = false;
        await askNextDetail();
      }
    }
    if (chat && chat.id === id) chat.sending = false;
  }

  /** Tras la autorización: guarda la solicitud, arma el mensaje personalizado y ofrece continuar en WhatsApp. */
  async function finishChat({ force = false } = {}) {
    if (!chat || chat.sending || (!force && chat.step !== 'consent')) return;
    const id = chat.id;
    chat.sending = true;
    setReplies([]);
    setStep('wait');
    if (!force) say({ from: 'me', kind: 'text', text: 'Autorizo el uso de mis datos personales.' });
    chat.values.consented = true;
    const { context: plan, memory, values: given } = chat;
    const message = buildHandoffMessage({ name: given.name, phone: given.phone, memory, plan });
    const values = {
      name: given.name,
      phone: given.phone,
      property: plan ? plan.property.id : (memory.propertyId || ''),
      mode: plan ? plan.mode : (memory.type || ''),
      date: plan ? plan.date : (memory.date || ''),
      departure: plan ? plan.departure : (memory.departure || ''),
      people: plan ? Number(plan.people) : (memory.people || null),
      eventType: plan ? plan.eventType : '',
      note: (memory.unanswered || []).join(' / '),
      consent: true,
      estimate: plan ? plan.estimate : null
    };
    // Un bot que rellena el campo trampa recibe un éxito aparente y no se envía nada.
    const isBot = Boolean($('input[name="website"]', contactModal)?.value);
    const leadSaved = isBot ? false : await submitLead(values, message);
    if (CONFIG.brand.leadsEndpoint && !isBot && !leadSaved) showToast('No pudimos registrar la solicitud en línea; usa el mensaje preparado para escribirnos.');
    if (!chat || chat.id !== id) return;
    const first = given.name.split(/\s+/)[0];
    if (!await agentSay(`Listo, ${first}. Dejé tu mensaje preparado con lo que hablamos. Toca el botón para continuar con un asesor en WhatsApp.`)) return;
    say({ from: 'me', kind: 'preview', message });
    say({ kind: 'actions', message });
    $('#chatBody', contactModal).scrollTo({ top: 1e6 });
    // La conversación sigue abierta: puede preguntar más cosas y volver a pasar a WhatsApp sin repetir sus datos.
    chat.memory.unanswered = [];
    chat.sending = false;
    setStep('chat');
  }

  const CLIPBOARD_TIMEOUT_MS = 1500;

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Algunos navegadores dejan la promesa pendiente si esperan un permiso: no se bloquea la interfaz por eso.
        const timeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error('clipboard timeout')), CLIPBOARD_TIMEOUT_MS));
        await Promise.race([navigator.clipboard.writeText(text), timeout]);
        return true;
      }
    } catch (_) { /* usa fallback */ }
    try {
      const el = document.createElement('textarea');
      el.value = text; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.appendChild(el); el.select(); const ok = document.execCommand('copy'); el.remove(); return ok;
    } catch (_) { return false; }
  }

  function toggleMobileNav(force) {
    const nav = $('#mainNav'); const button = $('#menuToggle'); const header = $('.site-header');
    const open = force ?? !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  /**
   * La cabecera es transparente sobre la foto y se vuelve sólida al desplazarse; una barra fina muestra el avance
   * y el texto del hero se desliza y se desvanece al bajar. Solo se animan transform y opacity, una vez por fotograma.
   */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const siteHeader = $('.site-header');
  const hero = $('.hero');
  let scrollFrame = 0;
  function paintScroll() {
    scrollFrame = 0;
    const y = window.scrollY;
    siteHeader.classList.toggle('is-scrolled', y > 24);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    siteHeader.style.setProperty('--progress', scrollable > 0 ? Math.min(1, y / scrollable).toFixed(4) : '0');
    if (!reduceMotion.matches) hero.style.setProperty('--hero-p', Math.min(1, y / (hero.offsetHeight * .8)).toFixed(4));
  }
  function syncHeader() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(paintScroll);
  }

  /* ---------- Datos estructurados (solo fuera del modo demo, para no publicar propiedades ficticias) ---------- */
  function injectStructuredData() {
    const { demoMode, siteUrl, name } = CONFIG.brand;
    if (demoMode || !siteUrl || !/^https:\/\//.test(siteUrl)) return;
    const origin = siteUrl.replace(/\/$/, '');
    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name, url: origin, inLanguage: CONFIG.brand.locale },
        ...CONFIG.properties.map(property => ({
          '@type': 'LodgingBusiness',
          name: property.name,
          description: property.shortDescription,
          image: `${origin}/${property.image}`,
          address: { '@type': 'PostalAddress', addressLocality: property.location, addressCountry: 'CO' },
          amenityFeature: property.amenities.map(amenity => ({ '@type': 'LocationFeatureSpecification', name: amenity, value: true }))
        }))
      ]
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /** Muestra solo las favoritas y lleva a la zona del catálogo. */
  function openFavorites() {
    showFavorites = true;
    renderCards();
    $('#cabanas').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- WhatsApp inteligente ----------
   * El botón flotante adapta su texto y su mensaje a lo que la persona está haciendo:
   * favoritas guardadas, ubicación filtrada o consulta general. */
  function fabText() {
    if (hasUserTalked()) return chat.unread ? 'Tienes una respuesta nueva' : 'Continuar tu conversación';
    if (favorites.size) return `Consultar mis favoritas (${favorites.size})`;
    if (activeLocation !== 'all') return `Ayuda en ${activeLocation}`;
    return '¿Te ayudamos a elegir?';
  }
  function syncFab() {
    $('#waBadge').hidden = !(chat && chat.unread);
    fabLabel.textContent = fabText();
    fab.setAttribute('aria-label', `Escríbenos por WhatsApp: ${fabText()}`);
  }
  function nudgeFab() {
    fab.classList.add('is-expanded');
    window.clearTimeout(nudgeFab.timer);
    nudgeFab.timer = window.setTimeout(() => fab.classList.remove('is-expanded'), 4500);
  }
  function smartMessage() {
    const names = CONFIG.properties.filter(property => favorites.has(property.id)).map(property => property.name);
    if (names.length) return `Hola, me interesan estas opciones: ${names.join(', ')}. ¿Me ayudan a elegir y a cotizar?`;
    if (activeLocation !== 'all') return `Hola, estoy buscando opciones en ${activeLocation}. ¿Me ayudan a elegir?`;
    return 'Hola, quiero ayuda para elegir una cabaña, un pasadía o un evento.';
  }
  /** El botón de WhatsApp abre el asistente; el traspaso a WhatsApp ocurre al final de la conversación. */
  function openWhatsApp() {
    // Solo se escribe un mensaje de partida cuando hay algo concreto que decir (favoritas o una ubicación).
    openContact(null, { note: favorites.size || activeLocation !== 'all' ? smartMessage() : '' });
  }

  /* ---------- Eventos ---------- */
  const handlers = {
    contact: () => { toggleMobileNav(false); openContact(null); },
    'close-modal': el => closeModal(el.closest('.modal-root')),
    'save-property': el => {
      const id = el.dataset.propertyId;
      const saved = !favorites.has(id);
      if (saved) favorites.add(id); else favorites.delete(id);
      persistFavorites();
      const name = CONFIG.properties.find(property => property.id === id)?.name || 'La propiedad';
      if (showFavorites && !saved) renderCards(activeLocation, page);
      else {
        el.setAttribute('aria-pressed', String(saved));
        el.classList.toggle('is-saved', saved);
        $('use', el).setAttribute('href', saved ? '#i-heart-fill' : '#i-heart');
        el.classList.remove('is-popping'); void el.offsetWidth; el.classList.add('is-popping');
        syncFavorites();
      }
      if (saved) nudgeFab();
      showToast(saved ? `${name} guardada en favoritos` : `${name} se quitó de favoritos`, saved && !showFavorites ? { label: 'Ver favoritos', run: openFavorites } : null);
    },
    'chat-consent': () => finishChat(),
    'chat-reset': el => {
      // Dos toques para borrar: el primero arma el botón, el segundo borra la conversación.
      if (!el.classList.contains('is-armed')) {
        el.classList.add('is-armed');
        el.setAttribute('aria-label', 'Toca de nuevo para borrar la conversación');
        window.setTimeout(() => { el.classList.remove('is-armed'); el.setAttribute('aria-label', 'Empezar una conversación nueva'); }, 3500);
        return;
      }
      resetChat();
    },
    'chat-handoff': () => {
      if (!chat || chat.sending) return;
      say({ from: 'me', kind: 'text', text: 'Quiero continuar en WhatsApp con un asesor.' });
      beginCapture();
    },
    'chat-open-property': el => {
      const property = CONFIG.properties.find(item => item.id === el.dataset.value);
      if (!property) return;
      closeModal(contactModal); // la conversación sigue guardada: se retoma desde el botón de WhatsApp
      renderPropertyModal(property);
    },
    'chat-whatsapp': async el => {
      const message = el.closest('.chat-actions')?.dataset.message || '';
      if (hasWhatsApp()) {
        window.open(`https://wa.me/${CONFIG.brand.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        showToast('Se abrió WhatsApp con tu mensaje. Revísalo y pulsa Enviar.');
        return;
      }
      // En la demostración aún no hay un número: el mensaje queda copiado para pegarlo donde corresponda.
      const copied = await copyText(message);
      showToast(copied ? 'Aún no hay un número de WhatsApp configurado: copié tu mensaje.' : 'Aún no hay un número de WhatsApp configurado. Selecciona el mensaje para copiarlo.');
    },
    'chat-quick': el => {
      const input = $('#chatInput', contactModal);
      if (!input || input.disabled) return;
      input.value = el.dataset.value;
      $('#chatForm', contactModal).requestSubmit();
    },
    'toggle-favorites': () => { showFavorites = !showFavorites; renderCards(); },
    'show-favorites': () => { toggleMobileNav(false); openFavorites(); },
    'show-all': () => { showFavorites = false; renderCards('all'); },
    whatsapp: () => { toggleMobileNav(false); openWhatsApp(); },
    'clear-departure': () => {
      const departure = $('#calc-departure', propertyModal);
      if (departure) departure.value = '';
      refreshCalculation();
    },
    'people-step': el => {
      const input = $('#calc-people', propertyModal);
      if (!input) return;
      input.value = String(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) + Number(el.dataset.step))));
      refreshCalculation();
    },
    'reel-toggle': () => {
      const video = reelVideo();
      if (!video) return;
      if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); } else video.pause();
      syncReelUi($('#modalStage', propertyModal), video);
    },
    'reel-sound': () => {
      const video = reelVideo();
      if (!video) return;
      video.muted = !video.muted;
      reelSound = !video.muted;
      $('#modalStage', propertyModal).classList.remove('needs-sound');
      syncReelUi($('#modalStage', propertyModal), video);
      if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    },
    gallery: el => {
      const prop = activeProperty;
      const stage = $('#modalStage', propertyModal);
      if (!prop || !stage) return;
      const index = Number(el.dataset.index);
      stage.classList.toggle('is-photo', index >= 0);
      setHtml(stage, index < 0 ? reelTemplate(prop) : html`<img id="modalMainImage" src="${prop.gallery[index]}" alt="Foto ${index + 1} de ${prop.name}" />`);
      stage.classList.remove('is-muted', 'is-paused', 'needs-sound');
      if (index < 0) startReel();
      $$('.gallery-thumb', propertyModal).forEach(btn => btn.classList.toggle('is-selected', btn === el));
    },
    'request-quote': () => {
      const context = currentEstimate || getCalculatorState();
      if (context?.estimate && !context.estimate.valid && !context.estimate.needsManual) { showToast(context.estimate.message); return; }
      openContact(context);
    },
    'copy-again': el => {
      const text = el.closest('.chat-actions')?.dataset.message || '';
      copyText(text).then(ok => showToast(ok ? 'Solicitud copiada al portapapeles.' : 'No fue posible copiar automáticamente.'));
    },
    privacy: (_el, event) => {
      event.preventDefault();
      showToast('La política de privacidad definitiva se incorporará antes del lanzamiento. Esta demo no guarda datos.');
    }
  };

  document.addEventListener('click', event => {
    if (event.target.closest('#locButton')) { setLocationMenu(!locationMenu.classList.contains('is-open')); return; }
    const option = event.target.closest('[data-location]');
    if (option) {
      renderCards(option.dataset.location);
      setLocationMenu(false);
      locationButton.focus({ preventScroll: true });
      return;
    }
    if (locationMenu.classList.contains('is-open') && !event.target.closest('#locFilter')) setLocationMenu(false);
    const pageButton = event.target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) {
      renderCards(activeLocation, Number(pageButton.dataset.page));
      $('.catalog-toolbar').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const openProp = event.target.closest('[data-open-property]');
    if (openProp) {
      const prop = CONFIG.properties.find(p => p.id === openProp.dataset.openProperty);
      if (prop) renderPropertyModal(prop);
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    const handler = actionEl && handlers[actionEl.dataset.action];
    if (handler) handler(actionEl, event);
  });

  const CALC_FIELDS = '#calc-people, #calc-date, #calc-departure, #calc-event-type';
  document.addEventListener('input', event => {
    if (event.target.matches(CALC_FIELDS)) refreshCalculation();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#calc-date')) {
      const dep = $('#calc-departure', propertyModal);
      const arrival = event.target.value;
      const previous = event.target.dataset.prev;
      if (dep && arrival) {
        dep.min = departureMin(activeProperty, arrival);
        if (dep.value && dep.value === previous && sameDayAllowed(activeProperty)) {
          dep.value = arrival; // un plan de un solo día sigue siendo de un solo día
        } else if (dep.value && dep.value < dep.min) {
          // Si la llegada alcanza a la salida, se conserva la duración que tenía la estancia.
          const kept = Pricing.nightsBetween(previous, dep.value);
          dep.value = kept > 0 ? addDays(arrival, kept) : dep.min;
        } else if (!dep.value && !supportsDayPass(activeProperty)) {
          dep.value = dep.min;
        }
      }
      event.target.dataset.prev = arrival;
    }
    if (event.target.matches(CALC_FIELDS)) refreshCalculation();
  });
  /** Al abrir la salida estando vacía, se preselecciona el día siguiente a la llegada. */
  function preselectDeparture(target) {
    if (!target.matches('#calc-departure') || target.value) return;
    const arrival = $('#calc-date', propertyModal)?.value;
    if (!arrival) return;
    target.value = supportsStay(activeProperty) ? addDays(arrival, 1) : arrival;
    refreshCalculation();
  }
  document.addEventListener('pointerdown', event => preselectDeparture(event.target), true);
  document.addEventListener('keydown', event => {
    if (['Enter', ' ', 'ArrowDown'].includes(event.key)) preselectDeparture(event.target);
    if (event.key === 'Escape') {
      if (locationMenu.classList.contains('is-open')) { setLocationMenu(false); locationButton.focus({ preventScroll: true }); return; }
      if (contactModal.classList.contains('is-open')) closeModal(contactModal);
      else if (propertyModal.classList.contains('is-open')) closeModal(propertyModal);
      toggleMobileNav(false);
      return;
    }
    if (locationMenu.classList.contains('is-open') && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const options = $$('.loc-option', locationMenu);
      const current = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
      return;
    }
    if (event.key === 'Tab') {
      const modal = contactModal.classList.contains('is-open') ? contactModal : (propertyModal.classList.contains('is-open') ? propertyModal : null);
      if (!modal) return;
      const focusable = $$('button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), a[href]', modal).filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  [propertyModal, contactModal].forEach(modal => modal.addEventListener('click', event => {
    if (event.target === modal) closeModal(modal);
  }));
  $('#menuToggle').addEventListener('click', () => toggleMobileNav());
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.matchMedia('(min-width: 900px)').addEventListener('change', event => { if (event.matches) toggleMobileNav(false); });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => toggleMobileNav(false)));
  $('#yearNow').textContent = new Date().getFullYear();
  renderCards('all');
  restoreChat();
  paintScroll();
  syncFab();
  // El botón de WhatsApp entra poco después de cargar y se despliega un momento para que se note.
  window.setTimeout(() => { fab.classList.add('is-visible'); nudgeFab(); }, 1400);
  injectStructuredData();
})();
