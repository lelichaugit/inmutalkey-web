import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { crearBanco, leadValido, ORIGEN, tokenDe, type Banco } from './ayudante';

let banco: Banco;
beforeAll(async () => {
  banco = await crearBanco();
});
afterAll(async () => banco.cerrar());
beforeEach(async () => banco.limpiar());

describe('POST /api/leads', () => {
  it('guarda un lead válido, responde 201 y manda la confirmación (en la base solo queda el hash del token)', async () => {
    const r = await banco.json('/api/leads', leadValido({ correo: '  Ana.Lopez@Ejemplo.MX ' }), { headers: { Origin: ORIGEN } });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });

    const lead = await banco.db.prepare('SELECT * FROM leads').first<Record<string, unknown>>();
    expect(lead).toMatchObject({
      correo: 'ana.lopez@ejemplo.mx',
      telefono: '2291525800',
      estatus: 'nuevo',
      utm_source: 'tarjeta',
      version_aviso: '2026-10-27-borrador',
      confirmado_utc: null,
    });
    expect(lead?.consentimiento_utc).toEqual(lead?.creado_utc);

    expect(banco.correos).toHaveLength(1);
    const correo = banco.correos[0];
    expect(correo?.to).toBe('ana.lopez@ejemplo.mx');
    const token = tokenDe(correo?.text ?? '', 'confirmar');
    const fila = await banco.db.prepare('SELECT token_hash FROM confirmaciones').first<{ token_hash: string }>();
    expect(fila?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(fila?.token_hash).not.toContain(token);
  });

  it('rechaza con 400 y los campos con error (sin repetir lo que se envió)', async () => {
    const r = await banco.json('/api/leads', leadValido({ correo: 'no-es-correo', estado: 'Narnia', so: undefined, telefono: '123' }));
    expect(r.status).toBe(400);
    const cuerpo = (await r.json()) as { error: string; campos: Record<string, string> };
    expect(cuerpo.error).toBe('validacion');
    expect(Object.keys(cuerpo.campos).sort()).toEqual(['correo', 'estado', 'so', 'telefono']);
    expect(JSON.stringify(cuerpo)).not.toContain('Narnia');
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM leads').first('n')).toBe(0);
  });

  it('rechaza si el consentimiento no está marcado', async () => {
    const r = await banco.json('/api/leads', leadValido({ consentimiento: false }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos).toHaveProperty('consentimiento');
  });

  it('rechaza una versión del aviso que no está vigente', async () => {
    const r = await banco.json('/api/leads', leadValido({ version_aviso: '2020-01-01' }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos).toHaveProperty('version_aviso');
  });

  it('rechaza si Turnstile no valida (simulado) y no guarda nada', async () => {
    const r = await banco.json('/api/leads', leadValido({ turnstile: 'token-falso' }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('verificacion');
    const sinToken = await banco.json('/api/leads', leadValido({ turnstile: undefined }));
    expect(sinToken.status).toBe(400);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM leads').first('n')).toBe(0);
  });

  it('campo trampa lleno: 201 pero no guarda ni envía', async () => {
    const r = await banco.json('/api/leads', leadValido({ sitio_web: 'http://spam.example' }));
    expect(r.status).toBe(201);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM leads').first('n')).toBe(0);
    expect(banco.correos).toHaveLength(0);
  });

  it('un correo repetido responde igual, no duplica y no reenvía antes de 10 minutos', async () => {
    await banco.json('/api/leads', leadValido());
    const r = await banco.json('/api/leads', leadValido({ correo: 'ANA.LOPEZ@ejemplo.mx', nombre: 'Otro Nombre' }));
    expect(r.status).toBe(201);
    expect(await banco.db.prepare('SELECT COUNT(*) AS n FROM leads').first('n')).toBe(1);
    expect(await banco.db.prepare('SELECT nombre FROM leads').first('nombre')).toBe('Dra. Ana López');
    expect(banco.correos).toHaveLength(1);

    // Pasados 10 minutos sí se reenvía (sigue sin confirmar).
    await banco.db.prepare("UPDATE confirmaciones SET creado_utc = '2020-01-01T00:00:00.000Z'").run();
    await banco.json('/api/leads', leadValido());
    expect(banco.correos).toHaveLength(2);
  });

  it('utm_source desconocido se guarda como "otro" y sin utm como "directo"', async () => {
    await banco.json('/api/leads', leadValido({ correo: 'a@ejemplo.mx', utm_source: '<script>' }));
    await banco.json('/api/leads', leadValido({ correo: 'b@ejemplo.mx', utm_source: undefined, utm_campaign: 'Congreso 2026!' }));
    const { results } = await banco.db.prepare('SELECT correo, utm_source, utm_campaign FROM leads ORDER BY correo').all();
    expect(results).toEqual([
      { correo: 'a@ejemplo.mx', utm_source: 'otro', utm_campaign: null },
      { correo: 'b@ejemplo.mx', utm_source: 'directo', utm_campaign: 'congreso2026' },
    ]);
  });

  it('aplica el límite de frecuencia con 429', async () => {
    banco.limite.formularios = 0;
    const r = await banco.json('/api/leads', leadValido());
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('60');
  });

  it('CORS: otro origen recibe 403; inmutalkey.com recibe su encabezado', async () => {
    const ajeno = await banco.json('/api/leads', leadValido(), { headers: { Origin: 'https://evil.example' } });
    expect(ajeno.status).toBe(403);
    const propio = await banco.json('/api/leads', leadValido(), { headers: { Origin: ORIGEN } });
    expect(propio.headers.get('Access-Control-Allow-Origin')).toBe(ORIGEN);
  });

  it('cuerpo que no es JSON o demasiado grande → 400', async () => {
    const r = await banco.pedir('/api/leads', { method: 'POST', body: 'nombre=x', headers: { 'Content-Type': 'text/plain' } });
    expect(r.status).toBe(400);
    const grande = await banco.json('/api/leads', leadValido({ nombre: 'x'.repeat(20_000) }));
    expect(grande.status).toBe(400);
  });

  it('encabezados de seguridad en las respuestas de la API', async () => {
    const r = await banco.pedir('/api/fundadores/cupo');
    expect(r.headers.get('Strict-Transport-Security')).toContain('preload');
    expect(r.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
