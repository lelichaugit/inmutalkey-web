import { describe, expect, it } from 'vitest';

import { etiquetaAccesible, REDES, redPorId, REL_PERFIL_PROPIO, WHATSAPP_ENABLED } from '../src/data/socials';

describe('socials.ts', () => {
  it('contiene exactamente las 3 URLs canónicas', () => {
    expect(REDES.map((r) => [r.id, r.url])).toEqual([
      ['instagram', 'https://www.instagram.com/inmutalkey/'],
      ['x', 'https://x.com/inmutalkey'],
      ['linkedin', 'https://www.linkedin.com/in/alan-vargas-fregoso-24389b36b/'],
    ]);
  });

  it('las URLs son https, sin query ni fragmento (cero rastreo)', () => {
    for (const red of REDES) {
      const url = new URL(red.url);
      expect(url.protocol).toBe('https:');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    }
  });

  it('handles y textos de cada red', () => {
    expect(redPorId('instagram').handle).toBe('@inmutalkey');
    expect(redPorId('x').handle).toBe('@inmutalkey');
    expect(redPorId('linkedin').accion).toBe('Conectar');
  });

  it('perfiles propios con rel="me noopener noreferrer" y nombre accesible con aviso de pestaña nueva', () => {
    expect(REL_PERFIL_PROPIO).toBe('me noopener noreferrer');
    expect(etiquetaAccesible(redPorId('instagram'))).toBe('InmutalKey en Instagram, se abre en una pestaña nueva');
  });

  it('WHATSAPP_ENABLED es un booleano explícito', () => {
    expect(typeof WHATSAPP_ENABLED).toBe('boolean');
  });
});
