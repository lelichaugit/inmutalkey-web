// Segunda llave de /admin. Cloudflare Access ya bloquea en el borde a quien no inició sesión; aquí se valida además
// el JWT que Access agrega (Cf-Access-Jwt-Assertion): firma RS256 con las llaves públicas del equipo, audiencia,
// emisor, vigencia y que el correo esté en ADMIN_CORREOS. Si alguien desactiva Access por error, /admin sigue cerrado.

import type { MiddlewareHandler } from 'hono';

import type { Contexto, Env } from '../env';
import { incluyeAudiencia, reiniciarCacheJwks, verificarRs256 } from './jwt';
import { leerCookie } from './sesion';

/** Solo para pruebas. */
export function reiniciarCacheLlaves(): void {
  reiniciarCacheJwks();
}

export function correosAdmin(env: Env): readonly string[] {
  return (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/** Devuelve el correo autenticado o null. Nunca lanza. */
export async function verificarAcceso(env: Env, jwt: string | undefined): Promise<string | null> {
  if (!jwt || !env.ACCESS_EQUIPO || !env.ACCESS_AUD) return null;
  const carga = await verificarRs256(jwt, `https://${env.ACCESS_EQUIPO}/cdn-cgi/access/certs`);
  if (!carga || !incluyeAudiencia(carga, env.ACCESS_AUD)) return null;
  if (carga.iss !== `https://${env.ACCESS_EQUIPO}`) return null;
  const correo = carga.email?.toLowerCase();
  if (!correo || !correosAdmin(env).includes(correo)) return null;
  return correo;
}

/** Middleware para /admin y /api/admin/*. */
export const soloAdmin: MiddlewareHandler<Contexto> = async (c, next) => {
  let correo: string | null = null;

  if (c.env.ENTORNO === 'desarrollo' && c.env.ADMIN_DEV_CORREO) {
    // Solo en `wrangler dev` con .dev.vars. Nunca declares ENTORNO en wrangler.toml.
    correo = c.env.ADMIN_DEV_CORREO.toLowerCase();
  } else {
    const jwt = c.req.header('Cf-Access-Jwt-Assertion') ?? leerCookie(c.req.header('Cookie'), 'CF_Authorization');
    correo = await verificarAcceso(c.env, jwt);
  }

  if (!correo) {
    const ruta = new URL(c.req.url).pathname;
    return ruta.startsWith('/api/') ? c.json({ error: 'no_autorizado' }, 401) : c.text('No autorizado', 401);
  }

  // Las acciones que cambian algo exigen JSON desde el propio sitio (corta formularios falsos de otros sitios).
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const tipo = c.req.header('Content-Type') ?? '';
    const origen = c.req.header('Origin');
    if (!tipo.startsWith('application/json') || (origen !== undefined && origen !== c.env.ORIGEN && c.env.ENTORNO !== 'desarrollo')) {
      return c.json({ error: 'solicitud_no_valida' }, 400);
    }
  }

  c.set('admin', correo);
  await next();
  return undefined;
};
