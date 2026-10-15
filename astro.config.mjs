// @ts-check
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import { detectarEntorno } from './src/lib/entorno.ts';
import { revisarCss, revisarHtml } from './src/lib/guardian.ts';
import { enlaceWhatsApp } from './src/lib/whatsapp.ts';
import { pendientes, sitio } from './src/site.config.ts';

const SITIO = sitio.url;

/** @param {string} dir */
async function archivos(dir) {
  /** @type {string[]} */
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await archivos(ruta)));
    else salida.push(ruta);
  }
  return salida;
}

/**
 * Guardian del build: avisa lo pendiente y, en producción, detiene el build ante
 * lo que no debe publicarse.
 * @returns {import('astro').AstroIntegration}
 */
function guardian() {
  /** @type {import('./src/lib/entorno.ts').Entorno} */
  let entorno = 'produccion';
  return {
    name: 'guardian',
    hooks: {
      'astro:config:setup': ({ command, logger }) => {
        entorno = detectarEntorno(process.env, { servidorDev: command === 'dev' });
        logger.info(`entorno: ${entorno}`);
        const faltan = pendientes();
        if (faltan.length > 0) logger.warn(`TODO_DEFINIR (${faltan.length}): ${faltan.join(', ')}`);
        if (entorno === 'produccion' && command === 'build' && enlaceWhatsApp(sitio.contacto.whatsapp, '') === null) {
          throw new Error('guardian: falta un número de WhatsApp válido en src/site.config.ts (contacto.whatsapp).');
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        /** @type {string[]} */
        const hallazgos = [];
        for (const ruta of await archivos(raiz)) {
          const rel = relative(raiz, ruta);
          if (ruta.endsWith('.html')) {
            for (const p of revisarHtml(await readFile(ruta, 'utf8'), SITIO)) hallazgos.push(`${rel}: ${p}`);
          } else if (ruta.endsWith('.css')) {
            for (const p of revisarCss(await readFile(ruta, 'utf8'), SITIO)) hallazgos.push(`${rel}: ${p}`);
          }
        }
        if (hallazgos.length === 0) {
          logger.info('sin hallazgos (CSP, terceros, reseñas de ejemplo)');
          return;
        }
        const texto = hallazgos.map((h) => `  · ${h}`).join('\n');
        if (entorno === 'produccion') throw new Error(`guardian: el build de producción no se publica:\n${texto}`);
        logger.warn(`hallazgos (se permiten fuera de producción):\n${texto}`);
      },
    },
  };
}

export default defineConfig({
  site: SITIO,
  output: 'static',
  trailingSlash: 'never',
  compressHTML: true,
  devToolbar: { enabled: false },
  build: {
    format: 'file',
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Nada de scripts/recursos incrustados: la CSP no permite 'unsafe-inline' ni data:.
      assetsInlineLimit: 0,
    },
  },
  integrations: [guardian()],
});
