// Verificación de Turnstile del lado del servidor. No se envía la IP del visitante (no hace falta y es un dato más).

import type { Env } from '../env';
import { registrarError } from './registro';

const URL_VERIFICAR = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface RespuestaTurnstile {
  readonly success: boolean;
  readonly hostname?: string;
  readonly action?: string;
  readonly 'error-codes'?: readonly string[];
}

export async function verificarTurnstile(env: Env, token: string | undefined, accion: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const respuesta = await fetch(URL_VERIFICAR, {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
    });
    if (!respuesta.ok) return false;
    const datos = (await respuesta.json()) as RespuestaTurnstile;
    if (!datos.success) return false;
    if (env.TURNSTILE_HOSTNAMES) {
      const permitidos = env.TURNSTILE_HOSTNAMES.split(',').map((h) => h.trim());
      if (!datos.hostname || !permitidos.includes(datos.hostname)) return false;
      // La acción la fija el widget (data-action); evita reutilizar un token de un formulario en otro.
      if (datos.action !== undefined && datos.action !== accion) return false;
    }
    return true;
  } catch (error) {
    registrarError('turnstile', error);
    return false;
  }
}
