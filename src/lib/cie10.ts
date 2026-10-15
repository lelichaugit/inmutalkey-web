// Muestra del catálogo CIE-10 de la app (clinica-nom004/src/constantes/catalogoCie10.ts) para el simulador.

export interface Diagnostico {
  readonly codigo: string;
  readonly nombre: string;
}

export const MUESTRA_CIE10: readonly Diagnostico[] = [
  { codigo: 'J00', nombre: 'Rinofaringitis aguda (resfriado común)' },
  { codigo: 'J02.0', nombre: 'Faringitis estreptocócica' },
  { codigo: 'J02.9', nombre: 'Faringitis aguda no especificada' },
  { codigo: 'J03.9', nombre: 'Amigdalitis aguda no especificada' },
  { codigo: 'J06.9', nombre: 'Infección aguda de vías respiratorias superiores' },
  { codigo: 'J20.9', nombre: 'Bronquitis aguda no especificada' },
  { codigo: 'J45.9', nombre: 'Asma no especificada' },
  { codigo: 'B34.9', nombre: 'Infección viral no especificada' },
  { codigo: 'I10', nombre: 'Hipertensión esencial (primaria)' },
  { codigo: 'E11.9', nombre: 'Diabetes mellitus tipo 2 sin complicaciones' },
  { codigo: 'E78.5', nombre: 'Dislipidemia no especificada' },
  { codigo: 'E66.9', nombre: 'Obesidad no especificada' },
  { codigo: 'K29.7', nombre: 'Gastritis no especificada' },
  { codigo: 'K21.9', nombre: 'Enfermedad por reflujo gastroesofágico sin esofagitis' },
  { codigo: 'K59.0', nombre: 'Estreñimiento' },
  { codigo: 'R10.4', nombre: 'Otros dolores abdominales y los no especificados' },
  { codigo: 'A09', nombre: 'Diarrea y gastroenteritis de presunto origen infeccioso' },
  { codigo: 'N39.0', nombre: 'Infección de vías urinarias, sitio no especificado' },
  { codigo: 'N30.0', nombre: 'Cistitis aguda' },
  { codigo: 'M54.5', nombre: 'Lumbago no especificado (lumbalgia)' },
  { codigo: 'L30.9', nombre: 'Dermatitis no especificada' },
  { codigo: 'R50.9', nombre: 'Fiebre no especificada' },
  { codigo: 'R51', nombre: 'Cefalea' },
  { codigo: 'G43.9', nombre: 'Migraña no especificada' },
  { codigo: 'F32.9', nombre: 'Episodio depresivo no especificado' },
  { codigo: 'F41.1', nombre: 'Trastorno de ansiedad generalizada' },
  { codigo: 'H66.9', nombre: 'Otitis media no especificada' },
  { codigo: 'Z00.0', nombre: 'Examen médico general' },
];

const normalizar = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Por clave (prefijo) o por palabras del nombre, en cualquier orden. Máximo `limite` resultados. */
export function buscarCie10(consulta: string, limite = 5, catalogo: readonly Diagnostico[] = MUESTRA_CIE10): Diagnostico[] {
  const q = normalizar(consulta);
  if (q === '') return [];
  const palabras = q.split(/\s+/);
  const porClave = catalogo.filter((d) => normalizar(d.codigo).startsWith(q));
  const porNombre = catalogo.filter(
    (d) => !porClave.includes(d) && palabras.every((p) => normalizar(d.nombre).split(/[\s()]+/).some((w) => w.startsWith(p))),
  );
  return [...porClave, ...porNombre].slice(0, limite);
}
