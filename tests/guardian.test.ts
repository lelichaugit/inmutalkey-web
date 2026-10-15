import { describe, expect, it } from 'vitest';

import { revisarCss, revisarHtml } from '../src/lib/guardian';

const SITIO = 'https://inmutalkey.com';

describe('guardian · HTML', () => {
  it('acepta lo que produce el sitio', () => {
    const html = `<html><head>
      <link rel="canonical" href="https://inmutalkey.com/">
      <link rel="stylesheet" href="/_astro/index.css">
      <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
      </head><body><a href="https://wa.me/522291525847" target="_blank" rel="noopener noreferrer">WhatsApp</a>
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
       <a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a>`,
      SITIO,
    );
    expect(r).toEqual([
      'script de terceros: https://cdn.example.com/x.js',
      'recurso de terceros en <img>: //img.example.com/a.png',
      '<link> de terceros: https://fonts.googleapis.com/css2',
    ]);
  });
});

describe('guardian · enlaces salientes', () => {
  it('exige rel="noopener noreferrer" en enlaces externos (no en internos ni mailto)', () => {
    const r = revisarHtml(
      `<a href="https://x.com/inmutalkey" target="_blank" rel="me noopener noreferrer">X</a>
       <a href="https://inmutalkey.com/contacto">interno</a>
       <a href="/privacidad">relativo</a>
       <a href="mailto:contacto@inmutalkey.com">correo</a>
       <a href="https://example.com" target="_blank" rel="noopener">mal</a>
       <a href="https://example.org">sin rel</a>`,
      SITIO,
    );
    expect(r).toEqual([
      'enlace externo sin rel="noopener noreferrer": https://example.com',
      'enlace externo sin rel="noopener noreferrer": https://example.org',
    ]);
  });

  it('rechaza parámetros de rastreo en enlaces salientes', () => {
    const rel = 'target="_blank" rel="noopener noreferrer"';
    const r = revisarHtml(
      `<a href="https://x.com/inmutalkey?s=11" ${rel}>a</a>
       <a href="https://www.linkedin.com/in/x?lipi=abc" ${rel}>b</a>
       <a href="https://www.instagram.com/inmutalkey/?utm_source=web" ${rel}>c</a>
       <a href="https://wa.me/522291525847?text=Hola" ${rel}>ok</a>`,
      SITIO,
    );
    expect(r).toEqual([
      'enlace externo con parámetros de rastreo: https://x.com/inmutalkey?s=11',
      'enlace externo con parámetros de rastreo: https://www.linkedin.com/in/x?lipi=abc',
      'enlace externo con parámetros de rastreo: https://www.instagram.com/inmutalkey/?utm_source=web',
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
