// Inicio de sesión con Google (OpenID Connect, flujo de código con PKCE S256, state y nonce). Solo se piden los
// alcances básicos `openid email profile`: Google entrega el correo verificado y el nombre. No se guarda el
// identificador de Google ni la foto; la contraseña nunca pasa por aquí.

import type { Env } from '../env';
import { base64url } from './cripto';
import { incluyeAudiencia, verificarRs256 } from './jwt';
import { registrarError } from './registro';

export const URL_AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';
export const URL_TOKEN = 'https://oauth2.googleapis.com/token';
export const URL_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISORES = ['https://accounts.google.com', 'accounts.google.com'];

export const rutaRetorno = (env: Env): string => `${env.ORIGEN}/api/auth/google/callback`;

export function googleConfigurado(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESION_SECRETO);
}

export async function retoPkce(verificador: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))));
}

export async function urlAutorizacion(env: Env, datos: { state: string; verificador: string; nonce: string }): Promise<string> {
  const url = new URL(URL_AUTORIZACION);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: rutaRetorno(env),
    response_type: 'code',
    scope: 'openid email profile',
    state: datos.state,
    nonce: datos.nonce,
    code_challenge: await retoPkce(datos.verificador),
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
  }).toString();
  return url.href;
}

export interface IdentidadGoogle {
  readonly correo: string;
  readonly nombre: string;
}

/** Cambia el código por el id_token y lo valida. Devuelve la identidad o null (sin lanzar). */
export async function identidadDesdeCodigo(env: Env, codigo: string, verificador: string, nonce: string): Promise<IdentidadGoogle | null> {
  try {
    const respuesta = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: codigo,
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: rutaRetorno(env),
        grant_type: 'authorization_code',
        code_verifier: verificador,
      }),
    });
    if (!respuesta.ok) {
      registrarError('google_token', new Error(`token ${respuesta.status}`));
      return null;
    }
    const { id_token: idToken } = (await respuesta.json()) as { id_token?: string };
    return await validarIdToken(env, idToken, nonce);
  } catch (error) {
    registrarError('google_token', error);
    return null;
  }
}

export async function validarIdToken(env: Env, idToken: string | undefined, nonce: string): Promise<IdentidadGoogle | null> {
  // Aunque llegó directo de Google por TLS, se verifica también la firma con sus llaves públicas.
  const carga = await verificarRs256(idToken, URL_JWKS);
  if (!carga || !env.GOOGLE_CLIENT_ID) return null;
  if (!incluyeAudiencia(carga, env.GOOGLE_CLIENT_ID)) return null;
  if (typeof carga.iss !== 'string' || !EMISORES.includes(carga.iss)) return null;
  if (carga['nonce'] !== nonce) return null;
  // Solo correos que Google ya verificó (así se omite el correo de confirmación).
  if (carga['email_verified'] !== true) return null;
  const correo = typeof carga.email === 'string' ? carga.email.trim().toLowerCase() : '';
  if (!correo || correo.length > 160 || !correo.includes('@')) return null;
  const nombre = [carga['name'], [carga['given_name'], carga['family_name']].filter(Boolean).join(' ')]
    .find((n): n is string => typeof n === 'string' && n.trim().length >= 3)
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return { correo, nombre: nombre ?? '' };
}
