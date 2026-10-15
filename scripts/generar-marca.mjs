// Genera las piezas de marca del sitio a partir de src/data/logo.json y, si existe, del render 3D del isotipo.
//
//   npm run marca
//
// Salida en public/:
//   favicon.svg · favicon.ico (PNG dentro de ICO, 16 y 32) · apple-touch-icon.png (180)
//   icon-192.png · icon-512.png · icon-maskable-512.png · og.png (1200×630, texto convertido a trazos)
//   brand/isotipo-3d-{480,800,1200}.{avif,webp}  ← render 3D: public/brand/originales/isotipo-3d.* o capturas/logomainscroll*
//   brand/avatar-chat-{96,192}.webp              ← avatar del chat simulado: capturas/*logowsp*
// y src/data/marca.json (qué piezas existen y sus dimensiones; el sitio usa respaldos planos si faltan).
//
// El render 3D es blanco sobre negro: se "aplasta" el negro a 0 para que con `mix-blend-mode: screen`
// se funda sin borde con cualquier fondo oscuro del sitio (y con la luz azul de la tarjeta).

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';
import sharp from 'sharp';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));

const AZUL_MARINO = '#0d1b35';
const MEDIANOCHE = '#060b16';
const TEXTO = '#eef3f9';
const TEXTO_TENUE = '#a9b6c8';
// El render se usa por ALTO (la llave es vertical): versiones a estos altos, o al alto real si es menor.
const ALTOS_ISOTIPO = [360, 640, 960];

const logo = JSON.parse(await readFile(raiz('src/data/logo.json'), 'utf8'));
const [, , ANCHO_LOGO, ALTO_LOGO] = logo.viewBox.split(' ').map(Number);

/** Isotipo sólido como grupo SVG de `alto` px con la esquina superior izquierda en (x, y). */
function isotipo({ x, y, alto, base = '#ffffff' }) {
  const s = alto / ALTO_LOGO;
  const paths = logo.solido
    .map((c) => `<path fill="${c.color === 'currentColor' ? base : c.color}" d="${c.d}"/>`)
    .join('');
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(5)})">${paths}</g>`;
}

/** Isotipo centrado en un lienzo cuadrado de `lado` px, ocupando `proporcion` del alto. */
function iconoCuadrado({ lado, proporcion, radio = 0, fondo = AZUL_MARINO }) {
  const alto = lado * proporcion;
  const ancho = (alto * ANCHO_LOGO) / ALTO_LOGO;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">`
    + `<rect width="${lado}" height="${lado}" rx="${radio}" fill="${fondo}"/>`
    + isotipo({ x: (lado - ancho) / 2, y: (lado - alto) / 2, alto })
    + '</svg>';
}

/** ICO con imágenes PNG embebidas (válido desde Windows Vista y en todos los navegadores). */
function empacarIco(pngs) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(pngs.length, 4);
  let desplazamiento = 6 + 16 * pngs.length;
  const entradas = pngs.map(({ lado, datos }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0);
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(datos.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    desplazamiento += datos.length;
    return e;
  });
  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.datos)]);
}

async function fuente(ruta) {
  const b = await readFile(raiz(ruta));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/**
 * Texto → trazos, glifo por glifo con kerning GPOS. Se evita `font.getPath` porque opentype.js 2.0
 * no soporta algunas sustituciones `ccmp` de Inter (lookupType 6, formato 2) y aborta.
 */
function texto(f, cadena, x, y, tam, color, espaciado = 0) {
  const escala = tam / f.unitsPerEm;
  const glifos = [...cadena].map((c) => f.charToGlyph(c));
  const partes = [];
  let cx = x;
  glifos.forEach((g, i) => {
    partes.push(g.getPath(cx, y, tam).toPathData(2));
    cx += (g.advanceWidth ?? 0) * escala + espaciado * tam;
    const siguiente = glifos[i + 1];
    if (siguiente) {
      try {
        cx += f.getKerningValue(g, siguiente) * escala;
      } catch {
        // sin kerning para este par
      }
    }
  });
  return `<path fill="${color}" d="${partes.join('')}"/>`;
}

const IMAGEN = /\.(png|jpe?g|webp)$/i;

/** Primer archivo de `capturas/` cuyo nombre cumpla `patron`. */
async function enCapturas(patron) {
  const dir = raiz('capturas');
  if (!existsSync(dir)) return null;
  const nombre = (await readdir(dir)).filter((n) => IMAGEN.test(n) && patron.test(n)).sort()[0];
  return nombre ? `${dir}/${nombre}` : null;
}

async function buscarRender() {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const ruta = raiz(`public/brand/originales/isotipo-3d.${ext}`);
    if (existsSync(ruta)) return ruta;
  }
  return enCapturas(/logomainscroll/i);
}

/** Negro del fondo del render: mediana de luminancia en las cuatro esquinas. */
async function nivelDeNegro(ruta) {
  const { data, info } = await sharp(ruta).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const m = Math.max(8, Math.round(Math.min(info.width, info.height) * 0.04));
  const muestras = [];
  for (const [x0, y0] of [[0, 0], [info.width - m, 0], [0, info.height - m], [info.width - m, info.height - m]]) {
    for (let y = y0; y < y0 + m; y++) for (let x = x0; x < x0 + m; x++) muestras.push(data[y * info.width + x]);
  }
  muestras.sort((a, b) => a - b);
  return muestras[Math.floor(muestras.length * 0.9)] ?? 0;
}

/** Render con el negro llevado a 0 (para `mix-blend-mode: screen`). */
async function renderLimpio(ruta) {
  const negro = Math.min(await nivelDeNegro(ruta) + 4, 60);
  const a = 255 / (255 - negro);
  return sharp(ruta).removeAlpha().toColourspace('srgb').linear(a, -negro * a);
}

/**
 * Render limpio y RECORTADO a la llave (con un 4 % de aire): el original es un cuadrado con mucho negro alrededor y,
 * sin recortar, la llave se vería diminuta al darle un alto en la página. Devuelve un PNG en memoria.
 */
async function renderRecortado(ruta) {
  const limpio = await (await renderLimpio(ruta)).png().toBuffer();
  const { data, info } = await sharp(limpio).trim({ background: '#000000', threshold: 24 }).png().toBuffer({ resolveWithObject: true });
  const aire = Math.round(info.height * 0.04);
  return sharp(data).extend({ top: aire, bottom: aire, left: aire, right: aire, background: '#000000' }).png().toBuffer();
}

async function main() {
  await mkdir(raiz('public/brand'), { recursive: true });

  // ── Favicons e iconos de app ──
  const favicon = iconoCuadrado({ lado: 64, proporcion: 0.84, radio: 14 });
  await writeFile(raiz('public/favicon.svg'), favicon + '\n');

  const ico = [];
  for (const lado of [16, 32]) {
    const svg = iconoCuadrado({ lado: 64, proporcion: lado === 16 ? 0.9 : 0.84, radio: 14 });
    ico.push({ lado, datos: await sharp(Buffer.from(svg), { density: (72 * lado) / 64 * 4 }).resize(lado, lado).png().toBuffer() });
  }
  await writeFile(raiz('public/favicon.ico'), empacarIco(ico));

  const png = (svg, lado, destino) =>
    sharp(Buffer.from(svg), { density: 300 }).resize(lado, lado).png({ compressionLevel: 9 }).toFile(raiz(destino));
  await png(iconoCuadrado({ lado: 180, proporcion: 0.74 }), 180, 'public/apple-touch-icon.png');
  await png(iconoCuadrado({ lado: 192, proporcion: 0.78, radio: 40 }), 192, 'public/icon-192.png');
  await png(iconoCuadrado({ lado: 512, proporcion: 0.78, radio: 108 }), 512, 'public/icon-512.png');
  await png(iconoCuadrado({ lado: 512, proporcion: 0.6 }), 512, 'public/icon-maskable-512.png');

  // ── Render 3D (logo principal del hero) ──
  const render = await buscarRender();
  let datosIsotipo = { disponible: false };
  for (const viejo of (await readdir(raiz('public/brand'))).filter((n) => /^isotipo-3d-\d+\.(avif|webp)$/.test(n))) {
    await rm(raiz(`public/brand/${viejo}`));
  }
  if (render) {
    const recorte = await renderRecortado(render);
    const meta = await sharp(recorte).metadata();
    const anchoOriginal = meta.width ?? 0;
    const altoOriginal = meta.height ?? 0;
    const altos = [...new Set([...ALTOS_ISOTIPO.filter((h) => h < altoOriginal), altoOriginal])].sort((a, b) => a - b);
    const anchos = [];
    for (const h of altos) {
      const w = Math.round((h * anchoOriginal) / altoOriginal);
      anchos.push(w);
      const base = sharp(recorte).resize({ width: w, height: h });
      await base.clone().avif({ quality: 60, effort: 7 }).toFile(raiz(`public/brand/isotipo-3d-${w}.avif`));
      await base.clone().webp({ quality: 84, effort: 6 }).toFile(raiz(`public/brand/isotipo-3d-${w}.webp`));
    }
    // Máscara alfa (blanco + alfa = luminancia) con la misma geometría, para recortar el brillo a la silueta.
    const gris = await sharp(recorte).resize({ height: Math.min(640, altoOriginal) }).greyscale().raw().toBuffer({ resolveWithObject: true });
    await sharp({ create: { width: gris.info.width, height: gris.info.height, channels: 3, background: '#ffffff' } })
      .joinChannel(gris.data, { raw: { width: gris.info.width, height: gris.info.height, channels: 1 } })
      .webp({ quality: 80, alphaQuality: 80 })
      .toFile(raiz('public/brand/isotipo-3d-mascara.webp'));
    datosIsotipo = { disponible: true, ancho: anchoOriginal, alto: altoOriginal, anchos };
    console.log(`isotipo 3D recortado a ${anchoOriginal}×${altoOriginal}: anchos ${anchos.join(', ')} px (AVIF + WebP)`);
  } else {
    console.warn('isotipo 3D: falta capturas/logomainscroll.* (o public/brand/originales/isotipo-3d.*) — el hero usará el isotipo plano.');
  }

  // ── Avatar del chat simulado ──
  const avatar = await enCapturas(/logowsp/i);
  let datosAvatar = { disponible: false };
  if (avatar) {
    for (const lado of [96, 192]) {
      await sharp(avatar).resize(lado, lado, { fit: 'cover' }).webp({ quality: 86 }).toFile(raiz(`public/brand/avatar-chat-${lado}.webp`));
    }
    datosAvatar = { disponible: true };
    console.log('avatar del chat: 96 y 192 px');
  }
  await writeFile(raiz('src/data/marca.json'), JSON.stringify({ isotipo: datosIsotipo, avatar: datosAvatar }, null, 1) + '\n');

  // ── Imagen para redes (OG) ──
  const outfit = await fuente('scripts/assets/outfit-latin-600-normal.woff');
  const inter = await fuente('scripts/assets/inter-latin-500-normal.woff');
  const W = 1200;
  const H = 630;
  const X = 84;
  const lineasCuadricula = [];
  for (let x = 0; x <= W; x += 56) lineasCuadricula.push(`<path d="M${x} 0V${H}"/>`);
  for (let y = 0; y <= H; y += 56) lineasCuadricula.push(`<path d="M0 ${y}H${W}"/>`);

  const zonaIsotipo = { x: 860, y: 40, ancho: 300, alto: 550 };
  const isotipoPlano = render
    ? ''
    : isotipo({ x: zonaIsotipo.x + (zonaIsotipo.ancho - (480 * ANCHO_LOGO) / ALTO_LOGO) / 2, y: 75, alto: 480 });

  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <radialGradient id="luz" cx="0.92" cy="1.08" r="0.75"><stop offset="0" stop-color="#0178b0" stop-opacity="0.55"/><stop offset="1" stop-color="#0178b0" stop-opacity="0"/></radialGradient>
  <radialGradient id="mascara" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#mascara)"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="${MEDIANOCHE}"/>
<g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1" mask="url(#m)">${lineasCuadricula.join('')}</g>
<rect width="${W}" height="${H}" fill="url(#luz)"/>
${texto(outfit, 'InmutalKey', X, 196, 92, TEXTO, -0.02)}
${texto(inter, 'Expediente clínico para tu consultorio.', X, 288, 34, TEXTO)}
${texto(inter, 'Cada nota queda sellada: nadie puede alterarla.', X, 336, 34, TEXTO)}
${texto(inter, 'Diseñado para la NOM-004 · Sin internet · En tu computadora', X, 520, 25, TEXTO_TENUE)}
${isotipoPlano}
</svg>`;

  let lienzo = sharp(Buffer.from(og)).resize(W, H);
  if (render) {
    const alto = zonaIsotipo.alto;
    const capa = await sharp(await renderRecortado(render)).resize({ height: alto, width: zonaIsotipo.ancho, fit: 'inside' }).png().toBuffer();
    const { width = 0 } = await sharp(capa).metadata();
    lienzo = sharp(await lienzo.png().toBuffer()).composite([
      { input: capa, left: Math.round(zonaIsotipo.x + (zonaIsotipo.ancho - width) / 2), top: zonaIsotipo.y, blend: 'screen' },
    ]);
  }
  await lienzo.png({ compressionLevel: 9, palette: false }).toFile(raiz('public/og.png'));

  console.log('marca: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192/512, icon-maskable-512, og.png');
}

await main();
