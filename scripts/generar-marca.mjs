// Piezas de marca del sitio a partir de los activos OFICIALES de la app v0.4.0 «Cristal Sellado» (carpeta marca/).
// No se redibuja ni se recolorea nada: solo se recorta el margen transparente, se escala y se comprime.
//
//   npm run marca
//
// Entrada (copiada tal cual de lelichaugit/clinica-nom004, tag v0.4.0):
//   marca/logo-plata.png        ← src/assets/logo-oscuro.png   (temas oscuros, hero sobre Marino/Abismo)
//   marca/logo-azul.png         ← src/assets/logo.png          (temas claros)
//   marca/logo-mono*.svg        ← src/assets/logo-mono.svg y docs/marca/logo-mono-{negro,blanco}.svg
//   marca/app-icon.png          ← app-icon.png (icono de escritorio)
// Salida en public/:
//   brand/logo-{plata,azul}-{alto}.{avif,webp} · brand/logo-mono{,-blanco,-negro}.svg
//   favicon.ico (16, 32, 48) · favicon-32.png · apple-touch-icon.png (180, fondo Marino)
//   icon-192.png · icon-512.png · icon-maskable-512.png
// y src/data/marca.json (dimensiones reales de cada variante, para declarar width/height y evitar CLS).
// La imagen Open Graph se genera aparte con `npm run og` (necesita Chromium y la fuente Inter: se versiona).

import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));

const MARINO = '#043259';
/** Altos en px de cada variante del símbolo (1x y 2x de los tamaños que usa el sitio: barra 32, pie 40, hero 140–280). */
const ALTOS = { plata: [64, 128, 280, 420, 560], azul: [64, 128] };

/** ICO con imágenes PNG embebidas (válido desde Windows Vista y en todos los navegadores). */
function empacarIco(pngs) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(pngs.length, 4);
  const entradas = [];
  let desplazamiento = 6 + 16 * pngs.length;
  for (const { lado, datos } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0);
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(datos.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    desplazamiento += datos.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.datos)]);
}

async function simbolo(variante) {
  const recortado = await sharp(raiz(`marca/logo-${variante}.png`)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const { width, height } = recortado.info;
  const salida = [];
  for (const alto of ALTOS[variante]) {
    const ancho = Math.round((width * alto) / height);
    const base = sharp(recortado.data).resize({ height: alto, kernel: 'lanczos3' });
    await base.clone().avif({ quality: 64, effort: 7 }).toFile(raiz(`public/brand/logo-${variante}-${alto}.avif`));
    await base.clone().webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(raiz(`public/brand/logo-${variante}-${alto}.webp`));
    salida.push({ alto, ancho });
  }
  return { proporcion: +(height / width).toFixed(4), tamanos: salida };
}

async function main() {
  await mkdir(raiz('public/brand'), { recursive: true });
  for (const f of await readdir(raiz('public/brand'))) {
    if (/^logo-(plata|azul)-\d+\.(avif|webp)$/.test(f)) await rm(raiz(`public/brand/${f}`));
  }

  const plata = await simbolo('plata');
  const azul = await simbolo('azul');
  for (const v of ['logo-mono', 'logo-mono-blanco', 'logo-mono-negro']) await copyFile(raiz(`marca/${v}.svg`), raiz(`public/brand/${v}.svg`));

  // Icono de escritorio: el cuadro redondeado del render ocupa ~93 % del lienzo de 1024 px.
  const icono = raiz('marca/app-icon.png');
  const png = (lado) => sharp(icono).resize(lado, lado, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(raiz('public/favicon.ico'), empacarIco(await Promise.all([16, 32, 48].map(async (lado) => ({ lado, datos: await png(lado) })))));
  await writeFile(raiz('public/favicon-32.png'), await png(32));
  await writeFile(raiz('public/icon-192.png'), await png(192));
  await writeFile(raiz('public/icon-512.png'), await png(512));
  // iOS y Android enmascaran: el cuadro recortado sobre Marino, sin esquinas transparentes que se vuelvan negras.
  const cuadro = await sharp(icono).trim({ threshold: 1 }).toBuffer();
  const escalado = async (lado, proporcion) =>
    sharp({ create: { width: lado, height: lado, channels: 4, background: MARINO } })
      .composite([{ input: await sharp(cuadro).resize(Math.round(lado * proporcion), Math.round(lado * proporcion)).toBuffer(), gravity: 'center' }])
      .flatten({ background: MARINO })
      .png({ compressionLevel: 9 })
      .toBuffer();
  await writeFile(raiz('public/apple-touch-icon.png'), await escalado(180, 1));
  await writeFile(raiz('public/icon-maskable-512.png'), await escalado(512, 0.86));

  await writeFile(raiz('src/data/marca.json'), JSON.stringify({ plata, azul }, null, 1) + '\n');
  console.log(`marca: plata ${plata.tamanos.map((t) => t.alto).join('/')} · azul ${azul.tamanos.map((t) => t.alto).join('/')} · iconos y favicon`);
}

await main();
