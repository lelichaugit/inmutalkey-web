// Emisión automática del enlace de descarga (prueba de 30 días) en cuanto el médico prueba que el correo es suyo:
// al confirmar el correo o al entrar con Google. Antes lo aprobaba Alan a mano; el panel sigue pudiendo reenviarlo.
//
// Candados: solo leads confirmados y no descartados, solo si hay versión vigente, y como máximo
// MAX_ENLACES_POR_DIA enlaces por lead en 24 h (evita usar el sitio como servidor de descargas).

import type { Env } from '../env';
import { sha256Hex, tokenNuevo } from './cripto';
import { CLAVES_CACHE, invalidarCache } from './http';
import { ahora, iso, masHoras } from './tiempo';

export const HORAS_ENLACE = 72;
export const MAX_ENLACES_POR_DIA = 5;
/** No se manda otro enlace por correo al mismo lead más de una vez en este lapso. */
export const MINUTOS_ENTRE_ENLACES_POR_CORREO = 10;

export interface EnlaceDescarga {
  readonly token: string;
  readonly version: string;
  readonly sha256: string;
  readonly expira_utc: string;
}

export type MotivoSinEnlace = 'sin_version' | 'limite' | 'no_disponible';

/** Crea un token de descarga para el lead. No envía correo. */
export async function emitirDescarga(env: Env, leadId: number): Promise<EnlaceDescarga | MotivoSinEnlace> {
  const momento = ahora();
  const [lead, version, recientes] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare('SELECT estatus, confirmado_utc FROM leads WHERE id = ?1').bind(leadId),
    env.DB.prepare('SELECT version, sha256 FROM versiones WHERE vigente = 1'),
    env.DB.prepare('SELECT COUNT(*) AS n FROM descargas WHERE lead_id = ?1 AND creado_utc > ?2').bind(leadId, iso(masHoras(momento, -24))),
  ]);
  const filaLead = lead?.results[0] as { estatus: string; confirmado_utc: string | null } | undefined;
  if (!filaLead || !filaLead.confirmado_utc || filaLead.estatus === 'descartado') return 'no_disponible';
  const filaVersion = version?.results[0] as { version: string; sha256: string } | undefined;
  if (!filaVersion) return 'sin_version';
  if (Number((recientes?.results[0] as { n?: number } | undefined)?.n ?? 0) >= MAX_ENLACES_POR_DIA) return 'limite';

  const token = tokenNuevo();
  const marca = iso(momento);
  const expira = iso(masHoras(momento, HORAS_ENLACE));
  await env.DB.batch([
    env.DB.prepare('INSERT INTO descargas (lead_id, token_hash, version, creado_utc, expira_utc) VALUES (?1, ?2, ?3, ?4, ?5)').bind(
      leadId,
      await sha256Hex(token),
      filaVersion.version,
      marca,
      expira,
    ),
    // Quien descarga la beta está en prueba. No toca primer_contacto_utc: esa métrica es del contacto humano de Alan.
    env.DB.prepare("UPDATE leads SET estatus = 'prueba', estatus_utc = ?1 WHERE id = ?2 AND estatus IN ('nuevo', 'contactado')").bind(
      marca,
      leadId,
    ),
  ]);
  await invalidarCache(CLAVES_CACHE.cupo);
  return { token, version: filaVersion.version, sha256: filaVersion.sha256, expira_utc: expira };
}

export const esEnlace = (r: EnlaceDescarga | MotivoSinEnlace): r is EnlaceDescarga => typeof r === 'object';

/** ¿Se le mandó un enlace por correo hace muy poco? (evita que alguien use el formulario para llenar su buzón). */
export async function enlaceReciente(env: Env, leadId: number): Promise<boolean> {
  const ultimo = await env.DB.prepare('SELECT MAX(creado_utc) AS u FROM descargas WHERE lead_id = ?1').bind(leadId).first<string | null>('u');
  return Boolean(ultimo && Date.parse(ultimo) > Date.now() - MINUTOS_ENTRE_ENLACES_POR_CORREO * 60_000);
}
