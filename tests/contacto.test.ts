import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';

import SocialLinks from '../src/components/SocialLinks.astro';
import { REDES } from '../src/data/socials';
import { revisarHtml } from '../src/lib/guardian';
import Contacto from '../src/pages/contacto.astro';

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

describe('/contacto', () => {
  let html = '';
  beforeAll(async () => {
    html = await container.renderToString(Contacto, { request: new Request(`${SITIO}/contacto`) });
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

  it('correo como canal principal antes de las redes, y QR con su texto alternativo', () => {
    expect(html.indexOf('mailto:contacto@inmutalkey.com')).toBeGreaterThan(-1);
    expect(html.indexOf('Contacto directo')).toBeLessThan(html.indexOf('Síguenos'));
    expect(html).toContain('alt="Código QR para abrir el perfil @inmutalkey en Instagram"');
    expect(html).toContain('Escanea para seguirnos en Instagram');
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
