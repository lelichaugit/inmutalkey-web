import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { iso, masDias } from '../../src/worker/lib/tiempo';
import { ejecutarRetencion } from '../../src/worker/tareas/retencion';
import { cabecerasAdmin, crearBanco, leadConfirmado, leadValido, TURNSTILE_BUENO, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

describe('POST /api/arco', () => {
  it('registra la solicitud, devuelve folio y avisa a contacto@', async () => {
    const r = await banco.json('/api/arco', { correo: 'Ana@Ejemplo.mx', tipo: 'cancelacion', detalle: 'Borren mis datos', turnstile: TURNSTILE_BUENO });
    expect(r.status).toBe(201);
    const { folio } = (await r.json()) as { folio: number };
    expect(folio).toBeGreaterThan(0);
    expect(await banco.db.prepare('SELECT correo, tipo, resuelto_utc FROM solicitudes_arco').first()).toEqual({
      correo: 'ana@ejemplo.mx',
      tipo: 'cancelacion',
      resuelto_utc: null,
    });
    const aviso = banco.correos.find((c) => c.to === 'contacto@inmutalkey.com');
    expect(aviso?.subject).toContain(`#${folio}`);
    expect(aviso?.text).toContain('20 días hábiles');
  });

  it('valida tipo, correo y Turnstile', async () => {
    expect((await banco.json('/api/arco', { correo: 'x@ejemplo.mx', tipo: 'borrar', turnstile: TURNSTILE_BUENO })).status).toBe(400);
    expect((await banco.json('/api/arco', { correo: 'nada', tipo: 'acceso', turnstile: TURNSTILE_BUENO })).status).toBe(400);
    expect((await banco.json('/api/arco', { correo: 'x@ejemplo.mx', tipo: 'acceso', turnstile: 'malo' })).status).toBe(400);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM solicitudes_arco').first('n')).toBe(0);
  });

  it('el panel la marca como resuelta', async () => {
    await banco.json('/api/arco', { correo: 'x@ejemplo.mx', tipo: 'acceso', turnstile: TURNSTILE_BUENO });
    const id = await banco.db.prepare('SELECT id FROM solicitudes_arco').first<number>('id');
    const r = await banco.json(`/api/admin/arco/${id}/resolver`, {}, { headers: await cabecerasAdmin(banco) });
    expect(r.status).toBe(200);
    expect(await banco.db.prepare('SELECT resuelto_utc FROM solicitudes_arco').first('resuelto_utc')).not.toBeNull();
  });
});

describe('retención (cron diario)', () => {
  it('borra no confirmados de más de 30 días y descartados de más de 12 meses; conserva lo demás y los eventos', async () => {
    const hoy = new Date();
    await banco.json('/api/leads', leadValido({ correo: 'viejo-sin-confirmar@ejemplo.mx' }));
    await banco.json('/api/leads', leadValido({ correo: 'reciente-sin-confirmar@ejemplo.mx' }));
    const confirmadoViejo = await leadConfirmado(banco, 'confirmado-viejo@ejemplo.mx');
    const descartadoViejo = await leadConfirmado(banco, 'descartado-viejo@ejemplo.mx');
    const descartadoReciente = await leadConfirmado(banco, 'descartado-reciente@ejemplo.mx');
    await banco.json('/api/eventos', { evento: 'pagina_vista' });

    const hace = (dias: number) => iso(masDias(hoy, -dias));
    await banco.db.batch([
      banco.db.prepare("UPDATE leads SET creado_utc = ?1 WHERE correo = 'viejo-sin-confirmar@ejemplo.mx'").bind(hace(31)),
      banco.db.prepare("UPDATE leads SET creado_utc = ?1 WHERE correo = 'reciente-sin-confirmar@ejemplo.mx'").bind(hace(29)),
      banco.db.prepare('UPDATE leads SET creado_utc = ?1 WHERE id = ?2').bind(hace(400), confirmadoViejo),
      banco.db.prepare("UPDATE leads SET estatus = 'descartado', estatus_utc = ?1 WHERE id = ?2").bind(hace(366), descartadoViejo),
      banco.db.prepare("UPDATE leads SET estatus = 'descartado', estatus_utc = ?1 WHERE id = ?2").bind(hace(200), descartadoReciente),
    ]);

    const resumen = await ejecutarRetencion(banco.env, hoy);
    expect(resumen).toMatchObject({ sinConfirmar: 1, descartados: 1 });
    const { results } = await banco.db.prepare('SELECT correo FROM leads ORDER BY correo').all<{ correo: string }>();
    expect(results.map((r) => r.correo)).toEqual([
      'confirmado-viejo@ejemplo.mx',
      'descartado-reciente@ejemplo.mx',
      'reciente-sin-confirmar@ejemplo.mx',
    ]);
    // Los tokens del lead borrado se fueron con él (ON DELETE CASCADE).
    const huerfanos = await banco.db
      .prepare('SELECT COUNT(*) AS n FROM confirmaciones WHERE lead_id NOT IN (SELECT id FROM leads)')
      .first('n');
    expect(huerfanos).toBe(0);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM eventos_diarios').first('n')).toBe(1);
  });

  it('avisa de solicitudes ARCO con 15 o más días hábiles abiertas', async () => {
    await banco.json('/api/arco', { correo: 'x@ejemplo.mx', tipo: 'acceso', turnstile: TURNSTILE_BUENO });
    banco.correos.length = 0;
    // Un martes, 4 semanas después de un martes: 20 días hábiles.
    await banco.db.prepare("UPDATE solicitudes_arco SET creado_utc = '2026-09-29T18:00:00.000Z'").run();
    const resumen = await ejecutarRetencion(banco.env, new Date('2026-10-27T18:00:00.000Z'));
    expect(resumen.arcoPorVencer).toBe(1);
    expect(banco.correos[0]?.text).toContain('20 días hábiles transcurridos');
  });
});
