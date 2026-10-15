import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// @property es global aunque se escriba en el <style> de un componente: dos componentes que registran el mismo nombre
// se pisan (así se rompió la entrada del simulador: Fundadores registró --giro con inherits:false y 250deg).
function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return /\.(astro|css)$/.test(e.name) ? [ruta] : [];
  });
}

describe('@property', () => {
  it('cada nombre registrado aparece en un solo archivo', () => {
    const duenos = new Map<string, string[]>();
    for (const ruta of archivos(join(import.meta.dirname, '..', 'src'))) {
      for (const m of readFileSync(ruta, 'utf8').matchAll(/@property\s+(--[\w-]+)/g)) {
        const nombre = m[1] ?? '';
        duenos.set(nombre, [...(duenos.get(nombre) ?? []), ruta]);
      }
    }
    const repetidos = [...duenos].filter(([, rutas]) => rutas.length > 1);
    expect(repetidos).toEqual([]);
  });
});
