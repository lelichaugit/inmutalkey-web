import { describe, expect, it } from 'vitest';

import { revisarCss, revisarHtml } from '../src/lib/guardian';

const SITIO = 'https://inmutalkey.com';

describe('guardian · HTML', () => {
  it('acepta lo que produce el sitio', () => {
    const html = `<html><head>
      <link rel="canonical" href="https://inmutalkey.com/">
      <link rel="stylesheet" href="/_astro/index.css">
      <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
      </head><body><a href="https://wa.me/522291525847">WhatsApp</a>
      <img src="/brand/isotipo-3d-800.webp" srcset="/brand/isotipo-3d-480.webp 480w, /brand/isotipo-3d-800.webp 800w">
      <script type="module" src="/_astro/base.js"></script></body></html>`;
    expect(revisarHtml(html, SITIO)).toEqual([]);
  });

  it('rechaza reseñas de ejemplo', () => {
    expect(revisarHtml('<article data-resena-ejemplo>…</article>', SITIO)).toContain(
      'contiene reseñas de ejemplo (data-resena-ejemplo)',
    );
  });

  it('rechaza scripts en línea y atributos style', () => {
    const r = revisarHtml('<div style="color:red"></div><script>alert(1)</script>', SITIO);
    expect(r).toContain('contiene <script> en línea');
    expect(r).toContain('contiene atributos style= (la CSP los bloquea)');
  });

  it('rechaza recursos de terceros, no enlaces', () => {
    const r = revisarHtml(
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2">
       <script src="https://cdn.example.com/x.js"></script>
       <img src="//img.example.com/a.png">
       <a href="https://example.com">ok</a>`,
      SITIO,
    );
    expect(r).toEqual([
      'script de terceros: https://cdn.example.com/x.js',
      'recurso de terceros en <img>: //img.example.com/a.png',
      '<link> de terceros: https://fonts.googleapis.com/css2',
    ]);
  });
});

describe('guardian · CSS', () => {
  it('solo marca url() externas', () => {
    expect(revisarCss("a{background:url('/img/grano.svg')} b{background:url(https://x.com/a.png)}", SITIO)).toEqual([
      'CSS con recurso de terceros: https://x.com/a.png',
    ]);
  });
});
