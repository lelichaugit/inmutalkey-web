// La promesa de la marca, verificada: ninguna tabla guarda IP ni user-agent (ni por nombre de columna ni por
// contenido) y los registros del Worker no llevan datos personales ni tokens.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearBanco, leadValido, migraciones, tokenDe, TURNSTILE_BUENO, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

const IP = '203.0.113.77';
const UA = 'NavegadorDePrueba/9.9 (Rastreable)';
const NOMBRES_PROHIBIDOS = /(^|_)(ip|ips|ip_hash|user_agent|useragent|ua|agente|navegador|huella_visitante|visitante|fingerprint|cookie|sesion)(_|$)/i;

async function tablas(): Promise<string[]> {
  const { results } = await banco.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'")
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

describe('privacidad del esquema y de los datos', () => {
  it('ninguna columna de ninguna tabla se llama como IP, user-agent o identificador de visitante', async () => {
    const lista = await tablas();
    expect(lista.sort()).toEqual(
      ['confirmaciones', 'descargas', 'eventos_diarios', 'fundadores_config', 'leads', 'solicitudes_arco', 'testimonios', 'versiones'].sort(),
    );
    for (const tabla of lista) {
      const { results } = await banco.db.prepare(`PRAGMA table_info(${tabla})`).all<{ name: string }>();
      for (const { name } of results) expect(name, `${tabla}.${name}`).not.toMatch(NOMBRES_PROHIBIDOS);
    }
  });

  it('las migraciones no contienen DROP TABLE', () => {
    for (const { nombre, sql } of migraciones()) expect(sql, nombre).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it('tras un recorrido completo, la IP y el user-agent no aparecen en ningún valor guardado', async () => {
    const encabezados = { 'CF-Connecting-IP': IP, 'User-Agent': UA };
    await banco.json('/api/leads', leadValido(), { headers: encabezados });
    const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
    await banco.json('/api/confirmar', { token }, { headers: encabezados });
    await banco.json('/api/eventos', { evento: 'pagina_vista', utm_source: 'tarjeta' }, { headers: encabezados });
    await banco.json('/api/arco', { correo: 'x@ejemplo.mx', tipo: 'acceso', turnstile: TURNSTILE_BUENO }, { headers: encabezados });

    for (const tabla of await tablas()) {
      const { results } = await banco.db.prepare(`SELECT * FROM ${tabla}`).all();
      const volcado = JSON.stringify(results);
      expect(volcado, tabla).not.toContain(IP);
      expect(volcado, tabla).not.toContain(UA);
      expect(volcado, tabla).not.toContain('Rastreable');
    }
  });

  it('los registros del Worker no contienen correo, nombre, teléfono, IP, user-agent ni tokens', async () => {
    const lineas: string[] = [];
    const captura = (...args: unknown[]) => void lineas.push(args.map(String).join(' '));
    const espiaLog = vi.spyOn(console, 'log').mockImplementation(captura);
    const espiaError = vi.spyOn(console, 'error').mockImplementation(captura);
    const espiaWarn = vi.spyOn(console, 'warn').mockImplementation(captura);
    try {
      const encabezados = { 'CF-Connecting-IP': IP, 'User-Agent': UA };
      await banco.json('/api/leads', leadValido(), { headers: encabezados });
      const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
      await banco.pedir(`/api/confirmar/${token}`, { headers: encabezados });
      await banco.json('/api/confirmar', { token }, { headers: encabezados });
      // Un error de correo tampoco filtra datos.
      const anterior = banco.env;
      banco.env = { ...anterior, EMAIL: { send: () => Promise.reject(new Error('fallo al enviar a ana.lopez@ejemplo.mx')) } };
      await banco.json('/api/leads', leadValido({ correo: 'otro.medico@ejemplo.mx' }), { headers: encabezados });
      banco.env = anterior;

      expect(lineas.length).toBeGreaterThan(0);
      const todo = lineas.join('\n');
      for (const prohibido of ['ana.lopez@ejemplo.mx', 'otro.medico@ejemplo.mx', 'Ana López', '2291525800', IP, UA, token]) {
        expect(todo, prohibido).not.toContain(prohibido);
      }
      expect(todo).toContain('/api/confirmar/:token');
    } finally {
      espiaLog.mockRestore();
      espiaError.mockRestore();
      espiaWarn.mockRestore();
    }
  });
});
