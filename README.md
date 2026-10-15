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
| `npm test` | Pruebas Vitest |
| `npm run activos` | `marca` + `capturas` |
| `npm run marca` | Favicons, iconos de app, OG y versiones del render 3D desde `capturas/` |
| `npm run capturas` | Capturas de `capturas/` → `public/capturas/` + `src/data/capturas.json` |
| `npm run vectorizar` | Vectoriza el logo plano (requiere `pip install potracer pillow numpy`) |
| `npm run vectorizar:llave` | Vectoriza el contorno de la llave 3D ("plano técnico") desde `capturas/logomain-contorno.png` |

## Entornos

`SITE_ENV` = `produccion` · `preview` · `desarrollo`. Si no se sabe, el sitio asume **producción** (el modo más
estricto). En producción el guardian detiene el build si falta el WhatsApp, si hay reseñas de ejemplo, recursos de
terceros, `<script>` en línea o atributos `style=`.

## Estructura

- `src/site.config.ts`: el único lugar con datos variables (`TODO_DEFINIR`).
- `src/components/secciones/`: secciones de la portada. `Demo.astro` + `src/scripts/demo.ts` es el simulador.
- `src/lib/`: reglas compartidas y probadas (semáforo NOM-004, IMC, CIE-10, reseñas, entorno, guardian).
- `src/scripts/`: `base.ts` (todas las páginas) y módulos que se cargan solo al acercarse a su sección.
- `docs/TRASPASO.md`: estado, decisiones y funciones verificadas contra el código de la app.

Despliegue: ver [README_DEPLOY.md](README_DEPLOY.md).
