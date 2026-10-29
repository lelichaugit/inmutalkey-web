# Capturas originales

Sube aquí (GitHub → Add file → Upload files) capturas de la app **solo con la bóveda demo** de expedientes ficticios
(Configuración → Pacientes de demostración, o Ctrl+Shift+D). Nunca pantallas con pacientes reales.

- `.png`, `.jpg`, `.webp`: `npm run capturas` las convierte a AVIF/WebP en `public/capturas/` y escribe
  `src/data/capturas.json`. Título, descripción y orden opcionales en `textos.json` (clave = nombre exacto del archivo).
- Hoy la portada usa la maqueta HTML de la app (`src/components/MockupApp.astro`); las capturas quedan listas para
  sustituirla o acompañarla.
- Los logos ya no viven aquí: los activos oficiales están en `marca/` (`npm run marca`).
