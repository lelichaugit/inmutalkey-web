// Semáforo de la nota de evolución: mismas reglas que la app (clinica-nom004/src/utilidades/semaforoNom004.ts).
// Rojo: faltan signos vitales o el motivo. Amarillo: falta otro requisito. Verde: los 7 completos, se puede firmar.

export interface DatosNota {
  readonly motivo: string;
  readonly evolucion: string;
  readonly taSistolica: string;
  readonly taDiastolica: string;
  readonly fc: string;
  readonly fr: string;
  readonly temperatura: string;
  readonly peso: string;
  readonly talla: string;
  readonly omisionSignos: string;
  readonly exploracion: string;
  readonly diagnostico: string;
  readonly cie10: string;
  readonly pronostico: string;
  readonly plan: string;
}

export type EstadoSemaforo = 'rojo' | 'amarillo' | 'verde';

export interface Requisito {
  readonly id: 'motivo' | 'evolucion' | 'signos' | 'exploracion' | 'diagnostico' | 'pronostico' | 'plan';
  readonly etiqueta: string;
  readonly cumple: boolean;
}

export const ETIQUETA_SEMAFORO: Readonly<Record<EstadoSemaforo, string>> = {
  rojo: 'Incompleta: faltan signos vitales o el motivo de consulta',
  amarillo: 'Casi lista: falta diagnóstico CIE-10, pronóstico u otro requisito',
  verde: 'Lista para firmar: los 7 requisitos están completos',
};

const lleno = (t: string): boolean => t.trim() !== '';
const numero = (t: string): boolean => lleno(t) && Number.isFinite(Number(t.trim().replace(',', '.')));

export function signosFaltantes(d: DatosNota): string[] {
  const signos: ReadonlyArray<readonly [string, string]> = [
    ['TA sistólica', d.taSistolica],
    ['TA diastólica', d.taDiastolica],
    ['FC', d.fc],
    ['FR', d.fr],
    ['Temperatura', d.temperatura],
    ['Peso', d.peso],
    ['Talla', d.talla],
  ];
  return signos.filter(([, v]) => !numero(v)).map(([n]) => n);
}

export function requisitos(d: DatosNota): Requisito[] {
  const signosOk = signosFaltantes(d).length === 0 || lleno(d.omisionSignos);
  return [
    { id: 'motivo', etiqueta: 'Motivo de consulta', cumple: lleno(d.motivo) },
    { id: 'evolucion', etiqueta: 'Evolución / padecimiento actual', cumple: lleno(d.evolucion) },
    { id: 'signos', etiqueta: 'Signos vitales completos', cumple: signosOk },
    { id: 'exploracion', etiqueta: 'Exploración física', cumple: lleno(d.exploracion) },
    { id: 'diagnostico', etiqueta: 'Diagnóstico con clave CIE-10', cumple: lleno(d.diagnostico) && lleno(d.cie10) },
    { id: 'pronostico', etiqueta: 'Pronóstico', cumple: lleno(d.pronostico) },
    { id: 'plan', etiqueta: 'Plan de tratamiento e indicaciones', cumple: lleno(d.plan) },
  ];
}

export function calcularSemaforo(d: DatosNota): { estado: EstadoSemaforo; requisitos: Requisito[]; cumplidos: number } {
  const lista = requisitos(d);
  const falta = (id: Requisito['id']): boolean => lista.some((r) => r.id === id && !r.cumple);
  const cumplidos = lista.filter((r) => r.cumple).length;
  const estado: EstadoSemaforo = falta('signos') || falta('motivo') ? 'rojo' : cumplidos < lista.length ? 'amarillo' : 'verde';
  return { estado, requisitos: lista, cumplidos };
}
