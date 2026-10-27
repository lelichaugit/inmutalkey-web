// Registro mínimo: método, patrón de ruta (sin tokens ni query string), estado y duración. Nunca cuerpos, correos,
// nombres, IP ni user-agent. Hay una prueba que lo verifica (tests/worker/privacidad.test.ts).

import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

import type { Contexto } from '../env';

export interface LineaRegistro {
  readonly metodo: string;
  readonly ruta: string;
  readonly estado: number;
  readonly ms: number;
}

export const registro: MiddlewareHandler<Contexto> = async (c, next) => {
  const inicio = Date.now();
  await next();
  const linea: LineaRegistro = {
    metodo: c.req.method,
    // Patrón declarado (/api/descarga/:token), nunca la URL real.
    ruta: rutaSegura(routePath(c, -1)),
    estado: c.res.status,
    ms: Date.now() - inicio,
  };
  console.log(JSON.stringify(linea));
};

function rutaSegura(patron: string | undefined): string {
  if (!patron || patron === '*' || patron === '/*') return '(sin ruta)';
  return patron;
}

/** Error sin datos: nombre y código (de D1 o del proveedor de correo), nunca el contenido de la solicitud. */
export function registrarError(donde: string, error: unknown): void {
  const nombre = error instanceof Error ? error.name : typeof error;
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const mensaje = error instanceof Error ? error.message.slice(0, 160).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]') : '';
  console.error(JSON.stringify({ error: donde, nombre, codigo, mensaje }));
}
