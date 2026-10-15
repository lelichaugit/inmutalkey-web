// Funciones del producto, verificadas contra el código de clinica-nom004 (ver docs/TRASPASO.md §1).
// Lenguaje de consultorio: lo técnico va en `tecnico`, que solo se muestra en "Detalles técnicos".

import type { NombreIcono } from '../lib/iconos';

export interface Funcion {
  readonly icono: NombreIcono;
  readonly titulo: string;
  readonly detalle: string;
  readonly tecnico?: string;
}

export interface GrupoFunciones {
  readonly titulo: string;
  readonly funciones: readonly Funcion[];
}

export const GRUPOS: readonly GrupoFunciones[] = [
  {
    titulo: 'Expediente',
    funciones: [
      {
        icono: 'nota',
        titulo: 'Expediente completo',
        detalle: 'Ficha de identificación, historia clínica y notas de evolución con los apartados de la NOM-004.',
        tecnico: 'CURP con dígito verificador o motivo de ausencia de catálogo; número de expediente único.',
      },
      {
        icono: 'sello',
        titulo: 'Notas selladas',
        detalle: 'Al firmar, la nota queda cerrada. Nadie puede cambiarla sin que se note.',
        tecnico: 'SHA-256 de JSON canónico encadenado por paciente y firma Ed25519; triggers y autorizador SQLite niegan UPDATE/DELETE.',
      },
      {
        icono: 'firma',
        titulo: 'Addendums',
        detalle: 'Corrige o aclara sin borrar: el addendum se agrega con su motivo y la nota original se conserva.',
      },
      {
        icono: 'escudo',
        titulo: 'Consentimiento informado',
        detalle: 'Procedimiento, objetivos, riesgos y testigos. Queda sellado con su huella y ya no se puede modificar.',
      },
      {
        icono: 'impresora',
        titulo: 'Hoja de referencia y traslado',
        detalle: 'Lista para imprimir con el resumen clínico, el motivo de envío y la terapéutica empleada.',
      },
    ],
  },
  {
    titulo: 'Consulta',
    funciones: [
      {
        icono: 'check',
        titulo: 'Semáforo antes de firmar',
        detalle: 'Revisa 7 requisitos: motivo, evolución, signos, exploración, diagnóstico, pronóstico y plan.',
      },
      {
        icono: 'pulso',
        titulo: 'Signos vitales e IMC',
        detalle: 'TA, FC, FR, temperatura, SpO₂, glucemia capilar, peso y talla. El IMC se calcula solo.',
      },
      {
        icono: 'lupa',
        titulo: 'Diagnósticos CIE-10',
        detalle: 'Catálogo de los diagnósticos más frecuentes con búsqueda por clave o por nombre.',
      },
      {
        icono: 'receta',
        titulo: 'Recetas',
        detalle: 'Salen de la nota firmada, con folio y sello. Carta o media carta. Kits de tratamiento propios.',
      },
      {
        icono: 'laboratorio',
        titulo: 'Laboratorios con gráficas',
        detalle: 'Glucosa, HbA1c, creatinina, colesterol y triglicéridos con su evolución en el tiempo.',
      },
      {
        icono: 'reloj',
        titulo: 'Borrador automático',
        detalle: 'Mientras escribes, la nota se guarda cada 3 segundos. Si se va la luz, la recuperas.',
      },
    ],
  },
  {
    titulo: 'Organización',
    funciones: [
      {
        icono: 'calendario',
        titulo: 'Agenda del día',
        detalle: 'Citas de hoy, próximas citas y pacientes de primera vez. La cita se marca atendida al firmar.',
      },
      {
        icono: 'lupa',
        titulo: 'Búsqueda instantánea',
        detalle: 'Encuentra pacientes por nombre, expediente, diagnóstico o medicamento. Atajo Ctrl+K.',
        tecnico: 'Índice de texto completo FTS5 local.',
      },
      {
        icono: 'carpeta',
        titulo: 'Carpetas de pacientes',
        detalle: 'Hasta 12 carpetas de colores para ordenar tu consulta a tu manera.',
      },
      {
        icono: 'ojo',
        titulo: 'Cómodo a la vista',
        detalle: 'Seis temas, incluido uno de lectura antifatiga, y tres tamaños de letra.',
      },
    ],
  },
  {
    titulo: 'Seguridad',
    funciones: [
      {
        icono: 'candado',
        titulo: 'Base cifrada',
        detalle: 'Tus expedientes se guardan cifrados y solo se abren con tu contraseña.',
        tecnico: 'SQLCipher (AES-256); clave derivada con Argon2id.',
      },
      {
        icono: 'sin-wifi',
        titulo: 'Sin internet',
        detalle: 'Todo funciona sin conexión y el programa no envía datos a nadie.',
      },
      {
        icono: 'bitacora',
        titulo: 'Bitácora de accesos',
        detalle: 'Cada acceso y cambio queda registrado en una bitácora que tampoco se puede alterar.',
      },
      {
        icono: 'respaldo',
        titulo: 'Respaldo comprobado',
        detalle: 'Copia tu base cifrada a una USB o disco externo con un clic y comprueba que la copia quedó idéntica.',
      },
      {
        icono: 'llave',
        titulo: 'e.firma del SAT (opcional)',
        detalle: 'Además del sello de InmutalKey, puedes sellar tus notas con tu e.firma.',
        tecnico: 'Sello RSA-SHA256 en tabla aparte; los archivos .cer/.key solo los procesa el núcleo local.',
      },
      {
        icono: 'computadora',
        titulo: 'Modo demostración',
        detalle: 'Practica con pacientes ficticios en una base aparte que se borra sin tocar la real.',
      },
    ],
  },
];

export const PROXIMAMENTE: readonly Funcion[] = [
  { icono: 'respaldo', titulo: 'Restauración guiada', detalle: 'Lleva tu respaldo a otro equipo, paso a paso.' },
  { icono: 'descarga', titulo: 'Expediente en PDF', detalle: 'Exportación del expediente con un verificador de autenticidad.' },
  { icono: 'computadora', titulo: 'Mac', detalle: 'En evaluación. Hoy: Windows\u00a010 y\u00a011.' },
];
