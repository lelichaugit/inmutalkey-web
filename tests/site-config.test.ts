import { describe, expect, it } from 'vitest';

import { estaDefinido, pendientes, sitio, TODO_DEFINIR } from '../src/site.config';

describe('site.config', () => {
  it('pendientes() lista rutas con TODO_DEFINIR', () => {
    expect(pendientes({ a: TODO_DEFINIR, b: { c: 1, d: TODO_DEFINIR }, e: [TODO_DEFINIR] })).toEqual(['a', 'b.d', 'e.0']);
  });

  it('estaDefinido distingue el marcador', () => {
    expect(estaDefinido(TODO_DEFINIR)).toBe(false);
    expect(estaDefinido(0)).toBe(true);
    expect(estaDefinido('')).toBe(true);
  });

  it('el sitio no se publica sin WhatsApp ni con URL distinta al dominio', () => {
    expect(estaDefinido(sitio.contacto.whatsapp)).toBe(true);
    expect(sitio.url).toBe('https://inmutalkey.com');
  });

  it('contacto publicado: correo del dominio', () => {
    expect(sitio.contacto.correo).toBe('contacto@inmutalkey.com');
  });
});
