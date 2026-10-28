// Verificación de JWT RS256 contra un conjunto de llaves públicas (JWKS). La usan Cloudflare Access (/admin) y el
// inicio de sesión con Google. Solo comprueba la firma y la vigencia; cada llamador revisa emisor, audiencia y lo suyo.

import { base64urlABytes } from './cripto';

interface LlavePublica extends JsonWebKey {
  readonly kid?: string;
}

const TTL_LLAVES_MS = 10 * 60_000;
const cache = new Map<string, { llaves: readonly LlavePublica[]; hasta: number }>();

/** Solo para pruebas. */
export function reiniciarCacheJwks(): void {
  cache.clear();
}

async function llaves(url: string, forzar = false): Promise<readonly LlavePublica[]> {
  const guardadas = cache.get(url);
  if (!forzar && guardadas && guardadas.hasta > Date.now()) return guardadas.llaves;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`jwks ${respuesta.status}`);
  const { keys } = (await respuesta.json()) as { keys?: LlavePublica[] };
  const lista = keys ?? [];
  cache.set(url, { llaves: lista, hasta: Date.now() + TTL_LLAVES_MS });
  return lista;
}

function decodificar<T>(parte: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlABytes(parte))) as T;
}

export interface CargaJwt {
  readonly aud?: string | readonly string[];
  readonly iss?: string;
  readonly exp?: number;
  readonly nbf?: number;
  readonly email?: string;
  readonly [clave: string]: unknown;
}

/** Devuelve la carga si la firma RS256 es válida y no venció; null en cualquier otro caso. Nunca lanza. */
export async function verificarRs256(jwt: string | undefined, urlJwks: string): Promise<CargaJwt | null> {
  if (!jwt) return null;
  const partes = jwt.split('.');
  if (partes.length !== 3) return null;
  const [h, p, f] = partes as [string, string, string];
  try {
    const cabecera = decodificar<{ alg?: string; kid?: string }>(h);
    if (cabecera.alg !== 'RS256') return null;
    let jwk = (await llaves(urlJwks)).find((k) => k.kid === cabecera.kid);
    // Rotación de llaves: si el kid es nuevo, se vuelve a pedir el JWKS una vez.
    jwk ??= (await llaves(urlJwks, true)).find((k) => k.kid === cabecera.kid);
    if (!jwk) return null;
    const llave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, base64urlABytes(f), new TextEncoder().encode(`${h}.${p}`));
    if (!valida) return null;
    const carga = decodificar<CargaJwt>(p);
    const ahora = Math.floor(Date.now() / 1000);
    if (typeof carga.exp !== 'number' || carga.exp <= ahora) return null;
    if (typeof carga.nbf === 'number' && carga.nbf > ahora + 60) return null;
    return carga;
  } catch {
    return null;
  }
}

export function incluyeAudiencia(carga: CargaJwt, audiencia: string): boolean {
  return (Array.isArray(carga.aud) ? carga.aud : [carga.aud]).includes(audiencia);
}
