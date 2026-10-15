// Capturas reales de la app para la galería "Así se ve trabajando".
//
//   npm run capturas
//
// Entrada: capturas/*.{png,jpg,jpeg,webp} (los originales que sube Alan; se versionan en el repo).
//   · Los archivos con "logo" en el nombre no son capturas (los usa generar-marca.mjs).
//   · Textos opcionales en capturas/textos.json: { "archivo.png": { "titulo": "…", "descripcion": "…", "orden": 1 } }
// Salida: public/capturas/<slug>-{960,1600}.{avif,webp} y src/data/capturas.json (orden, textos y dimensiones).

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const ANCHOS = [960, 1600];
const IMAGEN = /\.(png|jpe?g|webp)$/i;

function slug(nombre) {
  return nombre
    .replace(IMAGEN, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const dir = raiz('capturas');
  const salida = raiz('public/capturas');
  const archivos = existsSync(dir) ? (await readdir(dir)).filter((n) => IMAGEN.test(n) && !/logo/i.test(n)) : [];
  const crudos = existsSync(`${dir}/textos.json`) ? JSON.parse(await readFile(`${dir}/textos.json`, 'utf8')) : {};
  // Nombres con acentos o ñ pueden llegar en NFC o NFD según el sistema que los subió.
  const textos = Object.fromEntries(Object.entries(crudos).map(([k, v]) => [k.normalize('NFC'), v]));

  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });

  const capturas = [];
  for (const nombre of archivos) {
    const ruta = `${dir}/${nombre}`;
    const meta = await sharp(ruta).metadata();
    const ancho = meta.width ?? 0;
    const alto = meta.height ?? 0;
    const id = slug(nombre);
    const anchos = ANCHOS.filter((w) => w < ancho);
    anchos.push(Math.min(ancho, ANCHOS[ANCHOS.length - 1] ?? ancho));
    const unicos = [...new Set(anchos)].sort((a, b) => a - b);
    for (const w of unicos) {
      const base = sharp(ruta).rotate().resize({ width: w });
      await base.clone().avif({ quality: 60, effort: 6 }).toFile(`${salida}/${id}-${w}.avif`);
      await base.clone().webp({ quality: 84, effort: 6 }).toFile(`${salida}/${id}-${w}.webp`);
    }
    const t = textos[nombre.normalize('NFC')] ?? {};
    capturas.push({
      id,
      archivo: nombre,
      titulo: typeof t.titulo === 'string' ? t.titulo : 'InmutalKey en uso',
      descripcion: typeof t.descripcion === 'string' ? t.descripcion : '',
      orden: typeof t.orden === 'number' ? t.orden : 999,
      ancho,
      alto,
      anchos: unicos,
    });
  }
  capturas.sort((a, b) => a.orden - b.orden || a.archivo.localeCompare(b.archivo));
  await writeFile(raiz('src/data/capturas.json'), JSON.stringify(capturas, null, 1) + '\n');
  console.log(capturas.length ? `capturas: ${capturas.map((c) => c.id).join(', ')}` : 'capturas: ninguna en capturas/ (la galería no se muestra)');
}

await main();
