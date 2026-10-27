import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EVENTOS_FIJOS, PREFIJO_FAQ } from '../../src/compartido/eventos';
import { EVENTOS } from '../../src/compartido/eventos-validos';
import { ESTATUS_QUE_OCUPAN_CUPO } from '../../src/compartido/leads';
import { PREGUNTAS } from '../../src/data/faq';
import { crearBanco, leadConfirmado, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

describe('GET /api/fundadores/cupo', () => {
  it('sin total definido: {total: 0, restantes: 0}', async () => {
    const r = await banco.pedir('/api/fundadores/cupo');
    expect(await r.json()).toEqual({ total: 0, restantes: 0 });
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('total menos los leads en prueba o cliente; nuevo, contactado y descartado no cuentan; nunca negativo', async () => {
    expect(ESTATUS_QUE_OCUPAN_CUPO).toEqual(['prueba', 'cliente']);
    await banco.db.prepare('UPDATE fundadores_config SET total_cupos = 10 WHERE id = 1').run();
    const estatus = ['nuevo', 'contactado', 'prueba', 'prueba', 'cliente', 'descartado'];
    for (const [i, e] of estatus.entries()) {
      const id = await leadConfirmado(banco, `medico${i}@ejemplo.mx`);
      await banco.db.prepare('UPDATE leads SET estatus = ?1 WHERE id = ?2').bind(e, id).run();
    }
    expect(await (await banco.pedir('/api/fundadores/cupo')).json()).toEqual({ total: 10, restantes: 7 });

    await banco.db.prepare('UPDATE fundadores_config SET total_cupos = 2 WHERE id = 1').run();
    expect(await (await banco.pedir('/api/fundadores/cupo')).json()).toEqual({ total: 2, restantes: 0 });
  });
});

describe('POST /api/eventos', () => {
  const contador = (evento: string, fuente = 'directo') =>
    banco.db.prepare('SELECT SUM(contador) AS n FROM eventos_diarios WHERE evento = ?1 AND utm_source = ?2').bind(evento, fuente).first<number>('n');

  it('suma un evento válido al agregado del día (UPSERT) y responde 204', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await banco.json('/api/eventos', { evento: 'pagina_vista', utm_source: 'tarjeta' });
      expect(r.status).toBe(204);
    }
    expect(await contador('pagina_vista', 'tarjeta')).toBe(3);
    const filas = await banco.db.prepare('SELECT * FROM eventos_diarios').all();
    expect(filas.results).toHaveLength(1);
    expect(Object.keys(filas.results[0] ?? {}).sort()).toEqual(['contador', 'evento', 'fecha', 'utm_source']);
  });

  it('descarta en silencio lo que no está en la lista cerrada (siempre 204)', async () => {
    for (const cuerpo of [{ evento: 'hackeo' }, { evento: 'faq:no-existe' }, { evento: 42 }, 'texto', { eventos: ['x', 'y'] }]) {
      const r = await banco.json('/api/eventos', cuerpo);
      expect(r.status).toBe(204);
    }
    const sinJson = await banco.pedir('/api/eventos', { method: 'POST', body: '{roto' });
    expect(sinJson.status).toBe(204);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM eventos_diarios').first('n')).toBe(0);
  });

  it('acepta un lote, sin repetidos por solicitud; origen desconocido → otro', async () => {
    await banco.json('/api/eventos', { eventos: ['pagina_vista', 'pagina_vista', 'faq:internet', 'malo'], utm_source: 'evil' });
    expect(await contador('pagina_vista', 'otro')).toBe(1);
    expect(await contador('faq:internet', 'otro')).toBe(1);
  });

  it('204 también con el límite agotado o desde otro origen (no da información a bots)', async () => {
    banco.limite.eventos = 0;
    expect((await banco.json('/api/eventos', { evento: 'pagina_vista' })).status).toBe(204);
    banco.limite.eventos = 100;
    expect((await banco.json('/api/eventos', { evento: 'pagina_vista' }, { headers: { Origin: 'https://evil.example' } })).status).toBe(204);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM eventos_diarios').first('n')).toBe(0);
  });
});

describe('paridad de la lista de eventos entre el sitio y el Worker', () => {
  const archivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const ruta = join(dir, f);
      return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(astro|ts)$/.test(f) ? [ruta] : [];
    });

  it('cada evento que emite el sitio existe en la lista cerrada del Worker', () => {
    const emitidos = new Set<string>();
    for (const archivo of archivos(join(process.cwd(), 'src')).filter((a) => !a.includes(`${join('src', 'worker')}`))) {
      const texto = readFileSync(archivo, 'utf8');
      for (const m of texto.matchAll(/data-evento="([^"{}]+)"/g)) if (m[1]) emitidos.add(m[1]);
      for (const m of texto.matchAll(/enviarEvento\('([^']+)'/g)) if (m[1]) emitidos.add(m[1]);
    }
    expect(emitidos.size).toBeGreaterThan(0);
    for (const e of emitidos) expect(EVENTOS.has(e), `evento "${e}" no está en src/compartido/eventos.ts`).toBe(true);
  });

  it('hay un evento faq:<id> por cada pregunta frecuente, y nada más', () => {
    const faq = [...EVENTOS].filter((e) => e.startsWith(PREFIJO_FAQ));
    expect(faq.sort()).toEqual(PREGUNTAS.map((p) => `${PREFIJO_FAQ}${p.id}`).sort());
    expect(EVENTOS.size).toBe(EVENTOS_FIJOS.length + PREGUNTAS.length);
  });
});

describe('GET /api/testimonios', () => {
  it('solo devuelve los publicados con consentimiento, con el formato del contrato', async () => {
    const id = await leadConfirmado(banco);
    await banco.db.batch([
      banco.db
        .prepare(
          `INSERT INTO testimonios (lead_id, texto, nombre_publico, consentimiento_publicacion_utc, publicado, creado_utc)
           VALUES (?1, 'Por fin puedo firmar mis notas sin miedo a que se pierdan.', 'Dra. Ana L.', '2026-10-01T12:00:00.000Z', 1, '2026-10-02T00:00:00.000Z')`,
        )
        .bind(id),
      banco.db
        .prepare(
          `INSERT INTO testimonios (lead_id, texto, consentimiento_publicacion_utc, publicado, creado_utc)
           VALUES (?1, 'Texto con consentimiento pero todavía oculto.', '2026-10-01T12:00:00.000Z', 0, '2026-10-03T00:00:00.000Z')`,
        )
        .bind(id),
      banco.db
        .prepare(
          `INSERT INTO testimonios (lead_id, texto, publicado, creado_utc)
           VALUES (?1, 'Texto sin consentimiento, nunca se muestra.', 0, '2026-10-04T00:00:00.000Z')`,
        )
        .bind(id),
    ]);
    const r = await banco.pedir('/api/testimonios');
    expect(await r.json()).toEqual([
      {
        nombre: 'Dra. Ana L.',
        especialidad: 'Medicina interna',
        ciudad: 'Veracruz',
        texto: 'Por fin puedo firmar mis notas sin miedo a que se pierdan.',
        fecha: '2026-10-02',
      },
    ]);
  });

  it('la base impide publicar un testimonio sin consentimiento (CHECK)', async () => {
    const id = await leadConfirmado(banco);
    await expect(
      banco.db
        .prepare("INSERT INTO testimonios (lead_id, texto, publicado, creado_utc) VALUES (?1, 'Un texto suficientemente largo.', 1, 'x')")
        .bind(id)
        .run(),
    ).rejects.toThrow(/CHECK/);
  });
});
