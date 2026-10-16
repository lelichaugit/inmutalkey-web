# inmutalkey.com — contexto para asistentes (Gemini CLI lo carga solo)

Sitio público de **InmutalKey**: expediente clínico de escritorio (Windows) para consultorios privados en México. Cada
nota firmada queda sellada (huella SHA-256 encadenada + firma Ed25519) y no se puede modificar; funciona sin internet.
Dueño: Alan. Público: **médicos, no técnicos**. Alan presenta el sitio con un QR desde su celular o lo manda por
WhatsApp: **el celular es el dispositivo principal**. Idioma del sitio y del código: español de México (tuteo).

Guía de migración y mensaje inicial para el chat: `docs/MIGRACION_GEMINI.md`. Estado y decisiones: `docs/TRASPASO.md`.
API de animaciones y scroll: `docs/ANIMACIONES.md`. Despliegue: `README_DEPLOY.md`.

## Stack y comandos

Astro 5 estático (TypeScript estricto, sin `any`), CSS propio, Vitest. Se publica como **Worker con Static Assets** en
Cloudflare (`wrangler.toml`): cada push a la rama de producción compila con `npm run build:cloudflare` y despliega.
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
| `npm run marca` · `vectorizar:llave` · `capturas` · `qr` · `redes` | Generadores de activos (ver `scripts/`) |

## Mapa

- `src/pages/` — portada (`index.astro`), `/contacto`, `/verificar`, `/privacidad`, `/terminos-fundadores`, `/resena`, 404,
  `sitemap.xml.ts`.
- `src/components/secciones/` — una sección por archivo: Hero, Problema, Integridad (+ EscenaIntegridad), Demo
  (simulador interactivo, + `scripts/demo.ts`), Signos, Capturas, Incluye ("Un día en tu consultorio"), ZeroCloud (la
  bóveda), Pasos, Fundadores, Faq, CtaFinal, Resenas.
- `src/components/` — Nav, Riel (puntos laterales ≥1360 px), Pie, Isotipo3D (la llave 3D con alfa real; props `plano`,
  `brillo`, `reflejo`), Contacto, SocialLinks, ChatSimulado, Icono/IconoMarca, Logo, Compartir.
- `src/scripts/` — `base.ts` (todas las páginas), `scroll.ts` (motor de escenas), `suave.ts` (Lenis, solo escritorio) y
  módulos diferidos por sección.
- `src/styles/global.css` — tokens, utilidades y la sección *Movimiento*.
- `src/site.config.ts` — **único** lugar con datos variables (`TODO_DEFINIR` = sin definir: nunca se muestra en el sitio).
- `src/data/` — FAQ, funciones, redes (`socials.ts`, con el interruptor `WHATSAPP_ENABLED`), marca, reseñas.
- `src/lib/` — reglas probadas (guardian, whatsapp, semáforo NOM-004, IMC, reseñas, entorno, QR).
- `capturas/` — fuentes de imágenes (logo 3D, capturas de la app) → `npm run activos` las procesa.

## Reglas duras

1. **CSP estricta** (`public/_headers`): nada de atributos `style=`, `<style>` o `<script>` en línea (salvo JSON-LD) ni
   recursos de terceros. Variables por elemento solo con `el.style.setProperty` desde un módulo TS. El guardian del
   build lo verifica y lo detiene.
2. **Mejora progresiva**: sin JS o con "reducir movimiento" todo se lee completo y quieto. `html.js` = hay JS;
   `html.movimiento` = hay JS y no se pidió reducir movimiento (lo pone `public/clases.js` antes del primer pintado).
   Nunca ocultes el H1 ni los botones del primer pantallazo.
3. **Escenas**: `var(--p, 1)` siempre (el valor por omisión es el estado final). Marca con `data-p` cada elemento que se
   mueve con el scroll y declara sus tramos en él (escribir `--p` en una raíz grande recalcula todo su subárbol: era
   13 fps en Android de gama media). Sin `overflow: hidden` en ancestros de un `sticky`; zonas con scroll propio llevan
   `data-lenis-prevent`. Detalle en `docs/ANIMACIONES.md`.
4. **Solo `transform`, `opacity`, `clip-path`** para animar (filtros, sombras grandes y `mix-blend-mode` sobre capas que
   cambian en cada cuadro arruinan el rendimiento; hay prueba que lo vigila).
5. **`@property` es global**: el nombre debe ser único en todo `src/` (hay prueba). `:global()` para contenido creado por
   JS y para el SVG de `Icono` dentro de estilos con alcance. No uses `:global()` dentro de `:not()` (Astro lo rompe).
6. **Celular primero**: texto de cuerpo ≥ 16 px, toques ≥ 44 px, nada encimado dentro de `100svh` (barra de 72 px
   arriba), sin desplazamiento horizontal a 360 px.
7. **Veracidad**: solo afirmaciones respaldadas por `docs/TRASPASO.md` §1 (verificadas contra el código de la app).
   Prohibido: PortaVault, cifras financieras, CIE-11, recuperación de contraseña, "Clave de Rescate", validez legal,
   Mac disponible, pantalla "¿quién accedió?". El respaldo hoy sirve para recuperar la base **en la misma
   computadora**. Jerga técnica (SHA-256, Ed25519, AES-256, Argon2id) solo como etiqueta secundaria junto a una en
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
