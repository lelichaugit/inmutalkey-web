import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import jsQR from 'jsqr';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { redPorId } from '../src/data/socials';
import { buscarQrInstagram } from '../src/lib/qr';

const QR = fileURLToPath(new URL('../public/img/qr-instagram.svg', import.meta.url));

describe('QR de Instagram', () => {
  it('el QR generado se decodifica a la URL exacta del perfil', async () => {
    const { data, info } = await sharp(QR, { density: 300 }).resize(540).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const leido = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
    expect(leido?.data).toBe(redPorId('instagram').url);
  });

  it('se lee también a 180 px (tamaño en pantalla)', async () => {
    const { data, info } = await sharp(QR).resize(180).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const leido = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
    expect(leido?.data).toBe('https://www.instagram.com/inmutalkey/');
  });

  it('sin nametag oficial usa el QR propio; con él, usa el oficial', () => {
    const raiz = `${mkdtempSync(join(tmpdir(), 'qr-'))}/`;
    try {
      expect(buscarQrInstagram(raiz)).toEqual({ src: '/img/qr-instagram.svg', oficial: false });
      mkdirSync(`${raiz}public`, { recursive: true });
      writeFileSync(`${raiz}public/qr-instagram.png`, '');
      expect(buscarQrInstagram(raiz)).toEqual({ src: '/qr-instagram.png', oficial: true });
      mkdirSync(`${raiz}public/img`, { recursive: true });
      writeFileSync(`${raiz}public/img/qr-instagram.png`, '');
      expect(buscarQrInstagram(raiz)).toEqual({ src: '/img/qr-instagram.png', oficial: true });
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});
