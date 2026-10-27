// Segunda llave de /admin. Cloudflare Access ya bloquea en el borde a quien no inició sesión; aquí se valida además
// el JWT que Access agrega (Cf-Access-Jwt-Assertion): firma RS256 con las llaves públicas del equipo, audiencia,
// emisor, vigencia y que el correo esté en ADMIN_CORREOS. Si alguien desactiva Access por error, /admin sigue cerrado.

import type { MiddlewareHandler } from 'hono';

import type { Contexto, Env } from '../env';
import { base64urlABytes } from './cripto';

interface LlavePublica extends JsonWebKey {
  readonly kid?: string;
}

interface CargaJwt {
  readonly aud?: string | readonly string[];
  readonly iss?: string;
  readonly exp?: number;
  readonly nbf?: number;
  readonly email?: string;
}

const TTL_LLAVES_MS = 10 * 60_000;
let cacheLlaves: { equipo: string; llaves: readonly LlavePublica[]; hasta: number } | null = null;

/** Solo para pruebas. */
export function reiniciarCacheLlaves(): void {
  cacheLlaves = null;
}

async function llavesDelEquipo(equipo: string): Promise<readonly LlavePublica[]> {
  if (cacheLlaves && cacheLlaves.equipo === equipo && cacheLlaves.hasta > Date.now()) return cacheLlaves.llaves;
  const respuesta = await fetch(`https://${equipo}/cdn-cgi/access/certs`);
  if (!respuesta.ok) throw new Error(`certs ${respuesta.status}`);
  const { keys } = (await respuesta.json()) as { keys?: LlavePublica[] };
  const llaves = keys ?? [];
  cacheLlaves = { equipo, llaves, hasta: Date.now() + TTL_LLAVES_MS };
  return llaves;
}

function decodificar<T>(parte: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlABytes(parte))) as T;
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
  const partes = jwt.split('.');
  if (partes.length !== 3) return null;
  const [h, p, f] = partes as [string, string, string];
  try {
    const cabecera = decodificar<{ alg?: string; kid?: string }>(h);
    if (cabecera.alg !== 'RS256') return null;
    const llaves = await llavesDelEquipo(env.ACCESS_EQUIPO);
    const jwk = llaves.find((k) => k.kid === cabecera.kid);
    if (!jwk) return null;
    const llave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, base64urlABytes(f), new TextEncoder().encode(`${h}.${p}`));
    if (!valida) return null;

    const carga = decodificar<CargaJwt>(p);
    const ahora = Math.floor(Date.now() / 1000);
    const audiencias = Array.isArray(carga.aud) ? carga.aud : [carga.aud];
    if (!audiencias.includes(env.ACCESS_AUD)) return null;
    if (carga.iss !== `https://${env.ACCESS_EQUIPO}`) return null;
    if (typeof carga.exp !== 'number' || carga.exp <= ahora) return null;
    if (typeof carga.nbf === 'number' && carga.nbf > ahora + 60) return null;
    const correo = carga.email?.toLowerCase();
    if (!correo || !correosAdmin(env).includes(correo)) return null;
    return correo;
  } catch {
    return null;
  }
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

function leerCookie(cookies: string | undefined, nombre: string): string | undefined {
  if (!cookies) return undefined;
  for (const parte of cookies.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return resto.join('=');
  }
  return undefined;
}
