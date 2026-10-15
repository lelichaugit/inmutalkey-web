// Única fuente de verdad de las redes de InmutalKey. Agregar o quitar una red = editar solo este archivo.
// Los componentes (SocialLinks, Contacto, Pie, Base) y el QR (scripts/generar-qr.mjs) leen de aquí.
// Enlaces estáticos y limpios: sin parámetros de rastreo ni widgets (promesa de privacidad de la marca).

import { sitio } from '../site.config.ts';

/**
 * Interruptor del botón de WhatsApp Business. El número vive en un solo lugar: `sitio.contacto.whatsapp`
 * (src/site.config.ts). Para activarlo basta con un número válido ahí y `WHATSAPP_ENABLED = true`; con `false` (o con
 * el marcador `TODO_DEFINIR`) no se imprime ni el enlace ni el número en el HTML.
 */
export const WHATSAPP_ENABLED = true;

export type IdRed = 'instagram' | 'x' | 'linkedin';

export interface Red {
  readonly id: IdRed;
  readonly nombre: string;
  /** URL canónica, sin parámetros. */
  readonly url: string;
  readonly handle: string;
  /** Nombre del archivo en src/assets/redes/ (sin .svg). */
  readonly icono: IdRed;
  /** Nombre accesible del enlace (se le añade «, se abre en una pestaña nueva»). */
  readonly etiqueta: string;
  readonly proposito: string;
  readonly accion: 'Seguir' | 'Conectar';
  /** Propiedad de la marca o de su fundador: lleva `rel="me"`. */
  readonly propio: boolean;
}

export const REDES: readonly Red[] = [
  {
    id: 'instagram',
    nombre: 'Instagram',
    url: 'https://www.instagram.com/inmutalkey/',
    handle: '@inmutalkey',
    icono: 'instagram',
    etiqueta: 'InmutalKey en Instagram',
    proposito: 'Novedades y avance del producto.',
    accion: 'Seguir',
    propio: true,
  },
  {
    id: 'x',
    nombre: 'X',
    url: 'https://x.com/inmutalkey',
    handle: '@inmutalkey',
    icono: 'x',
    etiqueta: 'InmutalKey en X',
    proposito: 'Actualizaciones y noticias.',
    accion: 'Seguir',
    propio: true,
  },
  {
    id: 'linkedin',
    nombre: 'LinkedIn',
    url: 'https://www.linkedin.com/in/alan-vargas-fregoso-24389b36b/',
    handle: 'Alan Vargas Fregoso',
    icono: 'linkedin',
    etiqueta: 'Alan Vargas Fregoso, fundador de InmutalKey, en LinkedIn',
    proposito: 'Perfil profesional del fundador.',
    accion: 'Conectar',
    propio: true,
  },
];

/** Fundador: su perfil de LinkedIn es personal, por eso va en `Person` y no en `Organization.sameAs` (ver Base.astro). */
export const FUNDADOR = { nombre: 'Alan Vargas Fregoso', puesto: 'Fundador' } as const;

export const REL_EXTERNO = 'noopener noreferrer';
export const REL_PERFIL_PROPIO = `me ${REL_EXTERNO}`;
export const AVISO_PESTANA = 'se abre en una pestaña nueva';

export function etiquetaAccesible(red: Pick<Red, 'etiqueta'>): string {
  return `${red.etiqueta}, ${AVISO_PESTANA}`;
}

export function redPorId(id: IdRed): Red {
  const red = REDES.find((r) => r.id === id);
  if (!red) throw new Error(`Red desconocida: ${id}`);
  return red;
}

/** Correo público (o `null` mientras sea `TODO_DEFINIR`). */
export function correoContacto(): string | null {
  const correo = sitio.contacto.correo;
  return correo === 'TODO_DEFINIR' ? null : correo;
}
