// QR propio del perfil de Instagram (NO es el nametag oficial de Instagram): SVG vectorial generado en local.
//
//   npm run qr
//
// Corrección de errores "H", zona silenciosa de 4 módulos, sin APIs externas. Si existe el nametag oficial
// (public/img/qr-instagram.png, ver src/lib/qr.ts), la página usa ese y este archivo queda de respaldo.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

import { REDES } from '../src/data/socials.ts';

const instagram = REDES.find((r) => r.id === 'instagram');
if (!instagram) throw new Error('socials.ts no define Instagram.');

const svg = await QRCode.toString(instagram.url, {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin: 4,
  color: { dark: '#0d1b35', light: '#ffffff' },
});
const salida = fileURLToPath(new URL('../public/img/qr-instagram.svg', import.meta.url));
await mkdir(fileURLToPath(new URL('../public/img', import.meta.url)), { recursive: true });
await writeFile(salida, `${svg}\n`);
console.log(`QR → public/img/qr-instagram.svg (${instagram.url})`);
