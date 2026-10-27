// Lista cerrada de eventos de uso del sitio. La importan el frontend (src/scripts/eventos.ts) y el Worker
// (vía eventos-validos.ts): una sola fuente, sin copias que se desincronicen. Este módulo no importa nada para que
// el JS público siga ligero; el conjunto completo (con una entrada por pregunta frecuente) vive en eventos-validos.ts.
//
// Privacidad: solo se guardan agregados por día, evento y origen de campaña (eventos_diarios). Nada de IP, user-agent,
// cookies ni identificador de visitante. Un evento fuera de la lista se descarta en silencio.

/** Eventos fijos. Para agregar uno: súmalo aquí y en el lugar del sitio que lo emite. */
export const EVENTOS_FIJOS = [
  /** Una carga de página (cualquier página pública). Base del embudo segmentado por utm_source. */
  'pagina_vista',
  /** Primer foco en el formulario de Fundadores. */
  'formulario_iniciado',
  /** Clic en un botón de WhatsApp, por intención. */
  'whatsapp_prueba',
  'whatsapp_fundadores',
  'whatsapp_general',
  /** El simulador de la portada empezó a reproducirse. */
  'demo_iniciada',
] as const;

/** Prefijo de los eventos de apertura de una pregunta frecuente: `faq:<id>`. */
export const PREFIJO_FAQ = 'faq:' as const;

export type EventoFijo = (typeof EVENTOS_FIJOS)[number];
export type EventoFaq = `${typeof PREFIJO_FAQ}${string}`;
export type Evento = EventoFijo | EventoFaq;

/**
 * Orígenes de campaña aceptados. Lista cerrada a propósito: un valor libre permitiría a un bot llenar la tabla de
 * filas basura. `tarjeta` = QR de las tarjetas físicas. Lo que no esté aquí se guarda como `otro`; sin utm, `directo`.
 */
export const UTM_FUENTES = [
  'directo',
  'tarjeta',
  'whatsapp',
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'google',
  'congreso',
  'correo',
  'otro',
] as const;

export type UtmFuente = (typeof UTM_FUENTES)[number];

const FUENTES: ReadonlySet<string> = new Set(UTM_FUENTES);

/** Normaliza un utm_source a la lista cerrada. */
export function normalizarFuente(valor: unknown): UtmFuente {
  if (typeof valor !== 'string') return 'directo';
  const limpio = valor.trim().toLowerCase();
  if (limpio === '') return 'directo';
  return FUENTES.has(limpio) ? (limpio as UtmFuente) : 'otro';
}

/** utm_medium y utm_campaign: texto corto y seguro (letras, números, guion y guion bajo). Vacío → null. */
export function normalizarUtmLibre(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 60);
  return limpio === '' ? null : limpio;
}
