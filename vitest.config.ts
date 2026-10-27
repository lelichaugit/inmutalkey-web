import { getViteConfig } from 'astro/config';
import type { ViteUserConfig } from 'vitest/config';

// getViteConfig: permite renderizar componentes .astro en las pruebas (Astro Container API).
// Astro y Vitest traen versiones distintas de los tipos de Vite: `test` se tipa con los de Vitest.
const test: ViteUserConfig['test'] = {
  include: ['tests/**/*.test.ts'],
  environment: 'node',
  // Las pruebas del Worker (tests/worker) levantan D1 y R2 locales con Miniflare: dales tiempo al arrancar.
  hookTimeout: 60_000,
  testTimeout: 30_000,
  // Los registros del Worker solo se muestran si una prueba falla.
  silent: 'passed-only',
};

export default getViteConfig({ test } as Parameters<typeof getViteConfig>[0]);
