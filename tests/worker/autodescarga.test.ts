import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emitirDescarga, MAX_ENLACES_POR_DIA } from '../../src/worker/lib/descargas';
import { crearBanco, leadConfirmado, leadValido, tokenDe, TURNSTILE_BUENO, versionVigente, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

describe('descarga directa tras confirmar el correo', () => {
  it('confirmar lleva a la descarga guiada y pone el lead en prueba (sin tocar primer contacto ni el cupo)', async () => {
    await versionVigente(banco);
    await banco.db.prepare('UPDATE fundadores_config SET total_cupos = 10 WHERE id = 1').run();
    await banco.json('/api/leads', leadValido());
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
    const r = await banco.json('/api/confirmar', { token });
    const { destino } = (await r.json()) as { destino: string };
    expect(destino).toMatch(/^\/descarga#t=[A-Za-z0-9_-]{43}$/);
    expect(await banco.db.prepare('SELECT estatus, primer_contacto_utc FROM leads').first()).toEqual({ estatus: 'prueba', primer_contacto_utc: null });
    expect(await (await banco.pedir('/api/fundadores/cupo')).json()).toEqual({ total: 10, restantes: 10 });

    // El token del destino es una descarga válida de un solo uso.
    const descarga = destino.split('#t=')[1] ?? '';
    const post = await banco.json('/api/descarga', { token: descarga });
    expect(post.status).toBe(200);
  });

  it('sin versión publicada: confirmar lleva a gracias con aviso de "pronto"', async () => {
    await banco.json('/api/leads', leadValido());
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
    const { destino } = (await (await banco.json('/api/confirmar', { token })).json()) as { destino: string };
    expect(destino).toBe('/fundadores/gracias?estado=pronto');
  });

  it('un lead descartado no recibe descarga automática', async () => {
    await versionVigente(banco);
    const id = await leadConfirmado(banco);
    await banco.db.prepare("UPDATE leads SET estatus = 'descartado' WHERE id = ?1").bind(id).run();
    expect(await emitirDescarga(banco.env, id)).toBe('no_disponible');
  });

  it(`como máximo ${MAX_ENLACES_POR_DIA} enlaces por médico en 24 horas`, async () => {
    await versionVigente(banco);
    const id = await leadConfirmado(banco); // ya emitió 1
    for (let i = 1; i < MAX_ENLACES_POR_DIA; i++) expect(typeof (await emitirDescarga(banco.env, id))).toBe('object');
    expect(await emitirDescarga(banco.env, id)).toBe('limite');
  });
});

describe('volver por otro enlace', () => {
  it('un médico ya confirmado que vuelve a llenar el formulario recibe un enlace de descarga por correo (no más de uno cada 10 min)', async () => {
    await versionVigente(banco);
    await leadConfirmado(banco);
    // El enlace automático de la confirmación cuenta como reciente.
    await banco.db.prepare("UPDATE descargas SET creado_utc = '2020-01-01T00:00:00.000Z'").run();
    banco.correos.length = 0;

    const r = await banco.json('/api/leads', leadValido());
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });
    expect(banco.correos).toHaveLength(1);
    expect(banco.correos[0]?.subject).toBe('Tu instalador de InmutalKey');
    expect(banco.correos[0]?.text).toContain('b'.repeat(64));
    tokenDe(banco.correos[0]?.text ?? '', 'descarga');

    await banco.json('/api/leads', leadValido());
    expect(banco.correos).toHaveLength(1);
  });

  it('POST /api/descarga/reenviar: 202 siempre; solo manda correo a un lead confirmado', async () => {
    await versionVigente(banco);
    await leadConfirmado(banco);
    await banco.db.prepare("UPDATE descargas SET creado_utc = '2020-01-01T00:00:00.000Z'").run();
    banco.correos.length = 0;

    const desconocido = await banco.json('/api/descarga/reenviar', { correo: 'nadie@ejemplo.mx', turnstile: TURNSTILE_BUENO });
    expect(desconocido.status).toBe(202);
    expect(banco.correos).toHaveLength(0);

    const conocido = await banco.json('/api/descarga/reenviar', { correo: 'ANA.LOPEZ@ejemplo.mx', turnstile: TURNSTILE_BUENO });
    expect(conocido.status).toBe(202);
    expect(banco.correos).toHaveLength(1);

    expect((await banco.json('/api/descarga/reenviar', { correo: 'ana.lopez@ejemplo.mx', turnstile: 'malo' })).status).toBe(400);
  });

  it('POST /api/descarga/a-mi-correo: manda el mismo enlace (sin gastarlo) y muestra el correo enmascarado', async () => {
    await versionVigente(banco);
    await banco.json('/api/leads', leadValido());
    const confirmar = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
    const { destino } = (await (await banco.json('/api/confirmar', { token: confirmar })).json()) as { destino: string };
    const token = destino.split('#t=')[1] ?? '';

    const r = await banco.json('/api/descarga/a-mi-correo', { token });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, correo: 'an•••@ejemplo.mx' });
    expect(tokenDe(banco.correos.at(-1)?.text ?? '', 'descarga')).toBe(token);
    // Sigue sirviendo para descargar.
    expect((await banco.json('/api/descarga', { token })).status).toBe(200);
    // Ya usado: no se reenvía.
    expect((await banco.json('/api/descarga/a-mi-correo', { token })).status).toBe(410);
  });
});
