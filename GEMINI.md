# inmutalkey.com — contexto para asistentes (Gemini CLI lo carga solo)

Sitio público de **InmutalKey**: expediente clínico de escritorio (Windows) para consultorios privados en México. Cada
nota firmada queda sellada (huella SHA-256 encadenada + firma Ed25519) y no se puede modificar; funciona sin internet.
Dueño: Alan. Público: **médicos, no técnicos**. Alan presenta el sitio con un QR desde su celular o lo manda por
WhatsApp: **el celular es el dispositivo principal**. Idioma del sitio y del código: español de México. Voz de la marca: **usted**, serena, frases cortas.

Guía de migración y mensaje inicial para el chat: `docs/MIGRACION_GEMINI.md`. Estado y decisiones: `docs/TRASPASO.md`.
Marca del sitio: `docs/MARCA_WEB.md`. Despliegue: `README_DEPLOY.md`.

## Stack y comandos

Astro 5 estático (TypeScript estricto, sin `any`), CSS propio, Vitest. Se publica como **Worker con Static Assets** en
Cloudflare (`wrangler.toml`): cada push a la rama de producción compila con `npm run build:cloudflare` y despliega.
El Worker (`src/worker/`, Hono) atiende solo `/api/*` y `/admin` con D1, R2, Turnstile y Access: ver `docs/BACKEND.md`.
Node 22 (`.nvmrc`).

| Comando | Para qué |
|---|---|
| `npm ci` | Instalar (versiones exactas del lock) |
| `npm run dev` | Desarrollo local (entorno `desarrollo`, con reseñas de ejemplo) |
| `npm run check` · `npx tsc --noEmit -p .` | Tipos (deben dar 0 errores) |
| `npm test` | Vitest (todas en verde) |
| `npm run build:cloudflare` | Activos de marca + build de producción + **guardian** (detiene el build ante problemas) |
| `npx wrangler dev` | Sirve `dist/` como en Cloudflare, con la CSP real (puerto 8787) |
| `npm run revisar` | Revisión multi-dispositivo con Playwright contra `http://127.0.0.1:8787/` (o una URL) |
| `npm run marca` · `og` · `capturas` · `qr` · `redes` | Generadores de activos (ver `scripts/`) |

## Mapa

- `src/pages/` — portada (`index.astro`), `/fundadores` (+ `confirmar`, `gracias`), `/descarga`, `/verificar`,
  `/contacto`, `/privacidad`, `/terminos-fundadores`, `/derechos`, `/resena`, `/admin`, 404, `sitemap.xml.ts`.
- `src/components/secciones/` — portada según IDENTIDAD_MARCA §9: Hero, Pilares, ComoFunciona, Recetas, Fundadores,
  Seguridad, TestimoniosVivos (solo si hay aprobados), Faq, Cierre (contacto).
- `src/components/` — Nav (cristal fijo + SelectorTema), Pie (lámina Abismo, logo mono blanco), Logo (variantes
  oficiales), MockupApp (maqueta HTML de la app con expedientes ficticios), PasosRegistro, BotonGoogle, Contacto,
  SocialLinks, Icono/IconoMarca.
- `src/scripts/` — `base.ts` (todas las páginas: barra, menú, revelado), `tema.ts` (selector de tema) y módulos
  diferidos (`formularios.ts`, `eventos.ts`, `turnstile.ts`, `admin.ts`).
- `src/styles/` — `tokens.css` (IDENTIDAD_MARCA §8 tal cual + temas Niebla/Marino/Aurora), `global.css` (aurora,
  cristal, botones, campos, avisos), `formularios.css`, `instalacion.css`. Guía visual del sitio: `docs/MARCA_WEB.md`.
- `src/site.config.ts` — **único** lugar con datos variables, incluida la **versión vigente y sus huellas**
  (`version.paquetes`). `TODO_DEFINIR` = sin definir: nunca se muestra en el sitio.
- `src/data/` — FAQ, redes (`socials.ts`, con el interruptor `WHATSAPP_ENABLED`), dimensiones del logo (`marca.json`).
- `src/lib/` — reglas probadas (guardian, whatsapp, semáforo NOM-004, IMC, reseñas, entorno, QR).
- `src/worker/` — backend (rutas públicas, panel, retención); `src/compartido/` — validación y eventos que usan el
  sitio y el Worker; `migrations/` — D1 (solo aditivas, nunca `DROP TABLE`); `tests/worker/` — pruebas con Miniflare.
- `marca/` — activos oficiales copiados de clinica-nom004 v0.4.0 → `npm run marca` (logos, favicon, iconos) y
  `npm run og` (imagen Open Graph, se versiona).

## Reglas duras

1. **CSP estricta** (`public/_headers`): nada de atributos `style=`, `<style>` o `<script>` en línea (salvo JSON-LD) ni
   recursos de terceros. Variables por elemento solo con `el.style.setProperty` desde un módulo TS. El guardian del
   build lo verifica y lo detiene.
2. **Mejora progresiva**: sin JS o con "reducir movimiento" todo se lee completo y quieto. `html.js` = hay JS;
   `html.movimiento` = hay JS y no se pidió reducir movimiento (lo pone `public/clases.js` antes del primer pintado).
   Nunca ocultes el H1 ni los botones del primer pantallazo.
3. **Marca «Cristal Sellado»** (`docs/MARCA_WEB.md`): solo colores de `tokens.css`; vidrio real (`backdrop-filter`)
   solo en la barra y 1–2 paneles por vista; tarjetas repetidas con vidrio simulado; sombras tintadas en Abismo;
   radios 9/13/18/24; foco doble (`--anillo-foco`). El logo es siempre una variante oficial (`npm run marca`).
4. **Solo `transform`, `opacity`, `clip-path`** para animar (filtros, sombras grandes y `mix-blend-mode` sobre capas que
   cambian en cada cuadro arruinan el rendimiento; hay prueba que lo vigila).
5. **`@property` es global**: el nombre debe ser único en todo `src/` (hay prueba). `:global()` para contenido creado por
   JS y para el SVG de `Icono` dentro de estilos con alcance. No uses `:global()` dentro de `:not()` (Astro lo rompe).
6. **Celular primero**: texto de cuerpo ≥ 16 px, toques ≥ 44 px, sin desplazamiento horizontal a 360 px; de 360 a
   3840 px y con zoom de 70 % a 200 % (por encima de 1920 px todo escala en rem). Secundario ≥ 7:1 (`--texto-2`).
7. **Veracidad**: solo afirmaciones verificadas contra el código de la app (v0.4.0: `docs/TRASPASO.md` §4).
   Prohibido: PortaVault (aún no existe como producto), cifras financieras, CIE-11, validez legal, Mac disponible,
   pantalla "¿quién accedió?", «100 % seguro». Desde v0.3.0/v0.4.0 sí existen la Clave de Rescate y el respaldo
   cifrado que se restaura en otra computadora. Jerga técnica (SHA-256, Ed25519, AES-256, Argon2id) solo como etiqueta secundaria junto a una en
   lenguaje de consultorio ("FIRMA · Ed25519").
8. **No toques** la lógica de envío de `/resena` (deshabilitado hasta la Fase C) ni el contenido legal sin indicación
   de Alan.
9. Sin dependencias nuevas sin una razón fuerte (nada de GSAP, three.js, frameworks de UI). Versiones exactas.

## Flujo de trabajo (una tarea a la vez)

1. Lee los archivos que vas a tocar y la parte de los docs que aplica. Si la tarea es grande, propón un plan corto.
2. Cambia lo mínimo necesario, con comentarios en español al estilo del código vecino.
3. Verifica **antes** de entregar: `npm run check`, `npx tsc --noEmit -p .`, `npm test`, `npm run build:cloudflare`
   (guardian "sin hallazgos"), y para cambios visuales `npx wrangler dev` + `npm run revisar` (y mirar capturas con
   `npm run revisar -- --capturas`). Todo en verde o no se entrega.
4. Commit atómico en español: `tipo(web): descripción` (`feat`, `fix`, `perf`, `docs`, `chore`) con cuerpo que explique
   el porqué. Push a la rama de trabajo; Cloudflare despliega la rama de producción.
5. Anota en `docs/TRASPASO.md` cualquier decisión o pendiente nuevo.
