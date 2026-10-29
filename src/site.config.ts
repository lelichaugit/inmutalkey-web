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

export interface Paquete {
  readonly id: 'instalador' | 'zip';
  readonly titulo: string;
  readonly descripcion: string;
  /** Nombre exacto del archivo que recibe el médico. */
  readonly archivo: string;
  /** SHA-256 en hexadecimal (minúsculas), igual a SHA256.txt del paquete de distribución. */
  readonly sha256: string;
  /** Objeto esperado en R2 (bucket `inmutalkey-instaladores`). */
  readonly claveR2: string;
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
  /**
   * Versión vigente de la app y sus paquetes: ÚNICA fuente para /descarga, /verificar, la portada y el pie.
   * La descarga real es personal (enlace firmado de R2 que emite el Worker): al publicar una versión, sube cada archivo
   * a `claveR2` en el bucket `inmutalkey-instaladores` y regístrala en /admin → Instaladores con la misma huella.
   */
  readonly version: {
    readonly numero: string;
    /** Nombre de la edición (IDENTIDAD_MARCA.md). */
    readonly nombre: string;
    readonly paquetes: readonly Paquete[];
  };
  /**
   * Botón "Continuar con Google" en el registro. Enciéndelo cuando el cliente OAuth y los secretos estén cargados
   * (README_DEPLOY.md §16). Fuera de producción siempre se muestra, para probarlo.
   */
  readonly google: {
    readonly habilitado: boolean;
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
    'Expediente Clínico Privado conforme a la NOM-004. Cada nota queda sellada al firmarla, sus datos no salen de su computadora y funciona sin internet.',
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
  // Versión vigente (v0.4.0 «Cristal Sellado», 28-oct-2026). La fuente en vivo de lo que se descarga es el panel
  // (/admin → Instaladores, que alimenta /api/versiones); esto es lo que el sitio publica. Al cambiar de versión,
  // actualiza ambos con las mismas huellas.
  version: {
    numero: '0.4.0',
    nombre: 'Cristal Sellado',
    paquetes: [
      {
        id: 'instalador',
        titulo: 'Instalador para Windows',
        descripcion: 'Un solo archivo en español. Se instala para su usuario, sin permisos de administrador.',
        archivo: 'InmutalKey_0.4.0_Instalador.exe',
        sha256: 'd8cf81a06db3214e7ff460b1446aa533e44a893a84cd302efd77cc467516190e',
        claveR2: 'instaladores/0.4.0/InmutalKey_0.4.0_Instalador.exe',
      },
      {
        id: 'zip',
        titulo: 'Paquete completo (ZIP)',
        descripcion: 'El instalador con su huella (SHA256.txt) y la guía imprimible «Léame primero».',
        archivo: 'InmutalKey_0.4.0_Beta.zip',
        sha256: '1f7c72d1111fca139b269f8f5abd1fad783a6efb5721e137decad1fba82f8d67',
        claveR2: 'instaladores/0.4.0/InmutalKey_0.4.0_Beta.zip',
      },
    ],
  },
  google: {
    habilitado: false,
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

/** Paquete por id (siempre existe: el tipo lo garantiza). */
export function paquete(id: Paquete['id']): Paquete {
  const p = sitio.version.paquetes.find((x) => x.id === id);
  if (!p) throw new Error(`site.config: falta el paquete ${id}`);
  return p;
}

/** Rutas (`precios.fundadores`, …) de los valores aún sin definir. */
export function pendientes(valor: unknown = sitio, prefijo = ''): string[] {
  if (valor === TODO_DEFINIR) return [prefijo];
  if (valor === null || typeof valor !== 'object') return [];
  return Object.entries(valor).flatMap(([clave, v]) => pendientes(v, prefijo ? `${prefijo}.${clave}` : clave));
}
