// Envío de correo con un solo punto de entrada. Proveedor según CORREO_PROVEEDOR:
//   cloudflare → binding `send_email` (Cloudflare Email Service; requiere Workers Paid para destinatarios arbitrarios)
//   resend     → API de Resend (plan gratuito: 100 correos por día)
//   ninguno    → no envía (desarrollo y pruebas sin red); el resto del flujo sigue igual
// El contenido nunca se registra en logs.

import type { DireccionCorreo, Env } from '../env';
import { registrarError } from './registro';

export interface Mensaje {
  readonly para: string;
  readonly asunto: string;
  readonly texto: string;
  readonly html: string;
  readonly responderA?: string;
}

export class ErrorCorreo extends Error {
  override readonly name = 'ErrorCorreo';
  constructor(readonly code: string) {
    super(`No se pudo enviar el correo (${code})`);
  }
}

function remitente(env: Env): DireccionCorreo {
  return { email: env.CORREO_REMITENTE, name: 'InmutalKey' };
}

/** Lanza ErrorCorreo si el proveedor rechaza el envío. */
export async function enviarCorreo(env: Env, mensaje: Mensaje): Promise<void> {
  switch (env.CORREO_PROVEEDOR) {
    case 'ninguno':
      return;
    case 'cloudflare': {
      if (!env.EMAIL) throw new ErrorCorreo('SIN_BINDING_EMAIL');
      try {
        await env.EMAIL.send({
          from: remitente(env),
          to: mensaje.para,
          subject: mensaje.asunto,
          text: mensaje.texto,
          html: mensaje.html,
          ...(mensaje.responderA ? { replyTo: mensaje.responderA } : {}),
        });
      } catch (error) {
        const codigo =
          typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'E_DESCONOCIDO';
        throw new ErrorCorreo(codigo);
      }
      return;
    }
    case 'resend': {
      if (!env.RESEND_API_KEY) throw new ErrorCorreo('SIN_RESEND_API_KEY');
      const r = remitente(env);
      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${r.name ?? 'InmutalKey'} <${r.email}>`,
          to: [mensaje.para],
          subject: mensaje.asunto,
          text: mensaje.texto,
          html: mensaje.html,
          ...(mensaje.responderA ? { reply_to: mensaje.responderA } : {}),
        }),
      });
      if (!respuesta.ok) throw new ErrorCorreo(`RESEND_${respuesta.status}`);
      return;
    }
    default: {
      const imposible: never = env.CORREO_PROVEEDOR;
      throw new ErrorCorreo(`PROVEEDOR_${String(imposible)}`);
    }
  }
}

/** Para avisos internos que no deben tumbar la solicitud del médico: registra el error y sigue. */
export async function enviarSinFallar(env: Env, mensaje: Mensaje, donde: string): Promise<boolean> {
  try {
    await enviarCorreo(env, mensaje);
    return true;
  } catch (error) {
    registrarError(donde, error);
    return false;
  }
}
