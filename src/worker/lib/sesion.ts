// Cookies firmadas (HMAC-SHA256) de vida corta para el inicio de sesión con Google: no guardan nada en la base.
//   ik_oauth    → state, verificador PKCE y nonce mientras la persona está en Google (10 min)
//   ik_registro → correo verificado por Google y nombre, mientras completa sus datos de consultorio (30 min)
// HttpOnly (el JS del sitio no las lee), Secure, SameSite=Lax (Google regresa con una navegación normal) y Path=/api.

import { base64url, base64urlABytes } from './cripto';

export const COOKIE_OAUTH = 'ik_oauth';
export const COOKIE_REGISTRO = 'ik_registro';

async function llave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** `datos` debe traer `exp` (segundos Unix). */
export async function firmar(secreto: string, datos: { exp: number } & Record<string, unknown>): Promise<string> {
  const carga = base64url(new TextEncoder().encode(JSON.stringify(datos)));
  const firma = await crypto.subtle.sign('HMAC', await llave(secreto), new TextEncoder().encode(carga));
  return `${carga}.${base64url(new Uint8Array(firma))}`;
}

/** Datos si la firma es válida y no venció; null si no. Nunca lanza. */
export async function verificarFirma<T extends { exp: number }>(secreto: string, valor: string | undefined): Promise<T | null> {
  if (!valor || valor.length > 4096) return null;
  const [carga, firma, ...resto] = valor.split('.');
  if (!carga || !firma || resto.length) return null;
  try {
    const valida = await crypto.subtle.verify('HMAC', await llave(secreto), base64urlABytes(firma), new TextEncoder().encode(carga));
    if (!valida) return null;
    const datos = JSON.parse(new TextDecoder().decode(base64urlABytes(carga))) as T;
    if (typeof datos.exp !== 'number' || datos.exp <= Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch {
    return null;
  }
}

export function cookieSesion(nombre: string, valor: string, segundos: number): string {
  return `${nombre}=${valor}; Max-Age=${segundos}; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

export function borrarCookie(nombre: string): string {
  return `${nombre}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

export function leerCookie(cookies: string | undefined, nombre: string): string | undefined {
  if (!cookies) return undefined;
  for (const parte of cookies.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return resto.join('=');
  }
  return undefined;
}

/** Comparación en tiempo constante de dos textos cortos (state de OAuth). */
export function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}
