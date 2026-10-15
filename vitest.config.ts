import { getViteConfig } from 'astro/config';
import type { ViteUserConfig } from 'vitest/config';

// getViteConfig: permite renderizar componentes .astro en las pruebas (Astro Container API).
// Astro y Vitest traen versiones distintas de los tipos de Vite: `test` se tipa con los de Vitest.
const test: ViteUserConfig['test'] = {
  include: ['tests/**/*.test.ts'],
  environment: 'node',
};

export default getViteConfig({ test } as Parameters<typeof getViteConfig>[0]);
