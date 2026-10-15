// Reseñas: en producción solo se publican las verificadas que no son de ejemplo.
// Las de ejemplo existen para maquetar y se ven únicamente en desarrollo o en preview con SHOW_EXAMPLE_REVIEWS=true.

export interface Resena {
  readonly id: string;
  readonly nombre: string;
  readonly especialidad: string;
  readonly estrellas: 1 | 2 | 3 | 4 | 5;
  readonly texto: string;
  readonly verificado: boolean;
  readonly esEjemplo: boolean;
}

export function esResenaValida(r: unknown): r is Resena {
  if (r === null || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['nombre'] === 'string' &&
    typeof o['especialidad'] === 'string' &&
    typeof o['texto'] === 'string' &&
    typeof o['verificado'] === 'boolean' &&
    typeof o['esEjemplo'] === 'boolean' &&
    typeof o['estrellas'] === 'number' &&
    Number.isInteger(o['estrellas']) &&
    (o['estrellas'] as number) >= 1 &&
    (o['estrellas'] as number) <= 5
  );
}

/** Reseñas que se pueden mostrar. Nunca mezcla: si hay verificadas, las de ejemplo no aparecen. */
export function resenasPublicables(todas: readonly unknown[], opciones: { readonly incluirEjemplos: boolean }): Resena[] {
  const validas = todas.filter(esResenaValida);
  const reales = validas.filter((r) => r.verificado && !r.esEjemplo);
  if (reales.length > 0 || !opciones.incluirEjemplos) return reales;
  return validas.filter((r) => r.esEjemplo);
}
