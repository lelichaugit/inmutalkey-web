// Arnés de pruebas del Worker. El pool de Workers de Vitest aún no soporta Vitest 5, así que se usa Miniflare (el
// mismo motor de `wrangler dev`, vía `getPlatformProxy` de Wrangler, que lee los bindings de wrangler.toml) para
// tener D1 y R2 locales reales, con las migraciones del repo aplicadas, y se llama a la app de Hono desde Node.
// Correo, límite de frecuencia, Turnstile y las llaves de Access son dobles.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { D1Database, R2Bucket, RateLimit } from '@cloudflare/workers-types/index.ts';
import { vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';

import type { Env, EnvioCorreo } from '../../src/worker/env';
import { crearApp } from '../../src/worker/index';
import { base64url } from '../../src/worker/lib/cripto';
import { reiniciarCacheLlaves } from '../../src/worker/lib/acceso';

export const ORIGEN = 'https://inmutalkey.com';
export const TURNSTILE_BUENO = 'token-turnstile-valido';
export const EQUIPO = 'prueba.cloudflareaccess.com';
export const AUD = 'aud-de-prueba';
export const ADMIN = 'alan@ejemplo.mx';

export interface CorreoEnviado {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface Banco {
  readonly db: D1Database;
  readonly r2: R2Bucket;
  readonly correos: CorreoEnviado[];
  env: Env;
  /** Llamadas restantes antes de que el limitador diga que no (por ámbito). */
  limite: { formularios: number; eventos: number };
  pedir(ruta: string, init?: RequestInit): Promise<Response>;
  json(ruta: string, cuerpo: unknown, init?: RequestInit): Promise<Response>;
  limpiar(): Promise<void>;
  cerrar(): Promise<void>;
  jwt(cambios?: Partial<{ aud: string; iss: string; exp: number; email: string; kid: string }>): Promise<string>;
}

/** Divide un archivo de migración en sentencias (las del repo no tienen triggers ni cuerpos con ';'). */
export function sentencias(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function migraciones(): { nombre: string; sql: string }[] {
  const dir = join(process.cwd(), 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(join(dir, nombre), 'utf8') }));
}

const TABLAS_EN_ORDEN = ['descargas', 'versiones', 'testimonios', 'confirmaciones', 'solicitudes_arco', 'eventos_diarios', 'leads'];

let llaves: CryptoKeyPair | null = null;
async function parDeLlaves(): Promise<CryptoKeyPair> {
  llaves ??= await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  return llaves;
}

function limitador(banco: Pick<Banco, 'limite'>, ambito: 'formularios' | 'eventos'): RateLimit {
  return {
    limit: async () => {
      banco.limite[ambito]--;
      return { success: banco.limite[ambito] >= 0 };
    },
  } as RateLimit;
}

export async function crearBanco(extra: Partial<Env> = {}): Promise<Banco> {
  // persist: false → base y bucket nuevos en memoria para cada archivo de pruebas; nada remoto.
  const plataforma = await getPlatformProxy<{ DB: D1Database; INSTALADORES: R2Bucket }>({
    configPath: 'wrangler.toml',
    persist: false,
    remoteBindings: false,
  });
  const db = plataforma.env.DB;
  const r2 = plataforma.env.INSTALADORES;
  for (const { sql } of migraciones()) await db.batch(sentencias(sql).map((s) => db.prepare(s)));

  const correos: CorreoEnviado[] = [];
  const email: EnvioCorreo = {
    send: async (m) => {
      correos.push({ to: typeof m.to === 'string' ? m.to : m.to.email, subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}) });
      return { messageId: `m-${correos.length}` };
    },
  };

  const par = await parDeLlaves();
  const jwkPublica = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid: 'llave-1' };

  // Solo se interceptan Turnstile y las llaves de Access; lo demás (Miniflare) usa el fetch real.
  const fetchReal = globalThis.fetch;
  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/')) {
      const cuerpo = new URLSearchParams(String(init?.body ?? ''));
      const exito = cuerpo.get('response') === TURNSTILE_BUENO;
      return Response.json({ success: exito, hostname: 'inmutalkey.com', ...(exito ? {} : { 'error-codes': ['invalid-input-response'] }) });
    }
    if (url === `https://${EQUIPO}/cdn-cgi/access/certs`) return Response.json({ keys: [jwkPublica] });
    return fetchReal(entrada, init);
  });

  const banco: Banco = {
    db,
    r2,
    correos,
    limite: { formularios: 1000, eventos: 1000 },
    env: undefined as unknown as Env,
    async pedir(ruta, init = {}) {
      const pendientes: Promise<unknown>[] = [];
      const ctx = { waitUntil: (p: Promise<unknown>) => pendientes.push(p), passThroughOnException: () => undefined, props: {} };
      const encabezados = new Headers(init.headers);
      if (!encabezados.has('CF-Connecting-IP')) encabezados.set('CF-Connecting-IP', '198.51.100.7');
      const respuesta = await app.fetch(new Request(`${ORIGEN}${ruta}`, { ...init, headers: encabezados, redirect: 'manual' }), banco.env, ctx);
      await Promise.all(pendientes);
      return respuesta;
    },
    json(ruta, cuerpo, init = {}) {
      const encabezados = new Headers(init.headers);
      encabezados.set('Content-Type', 'application/json');
      return banco.pedir(ruta, { method: 'POST', ...init, headers: encabezados, body: JSON.stringify(cuerpo) });
    },
    async limpiar() {
      await db.batch([
        ...TABLAS_EN_ORDEN.map((t) => db.prepare(`DELETE FROM ${t}`)),
        db.prepare('UPDATE fundadores_config SET total_cupos = 0 WHERE id = 1'),
      ]);
      correos.length = 0;
      banco.limite = { formularios: 1000, eventos: 1000 };
      reiniciarCacheLlaves();
    },
    async cerrar() {
      vi.unstubAllGlobals();
      await plataforma.dispose();
    },
    async jwt(cambios = {}) {
      const cabecera = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: cambios.kid ?? 'llave-1', typ: 'JWT' })));
      const carga = base64url(
        new TextEncoder().encode(
          JSON.stringify({
            aud: [cambios.aud ?? AUD],
            iss: cambios.iss ?? `https://${EQUIPO}`,
            exp: cambios.exp ?? Math.floor(Date.now() / 1000) + 3600,
            email: cambios.email ?? ADMIN,
          }),
        ),
      );
      const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(`${cabecera}.${carga}`));
      return `${cabecera}.${carga}.${base64url(new Uint8Array(firma))}`;
    },
  };

  banco.env = {
    ASSETS: { fetch: async () => new Response('<!doctype html><title>Panel</title>', { headers: { 'Content-Type': 'text/html' } }) },
    DB: db,
    INSTALADORES: r2,
    EMAIL: email,
    LIMITE_FORMULARIOS: limitador(banco, 'formularios'),
    LIMITE_EVENTOS: limitador(banco, 'eventos'),
    ORIGEN,
    CORREO_PROVEEDOR: 'cloudflare',
    CORREO_REMITENTE: 'avisos@inmutalkey.com',
    CORREO_AVISOS: 'contacto@inmutalkey.com',
    TURNSTILE_HOSTNAMES: 'inmutalkey.com',
    ACCESS_EQUIPO: EQUIPO,
    ACCESS_AUD: AUD,
    ADMIN_CORREOS: ADMIN,
    R2_BUCKET: 'inmutalkey-instaladores',
    R2_CUENTA_ID: 'cuenta123',
    R2_ACCESS_KEY_ID: 'AKIAPRUEBA',
    R2_SECRET_ACCESS_KEY: 'secreto-de-prueba',
    TURNSTILE_SECRET: 'secreto-turnstile',
    LIMITE_SAL: 'sal-de-prueba',
    ...extra,
  };
  return banco;
}

const app = crearApp();

/** Un lead válido (el que mandaría el formulario). */
export function leadValido(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: 'Dra. Ana López',
    correo: 'ana.lopez@ejemplo.mx',
    telefono: '229 152 5800',
    especialidad: 'Medicina interna',
    estado: 'Veracruz',
    ciudad: 'Veracruz',
    tipo_practica: 'consultorio_propio',
    pacientes_semana_rango: '21_50',
    so: 'windows',
    como_se_entero: 'tarjeta',
    usa_hoy: 'papel',
    consentimiento: true,
    version_aviso: '2026-10-27-borrador',
    utm_source: 'tarjeta',
    turnstile: TURNSTILE_BUENO,
    ...cambios,
  };
}

/** Extrae el token de un enlace /api/confirmar/<token> o /api/descarga/<token> dentro de un correo. */
export function tokenDe(texto: string, tipo: 'confirmar' | 'descarga'): string {
  const coincidencia = new RegExp(`/api/${tipo}/([A-Za-z0-9_-]{43})`).exec(texto);
  if (!coincidencia?.[1]) throw new Error(`No hay enlace de ${tipo} en el correo`);
  return coincidencia[1];
}

/** Crea un lead confirmado y devuelve su id. */
export async function leadConfirmado(banco: Banco, correo = 'ana.lopez@ejemplo.mx'): Promise<number> {
  await banco.json('/api/leads', leadValido({ correo }));
  const token = tokenDe(banco.correos.at(-1)?.text ?? '', 'confirmar');
  await banco.json('/api/confirmar', { token });
  const fila = await banco.db.prepare('SELECT id FROM leads WHERE correo = ?1').bind(correo).first<{ id: number }>();
  if (!fila) throw new Error('lead no creado');
  return fila.id;
}

export async function cabecerasAdmin(banco: Banco): Promise<Record<string, string>> {
  return { 'Cf-Access-Jwt-Assertion': await banco.jwt(), Origin: ORIGEN };
}
