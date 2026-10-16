// Revisión multi-dispositivo del sitio publicado o local: la misma que se usó para validar las escenas.
//
//   npm run build:cloudflare && npx wrangler dev          (sirve dist/ con los encabezados reales, CSP incluida)
//   npm run revisar                                       (otra terminal; por omisión http://127.0.0.1:8787/)
//   npm run revisar -- https://inmutalkey.com/ --capturas
//
// Navegador: el Chromium de Playwright (`npx playwright install chromium` una vez) o el que indique CHROMIUM_PATH.
// Recorre la portada en pasos de media pantalla en iPhone (dos altos), Android de 360 px, iPad Mini y escritorio
// 1366/1440, más movimiento reducido y sin JS. Falla (código 1) si encuentra:
//   · desplazamiento horizontal · errores de consola o de página · violaciones de CSP · CLS > 0.1
//   · una escena fijada cuyo escenario no está pegado arriba mientras la escena cruza la ventana
// Con --capturas guarda cada escena en p = 0.3 / 0.5 / 0.75 (iPhone y 1440) en capturas-revision/ (no se versiona).

import { mkdir } from 'node:fs/promises';

import { chromium, devices } from 'playwright';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a)) ?? 'http://127.0.0.1:8787/';
const conCapturas = args.includes('--capturas');
const carpeta = new URL('../capturas-revision/', import.meta.url);

const PERFILES = [
  ['iphone13', { ...devices['iPhone 13'] }, ['normal', 'reducido', 'sinjs']],
  ['iphone-bajo', { ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }, ['normal']],
  ['android360', { ...devices['Galaxy S8'] }, ['normal']],
  ['ipadmini', { ...devices['iPad Mini'] }, ['normal']],
  ['e1366', { viewport: { width: 1366, height: 768 } }, ['normal']],
  ['e1440', { viewport: { width: 1440, height: 900 } }, ['normal', 'reducido', 'sinjs']],
];

if (conCapturas) await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problemas = [];

for (const [nombre, base, modos] of PERFILES) {
  for (const modo of modos) {
    const ctx = await navegador.newContext({
      ...base,
      reducedMotion: modo === 'reducido' ? 'reduce' : 'no-preference',
      javaScriptEnabled: modo !== 'sinjs',
    });
    const pagina = await ctx.newPage();
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errores.push(m.text().slice(0, 200));
    });
    await pagina.addInitScript(() => {
      window.__cls = 0;
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await pagina.goto(url, { waitUntil: 'load' });
    await pagina.waitForTimeout(2200);
    const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
    const vh = await pagina.evaluate(() => innerHeight);
    let desborde = 0;
    const fijadas = {};

    for (let y = 0; y < alto; y += Math.round(vh * 0.5)) {
      await pagina.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
      await pagina.waitForTimeout(90);
      const r = await pagina.evaluate(() => ({
        sw: document.documentElement.scrollWidth - innerWidth,
        escenas: [...document.querySelectorAll('[data-escena]')].flatMap((e) => {
          const escenario = e.querySelector('[data-escenario]');
          if (!escenario || getComputedStyle(escenario).position !== 'sticky') return [];
          const caja = e.getBoundingClientRect();
          if (!(caja.top < -50 && caja.bottom > innerHeight + 50)) return [];
          return [{ id: e.id || e.className.split(' ')[0], top: Math.round(escenario.getBoundingClientRect().top) }];
        }),
      }));
      desborde = Math.max(desborde, r.sw);
      for (const e of r.escenas) {
        fijadas[e.id] ??= { vistas: 0, sueltas: 0 };
        fijadas[e.id].vistas++;
        if (Math.abs(e.top) > 2) fijadas[e.id].sueltas++;
      }
    }

    const fin = await pagina.evaluate(() => ({ cls: window.__cls, csp: window.__csp }));
    const sueltas = Object.entries(fijadas).filter(([, v]) => v.sueltas > 0).map(([k]) => k);
    const etiqueta = `${nombre}/${modo}`;
    if (desborde > 0) problemas.push(`${etiqueta}: desplazamiento horizontal de ${desborde}px`);
    if (errores.length > 0) problemas.push(`${etiqueta}: ${errores.length} errores (${errores[0]})`);
    if (fin.csp.length > 0) problemas.push(`${etiqueta}: CSP ${fin.csp.join(', ')}`);
    if (fin.cls > 0.1) problemas.push(`${etiqueta}: CLS ${fin.cls.toFixed(3)}`);
    if (sueltas.length > 0) problemas.push(`${etiqueta}: escenas que no se quedan fijas: ${sueltas.join(', ')}`);
    console.log(
      `${etiqueta.padEnd(20)} alto ${String(alto).padStart(6)}  desborde ${desborde}px  CLS ${fin.cls.toFixed(4)}  ` +
        `errores ${errores.length}  CSP ${fin.csp.length}  fijadas ${Object.keys(fijadas).join(', ') || '—'}`,
    );

    if (conCapturas && modo === 'normal' && (nombre === 'iphone13' || nombre === 'e1440')) {
      const escenas = await pagina.evaluate(() =>
        [...document.querySelectorAll('[data-escena]')].map((e) => ({
          id: e.id || e.className.split(' ')[0],
          top: e.getBoundingClientRect().top + scrollY,
          alto: e.offsetHeight,
        })),
      );
      for (const e of escenas) {
        for (const f of [0.3, 0.5, 0.75]) {
          await pagina.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), Math.round(e.top + f * (e.alto - vh)));
          await pagina.waitForTimeout(500);
          await pagina.screenshot({ path: new URL(`${nombre}-${e.id}-${Math.round(f * 100)}.png`, carpeta) });
        }
      }
    }
    await ctx.close();
  }
}

await navegador.close();
if (problemas.length > 0) {
  console.error(`\n${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}
console.log('\nSin problemas en ningún perfil.');
