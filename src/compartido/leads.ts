// Formulario de Fundadores: opciones y validación compartidas por el sitio (para pintar el formulario y avisar antes
// de enviar) y por el Worker (que es quien decide). Las etiquetas son las que ve el médico; los valores, los que se
// guardan en D1.

import { z } from 'zod';

/** Versión del aviso de privacidad que el médico acepta. Cámbiala cada vez que cambie /privacidad. */
export const VERSION_AVISO_VIGENTE = '2026-10-27-borrador' as const;
/** Versiones que el Worker todavía acepta (permite un despliegue sin cortar formularios abiertos con la anterior). */
export const VERSIONES_AVISO_ACEPTADAS: readonly string[] = [VERSION_AVISO_VIGENTE];

type Opciones = readonly (readonly [valor: string, etiqueta: string])[];

export const TIPOS_PRACTICA = [
  ['consultorio_propio', 'Consultorio propio'],
  ['consultorio_compartido', 'Consultorio compartido'],
  ['clinica_privada', 'Clínica u hospital privado'],
  ['institucion_y_privado', 'Institución pública y consulta privada'],
  ['otro', 'Otro'],
] as const satisfies Opciones;

export const RANGOS_PACIENTES = [
  ['hasta_20', 'Hasta 20 por semana'],
  ['21_50', '21 a 50 por semana'],
  ['51_100', '51 a 100 por semana'],
  ['mas_100', 'Más de 100 por semana'],
] as const satisfies Opciones;

export const SISTEMAS_OPERATIVOS = [
  ['windows', 'Windows'],
  ['mac', 'Mac'],
  ['ambos', 'Windows y Mac'],
  ['otro', 'Otro / no sé'],
] as const satisfies Opciones;

export const COMO_SE_ENTERO = [
  ['tarjeta', 'Tarjeta con código QR'],
  ['congreso', 'Congreso o evento'],
  ['recomendacion', 'Recomendación de un colega'],
  ['redes', 'Redes sociales'],
  ['busqueda', 'Buscador (Google u otro)'],
  ['otro', 'Otro'],
] as const satisfies Opciones;

export const USA_HOY = [
  ['papel', 'Papel'],
  ['word_excel', 'Word, Excel o similares'],
  ['software', 'Otro programa de expediente'],
  ['nada', 'Todavía no llevo expediente propio'],
] as const satisfies Opciones;

export const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas', 'Fuera de México',
] as const;

export const ESTATUS_LEAD = ['nuevo', 'contactado', 'prueba', 'cliente', 'descartado'] as const;
export type EstatusLead = (typeof ESTATUS_LEAD)[number];

/**
 * Estatus que ocupan un lugar de Fundador en `GET /api/fundadores/cupo`. Desde que la prueba de 30 días se descarga
 * sola (28-oct), cada descarga pone al lead en 'prueba': si las pruebas contaran, el cupo se agotaría sin una sola
 * venta. Por eso solo cuentan los clientes. Para volver a contar pruebas: ['prueba', 'cliente'] (hay prueba).
 */
export const ESTATUS_QUE_OCUPAN_CUPO: readonly EstatusLead[] = ['cliente'];

const valores = <T extends Opciones>(o: T): [T[number][0], ...T[number][0][]] =>
  o.map(([v]) => v) as [T[number][0], ...T[number][0][]];

/** Recorta y colapsa espacios. */
const texto = (min: number, max: number, mensaje: string) =>
  z
    .string({ required_error: mensaje, invalid_type_error: mensaje })
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min, mensaje).max(max, `Máximo ${max} caracteres`));

/** Normalización del correo: sin espacios y en minúsculas (lo único seguro sin conocer el proveedor). */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Teléfono opcional: se guardan solo dígitos (10 a 15, con lada de país opcional). Vacío → null. */
const telefono = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v ?? '').replace(/[^\d]/g, ''))
  .refine((v) => v === '' || (v.length >= 10 && v.length <= 15), 'Escriba 10 dígitos (o con lada de país)')
  .transform((v) => (v === '' ? null : v));

const opcion = <T extends Opciones>(o: T, mensaje: string) =>
  z.enum(valores(o), { errorMap: () => ({ message: mensaje }) });

/** Lo que manda el formulario (antes de Turnstile). */
export const esquemaLead = z.object({
  nombre: texto(3, 120, 'Escriba su nombre completo'),
  correo: z
    .string({ required_error: 'Escriba su correo' })
    .transform(normalizarCorreo)
    .pipe(z.string().max(160, 'Correo demasiado largo').email('Este correo parece incompleto: revise la parte después de la @')),
  telefono,
  especialidad: texto(3, 80, 'Escriba su especialidad'),
  estado: z.enum(ESTADOS_MX, { errorMap: () => ({ message: 'Elija su estado' }) }),
  ciudad: texto(2, 80, 'Escriba su ciudad'),
  tipo_practica: opcion(TIPOS_PRACTICA, 'Elija dónde da consulta'),
  pacientes_semana_rango: opcion(RANGOS_PACIENTES, 'Elija un rango'),
  so: opcion(SISTEMAS_OPERATIVOS, 'Elija el sistema de su computadora'),
  como_se_entero: opcion(COMO_SE_ENTERO, 'Elija una opción'),
  usa_hoy: opcion(USA_HOY, 'Elija una opción'),
  consentimiento: z.literal(true, {
    errorMap: () => ({ message: 'Necesitamos su autorización para contactarle' }),
  }),
  version_aviso: z
    .string()
    .refine((v) => VERSIONES_AVISO_ACEPTADAS.includes(v), 'La página se actualizó: recárgala y vuelve a enviar'),
  utm_source: z.unknown().optional(),
  utm_medium: z.unknown().optional(),
  utm_campaign: z.unknown().optional(),
  turnstile: z.string().max(4096).optional(),
  /** Campo trampa: invisible para personas. Si trae algo, es un bot. */
  sitio_web: z.string().max(200).optional(),
});

export type EntradaLead = z.input<typeof esquemaLead>;
export type Lead = z.output<typeof esquemaLead>;

/** Errores de zod → { campo: mensaje } (el primero por campo), sin repetir el valor recibido. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    const campo = String(problema.path[0] ?? 'formulario');
    if (!(campo in campos)) campos[campo] = problema.message;
  }
  return campos;
}

/** Solicitud ARCO (formulario público de /privacidad/derechos). */
export const TIPOS_ARCO = ['acceso', 'rectificacion', 'cancelacion', 'oposicion'] as const;
export type TipoArco = (typeof TIPOS_ARCO)[number];

export const esquemaArco = z.object({
  correo: z
    .string({ required_error: 'Escriba su correo' })
    .transform(normalizarCorreo)
    .pipe(z.string().max(160).email('Este correo parece incompleto: revise la parte después de la @')),
  tipo: z.enum(TIPOS_ARCO, { errorMap: () => ({ message: 'Elija qué derecho desea ejercer' }) }),
  detalle: texto(0, 1000, 'Describa su solicitud').optional(),
  turnstile: z.string().max(4096).optional(),
  sitio_web: z.string().max(200).optional(),
});
