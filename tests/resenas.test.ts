import { describe, expect, it } from 'vitest';

import ejemplos from '../src/data/resenas.json';
import { resenasPublicables, type Resena } from '../src/lib/resenas';

const real: Resena = {
  id: 'r1',
  nombre: 'Dra. Ana',
  especialidad: 'Pediatría',
  estrellas: 5,
  texto: 'Muy útil.',
  verificado: true,
  esEjemplo: false,
};

describe('reseñas', () => {
  it('producción no muestra reseñas de ejemplo', () => {
    expect(resenasPublicables(ejemplos, { incluirEjemplos: false })).toEqual([]);
  });

  it('una reseña verificada que además es de ejemplo nunca se publica como real', () => {
    const r = resenasPublicables([{ ...real, esEjemplo: true }], { incluirEjemplos: false });
    expect(r).toEqual([]);
  });

  it('con reseñas reales, las de ejemplo no se mezclan aunque se permitan', () => {
    expect(resenasPublicables([...ejemplos, real], { incluirEjemplos: true })).toEqual([real]);
  });

  it('en preview con ejemplos, se muestran las 10 de ejemplo', () => {
    const r = resenasPublicables(ejemplos, { incluirEjemplos: true });
    expect(r).toHaveLength(10);
    expect(r.every((x) => x.esEjemplo && !x.verificado)).toBe(true);
  });

  it('descarta filas mal formadas', () => {
    expect(resenasPublicables([{ ...real, estrellas: 7 }, { id: 'x' }, null], { incluirEjemplos: false })).toEqual([]);
  });

  it('los ejemplos no traen nombres reales ni cifras', () => {
    for (const r of ejemplos) {
      expect(r.nombre).toMatch(/^Dr(a)?\. \[Nombre\]$/);
      expect(r.texto).not.toMatch(/\d/);
    }
  });
});
