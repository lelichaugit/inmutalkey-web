import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { paquete, sitio } from '../src/site.config';

const RAIZ = join(import.meta.dirname, '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

function archivos(dir: string, patron: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta, patron);
    return patron.test(e.name) ? [ruta] : [];
  });
}

describe('tokens «Cristal Sellado» (IDENTIDAD_MARCA §8, copiados tal cual)', () => {
  const tokens = leer('src/styles/tokens.css');
  it.each([
    '--marca-marino: #043259',
    '--marca-abismo: #032340',
    '--marca-acero: #224D73',
    '--marca-pizarra: #566573',
    '--marca-niebla: #F2F2F2',
    '--fondo: #EEF1F5',
    '--texto-suave: #4A5868',
    '--primario: #043259',
    '--radio-sm: 9px; --radio: 13px; --radio-lg: 18px; --radio-xl: 24px',
    '--cristal-blur: blur(22px) saturate(170%)',
    '--curva-cristal: cubic-bezier(.2, .8, .2, 1)',
    '--fondo: #021A30; --superficie: #06294A; --texto: #EEF4FB; --texto-suave: #A9BCCF; --borde: #173D61',
  ])('contiene «%s»', (token) => {
    expect(tokens).toContain(token);
  });

  it('las sombras van tintadas en Abismo (3, 35, 64), nunca grises', () => {
    expect(tokens).toMatch(/--elev-1: 0 1px 2px rgba\(3, 35, 64/);
  });

  it('la fuente es Inter Variable autoalojada (sin CDNs)', () => {
    const css = leer('src/styles/global.css');
    expect(css).toContain("url('/fonts/inter-variable.woff2')");
    expect(css).toMatch(/'cv05' 1/);
    expect(existsSync(join(RAIZ, 'public/fonts/inter-variable.woff2'))).toBe(true);
  });
});

describe('versión vigente (única fuente: site.config.ts)', () => {
  it('es 0.4.0 con instalador y ZIP', () => {
    expect(sitio.version.numero).toBe('0.4.0');
    expect(sitio.version.paquetes.map((p) => p.id)).toEqual(['instalador', 'zip']);
  });

  it.each(sitio.version.paquetes)('$id: huella SHA-256 hexadecimal y nombre con la versión', (p) => {
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.archivo).toContain(`_${sitio.version.numero}_`);
    expect(p.claveR2).toMatch(/^instaladores\/0\.4\.0\/[\w.-]+$/);
    expect(p.claveR2.endsWith(p.archivo)).toBe(true);
  });

  it('huellas publicadas de la v0.4.0', () => {
    expect(paquete('instalador').sha256).toBe('d8cf81a06db3214e7ff460b1446aa533e44a893a84cd302efd77cc467516190e');
    expect(paquete('zip').sha256).toBe('1f7c72d1111fca139b269f8f5abd1fad783a6efb5721e137decad1fba82f8d67');
  });

  it('ninguna página escribe una versión o huella suelta', () => {
    for (const f of archivos(join(RAIZ, 'src'), /\.astro$/)) {
      const texto = readFileSync(f, 'utf8');
      expect(texto, f).not.toMatch(/\b0\.[34]\.\d\b/);
      expect(texto, f).not.toMatch(/\b[0-9a-f]{64}\b/);
    }
  });
});

describe('veracidad', () => {
  it('PortaVault no aparece en el sitio (aún no existe como producto)', () => {
    for (const f of archivos(join(RAIZ, 'src'), /\.(astro|ts|css|json)$/)) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/portavault/i);
    }
  });

  it('sin promesas no verificables', () => {
    for (const f of archivos(join(RAIZ, 'src'), /\.(astro|ts)$/)) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/100\s?% (seguro|segura)|certificad[oa] por|instalación 100/i);
    }
  });
});
