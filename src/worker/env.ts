// Bindings, variables y secretos del Worker. Los secretos (marcados) se cargan con `npx wrangler secret put NOMBRE`
// y nunca se escriben en wrangler.toml ni en el repositorio. En local van en `.dev.vars` (ignorado por git).

import type { D1Database, R2Bucket, RateLimit } from '@cloudflare/workers-types/index.ts';

/** Binding de los archivos estáticos (dist/). */
export interface Activos {
  fetch(peticion: Request): Promise<Response>;
}

/** Dirección con nombre visible, como la acepta Cloudflare Email Sending. */
export interface DireccionCorreo {
  readonly email: string;
  readonly name?: string;
}

/** Binding `send_email` de Cloudflare Email Service (forma estructurada). */
export interface EnvioCorreo {
  send(mensaje: {
    from: string | DireccionCorreo;
    to: string | DireccionCorreo;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string | DireccionCorreo;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

export type ProveedorCorreo = 'cloudflare' | 'resend' | 'ninguno';

export interface Env {
  // ── Bindings ──
  readonly ASSETS: Activos;
  readonly DB: D1Database;
  readonly INSTALADORES: R2Bucket;
  /** Solo existe si el proveedor de correo es Cloudflare. */
  readonly EMAIL?: EnvioCorreo;
  /** 5 envíos por minuto y por IP (leads, ARCO, confirmación, descarga). */
  readonly LIMITE_FORMULARIOS: RateLimit;
  /** 60 por minuto y por IP (eventos de uso). */
  readonly LIMITE_EVENTOS: RateLimit;

  // ── Variables (wrangler.toml [vars]) ──
  /** https://inmutalkey.com — base de los enlaces de los correos y único origen permitido para CORS. */
  readonly ORIGEN: string;
  /** Orígenes extra separados por coma (solo para desarrollo: http://localhost:4321, …). */
  readonly ORIGENES_EXTRA?: string;
  readonly CORREO_PROVEEDOR: ProveedorCorreo;
  /** Remitente de los correos automáticos, p. ej. avisos@inmutalkey.com (dominio dado de alta en el proveedor). */
  readonly CORREO_REMITENTE: string;
  /** A dónde llegan los avisos internos (lead confirmado, ARCO): contacto@inmutalkey.com. */
  readonly CORREO_AVISOS: string;
  /** Si viene definido, solo se aceptan tokens de Turnstile emitidos para estos hostnames (coma). */
  readonly TURNSTILE_HOSTNAMES?: string;
  /** Equipo de Cloudflare Zero Trust, p. ej. `inmutalkey.cloudflareaccess.com`. */
  readonly ACCESS_EQUIPO?: string;
  readonly R2_BUCKET: string;
  /** `desarrollo` solo en .dev.vars: permite /admin sin Access para ADMIN_DEV_CORREO. Nunca en producción. */
  readonly ENTORNO?: string;
  readonly ADMIN_DEV_CORREO?: string;

  // ── Secretos (wrangler secret put) ──
  readonly TURNSTILE_SECRET: string;
  /** Sal aleatoria para la llave del límite de frecuencia (la IP nunca se guarda; solo vive en memoria). */
  readonly LIMITE_SAL: string;
  /** Audiencia (AUD tag) de la aplicación de Access que protege /admin. */
  readonly ACCESS_AUD?: string;
  /** Correos con permiso de entrar a /admin, separados por coma. Secreto para no publicar tu correo en el repo. */
  readonly ADMIN_CORREOS?: string;
  readonly RESEND_API_KEY?: string;
  /** Credenciales S3 de R2 de SOLO LECTURA sobre el bucket de instaladores (para la URL prefirmada). */
  readonly R2_CUENTA_ID?: string;
  readonly R2_ACCESS_KEY_ID?: string;
  readonly R2_SECRET_ACCESS_KEY?: string;
  /** Opcional: token de API con "Account Analytics: Read" para traer visitas de Web Analytics al panel. */
  readonly CF_API_TOKEN_ANALITICA?: string;
  readonly CF_CUENTA_ID?: string;
  readonly WA_SITE_TAG?: string;
}

/** Variables que Hono guarda por solicitud. */
export interface Variables {
  /** Correo del administrador autenticado (solo en /admin y /api/admin). */
  admin: string;
}

export interface Contexto {
  Bindings: Env;
  Variables: Variables;
}
