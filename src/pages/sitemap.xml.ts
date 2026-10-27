import type { APIRoute } from 'astro';

import { sitio } from '../site.config';

// Se arma con las páginas que existen de verdad; 404 y /resena (formulario por código) no se indexan, ni las páginas
// legales mientras sean versión preliminar (sin revisión de abogado).
// /admin (panel privado) y los pasos de confirmación y descarga (solo sirven con un enlace personal) tampoco.
const EXCLUIDAS = new Set([
  '/404',
  '/resena',
  '/admin',
  '/descarga',
  '/fundadores/confirmar',
  '/fundadores/gracias',
  ...(sitio.legal.revisadoPorAbogado ? [] : ['/privacidad', '/terminos-fundadores', '/derechos']),
]);

const rutas = Object.keys(import.meta.glob('./**/*.astro'))
  .filter((r) => !r.includes('['))
  .map((r) => r.replace(/^\.\//, '/').replace(/\.astro$/, '').replace(/(^|\/)index$/, '$1') || '/')
  .filter((r) => !EXCLUIDAS.has(r))
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));

export const GET: APIRoute = () => {
  const urls = rutas
    .map((r) => `  <url><loc>${new URL(r, sitio.url).href.replace(/\/$/, r === '/' ? '/' : '')}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
