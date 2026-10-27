// Utilidades de las rutas: límite de frecuencia, lectura acotada del cuerpo y caché de respuestas públicas.

import type { Context } from 'hono';

import type { Contexto } from '../env';
import { llaveLimite } from './cripto';

export type Ctx = Context<Contexto>;

/** true si la IP aún puede enviar. La IP solo se usa para derivar la llave; no se guarda ni se registra. */
export async function dentroDelLimite(c: Ctx, ambito: 'formularios' | 'eventos'): Promise<boolean> {
  const limitador = ambito === 'eventos' ? c.env.LIMITE_EVENTOS : c.env.LIMITE_FORMULARIOS;
  const llave = await llaveLimite(c.env.LIMITE_SAL, ambito, c.req.header('CF-Connecting-IP'));
  const { success } = await limitador.limit({ key: llave });
  return success;
}

export const respuestaLimite = (c: Ctx): Response =>
  c.json({ error: 'demasiadas_solicitudes' }, 429, { 'Retry-After': '60' });

/** Lee un cuerpo JSON de hasta `maxBytes`. Devuelve undefined si no es JSON válido o si es demasiado grande. */
export async function leerJson(c: Ctx, maxBytes = 16_384): Promise<unknown> {
  const declarado = Number(c.req.header('Content-Length') ?? '0');
  if (declarado > maxBytes) return undefined;
  let texto: string;
  try {
    texto = await c.req.text();
  } catch {
    return undefined;
  }
  if (texto.length > maxBytes) return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

/** Formulario urlencoded (solo el POST de descarga lo usa) o JSON. */
export async function leerCampo(c: Ctx, campo: string): Promise<string | undefined> {
  const tipo = c.req.header('Content-Type') ?? '';
  if (tipo.startsWith('application/x-www-form-urlencoded') || tipo.startsWith('multipart/form-data')) {
    const datos = await c.req.parseBody();
    const valor = datos[campo];
    return typeof valor === 'string' ? valor : undefined;
  }
  const json = await leerJson(c, 2048);
  if (typeof json === 'object' && json !== null && campo in json) {
    const valor = (json as Record<string, unknown>)[campo];
    return typeof valor === 'string' ? valor : undefined;
  }
  return undefined;
}

interface CacheBorde {
  match(peticion: Request): Promise<Response | undefined>;
  put(peticion: Request, respuesta: Response): Promise<void>;
  delete(peticion: Request): Promise<boolean>;
}

/** Caché del borde de Cloudflare (no existe en Node: ahí se responde siempre fresco). */
function cacheBorde(): CacheBorde | null {
  const global = globalThis as { caches?: { default?: CacheBorde } };
  return global.caches?.default ?? null;
}

/** Claves internas de caché (no son URLs públicas: no se pueden envenenar desde fuera). */
export const CLAVES_CACHE = {
  cupo: 'https://cache.inmutalkey.internal/api/fundadores/cupo',
  testimonios: 'https://cache.inmutalkey.internal/api/testimonios',
  versiones: 'https://cache.inmutalkey.internal/api/versiones',
} as const;

/** Responde desde caché si hay copia; si no, produce el JSON y lo guarda `segundos`. */
export async function jsonEnCache(c: Ctx, clave: string, segundos: number, producir: () => Promise<unknown>): Promise<Response> {
  const cache = cacheBorde();
  const peticion = new Request(clave);
  if (cache) {
    const guardada = await cache.match(peticion);
    if (guardada) return new Response(guardada.body, guardada);
  }
  const datos = await producir();
  const respuesta = c.json(datos, 200, { 'Cache-Control': `public, max-age=${segundos}` });
  if (cache) c.executionCtx.waitUntil(cache.put(peticion, respuesta.clone()));
  return respuesta;
}

export async function invalidarCache(clave: string): Promise<void> {
  await cacheBorde()?.delete(new Request(clave));
}
