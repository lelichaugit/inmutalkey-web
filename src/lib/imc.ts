// Mismas reglas que la app (clinica-nom004/src/domain/validators.ts): el sitio no promete nada que la app no haga.

export const RANGOS = {
  pesoKg: { min: 0.3, max: 500 },
  tallaCm: { min: 20, max: 260 },
  spo2: { min: 30, max: 100 },
} as const;

export type ClaseImc = 'BAJO_PESO' | 'NORMAL' | 'SOBREPESO' | 'OBESIDAD_I' | 'OBESIDAD_II' | 'OBESIDAD_III';

export const ETIQUETA_IMC: Readonly<Record<ClaseImc, string>> = {
  BAJO_PESO: 'Bajo peso',
  NORMAL: 'Peso normal',
  SOBREPESO: 'Sobrepeso',
  OBESIDAD_I: 'Obesidad grado I',
  OBESIDAD_II: 'Obesidad grado II',
  OBESIDAD_III: 'Obesidad grado III',
};

/** IMC = peso(kg) / talla(m)², a una decimal. `null` si faltan datos o están fuera de rango fisiológico. */
export function calcularImc(pesoKg: number, tallaCm: number): number | null {
  if (!Number.isFinite(pesoKg) || !Number.isFinite(tallaCm)) return null;
  if (pesoKg < RANGOS.pesoKg.min || pesoKg > RANGOS.pesoKg.max) return null;
  if (tallaCm < RANGOS.tallaCm.min || tallaCm > RANGOS.tallaCm.max) return null;
  const m = tallaCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

/** Clasificación OMS para adultos. */
export function clasificarImc(imc: number): ClaseImc {
  if (imc < 18.5) return 'BAJO_PESO';
  if (imc < 25) return 'NORMAL';
  if (imc < 30) return 'SOBREPESO';
  if (imc < 35) return 'OBESIDAD_I';
  if (imc < 40) return 'OBESIDAD_II';
  return 'OBESIDAD_III';
}

/** Mensaje de error para SpO₂, o `null` si es válida (la app rechaza valores fuera de 30–100 %). */
export function errorSpo2(valor: number): string | null {
  if (!Number.isFinite(valor)) return 'Escribe un número.';
  if (valor > RANGOS.spo2.max) return 'La saturación no puede pasar de 100 %.';
  if (valor < RANGOS.spo2.min) return 'Fuera de rango fisiológico (30–100 %).';
  return null;
}

/** "70,5" o "70.5" → 70.5; vacío o texto → NaN. */
export function leerNumero(texto: string): number {
  const limpio = texto.trim().replace(',', '.');
  return limpio === '' ? Number.NaN : Number(limpio);
}
