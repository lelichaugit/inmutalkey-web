import { describe, expect, it } from 'vitest';

import { calcularImc, clasificarImc, errorSpo2, leerNumero } from '../src/lib/imc';

describe('IMC (mismas reglas que la app)', () => {
  it('peso / talla² a una decimal', () => {
    expect(calcularImc(70, 175)).toBe(22.9);
    expect(calcularImc(82.5, 168)).toBe(29.2);
  });

  it('null fuera de rango fisiológico o sin datos', () => {
    expect(calcularImc(Number.NaN, 170)).toBeNull();
    expect(calcularImc(70, 10)).toBeNull();
    expect(calcularImc(600, 170)).toBeNull();
  });

  it('clasificación OMS en sus cortes', () => {
    expect(clasificarImc(18.4)).toBe('BAJO_PESO');
    expect(clasificarImc(18.5)).toBe('NORMAL');
    expect(clasificarImc(24.9)).toBe('NORMAL');
    expect(clasificarImc(25)).toBe('SOBREPESO');
    expect(clasificarImc(30)).toBe('OBESIDAD_I');
    expect(clasificarImc(35)).toBe('OBESIDAD_II');
    expect(clasificarImc(40)).toBe('OBESIDAD_III');
  });
});

describe('SpO₂', () => {
  it('acepta 30–100 %', () => {
    expect(errorSpo2(30)).toBeNull();
    expect(errorSpo2(97)).toBeNull();
    expect(errorSpo2(100)).toBeNull();
  });

  it('rechaza más de 100, menos de 30 y texto', () => {
    expect(errorSpo2(101)).toMatch(/100/);
    expect(errorSpo2(-1)).toMatch(/30–100/);
    expect(errorSpo2(Number.NaN)).toMatch(/número/);
  });

  it('lee coma decimal', () => {
    expect(leerNumero('70,5')).toBe(70.5);
    expect(Number.isNaN(leerNumero(''))).toBe(true);
  });
});
