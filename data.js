/*
 * Datos de demostración centralizados. Ninguna tarifa, capacidad o amenidad es una oferta real.
 * Sustituir esta configuración por información verificada antes del lanzamiento.
 *
 * Qué viene de los reels y qué es provisional:
 *  - Nombre, reel y fotos: reales (fotogramas recortados de cada reel, sin subtítulos).
 *  - Ubicación, capacidad, habitaciones y algunos precios por persona: tomados de los textos en pantalla de cada reel
 *    cuando los había; verificar con el propietario.
 *  - Resto de tarifas, recargos, anticipo, datos clave (`facts`) y amenidades: de ejemplo.
 *
 * Campos que usa la interfaz:
 *  - city:      municipio. Alimenta el filtro de ubicación y es lo único que se muestra en la ficha (nunca la dirección exacta).
 *  - location:  texto corto de la tarjeta.
 *  - facts:     tarjetas de datos clave de la ficha [{ icon, value, label }].
 *  - amenities: lista de amenidades; el icono se asigna por palabra clave (ver AMENITY_ICONS en app.js).
 *  - cardSpecs: tres datos de la franja inferior de la tarjeta [{ icon, text }].
 *  - rates / dayPassPrice / eventFrom: precio. La tarjeta muestra «Desde» + el precio del primer rango y, debajo, para cuántas personas.
 */
const HIGH_SEASON = [{ name: 'Temporada alta', from: '12-15', to: '01-15', multiplier: 1.2 }];

window.DEMO_CONFIG = {
  brand: {
    name: 'Luisito el Viajero',
    whatsappNumber: '', // Configurar el número comercial con indicativo de país, sin + ni espacios (ej. 573001234567).
    leadsEndpoint: '', // Opcional: URL (https) que recibe cada solicitud como JSON por POST. Ver README.
    leadEmail: '', // Opcional: correo para ofrecer «Enviar por correo» si no hay WhatsApp.
    siteUrl: '', // Dominio público final (https://...). Se usa para datos estructurados y metadatos al lanzar.
    demoMode: true,
    currency: 'COP',
    locale: 'es-CO',
    defaultDepositPercent: 30
  },
  properties: [
    {
      id: 'casa-karkinos',
      name: 'Casa Karkinos',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Cerca de Barranquilla',
      location: 'A 25 min de Barranquilla',
      capacity: 12,
      dayPassCapacity: 20,
      capacityLabel: 'Hasta 12 personas',
      rooms: '4 habitaciones',
      facts: [
        { icon: 'bed', value: '4', label: 'Habitaciones' },
        { icon: 'users', value: '12', label: 'Capacidad alojamiento' },
        { icon: 'sun', value: '20', label: 'Capacidad pasadía' }
      ],
      amenities: ['Piscina', 'Jacuzzi', 'Terraza con vista al mar', 'Hamaca', 'Aire acondicionado', 'Cocina equipada', 'WiFi', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '12 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'waves', text: 'Vista al mar' }
      ],
      shortDescription: 'Casa de lujo con piscina y vista al mar, a 25 minutos de Barranquilla.',
      image: 'assets/img/casa-karkinos-1.webp',
      videoUrl: 'assets/reels/casa-karkinos.mp4',
      gallery: ['assets/img/casa-karkinos-1.webp', 'assets/img/casa-karkinos-2.webp', 'assets/img/casa-karkinos-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 1200000 },
        { min: 11, max: 12, nightly: 1500000 }
      ],
      weekendSurchargePercent: 10,
      peakSurchargePercent: 25,
      peakNights: ['2026-11-01', '2026-11-15', '2026-12-07', '2026-12-24', '2026-12-31'],
      seasons: HIGH_SEASON,
      dayPassPrice: 90000,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'villa-cristal',
      name: 'Villa Cristal',
      category: 'pasadia',
      categories: ['pasadia'],
      city: 'Atlántico',
      location: 'Atlántico',
      capacity: 20,
      dayPassCapacity: 20,
      capacityLabel: 'Hasta 20 personas',
      rooms: 'Zonas verdes',
      facts: [
        { icon: 'users', value: '20', label: 'Capacidad pasadía' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'tent', value: '1', label: 'Rancho' }
      ],
      amenities: ['Piscina', 'Rancho', 'Cocina equipada', 'Zonas verdes', 'Sonido', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'trees', text: 'Jardín' }
      ],
      shortDescription: 'Piscina, rancho y zonas verdes para pasar el día.',
      image: 'assets/img/villa-cristal-1.webp',
      videoUrl: 'assets/reels/villa-cristal.mp4',
      gallery: ['assets/img/villa-cristal-1.webp', 'assets/img/villa-cristal-2.webp', 'assets/img/villa-cristal-3.webp'],
      dayPassPrice: 70000,
      pricingModel: 'daypass',
      depositPercent: 30
    },
    {
      id: 'los-canaguates',
      name: 'Los Canaguates',
      category: 'evento',
      categories: ['evento'],
      city: 'Sabanagrande',
      location: 'Sabanagrande, Atlántico',
      capacity: 54,
      capacityLabel: 'Hasta 54 personas',
      rooms: 'Zona de eventos',
      facts: [
        { icon: 'users', value: '54', label: 'Capacidad eventos' },
        { icon: 'goal', value: '1', label: 'Cancha de fútbol' },
        { icon: 'pool', value: '1', label: 'Piscina' }
      ],
      amenities: ['Piscina', 'Cancha de fútbol', 'Zona de billar', 'Hamacas', 'Zona de juegos', 'Kiosco', 'Sonido', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '54 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'goal', text: 'Cancha' }
      ],
      shortDescription: 'Espacio amplio con piscina, cancha de fútbol y zonas de descanso para grupos.',
      image: 'assets/img/los-canaguates-1.webp',
      videoUrl: 'assets/reels/los-canaguates.mp4',
      gallery: ['assets/img/los-canaguates-1.webp', 'assets/img/los-canaguates-2.webp', 'assets/img/los-canaguates-3.webp'],
      eventFrom: 100000,
      eventPriceBasis: 'por persona',
      pricingModel: 'manual',
      depositPercent: 30
    },
    {
      id: 'cabana-exclusive',
      name: 'Cabaña Exclusive',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Atlántico',
      location: 'Atlántico',
      capacity: 16,
      capacityLabel: 'Hasta 16 personas',
      rooms: 'Habitaciones con literas',
      facts: [
        { icon: 'users', value: '16', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'sunset', value: '1', label: 'Terraza cubierta' }
      ],
      amenities: ['Piscina', 'Terraza cubierta', 'Habitaciones con literas', 'Zonas de descanso', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '16 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'sunset', text: 'Terraza' }
      ],
      shortDescription: 'La mejor cabaña luxury del Atlántico: piscina, terraza y habitaciones amplias.',
      image: 'assets/img/cabana-exclusive-1.webp',
      videoUrl: 'assets/reels/cabana-exclusive.mp4',
      gallery: ['assets/img/cabana-exclusive-1.webp', 'assets/img/cabana-exclusive-2.webp', 'assets/img/cabana-exclusive-3.webp'],
      rates: [
        { min: 1, max: 8, nightly: 1000000 },
        { min: 9, max: 16, nightly: 1700000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'casa-aledam',
      name: 'Casa Aledam',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Coveñas',
      location: 'Coveñas, Sucre',
      capacity: 20,
      capacityLabel: 'Hasta 20 personas',
      rooms: '5 habitaciones',
      facts: [
        { icon: 'bed', value: '5', label: 'Habitaciones' },
        { icon: 'users', value: '20', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' }
      ],
      amenities: ['Piscina', 'Frente al mar', 'Aire acondicionado', 'Cocina equipada', 'Pérgola', 'Televisión', 'Habitaciones equipadas'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'waves', text: 'Frente al mar' }
      ],
      shortDescription: 'Casa frente al mar en Coveñas, con piscina y cinco habitaciones equipadas.',
      image: 'assets/img/casa-aledam-1.webp',
      videoUrl: 'assets/reels/casa-aledam.mp4',
      gallery: ['assets/img/casa-aledam-1.webp', 'assets/img/casa-aledam-2.webp', 'assets/img/casa-aledam-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 1500000 },
        { min: 11, max: 20, nightly: 3000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'casa-mare',
      name: 'Casa Mare',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Cartagena',
      location: 'Cartagena, Bolívar',
      capacity: 8,
      capacityLabel: 'Hasta 8 personas',
      rooms: 'Casa colonial',
      facts: [
        { icon: 'users', value: '8', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'sunset', value: '1', label: 'Terraza' }
      ],
      amenities: ['Piscina', 'Terraza con vista', 'Cocina equipada', 'Aire acondicionado', 'Televisión'],
      cardSpecs: [
        { icon: 'users', text: '8 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'sunset', text: 'Terraza' }
      ],
      shortDescription: 'La casa famosa de Cartagena, con piscina interior y terraza.',
      image: 'assets/img/casa-mare-1.webp',
      videoUrl: 'assets/reels/casa-mare.mp4',
      gallery: ['assets/img/casa-mare-1.webp', 'assets/img/casa-mare-2.webp', 'assets/img/casa-mare-3.webp'],
      rates: [
        { min: 1, max: 4, nightly: 1000000 },
        { min: 5, max: 8, nightly: 2000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'casa-millonarios',
      name: 'Casa de los Millonarios',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Campeche',
      location: 'Campeche, Atlántico',
      capacity: 20,
      capacityLabel: 'Hasta 20 personas',
      rooms: 'Habitaciones equipadas',
      facts: [
        { icon: 'users', value: '20', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'tent', value: '1', label: 'Kiosco' }
      ],
      amenities: ['Piscina', 'Kiosco', 'Sonido', 'Zona de asados', 'Animales', 'Televisión', 'Aire acondicionado'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'trees', text: 'Animales' }
      ],
      shortDescription: 'A 30 minutos de Barranquilla: piscina, kiosco, zona de asados y animales.',
      image: 'assets/img/casa-millonarios-1.webp',
      videoUrl: 'assets/reels/casa-millonarios.mp4',
      gallery: ['assets/img/casa-millonarios-1.webp', 'assets/img/casa-millonarios-2.webp', 'assets/img/casa-millonarios-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 1400000 },
        { min: 11, max: 20, nightly: 2600000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'coralito',
      name: 'Coralito',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Santa Marta',
      location: 'Santa Marta, Magdalena',
      capacity: 7,
      capacityLabel: 'Hasta 7 personas',
      rooms: 'Apartamento',
      facts: [
        { icon: 'users', value: '7', label: 'Capacidad alojamiento' },
        { icon: 'waves', value: '1', label: 'Playa privada' },
        { icon: 'clock', value: '10 min', label: 'Del aeropuerto' }
      ],
      amenities: ['Aire acondicionado', 'Balcón con vista', 'Playa privada', 'Cocina equipada', 'Televisión', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '7 personas' },
        { icon: 'waves', text: 'Playa privada' },
        { icon: 'sunset', text: 'Balcón' }
      ],
      shortDescription: 'Alojamiento exclusivo en Santa Marta con playa privada y balcón con vista.',
      image: 'assets/img/coralito-1.webp',
      videoUrl: 'assets/reels/coralito.mp4',
      gallery: ['assets/img/coralito-1.webp', 'assets/img/coralito-2.webp', 'assets/img/coralito-3.webp'],
      rates: [
        { min: 1, max: 4, nightly: 700000 },
        { min: 5, max: 7, nightly: 950000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'el-caney',
      name: 'El Caney',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Costa Caribe',
      location: 'Costa Caribe',
      capacity: 24,
      capacityLabel: 'Hasta 24 personas',
      rooms: '8 habitaciones',
      facts: [
        { icon: 'bed', value: '8', label: 'Habitaciones' },
        { icon: 'users', value: '24', label: 'Capacidad alojamiento' },
        { icon: 'goal', value: '1', label: 'Mini cancha' }
      ],
      amenities: ['Piscina', 'Paseo a caballo', 'Mini cancha', 'Billar', 'Restaurante', 'Aire acondicionado'],
      cardSpecs: [
        { icon: 'users', text: '24 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'goal', text: 'Mini cancha' }
      ],
      shortDescription: 'La única cabaña con caballos: ocho habitaciones, piscina, billar y mini cancha.',
      image: 'assets/img/el-caney-1.webp',
      videoUrl: 'assets/reels/el-caney.mp4',
      gallery: ['assets/img/el-caney-1.webp', 'assets/img/el-caney-2.webp', 'assets/img/el-caney-3.webp'],
      rates: [
        { min: 1, max: 12, nightly: 1500000 },
        { min: 13, max: 24, nightly: 2800000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'exotic-house',
      name: 'Exotic House',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Cerca de Barranquilla',
      location: 'A 15 min de Barranquilla',
      capacity: 20,
      capacityLabel: 'Hasta 20 personas',
      rooms: 'Casa 5 estrellas',
      facts: [
        { icon: 'users', value: '20', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'billiard', value: '1', label: 'Billar' }
      ],
      amenities: ['Piscina', 'Billar', 'Fogata', 'Asador', 'Cuatrimoto', 'Kiosco', 'Aire acondicionado'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'billiard', text: 'Billar' }
      ],
      shortDescription: 'La única cabaña 5 estrellas: piscina con fogata, billar, asador y cuatrimoto.',
      image: 'assets/img/exotic-house-1.webp',
      videoUrl: 'assets/reels/exotic-house.mp4',
      gallery: ['assets/img/exotic-house-1.webp', 'assets/img/exotic-house-2.webp', 'assets/img/exotic-house-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 1500000 },
        { min: 11, max: 20, nightly: 3000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'la-martina',
      name: 'La Martina',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Cerca de Barranquilla',
      location: 'A 10 min de Barranquilla',
      capacity: 24,
      capacityLabel: 'Hasta 24 personas',
      rooms: 'Habitaciones dotadas',
      facts: [
        { icon: 'users', value: '24', label: 'Capacidad alojamiento' },
        { icon: 'pool', value: '1', label: 'Piscina' },
        { icon: 'goal', value: '1', label: 'Cancha de fútbol' }
      ],
      amenities: ['Piscina', 'Jacuzzi', 'Cancha de fútbol', 'Animales y aves', 'Cocina equipada', 'Aire acondicionado'],
      cardSpecs: [
        { icon: 'users', text: '24 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'goal', text: 'Cancha' }
      ],
      shortDescription: 'La única cabaña con zoológico, a 10 minutos de Barranquilla.',
      image: 'assets/img/la-martina-1.webp',
      videoUrl: 'assets/reels/la-martina.mp4',
      gallery: ['assets/img/la-martina-1.webp', 'assets/img/la-martina-2.webp', 'assets/img/la-martina-3.webp'],
      rates: [
        { min: 1, max: 12, nightly: 1600000 },
        { min: 13, max: 24, nightly: 3000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'la-modelo',
      name: 'La Modelo',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Cerca de Barranquilla',
      location: 'A 15 min de Barranquilla',
      capacity: 40,
      capacityLabel: 'Hasta 40 personas',
      rooms: '7 habitaciones',
      facts: [
        { icon: 'bed', value: '7', label: 'Habitaciones' },
        { icon: 'users', value: '40', label: 'Capacidad alojamiento' },
        { icon: 'flame', value: '1', label: 'Fogata' }
      ],
      amenities: ['Piscina', 'Fogata', 'Billar', 'Sonido', 'Cocina equipada', 'Aire acondicionado', 'Terraza con vista', 'Hamacas'],
      cardSpecs: [
        { icon: 'users', text: '40 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'flame', text: 'Fogata' }
      ],
      shortDescription: 'Siete habitaciones, piscina, fogata y terraza para grupos de hasta 40 personas.',
      image: 'assets/img/la-modelo-1.webp',
      videoUrl: 'assets/reels/la-modelo.mp4',
      gallery: ['assets/img/la-modelo-1.webp', 'assets/img/la-modelo-2.webp', 'assets/img/la-modelo-3.webp'],
      rates: [
        { min: 1, max: 20, nightly: 2000000 },
        { min: 21, max: 40, nightly: 4000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'la-tesalia',
      name: 'La Tesalia',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Cerca de Barranquilla',
      location: 'A 15 min de Barranquilla',
      capacity: 30,
      capacityLabel: 'Hasta 30 personas',
      rooms: 'Casa nueva',
      facts: [
        { icon: 'users', value: '30', label: 'Capacidad alojamiento' },
        { icon: 'goal', value: '1', label: 'Cancha de fútbol' },
        { icon: 'flame', value: '1', label: 'Fogata' }
      ],
      amenities: ['Piscina', 'Fogata', 'Asador', 'Cancha de fútbol', 'Kiosco', 'Hamaca', 'Televisión', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '30 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'flame', text: 'Fogata' }
      ],
      shortDescription: 'Cabaña totalmente nueva con piscina, fogata, asador y cancha de fútbol.',
      image: 'assets/img/la-tesalia-1.webp',
      videoUrl: 'assets/reels/la-tesalia.mp4',
      gallery: ['assets/img/la-tesalia-1.webp', 'assets/img/la-tesalia-2.webp', 'assets/img/la-tesalia-3.webp'],
      rates: [
        { min: 1, max: 15, nightly: 900000 },
        { min: 16, max: 30, nightly: 1800000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    },
    {
      id: 'los-choquitos',
      name: 'Los Choquitos',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Sabanagrande',
      location: 'Sabanagrande, Atlántico',
      capacity: 30,
      dayPassCapacity: 60,
      capacityLabel: 'Hasta 30 personas',
      rooms: 'Habitaciones para 10 personas',
      facts: [
        { icon: 'users', value: '30', label: 'Capacidad alojamiento' },
        { icon: 'sun', value: '60', label: 'Capacidad pasadía' },
        { icon: 'pool', value: '1', label: 'Piscina' }
      ],
      amenities: ['Piscina', 'Fogata', 'Zona de asados', 'Columpio', 'Trampolín', 'Cancha de fútbol', 'Sonido'],
      cardSpecs: [
        { icon: 'users', text: '30 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'flame', text: 'Fogata' }
      ],
      shortDescription: 'La cabaña luxury de Sabanagrande: piscina con chorros, fogata, zona de asados y trampolín.',
      image: 'assets/img/los-choquitos-1.webp',
      videoUrl: 'assets/reels/los-choquitos.mp4',
      gallery: ['assets/img/los-choquitos-1.webp', 'assets/img/los-choquitos-2.webp', 'assets/img/los-choquitos-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 400000 },
        { min: 11, max: 30, nightly: 1200000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      dayPassPrice: 40000,
      depositPercent: 30
    },
    {
      id: 'los-flamencos',
      name: 'Los Flamencos',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Coveñas',
      location: 'Coveñas, Sucre',
      capacity: 120,
      dayPassCapacity: 150,
      capacityLabel: 'Hasta 120 personas',
      rooms: '27 alojamientos',
      facts: [
        { icon: 'bed', value: '27', label: 'Alojamientos' },
        { icon: 'users', value: '120', label: 'Capacidad total' },
        { icon: 'utensils', value: '1', label: 'Bar en la orilla' }
      ],
      amenities: ['Frente al mar', 'Bar en la orilla', 'Cocina equipada', 'Restaurante', 'Zonas verdes'],
      cardSpecs: [
        { icon: 'users', text: '120 personas' },
        { icon: 'waves', text: 'Frente al mar' },
        { icon: 'utensils', text: 'Bar' }
      ],
      shortDescription: 'Cabaña frente al mar en Coveñas, con 27 alojamientos y bar en la orilla.',
      image: 'assets/img/los-flamencos-1.webp',
      videoUrl: 'assets/reels/los-flamencos.mp4',
      gallery: ['assets/img/los-flamencos-1.webp', 'assets/img/los-flamencos-2.webp', 'assets/img/los-flamencos-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 800000 },
        { min: 11, max: 30, nightly: 2400000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      dayPassPrice: 80000,
      depositPercent: 30
    },
    {
      id: 'los-palaitos',
      name: 'Los Palaitos',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Atlántico',
      location: 'Atlántico',
      capacity: 50,
      dayPassCapacity: 80,
      capacityLabel: 'Hasta 50 personas',
      rooms: 'Habitaciones con aire acondicionado',
      facts: [
        { icon: 'users', value: '50', label: 'Capacidad alojamiento' },
        { icon: 'sun', value: '80', label: 'Capacidad pasadía' },
        { icon: 'pool', value: '1', label: 'Piscina' }
      ],
      amenities: ['Piscina', 'Asador', 'Cuatrimoto', 'Paseos a caballo', 'Aire acondicionado', 'Zona de eventos', 'Sonido'],
      cardSpecs: [
        { icon: 'users', text: '50 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'flame', text: 'Asador' }
      ],
      shortDescription: 'La cabaña más completa del Atlántico: piscina, asador, cuatrimoto y espacio para más de 50 personas.',
      image: 'assets/img/los-palaitos-1.webp',
      videoUrl: 'assets/reels/los-palaitos.mp4',
      gallery: ['assets/img/los-palaitos-1.webp', 'assets/img/los-palaitos-2.webp', 'assets/img/los-palaitos-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 700000 },
        { min: 11, max: 50, nightly: 3000000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      dayPassPrice: 50000,
      depositPercent: 30
    },
    {
      id: 'maicao-beach',
      name: 'Maicao Beach',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Sabanilla',
      location: 'Sabanilla, Atlántico',
      capacity: 20,
      dayPassCapacity: 60,
      capacityLabel: 'Hasta 20 personas',
      rooms: 'Habitaciones privadas y compartidas',
      facts: [
        { icon: 'users', value: '20', label: 'Capacidad alojamiento' },
        { icon: 'sun', value: '60', label: 'Capacidad pasadía' },
        { icon: 'sunset', value: '1', label: 'Terraza con vista' }
      ],
      amenities: ['Piscina', 'Terraza con vista al mar', 'Hamacas', 'Salón de eventos', 'Sonido', 'Aire acondicionado'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'sunset', text: 'Vista al mar' }
      ],
      shortDescription: 'La cabaña más reservada: piscina, terraza frente al mar y espacio para celebraciones.',
      image: 'assets/img/maicao-beach-1.webp',
      videoUrl: 'assets/reels/maicao-beach.mp4',
      gallery: ['assets/img/maicao-beach-1.webp', 'assets/img/maicao-beach-2.webp', 'assets/img/maicao-beach-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 900000 },
        { min: 11, max: 20, nightly: 1700000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      dayPassPrice: 40000,
      depositPercent: 30
    },
    {
      id: 'villa-sofia',
      name: 'Villa Sofía',
      category: 'alojamiento',
      categories: ['alojamiento', 'pasadia'],
      city: 'Cerca de Barranquilla',
      location: 'Cerca de Barranquilla',
      capacity: 20,
      dayPassCapacity: 100,
      capacityLabel: 'Hasta 20 personas',
      rooms: 'Habitaciones con literas',
      facts: [
        { icon: 'users', value: '20', label: 'Capacidad alojamiento' },
        { icon: 'sun', value: '100', label: 'Capacidad pasadía' },
        { icon: 'trees', value: '3.600', label: 'Metros cuadrados' }
      ],
      amenities: ['Piscina', 'Kioscos', 'Columpios', 'Zona de juegos', 'Aire acondicionado', 'Parqueadero'],
      cardSpecs: [
        { icon: 'users', text: '20 personas' },
        { icon: 'pool', text: 'Piscina' },
        { icon: 'trees', text: '3.600 m²' }
      ],
      shortDescription: 'La cabaña más grande: 3.600 m² con piscina y kioscos para bodas, cumpleaños y pasadías.',
      image: 'assets/img/villa-sofia-1.webp',
      videoUrl: 'assets/reels/villa-sofia.mp4',
      gallery: ['assets/img/villa-sofia-1.webp', 'assets/img/villa-sofia-2.webp', 'assets/img/villa-sofia-3.webp'],
      rates: [
        { min: 1, max: 10, nightly: 1000000 },
        { min: 11, max: 20, nightly: 1800000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      dayPassPrice: 35000,
      depositPercent: 30
    },
    {
      id: 'villa-sol',
      name: 'Villa Sol',
      category: 'alojamiento',
      categories: ['alojamiento'],
      city: 'Salinas del Rey',
      location: 'Salinas del Rey, Atlántico',
      capacity: 30,
      capacityLabel: 'Hasta 30 personas',
      rooms: 'Casa de 3 pisos',
      facts: [
        { icon: 'users', value: '30', label: 'Capacidad alojamiento' },
        { icon: 'sunset', value: '3', label: 'Pisos' },
        { icon: 'billiard', value: '1', label: 'Billar' }
      ],
      amenities: ['Terrazas con vista al mar', 'Billar', 'Dominó', 'Sonido', 'Cocina equipada', 'Piscina', 'Zona de césped'],
      cardSpecs: [
        { icon: 'users', text: '30 personas' },
        { icon: 'sunset', text: 'Terrazas' },
        { icon: 'billiard', text: 'Billar' }
      ],
      shortDescription: 'Cabaña de tres pisos frente al mar, a 20 minutos de Barranquilla.',
      image: 'assets/img/villa-sol-1.webp',
      videoUrl: 'assets/reels/villa-sol.mp4',
      gallery: ['assets/img/villa-sol-1.webp', 'assets/img/villa-sol-2.webp', 'assets/img/villa-sol-3.webp'],
      rates: [
        { min: 1, max: 15, nightly: 1200000 },
        { min: 16, max: 30, nightly: 2400000 }
      ],
      weekendSurchargePercent: 10,
      seasons: HIGH_SEASON,
      minimumNights: 1,
      maxNights: 14,
      pricingModel: 'tiers',
      depositPercent: 30
    }
  ]
};
