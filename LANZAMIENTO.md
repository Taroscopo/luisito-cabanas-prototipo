# Del prototipo al sitio real — lista de lanzamiento

Marca cada punto antes de publicar. Los que dependen de información del negocio están en **negrita**.

## 1. Contenido real

- [ ] **Propiedades, capacidades, amenidades y ubicaciones aprobadas por cada propietario** (`data.js`: `city`, `facts`, `amenities`, `cardSpecs`). Hoy `city` de dos de las tres cabañas es provisional («Cerca de Barranquilla», «Atlántico»): el filtro debe mostrar municipios reales.
- [ ] **Alojamiento por noche, capacidades, habitaciones y tarifas reales de las 19 cabañas** (hoy solo algunos precios por persona y capacidades salen de los textos de los reels; las tarifas por noche son de ejemplo).
- [ ] **Fotografías y reel autorizados** (`image`, `gallery`, `videoUrl`); sustituir la imagen conceptual del hero.
- [ ] **Tarifas por ocupación y temporada, recargos de fin de semana, noches festivas (`peakNights`), anticipo, saldo y cancelaciones.**
- [ ] Si se desea una sección «Sobre Luisito» (retrato o video autorizado), hay que diseñarla con material real: el marcador de la versión demo se eliminó.
- [ ] Quitar los textos «de ejemplo» de `data.js` y de `index.html` (nota del catálogo y pie de página).

## 2. Contacto

- [ ] **Número de WhatsApp comercial** en `brand.whatsappNumber` (con indicativo, sin `+`). Probar un envío real.
- [ ] Decidir dónde se guardan las solicitudes: `brand.leadsEndpoint` (formulario externo, Google Apps Script, Cloudflare Worker…) y/o `brand.leadEmail`. Verificar CORS y probar el envío desde el dominio final.
- [ ] La política de privacidad debe mencionar que el chat guarda la conversación (incluidos nombre y celular, si los escribe) en el navegador de la persona hasta 24 horas, y que puede borrarla en cualquier momento.
- [ ] **Política de privacidad y términos** publicados, y enlazados desde el pie y el formulario (hoy el enlace solo muestra un aviso). Revisar tratamiento de datos personales según la normativa colombiana (Ley 1581 de 2012).
- [ ] **Requisitos turísticos aplicables** al modelo comercial (por ejemplo, Registro Nacional de Turismo) revisados con un asesor.

## 3. Salir del modo demo

- [ ] `data.js`: `brand.demoMode: false` y `brand.siteUrl: 'https://tu-dominio'` (activa los datos estructurados JSON-LD).
- [ ] `index.html`: **eliminar** `<meta name="robots" content="noindex, nofollow" />`.
- [ ] `robots.txt`: sustituir por `User-agent: *`, `Allow: /` y `Sitemap: https://tu-dominio/sitemap.xml` (las instrucciones están en el propio archivo).
- [ ] Crear `sitemap.xml` con la URL final.
- [ ] `index.html`: poner **URLs absolutas** en `og:image` y `twitter:image` (`https://tu-dominio/assets/hero-cabanas.webp`) y añadir `<link rel="canonical" href="https://tu-dominio/">` y `og:url`. Los rastreadores de redes sociales no ejecutan JavaScript, por eso van fijas en el HTML.
- [ ] Imagen social recomendada de 1200 × 630 px (JPG o PNG: WhatsApp y algunos rastreadores no muestran WebP).

## 4. Verificación final

- [ ] `./tests/run-all.sh` sin fallos.
- [ ] Probar el sitio **desplegado** en móviles reales (iOS Safari y Android Chrome): formulario, calendario, WhatsApp, menú.
- [ ] Lighthouse (rendimiento, accesibilidad, SEO) sobre el dominio final.
- [ ] Servir con HTTPS y con cabeceras de caché largas para `assets/` (las fotos y fuentes no cambian a menudo) y sin caché para `index.html`.
