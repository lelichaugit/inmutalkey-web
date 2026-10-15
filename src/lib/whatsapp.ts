import { estaDefinido, type Valor } from '../site.config';

const SOLO_DIGITOS = /^\d{11,15}$/;

/** Ladas de dos dígitos en México (CDMX, Guadalajara, Monterrey); el resto usa tres. */
const LADAS_DOS_DIGITOS = new Set(['55', '56', '33', '81']);

/** Enlace `wa.me` con el mensaje prellenado, o `null` si el número falta o no es válido. */
export function enlaceWhatsApp(numero: Valor<string>, mensaje: string): string | null {
  if (!estaDefinido(numero) || !SOLO_DIGITOS.test(numero)) return null;
  const texto = mensaje.trim();
  return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`;
}

/** `522291525847` → `+52 229 152 5847`. Otros países: `+<dígitos>` sin agrupar. `null` si falta. */
export function numeroVisible(numero: Valor<string>): string | null {
  if (!estaDefinido(numero) || !SOLO_DIGITOS.test(numero)) return null;
  if (numero.startsWith('52') && numero.length === 12) {
    const nacional = numero.slice(2);
    const lada = LADAS_DOS_DIGITOS.has(nacional.slice(0, 2)) ? 2 : 3;
    const medio = lada === 2 ? 4 : 3;
    return `+52 ${nacional.slice(0, lada)} ${nacional.slice(lada, lada + medio)} ${nacional.slice(lada + medio)}`;
  }
  return `+${numero}`;
}
