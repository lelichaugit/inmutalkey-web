// QR del perfil de Instagram. Si Alan sube el nametag oficial de Instagram (PNG con el logo al centro y «@INMUTALKEY»
// debajo), se usa tal cual: sin recortar ni recomprimir. Si no, la página usa el QR propio generado en local
// (public/img/qr-instagram.svg, `npm run qr`). Nunca se llama a una API externa.

import { existsSync } from 'node:fs';

/** Nombres aceptados para el nametag oficial, en orden de preferencia. */
export const NOMBRES_QR_OFICIAL = ['qr-instagram.png', 'qr_instagram.png', 'instagram-qr.png', 'qr-instagram.webp', 'qr-instagram.jpg'] as const;
const CARPETAS = ['public/img', 'public', 'public/brand', 'public/assets', 'public/static'] as const;

const QR_PROPIO = '/img/qr-instagram.svg';

export interface QrInstagram {
  readonly src: string;
  /** `true` si es el nametag oficial; `false` si es el QR generado por el sitio. */
  readonly oficial: boolean;
}

/**
 * @param raiz Raíz del proyecto con `/` final. Por omisión `process.cwd()`: npm ejecuta `build` desde la raíz del
 * paquete. (No `import.meta.url`: al compilar, este módulo vive en un chunk cuya profundidad decide Vite.)
 */
export function buscarQrInstagram(raiz: string = `${process.cwd()}/`): QrInstagram {
  for (const carpeta of CARPETAS) {
    for (const nombre of NOMBRES_QR_OFICIAL) {
      if (existsSync(`${raiz}${carpeta}/${nombre}`)) {
        const subcarpeta = carpeta === 'public' ? '' : `${carpeta.slice('public/'.length)}/`;
        return { src: `/${subcarpeta}${nombre}`, oficial: true };
      }
    }
  }
  return { src: QR_PROPIO, oficial: false };
}
