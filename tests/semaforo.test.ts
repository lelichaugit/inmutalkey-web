import { describe, expect, it } from 'vitest';

import { buscarCie10 } from '../src/lib/cie10';
import { calcularSemaforo, type DatosNota } from '../src/lib/semaforo';

const completa: DatosNota = {
  motivo: 'Dolor de garganta',
  evolucion: 'Inicia hace 2 días',
  taSistolica: '120',
  taDiastolica: '80',
  fc: '88',
  fr: '18',
  temperatura: '38.2',
  peso: '68',
  talla: '165',
  omisionSignos: '',
  exploracion: 'Faringe hiperémica',
  diagnostico: 'Faringitis aguda no especificada',
  cie10: 'J02.9',
  pronostico: 'Bueno',
  plan: 'Paracetamol',
};

describe('semáforo de la nota (reglas de la app)', () => {
  it('verde con los 7 requisitos', () => {
    const s = calcularSemaforo(completa);
    expect(s.estado).toBe('verde');
    expect(s.cumplidos).toBe(7);
  });

  it('rojo si falta el motivo o un signo vital', () => {
    expect(calcularSemaforo({ ...completa, motivo: ' ' }).estado).toBe('rojo');
    expect(calcularSemaforo({ ...completa, fc: '' }).estado).toBe('rojo');
    expect(calcularSemaforo({ ...completa, peso: 'abc' }).estado).toBe('rojo');
  });

  it('la omisión justificada de signos los da por cumplidos', () => {
    const s = calcularSemaforo({ ...completa, fc: '', fr: '', omisionSignos: 'Consulta a distancia' });
    expect(s.estado).toBe('verde');
  });

  it('amarillo si solo falta diagnóstico, CIE-10, pronóstico o plan', () => {
    expect(calcularSemaforo({ ...completa, cie10: '' }).estado).toBe('amarillo');
    expect(calcularSemaforo({ ...completa, pronostico: '' }).estado).toBe('amarillo');
  });
});

describe('búsqueda CIE-10', () => {
  it('por clave, como prefijo', () => {
    expect(buscarCie10('J02').map((d) => d.codigo)).toEqual(['J02.0', 'J02.9']);
  });

  it('por palabras del nombre, sin acentos ni orden', () => {
    expect(buscarCie10('faring').map((d) => d.codigo)).toEqual(['J02.0', 'J02.9']);
    expect(buscarCie10('tipo diabetes')[0]?.codigo).toBe('E11.9');
    expect(buscarCie10('vias urinarias')[0]?.codigo).toBe('N39.0');
  });

  it('vacío no busca', () => {
    expect(buscarCie10('  ')).toEqual([]);
  });
});
