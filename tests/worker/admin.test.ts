import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { celdaCsv } from '../../src/worker/rutas/admin';
import { ADMIN, cabecerasAdmin, crearBanco, leadConfirmado, leadValido, ORIGEN, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

describe('protección de /admin (segunda llave tras Cloudflare Access)', () => {
  it('sin JWT de Access: 401 en la página y en la API', async () => {
    expect((await banco.pedir('/admin')).status).toBe(401);
    expect((await banco.pedir('/api/admin/leads')).status).toBe(401);
  });

  it('con JWT válido de un correo autorizado: entra', async () => {
    const r = await banco.pedir('/api/admin/sesion', { headers: await cabecerasAdmin(banco) });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ correo: ADMIN });
    const pagina = await banco.pedir('/admin', { headers: await cabecerasAdmin(banco) });
    expect(pagina.status).toBe(200);
    expect(pagina.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    expect(pagina.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(pagina.headers.get('Cache-Control')).toBe('no-store');
  });

  it('también acepta la cookie CF_Authorization', async () => {
    const r = await banco.pedir('/api/admin/sesion', { headers: { Cookie: `otra=1; CF_Authorization=${await banco.jwt()}` } });
    expect(r.status).toBe(200);
  });

  it.each([
    ['otra audiencia', { aud: 'otra' }],
    ['otro emisor', { iss: 'https://malo.cloudflareaccess.com' }],
    ['vencido', { exp: Math.floor(Date.now() / 1000) - 10 }],
    ['correo no autorizado', { email: 'intruso@ejemplo.mx' }],
    ['llave desconocida', { kid: 'otra-llave' }],
  ])('rechaza un JWT con %s', async (_caso, cambios) => {
    const r = await banco.pedir('/api/admin/sesion', { headers: { 'Cf-Access-Jwt-Assertion': await banco.jwt(cambios) } });
    expect(r.status).toBe(401);
  });

  it('rechaza un JWT con la firma alterada', async () => {
    const jwt = await banco.jwt();
    const alterado = `${jwt.slice(0, -4)}${jwt.endsWith('AAAA') ? 'BBBB' : 'AAAA'}`;
    expect((await banco.pedir('/api/admin/sesion', { headers: { 'Cf-Access-Jwt-Assertion': alterado } })).status).toBe(401);
  });

  it('acciones que cambian algo: exigen JSON y el origen del sitio', async () => {
    const id = await leadConfirmado(banco);
    const jwt = await banco.jwt();
    const formulario = await banco.pedir(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Cf-Access-Jwt-Assertion': jwt, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'estatus=cliente',
    });
    expect(formulario.status).toBe(400);
    const ajeno = await banco.pedir(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Cf-Access-Jwt-Assertion': jwt, 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ estatus: 'cliente' }),
    });
    expect([400, 403]).toContain(ajeno.status);
    expect(await banco.db.prepare('SELECT estatus FROM leads').first('estatus')).toBe('nuevo');
  });

  it('modo desarrollo: solo con ENTORNO=desarrollo y ADMIN_DEV_CORREO', async () => {
    const anterior = banco.env;
    banco.env = { ...anterior, ADMIN_DEV_CORREO: 'dev@ejemplo.mx' };
    expect((await banco.pedir('/api/admin/sesion')).status).toBe(401);
    banco.env = { ...anterior, ENTORNO: 'desarrollo', ADMIN_DEV_CORREO: 'dev@ejemplo.mx' };
    expect((await banco.pedir('/api/admin/sesion')).status).toBe(200);
    banco.env = anterior;
  });
});

describe('gestión de leads', () => {
  it('lista con filtros y búsqueda literal', async () => {
    await leadConfirmado(banco, 'uno@ejemplo.mx');
    await banco.json('/api/leads', leadValido({ correo: 'dos@ejemplo.mx', nombre: 'Dr. Pedro 100%', utm_source: 'instagram' }));
    const h = await cabecerasAdmin(banco);
    const todos = (await (await banco.pedir('/api/admin/leads', { headers: h })).json()) as { total: number };
    expect(todos.total).toBe(2);
    const confirmados = (await (await banco.pedir('/api/admin/leads?confirmado=si', { headers: h })).json()) as { total: number };
    expect(confirmados.total).toBe(1);
    const porFuente = (await (await banco.pedir('/api/admin/leads?fuente=instagram', { headers: h })).json()) as { leads: { correo: string }[] };
    expect(porFuente.leads.map((l) => l.correo)).toEqual(['dos@ejemplo.mx']);
    const literal = (await (await banco.pedir('/api/admin/leads?q=100%25', { headers: h })).json()) as { total: number };
    expect(literal.total).toBe(1);
    const comodin = (await (await banco.pedir('/api/admin/leads?q=%25', { headers: h })).json()) as { total: number };
    expect(comodin.total).toBe(1);
  });

  it('cambiar estatus registra primer_contacto_utc una sola vez y la fecha del cambio', async () => {
    const id = await leadConfirmado(banco);
    const h = await cabecerasAdmin(banco);
    const r1 = await banco.json(`/api/admin/leads/${id}`, { estatus: 'contactado' }, { method: 'PATCH', headers: h });
    const l1 = ((await r1.json()) as { lead: Record<string, string> }).lead;
    expect(l1.estatus).toBe('contactado');
    expect(l1.primer_contacto_utc).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await banco.json(`/api/admin/leads/${id}`, { estatus: 'cliente', notas_internas: 'Pagó por transferencia' }, { method: 'PATCH', headers: h });
    const l2 = ((await r2.json()) as { lead: Record<string, string> }).lead;
    expect(l2.primer_contacto_utc).toBe(l1.primer_contacto_utc);
    expect((l2.estatus_utc ?? '') > (l1.estatus_utc ?? '')).toBe(true);
    expect(l2.notas_internas).toBe('Pagó por transferencia');

    const malo = await banco.json(`/api/admin/leads/${id}`, { estatus: 'vip' }, { method: 'PATCH', headers: h });
    expect(malo.status).toBe(400);
  });

  it('borrar un lead (cancelación ARCO) arrastra sus tokens y testimonios', async () => {
    const id = await leadConfirmado(banco);
    await banco.db
      .prepare("INSERT INTO testimonios (lead_id, texto, publicado, creado_utc) VALUES (?1, 'Un testimonio de prueba largo.', 0, 'x')")
      .bind(id)
      .run();
    const r = await banco.pedir(`/api/admin/leads/${id}`, { method: 'DELETE', headers: { ...(await cabecerasAdmin(banco)), 'Content-Type': 'application/json' } });
    expect(r.status).toBe(200);
    for (const tabla of ['leads', 'confirmaciones', 'testimonios']) {
      expect(await banco.db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first('n')).toBe(0);
    }
  });

  it('exporta CSV con BOM, todas las columnas y celdas a prueba de fórmulas', async () => {
    await banco.json('/api/leads', leadValido({ nombre: '=HYPERLINK("http://x")', especialidad: 'Pediatría, neonatos' }));
    const r = await banco.pedir('/api/admin/leads.csv', { headers: await cabecerasAdmin(banco) });
    expect(r.headers.get('Content-Type')).toContain('text/csv');
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(texto).toContain('"Pediatría, neonatos"');
    expect(texto.split('\r\n')[0]).toContain('primer_contacto_utc');
  });

  it('celdaCsv neutraliza fórmulas', () => {
    expect(celdaCsv('+52 229')).toBe("'+52 229");
    expect(celdaCsv('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv('normal')).toBe('normal');
  });
});

describe('métricas', () => {
  it('embudo por utm_source: visitas → iniciados → enviados → confirmados → prueba → cliente', async () => {
    for (let i = 0; i < 5; i++) await banco.json('/api/eventos', { evento: 'pagina_vista', utm_source: 'tarjeta' });
    await banco.json('/api/eventos', { evento: 'formulario_iniciado', utm_source: 'tarjeta' });
    await banco.json('/api/eventos', { evento: 'formulario_iniciado', utm_source: 'tarjeta' });
    await banco.json('/api/eventos', { evento: 'faq:internet' });
    await banco.json('/api/eventos', { evento: 'whatsapp_fundadores' });
    const a = await leadConfirmado(banco, 'a@ejemplo.mx');
    await banco.json('/api/leads', leadValido({ correo: 'b@ejemplo.mx' }));
    const h = await cabecerasAdmin(banco);
    await banco.json(`/api/admin/leads/${a}`, { estatus: 'cliente' }, { method: 'PATCH', headers: h });

    const m = (await (await banco.pedir('/api/admin/metricas', { headers: h })).json()) as {
      embudo: Record<string, number | string>[];
      faq: { id: string; aperturas: number }[];
      whatsapp: { fundadores: number };
      primerContacto: { leads: number; horasPromedio: number | null };
      visitasWebAnalytics: number | null;
    };
    expect(m.embudo).toContainEqual({ fuente: 'tarjeta', visitas: 5, iniciados: 2, enviados: 2, confirmados: 1, prueba: 1, cliente: 1 });
    expect(m.faq).toEqual([{ id: 'internet', pregunta: '¿Necesito internet?', aperturas: 1 }]);
    expect(m.whatsapp.fundadores).toBe(1);
    expect(m.primerContacto.leads).toBe(1);
    expect(m.primerContacto.horasPromedio).not.toBeNull();
    expect(m.visitasWebAnalytics).toBeNull();
  });

  it('configurar el total de cupos invalida y cambia el cupo público', async () => {
    const h = await cabecerasAdmin(banco);
    const r = await banco.json('/api/admin/config', { total_cupos: 50 }, { method: 'PUT', headers: h });
    expect(r.status).toBe(200);
    expect(await (await banco.pedir('/api/fundadores/cupo')).json()).toEqual({ total: 50, restantes: 50 });
    expect((await banco.json('/api/admin/config', { total_cupos: -1 }, { method: 'PUT', headers: h })).status).toBe(400);
  });
});

describe('testimonios desde el panel', () => {
  it('no se publica sin la fecha del consentimiento; con ella sí y aparece en la API pública', async () => {
    const id = await leadConfirmado(banco);
    const h = await cabecerasAdmin(banco);
    const sinConsentimiento = await banco.json('/api/admin/testimonios', { lead_id: id, texto: 'Me ahorra tiempo en cada consulta del día.' }, { headers: h });
    expect(sinConsentimiento.status).toBe(201);
    const t1 = ((await sinConsentimiento.json()) as { testimonio: { id: number } }).testimonio.id;
    expect((await banco.json(`/api/admin/testimonios/${t1}`, { publicado: true }, { method: 'PATCH', headers: h })).status).toBe(409);

    const conConsentimiento = await banco.json(
      '/api/admin/testimonios',
      { lead_id: id, texto: 'Las notas selladas me dan tranquilidad.', nombre_publico: 'Dra. Ana L.', consentimiento_fecha: '2026-10-20' },
      { headers: h },
    );
    const t2 = ((await conConsentimiento.json()) as { testimonio: { id: number } }).testimonio.id;
    expect((await banco.json(`/api/admin/testimonios/${t2}`, { publicado: true }, { method: 'PATCH', headers: h })).status).toBe(200);
    const publicos = (await (await banco.pedir('/api/testimonios')).json()) as { nombre: string }[];
    expect(publicos.map((p) => p.nombre)).toEqual(['Dra. Ana L.']);
  });
});

describe('orígenes', () => {
  it('OPTIONS desde el sitio recibe preflight; desde otro origen, nada', async () => {
    const propio = await banco.pedir('/api/leads', { method: 'OPTIONS', headers: { Origin: ORIGEN } });
    expect(propio.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN);
    const ajeno = await banco.pedir('/api/leads', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(ajeno.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
