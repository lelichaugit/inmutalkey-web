// Pasos comunes cuando un médico prueba que el correo es suyo (confirmó el enlace o entró con Google):
// queda confirmado (con aviso a contacto@ la primera vez) y recibe su enlace de descarga en ese momento.

import type { Context } from 'hono';

import type { Contexto } from '../env';
import { enviarSinFallar } from '../lib/correo';
import { emitirDescarga, esEnlace } from '../lib/descargas';
import { correoAvisoLead, type DatosAviso } from '../lib/plantillas';
import { iso, ahora } from '../lib/tiempo';

type Ctx = Context<Contexto>;

/** Marca el correo como confirmado si aún no lo estaba y avisa a Alan (sin bloquear la respuesta). */
export async function marcarConfirmado(c: Ctx, leadId: number, metodo: 'correo' | 'google'): Promise<void> {
  const lead = await c.env.DB.prepare(
    `UPDATE leads SET confirmado_utc = ?1 WHERE id = ?2 AND confirmado_utc IS NULL
     RETURNING id, nombre, correo, telefono, especialidad, ciudad, estado, utm_source`,
  )
    .bind(iso(ahora()), leadId)
    .first<DatosAviso>();
  if (!lead) return;
  c.executionCtx.waitUntil(
    enviarSinFallar(c.env, correoAvisoLead(c.env.CORREO_AVISOS, lead, `${c.env.ORIGEN}/admin`, metodo), 'correo_aviso_lead').then(() => undefined),
  );
}

/**
 * A dónde llevar al médico: a su descarga guiada si hay versión vigente, o a la página de gracias explicando por qué
 * no (todavía no hay instalador publicado, o pidió demasiados enlaces hoy).
 */
export async function destinoTrasVerificar(c: Ctx, leadId: number): Promise<string> {
  const resultado = await emitirDescarga(c.env, leadId);
  if (esEnlace(resultado)) return `/descarga#t=${resultado.token}`;
  if (resultado === 'sin_version') return '/fundadores/gracias?estado=pronto';
  if (resultado === 'limite') return '/fundadores/gracias?estado=limite';
  return '/fundadores/gracias';
}
