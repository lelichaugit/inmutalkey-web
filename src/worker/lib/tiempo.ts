// Fechas. Todo se guarda en UTC (ISO 8601). Los agregados diarios y los plazos ARCO usan la hora del centro de México
// (UTC−6 todo el año desde que se eliminó el horario de verano en 2022).

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;
const DESFASE_MX_MS = -6 * MS_HORA;

export const ahora = (): Date => new Date();

export const iso = (fecha: Date): string => fecha.toISOString();

export const masHoras = (fecha: Date, horas: number): Date => new Date(fecha.getTime() + horas * MS_HORA);

export const masDias = (fecha: Date, dias: number): Date => new Date(fecha.getTime() + dias * MS_DIA);

/** `AAAA-MM-DD` en la hora del centro de México. */
export function fechaMexico(fecha: Date): string {
  return new Date(fecha.getTime() + DESFASE_MX_MS).toISOString().slice(0, 10);
}

/**
 * Días hábiles (lunes a viernes, hora de México) transcurridos desde `desde` hasta `hasta`, sin contar el día de la
 * solicitud. No descuenta días festivos: es una alarma conservadora (avisa antes, nunca después).
 */
export function diasHabilesEntre(desde: Date, hasta: Date): number {
  const inicio = new Date(`${fechaMexico(desde)}T00:00:00Z`);
  const fin = new Date(`${fechaMexico(hasta)}T00:00:00Z`);
  let dias = 0;
  for (let d = new Date(inicio.getTime() + MS_DIA); d <= fin; d = new Date(d.getTime() + MS_DIA)) {
    const semana = d.getUTCDay();
    if (semana !== 0 && semana !== 6) dias++;
  }
  return dias;
}

/** Valida `AAAA-MM-DD` real (no acepta 2026-02-31). */
export function esFechaCorta(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
