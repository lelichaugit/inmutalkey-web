import { describe, expect, it } from 'vitest';

import { detectarEntorno, quiereEjemplos } from '../src/lib/entorno';

describe('detectarEntorno', () => {
  it('respeta SITE_ENV explícito', () => {
    expect(detectarEntorno({ SITE_ENV: 'preview' })).toBe('preview');
    expect(detectarEntorno({ SITE_ENV: ' Desarrollo ' })).toBe('desarrollo');
    expect(detectarEntorno({ SITE_ENV: 'produccion' }, { servidorDev: true })).toBe('produccion');
  });

  it('un SITE_ENV desconocido falla hacia producción', () => {
    expect(detectarEntorno({ SITE_ENV: 'staging' })).toBe('produccion');
    expect(detectarEntorno({ SITE_ENV: 'production' })).toBe('produccion');
  });

  it('servidor de desarrollo sin SITE_ENV → desarrollo', () => {
    expect(detectarEntorno({}, { servidorDev: true })).toBe('desarrollo');
  });

  it('Cloudflare Pages: main → producción; otra rama → preview', () => {
    expect(detectarEntorno({ CF_PAGES: '1', CF_PAGES_BRANCH: 'main' })).toBe('produccion');
    expect(detectarEntorno({ CF_PAGES: '1', CF_PAGES_BRANCH: 'claude/rama' })).toBe('preview');
  });

  it('sin pistas → producción', () => {
    expect(detectarEntorno({})).toBe('produccion');
  });
});

describe('quiereEjemplos', () => {
  it('producción nunca muestra reseñas de ejemplo, aunque se pida', () => {
    expect(quiereEjemplos('produccion', { SHOW_EXAMPLE_REVIEWS: 'true' })).toBe(false);
  });

  it('preview solo con SHOW_EXAMPLE_REVIEWS=true', () => {
    expect(quiereEjemplos('preview', {})).toBe(false);
    expect(quiereEjemplos('preview', { SHOW_EXAMPLE_REVIEWS: '1' })).toBe(false);
    expect(quiereEjemplos('preview', { SHOW_EXAMPLE_REVIEWS: 'true' })).toBe(true);
  });

  it('desarrollo siempre', () => {
    expect(quiereEjemplos('desarrollo', {})).toBe(true);
  });
});
