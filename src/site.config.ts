// Único lugar con datos que cambian (precios, cupos, contacto, instalador, legal). Las redes sociales viven en
// src/data/socials.ts.
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
  /** Título de la portada: es el que muestran los marcadores de Chrome y la vista previa al compartir el enlace. */
  readonly titulo: string;
  readonly url: string;
  readonly idioma: string;
  readonly descripcion: string;
  readonly contacto: {
    /** Solo dígitos con lada de país (52…). Decodificado del QR de la tarjeta Fundadores: confirmar con Alan. */
    readonly whatsapp: Valor<string>;
    /** Prellenado del chat. Distinto al de la tarjeta para saber que el contacto vino del sitio. Provisional. */
    readonly mensajeWhatsApp: string;
    /** Prellenados por botón: permiten saber desde qué parte del sitio escribió el médico. */
    readonly mensajes: {
      readonly prueba: string;
      readonly fundadores: string;
    };
    readonly correo: Valor<string>;
  };
  /** Licencia digital. `publico` = precio posterior, para mostrar el ahorro. Con o sin IVA: indícalo en `notaPrecios`. */
  readonly precios: {
    readonly moneda: 'MXN';
    readonly fundadores: Valor<number>;
    readonly publico: Valor<number>;
    readonly notaPrecios: Valor<string>;
    /** ISO `AAAA-MM-DD`: hasta cuándo aplica el precio de fundador. */
    readonly finPrecioFundador: Valor<string>;
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
  /** Turnstile (antibots de Cloudflare). La sitekey es pública; el secreto vive solo en el Worker. */
  readonly turnstile: {
    readonly siteKey: Valor<string>;
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
  titulo: 'InmutalKey · Expediente Clínico Privado',
  url: 'https://inmutalkey.com',
  idioma: 'es-MX',
  descripcion:
    'Expediente clínico para consultorio privado, diseñado para la NOM-004. Cada nota queda sellada y no se puede alterar. Funciona en tu computadora, sin internet.',
  contacto: {
    whatsapp: '522291525847',
    mensajeWhatsApp: 'Hola, vi InmutalKey en inmutalkey.com y quiero información para mi consultorio.',
    mensajes: {
      prueba: 'Hola, vi InmutalKey en inmutalkey.com y quiero probarlo 30 días en mi consultorio.',
      fundadores: 'Hola, vi InmutalKey en inmutalkey.com y me interesa el programa Fundadores.',
    },
    correo: 'contacto@inmutalkey.com',
  },
  precios: {
    moneda: 'MXN',
    fundadores: TODO_DEFINIR,
    publico: TODO_DEFINIR,
    notaPrecios: TODO_DEFINIR,
    finPrecioFundador: TODO_DEFINIR,
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
  turnstile: {
    // Créala en Cloudflare → Turnstile → Add widget (dominio inmutalkey.com, modo Managed) y pégala aquí.
    siteKey: TODO_DEFINIR,
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
