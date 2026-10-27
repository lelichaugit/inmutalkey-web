// Conjunto completo de eventos válidos para el Worker: los fijos más `faq:<id>` por cada pregunta frecuente que
// existe en src/data/faq.ts. El frontend no lo importa (arrastraría el texto de la FAQ a su JS).

import { PREGUNTAS } from '../data/faq';
import { EVENTOS_FIJOS, PREFIJO_FAQ, type Evento } from './eventos';

export const EVENTOS: ReadonlySet<string> = new Set<string>([...EVENTOS_FIJOS, ...PREGUNTAS.map((p) => `${PREFIJO_FAQ}${p.id}`)]);

export function esEvento(valor: unknown): valor is Evento {
  return typeof valor === 'string' && EVENTOS.has(valor);
}
