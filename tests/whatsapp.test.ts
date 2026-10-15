import { describe, expect, it } from 'vitest';

import { enlaceWhatsApp, numeroVisible } from '../src/lib/whatsapp';
import { TODO_DEFINIR } from '../src/site.config';

describe('enlaceWhatsApp', () => {
  it('arma wa.me con el mensaje codificado', () => {
    expect(enlaceWhatsApp('522291525847', 'Hola, ¿qué tal? & más')).toBe(
      'https://wa.me/522291525847?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%20%26%20m%C3%A1s',
    );
  });

  it('sin mensaje no agrega ?text', () => {
    expect(enlaceWhatsApp('522291525847', '  ')).toBe('https://wa.me/522291525847');
  });

  it('null si falta o no es válido', () => {
    expect(enlaceWhatsApp(TODO_DEFINIR, 'x')).toBeNull();
    expect(enlaceWhatsApp('+52 229 152 5847', 'x')).toBeNull();
    expect(enlaceWhatsApp('2291525847', 'x')).toBeNull();
  });
});

describe('numeroVisible', () => {
  it('lada de tres dígitos', () => {
    expect(numeroVisible('522291525847')).toBe('+52 229 152 5847');
  });

  it('lada de dos dígitos (CDMX)', () => {
    expect(numeroVisible('525512345678')).toBe('+52 55 1234 5678');
  });

  it('otro país sin agrupar; null si falta', () => {
    expect(numeroVisible('14155550123')).toBe('+14155550123');
    expect(numeroVisible(TODO_DEFINIR)).toBeNull();
  });
});
