import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { crearBanco, leadValido, tokenDe, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

async function registrar(): Promise<string> {
  await banco.json('/api/leads', leadValido());
  return tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
}

describe('doble opt-in', () => {
  it('el GET del correo no confirma nada (los filtros de correo lo abren): solo redirige con el token en el fragmento', async () => {
    const token = await registrar();
    const r = await banco.pedir(`/api/confirmar/${token}`);
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toBe(`/fundadores/confirmar#t=${token}`);
    expect(await banco.db.prepare('SELECT confirmado_utc FROM leads').first('confirmado_utc')).toBeNull();
  });

  it('el POST confirma, avisa a contacto@ una sola vez y el token ya no sirve para otro lead', async () => {
    const token = await registrar();
    const r = await banco.json('/api/confirmar', { token });
    expect(r.status).toBe(200);
    expect(await banco.db.prepare('SELECT confirmado_utc FROM leads').first('confirmado_utc')).not.toBeNull();
    const avisos = banco.correos.filter((c) => c.to === 'contacto@inmutalkey.com');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.text).toContain('Dra. Ana López');

    // Segundo clic (o recarga): responde bien pero no vuelve a avisar.
    const otra = await banco.json('/api/confirmar', { token });
    expect(otra.status).toBe(200);
    expect(banco.correos.filter((c) => c.to === 'contacto@inmutalkey.com')).toHaveLength(1);

    // Y el GET ya lleva a "gracias".
    const get = await banco.pedir(`/api/confirmar/${token}`);
    expect(get.headers.get('Location')).toBe('/fundadores/gracias');
  });

  it('un token vencido no confirma (410) y el GET lo manda a la página de vencido', async () => {
    const token = await registrar();
    await banco.db.prepare("UPDATE confirmaciones SET expira_utc = '2020-01-01T00:00:00.000Z'").run();
    expect((await banco.json('/api/confirmar', { token })).status).toBe(410);
    const get = await banco.pedir(`/api/confirmar/${token}`);
    expect(get.headers.get('Location')).toBe('/fundadores/confirmar?estado=vencido');
    expect(await banco.db.prepare('SELECT confirmado_utc FROM leads').first('confirmado_utc')).toBeNull();
  });

  it('tokens inventados o mal formados → 410 / vencido', async () => {
    expect((await banco.json('/api/confirmar', { token: 'A'.repeat(43) })).status).toBe(410);
    expect((await banco.json('/api/confirmar', { token: '../../etc' })).status).toBe(410);
    expect((await banco.pedir('/api/confirmar/corto')).headers.get('Location')).toBe('/fundadores/confirmar?estado=vencido');
  });

  it('dos confirmaciones simultáneas: solo una marca el token y solo hay un aviso', async () => {
    const token = await registrar();
    const [a, b] = await Promise.all([banco.json('/api/confirmar', { token }), banco.json('/api/confirmar', { token })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(banco.correos.filter((c) => c.to === 'contacto@inmutalkey.com')).toHaveLength(1);
  });
});
