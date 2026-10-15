// Genera las piezas de marca del sitio a partir de src/data/logo.json y, si existe, del render 3D del isotipo.
//
//   npm run marca
//
// Salida en public/:
//   favicon.svg · favicon.ico (PNG dentro de ICO, 16 y 32) · apple-touch-icon.png (180)
//   icon-192.png · icon-512.png · icon-maskable-512.png · og.png (1200×630, texto convertido a trazos)
//   brand/llave-3d-{152,304,456,608}.{avif,webp} + brand/llave-silueta.webp
//                                                ← llave 3D con alfa: capturas/logomain-3d.png + logomain-silueta.png
//   brand/avatar-chat-{96,192}.webp              ← avatar del chat simulado: capturas/*logowsp*
// y src/data/marca.json (qué piezas existen y sus dimensiones; el sitio usa respaldos planos si faltan).
//
// La llave 3D sale con transparencia real (máscara de silueta), no con `mix-blend-mode`: la mezcla se rompe en cuanto
// un ancestro tiene transform/opacity (el negro aparecía como un recuadro) y Safari la trata distinto.

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
// La llave se usa por ALTO (es vertical). Mide 724 px en el marco original; 1086 y 1448 son ampliaciones Lanczos para
// pantallas de alta densidad (si Alan sube un render más grande, basta con cambiar MARCO_LLAVE).
const ALTOS_LLAVE = [362, 724, 1086, 1448];

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

/**
 * Marco de la llave dentro del lienzo de 1024 px de `capturas/logomain-*.png` (los tres salen de
 * capturas/cleanmainweblogo.svg y están alineados píxel a píxel). Igual que MARCO en scripts/vectorizar-llave.py:
 * así el contorno vectorial y el render quedan superpuestos exactamente.
 */
const MARCO_LLAVE = { x: 360, y: 150, ancho: 304, alto: 724 };

/** Primer archivo de `capturas/` con ese nombre exacto (sin importar mayúsculas). */
async function archivoEnCapturas(nombre) {
  const dir = raiz('capturas');
  if (!existsSync(dir)) return null;
  const real = (await readdir(dir)).find((n) => n.toLowerCase() === nombre);
  return real ? `${dir}/${real}` : null;
}

/** Negro del fondo del render: percentil 90 de luminancia en las cuatro esquinas. */
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

/**
 * La llave 3D como PNG RGBA con transparencia real, recortada a MARCO_LLAVE.
 *
 * Fuente preferida: `logomain-3d.png` (render sobre negro) + `logomain-silueta.png` (máscara de la silueta, con bordes
 * suaves). El render se compuso sobre negro, así que en el borde su color viene oscurecido en la misma proporción que
 * la cobertura: se divide entre el alfa (des-premultiplicar) para que el filo no deje un halo oscuro sobre fondos claros.
 *
 * Respaldo: solo `logomainscroll.*` (render sobre negro, sin máscara) → alfa = brillo tras llevar el negro a 0.
 */
async function llaveConAlfa() {
  const { x, y, ancho, alto } = MARCO_LLAVE;
  const recorte = { left: x, top: y, width: ancho, height: alto };
  const render = await archivoEnCapturas('logomain-3d.png');
  const silueta = await archivoEnCapturas('logomain-silueta.png');
  const respaldo = render ? null : await enCapturas(/logomainscroll/i);
  const fuenteColor = render ?? respaldo;
  if (!fuenteColor) return null;

  const meta = await sharp(fuenteColor).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`generar-marca: ${fuenteColor} debe medir 1024×1024 (MARCO_LLAVE está en esa escala).`);
  }

  let color = sharp(fuenteColor).removeAlpha().toColourspace('srgb');
  if (!silueta) {
    const negro = Math.min((await nivelDeNegro(fuenteColor)) + 4, 60);
    const k = 255 / (255 - negro);
    color = color.linear(k, -negro * k);
  }
  const rgb = await color.extract(recorte).raw().toBuffer();
  const alfa = silueta
    ? await sharp(silueta).removeAlpha().extract(recorte).toColourspace('b-w').raw().toBuffer()
    : null;

  const n = ancho * alto;
  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3] ?? 0;
    const g = rgb[i * 3 + 1] ?? 0;
    const b = rgb[i * 3 + 2] ?? 0;
    const a = alfa ? (alfa[i] ?? 0) : Math.max(r, g, b);
    // Des-premultiplicar con piso: en el filo más fino (alfa muy bajo) no se inventa brillo.
    const k = a > 0 ? 255 / Math.max(a, 96) : 0;
    rgba[i * 4] = Math.min(255, Math.round(r * k));
    rgba[i * 4 + 1] = Math.min(255, Math.round(g * k));
    rgba[i * 4 + 2] = Math.min(255, Math.round(b * k));
    rgba[i * 4 + 3] = a;
  }
  return {
    png: await sharp(rgba, { raw: { width: ancho, height: alto, channels: 4 } }).png().toBuffer(),
    fuente: silueta ? 'logomain-3d.png + logomain-silueta.png' : `${respaldo} (sin máscara: alfa por brillo)`,
  };
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

  // ── Llave 3D (logo principal) con transparencia real ──
  const llave = await llaveConAlfa();
  let datosLlave = { disponible: false };
  for (const viejo of (await readdir(raiz('public/brand'))).filter((n) => /^(isotipo-3d-|llave-3d-|llave-silueta)/.test(n))) {
    await rm(raiz(`public/brand/${viejo}`));
  }
  if (llave) {
    const { ancho, alto } = MARCO_LLAVE;
    const anchos = [];
    for (const h of ALTOS_LLAVE) {
      const w = Math.round((h * ancho) / alto);
      anchos.push(w);
      let base = sharp(llave.png).resize({ width: w, height: h, kernel: 'lanczos3' });
      // Las versiones ampliadas (más altas que el original) reciben un enfoque leve para no verse lavadas.
      if (h > alto) base = base.sharpen({ sigma: 0.6 });
      const lienzo = await base.png().toBuffer();
      await sharp(lienzo).avif({ quality: 62, effort: 7 }).toFile(raiz(`public/brand/llave-3d-${w}.avif`));
      await sharp(lienzo).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(raiz(`public/brand/llave-3d-${w}.webp`));
    }
    // Silueta (blanco + alfa) para recortar brillos y escáner a la forma exacta de la llave.
    const { data: alfa, info } = await sharp(llave.png).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    await sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
      .joinChannel(alfa, { raw: { width: info.width, height: info.height, channels: 1 } })
      .webp({ quality: 80, alphaQuality: 85 })
      .toFile(raiz('public/brand/llave-silueta.webp'));
    datosLlave = { disponible: true, ancho, alto, anchos };
    console.log(`llave 3D (${llave.fuente}): ${ancho}×${alto}, anchos ${anchos.join(', ')} px (AVIF + WebP con alfa)`);
  } else {
    console.warn('llave 3D: faltan capturas/logomain-3d.png + logomain-silueta.png (o logomainscroll.*) — se usará el isotipo plano.');
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
  await writeFile(raiz('src/data/marca.json'), JSON.stringify({ llave: datosLlave, avatar: datosAvatar }, null, 1) + '\n');

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
  const isotipoPlano = llave
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
  if (llave) {
    const alto = zonaIsotipo.alto;
    const capa = await sharp(llave.png).resize({ height: alto, width: zonaIsotipo.ancho, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    const { width = 0 } = await sharp(capa).metadata();
    lienzo = sharp(await lienzo.png().toBuffer()).composite([
      { input: capa, left: Math.round(zonaIsotipo.x + (zonaIsotipo.ancho - width) / 2), top: zonaIsotipo.y },
    ]);
  }
  await lienzo.png({ compressionLevel: 9, palette: false }).toFile(raiz('public/og.png'));

  console.log('marca: favicon.svg, favicon.ico, apple-touch-icon.png, icon-192/512, icon-maskable-512, og.png');
}

await main();
