import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { retoPkce } from '../../src/worker/lib/google';
import { cookiesDe, crearBanco, GOOGLE_CLIENTE, leadConfirmado, leadValido, ORIGEN, versionVigente, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => {
  await banco.limpiar();
  banco.google.idToken = null;
  banco.google.estado = 200;
});

/** Recorre inicio → Google (simulado) → callback y devuelve la respuesta del callback. */
async function entrarConGoogle(carga: Record<string, unknown> = {}, ajustes: { state?: string; sinCookie?: boolean; error?: string } = {}) {
  const inicio = await banco.pedir('/api/auth/google/inicio');
  expect(inicio.status).toBe(302);
  const url = new URL(inicio.headers.get('Location') ?? '');
  const oauth = cookiesDe(inicio)['ik_oauth'] ?? '';
  const nonce = url.searchParams.get('nonce') ?? '';
  banco.google.idToken = await banco.idTokenGoogle({ email: 'luis.herrera@gmail.com', nonce, ...carga });
  const consulta = new URLSearchParams({ state: ajustes.state ?? url.searchParams.get('state') ?? '', code: 'codigo-de-google' });
  if (ajustes.error) consulta.set('error', ajustes.error);
  const callback = await banco.pedir(`/api/auth/google/callback?${consulta}`, {
    headers: ajustes.sinCookie ? {} : { Cookie: `ik_oauth=${oauth}` },
  });
  return { inicio, url, callback };
}

describe('inicio con Google', () => {
  it('manda a Google con OpenID básico, PKCE S256, state, nonce y cookie firmada HttpOnly', async () => {
    const { inicio, url } = await entrarConGoogle();
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(GOOGLE_CLIENTE);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGEN}/api/auth/google/callback`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = inicio.headers.getSetCookie().find((c) => c.startsWith('ik_oauth='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api/);
  });

  it('el código se cambia con el verificador PKCE que corresponde al reto', async () => {
    const { url } = await entrarConGoogle();
    const verificador = banco.google.ultimaSolicitud?.get('code_verifier') ?? '';
    expect(await retoPkce(verificador)).toBe(url.searchParams.get('code_challenge'));
    expect(banco.google.ultimaSolicitud?.get('grant_type')).toBe('authorization_code');
  });

  it('médico nuevo: queda una cookie de registro y va a completar sus datos', async () => {
    const { callback } = await entrarConGoogle();
    expect(callback.headers.get('Location')).toBe('/fundadores?google=listo');
    const registro = cookiesDe(callback)['ik_registro'];
    expect(registro).toBeTruthy();
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM leads').first('n')).toBe(0);

    const sesion = await banco.pedir('/api/auth/sesion', { headers: { Cookie: `ik_registro=${registro}` } });
    expect(await sesion.json()).toEqual({ correo: 'luis.herrera@gmail.com', nombre: 'Dr. Luis Herrera' });
  });

  it('completar el registro con Google: usa el correo de Google, no pide Turnstile, confirma y lleva a la descarga', async () => {
    await versionVigente(banco);
    const { callback } = await entrarConGoogle();
    const registro = cookiesDe(callback)['ik_registro'];
    const r = await banco.json('/api/leads', leadValido({ correo: 'intento-de-cambiar@otro.mx', nombre: 'Dr. Luis Herrera Ruiz', turnstile: undefined }), {
      headers: { Cookie: `ik_registro=${registro}` },
    });
    expect(r.status).toBe(201);
    const cuerpo = (await r.json()) as { destino: string };
    expect(cuerpo.destino).toMatch(/^\/descarga#t=[A-Za-z0-9_-]{43}$/);
    expect(cookiesDe(r)['ik_registro']).toBe('');

    const lead = await banco.db.prepare('SELECT correo, nombre, metodo_registro, confirmado_utc, estatus FROM leads').first<Record<string, unknown>>();
    expect(lead).toMatchObject({ correo: 'luis.herrera@gmail.com', nombre: 'Dr. Luis Herrera Ruiz', metodo_registro: 'google', estatus: 'prueba' });
    expect(lead?.confirmado_utc).not.toBeNull();
    // Sin correo de confirmación al médico; sí aviso a contacto@.
    expect(banco.correos.map((c) => c.to)).toEqual(['contacto@inmutalkey.com']);
    expect(banco.correos[0]?.subject).toContain('Lead confirmado');
  });

  it('médico ya registrado que entra con Google: directo a su descarga (y queda confirmado si no lo estaba)', async () => {
    await versionVigente(banco);
    await banco.json('/api/leads', leadValido({ correo: 'luis.herrera@gmail.com' }));
    const { callback } = await entrarConGoogle();
    expect(callback.headers.get('Location')).toMatch(/^\/descarga#t=/);
    expect(await banco.db.prepare('SELECT confirmado_utc FROM leads').first('confirmado_utc')).not.toBeNull();
  });

  it('sin versión publicada todavía: va a gracias con aviso de "pronto"', async () => {
    await leadConfirmado(banco, 'luis.herrera@gmail.com');
    const { callback } = await entrarConGoogle();
    expect(callback.headers.get('Location')).toBe('/fundadores/gracias?estado=pronto');
  });

  it.each([
    ['correo no verificado por Google', { email_verified: false }],
    ['otra audiencia', { aud: 'otro-cliente.apps.googleusercontent.com' }],
    ['otro emisor', { iss: 'https://accounts.evil.example' }],
    ['nonce distinto', { nonce: 'otro-nonce' }],
    ['vencido', { exp: Math.floor(Date.now() / 1000) - 5 }],
  ])('rechaza un id_token con %s', async (_caso, carga) => {
    const { callback } = await entrarConGoogle(carga);
    expect(callback.headers.get('Location')).toBe('/fundadores?google=error');
    expect(cookiesDe(callback)['ik_registro']).toBeUndefined();
  });

  it('rechaza la vuelta sin la cookie del navegador que inició o con otro state (CSRF de OAuth)', async () => {
    expect((await entrarConGoogle({}, { sinCookie: true })).callback.headers.get('Location')).toBe('/fundadores?google=error');
    expect((await entrarConGoogle({}, { state: 'x'.repeat(43) })).callback.headers.get('Location')).toBe('/fundadores?google=error');
  });

  it('si la persona cancela en Google, vuelve con aviso de cancelado', async () => {
    const { callback } = await entrarConGoogle({}, { error: 'access_denied' });
    expect(callback.headers.get('Location')).toBe('/fundadores?google=cancelado');
  });

  it('si Google rechaza el código: error, sin cookie de registro', async () => {
    banco.google.estado = 400;
    const { callback } = await entrarConGoogle();
    expect(callback.headers.get('Location')).toBe('/fundadores?google=error');
  });

  it('una cookie de registro alterada no sirve: el formulario vuelve a pedir Turnstile y el correo escrito', async () => {
    const { callback } = await entrarConGoogle();
    const registro = cookiesDe(callback)['ik_registro'] ?? '';
    const alterada = `${registro.slice(0, -3)}${registro.endsWith('AAA') ? 'BBB' : 'AAA'}`;
    const r = await banco.json('/api/leads', leadValido({ turnstile: undefined }), { headers: { Cookie: `ik_registro=${alterada}` } });
    expect(r.status).toBe(400);
    expect((await banco.pedir('/api/auth/sesion', { headers: { Cookie: `ik_registro=${alterada}` } })).status).toBe(204);
  });

  it('"usar otro correo" borra la cookie de registro', async () => {
    const r = await banco.pedir('/api/auth/salir', { method: 'POST' });
    expect(r.status).toBe(204);
    expect(cookiesDe(r)['ik_registro']).toBe('');
  });

  it('sin configurar Google: el botón lleva a un aviso, sin salir del sitio', async () => {
    const anterior = banco.env;
    const { GOOGLE_CLIENT_SECRET: _fuera, ...sinGoogle } = anterior;
    banco.env = sinGoogle;
    const r = await banco.pedir('/api/auth/google/inicio');
    banco.env = anterior;
    expect(r.headers.get('Location')).toBe('/fundadores?google=no-disponible');
  });
});
