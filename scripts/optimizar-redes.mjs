// Logos de redes: SVG oficiales de simple-icons → SVGO → src/assets/redes/*.svg (versionados; el sitio no carga nada externo).
//
//   npm run redes
//
// Fuente: node_modules/simple-icons/icons/<id>.svg. LinkedIn ya no está en simple-icons (se retiró en la v14): su original
// oficial (v13.21.0) vive en scripts/assets/redes/linkedin.svg y se usa como respaldo para cualquier icono ausente.
// Los originales se copian a scripts/assets/redes/ para poder regenerar sin red.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { optimize } from 'svgo';

const raiz = (ruta) => fileURLToPath(new URL(`../${ruta}`, import.meta.url));
const REDES = ['instagram', 'x', 'linkedin', 'whatsapp'];

await mkdir(raiz('scripts/assets/redes'), { recursive: true });
await mkdir(raiz('src/assets/redes'), { recursive: true });

for (const id of REDES) {
  const paquete = raiz(`node_modules/simple-icons/icons/${id}.svg`);
  const original = raiz(`scripts/assets/redes/${id}.svg`);
  if (existsSync(paquete)) await copyFile(paquete, original);
  else if (!existsSync(original)) throw new Error(`Falta el SVG de ${id} (ni simple-icons ni scripts/assets/redes/).`);

  const { data } = optimize(await readFile(original, 'utf8'), {
    multipass: true,
    // 4 decimales: la retícula 24×24 sigue siendo exacta a 4K; el path no pierde fidelidad visible.
    floatPrecision: 4,
    plugins: [
      'preset-default',
      'removeTitle',
      { name: 'removeAttrs', params: { attrs: ['role'] } },
    ],
  });
  await writeFile(raiz(`src/assets/redes/${id}.svg`), `${data}\n`);
  console.log(`${id}: ${(await readFile(original, 'utf8')).length} → ${data.length} bytes`);
}
