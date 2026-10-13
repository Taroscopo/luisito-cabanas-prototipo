# Luisito el Viajero — Prototipo visual v1.2

Prototipo web estático en HTML, CSS y JavaScript, ajustado a la captura de referencia aprobada: hero panorámico de atardecer, navegación transparente, titular editorial, llamada a conocer a Luisito y catálogo de tres tarjetas con fotografía, categoría, precio y amenidades sobre una franja inferior clara.

La interfaz no se basa en una captura ni en un constructor visual: es código real. El proyecto no necesita React, un proceso de compilación, backend ni paquetes externos, y **no hace ninguna petición a servicios de terceros** (las fuentes están alojadas en `assets/fonts/`).

## Abrirlo en Ubuntu

1. Descarga y descomprime el ZIP.
2. Abre una terminal dentro de la carpeta del proyecto.
3. Ejecuta `./start-local.sh` (o `./start-local.sh 3000` para otro puerto).
4. Abre `http://localhost:8080` en el navegador. Pulsa `Ctrl+C` para detener el servidor.

`start-local.sh` usa `serve.py`, un servidor estático sin caché: los cambios se ven al recargar. Funciona también con `python3 -m http.server`, pero el navegador puede mostrar archivos antiguos.

## Archivos principales

- `index.html`: estructura de la página, metadatos SEO y de redes sociales.
- `styles.css`: dirección visual, fuentes locales (`@font-face`), estilos de escritorio y móvil, animaciones y movimiento reducido.
- `data.js`: configuración centralizada de marca, propiedades, imágenes, tarifas, reglas de precio, capacidades y especificaciones de las tarjetas.
- `app.js`: catálogo con filtro por ubicación, favoritas de sesión, ficha modal con reel, galería, datos clave y amenidades, calculadora, formulario y envío de la solicitud, cabecera fija y menú móvil. Las plantillas usan `html\`…\``, que escapa automáticamente cualquier dato interpolado.
- `pricing.js`: lógica de cotización aislada y comprobable.
- `assistant.js`: motor de reglas del chat (entiende la pregunta, recomienda, cotiza y deriva al asesor), probado con `tests/test-assistant.js`.
- `serve.py`, `start-local.sh`: servidor local de desarrollo.
- `favicon.svg`, `robots.txt`: icono y reglas de rastreo (en modo demo bloquean la indexación).
- `assets/`: fotografías conceptuales optimizadas; `assets/fonts/` con DM Sans (licencia OFL, ver `LICENCIAS.txt`).
- `tests/`: pruebas de precios, auditoría estática y smoke test de navegador.
- `AUDITORIA.md`: resultados de los controles realizados.
- `LANZAMIENTO.md`: lista de pasos para pasar de demo a sitio real.

## Datos de demostración

Todos los nombres, precios, capacidades, amenidades, ubicaciones, rangos y anticipos son ficticios. Las fotografías también son conceptuales y no representan alojamientos verificados ni una fotografía real de Luisito. Antes de publicar, sustituye estos datos por información aprobada por cada propietario y añade material audiovisual autorizado.

Edita `window.DEMO_CONFIG` en `data.js` para actualizar el catálogo. Por propiedad, además de las tarifas:

| Campo | Efecto |
|---|---|
| `city` | Municipio: alimenta el filtro de ubicación y es lo único que muestra la ficha (nunca la dirección exacta) |
| `location` | Texto corto de la tarjeta |
| `cardSpecs` | Tres datos de la franja inferior de la tarjeta `[{ icon, text }]` |
| `facts` | Tarjetas de datos clave de la ficha `[{ icon, value, label }]` (habitaciones, capacidad por tipo de plan…) |
| `amenities` | Lista de amenidades; el icono se asigna por palabra clave (`AMENITY_ICONS` en `app.js`; lo no reconocido usa una marca de verificación) |

Los iconos están en el sprite de `index.html` (`<symbol id="i-…">`); para añadir uno, agrega el símbolo y usa su nombre en `icon`/`facts`.

### Cotizador («Cotiza tu plan»)

Todas las propiedades piden **Llegada**, **Salida** y número de personas. Según lo que ofrezca la propiedad:

| Propiedad | Salida |
|---|---|
| Solo alojamiento | Obligatoria y posterior a la llegada (por defecto, el día siguiente) |
| Alojamiento y pasadía | Posterior = noches; vacía o el mismo día = pasadía (se quita con la «×» de la celda) |
| Solo pasadía o evento | Igual a la llegada (un solo día); otro día deriva a cotización a medida |

Al elegir la llegada, la salida se ajusta sola: conserva la duración de la estancia, o el mismo día si el plan era de un día. Al tocar una salida vacía se preselecciona el día siguiente. En móvil, una barra inferior muestra el total y el botón.

Al pulsar «Consultar disponibilidad» se abre el chat de contacto con el plan como tarjeta; la ficha queda detrás y cerrar el chat conserva lo calculado.

### Reglas de precio (alojamiento)

La calculadora no extrapola importes fuera de lo configurado: si falta una regla, deriva a cotización manual. Por propiedad se pueden definir:

| Campo | Efecto |
|---|---|
| `rates` | `[{ min, max, nightly }]` tarifa base por noche según número de huéspedes |
| `weekendSurchargePercent` | recargo para las noches de viernes y sábado |
| `peakNights` + `peakSurchargePercent` | fechas ISO de noches festivas y su recargo |
| `seasons` | `[{ name, from: 'MM-DD', to: 'MM-DD', multiplier }]`; admite rangos que cruzan el año (diciembre–enero) |
| `minimumNights` / `maxNights` | límites; por encima de `maxNights` (30 por defecto) se cotiza manualmente |
| `depositPercent` | porcentaje de anticipo |

Si una noche es de fin de semana y festiva, se aplica el **mayor** recargo (no se acumulan); el multiplicador de temporada se aplica encima. El resultado muestra un desglose por tipo de noche. Los pasadías se calculan por persona y los eventos se envían siempre a cotización manual.

### Reels y fotos de cada cabaña

Cada reel va en `assets/reels/<nombre>.mp4` (vertical 9:16, H.264/AAC) y se enlaza con `videoUrl` en `data.js`. Recomendado remuxarlo para que arranque rápido sin recomprimir:

```bash
ffmpeg -i original.mp4 -c copy -movflags +faststart assets/reels/nombre.mp4
```

Las fotos de portada y galería son fotogramas del reel, recortados a la franja central para esquivar los subtítulos (`assets/img/`). Se sacan así: `ffmpeg -ss 17 -i original.mp4 -frames:v 1 -vf "crop=720:600:0:340" -c:v libwebp -quality 82 assets/img/nombre-1.webp`. Si una cabaña no tiene `videoUrl`, la ficha muestra su primera foto con la etiqueta «Reel · demo».

Los 19 reels pesan unos 320 MB en total (12–33 MB cada uno): para producción conviene alojarlos en un CDN o servicio de video, no en el mismo servidor del sitio.

### Contacto y solicitudes

En `brand` de `data.js`:

- `whatsappNumber`: con indicativo de país, sin `+` ni espacios (ej. `573001234567`). Si está vacío, la solicitud se copia al portapapeles.
- `leadsEndpoint`: URL `https://` que recibe cada solicitud por `POST` en JSON (`name`, `phone`, `property`, `mode`, `date`, `departure`, `people`, `eventType`, `note`, `consent`, `message`, `estimateTotal`, `source`, `createdAt`). Debe aceptar CORS desde tu dominio. Incluye un campo trampa (honeypot) contra bots. Si el envío falla, la persona sigue pudiendo usar WhatsApp o copiar el mensaje.
- `leadEmail`: si se define, tras preparar la solicitud aparece «Enviar por correo».
- `siteUrl`: dominio final; con `demoMode: false` activa los datos estructurados (JSON-LD).

Con los tres vacíos el prototipo no envía datos a ningún sitio. No hay pagos, disponibilidad automática ni reservas confirmadas.

### Catálogo paginado y reel de la ficha

- **Paginación:** el catálogo muestra 9 cabañas por página (`brand.pageSize` en `data.js`) con «Anterior · 1 2 3 · Siguiente» (en móvil, «Página 2 de 3»). Al cambiar de página se vuelve al inicio del catálogo; al filtrar por ubicación o abrir favoritos se empieza en la página 1. Las fichas, el chat y las favoritas funcionan con las 19 aunque no estén en la página visible.
- **Reel con sonido:** al abrir una ficha el reel arranca con audio dentro del mismo toque, que es lo que permiten los navegadores. Si el navegador lo bloquea, arranca en silencio y aparece el botón «Activar sonido». Hay controles propios (pausa y sonido) y barra de progreso; no se usan los controles nativos. Tocar el video también lo pausa. El reel se pausa al abrir el chat, al cerrar la ficha y al cambiar de pestaña.
- **Cierre de la ficha:** un solo botón X, dentro de la tarjeta del video y arriba a la derecha (también sobre las fotos), sin barra superior. Pausa y sonido quedan abajo, así que nada se tapa. El reel es ~20 % más alto que antes (hasta 70 % de la altura de pantalla).
- **Tableta (768–959 px):** una columna con el reel centrado; las dos columnas solo desde 960 px. Con el teclado abierto el chat usa la altura visible real (`visualViewport`).

### Tipografía

Sistema de dos voces, alojado en `assets/fonts/` (sin peticiones a Google Fonts): **Cormorant Garamond** (serif editorial) y **DM Sans** (sans de interfaz). Las variables son `--serif` y `--sans` en `styles.css`; la auditoría estática falla si aparece otra familia.

| Voz | Dónde |
|---|---|
| Cormorant Garamond 500 / 600 | H1 del hero («Escápate a lo *extraordinario.*», con la última palabra en cursiva), H2 de sección, nombre de la cabaña en la tarjeta, título de la ficha, subtítulos de la ficha, «Cotiza tu plan», precio de la ficha y total estimado (cifras alineadas, `lining-nums`) |
| DM Sans 400–700 | Todo lo demás: texto, navegación, botones, filtros, precio de las tarjetas, campos, FAQ, pie, **y el chat completo** (imita WhatsApp) |

Se tomó de `sistema-tipografico-luisito-v1-1.md` la pareja de familias, los pesos, la jerarquía y las reglas de uso, pero **no sus tamaños de 8–10 px**: en este prototipo el texto mínimo es 12 px y el cuerpo 16 px (accesibilidad, lectura en móvil). Como el serif tiene menos altura de x, sus tamaños son mayores que los de la sans (hero 48–84 px, H2 38–54 px, nombre de tarjeta 20–27 px según el ancho). El interletraje es más suave que el −0,045 em del documento (−0,02 em en el hero, −0,015 em en H2, casi 0 en nombres) porque a estos tamaños las letras llegaban a tocarse. El hero lleva el titular serif y un subtexto sans, centrados en la parte alta y con el botón abajo; desde 1100 px la foto horizontal se amplía y se ancla para que Luisito quede a la derecha, sin chocar con el texto (por debajo se usa la foto vertical). En móvil el subtexto muestra solo la primera frase. Allura no se carga: la marca es la imagen del logotipo. El nombre de la tarjeta admite dos líneas para no cortarse con «…».

## Pruebas

Dentro de la carpeta del proyecto:

```bash
./tests/run-all.sh
```

Ejecuta, en orden: sintaxis de los tres `.js`, pruebas de precios (`node tests/test-pricing.js`), auditoría estática (`python3 tests/audit-static.py`, solo biblioteca estándar) y el smoke test de navegador en Chromium/Chrome sin interfaz (`tests/run-smoke.mjs`, por DevTools, necesita Node 22 o superior; con una versión anterior usa `--dump-dom`). Si no hay navegador instalado, ese paso se omite con un aviso.

El smoke test (`tests/browser-smoke.html`) también se puede abrir a mano en `http://localhost:8080/tests/browser-smoke.html`: maneja la web real y comprueba filtros, escape de HTML, ficha, calculadora, validaciones, foco en modales, WhatsApp, correo, endpoint, honeypot, menú móvil, desbordamiento a 390 px y ausencia de peticiones externas.

Consulta `AUDITORIA.md` para el alcance y los resultados.

### Favoritos y botón de WhatsApp

Los favoritos se guardan en el navegador de cada persona (`localStorage`, clave `luisito:favoritos`); no se envía nada a ningún servidor. El botón flotante de WhatsApp aparece al bajar del inicio y adapta su texto y su mensaje: con favoritas las nombra, con una ubicación filtrada la menciona y, si no, hace una consulta general. Con `whatsappNumber` configurado abre `wa.me`; sin él, abre el formulario de contacto con el mensaje ya escrito.

### Chat con asistente y traspaso a WhatsApp

El contacto (botón flotante, cabecera, pie y «Consultar disponibilidad») es un chat con aspecto de WhatsApp atendido por un **asistente de reglas** (`assistant.js`, sin IA generativa ni servicios externos). Entiende lo que escribe la persona y responde con datos de `data.js` y con el motor de precios:

- Recomienda cabañas por personas, ubicación y tipo de plan (alojamiento, pasadía o evento) y calcula un valor estimado con las fechas.
- Responde ubicación (solo el municipio), capacidad, habitaciones, amenidades («¿tiene piscina…?», «¿qué cabañas tienen billar?»), anticipo y cómo se reserva.
- **No confirma disponibilidad** (no hay calendario): lo dice y deriva al asesor. Tampoco inventa precios: los eventos y las estancias fuera de tarifa se cotizan a medida.
- Lo que no sabe (horarios, mascotas, medios de pago, cancelación…) lo deriva con un botón «Continuar en WhatsApp» que conserva la pregunta de la persona.

Para continuar con un asesor se piden nombre, celular y autorización; después aparece el **mensaje personalizado** tal como llegará («Hola, soy Ana. Quisiera hacer una reserva.», o «Tengo esta consulta: «…»» si hubo una pregunta sin resolver, más cabaña, fechas, personas, ubicación y valor estimado) y el botón «Continuar en WhatsApp», que abre `wa.me` si `whatsappNumber` está configurado y, si no, copia el mensaje. La solicitud también se envía a `leadsEndpoint` cuando existe.

**Persistencia:** la conversación se conserva al cerrar la ventana, al ir a una ficha y volver, y al recargar la página. Se guarda 24 horas solo en el navegador de la persona (`localStorage`, clave `luisito:chat`; incluye lo que escribió, también nombre y celular) y se borra con el botón de la cabecera (dos toques) o al caducar. Si la persona vuelve de una ficha con «Consultar disponibilidad», el plan se suma a la misma conversación sin pedirle otra vez los datos.

Para ampliar el asistente, añade reglas en `respond()` de `assistant.js` y casos en `tests/test-assistant.js` (`node tests/test-assistant.js`). Detalles: `brand.chatTypingMs` (por defecto 750) ajusta la espera de «escribiendo…»; el avatar es `assets/avatar.webp`.
