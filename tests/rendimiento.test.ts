import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function estilos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return estilos(ruta);
    return /\.(astro|css)$/.test(e.name) ? [ruta] : [];
  });
}

describe('rendimiento del scroll (Chrome/Windows a 60 Hz)', () => {
  it('sin mix-blend-mode: una capa fija con fusión recompone toda la página en cada cuadro (30 % de cuadros lentos)', () => {
    const conFusion = estilos(SRC).filter((f) => /mix-blend-mode\s*:\s*(?!normal)/.test(readFileSync(f, 'utf8')));
    expect(conFusion).toEqual([]);
  });
});
