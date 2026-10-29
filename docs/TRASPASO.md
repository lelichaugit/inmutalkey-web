# Traspaso — sitio inmutalkey.com

Actualizado: 15-oct-2026. Sustituye al traspaso del 14-oct (23:00).

## 0. Lo que encontró la sesión de Claude Code

- **El repo `inmutalkey-web` estaba vacío** (sin commits). Los archivos que el traspaso anterior daba por escritos (§1 de aquella versión) nunca llegaron a GitHub, y tampoco `docs/PROMPT_ORIGINAL.md`. Se **reconstruyeron** a partir de la descripción del traspaso. Si Alan conserva los originales, se suben a una rama aparte y se comparan; lo reconstruido no es copia de lo anterior.
- Sin `PROMPT_ORIGINAL.md`, este archivo es la especificación vigente. Lo que el prompt fijaba y aquí no aparece (p. ej., el texto exacto del mensaje de WhatsApp) quedó como decisión provisional marcada en `src/site.config.ts`.
- Los logos se tomaron del repo clínico (`src/assets/logo.png` = sólido, `src/assets/cleanlogo.png` = línea). La tarjeta Fundadores (frente/reverso) **no** está disponible: falta para la sección Fundadores.
- Alan compartió en el chat un render 3D del isotipo (blanco, en relieve, sobre negro) y decidió que **es el logo principal del sitio** (ver §3).
- **Imágenes de Drive**: la carpeta compartida tiene `logomainscroll.jpg` (render 3D), `inmutalkeylogowsp.jpg` (avatar), `IKlogoblanco.jpg`, capturas de la app y la tarjeta (`startup (2).pdf`). Desde esta sesión `drive.google.com` está bloqueado por la política de red y el conector de Drive solo entrega base64 en la conversación, así que **la vía es subirlas a `capturas/` por GitHub**. `npm run build:cloudflare` las procesa solo (ver `capturas/LEEME.md`).

## 1. Funciones verificadas contra `clinica-nom004` (rama de trabajo, commit 91b57c8)

Fuente de verdad: el código, no los documentos del Proyecto. Columna "Web" = cómo puede presentarse.

| # | Función | Evidencia en el código | Web |
|---|---|---|---|
| 1 | Ficha de identificación, historia clínica y notas de evolución (NOM-004 §6.1/§6.2) | `pacientes`, `notas_evolucion` (`tipo` HISTORIA_CLINICA/EVOLUCION, CHECK por tipo) | Disponible |
| 1a | CURP con dígito verificador, o motivo de ausencia (5 motivos de catálogo) | `domain/validators.ts` `digitoVerificadorCurp`; CHECK `ck_pacientes_curp_o_motivo` | Disponible |
| 2 | Sello inalterable: `hash_actual = SHA-256(canónico {v, hashPrevio, datos})`, cadena por paciente, firma Ed25519 | `sellado/canonico.rs`, `firma.rs` | Disponible |
| 2a | Triggers + autorizador SQLite niegan UPDATE/DELETE sobre tablas inalterables | `drizzle/0001_inalterabilidad.sql`, `db/autorizador.rs` | Disponible |
| 2b | La llave privada Ed25519 vive en el llavero del sistema operativo, no en la base | `firma.rs` (`keyring`) | Disponible (detalle técnico, FAQ) |
| 3 | Addendum con motivo de catálogo: corrección de captura, aclaración, información adicional, resultado tardío, cambio de diagnóstico. Enlazado al hash de la nota | `addendums`, `MOTIVOS_ADDENDUM` | Disponible |
| 4 | Signos vitales: TA, FC, FR, temperatura, peso, talla, IMC derivado (CHECK ±0.06), SpO₂, glucemia capilar | `notas_evolucion`; rango SpO₂ **30–100** en `validators.ts` | Disponible. En el monitor web, error fuera de 0–100 es demostrativo |
| 5 | Semáforo NOM-004 de 7 requisitos antes de firmar | `utilidades/semaforoNom004.ts` | Disponible |
| 6 | Receta derivada de la nota firmada: "Folio" = número de nota, expediente y sello SHA-256 de la nota; carta o media carta; kits de tratamiento (predefinidos y personalizados) | `receta.ts`, `RecetaMedica.tsx`, `formatoReceta.ts`, `kitsPersonalizados.ts` | Disponible. Decir "folio y sello SHA-256", no "huella firmada de la receta" |
| 7 | Agenda: programada → en atención → atendida (Rust la marca en la transacción de la nota), cancelada, no asistió; pacientes de primera vez sin expediente; mini-calendario | `citas`, `0012_citas_ciclo_atencion.sql`, `MiniCalendario.tsx` | Disponible |
| 7a | Reprogramar: **cambia la fecha de la misma cita** si aún no inicia; no guarda la fecha anterior | `citas.ts` `reprogramarCita` | Corregido: no decir "sin borrar la original" |
| 8 | Diagnósticos CIE-10: catálogo de **~500 diagnósticos frecuentes** con búsqueda (no el catálogo completo) | `constantes/catalogoCie10.ts` | Decir "catálogo CIE-10 de uso frecuente" |
| 8a | CIE-11 | **Sin rastro en el código** | No mencionarlo |
| 9 | Base cifrada con SQLCipher (AES-256); la clave se **deriva de la contraseña maestra con Argon2id** + sal (`clinica.salt`) | `db/clave.rs` | Disponible |
| 9a | ~~Llave de 256 bits envuelta con AES-256-GCM~~ y ~~Clave de Rescate de 24 símbolos~~ | **No existen** en el código | **No anunciar.** Si se olvida la contraseña, hoy no hay recuperación |
| 10 | Sin internet ni telemetría | Sin `fetch`/HTTP en `src/`; Tauri solo con `opener` y `dialog` | Disponible |
| 11 | Borrador de la nota guardado cada 3 s dentro de la base cifrada; se elimina al firmar | `INTERVALO_BORRADOR_MS = 3000`, `borradores_consulta` | Disponible |
| 12 | Bitácora encadenada (secuencia sin huecos + hash) de accesos y cambios; consulta `accesosAlExpediente` | `audit_logs`, `db/consultas.ts` | Disponible como bitácora. **No hay pantalla** "¿quién accedió?": no prometerla |
| 12a | Auditoría de integridad de la cadena desde la app | `ModalIntegridad.tsx`, `db/integridad.ts` | Disponible |
| 13 | Respaldo: copia de `clinica.db` cifrada a Documentos/Respaldos y, opcional, a una unidad elegida con el explorador de Windows; verificación SHA-256 de la copia | `comandos.rs` `respaldar_base_datos` | Disponible. **No copia `clinica.salt` ni la llave Ed25519** (ver §2) |
| 14 | Modo demostración: base aparte (`clinica_demo.db`) con clave efímera en memoria; purgar = borrar el archivo | `db/demo.rs` | Disponible |
| 15 | Hoja de referencia y traslado (NOM-004 §6.4), solo impresión; hoja de indicaciones | `referencia.ts`, `HojaReferencia.tsx`, `HojaIndicaciones.tsx` | Disponible |
| 16 | Licencia offline: evaluación de 30 días + vitalicia Ed25519 ligada a la instalación; reloj protegido con la bitácora. Al vencer: consultar, buscar, imprimir, respaldar y registrar pacientes; se bloquean firmar notas/addendums, crear citas y borradores | `licencia.rs`, `TABLAS_CREACION_CLINICA` | Disponible |

No estaban en el traspaso y sí existen:

- **e.firma del SAT (opcional)**: sello RSA-SHA256 por nota en tabla aparte (`efirma_sellos`), número de serie del certificado en receta y nota impresa. Los `.cer/.key` solo los procesa Rust. Web: "Sella también con tu e.firma del SAT, si quieres". **Sin afirmaciones de validez legal** (el ROADMAP habla de "validez plena"; la web no lo repite).
- **Consentimiento informado** (NOM-004 §10.1) sellado con SHA-256, inalterable.
- **Búsqueda clínica FTS5** por nombre, expediente, diagnóstico y fármaco; **paleta de comandos** Ctrl+K.
- **Laboratorios** (glucosa, HbA1c, creatinina, colesterol, triglicéridos) y **gráficas** de signos vitales y laboratorios.
- Calculadoras clínicas, índice tabáquico, alerta de alergias cruzadas, plantillas y atajos clínicos (`/faringo`).
- Carpetas de pacientes (12 colores), 6 temas visuales, 3 tamaños de texto, bloqueo por inactividad configurable.
- Identidad de género / trato preferente (opcional, no sustituye al sexo asignado al nacer).
- Instalador firmado con certificado **autofirmado** + sello de tiempo DigiCert: SmartScreen **sí** avisará. FAQ 9 y `/verificar` siguen siendo necesarios.

Próximamente (no presentar como disponible): respaldo `.ikbak` verificable y restauración guiada, exportación PDF + verificador, importación desde otros sistemas (no existe), Mac (en evaluación). **PortaVault queda fuera del sitio** por decisión de Alan (15-oct): primero se lanzan licencias solo digitales.

## 2. Riesgos de producto detectados (para Alan, fuera del alcance de la web)

1. **Respaldo incompleto para restaurar en otra PC**: se copia la base, pero no `clinica.salt` (necesaria para derivar la clave) ni la llave privada Ed25519 del llavero. Si el disco muere, la copia en USB podría no abrirse. Prioridad alta antes de vender "respaldos".
2. **Contraseña olvidada = datos irrecuperables**. Es coherente con "sin nube", pero debe decirse en la FAQ y en el onboarding, o implementarse la Clave de Rescate antes de anunciarla.
3. CLAUDE.md del repo clínico está duplicado y con mojibake (`TÃ©cnicas`); conviene limpiarlo.

## 3. Decisiones vigentes

> **Actualización 15-oct (rediseño "clínico-tec")**: a petición de Alan ("enfoque clínico-tec high tech"), los nombres
> técnicos (SHA-256, Ed25519, AES-256, Argon2id) pueden aparecer en el recorrido principal **solo como etiqueta
> secundaria junto a una etiqueta en lenguaje de consultorio** (p. ej. "FIRMA · Ed25519", "Cifrada en tu equipo ·
> AES-256"). Nunca como el único texto ni como el mensaje. Fuera de eso, siguen en "Detalles técnicos", /verificar y la FAQ.
> **Respaldo**: mientras la copia no incluya `clinica.salt` ni la llave Ed25519 (§2.1), el sitio dice que la copia
> comprobada sirve para recuperar la base **en la misma computadora**; "llevarla a otro equipo" es "En camino".

Nuevas (Alan, 15-oct):

- **Logo principal = render 3D del isotipo**, protagonista del hero y **animado con el scroll**. Sustituye la decisión anterior "ECG y trazo del logo con CSS" en el hero.
  - `npm run marca` toma `public/brand/originales/isotipo-3d.*`, lleva el negro del fondo a 0 y genera `brand/isotipo-3d-{480,800,1200}.{avif,webp}` + `src/data/isotipo.json`. En la página se pinta con `mix-blend-mode: screen`: el negro desaparece y la llave flota sobre la cuadrícula y la luz azul, sin recuadro.
  - Animación: el hero lleva `data-progreso-scroll` (base.ts expone `--p` de 0 a 1) y el CSS mueve escala, desplazamiento y una luz azul que recorre la llave. Al salir de vista, el isotipo plano "se acomoda" en la barra (`data-isotipo-principal` + `data-logo="diferido"`, ya implementado). Con movimiento reducido o sin JS: imagen fija, nada se oculta.
  - Propuesta para la Fase B: que la misma llave sea la que "sella" la nota en la historia de integridad, para que el sitio tenga un hilo visual y no dos momentos audaces que compitan.
  - Mientras no exista el archivo, el hero usa el isotipo plano (la OG ya cambia sola al subirlo).
- **Público: médicos, no técnicos.**
  - Nada de jerga en el recorrido principal: SHA-256, Ed25519, SQLCipher, Argon2id, hash, FTS5 solo dentro de un desplegable "Detalles técnicos", en `/verificar` y en la FAQ.
  - Beneficio primero, en el idioma del consultorio: "Cada nota firmada queda sellada: si alguien cambia una coma, se nota" en lugar de "cadena de hashes".
  - Texto base 17–18 px, botones de 52 px, contraste AA o mejor, una sola acción principal (WhatsApp) por pantalla.
  - "Diseñado para la NOM-004" en vez de "conforme a la NOM-004" hasta la revisión legal.

- **Movimiento sin GSAP**: el "scrub" se hace con CSS y las variables `--p`/`--salida` que pone `base.ts`; la historia de integridad cambia de estado con IntersectionObserver (`escenas.ts`). Mismo efecto, 0 KB de librería. Todo el JS del sitio pesa ~12 KB comprimido.
- **Simulador** (`Demo.astro` + `demo.ts`): réplica de la interfaz real (tema "Claro estándar", barra superior compacta, agenda lateral, semáforo de 3 luces, toasts, los 6 temas). 7 capítulos automáticos al entrar en vista; la nota es editable y usa las mismas reglas que la app (`src/lib/semaforo.ts`, `imc.ts`, `cie10.ts`). Sin JS se ve la consulta terminada.
- **Chats simulados** (`ChatSimulado.astro` + `chat.ts`): prueba de 30 días (Pasos) y Fundadores. Rotulados "Conversación de ejemplo"; sin logo de WhatsApp.
- **Navegación premium**: View Transitions entre páginas (CSS), indicador de sección activa, barra que se oculta al bajar y vuelve al subir, menú móvil a pantalla completa, precarga al pasar el cursor, accesos flotantes (WhatsApp en móvil, volver arriba en escritorio).
- **Fundadores = centro comercial del sitio**, una sola licencia digital. El modelo financiero de Alan se leyó solo para entender la economía; **ninguna cifra ni texto suyo está en el repo**. Consecuencias: no prometer soporte o actualizaciones gratis de por vida, ni funciones de red/multiusuario; "un solo pago" aplica a la licencia de fundador.
- **Despliegue**: Worker con Static Assets (el proyecto de Alan se creó en el flujo de Workers, no de Pages). `wrangler.toml` con `[assets]` (`drop-trailing-slash`, `404-page`); build `npm run build:cloudflare`, deploy `npx wrangler deploy`. Verificado con `wrangler dev`: CSP y encabezados de `_headers`, rutas sin `.html`, 404 propia. Ver `README_DEPLOY.md`.
- **Fase C sobre Workers**: el API será un Worker (`main` + `run_worker_first = ["/api/*"]`) en lugar de Pages Functions; D1 se declara en `wrangler.toml` solo cuando exista la base.

Del traspaso anterior:

- **Diseño**: continuidad con la tarjeta (medianoche con luz azul abajo a la derecha; reverso claro azulado). Outfit para titulares; Inter para texto. El resto del sitio, sobrio.
- Secuencia de fondos: Nav · Hero (oscuro + cuadrícula) · Reseñas (oscuro) · Problema (claro) · Integridad (oscuro, pegajosa) · Simulador (navy + cuadrícula) · Signos (oscuro + cuadrícula) · Capturas (oscuro, si existen) · Incluye (claro) · Zero-Cloud (negro) · Pasos (oscuro, numerados) · Fundadores (oscuro con luz) · FAQ (oscuro) · CTA final (luz) · Pie (negro).
- Evitar: etiquetas en MAYÚSCULAS sobre cada título, "→" en botones, monoespaciada, rejilla de tarjetas idénticas con sombra, resaltar una sola palabra del titular. Rejilla de funciones con líneas finas tipo panel de instrumento.
- Esmeralda solo para firmado/íntegro/verificado. Reseñas de ejemplo con la cinta "Ejemplo ilustrativo", nunca "Reseña verificada".
- Icono de WhatsApp: burbuja de chat genérica.
- CSP sin `unsafe-inline`: nada de `<script>` en línea ni `style=`. La clase `.js` la pone `base.ts`; solo se marcan `.revelar` elementos bajo el pliegue. H1 del hero visible desde el primer pintado.
- Historia pineada: `position: sticky` + IntersectionObserver que cambia `data-paso` (1–4); GSAP/ScrollTrigger diferido solo para el scrub. Sin JS o con reduced-motion: 4 estados apilados.
- Monitor de signos: peso, talla y SpO₂ editables; IMC en vivo (OMS); SpO₂ fuera de 0–100 en rojo; "Paciente de ejemplo".
- Turnstile: única excepción de la CSP (`challenges.cloudflare.com`), cargado al enfocar el formulario; claves de prueba fuera de producción.
- www→apex con Redirect Rule de Cloudflare (los Workers tampoco redirigen dominios solos).
- `build.format: 'file'`, `trailingSlash: 'never'`, `inlineStylesheets: 'never'`.
- Reseñas en producción: build desde `resenas.json` (solo `verificado && !esEjemplo`) + `GET /api/resenas` en cliente.
- D1: `0001_solicitudes.sql`, `0002_resenas.sql`, `0003_limite_frecuencia.sql`; sin `BEGIN/COMMIT`, sin `DROP TABLE`.
- Reseñas: código de fundador entregado por WhatsApp; aprobación manual por SQL.
- Legal: verificar la LFPDPPP vigente (DOF, marzo 2025) antes de `/privacidad`; marcar "Borrador: revisar con abogado".

## 4. Pendiente, en orden

- **Fase A** — hecha: reconstrucción, Nav, Pie, Icono, `base.ts`, manifest, robots, sitemap, `generar-marca.mjs`, guardian en `src/lib/guardian.ts`, pruebas Vitest de lo existente. `src/pages/index.astro` es **provisional** (solo prueba el layout). Commit: `feat(web): fase A base, diseño y configuración`.
- **Fase B** — hecha: portada completa, simulador, chats, monitor de signos, reseñas de ejemplo, QR, navegación premium, páginas `/verificar`, `/privacidad` (borrador, LFPDPPP 2025 verificada), `/terminos-fundadores` (borrador), `/resena` (formulario; el envío llega en la Fase C), `404`, `README_DEPLOY.md`.
- **Fase C** — validación zod, Functions, migraciones D1, formulario, pruebas Vitest.
- **Fase D** — check, test, builds, medición de JS, READMEs, Pages + D1 + secretos, revisión visual, commit final.

## 5. TODO_DEFINIR (para Alan)

WhatsApp `522291525847` **confirmado** · textos prellenados (provisionales) · correo de contacto · precio de fundador y precio público · nota de precios (IVA, medios de pago) · lugares totales y ocupados · fecha fin del precio de fundador · actualizaciones incluidas · "después de la prueba" · soporte fuera de Fundadores · nombre de archivo, versión y SHA-256 del instalador · razón social, domicilio y correo del aviso de privacidad · cancelaciones y jurisdicción de los términos · revisión legal · subir a `capturas/` el render 3D, el avatar y las capturas de la app.

## Estado 16-oct (escenas estilo Apple + auditoría)

- Scroll: Lenis en escritorio, nativo en táctil, motor propio de escenas (`docs/ANIMACIONES.md`). Las escenas escriben
  `--p` solo en sus `[data-p]`; una escena que el CSS no fija a cierto ancho no recibe variables.
- Revisión integrada (Chromium, CSP real con `wrangler dev`): iPhone 13 (844 y 664 px de alto), Galaxy S8, iPad Mini,
  1366 y 1440 px, más movimiento reducido y sin JS: 0 desbordes, 0 errores, 0 violaciones de CSP, CLS ≤ 0.0014, todas
  las escenas se fijan y se sueltan. "Cómo funciona" a CPU 4x (Pixel 7): ~18 → 33–38 fps.
- Pendiente de Alan: razón social y domicilio (aviso de privacidad, LFPDPPP) y revisión de abogado de /privacidad y
  /terminos-fundadores (hoy "versión preliminar", sin indexar); precios/cupos (TODO_DEFINIR); que el respaldo del
  programa incluya `clinica.salt` (y la llave) para poder prometer restauración en otro equipo; probar en un iPhone y un
  Mac reales con Safari (aquí solo hubo Chromium).

## Estado 27-oct (Fase C: backend)

- Hecho en la rama `claude/backend-fase-c`: Worker Hono en `src/worker/` (leads con doble opt-in, cupo, eventos
  agregados, testimonios, versiones y descargas por R2, ARCO, retención por cron) y panel `/admin` tras Cloudflare
  Access. Detalle: `docs/BACKEND.md`. Pasos del panel de Cloudflare: `README_DEPLOY.md` §7–§15.
- D1 `inmutalkey-web` creada (id en `wrangler.toml`) con las migraciones 0001–0007 aplicadas en producción.
- Reemplaza el plan anterior de `0001_solicitudes` / `0002_resenas` / `0003_limite_frecuencia` (nunca se escribió): no
  hay IP hasheada en la base; el límite usa el binding nativo. `/resena` sigue apagada; los testimonios los captura
  Alan en el panel con la fecha del consentimiento.
- Páginas nuevas: `/fundadores` (registro), `/fundadores/confirmar`, `/fundadores/gracias`, `/descarga`, `/derechos`.
  La sección Fundadores suma "Prefiero registrarme con mi correo". `/verificar` muestra las huellas de `/api/versiones`.
- Confirmación y descarga piden un clic (POST) a propósito: los filtros de correo corporativo abren los enlaces.
- Pendiente de Alan: R2, Workers Paid + Email Sending (o Resend), Turnstile (`turnstile.siteKey`), Access, secretos,
  editar el DMARC existente (no duplicarlo) y fusionar la rama. Aviso de privacidad: el abogado parte de
  `docs/PRIVACIDAD_DATOS_Y_FINALIDADES.md`; al publicarlo, cambiar `VERSION_AVISO_VIGENTE`.
- Decisión abierta: hoy una prueba gratuita ocupa lugar de fundador (`ESTATUS_QUE_OCUPAN_CUPO`).

## Estado 28-oct (registro con Google y descarga directa)

- Misma rama `claude/backend-fase-c`. El médico descarga solo al confirmar el correo o al entrar con Google (OIDC +
  PKCE en el Worker, sin scripts de Google en la página). `/descarga` es ahora la instalación guiada (requisitos,
  huella SHA-256 con botón de copiar, SmartScreen, instalación, primer inicio, 30 días) y detecta celular o Mac para
  mandar el enlace al correo. Componentes nuevos: `PasosRegistro.astro` (indicador 1-2-3) y `BotonGoogle.astro`.
- Cupo: solo cuentan los clientes (con descarga automática, las pruebas lo agotarían).
- `site.config.ts`: instalador 0.3.2 con su SHA-256 (de ESTADO_PROYECTO); `google.habilitado` en false hasta configurar.
- Migración 0008 (`metodo_registro`) aplicada en producción.
- Pendiente de Alan: cliente OAuth en Google Cloud (README_DEPLOY §16), logotipo oficial «G» en
  `public/brand/terceros/google-g.svg`, subir el instalador 0.3.2 a R2 y registrarlo en el panel.
- Sin verificar en este entorno: inicio real con Google y envío real de correos (sin acceso de red a esos servicios).

## Estado 29-oct (rebrand «Cristal Sellado», v0.4.0)

- Rama `feat/rebrand-web-v040`, creada desde `claude/backend-fase-c` (la Fase C es un avance lineal sobre la rama de
  producción y contiene /descarga y el registro). Backend, Worker, D1 y secretos sin cambios funcionales.
- Marca de la app v0.4.0 (`docs/MARCA_WEB.md`): tokens §8, temas Niebla/Marino/Aurora con selector, Inter 4.1
  autoalojada con `cv05`, activos oficiales en `marca/`. Voz en **usted** en todo el sitio público (incluidos los
  mensajes de validación de `src/compartido/leads.ts`; los mensajes del Worker siguen en tú: ver pendientes).
- Portada nueva según IDENTIDAD_MARCA §9: Hero → Pilares → Cómo funciona → Recetas → Fundadores → Seguridad, en claro
  → Testimonios (solo aprobados) → Preguntas → Contacto. Se retiraron el simulador, las escenas de scroll y Lenis.
- PortaVault fuera del sitio por decisión de Alan (29-oct): aún no existe como producto.
- Versión y huellas centralizadas en `site.config.ts` → `version` (prueba en `tests/marca.test.ts`).
- Lighthouse 12.8 contra `wrangler dev`: portada móvil 99/100/100/100 (LCP 1.9–2.1 s simulado, CLS 0, TBT ≤ 60 ms),
  escritorio 100/100/100/100. SEO 69 solo en páginas `noindex` a propósito.

## 4. Funciones verificadas contra clinica-nom004 v0.4.0 (29-oct)

| Afirmación del sitio | Evidencia |
|---|---|
| Clave de Rescate (24 caracteres) para crear una contraseña nueva | `src/guiaRapida.ts`, `ModalClaveRescate.tsx`, `docs/DISTRIBUCION.md` |
| Respaldo cifrado con frase de paso que incluye sal y llaves Ed25519; se restaura en otra computadora | `src-tauri/src/respaldo.rs` (AES-256-GCM, Argon2id), `restaurar_respaldo` en `comandos.rs`, guía rápida |
| Recetas en media hoja, Carta vertical u horizontal; si no cabe pasa a Carta vertical y avisa | `src/formatoHoja.ts` |
| Semáforo con 7 requisitos (etiquetas del mockup) | `src/utilidades/semaforoNom004.ts` |
| 50 pacientes de demostración en base aparte | `docs/DEMO_CONGRESO.md`, guía rápida |
| Instalador por usuario, sin administrador | `src-tauri/tauri.conf.json` (`installMode: currentUser`) |
| Licencia que se activa sin internet | guía rápida («Periodo de prueba y licencia») |
