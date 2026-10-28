// Inicio con Google para el registro de Fundadores.
//   GET  /api/auth/google/inicio    → 302 a Google (state, PKCE S256, nonce en cookie firmada de 10 min)
//   GET  /api/auth/google/callback  → valida y:
//        · médico ya registrado → confirmado → 302 /descarga#t=… (o /fundadores/gracias)
//        · médico nuevo         → cookie ik_registro (30 min) → 302 /fundadores?google=listo para completar sus datos
//        · cancelado o error    → 302 /fundadores?google=cancelado | error | no-disponible
//   GET  /api/auth/sesion           → {correo, nombre} del registro con Google en curso, o 204
//   POST /api/auth/salir            → borra la cookie de registro (usar otro correo)

import { Hono } from 'hono';

import type { Contexto, Env } from '../env';
import { tokenNuevo } from '../lib/cripto';
import { googleConfigurado, identidadDesdeCodigo, urlAutorizacion, type IdentidadGoogle } from '../lib/google';
import { dentroDelLimite, respuestaLimite } from '../lib/http';
import {
  borrarCookie,
  COOKIE_OAUTH,
  COOKIE_REGISTRO,
  cookieSesion,
  firmar,
  igualSeguro,
  leerCookie,
  verificarFirma,
} from '../lib/sesion';
import { destinoTrasVerificar, marcarConfirmado } from './flujo';

export const SEGUNDOS_OAUTH = 600;
export const SEGUNDOS_REGISTRO = 1800;

interface EstadoOauth {
  readonly exp: number;
  readonly state: string;
  readonly verificador: string;
  readonly nonce: string;
}

export interface RegistroGoogle extends IdentidadGoogle {
  readonly exp: number;
}

const ahoraSeg = (): number => Math.floor(Date.now() / 1000);

/** Registro con Google en curso (cookie firmada), o null. */
export async function sesionGoogle(env: Env, cookies: string | undefined): Promise<RegistroGoogle | null> {
  if (!env.SESION_SECRETO) return null;
  return verificarFirma<RegistroGoogle>(env.SESION_SECRETO, leerCookie(cookies, COOKIE_REGISTRO));
}

export const google = new Hono<Contexto>();

google.get('/google/inicio', async (c) => {
  if (!googleConfigurado(c.env) || !c.env.SESION_SECRETO) return c.redirect('/fundadores?google=no-disponible', 302);
  if (!(await dentroDelLimite(c, 'formularios'))) return c.redirect('/fundadores?google=espera', 302);
  const estado: EstadoOauth = { exp: ahoraSeg() + SEGUNDOS_OAUTH, state: tokenNuevo(), verificador: tokenNuevo(), nonce: tokenNuevo() };
  const destino = await urlAutorizacion(c.env, estado);
  c.header('Set-Cookie', cookieSesion(COOKIE_OAUTH, await firmar(c.env.SESION_SECRETO, { ...estado }), SEGUNDOS_OAUTH));
  return c.redirect(destino, 302);
});

google.get('/google/callback', async (c) => {
  c.header('Set-Cookie', borrarCookie(COOKIE_OAUTH), { append: true });
  if (!googleConfigurado(c.env) || !c.env.SESION_SECRETO) return c.redirect('/fundadores?google=no-disponible', 302);

  const estado = await verificarFirma<EstadoOauth>(c.env.SESION_SECRETO, leerCookie(c.req.header('Cookie'), COOKIE_OAUTH));
  const state = c.req.query('state') ?? '';
  // Sin cookie válida o con otro state: la vuelta no la inició este navegador (o tardó más de 10 min).
  if (!estado || !igualSeguro(estado.state, state)) return c.redirect('/fundadores?google=error', 302);
  if (c.req.query('error')) return c.redirect('/fundadores?google=cancelado', 302);
  const codigo = c.req.query('code');
  if (!codigo || codigo.length > 2048) return c.redirect('/fundadores?google=error', 302);

  const identidad = await identidadDesdeCodigo(c.env, codigo, estado.verificador, estado.nonce);
  if (!identidad) return c.redirect('/fundadores?google=error', 302);

  const lead = await c.env.DB.prepare('SELECT id, estatus FROM leads WHERE correo = ?1')
    .bind(identidad.correo)
    .first<{ id: number; estatus: string }>();
  if (lead) {
    // Ya registrado: Google prueba que el correo es suyo. Directo a su descarga.
    await marcarConfirmado(c, lead.id, 'google');
    return c.redirect(await destinoTrasVerificar(c, lead.id), 302);
  }

  const registro: RegistroGoogle = { exp: ahoraSeg() + SEGUNDOS_REGISTRO, ...identidad };
  c.header('Set-Cookie', cookieSesion(COOKIE_REGISTRO, await firmar(c.env.SESION_SECRETO, { ...registro }), SEGUNDOS_REGISTRO), {
    append: true,
  });
  return c.redirect('/fundadores?google=listo', 302);
});

google.get('/sesion', async (c) => {
  const sesion = await sesionGoogle(c.env, c.req.header('Cookie'));
  if (!sesion) return c.body(null, 204);
  return c.json({ correo: sesion.correo, nombre: sesion.nombre });
});

google.post('/salir', async (c) => {
  if (!(await dentroDelLimite(c, 'eventos'))) return respuestaLimite(c);
  c.header('Set-Cookie', borrarCookie(COOKIE_REGISTRO));
  return c.body(null, 204);
});
