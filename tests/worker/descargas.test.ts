import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { cabecerasAdmin, crearBanco, leadConfirmado, leadValido, tokenDe, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

const SHA = 'a'.repeat(64);

async function registrarVersion(vigente = true): Promise<void> {
  await banco.r2.put('instaladores/InmutalKey_0.3.0_x64-setup.exe', new Uint8Array(1024));
  const r = await banco.json(
    '/api/admin/versiones',
    { version: '0.3.0', clave_r2: 'instaladores/InmutalKey_0.3.0_x64-setup.exe', nombre_archivo: 'InmutalKey_0.3.0_x64-setup.exe', sha256: SHA.toUpperCase(), vigente },
    { headers: await cabecerasAdmin(banco) },
  );
  expect(r.status).toBe(201);
}

async function aprobar(id: number): Promise<Response> {
  return banco.json(`/api/admin/leads/${id}/aprobar-prueba`, {}, { headers: await cabecerasAdmin(banco) });
}

describe('descargas', () => {
  it('aprobar prueba: genera el enlace de 72 h, lo manda por correo con el SHA-256 y pasa el lead a prueba', async () => {
    await registrarVersion();
    const id = await leadConfirmado(banco);
    const r = await aprobar(id);
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { expira_utc: string };
    const horas = (Date.parse(cuerpo.expira_utc) - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(71.9);
    expect(horas).toBeLessThanOrEqual(72);

    const correo = banco.correos.at(-1);
    expect(correo?.to).toBe('ana.lopez@ejemplo.mx');
    expect(correo?.text).toContain(SHA);
    const lead = await banco.db.prepare('SELECT estatus, primer_contacto_utc FROM leads WHERE id = ?1').bind(id).first<Record<string, unknown>>();
    expect(lead?.estatus).toBe('prueba');
    expect(lead?.primer_contacto_utc).not.toBeNull();
  });

  it('GET no gasta el enlace; el POST redirige a una URL prefirmada de R2 de 5 minutos y solo funciona una vez', async () => {
    await registrarVersion();
    await aprobar(await leadConfirmado(banco));
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'descarga');

    const get = await banco.pedir(`/api/descarga/${token}`);
    expect(get.status).toBe(302);
    expect(get.headers.get('Location')).toBe(`/descarga#t=${token}`);
    // Un segundo GET (el filtro de correo y luego la persona) sigue funcionando.
    expect((await banco.pedir(`/api/descarga/${token}`)).status).toBe(302);

    const post = await banco.pedir('/api/descarga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    expect(post.status).toBe(303);
    const url = new URL(post.headers.get('Location') ?? '');
    expect(url.hostname).toBe('cuenta123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/inmutalkey-instaladores/instaladores/InmutalKey_0.3.0_x64-setup.exe');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="InmutalKey_0.3.0_x64-setup.exe"');
    expect(await banco.db.prepare('SELECT usado_utc FROM descargas').first('usado_utc')).not.toBeNull();

    // Uso único: ni otro POST ni el GET funcionan ya.
    const otra = await banco.json('/api/descarga', { token });
    expect(otra.status).toBe(410);
    expect((await banco.pedir(`/api/descarga/${token}`)).status).toBe(410);
  });

  it('un enlace vencido (más de 72 h) responde 410 y no se puede usar', async () => {
    await registrarVersion();
    await aprobar(await leadConfirmado(banco));
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'descarga');
    await banco.db.prepare("UPDATE descargas SET expira_utc = '2020-01-01T00:00:00.000Z'").run();
    expect((await banco.pedir(`/api/descarga/${token}`)).status).toBe(410);
    expect((await banco.json('/api/descarga', { token })).status).toBe(410);
    expect(await banco.db.prepare('SELECT usado_utc FROM descargas').first('usado_utc')).toBeNull();
  });

  it('dos descargas simultáneas con el mismo token: solo una obtiene la URL', async () => {
    await registrarVersion();
    await aprobar(await leadConfirmado(banco));
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'descarga');
    const estados = (await Promise.all([banco.json('/api/descarga', { token }), banco.json('/api/descarga', { token })])).map((r) => r.status).sort();
    expect(estados).toEqual([200, 410]);
  });

  it('sin credenciales de R2: 503 y el token se libera para reintentar', async () => {
    await registrarVersion();
    await aprobar(await leadConfirmado(banco));
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'descarga');
    const anterior = banco.env;
    const { R2_SECRET_ACCESS_KEY: _quitada, ...sinSecreto } = anterior;
    banco.env = sinSecreto;
    expect((await banco.json('/api/descarga', { token })).status).toBe(503);
    banco.env = anterior;
    const reintento = await banco.json('/api/descarga', { token });
    expect(reintento.status).toBe(200);
    expect(((await reintento.json()) as { url: string }).url).toContain('X-Amz-Signature=');
  });

  it('no se aprueba a quien no confirmó su correo, ni sin versión vigente', async () => {
    await banco.json('/api/leads', leadValido());
    const id = await banco.db.prepare('SELECT id FROM leads').first<number>('id');
    await registrarVersion();
    expect((await aprobar(id ?? 0)).status).toBe(409);

    await banco.limpiar();
    const confirmado = await leadConfirmado(banco);
    expect((await aprobar(confirmado)).status).toBe(409);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM descargas').first('n')).toBe(0);
  });

  it('si el correo falla, no queda enlace ni cambia el estatus', async () => {
    await registrarVersion();
    const id = await leadConfirmado(banco);
    const anterior = banco.env;
    banco.env = { ...anterior, EMAIL: { send: () => Promise.reject(Object.assign(new Error('x'), { code: 'E_DELIVERY_FAILED' })) } };
    expect((await aprobar(id)).status).toBe(502);
    banco.env = anterior;
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM descargas').first('n')).toBe(0);
    expect(await banco.db.prepare('SELECT estatus FROM leads').first('estatus')).toBe('nuevo');
  });

  it('GET /api/versiones publica el SHA-256 (sin la ruta interna del bucket)', async () => {
    await registrarVersion();
    const versiones = (await (await banco.pedir('/api/versiones')).json()) as Record<string, unknown>[];
    expect(versiones).toHaveLength(1);
    expect(versiones[0]).toMatchObject({ version: '0.3.0', sha256: SHA, tamano_bytes: 1024, vigente: true });
    expect(versiones[0]).not.toHaveProperty('clave_r2');
  });

  it('no registra una versión cuyo archivo no está en R2', async () => {
    const r = await banco.json(
      '/api/admin/versiones',
      { version: '9.9.9', clave_r2: 'no/existe.exe', nombre_archivo: 'existe.exe', sha256: SHA },
      { headers: await cabecerasAdmin(banco) },
    );
    expect(r.status).toBe(400);
  });
});
