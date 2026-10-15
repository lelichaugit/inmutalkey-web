// Único lugar con datos que cambian (precios, cupos, contacto, instalador, legal).
// Un valor `TODO_DEFINIR` se muestra con un texto neutro en el sitio y el build lo avisa;
// en producción, la integración `guardian` (astro.config.mjs) detiene el build si falta el WhatsApp.

export const TODO_DEFINIR = 'TODO_DEFINIR' as const;
export type Pendiente = typeof TODO_DEFINIR;
export type Valor<T> = T | Pendiente;

export function estaDefinido<T>(valor: Valor<T>): valor is T {
  return valor !== TODO_DEFINIR;
}

export interface ConfigSitio {
  readonly nombre: string;
  readonly url: string;
  readonly idioma: string;
  readonly descripcion: string;
  readonly contacto: {
    /** Solo dígitos con lada de país (52…). Decodificado del QR de la tarjeta Fundadores: confirmar con Alan. */
    readonly whatsapp: Valor<string>;
    /** Prellenado del chat. Distinto al de la tarjeta para saber que el contacto vino del sitio. Provisional. */
    readonly mensajeWhatsApp: string;
    readonly correo: Valor<string>;
  };
  readonly precios: {
    readonly fundadores: Valor<number>;
    readonly lanzamiento: Valor<number>;
    readonly publico: Valor<number>;
    readonly moneda: 'MXN';
    /** ISO `AAAA-MM-DD`. */
    readonly finLanzamiento: Valor<string>;
  };
  readonly cupos: {
    readonly totales: Valor<number>;
    readonly ocupados: Valor<number>;
  };
  readonly licencia: {
    readonly diasPrueba: number;
    readonly actualizacionesIncluidas: Valor<string>;
    readonly despuesDeLaPrueba: Valor<string>;
    readonly soporteFueraDeFundadores: Valor<string>;
  };
  readonly instalador: {
    readonly archivo: Valor<string>;
    readonly version: Valor<string>;
    readonly sha256: Valor<string>;
  };
  readonly portaVault: {
    readonly disponibilidad: Valor<string>;
  };
  readonly legal: {
    readonly razonSocial: Valor<string>;
    readonly domicilio: Valor<string>;
    readonly correoPrivacidad: Valor<string>;
    /** Mientras sea `false`, /privacidad y /terminos-fundadores muestran "Borrador: revisar con abogado". */
    readonly revisadoPorAbogado: boolean;
  };
}

export const sitio: ConfigSitio = {
  nombre: 'InmutalKey',
  url: 'https://inmutalkey.com',
  idioma: 'es-MX',
  descripcion:
    'Expediente clínico para consultorio privado, diseñado para la NOM-004. Cada nota queda sellada y no se puede alterar. Funciona en tu computadora, sin internet.',
  contacto: {
    whatsapp: '522291525847',
    mensajeWhatsApp: 'Hola, vi InmutalKey en inmutalkey.com y quiero información para mi consultorio.',
    correo: TODO_DEFINIR,
  },
  precios: {
    fundadores: TODO_DEFINIR,
    lanzamiento: TODO_DEFINIR,
    publico: TODO_DEFINIR,
    moneda: 'MXN',
    finLanzamiento: TODO_DEFINIR,
  },
  cupos: {
    totales: TODO_DEFINIR,
    ocupados: TODO_DEFINIR,
  },
  licencia: {
    diasPrueba: 30,
    actualizacionesIncluidas: TODO_DEFINIR,
    despuesDeLaPrueba: TODO_DEFINIR,
    soporteFueraDeFundadores: TODO_DEFINIR,
  },
  instalador: {
    archivo: TODO_DEFINIR,
    version: TODO_DEFINIR,
    sha256: TODO_DEFINIR,
  },
  portaVault: {
    disponibilidad: TODO_DEFINIR,
  },
  legal: {
    razonSocial: TODO_DEFINIR,
    domicilio: TODO_DEFINIR,
    correoPrivacidad: TODO_DEFINIR,
    revisadoPorAbogado: false,
  },
};

/** Rutas (`precios.fundadores`, …) de los valores aún sin definir. */
export function pendientes(valor: unknown = sitio, prefijo = ''): string[] {
  if (valor === TODO_DEFINIR) return [prefijo];
  if (valor === null || typeof valor !== 'object') return [];
  return Object.entries(valor).flatMap(([clave, v]) => pendientes(v, prefijo ? `${prefijo}.${clave}` : clave));
}
