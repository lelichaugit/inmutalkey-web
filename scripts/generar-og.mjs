// Imagen Open Graph (1200×630) de la marca «Cristal Sellado»: aurora Marino, logo plata oficial y eslogan, compuesta
// en HTML con la misma Inter Variable del sitio y fotografiada con Chromium (texto nítido, sin trazar letras a mano).
//
//   npm run og        → public/og.png (se versiona: Cloudflare no tiene navegador al compilar)
//
// Usa el Chromium de Playwright; si no está en su ruta por omisión, define PW_CHROMIUM con la ruta del ejecutable.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const url = (ruta) => pathToFileURL(raiz(ruta)).href;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Inter Variable'; src: url('${url('public/fonts/inter-variable.woff2')}') format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; }
body {
  position: relative; overflow: hidden; display: flex; align-items: center; gap: 72px; padding: 0 96px;
  font-family: 'Inter Variable', sans-serif; font-feature-settings: 'cv05' 1; color: #EEF4FB;
  background:
    radial-gradient(55% 75% at 10% 0%, rgba(61,124,201,.42), transparent 70%),
    radial-gradient(45% 70% at 95% 25%, rgba(34,77,115,.85), transparent 72%),
    radial-gradient(70% 60% at 65% 115%, rgba(61,124,201,.30), transparent 70%),
    linear-gradient(180deg, #032340, #043259 70%, #032340);
}
body::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px);
  background-size: 48px 48px; -webkit-mask-image: radial-gradient(70% 70% at 30% 40%, #000 30%, transparent 85%); }
.logo { position: relative; z-index: 1; height: 400px; width: auto; filter: drop-shadow(0 24px 40px rgba(0,4,12,.65)); }
.texto { position: relative; z-index: 1; display: grid; gap: 22px; }
.nombre { font-size: 34px; font-weight: 700; letter-spacing: -.02em; }
h1 { font-size: 72px; line-height: 1.02; font-weight: 700; letter-spacing: -.035em; max-width: 13ch; }
.eslogan { display: inline-flex; align-items: center; gap: 14px; color: #8EC3F2; font-size: 20px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; }
.eslogan::before { content: ''; width: 36px; height: 1px; background: currentColor; }
.dominio { color: #A9BCCF; font-size: 22px; font-weight: 500; }
</style></head><body>
<img class="logo" src="${url('public/brand/logo-plata-560.webp')}" alt="">
<div class="texto">
  <p class="nombre">InmutalKey</p>
  <h1>Su expediente clínico, sellado y en sus manos.</h1>
  <p class="eslogan">Expediente Clínico Privado</p>
  <p class="dominio">inmutalkey.com · NOM-004 · Sin nube</p>
</div>
</body></html>`;

const dir = await mkdtemp(join(tmpdir(), 'ik-og-'));
const pagina = join(dir, 'og.html');
await writeFile(pagina, html);
const navegador = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  const p = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(pagina).href, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: raiz('public/og.png'), type: 'png' });
  console.log('og: public/og.png (1200×630)');
} finally {
  await navegador.close();
  await rm(dir, { recursive: true, force: true });
}
