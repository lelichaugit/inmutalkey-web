// API del panel /admin. Todo pasa antes por `soloAdmin` (Access + JWT + lista de correos).

import { Hono } from 'hono';
import { z } from 'zod';

import { PREFIJO_FAQ, UTM_FUENTES } from '../../compartido/eventos';
import { ESTATUS_LEAD, erroresPorCampo } from '../../compartido/leads';
import { PREGUNTAS } from '../../data/faq';
import type { Contexto, Env } from '../env';
import { enviarCorreo } from '../lib/correo';
import { sha256Hex, tokenNuevo } from '../lib/cripto';
import { CLAVES_CACHE, invalidarCache, leerJson } from '../lib/http';
import { correoDescarga } from '../lib/plantillas';
import { registrarError } from '../lib/registro';
import { ahora, diasHabilesEntre, esFechaCorta, fechaMexico, iso, masDias, masHoras } from '../lib/tiempo';

export const HORAS_DESCARGA = 72;
const POR_PAGINA = 50;

export const admin = new Hono<Contexto>();

admin.get('/sesion', (c) => c.json({ correo: c.get('admin') }));

// ─────────────────────────── Leads ───────────────────────────

export interface FilaLead {
  readonly id: number;
  readonly creado_utc: string;
  readonly nombre: string;
  readonly correo: string;
  readonly telefono: string | null;
  readonly especialidad: string;
  readonly estado: string;
  readonly ciudad: string;
  readonly tipo_practica: string;
  readonly pacientes_semana_rango: string;
  readonly so: string;
  readonly como_se_entero: string;
  readonly usa_hoy: string;
  readonly utm_source: string;
  readonly utm_medium: string | null;
  readonly utm_campaign: string | null;
  readonly version_aviso: string;
  readonly consentimiento_utc: string;
  readonly confirmado_utc: string | null;
  readonly estatus: string;
  readonly estatus_utc: string;
  readonly primer_contacto_utc: string | null;
  readonly notas_internas: string;
}

function filtrosLeads(consulta: Record<string, string | undefined>): { donde: string; valores: (string | number)[] } {
  const condiciones: string[] = [];
  const valores: (string | number)[] = [];
  const agregar = (sql: string, ...v: (string | number)[]): void => {
    condiciones.push(sql.replace(/\?/g, () => `?${valores.length + 1}`));
    valores.push(...v);
  };
  const { estatus, fuente, confirmado, q } = consulta;
  if (estatus && (ESTATUS_LEAD as readonly string[]).includes(estatus)) agregar('estatus = ?', estatus);
  if (fuente && (UTM_FUENTES as readonly string[]).includes(fuente)) agregar('utm_source = ?', fuente);
  if (confirmado === 'si') condiciones.push('confirmado_utc IS NOT NULL');
  if (confirmado === 'no') condiciones.push('confirmado_utc IS NULL');
  if (q && q.trim()) {
    // Escapa los comodines de LIKE para que la búsqueda sea literal.
    const patron = `%${q.trim().toLowerCase().slice(0, 80).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const i = valores.length + 1;
    condiciones.push(
      `(lower(nombre) LIKE ?${i} ESCAPE '\\' OR correo LIKE ?${i} ESCAPE '\\' OR lower(especialidad) LIKE ?${i} ESCAPE '\\' OR lower(ciudad) LIKE ?${i} ESCAPE '\\')`,
    );
    valores.push(patron);
  }
  return { donde: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', valores };
}

admin.get('/leads', async (c) => {
  const consulta = c.req.query();
  const pagina = Math.max(1, Math.min(10_000, Number.parseInt(consulta.pagina ?? '1', 10) || 1));
  const { donde, valores } = filtrosLeads(consulta);
  const [filas, total] = await c.env.DB.batch<FilaLead | { n: number }>([
    c.env.DB.prepare(`SELECT * FROM leads ${donde} ORDER BY creado_utc DESC LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`).bind(...valores),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM leads ${donde}`).bind(...valores),
  ]);
  return c.json({
    leads: (filas?.results ?? []) as FilaLead[],
    total: ((total?.results[0] as { n: number } | undefined)?.n ?? 0),
    pagina,
    porPagina: POR_PAGINA,
  });
});

const esquemaCambioLead = z
  .object({
    estatus: z.enum(ESTATUS_LEAD).optional(),
    notas_internas: z.string().max(4000).optional(),
  })
  .strict()
  .refine((v) => v.estatus !== undefined || v.notas_internas !== undefined, 'Nada que cambiar');

admin.patch('/leads/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const resultado = esquemaCambioLead.safeParse(await leerJson(c));
  if (!Number.isSafeInteger(id) || !resultado.success) {
    return c.json({ error: 'validacion', campos: resultado.success ? { id: 'no válido' } : erroresPorCampo(resultado.error) }, 400);
  }
  const marca = iso(ahora());
  const { estatus, notas_internas } = resultado.data;
  // primer_contacto_utc se fija la primera vez que el lead sale de 'nuevo' (no se reescribe después).
  const fila = await c.env.DB.prepare(
    `UPDATE leads SET
       estatus = COALESCE(?2, estatus),
       estatus_utc = CASE WHEN ?2 IS NOT NULL AND ?2 <> estatus THEN ?1 ELSE estatus_utc END,
       primer_contacto_utc = CASE WHEN ?2 IS NOT NULL AND ?2 <> 'nuevo' AND primer_contacto_utc IS NULL THEN ?1 ELSE primer_contacto_utc END,
       notas_internas = COALESCE(?3, notas_internas)
     WHERE id = ?4
     RETURNING *`,
  )
    .bind(marca, estatus ?? null, notas_internas ?? null, id)
    .first<FilaLead>();
  if (!fila) return c.json({ error: 'no_encontrado' }, 404);
  if (estatus !== undefined) await invalidarCache(CLAVES_CACHE.cupo);
  return c.json({ lead: fila });
});

/** Borrado definitivo (derecho de cancelación). Arrastra confirmaciones, descargas y testimonios del lead. */
admin.delete('/leads/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isSafeInteger(id)) return c.json({ error: 'validacion', campos: { id: 'no válido' } }, 400);
  const borrado = await c.env.DB.prepare('DELETE FROM leads WHERE id = ?1 RETURNING id').bind(id).first<{ id: number }>();
  if (!borrado) return c.json({ error: 'no_encontrado' }, 404);
  await Promise.all([invalidarCache(CLAVES_CACHE.cupo), invalidarCache(CLAVES_CACHE.testimonios)]);
  return c.json({ ok: true });
});

/** Aprobar prueba: genera el enlace único de 72 h, lo manda por correo y pasa el lead a 'prueba'. */
admin.post('/leads/:id/aprobar-prueba', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isSafeInteger(id)) return c.json({ error: 'validacion', campos: { id: 'no válido' } }, 400);

  const lead = await c.env.DB.prepare('SELECT id, nombre, correo, confirmado_utc, estatus FROM leads WHERE id = ?1')
    .bind(id)
    .first<{ id: number; nombre: string; correo: string; confirmado_utc: string | null; estatus: string }>();
  if (!lead) return c.json({ error: 'no_encontrado' }, 404);
  if (!lead.confirmado_utc) return c.json({ error: 'sin_confirmar', mensaje: 'El médico aún no confirma su correo.' }, 409);
  if (lead.estatus === 'descartado') return c.json({ error: 'descartado', mensaje: 'Cambia primero el estatus.' }, 409);

  const version = await c.env.DB.prepare('SELECT version, sha256 FROM versiones WHERE vigente = 1')
    .first<{ version: string; sha256: string }>();
  if (!version) return c.json({ error: 'sin_version', mensaje: 'Registra y marca una versión vigente del instalador.' }, 409);

  const momento = ahora();
  const marca = iso(momento);
  const expira = iso(masHoras(momento, HORAS_DESCARGA));
  const token = tokenNuevo();
  const hash = await sha256Hex(token);
  await c.env.DB.prepare('INSERT INTO descargas (lead_id, token_hash, version, creado_utc, expira_utc) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(lead.id, hash, version.version, marca, expira)
    .run();

  try {
    await enviarCorreo(
      c.env,
      correoDescarga(lead.correo, lead.nombre, `${c.env.ORIGEN}/api/descarga/${token}`, version.version, version.sha256, `${c.env.ORIGEN}/verificar`),
    );
  } catch (error) {
    registrarError('correo_descarga', error);
    await c.env.DB.prepare('DELETE FROM descargas WHERE token_hash = ?1').bind(hash).run();
    return c.json({ error: 'correo', mensaje: 'No se pudo enviar el correo; no se generó el enlace.' }, 502);
  }

  // Un cliente que pide otro enlace sigue siendo cliente; cualquier otro estatus pasa a 'prueba'.
  await c.env.DB.prepare(
    `UPDATE leads SET
       estatus = CASE WHEN estatus = 'cliente' THEN 'cliente' ELSE 'prueba' END,
       estatus_utc = CASE WHEN estatus IN ('cliente', 'prueba') THEN estatus_utc ELSE ?1 END,
       primer_contacto_utc = COALESCE(primer_contacto_utc, ?1)
     WHERE id = ?2`,
  )
    .bind(marca, lead.id)
    .run();
  await invalidarCache(CLAVES_CACHE.cupo);
  return c.json({ ok: true, version: version.version, expira_utc: expira });
});

// ─────────────────────────── Exportar CSV ───────────────────────────

const COLUMNAS_CSV: readonly (keyof FilaLead)[] = [
  'id', 'creado_utc', 'nombre', 'correo', 'telefono', 'especialidad', 'estado', 'ciudad', 'tipo_practica',
  'pacientes_semana_rango', 'so', 'como_se_entero', 'usa_hoy', 'utm_source', 'utm_medium', 'utm_campaign',
  'version_aviso', 'consentimiento_utc', 'confirmado_utc', 'estatus', 'estatus_utc', 'primer_contacto_utc', 'notas_internas',
];

/** Celda CSV segura: comillas y, si empieza con = + - @ (fórmula en Excel), un apóstrofo delante. */
export function celdaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r;]/.test(texto) || texto !== texto.trim() ? `"${texto.replace(/"/g, '""')}"` : texto;
}

admin.get('/leads.csv', async (c) => {
  const { donde, valores } = filtrosLeads(c.req.query());
  const { results } = await c.env.DB.prepare(`SELECT * FROM leads ${donde} ORDER BY creado_utc`).bind(...valores).all<FilaLead>();
  const lineas = [COLUMNAS_CSV.join(','), ...results.map((f) => COLUMNAS_CSV.map((col) => celdaCsv(f[col])).join(','))];
  // BOM: Excel en español abre bien los acentos.
  return c.body(`﻿${lineas.join('\r\n')}\r\n`, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="leads-${fechaMexico(ahora())}.csv"`,
  });
});

// ─────────────────────────── Métricas y embudo ───────────────────────────

interface FilaEmbudo {
  fuente: string;
  visitas: number;
  iniciados: number;
  enviados: number;
  confirmados: number;
  prueba: number;
  cliente: number;
}

function rangoFechas(desde: string | undefined, hasta: string | undefined): { desde: string; hasta: string } {
  const hoy = ahora();
  const h = hasta && esFechaCorta(hasta) ? hasta : fechaMexico(hoy);
  const d = desde && esFechaCorta(desde) ? desde : fechaMexico(masDias(hoy, -29));
  return d <= h ? { desde: d, hasta: h } : { desde: h, hasta: d };
}

/** Límites UTC de un rango de días en hora de México (UTC−6). */
function limitesUtc(desde: string, hasta: string): { inicio: string; fin: string } {
  const inicio = new Date(`${desde}T06:00:00.000Z`);
  const fin = masDias(new Date(`${hasta}T06:00:00.000Z`), 1);
  return { inicio: iso(inicio), fin: iso(fin) };
}

async function visitasWebAnalytics(env: Env, desde: string, hasta: string): Promise<number | null> {
  if (!env.CF_API_TOKEN_ANALITICA || !env.CF_CUENTA_ID || !env.WA_SITE_TAG) return null;
  try {
    const respuesta = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN_ANALITICA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($cuenta: string!, $sitio: string!, $desde: Date!, $hasta: Date!) {
          viewer { accounts(filter: { accountTag: $cuenta }) {
            rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $sitio, date_geq: $desde, date_leq: $hasta }) {
              count sum { visits }
            } } } }`,
        variables: { cuenta: env.CF_CUENTA_ID, sitio: env.WA_SITE_TAG, desde, hasta },
      }),
    });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as {
      data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { count?: number; sum?: { visits?: number } }[] }[] } };
    };
    const grupo = datos.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0];
    return grupo?.sum?.visits ?? grupo?.count ?? 0;
  } catch (error) {
    registrarError('web_analytics', error);
    return null;
  }
}

admin.get('/metricas', async (c) => {
  const { desde, hasta } = rangoFechas(c.req.query('desde'), c.req.query('hasta'));
  const { inicio, fin } = limitesUtc(desde, hasta);
  const db = c.env.DB;

  const [eventos, leads, contacto, faq, descargas, arco] = await db.batch<Record<string, string | number | null>>([
    db
      .prepare(
        `SELECT utm_source, evento, SUM(contador) AS n FROM eventos_diarios
          WHERE fecha BETWEEN ?1 AND ?2 AND evento IN ('pagina_vista', 'formulario_iniciado', 'whatsapp_prueba', 'whatsapp_fundadores', 'whatsapp_general', 'demo_iniciada')
          GROUP BY utm_source, evento`,
      )
      .bind(desde, hasta),
    db
      .prepare(
        `SELECT utm_source, COUNT(*) AS enviados, SUM(confirmado_utc IS NOT NULL) AS confirmados,
                SUM(estatus IN ('prueba', 'cliente')) AS prueba, SUM(estatus = 'cliente') AS cliente
           FROM leads WHERE creado_utc >= ?1 AND creado_utc < ?2 GROUP BY utm_source`,
      )
      .bind(inicio, fin),
    db
      .prepare(
        `SELECT AVG((julianday(primer_contacto_utc) - julianday(COALESCE(confirmado_utc, creado_utc))) * 24) AS horas,
                COUNT(*) AS n
           FROM leads WHERE primer_contacto_utc IS NOT NULL AND creado_utc >= ?1 AND creado_utc < ?2`,
      )
      .bind(inicio, fin),
    db
      .prepare(
        `SELECT evento, SUM(contador) AS n FROM eventos_diarios
          WHERE fecha BETWEEN ?1 AND ?2 AND evento LIKE 'faq:%' GROUP BY evento ORDER BY n DESC LIMIT 20`,
      )
      .bind(desde, hasta),
    db
      .prepare(
        `SELECT version, COUNT(*) AS generadas, SUM(usado_utc IS NOT NULL) AS usadas FROM descargas
          WHERE creado_utc >= ?1 AND creado_utc < ?2 GROUP BY version ORDER BY version DESC`,
      )
      .bind(inicio, fin),
    db.prepare('SELECT id, tipo, creado_utc FROM solicitudes_arco WHERE resuelto_utc IS NULL ORDER BY creado_utc'),
  ]);

  const porFuente = new Map<string, FilaEmbudo>(
    UTM_FUENTES.map((f) => [f, { fuente: f, visitas: 0, iniciados: 0, enviados: 0, confirmados: 0, prueba: 0, cliente: 0 }]),
  );
  const whatsapp = { prueba: 0, fundadores: 0, general: 0 };
  let demos = 0;
  for (const fila of eventos?.results ?? []) {
    const f = porFuente.get(String(fila.utm_source));
    const n = Number(fila.n ?? 0);
    switch (fila.evento) {
      case 'pagina_vista':
        if (f) f.visitas += n;
        break;
      case 'formulario_iniciado':
        if (f) f.iniciados += n;
        break;
      case 'whatsapp_prueba':
        whatsapp.prueba += n;
        break;
      case 'whatsapp_fundadores':
        whatsapp.fundadores += n;
        break;
      case 'whatsapp_general':
        whatsapp.general += n;
        break;
      case 'demo_iniciada':
        demos += n;
        break;
      default:
        break;
    }
  }
  for (const fila of leads?.results ?? []) {
    const f = porFuente.get(String(fila.utm_source));
    if (!f) continue;
    f.enviados += Number(fila.enviados ?? 0);
    f.confirmados += Number(fila.confirmados ?? 0);
    f.prueba += Number(fila.prueba ?? 0);
    f.cliente += Number(fila.cliente ?? 0);
  }
  const embudo = [...porFuente.values()].filter((f) => f.visitas + f.iniciados + f.enviados > 0);
  const totales = embudo.reduce<FilaEmbudo>(
    (t, f) => ({
      fuente: 'total',
      visitas: t.visitas + f.visitas,
      iniciados: t.iniciados + f.iniciados,
      enviados: t.enviados + f.enviados,
      confirmados: t.confirmados + f.confirmados,
      prueba: t.prueba + f.prueba,
      cliente: t.cliente + f.cliente,
    }),
    { fuente: 'total', visitas: 0, iniciados: 0, enviados: 0, confirmados: 0, prueba: 0, cliente: 0 },
  );

  const textos = new Map(PREGUNTAS.map((p) => [`${PREFIJO_FAQ}${p.id}`, p.pregunta]));
  const filaContacto = contacto?.results[0];
  const hoy = ahora();

  return c.json({
    rango: { desde, hasta },
    visitasWebAnalytics: await visitasWebAnalytics(c.env, desde, hasta),
    embudo,
    totales,
    primerContacto: {
      horasPromedio: filaContacto?.horas === null || filaContacto?.horas === undefined ? null : Math.round(Number(filaContacto.horas) * 10) / 10,
      leads: Number(filaContacto?.n ?? 0),
    },
    whatsapp,
    demos,
    faq: (faq?.results ?? []).map((f) => ({
      id: String(f.evento).slice(PREFIJO_FAQ.length),
      pregunta: textos.get(String(f.evento)) ?? String(f.evento),
      aperturas: Number(f.n ?? 0),
    })),
    descargas: (descargas?.results ?? []).map((d) => ({
      version: String(d.version),
      generadas: Number(d.generadas ?? 0),
      usadas: Number(d.usadas ?? 0),
    })),
    arcoPendientes: (arco?.results ?? []).map((a) => ({
      folio: Number(a.id),
      tipo: String(a.tipo),
      diasHabiles: diasHabilesEntre(new Date(String(a.creado_utc)), hoy),
    })),
  });
});

// ─────────────────────────── Testimonios ───────────────────────────

admin.get('/testimonios', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, l.nombre, l.especialidad, l.ciudad FROM testimonios t JOIN leads l ON l.id = t.lead_id ORDER BY t.creado_utc DESC`,
  ).all();
  return c.json({ testimonios: results });
});

const esquemaTestimonio = z
  .object({
    lead_id: z.number().int().positive(),
    texto: z.string().transform((s) => s.trim()).pipe(z.string().min(20).max(600)),
    nombre_publico: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().max(80))
      .optional(),
    /** Fecha (AAAA-MM-DD) en que el médico autorizó la publicación (p. ej., por WhatsApp o correo). */
    consentimiento_fecha: z.string().refine(esFechaCorta, 'Fecha AAAA-MM-DD').optional(),
  })
  .strict();

admin.post('/testimonios', async (c) => {
  const resultado = esquemaTestimonio.safeParse(await leerJson(c));
  if (!resultado.success) return c.json({ error: 'validacion', campos: erroresPorCampo(resultado.error) }, 400);
  const t = resultado.data;
  const existe = await c.env.DB.prepare('SELECT id FROM leads WHERE id = ?1').bind(t.lead_id).first();
  if (!existe) return c.json({ error: 'validacion', campos: { lead_id: 'No existe ese lead' } }, 400);
  const nombre = t.nombre_publico && t.nombre_publico.length >= 3 ? t.nombre_publico : null;
  const consentimiento = t.consentimiento_fecha ? `${t.consentimiento_fecha}T12:00:00.000Z` : null;
  const fila = await c.env.DB.prepare(
    `INSERT INTO testimonios (lead_id, texto, nombre_publico, consentimiento_publicacion_utc, publicado, creado_utc)
     VALUES (?1, ?2, ?3, ?4, 0, ?5) RETURNING *`,
  )
    .bind(t.lead_id, t.texto, nombre, consentimiento, iso(ahora()))
    .first();
  return c.json({ testimonio: fila }, 201);
});

admin.patch('/testimonios/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const resultado = z.object({ publicado: z.boolean() }).strict().safeParse(await leerJson(c));
  if (!Number.isSafeInteger(id) || !resultado.success) return c.json({ error: 'validacion', campos: {} }, 400);
  const actual = await c.env.DB.prepare('SELECT consentimiento_publicacion_utc FROM testimonios WHERE id = ?1')
    .bind(id)
    .first<{ consentimiento_publicacion_utc: string | null }>();
  if (!actual) return c.json({ error: 'no_encontrado' }, 404);
  if (resultado.data.publicado && !actual.consentimiento_publicacion_utc) {
    return c.json({ error: 'sin_consentimiento', mensaje: 'No se publica sin la fecha del consentimiento del médico.' }, 409);
  }
  const fila = await c.env.DB.prepare('UPDATE testimonios SET publicado = ?1 WHERE id = ?2 RETURNING *')
    .bind(resultado.data.publicado ? 1 : 0, id)
    .first();
  await invalidarCache(CLAVES_CACHE.testimonios);
  return c.json({ testimonio: fila });
});

// ─────────────────────────── Versiones del instalador ───────────────────────────

admin.get('/versiones', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT v.*, (SELECT COUNT(*) FROM descargas d WHERE d.version = v.version AND d.usado_utc IS NOT NULL) AS descargas
       FROM versiones v ORDER BY publicada_utc DESC`,
  ).all();
  return c.json({ versiones: results });
});

const esquemaVersion = z
  .object({
    version: z.string().regex(/^[0-9A-Za-z.+-]{1,32}$/, 'Ejemplo: 0.3.0'),
    clave_r2: z.string().regex(/^[\w./() -]{1,200}$/, 'Ruta del objeto en el bucket'),
    nombre_archivo: z.string().regex(/^[\w.() -]{1,120}$/, 'Nombre de archivo sin caracteres especiales'),
    sha256: z
      .string()
      .transform((s) => s.trim().toLowerCase())
      .pipe(z.string().regex(/^[0-9a-f]{64}$/, '64 caracteres hexadecimales')),
    vigente: z.boolean().optional(),
  })
  .strict();

admin.post('/versiones', async (c) => {
  const resultado = esquemaVersion.safeParse(await leerJson(c));
  if (!resultado.success) return c.json({ error: 'validacion', campos: erroresPorCampo(resultado.error) }, 400);
  const v = resultado.data;
  const objeto = await c.env.INSTALADORES.head(v.clave_r2);
  if (!objeto) return c.json({ error: 'validacion', campos: { clave_r2: 'No existe ese archivo en el bucket' } }, 400);
  const marca = iso(ahora());
  const sentencias = [
    ...(v.vigente ? [c.env.DB.prepare('UPDATE versiones SET vigente = 0 WHERE vigente = 1')] : []),
    c.env.DB.prepare(
      `INSERT INTO versiones (version, clave_r2, nombre_archivo, sha256, tamano_bytes, publicada_utc, vigente)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(v.version, v.clave_r2, v.nombre_archivo, v.sha256, objeto.size, marca, v.vigente ? 1 : 0),
  ];
  try {
    await c.env.DB.batch(sentencias);
  } catch {
    return c.json({ error: 'validacion', campos: { version: 'Esa versión ya está registrada' } }, 409);
  }
  await invalidarCache(CLAVES_CACHE.versiones);
  return c.json({ ok: true, tamano_bytes: objeto.size }, 201);
});

admin.post('/versiones/:version/vigente', async (c) => {
  const version = c.req.param('version');
  const [, marcada] = await c.env.DB.batch([
    c.env.DB.prepare('UPDATE versiones SET vigente = 0 WHERE vigente = 1 AND version <> ?1').bind(version),
    c.env.DB.prepare('UPDATE versiones SET vigente = 1 WHERE version = ?1 RETURNING version').bind(version),
  ]);
  if (!marcada?.results.length) return c.json({ error: 'no_encontrado' }, 404);
  await invalidarCache(CLAVES_CACHE.versiones);
  return c.json({ ok: true });
});

// ─────────────────────────── Configuración de Fundadores ───────────────────────────

admin.get('/config', async (c) => {
  const fila = await c.env.DB.prepare('SELECT total_cupos FROM fundadores_config WHERE id = 1').first<{ total_cupos: number }>();
  return c.json({ total_cupos: fila?.total_cupos ?? 0 });
});

admin.put('/config', async (c) => {
  const resultado = z.object({ total_cupos: z.number().int().min(0).max(100_000) }).strict().safeParse(await leerJson(c));
  if (!resultado.success) return c.json({ error: 'validacion', campos: erroresPorCampo(resultado.error) }, 400);
  await c.env.DB.prepare('UPDATE fundadores_config SET total_cupos = ?1 WHERE id = 1').bind(resultado.data.total_cupos).run();
  await invalidarCache(CLAVES_CACHE.cupo);
  return c.json({ total_cupos: resultado.data.total_cupos });
});

// ─────────────────────────── ARCO ───────────────────────────

admin.get('/arco', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM solicitudes_arco ORDER BY resuelto_utc IS NOT NULL, creado_utc DESC LIMIT 200').all<{
    id: number;
    correo: string;
    tipo: string;
    detalle: string;
    creado_utc: string;
    resuelto_utc: string | null;
  }>();
  const hoy = ahora();
  return c.json({
    solicitudes: results.map((s) => ({
      ...s,
      diasHabiles: diasHabilesEntre(new Date(s.creado_utc), s.resuelto_utc ? new Date(s.resuelto_utc) : hoy),
    })),
  });
});

admin.post('/arco/:id/resolver', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isSafeInteger(id)) return c.json({ error: 'validacion', campos: {} }, 400);
  const fila = await c.env.DB.prepare('UPDATE solicitudes_arco SET resuelto_utc = ?1 WHERE id = ?2 AND resuelto_utc IS NULL RETURNING id')
    .bind(iso(ahora()), id)
    .first();
  if (!fila) return c.json({ error: 'no_encontrado' }, 404);
  return c.json({ ok: true });
});
