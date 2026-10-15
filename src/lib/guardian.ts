// Reglas del guardian del build (astro.config.mjs): lo que un HTML/CSS de producción no puede contener.
// Funciones puras para poder probarlas sin compilar el sitio.

/** Relaciones de <link> que descargan algo (un <link rel="canonical"> o un <a> no cuentan). */
const LINK_CON_DESCARGA =
  /\brel=["']?(?:stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|apple-touch-icon|manifest)\b/i;

function esExterna(url: string, sitio: string): boolean {
  return /^(?:https?:)?\/\//i.test(url) && !url.startsWith(sitio);
}

export function revisarHtml(html: string, sitio: string): string[] {
  const problemas: string[] = [];
  if (/\sdata-resena-ejemplo\b/.test(html)) problemas.push('contiene reseñas de ejemplo (data-resena-ejemplo)');
  if (/<style[\s>]/i.test(html)) problemas.push('contiene <style> en línea');
  if (/\sstyle\s*=/i.test(html)) problemas.push('contiene atributos style= (la CSP los bloquea)');

  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1] ?? '';
    const src = /\ssrc=["']?([^"'\s>]+)/i.exec(attrs)?.[1];
    if (src === undefined) {
      if (!/\stype=["']?application\/ld\+json/i.test(attrs)) problemas.push('contiene <script> en línea');
    } else if (esExterna(src, sitio)) {
      problemas.push(`script de terceros: ${src}`);
    }
  }

  for (const m of html.matchAll(/<(img|iframe|source|video|audio|embed)\b[^>]*?\s(?:src|srcset)=["']?([^"'>]+)/gi)) {
    for (const parte of (m[2] ?? '').split(',')) {
      const url = parte.trim().split(/\s+/)[0] ?? '';
      if (esExterna(url, sitio)) problemas.push(`recurso de terceros en <${m[1]}>: ${url}`);
    }
  }

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const href = /\shref=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (href && LINK_CON_DESCARGA.test(tag) && esExterna(href, sitio)) problemas.push(`<link> de terceros: ${href}`);
  }

  return [...new Set(problemas)];
}

export function revisarCss(css: string, sitio: string): string[] {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)/gi)]
    .map((m) => m[1] ?? '')
    .filter((u) => esExterna(u, sitio))
    .map((u) => `CSS con recurso de terceros: ${u}`);
}
