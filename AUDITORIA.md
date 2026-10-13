# Auditoría de la entrega — Luisito el Viajero v1.2

**Referencia visual:** captura proporcionada por el usuario el 10 de octubre de 2026.  
**Objetivo v1.1:** ajustar la primera pantalla a esa composición y verificar que el restyling no rompa las interacciones comerciales de demostración.  
**Objetivo v1.2 (12 de octubre de 2026):** endurecer el código, ampliar el motor de precios, preparar el camino a producción y automatizar las pruebas.

## Cambios de la revisión v1.2

| Área | Cambio |
|---|---|
| Pruebas | `tests/audit-static.py` ya no necesita `bs4` ni `tinycss2` (solo biblioteca estándar). Nuevo `tests/browser-smoke.html` (33 comprobaciones sobre la web real) y `tests/run-all.sh`, que lo ejecuta en Chromium sin interfaz junto con el resto. |
| Seguridad | Las plantillas de `app.js` usan una etiqueta `html\`…\`` que escapa todo valor interpolado. Hay un test que inyecta HTML en un dato y comprueba que no se crea ningún elemento. |
| Código | `nightsBetween` ya no está duplicado. Las plantillas de 1 000+ caracteres en una línea se dividieron en funciones legibles; los eventos se despachan con una tabla de manejadores. |
| Precios | Temporadas (también las que cruzan de año), recargo de fin de semana, noches festivas, `maxNights`, validación estricta de fechas (rechaza `2026-02-31`) y desglose por línea en la UI. 12 grupos de pruebas. |
| Solicitudes | Envío opcional a un endpoint (`leadsEndpoint`) con honeypot, botón «Enviar por correo» (`leadEmail`) y WhatsApp. Si el portapapeles no responde, la interfaz ya no se queda bloqueada (tiempo límite de 1,5 s). |
| SEO | Metadatos Open Graph y Twitter, favicon SVG, `robots.txt`, `noindex` mientras sea demo y JSON-LD que solo se emite con `demoMode: false` (para no publicar propiedades ficticias). |
| Rendimiento y privacidad | Fuentes alojadas en `assets/fonts/` (63 KB, OFL) con precarga; ya no hay peticiones a Google. Un test comprueba que no se contacta ningún origen externo. |
| Desarrollo | `serve.py` sirve sin caché (con `http.server` el navegador mostraba JS antiguo tras editar). |
| Limpieza | Se eliminó una declaración muerta de `--serif: "Playfair Display"` en `styles.css`. |
| v1.3 · Ficha de propiedad | Rediseñada para conversión: reel vertical 9:16 (video si hay `videoUrl`, marcador si no) con miniaturas debajo; a la derecha solo nombre, municipio, capacidad, precio «desde» y calculadora compacta (fechas en una fila, sin slider, solo total y anticipo). Se quitaron descripción, amenidades, mapa, textos de demostración y el botón «Vista del reel». |
| v1.4 · Rediseño móvil | Auditoría de diseño con medición objetiva: 40+ textos de 7–11 px, botones de 30–38 px, menú translúcido, sección «Sobre Luisito» con marcador «LV», vídeo de presentación inexistente, filtros ocultos y título roto «convienesaber». Se reescribió `styles.css` completo (mobile-first, una sola capa, tokens, texto ≥ 12 px y cuerpo 16 px, objetivos táctiles ≥ 44 px, campos a 16 px para evitar el zoom de iOS), se simplificó el HTML y se rehízo: cabecera fija con CTA «Cotizar» y menú móvil sólido; hero con encuadre propio; filtros visibles; tarjetas con el precio en el pie; fichas a pantalla completa con botón de consulta fijo; formulario reducido a nombre, celular y autorización cuando viene de la calculadora. Se eliminaron las secciones «Sobre Luisito», «Elige tu plan», «Cómo funciona», el texto de relleno y el vídeo de presentación (con su código). Nuevo test que mide estos mínimos en móvil. |
| v1.5 · Tarjetas, ficha y cotizador | Se recupera la composición aprobada de las tarjetas (foto con título, lugar y precio sobre la imagen, franja clara con tres datos) a tamaños legibles. Se elimina el título «Nuestras cabañas» y los filtros por tipo: queda un único filtro por ubicación (municipio), que se genera solo a partir de `city` en `data.js`. Iconografía propia en un sprite SVG de trazo único (sin emojis ni caracteres sueltos). Ficha: reel, galería, municipio, tarjetas de datos clave (`facts`), amenidades con icono y, al final, el cotizador. El cotizador pide llegada, salida y personas; la salida es opcional (sin salida, o el mismo día, cotiza un pasadía si la propiedad lo ofrece) y no hay selector de tipo de plan. Movimiento: entrada escalonada del hero, parallax del texto, barra de progreso, aparición de tarjetas con asentamiento de la imagen, menú con resorte, microinteracciones (corazón, flecha, contador, miniaturas) y resplandor en el cierre; solo `transform` y `opacity`, y se desactiva con movimiento reducido. Smoke test: 24 comprobaciones. |
| v1.6 · Revisión como usuario | Se recorrió la web como visitante a 1440 y 390 px con capturas a resolución real. Iconografía unificada con Phosphor (MIT) en un sprite SVG; amenidades en lista de dos columnas con icono grande, estilo plataformas de reservas. Cotizador renombrado «Cotiza tu plan»: caja única con celdas Llegada · Salida opcional · Personas, botón discreto para quitar la salida (se eliminó el aviso «Cotizar solo un día»), total claro y nota «No se hace ningún cobro»; en móvil, barra inferior con total y botón. Formulario de contacto simplificado: ya no se vuelve a pedir ni a editar el plan, solo nombre, celular y autorización con un resumen del plan elegido; la ficha queda detrás y «Volver» conserva lo calculado; en móvil se abre como hoja inferior. Tamaños de titulares reducidos. Distintivo «Reel» en las tarjetas. Mensajes de precio reescritos para el visitante. Corregido: el foco con Tab podía caer en controles no visibles. `tests/run-smoke.mjs` sustituye a `--dump-dom`, que podía quedarse colgado. Smoke test: 27 comprobaciones. |
| v1.7 · Cotizador y datos clave | Tarjetas de datos clave centradas, con icono en verde, cifra y rótulo corto («Capacidad alojamiento»), alineadas entre sí. Contador de personas centrado (− 10 personas +). Fechas condicionadas: al elegir la llegada, la salida pasa al día siguiente; si la salida está vacía y se toca, se preselecciona el día siguiente; si la llegada alcanza a la salida, se conserva la duración; con pasadía disponible la salida puede ser el mismo día o quedar vacía, y sin pasadía es obligatoria y posterior a la llegada. Estancia por defecto de 1 noche. Smoke test: 28 comprobaciones. |
| v1.8 · Catálogo completo, favoritos y conversión | Se cargan las 19 cabañas de los reels: video sin recompresión, tres fotos limpias recortadas por cabaña (sin subtítulos ni textos encima) y nombre, lugar, capacidad, habitaciones y precios por persona tomados de los textos en pantalla; el resto es de ejemplo y está marcado en `data.js`. Precio de tarjeta: «Desde» + valor y, debajo, para cuántas personas (sin «por persona» ni «por noche»). Favoritos: corazón con memoria en el navegador, contador, vista exclusiva de favoritas con estado vacío, aviso con acceso directo. Botón flotante de WhatsApp «inteligente»: aparece al bajar, adapta su texto (favoritas, ubicación filtrada o general) y su mensaje; sin número configurado abre el formulario con el mensaje ya escrito. Preguntas frecuentes ampliadas con llamada a un asesor; cierre rediseñado con la foto del hero, tres ventajas y botones propios (sin degradado genérico); pie de tres columnas. Botones con esquinas redondeadas en lugar de píldoras. Filtro de ubicación ordenado alfabéticamente con altura máxima. Smoke test: 31 comprobaciones. |
| v1.9 · Cotizador uniforme, hero 3:4 y WhatsApp visible | El cotizador pide «Llegada» y «Salida» en todas las propiedades (antes Villa Cristal y los eventos solo mostraban una fecha) y desaparece la palabra «opcional». Reglas: alojamiento exige salida posterior; con pasadía disponible la salida puede quedar vacía o ser el mismo día; pasadía y evento llevan por defecto la salida igual a la llegada, se mantienen sincronizadas al cambiar la llegada y, si se elige otro día, derivan a cotización a medida («Un pasadía es de un solo día»). Hero móvil en formato 3:4 (foto recortada a 1200×1600, altura = 133 % del ancho, máx. 700 px) con el texto abajo sobre el agua para no tapar a Luisito; el texto de apoyo solo se muestra en escritorio. El botón flotante de WhatsApp entra 1,4 s después de cargar y es visible siempre (antes solo aparecía al bajar). Smoke test: 33 comprobaciones. |
| v2.0 · Chat estilo WhatsApp y franja de iconos | El contacto pasa de formulario a un chat con el aspecto y los gestos de WhatsApp: cabecera con avatar de marca y «en línea», burbujas entrantes y salientes con cola, hora y doble check que se vuelve azul, fondo con patrón, indicador de «escribiendo…», respuestas rápidas y barra de escritura con botón de envío. Conversación guiada: mensaje (solo sin plan) → nombre → celular → «Autorizo y enviar»; con un plan elegido, el plan viaja como tarjeta en una burbuja saliente. Cada dato se valida con un mensaje del asesor; al cerrar a mitad la conversación se detiene. El envío sigue los tres caminos (endpoint, WhatsApp, portapapeles) con el mismo honeypot. En escritorio es una ventana anclada abajo a la derecha; en móvil, pantalla completa. Franja de iconos de las tarjetas: tres columnas iguales con el icono centrado sobre su texto y separadores finos. Smoke test: 33 comprobaciones. |
| v2.1 · Asistente en el chat y traspaso a WhatsApp | El chat deja de ser un formulario y pasa a ser un asistente de reglas (`assistant.js`, sin IA generativa): entiende personas, fechas («del 15 al 17 de noviembre», «este fin de semana», «el sábado»), noches, ubicación, tipo de plan, nombre de cabaña y amenidades; recomienda cabañas cuya capacidad cubre al grupo, calcula el valor estimado con `pricing.js` y responde ubicación (solo municipio), capacidad, habitaciones, amenidades, anticipo y reserva. Honestidad por diseño: no confirma disponibilidad (lo dice y deriva), no inventa precios y lo que no sabe (horarios, mascotas, medios de pago, cancelación) lo deriva con un botón «Continuar en WhatsApp» que guarda la pregunta. Traspaso: tras nombre, celular y autorización se muestra el mensaje personalizado («Hola, soy Ana. Quisiera hacer una reserva.» o «Tengo esta consulta: «…»», más cabaña, fechas, personas, ubicación y valor estimado) y un botón que abre `wa.me`; el botón flotante abre siempre el asistente. 16 grupos de pruebas del motor y 37 comprobaciones de navegador. |
| v2.2 · Chat persistente | La conversación ya no se destruye al cerrar la ventana: sigue viva (si el asesor estaba escribiendo, la respuesta llega igual y el botón de WhatsApp muestra «Tienes una respuesta nueva» con un punto rojo), se retoma exactamente donde quedó al volver de una ficha y conserva el contexto (personas, fechas, ubicación). Se guarda 24 h en el navegador (`localStorage`, clave `luisito:chat`) como registros sencillos —no HTML—, se restaura al recargar sin animaciones y caduca sola. Si una respuesta se interrumpe por cerrar la página, el asesor lo dice al volver. Un plan elegido con «Consultar disponibilidad» se suma a la misma conversación y, si ya dio nombre, celular y autorización, no se piden de nuevo. Botón «Borrar» en la cabecera con confirmación de dos toques. Smoke test: 42 comprobaciones. |
| v2.3 · Sistema tipográfico | Se aplica el sistema tipográfico (Cormorant Garamond para títulos y cifras de ficha, DM Sans para el resto y todo el chat), alojado en local. Tamaños adaptados al mínimo de 12 px del proyecto; el nombre de la tarjeta admite dos líneas. Se corrigió que el total estimado mostrara cifras de texto (el `tabular-nums` de otra regla anulaba `lining-nums`). Auditoría estática: fuentes declaradas, precargadas con `crossorigin` y solo dos familias. Hero rediseñado: nuevo copy («Escápate a lo extraordinario.» + subtexto), centrado en la parte alta y botón abajo; prueba de posición a 390, 768 y 1280 px. Smoke test: 45 comprobaciones (qué va en serif/sans, cifras alineadas, nombres sin cortar a 320 y 390 px). |
| v2.4 · Botones sutiles | Todos los botones pasan a una escala más discreta: píldoras de filtro de 210×44 y 120×44 px (antes 380×52 y 136×52), botones de 46 px con letra de peso medio (antes 52 px y semibold), sombras y degradados casi eliminados, botón flotante de 52 px con aro más tenue. Se conserva el mínimo táctil de 44 px. Prueba nueva que fija los tamaños. |
| v2.5 · Paginación, reel con sonido y revisión móvil/tableta | Catálogo de 9 en 9 con paginador. Reel con controles propios (pausa, sonido y progreso), arranque con audio en el toque que abre la ficha y aviso «Activar sonido» si el navegador lo bloquea; la X de cerrar es un único botón dentro de la tarjeta del video, arriba a la derecha (sin barra superior), lejos de los botones de pausa y sonido; reel ~20 % más alto. Barrido automático de las 19 fichas en 320–1280 px: en tableta (768–959 px) la ficha en dos columnas dejaba fechas cortadas (`19/10/202`), «por noche» partido y amenidades pisadas → ahora una columna hasta 960 px. Ubicación de la tarjeta a dos líneas en vez de «…». Altura del chat según el viewport visual (teclado) y ajuste del campo de fecha en iPhone. Smoke test: 49 comprobaciones. |
| v1.3 · Hero | Fotografía propia (`hero_cabañas_lusito.HEIC`, 3866×5494) convertida a WebP con `q:v 92`: `hero-cabanas.webp` (2560×1098, recorte panorámico con Luisito a la derecha del titular) y `hero-cabanas-mobile.webp` (1170×2340, recorte vertical con el techo oscuro bajo el texto y Luisito en el tercio inferior). Precarga por tamaño de pantalla. Se eliminaron las imágenes conceptuales del hero anterior. |
| v1.3 · Tipografía | Toda la web usa DM Sans (sin serif decorativa); se eliminó Cormorant Garamond (−77 KB). El logotipo es ahora la imagen `assets/logo.webp` (fondo transparente, creada a partir de `logo_luisito.jpeg`), así que Allura también se eliminó. |

**Verificación de que las pruebas detectan fallos:** se desactivó a propósito el escape de HTML y el smoke test falló exactamente en la comprobación correspondiente; después se restauró el código.

**Limitaciones conocidas de esta revisión**

- El smoke test sustituye el portapapeles y `window.open` por dobles de prueba; el copiado real y la apertura de WhatsApp dependen del navegador y no se han probado en dispositivos físicos.
- No se probó contra un endpoint real: se simula `fetch`. Hay que probarlo con el servicio elegido (CORS incluido).
- Los recargos, temporadas y festivos de `data.js` son valores de ejemplo, no tarifas autorizadas.
- Sigue pendiente todo lo de `LANZAMIENTO.md` que depende de información del negocio (WhatsApp real, contenido aprobado, política de privacidad, requisitos turísticos).

## Resultado de revisión visual

- El hero de escritorio se fija en 548 px con viewport de 1024 px de alto, alineado con la proporción de la referencia.
- La navegación es transparente sobre la foto; la marca, el menú, el botón de asesor, el titular, el CTA y el acceso a la historia se ubican dentro del hero.
- Se elimina visualmente la franja introductoria que antes separaba el hero del catálogo.
- El encabezado del catálogo usa tres zonas: título, descripción y botón para revelar filtros.
- Las tres tarjetas de ejemplo tienen imagen panorámica, categoría, botón de favoritos, nombre y ubicación sobre fotografía; precio en la esquina inferior, flecha circular y una franja independiente de amenidades.
- Se incorporó una fotografía panorámica optimizada para escritorio y una composición vertical específica para móvil, evitando el recorte del protagonista en pantallas estrechas.
- El aviso de demostración identifica que fotografía, propiedades, capacidades y precios son ficticios.

## Controles estáticos y de lógica

| Control | Resultado | Evidencia |
|---|---|---|
| Parseo de HTML e IDs duplicados | Aprobado | `tests/audit-static.py` |
| Referencias a CSS, JS, fuentes e imágenes locales | Aprobado | `tests/audit-static.py` |
| Balance de llaves y paréntesis en CSS | Aprobado | `tests/audit-static.py` (v1.2 sustituye el parser `tinycss2`) |
| Sintaxis JavaScript | Aprobado | `node --check` para `app.js`, `data.js`, `pricing.js` |
| Cálculos de noches y tarifa por rango | Aprobado | `tests/test-pricing.js` |
| Anticipo y saldo | Aprobado | Se verifica 30 % ilustrativo y saldo igual al total menos el anticipo |
| Pasadía | Aprobado | 4 personas × $70.000 = $280.000; anticipo ilustrativo $84.000 |
| Exceso de capacidad y evento | Aprobado | No se inventa un total; deriva a cotización manual |
| Número de WhatsApp | Bloqueado deliberadamente | `whatsappNumber` permanece vacío |
| Disponibilidad | No integrada | No se afirma disponibilidad en tiempo real ni se confirma una reserva |

## Pruebas de navegador realizadas en esta revisión

Se usó Chromium con Playwright para renderizar la página en un viewport de escritorio (1536 × 1024) y uno móvil (390 × 844), incrustando CSS, scripts e imágenes locales en un documento de prueba. Esta vía evitó la restricción del entorno que bloqueaba la navegación directa a `file://` y `localhost`.

Resultados observados:

- Se renderizan tres tarjetas iniciales.
- El hero de escritorio mide 548 px a 1024 px de alto.
- La ficha modal abre y se cierra con Escape.
- El botón «Ver todas las cabañas» revela los filtros; el filtro «Eventos» deja una tarjeta y «Todas» restaura las tres.
- La calculadora de Cabaña Mar Azul devuelve $2.400.000 para 10 personas durante dos noches y desglosa el anticipo de $720.000 y el saldo de $1.680.000.
- El botón de favoritos alterna su estado.
- En el viewport móvil no se detectó desbordamiento horizontal y el menú se abre.

Las pruebas de v1.1 se hicieron sin descargar fuentes externas. Desde v1.2 las fuentes se sirven en local, así que el aspecto del render coincide con el del sitio. Se recomienda una comprobación final en navegador y dispositivo reales antes de publicar.

## Decisiones que se mantuvieron deliberadamente

- La web es código HTML/CSS/JS real; no es una imagen ni una captura embebida.
- Las tarifas y capacidades se centralizan en `data.js`; el motor de precios se separa en `pricing.js`.
- No se extrapolan precios a cantidades sin un rango configurado.
- Calcular o enviar una consulta no reserva una fecha.
- Sin número de WhatsApp configurado, se copia el mensaje; no se abre un teléfono ficticio.
- La fotografía de hero es conceptual y no debe presentarse como una fotografía real de Luisito. Debe sustituirse por material autorizado antes del lanzamiento.

## Pendientes antes de publicar

1. Sustituir las propiedades, fotografías, capacidades, precios y amenidades ficticias por datos aprobados por los propietarios.
2. Confirmar tarifas por ocupación y temporada, anticipo, saldo, extras y cancelaciones.
3. Sustituir la imagen conceptual del hero y añadir un reel real autorizado de Luisito.
4. Configurar y probar el WhatsApp comercial.
5. Incorporar políticas legales y revisar los requisitos turísticos aplicables al modelo comercial.
6. Probar el sitio desplegado en móviles reales y verificar rendimiento, accesibilidad, SEO y formularios.
