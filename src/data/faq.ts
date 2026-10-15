// Preguntas frecuentes. Respuestas verificadas contra el código de clinica-nom004; nada de promesas legales.

import { estaDefinido, sitio } from '../site.config';

export interface Pregunta {
  readonly id: string;
  readonly pregunta: string;
  /** Párrafos de texto plano. */
  readonly respuesta: readonly string[];
  readonly enlace?: { readonly href: string; readonly texto: string };
}

const { licencia, precios } = sitio;

const precioTexto = estaDefinido(precios.fundadores)
  ? `Como fundador, la licencia cuesta $${precios.fundadores.toLocaleString('es-MX')} ${precios.moneda}.`
  : 'El precio de fundador te lo damos por WhatsApp mientras haya lugares.';

const despuesPrueba = estaDefinido(licencia.despuesDeLaPrueba) ? [licencia.despuesDeLaPrueba] : [];

export const PREGUNTAS: readonly Pregunta[] = [
  {
    id: 'que-es',
    pregunta: '¿Qué es InmutalKey?',
    respuesta: [
      'Un programa para Windows con el que llevas el expediente clínico de tu consultorio privado: pacientes, historia clínica, notas de evolución, recetas y agenda.',
      'Su diferencia: cada nota que firmas queda sellada y ya no se puede cambiar sin que se note.',
    ],
  },
  {
    id: 'internet',
    pregunta: '¿Necesito internet?',
    respuesta: [
      'No. Funciona completo sin conexión: consultar, escribir, firmar, imprimir y respaldar. Solo necesitas internet para escribirnos y descargar el instalador.',
    ],
  },
  {
    id: 'donde',
    pregunta: '¿Dónde quedan guardados mis expedientes?',
    respuesta: [
      'En tu computadora, dentro de una base de datos cifrada que solo se abre con tu contraseña. No se suben a ninguna nube y nosotros no tenemos acceso a ellos.',
    ],
  },
  {
    id: 'sellada',
    pregunta: '¿Qué significa que la nota quede sellada?',
    respuesta: [
      'Al firmar, el programa calcula una huella única del contenido de la nota y la firma con una llave que solo existe en tu equipo. Cada nota se enlaza con la anterior del mismo paciente.',
      'Si alguien modificara la base de datos por fuera del programa, la auditoría de integridad lo señalaría.',
    ],
  },
  {
    id: 'error',
    pregunta: 'Me equivoqué en una nota ya firmada. ¿Qué hago?',
    respuesta: [
      'Agregas un addendum y eliges el motivo: corrección de captura, aclaración, información adicional, resultado tardío de estudio o cambio de diagnóstico.',
      'La nota original no cambia y el expediente muestra las dos, con fecha, hora y quién firmó cada una.',
    ],
  },
  {
    id: 'nom004',
    pregunta: '¿Cumple con la NOM-004?',
    respuesta: [
      'Está diseñado alrededor de la NOM-004-SSA3-2012: ficha de identificación, historia clínica, notas de evolución con sus apartados y un semáforo que revisa 7 requisitos antes de dejarte firmar.',
      'La forma en que lo uses en tu práctica también cuenta: InmutalKey es una herramienta y no sustituye la asesoría legal.',
    ],
  },
  {
    id: 'prueba',
    pregunta: `¿Qué pasa al terminar los ${licencia.diasPrueba} días de prueba?`,
    respuesta: [
      'Tus datos se quedan. Puedes seguir consultando, buscando, imprimiendo, respaldando y registrando pacientes. Para firmar notas nuevas y agendar citas necesitas activar tu licencia.',
      ...despuesPrueba,
    ],
  },
  {
    id: 'precio',
    pregunta: '¿Cuánto cuesta?',
    respuesta: ['La licencia es vitalicia: se paga una vez y queda ligada a tu instalación.', precioTexto],
  },
  {
    id: 'aviso-windows',
    pregunta: 'Windows muestra un aviso al instalar. ¿Es seguro?',
    respuesta: [
      'El instalador todavía no tiene un certificado comercial de firma de código, por eso Windows puede mostrar "Windows protegió su PC".',
      'Antes de instalar, comprueba que el archivo es el original comparando su huella SHA-256. Luego elige "Más información" y "Ejecutar de todas formas".',
    ],
    enlace: { href: '/verificar', texto: 'Cómo verificar el instalador' },
  },
  {
    id: 'mac',
    pregunta: '¿Funciona en Mac?',
    respuesta: ['Por ahora solo en Windows 10 y Windows 11. La versión para Mac está en evaluación.'],
  },
  {
    id: 'respaldo',
    pregunta: '¿Cómo respaldo mi información?',
    respuesta: [
      'Con un clic: el programa copia tu base cifrada a la carpeta Respaldos y, si quieres, a una USB o disco que elijas, y comprueba que la copia quedó idéntica.',
      'Hoy esa copia sirve para recuperar tu base en esta misma computadora. Llevarla a otro equipo llegará con la restauración guiada, que está en desarrollo.',
    ],
  },
  {
    id: 'contrasena',
    pregunta: '¿Y si olvido mi contraseña?',
    respuesta: [
      'Si la olvidas, no hay forma de recuperarla ni de abrir tu base: ni siquiera nosotros podemos. Es el precio de que nadie más pueda entrar. Anótala y guárdala en un lugar seguro desde el primer día.',
    ],
  },
  {
    id: 'efirma',
    pregunta: '¿Puedo usar mi e.firma del SAT?',
    respuesta: [
      'Sí, es opcional. Además del sello de InmutalKey, puedes sellar tus notas con tu e.firma. Tus archivos .cer y .key no salen de tu computadora.',
    ],
  },
  {
    id: 'importar',
    pregunta: '¿Puedo pasar mis expedientes de otro sistema?',
    respuesta: [
      'Hoy no. InmutalKey empieza con expedientes nuevos; la importación desde otros sistemas no está disponible.',
    ],
  },
  {
    id: 'demo',
    pregunta: '¿Puedo practicar sin capturar pacientes reales?',
    respuesta: [
      'Sí. El modo demostración usa una base aparte con pacientes ficticios. Al purgarla se borra completa sin tocar tus expedientes.',
    ],
  },
  {
    id: 'soporte',
    pregunta: '¿Quién me ayuda si tengo dudas?',
    respuesta: [
      'El mismo equipo que desarrolla InmutalKey, directamente por WhatsApp.',
      ...(estaDefinido(licencia.soporteFueraDeFundadores) ? [licencia.soporteFueraDeFundadores] : []),
    ],
  },
];
