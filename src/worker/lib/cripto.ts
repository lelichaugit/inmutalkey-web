// Tokens de un solo uso y huellas. El token (32 bytes aleatorios en base64url) solo viaja en el correo; en D1 se
// guarda su SHA-256 en hexadecimal, así que una copia de la base no permite confirmar ni descargar nada.

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlABytes(texto: string): Uint8Array<ArrayBuffer> {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = normal + '='.repeat((4 - (normal.length % 4)) % 4);
  const binario = atob(relleno);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function tokenNuevo(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function esTokenValido(token: string): boolean {
  return FORMATO_TOKEN.test(token);
}

export async function sha256Hex(texto: string): Promise<string> {
  const huella = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(huella), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Llave del límite de frecuencia: SHA-256(sal + ámbito + IP). La IP no sale de la memoria de la solicitud. */
export async function llaveLimite(sal: string, ambito: string, ip: string | null | undefined): Promise<string> {
  return `${ambito}:${(await sha256Hex(`${sal}|${ambito}|${ip ?? 'sin-ip'}`)).slice(0, 32)}`;
}
