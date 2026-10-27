// Entorno del build. Ante cualquier duda se asume PRODUCCIÓN: es el modo con más candados
// (sin reseñas de ejemplo, sin claves de prueba de Turnstile, guardian estricto).

export type Entorno = 'produccion' | 'preview' | 'desarrollo';

export type VariablesEntorno = Readonly<Record<string, string | undefined>>;

const ENTORNOS: readonly Entorno[] = ['produccion', 'preview', 'desarrollo'];

function esEntorno(v: string): v is Entorno {
  return (ENTORNOS as readonly string[]).includes(v);
}

/**
 * Orden de decisión:
 * 1. `SITE_ENV` explícito (`produccion` | `preview` | `desarrollo`). Cualquier otro valor → producción.
 * 2. Servidor de desarrollo de Astro → desarrollo.
 * 3. Cloudflare Pages: rama `main` → producción; cualquier otra rama → preview.
 * 4. Si no se sabe → producción.
 */
export function detectarEntorno(env: VariablesEntorno, opciones: { readonly servidorDev?: boolean } = {}): Entorno {
  const explicito = env['SITE_ENV']?.trim().toLowerCase();
  if (explicito) return esEntorno(explicito) ? explicito : 'produccion';
  if (opciones.servidorDev === true) return 'desarrollo';
  if (env['CF_PAGES'] === '1') {
    return env['CF_PAGES_BRANCH'] === 'main' ? 'produccion' : 'preview';
  }
  return 'produccion';
}

/** Reseñas de ejemplo: nunca en producción; en preview solo con `SHOW_EXAMPLE_REVIEWS=true`. */
export function quiereEjemplos(entorno: Entorno, env: VariablesEntorno): boolean {
  if (entorno === 'produccion') return false;
  if (entorno === 'desarrollo') return true;
  return env['SHOW_EXAMPLE_REVIEWS'] === 'true';
}

/** Sitekey pública de prueba de Cloudflare: siempre aprueba. Solo fuera de producción. */
export const TURNSTILE_PRUEBA = '1x00000000000000000000AA';

/**
 * Sitekey de Turnstile para el build: la real en producción (o null si falta: el formulario se muestra deshabilitado
 * con la invitación a WhatsApp); la de prueba en desarrollo y preview.
 */
export function siteKeyTurnstile(entorno: Entorno, real: string | null): string | null {
  if (entorno !== 'produccion') return TURNSTILE_PRUEBA;
  return real;
}
