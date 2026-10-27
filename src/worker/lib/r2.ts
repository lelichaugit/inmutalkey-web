// URL prefirmada de corta duración para un instalador privado en R2 (API compatible con S3, firma SigV4).
// Las credenciales deben ser de SOLO LECTURA y limitadas al bucket de instaladores.

import { AwsClient } from 'aws4fetch';

import type { Env } from '../env';

export const SEGUNDOS_URL_FIRMADA = 300;

export class SinCredencialesR2 extends Error {
  override readonly name = 'SinCredencialesR2';
}

export async function urlFirmadaDescarga(env: Env, clave: string, nombreArchivo: string, segundos = SEGUNDOS_URL_FIRMADA): Promise<string> {
  if (!env.R2_CUENTA_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new SinCredencialesR2('Faltan credenciales de R2');
  const cliente = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const ruta = clave.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://${env.R2_CUENTA_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET)}/${ruta}`);
  url.searchParams.set('X-Amz-Expires', String(segundos));
  // Nombre limpio para la descarga (sin comillas ni saltos de línea que rompan el encabezado).
  const nombre = nombreArchivo.replace(/[^\w.() -]/g, '_');
  url.searchParams.set('response-content-disposition', `attachment; filename="${nombre}"`);
  const firmada = await cliente.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return firmada.url;
}
