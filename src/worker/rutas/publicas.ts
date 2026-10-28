// Rutas públicas de /api. Contrato con el sitio (no cambiar sin avisar a Alan y actualizar docs/BACKEND.md):
//   POST /api/leads                 → 201 {ok:true} (correo: llega un enlace de confirmación, o de descarga si ya
//                                     estaba confirmado) | 201 {ok:true, destino} (con Google: correo ya verificado)
//                                     | 400 {error, campos} | 429
//   GET  /api/confirmar/:token      → 302 /fundadores/confirmar#t=… (vigente) | /fundadores/gracias (ya usado)
//                                     | /fundadores/confirmar?estado=vencido
//   POST /api/confirmar             → 200 {ok:true, destino?} (destino = /descarga#t=… o /fundadores/gracias?…)
//                                     | 410 {error:'vencido'} | 400 | 429
//   GET  /api/fundadores/cupo       → {total, restantes} (caché 60 s)
//   POST /api/eventos               → 204 siempre
//   GET  /api/testimonios           → [{nombre, especialidad, ciudad, texto, fecha}] (caché 5 min)
//   GET  /api/versiones             → [{version, nombre_archivo, sha256, tamano_bytes, publicada_utc, vigente}]
//   GET  /api/descarga/:token       → 302 /descarga#t=… (vigente) | 410
//   POST /api/descarga              → JSON {url} (prefirmada de R2, 5 min) o 303 si llega como formulario | 410
//   POST /api/descarga/reenviar     → 202 {ok:true} siempre (si el correo está confirmado, llega un enlace nuevo)
//   POST /api/descarga/a-mi-correo  → 200 {ok:true} (manda el mismo enlace al correo del médico) | 410
//   POST /api/arco                  → 201 {ok:true, folio} | 400 | 429
//
// Por qué la confirmación y la descarga piden un clic (POST) en lugar de actuar con el GET del correo: los filtros de
// correo corporativo (Outlook Safe Links, antivirus) abren los enlaces antes que la persona. Con un GET que actúa,
// el filtro "confirmaría" por el médico y gastaría su descarga de un solo uso.

import { Hono } from 'hono';

import { normalizarFuente, normalizarUtmLibre } from '../../compartido/eventos';
import { esEvento } from '../../compartido/eventos-validos';
import { ESTATUS_QUE_OCUPAN_CUPO, erroresPorCampo, esquemaArco, esquemaLead } from '../../compartido/leads';
import type { Contexto, Env } from '../env';
import { enviarCorreo, enviarSinFallar } from '../lib/correo';
import { emitirDescarga, enlaceReciente, esEnlace } from '../lib/descargas';
import { esTokenValido, sha256Hex, tokenNuevo } from '../lib/cripto';
import { CLAVES_CACHE, dentroDelLimite, jsonEnCache, leerCampo, leerJson, respuestaLimite } from '../lib/http';
import { correoAvisoArco, correoConfirmacion, correoDescarga } from '../lib/plantillas';
import { SEGUNDOS_URL_FIRMADA, urlFirmadaDescarga } from '../lib/r2';
import { registrarError } from '../lib/registro';
import { ahora, fechaMexico, iso, masHoras } from '../lib/tiempo';
import { borrarCookie, COOKIE_REGISTRO } from '../lib/sesion';
import { verificarTurnstile } from '../lib/turnstile';
import { destinoTrasVerificar, marcarConfirmado } from './flujo';
import { sesionGoogle } from './google';

export const HORAS_CONFIRMACION = 72;
/** No se reenvía la confirmación a un mismo correo más de una vez en este lapso. */
export const MINUTOS_ENTRE_REENVIOS = 10;

export const publicas = new Hono<Contexto>();

// ─────────────────────────── Leads ───────────────────────────

publicas.post('/leads', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);

  const cuerpo = await leerJson(c);
  if (typeof cuerpo !== 'object' || cuerpo === null) return c.json({ error: 'validacion', campos: { formulario: 'Solicitud no válida' } }, 400);

  // Registro con Google en curso: el correo es el que Google verificó, no el que diga el formulario.
  const sesion = await sesionGoogle(c.env, c.req.header('Cookie'));
  const entrada = sesion ? { ...(cuerpo as Record<string, unknown>), correo: sesion.correo } : cuerpo;

  const resultado = esquemaLead.safeParse(entrada);
  if (!resultado.success) return c.json({ error: 'validacion', campos: erroresPorCampo(resultado.error) }, 400);
  const lead = resultado.data;

  // Campo trampa lleno: se responde como si todo saliera bien y no se guarda nada.
  if (lead.sitio_web) return c.json({ ok: true }, 201);

  // Con Google la identidad ya está probada (y el límite de frecuencia sigue activo); sin Google, Turnstile.
  if (!sesion && !(await verificarTurnstile(c.env, lead.turnstile, 'lead'))) {
    return c.json({ error: 'verificacion', campos: { turnstile: 'No pudimos verificar que no eres un robot. Intenta de nuevo.' } }, 400);
  }

  const momento = ahora();
  const marca = iso(momento);
  const insertado = await c.env.DB.prepare(
    `INSERT INTO leads (creado_utc, nombre, correo, telefono, especialidad, estado, ciudad, tipo_practica,
       pacientes_semana_rango, so, como_se_entero, usa_hoy, utm_source, utm_medium, utm_campaign, version_aviso,
       consentimiento_utc, estatus, estatus_utc, metodo_registro)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?1, 'nuevo', ?1, ?17)
     ON CONFLICT (correo) DO NOTHING
     RETURNING id`,
  )
    .bind(
      marca,
      lead.nombre,
      lead.correo,
      lead.telefono,
      lead.especialidad,
      lead.estado,
      lead.ciudad,
      lead.tipo_practica,
      lead.pacientes_semana_rango,
      lead.so,
      lead.como_se_entero,
      lead.usa_hoy,
      normalizarFuente(lead.utm_source),
      normalizarUtmLibre(lead.utm_medium),
      normalizarUtmLibre(lead.utm_campaign),
      lead.version_aviso,
      sesion ? 'google' : 'correo',
    )
    .first<{ id: number }>();

  const existente = insertado
    ? null
    : await c.env.DB.prepare(
        `SELECT l.id, l.confirmado_utc, l.estatus, MAX(cf.creado_utc) AS ultimo
           FROM leads l LEFT JOIN confirmaciones cf ON cf.lead_id = l.id
          WHERE l.correo = ?1 GROUP BY l.id`,
      )
        .bind(lead.correo)
        .first<{ id: number; confirmado_utc: string | null; estatus: string; ultimo: string | null }>();
  const leadId = insertado?.id ?? existente?.id;
  if (leadId === undefined) return c.json({ ok: true }, 201);

  // ── Con Google: confirmado en el acto y directo a su descarga guiada. ──
  if (sesion) {
    await marcarConfirmado(c, leadId, 'google');
    const destino = await destinoTrasVerificar(c, leadId);
    c.header('Set-Cookie', borrarCookie(COOKIE_REGISTRO));
    return c.json({ ok: true, destino }, 201);
  }

  // ── Con correo. La respuesta es idéntica en todos los casos: nadie puede averiguar qué correos están
  // registrados. Los datos guardados nunca se pisan. ──
  if (existente?.confirmado_utc) {
    // Ya confirmado (vuelve por otro instalador): le llega un enlace de descarga nuevo, como mucho cada 10 min.
    if (existente.estatus !== 'descartado' && !(await enlaceReciente(c.env, leadId))) {
      await enviarEnlaceDescarga(c.env, leadId, lead.correo, lead.nombre);
    }
    return c.json({ ok: true }, 201);
  }
  if (existente?.ultimo && Date.parse(existente.ultimo) > momento.getTime() - MINUTOS_ENTRE_REENVIOS * 60_000) {
    return c.json({ ok: true }, 201);
  }

  const token = tokenNuevo();
  await c.env.DB.prepare(
    'INSERT INTO confirmaciones (lead_id, token_hash, creado_utc, expira_utc) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(leadId, await sha256Hex(token), marca, iso(masHoras(momento, HORAS_CONFIRMACION)))
    .run();

  try {
    await enviarCorreo(c.env, correoConfirmacion(lead.correo, lead.nombre, `${c.env.ORIGEN}/api/confirmar/${token}`));
  } catch (error) {
    // El lead queda guardado; si vuelve a enviar el formulario después de 10 min, recibe otra confirmación.
    registrarError('correo_confirmacion', error);
  }
  return c.json({ ok: true }, 201);
});

/** Emite un enlace y lo manda por correo. Si el correo falla, el enlace no queda vivo. */
async function enviarEnlaceDescarga(env: Env, leadId: number, correo: string, nombre: string): Promise<void> {
  const enlace = await emitirDescarga(env, leadId);
  if (!esEnlace(enlace)) return;
  try {
    await enviarCorreo(
      env,
      correoDescarga(correo, nombre, `${env.ORIGEN}/api/descarga/${enlace.token}`, enlace.version, enlace.sha256, `${env.ORIGEN}/verificar`),
    );
  } catch (error) {
    registrarError('correo_descarga', error);
    await env.DB.prepare('DELETE FROM descargas WHERE token_hash = ?1').bind(await sha256Hex(enlace.token)).run();
  }
}

// ─────────────────────────── Confirmación (doble opt-in) ───────────────────────────

publicas.get('/confirmar/:token', async (c) => {
  const token = c.req.param('token');
  if (!esTokenValido(token)) return c.redirect('/fundadores/confirmar?estado=vencido', 302);
  const fila = await c.env.DB.prepare('SELECT expira_utc, usado_utc FROM confirmaciones WHERE token_hash = ?1')
    .bind(await sha256Hex(token))
    .first<{ expira_utc: string; usado_utc: string | null }>();
  if (fila?.usado_utc) return c.redirect('/fundadores/gracias', 302);
  if (!fila || Date.parse(fila.expira_utc) <= Date.now()) return c.redirect('/fundadores/confirmar?estado=vencido', 302);
  // El token viaja en el fragmento (#): el navegador no lo manda al servidor ni queda en registros.
  return c.redirect(`/fundadores/confirmar#t=${token}`, 302);
});

publicas.post('/confirmar', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);
  const token = await leerCampo(c, 'token');
  if (!token || !esTokenValido(token)) return c.json({ error: 'vencido' }, 410);

  const momento = iso(ahora());
  const hash = await sha256Hex(token);
  // Uso único atómico: solo una solicitud puede marcar el token.
  const usado = await c.env.DB.prepare(
    `UPDATE confirmaciones SET usado_utc = ?1
      WHERE token_hash = ?2 AND usado_utc IS NULL AND expira_utc > ?1
      RETURNING lead_id`,
  )
    .bind(momento, hash)
    .first<{ lead_id: number }>();

  if (!usado) {
    const fila = await c.env.DB.prepare('SELECT usado_utc FROM confirmaciones WHERE token_hash = ?1')
      .bind(hash)
      .first<{ usado_utc: string | null }>();
    // Doble clic o recarga: el token ya se usó; para la persona, su correo ya está confirmado.
    if (fila?.usado_utc) return c.json({ ok: true }, 200);
    return c.json({ error: 'vencido' }, 410);
  }

  await marcarConfirmado(c, usado.lead_id, 'correo');
  return c.json({ ok: true, destino: await destinoTrasVerificar(c, usado.lead_id) }, 200);
});

// ─────────────────────────── Cupo de Fundadores ───────────────────────────

export async function calcularCupo(env: Env): Promise<{ total: number; restantes: number }> {
  const marcadores = ESTATUS_QUE_OCUPAN_CUPO.map((_, i) => `?${i + 1}`).join(', ');
  const [config, ocupados] = await env.DB.batch<{ total_cupos?: number; n?: number }>([
    env.DB.prepare('SELECT total_cupos FROM fundadores_config WHERE id = 1'),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM leads WHERE estatus IN (${marcadores})`).bind(...ESTATUS_QUE_OCUPAN_CUPO),
  ]);
  const total = config?.results[0]?.total_cupos ?? 0;
  const n = ocupados?.results[0]?.n ?? 0;
  return { total, restantes: Math.max(total - n, 0) };
}

publicas.get('/fundadores/cupo', (c) => jsonEnCache(c, CLAVES_CACHE.cupo, 60, () => calcularCupo(c.env)));

// ─────────────────────────── Eventos de uso (agregados) ───────────────────────────

publicas.post('/eventos', async (c) => {
  try {
    if (!(await dentroDelLimite(c, 'eventos'))) return c.body(null, 204);
    const cuerpo = await leerJson(c, 2048);
    if (typeof cuerpo !== 'object' || cuerpo === null) return c.body(null, 204);
    const datos = cuerpo as { evento?: unknown; eventos?: unknown; utm_source?: unknown };
    const crudos: unknown[] = Array.isArray(datos.eventos) ? datos.eventos.slice(0, 10) : [datos.evento];
    // Sin repetidos por solicitud: un envío no puede inflar un contador.
    const validos = [...new Set(crudos.filter(esEvento))];
    if (validos.length === 0) return c.body(null, 204);

    const fecha = fechaMexico(ahora());
    const fuente = normalizarFuente(datos.utm_source);
    const sentencia = c.env.DB.prepare(
      `INSERT INTO eventos_diarios (fecha, evento, utm_source, contador) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (fecha, evento, utm_source) DO UPDATE SET contador = contador + 1`,
    );
    await c.env.DB.batch(validos.map((evento) => sentencia.bind(fecha, evento, fuente)));
  } catch (error) {
    registrarError('eventos', error);
  }
  return c.body(null, 204);
});

// ─────────────────────────── Testimonios ───────────────────────────

export interface TestimonioPublico {
  readonly nombre: string;
  readonly especialidad: string;
  readonly ciudad: string;
  readonly texto: string;
  readonly fecha: string;
}

publicas.get('/testimonios', (c) =>
  jsonEnCache(c, CLAVES_CACHE.testimonios, 300, async () => {
    const { results } = await c.env.DB.prepare(
      `SELECT COALESCE(t.nombre_publico, l.nombre) AS nombre, l.especialidad, l.ciudad, t.texto,
              substr(t.creado_utc, 1, 10) AS fecha
         FROM testimonios t JOIN leads l ON l.id = t.lead_id
        WHERE t.publicado = 1 AND t.consentimiento_publicacion_utc IS NOT NULL
        ORDER BY t.creado_utc DESC LIMIT 30`,
    ).all<TestimonioPublico>();
    return results;
  }),
);

// ─────────────────────────── Versiones del instalador (SHA-256 público) ───────────────────────────

publicas.get('/versiones', (c) =>
  jsonEnCache(c, CLAVES_CACHE.versiones, 300, async () => {
    const { results } = await c.env.DB.prepare(
      `SELECT version, nombre_archivo, sha256, tamano_bytes, publicada_utc, vigente
         FROM versiones ORDER BY publicada_utc DESC LIMIT 20`,
    ).all<{ version: string; nombre_archivo: string; sha256: string; tamano_bytes: number | null; publicada_utc: string; vigente: number }>();
    return results.map((v) => ({ ...v, vigente: v.vigente === 1 }));
  }),
);

// ─────────────────────────── Descargas ───────────────────────────

const PAGINA_VENCIDA =
  '<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Enlace vencido · InmutalKey</title><h1>Este enlace de descarga ya no está disponible</h1>' +
  '<p>Los enlaces funcionan una sola vez y vencen a las 72 horas. Pide uno nuevo en <a href="/descarga">inmutalkey.com/descarga</a> o escríbenos a contacto@inmutalkey.com.</p>' +
  '<p><a href="/">Volver a inmutalkey.com</a></p></html>';

publicas.get('/descarga/:token', async (c) => {
  const token = c.req.param('token');
  if (!esTokenValido(token)) return c.html(PAGINA_VENCIDA, 410);
  const fila = await c.env.DB.prepare('SELECT expira_utc, usado_utc FROM descargas WHERE token_hash = ?1')
    .bind(await sha256Hex(token))
    .first<{ expira_utc: string; usado_utc: string | null }>();
  if (!fila || fila.usado_utc || Date.parse(fila.expira_utc) <= Date.now()) return c.html(PAGINA_VENCIDA, 410);
  return c.redirect(`/descarga#t=${token}`, 302);
});

publicas.post('/descarga', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);
  const token = await leerCampo(c, 'token');
  if (!token || !esTokenValido(token)) return c.html(PAGINA_VENCIDA, 410);

  const momento = iso(ahora());
  const usado = await c.env.DB.prepare(
    `UPDATE descargas SET usado_utc = ?1
      WHERE token_hash = ?2 AND usado_utc IS NULL AND expira_utc > ?1
      RETURNING version`,
  )
    .bind(momento, await sha256Hex(token))
    .first<{ version: string }>();
  if (!usado) return c.html(PAGINA_VENCIDA, 410);

  const version = await c.env.DB.prepare('SELECT clave_r2, nombre_archivo FROM versiones WHERE version = ?1')
    .bind(usado.version)
    .first<{ clave_r2: string; nombre_archivo: string }>();
  if (!version) return c.html(PAGINA_VENCIDA, 410);

  try {
    const url = await urlFirmadaDescarga(c.env, version.clave_r2, version.nombre_archivo, SEGUNDOS_URL_FIRMADA);
    // La página /descarga pide JSON y navega a la URL: un 303 tras un <form> lo bloquearía la CSP (form-action 'self')
    // en Chrome, que también aplica esa directiva a las redirecciones.
    if ((c.req.header('Content-Type') ?? '').startsWith('application/json')) return c.json({ url }, 200);
    return c.redirect(url, 303);
  } catch (error) {
    registrarError('url_firmada', error);
    // Se libera el token para que pueda reintentar cuando se corrija la configuración.
    await c.env.DB.prepare('UPDATE descargas SET usado_utc = NULL WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
    return c.json({ error: 'no_disponible' }, 503);
  }
});

/** Pedir un enlace nuevo con el correo (se venció, se usó o se perdió). Respuesta idéntica siempre. */
publicas.post('/descarga/reenviar', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);
  const cuerpo = (await leerJson(c, 4096)) as { correo?: unknown; turnstile?: unknown } | undefined;
  const correo = typeof cuerpo?.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : '';
  const turnstile = typeof cuerpo?.turnstile === 'string' ? cuerpo.turnstile : undefined;
  if (!correo || correo.length > 160 || !correo.includes('@')) return c.json({ error: 'validacion', campos: { correo: 'Revisa tu correo' } }, 400);
  if (!(await verificarTurnstile(c.env, turnstile, 'reenviar'))) {
    return c.json({ error: 'verificacion', campos: { turnstile: 'No pudimos verificar que no eres un robot. Intenta de nuevo.' } }, 400);
  }
  const lead = await c.env.DB.prepare('SELECT id, nombre, estatus, confirmado_utc FROM leads WHERE correo = ?1')
    .bind(correo)
    .first<{ id: number; nombre: string; estatus: string; confirmado_utc: string | null }>();
  if (lead?.confirmado_utc && lead.estatus !== 'descartado' && !(await enlaceReciente(c.env, lead.id))) {
    await enviarEnlaceDescarga(c.env, lead.id, correo, lead.nombre);
  }
  return c.json({ ok: true }, 202);
});

/** Desde el celular: manda el mismo enlace (sin gastarlo) al correo del médico para abrirlo en su computadora. */
publicas.post('/descarga/a-mi-correo', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);
  const token = await leerCampo(c, 'token');
  if (!token || !esTokenValido(token)) return c.json({ error: 'vencido' }, 410);
  const fila = await c.env.DB.prepare(
    `SELECT l.correo, l.nombre, d.version, v.sha256 FROM descargas d
       JOIN leads l ON l.id = d.lead_id JOIN versiones v ON v.version = d.version
      WHERE d.token_hash = ?1 AND d.usado_utc IS NULL AND d.expira_utc > ?2`,
  )
    .bind(await sha256Hex(token), iso(ahora()))
    .first<{ correo: string; nombre: string; version: string; sha256: string }>();
  if (!fila) return c.json({ error: 'vencido' }, 410);
  try {
    await enviarCorreo(
      c.env,
      correoDescarga(fila.correo, fila.nombre, `${c.env.ORIGEN}/api/descarga/${token}`, fila.version, fila.sha256, `${c.env.ORIGEN}/verificar`),
    );
  } catch (error) {
    registrarError('correo_a_mi_correo', error);
    return c.json({ error: 'correo' }, 502);
  }
  // Solo los primeros caracteres del correo, para que la persona reconozca a cuál se mandó.
  const [usuario = '', dominio = ''] = fila.correo.split('@');
  return c.json({ ok: true, correo: `${usuario.slice(0, 2)}•••@${dominio}` }, 200);
});

// ─────────────────────────── Derechos ARCO ───────────────────────────

publicas.post('/arco', async (c) => {
  if (!(await dentroDelLimite(c, 'formularios'))) return respuestaLimite(c);
  const cuerpo = await leerJson(c, 8192);
  if (cuerpo === undefined) return c.json({ error: 'validacion', campos: { formulario: 'Solicitud no válida' } }, 400);
  const resultado = esquemaArco.safeParse(cuerpo);
  if (!resultado.success) return c.json({ error: 'validacion', campos: erroresPorCampo(resultado.error) }, 400);
  const solicitud = resultado.data;
  if (solicitud.sitio_web) return c.json({ ok: true, folio: 0 }, 201);
  if (!(await verificarTurnstile(c.env, solicitud.turnstile, 'arco'))) {
    return c.json({ error: 'verificacion', campos: { turnstile: 'No pudimos verificar que no eres un robot. Intenta de nuevo.' } }, 400);
  }

  const detalle = solicitud.detalle ?? '';
  const fila = await c.env.DB.prepare(
    'INSERT INTO solicitudes_arco (correo, tipo, detalle, creado_utc) VALUES (?1, ?2, ?3, ?4) RETURNING id',
  )
    .bind(solicitud.correo, solicitud.tipo, detalle, iso(ahora()))
    .first<{ id: number }>();
  const folio = fila?.id ?? 0;
  c.executionCtx.waitUntil(
    enviarSinFallar(c.env, correoAvisoArco(c.env.CORREO_AVISOS, folio, solicitud.tipo, solicitud.correo, detalle), 'correo_aviso_arco').then(
      () => undefined,
    ),
  );
  return c.json({ ok: true, folio }, 201);
});
