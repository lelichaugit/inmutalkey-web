import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { trazoEcg, trazoPleth } from '../src/lib/trazos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

function archivos(dir: string, patron: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta, patron);
    return patron.test(e.name) ? [ruta] : [];
  });
}

/** Secciones que volvieron a la portada el 15-nov-2026 (rama feat/rebrand-web-v040-pleno). */
const NUEVAS = ['Problema', 'Integridad', 'Simulador', 'Signos', 'Dia', 'Boveda', 'Bento'] as const;
const seccion = (nombre: string): string => leer(`src/components/secciones/${nombre}.astro`);
/** Texto visible aproximado: sin el frontmatter, sin estilos y sin comentarios (ahí sí se habla en tercera persona). */
const visible = (astro: string): string =>
  astro
    .replace(/^---[\s\S]*?---/, (frontmatter) => frontmatter.replace(/^\s*\/\/.*$/gm, ''))
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('portada', () => {
  it('sigue el orden confirmado por Alan (15-nov-2026)', () => {
    const orden = [...leer('src/pages/index.astro').matchAll(/^ {2}<(\w+) \/>$/gm)].map((m) => m[1]);
    expect(orden).toEqual([
      'Hero', 'Problema', 'Integridad', 'Simulador', 'Signos', 'Dia', 'Recetas', 'Boveda', 'Bento', 'Fundadores',
      'Seguridad', 'TestimoniosVivos', 'Faq', 'Cierre',
    ]);
  });

  it('la barra y el pie solo enlazan a secciones que existen', () => {
    const ids = new Set(
      archivos(join(RAIZ, 'src/components/secciones'), /\.astro$/).flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(/<section[^>]*\sid="([\w-]+)"/g)].map((m) => m[1]),
      ),
    );
    const enlaces = [
      ...[...leer('src/components/Nav.astro').matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]),
      ...[...leer('src/components/Pie.astro').matchAll(/href="\/#([\w-]+)"/g)].map((m) => m[1]),
      ...[...leer('src/components/secciones/Hero.astro').matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]),
    ];
    expect(enlaces.length).toBeGreaterThan(5);
    for (const id of enlaces) expect(ids, `#${id}`).toContain(id);
  });

  it.each(NUEVAS)('%s habla de usted (sin tuteo)', (nombre) => {
    expect(visible(seccion(nombre))).not.toMatch(
      /(?<![\wáéíóúñ])(tú|tu|tus|ti|contigo|puedes|tienes|quieres|escribes|firmas|respaldas|abres|pruébalo|mira|toca|deja que)(?![\wáéíóúñ])/i,
    );
  });

  it.each(NUEVAS)('%s no muestra cédulas ni teléfonos (ni siquiera de ejemplo)', (nombre) => {
    const texto = visible(seccion(nombre));
    expect(texto).not.toMatch(/c[ée]d(ula)?\.?\s*(prof(esional)?\.?)?\s*:?\s*\d/i);
    expect(texto).not.toMatch(/\b\d{3}[ .-]\d{3}[ .-]\d{4}\b/);
  });

  it('PortaVault no aparece en la Bóveda ni en ninguna sección', () => {
    for (const nombre of NUEVAS) expect(seccion(nombre)).not.toMatch(/portavault/i);
  });
});

describe('movimiento (GEMINI.md, regla 4)', () => {
  const estilos = archivos(join(RAIZ, 'src'), /\.(astro|css)$/);

  it('los @keyframes solo animan transform, opacity y clip-path', () => {
    const fuera: string[] = [];
    for (const f of estilos) {
      for (const bloque of readFileSync(f, 'utf8').matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
        for (const d of (bloque[2] ?? '').matchAll(/([a-z-]+)\s*:/g)) {
          if (!['transform', 'opacity', 'clip-path'].includes(d[1] ?? '')) fuera.push(`${f}: ${bloque[1]} anima ${d[1]}`);
        }
      }
    }
    expect(fuera).toEqual([]);
  });

  it('Lenis solo se carga en diferido, tras comprobar puntero fino y movimiento', () => {
    const base = leer('src/scripts/base.ts');
    expect(base).toMatch(/import type \{ Suave \} from '\.\/suave';/);
    expect(base).not.toMatch(/^import (?!type)[^;]*'\.\/suave'/m);
    expect(base).toMatch(/if \(punteroFino\.matches && !movimientoReducido\.matches\) \{\s*void import\('\.\/suave'\)/);
    const conLenis = archivos(join(RAIZ, 'src'), /\.(ts|astro)$/).filter((f) => /from 'lenis'/.test(readFileSync(f, 'utf8')));
    expect(conLenis.map((f) => f.replace(RAIZ, ''))).toEqual(['/src/scripts/suave.ts']);
  });

  it('el motor de escenas y el brillo no se cargan con «reducir movimiento»', () => {
    const base = leer('src/scripts/base.ts');
    expect(base).toMatch(/if \(!movimientoReducido\.matches && document\.querySelector\('\[data-escena\]'\)\)/);
    expect(base).toMatch(/if \(punteroFino\.matches && !movimientoReducido\.matches\) \{\s*alAcercarse\('\[data-brillo\]'/);
  });
});

describe('trazos del monitor', () => {
  it.each([
    ['ECG', trazoEcg],
    ['pletismografía', trazoPleth],
  ] as const)('%s: un trazo continuo dentro de su lienzo', (_nombre, trazo) => {
    const d = trazo(520, 72);
    expect(d.startsWith('M0 ')).toBe(true);
    expect(d).not.toMatch(/NaN|undefined|Infinity/);
    const numeros = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    expect(Math.max(...numeros)).toBeLessThanOrEqual(520);
    expect(Math.min(...numeros)).toBeGreaterThanOrEqual(0);
  });

  it('caben latidos completos en cualquier ancho', () => {
    for (const ancho of [240, 520, 1000]) expect(trazoEcg(ancho, 72).endsWith(`H${ancho}`)).toBe(true);
  });
});
