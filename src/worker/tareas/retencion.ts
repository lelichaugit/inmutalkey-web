// Tarea diaria (cron). Minimización de datos y vigilancia del plazo ARCO.
//   · Leads que nunca confirmaron su correo: se borran a los 30 días.
//   · Leads descartados: se borran 12 meses después de descartarlos.
//   · Tokens de confirmación vencidos: se borran a los 7 días de vencer.
//   · Solicitudes ARCO resueltas: se borran a los 24 meses (evidencia de que se atendieron; plazo a validar con tu abogado).
//   · Eventos diarios: se conservan (son solo agregados).
// El borrado de un lead arrastra (ON DELETE CASCADE) sus confirmaciones, descargas y testimonios.

import type { Env } from '../env';
import { enviarSinFallar } from '../lib/correo';
import { correoArcoPorVencer } from '../lib/plantillas';
import { diasHabilesEntre, iso, masDias } from '../lib/tiempo';

export const DIAS_SIN_CONFIRMAR = 30;
export const DIAS_DESCARTADO = 365;
export const DIAS_TOKEN_VENCIDO = 7;
export const DIAS_ARCO_RESUELTA = 730;
/** A partir de cuántos días hábiles se avisa de una solicitud ARCO abierta (el plazo legal es 20). */
export const DIAS_HABILES_AVISO_ARCO = 15;

export interface ResumenRetencion {
  readonly sinConfirmar: number;
  readonly descartados: number;
  readonly tokens: number;
  readonly arco: number;
  readonly arcoPorVencer: number;
}

export async function ejecutarRetencion(env: Env, momento: Date): Promise<ResumenRetencion> {
  // RETURNING en lugar de meta.changes: D1 suma ahí también las filas borradas en cascada.
  const [sinConfirmar, descartados, tokens, arco] = await env.DB.batch<{ id: number }>([
    env.DB.prepare('DELETE FROM leads WHERE confirmado_utc IS NULL AND creado_utc < ?1 RETURNING id').bind(
      iso(masDias(momento, -DIAS_SIN_CONFIRMAR)),
    ),
    env.DB.prepare("DELETE FROM leads WHERE estatus = 'descartado' AND estatus_utc < ?1 RETURNING id").bind(
      iso(masDias(momento, -DIAS_DESCARTADO)),
    ),
    env.DB.prepare('DELETE FROM confirmaciones WHERE expira_utc < ?1 RETURNING id').bind(iso(masDias(momento, -DIAS_TOKEN_VENCIDO))),
    env.DB.prepare('DELETE FROM solicitudes_arco WHERE resuelto_utc IS NOT NULL AND resuelto_utc < ?1 RETURNING id').bind(
      iso(masDias(momento, -DIAS_ARCO_RESUELTA)),
    ),
  ]);

  const { results: abiertas } = await env.DB.prepare('SELECT id, tipo, creado_utc FROM solicitudes_arco WHERE resuelto_utc IS NULL').all<{
    id: number;
    tipo: string;
    creado_utc: string;
  }>();
  const porVencer = abiertas
    .map((s) => ({ folio: s.id, tipo: s.tipo, dias: diasHabilesEntre(new Date(s.creado_utc), momento) }))
    .filter((s) => s.dias >= DIAS_HABILES_AVISO_ARCO);
  if (porVencer.length > 0) await enviarSinFallar(env, correoArcoPorVencer(env.CORREO_AVISOS, porVencer), 'correo_arco_vencer');

  const resumen: ResumenRetencion = {
    sinConfirmar: sinConfirmar?.results.length ?? 0,
    descartados: descartados?.results.length ?? 0,
    tokens: tokens?.results.length ?? 0,
    arco: arco?.results.length ?? 0,
    arcoPorVencer: porVencer.length,
  };
  // Solo conteos: nada identificable.
  console.log(JSON.stringify({ tarea: 'retencion', ...resumen }));
  return resumen;
}
