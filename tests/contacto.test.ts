import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';

import Contacto from '../src/components/Contacto.astro';
import SocialLinks from '../src/components/SocialLinks.astro';
import { REDES } from '../src/data/socials';
import { revisarHtml } from '../src/lib/guardian';
import PaginaContacto from '../src/pages/contacto.astro';

const SITIO = 'https://inmutalkey.com';
let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function enlacesExternos(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\shref="https?:\/\/[^"]*"[^>]*>/gi)].map((m) => m[0]);
}

describe('SocialLinks', () => {
  it.each(['footer', 'cards'] as const)('variant="%s" renderiza las 3 redes con enlaces seguros', async (variant) => {
    const html = await container.renderToString(SocialLinks, { props: { variant } });
    for (const red of REDES) expect(html).toContain(`href="${red.url}"`);
    const externos = enlacesExternos(html);
    expect(externos).toHaveLength(3);
    for (const a of externos) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="me noopener noreferrer"');
      expect(a).toMatch(/aria-label="[^"]+, se abre en una pestaña nueva"/);
    }
    expect(html).not.toContain('<img');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});

/** Nombre accesible aproximado de cada <a>: aria-label o, si no hay, su texto sin lo marcado aria-hidden. */
function nombresDeEnlaces(html: string): string[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => {
    const etiqueta = /aria-label="([^"]*)"/.exec(m[1] ?? '')?.[1];
    if (etiqueta) return etiqueta;
    const visible = (m[2] ?? '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, ' ');
    return visible.replace(/\s+/g, ' ').trim();
  });
}

describe('Contacto (fila del cierre)', () => {
  it('ningún par de enlaces se anuncia igual (Instagram y X comparten @inmutalkey)', async () => {
    const html = await container.renderToString(Contacto, { props: { variante: 'fila' } });
    const nombres = nombresDeEnlaces(html);
    expect(nombres.length).toBeGreaterThanOrEqual(5);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(nombres).toContain('Instagram @inmutalkey');
    expect(nombres).toContain('X @inmutalkey');
  });
});

describe('/contacto', () => {
  let html = '';
  beforeAll(async () => {
    html = await container.renderToString(PaginaContacto, { request: new Request(`${SITIO}/contacto`) });
  });

  it('pasa el guardian: sin recursos de terceros, sin scripts en línea, enlaces externos con rel y sin rastreo', () => {
    expect(revisarHtml(html, SITIO)).toEqual([]);
  });

  it('ningún enlace externo omite rel="noopener noreferrer"', () => {
    const externos = enlacesExternos(html);
    expect(externos.length).toBeGreaterThan(0);
    for (const a of externos) expect(a).toMatch(/rel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/);
  });

  it('cero widgets/iframes/SDK de redes sociales', () => {
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/<script[^>]+src="https?:/i);
    expect(html).not.toMatch(/platform\.twitter|connect\.facebook|instagram\.com\/embed|platform\.linkedin/i);
  });

  it('el texto visible de cada botón está dentro de su nombre accesible (WCAG 2.5.3)', () => {
    expect(html).toContain('aria-label="Escribir correo a contacto@inmutalkey.com"');
    expect(html).toMatch(/aria-label="Abrir WhatsApp Business, \+52 229 152 5847, se abre en una pestaña nueva"/);
    expect(html).toContain('aria-label="Seguir a InmutalKey en Instagram, se abre en una pestaña nueva"');
    expect(html).toContain('aria-label="Conectar con Alan Vargas Fregoso, fundador de InmutalKey, en LinkedIn, se abre en una pestaña nueva"');
  });

  it('correo como canal principal antes de las redes, y QR con su texto alternativo', () => {
    expect(html.indexOf('mailto:contacto@inmutalkey.com')).toBeGreaterThan(-1);
    expect(html.indexOf('Contacto directo')).toBeLessThan(html.indexOf('Síganos'));
    expect(html).toContain('alt="Código QR para abrir el perfil @inmutalkey en Instagram"');
    expect(html).toContain('Escanee para seguirnos en Instagram');
  });

  it('head: rel="me" y JSON-LD Organization/Person', () => {
    for (const red of REDES) expect(html).toContain(`<link rel="me" href="${red.url}">`);
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? '';
    const grafo = (JSON.parse(ld) as { '@graph': Array<Record<string, unknown>> })['@graph'];
    const org = grafo.find((n) => n['@type'] === 'Organization');
    const persona = grafo.find((n) => n['@type'] === 'Person');
    expect(org).toMatchObject({
      name: 'InmutalKey',
      url: 'https://inmutalkey.com',
      email: 'contacto@inmutalkey.com',
      sameAs: ['https://www.instagram.com/inmutalkey/', 'https://x.com/inmutalkey'],
    });
    expect(persona).toMatchObject({
      name: 'Alan Vargas Fregoso',
      sameAs: ['https://www.linkedin.com/in/alan-vargas-fregoso-24389b36b/'],
      worksFor: { '@id': 'https://inmutalkey.com/#organizacion' },
    });
  });
});
