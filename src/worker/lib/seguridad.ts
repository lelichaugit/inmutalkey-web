// Encabezados de seguridad y CORS para todo lo que responde el Worker (las páginas estáticas los reciben de
// public/_headers; aquí se repiten para que /api y /admin queden igual de cerrados).

import type { MiddlewareHandler } from 'hono';

import type { Contexto, Env } from '../env';

export const HSTS = 'max-age=63072000; includeSubDomains; preload';

/** La API no carga nada: ni scripts, ni estilos, ni marcos. */
export const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

/** Panel /admin: solo recursos propios (el JS y el CSS los compila Astro a /_astro). */
export const CSP_ADMIN =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

const COMUNES: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': HSTS,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function origenesPermitidos(env: Env): readonly string[] {
  const extra = (env.ORIGENES_EXTRA ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [env.ORIGEN, ...extra];
}

/** Aplica los encabezados comunes y la CSP que toque. No pisa un Cache-Control que la ruta ya haya puesto. */
export const encabezados: MiddlewareHandler<Contexto> = async (c, next) => {
  await next();
  const ruta = new URL(c.req.url).pathname;
  const h = c.res.headers;
  // Las respuestas del binding ASSETS son inmutables: se clonan antes de tocarlas.
  if (!encabezadosEditables(h)) c.res = new Response(c.res.body, c.res);
  for (const [nombre, valor] of Object.entries(COMUNES)) c.res.headers.set(nombre, valor);
  const esAdmin = ruta === '/admin' || ruta.startsWith('/admin/');
  if (!c.res.headers.has('Content-Security-Policy') || esAdmin) {
    c.res.headers.set('Content-Security-Policy', esAdmin ? CSP_ADMIN : CSP_API);
  }
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
  if (esAdmin || ruta.startsWith('/api/admin')) {
    c.res.headers.set('Cache-Control', 'no-store');
    c.res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
};

function encabezadosEditables(h: Headers): boolean {
  try {
    h.set('X-Prueba-Editable', '1');
    h.delete('X-Prueba-Editable');
    return true;
  } catch {
    return false;
  }
}

/**
 * CORS: solo inmutalkey.com (y los orígenes de desarrollo declarados). Una petición desde otro origen recibe 403 sin
 * más detalle; las que no traen Origin (curl, monitores) pasan y quedan sujetas a Turnstile y al límite de frecuencia.
 * /api/eventos nunca da información: siempre 204.
 */
export const cors: MiddlewareHandler<Contexto> = async (c, next) => {
  const origen = c.req.header('Origin');
  const permitido = origen === undefined || origenesPermitidos(c.env).includes(origen);
  const ruta = new URL(c.req.url).pathname;

  if (c.req.method === 'OPTIONS') {
    if (!permitido || origen === undefined) return c.body(null, 204);
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
  }

  if (!permitido) {
    if (ruta === '/api/eventos') return c.body(null, 204);
    return c.json({ error: 'origen_no_permitido' }, 403);
  }

  await next();
  if (origen !== undefined) {
    c.res.headers.set('Access-Control-Allow-Origin', origen);
    c.res.headers.append('Vary', 'Origin');
  }
  return undefined;
};
