# inmutalkey.com

Sitio público de **InmutalKey**, el expediente clínico para consultorio privado con notas selladas.
Astro 5 estático publicado como Worker con Static Assets en Cloudflare; JavaScript mínimo y diferido; CSP estricta sin `unsafe-inline`.
Scroll: Lenis en escritorio, nativo en táctil, y un motor propio de escenas fijadas (`docs/ANIMACIONES.md`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local (entorno `desarrollo`, con reseñas de ejemplo) |
| `npm run build` | Compila a `dist/` y pasa el guardian |
| `npm run build:cloudflare` | `activos` + `build` (el que usa Cloudflare) |
| `npx wrangler dev` | Sirve `dist/` con el mismo motor de Cloudflare, encabezados incluidos |
| `npm run check` | Tipos estrictos de Astro y TypeScript |
| `npm run revisar` | Revisión multi-dispositivo con Playwright (desbordes, errores, CSP, CLS, escenas) contra `npx wrangler dev` o una URL |
| `npm test` | Pruebas Vitest |
| `npm run activos` | `marca` + `capturas` |
| `npm run marca` | Favicons, iconos de app, OG y versiones del render 3D desde `capturas/` |
| `npm run capturas` | Capturas de `capturas/` → `public/capturas/` + `src/data/capturas.json` |
| `npm run redes` | Logos de redes (simple-icons → SVGO) → `src/assets/redes/*.svg` |
| `npm run qr` | QR propio del perfil de Instagram → `public/img/qr-instagram.svg` |
| `npm run vectorizar` | Vectoriza el logo plano (requiere `pip install potracer pillow numpy`) |
| `npm run vectorizar:llave` | Vectoriza el contorno de la llave 3D ("plano técnico") desde `capturas/logomain-contorno.png` |

## Entornos

`SITE_ENV` = `produccion` · `preview` · `desarrollo`. Si no se sabe, el sitio asume **producción** (el modo más
estricto). En producción el guardian detiene el build si falta el WhatsApp, si hay reseñas de ejemplo, recursos de
terceros, `<script>` en línea o atributos `style=`.

## Estructura

- `src/site.config.ts`: el único lugar con datos variables (`TODO_DEFINIR`).
- `src/data/socials.ts`: redes sociales (única fuente de verdad) y el interruptor `WHATSAPP_ENABLED`.
- `src/components/secciones/`: secciones de la portada. `Demo.astro` + `src/scripts/demo.ts` es el simulador.
- `src/lib/`: reglas compartidas y probadas (semáforo NOM-004, IMC, CIE-10, reseñas, entorno, guardian).
- `src/scripts/`: `base.ts` (todas las páginas) y módulos que se cargan solo al acercarse a su sección.
- `docs/TRASPASO.md`: estado, decisiones y funciones verificadas contra el código de la app.
- `GEMINI.md` / `AGENTS.md`: contexto para asistentes de código; `docs/MIGRACION_GEMINI.md`: cómo seguir con Gemini.

Despliegue: ver [README_DEPLOY.md](README_DEPLOY.md).

## Redes sociales y contacto

- **Cambiar o agregar una red:** editar `REDES` en `src/data/socials.ts` (URL limpia, sin parámetros). Lo leen
  `SocialLinks` (pie y `/contacto`), `Contacto`, el `<head>` (`<link rel="me">` y JSON-LD) y `npm run qr`. Si la red
  es nueva, agregar su SVG a `scripts/optimizar-redes.mjs` y correr `npm run redes`.
- **WhatsApp:** el número vive solo en `sitio.contacto.whatsapp` (`src/site.config.ts`, dígitos con lada 52). El
  interruptor `WHATSAPP_ENABLED` (`src/data/socials.ts`) apaga **todos** los botones de WhatsApp del sitio (barra, botón
  flotante, hero, FAQ, /contacto, pie…): con `false` no se imprime ningún enlace ni el número y el build de producción
  no exige número. Con `true`, el guardian exige un número válido en producción.
- **QR de Instagram:** `/contacto` usa el nametag oficial si existe `public/img/qr-instagram.png` (o `public/`); si no,
  el QR propio `public/img/qr-instagram.svg` (corrección H, zona silenciosa de 4 módulos, generado en local). Las
  pruebas lo decodifican con jsQR y exigen la URL exacta del perfil.
- **Privacidad:** solo enlaces estáticos (`rel="me noopener noreferrer"`); cero widgets, iframes, SDK o píxeles. El
  guardian del build rechaza enlaces externos sin `noopener noreferrer` o con parámetros de rastreo.
