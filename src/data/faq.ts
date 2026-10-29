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
  : 'El precio de fundador se lo confirmamos por escrito, antes de cualquier pago, mientras haya lugares.';

const despuesPrueba = estaDefinido(licencia.despuesDeLaPrueba) ? [licencia.despuesDeLaPrueba] : [];

export const PREGUNTAS: readonly Pregunta[] = [
  {
    id: 'que-es',
    pregunta: '¿Qué es InmutalKey?',
    respuesta: [
      'Un programa para Windows con el que lleva el expediente clínico de su consultorio privado: pacientes, historia clínica, notas de evolución, recetas, consentimientos y agenda.',
      'Su diferencia: cada nota que firma queda sellada y ya no se puede cambiar sin que se note.',
    ],
  },
  {
    id: 'internet',
    pregunta: '¿Necesito internet?',
    respuesta: [
      'No. Funciona completo sin conexión: consultar, escribir, firmar, imprimir y respaldar. Solo necesita internet para descargar el instalador y para escribirnos.',
    ],
  },
  {
    id: 'donde',
    pregunta: '¿Dónde quedan guardados mis expedientes?',
    respuesta: [
      'En su computadora, en una base cifrada que solo se abre con su contraseña. No se suben a ninguna nube y nosotros no tenemos acceso a ellos.',
    ],
  },
  {
    id: 'sellada',
    pregunta: '¿Qué significa que la nota quede sellada?',
    respuesta: [
      'Al firmar, el programa calcula una huella única del contenido y la firma con una llave que solo existe en su equipo. Cada nota se encadena con la anterior del mismo paciente.',
      'Si alguien modificara la base por fuera del programa, la auditoría de integridad lo señalaría.',
    ],
  },
  {
    id: 'error',
    pregunta: 'Me equivoqué en una nota ya firmada. ¿Qué hago?',
    respuesta: [
      'Agregue una adenda y elija el motivo: corrección de captura, aclaración, información adicional, resultado tardío o cambio de diagnóstico.',
      'La nota original no cambia y el expediente muestra las dos, con fecha, hora y quién firmó cada una.',
    ],
  },
  {
    id: 'nom004',
    pregunta: '¿Cumple con la NOM-004?',
    respuesta: [
      'Está diseñado alrededor de la NOM-004-SSA3-2012: ficha de identificación, historia clínica, notas de evolución con sus apartados y un semáforo que revisa 7 requisitos antes de firmar.',
      'La forma en que lo use en su práctica también cuenta: InmutalKey es una herramienta y no sustituye la asesoría legal.',
    ],
  },
  {
    id: 'recetas',
    pregunta: '¿En qué formatos imprime las recetas?',
    respuesta: [
      'En media hoja (dos copias en una hoja Carta, con línea de corte), Carta vertical o Carta horizontal. Lleva folio, expediente y el sello de la nota firmada.',
      'Si lo escrito no cabe en media hoja, pasa solo a Carta vertical y se le avisa: nunca se bloquea la emisión.',
    ],
  },
  {
    id: 'prueba',
    pregunta: `¿Qué pasa al terminar los ${licencia.diasPrueba} días de prueba?`,
    respuesta: [
      'Sus datos se quedan. Puede seguir consultando, buscando, imprimiendo y respaldando. Para firmar notas nuevas y agendar citas necesita activar su licencia, sin conexión a internet.',
      ...despuesPrueba,
    ],
  },
  {
    id: 'precio',
    pregunta: '¿Cuánto cuesta?',
    respuesta: ['La licencia es vitalicia: se paga una vez y queda ligada a su instalación.', precioTexto],
  },
  {
    id: 'respaldo',
    pregunta: '¿Cómo respaldo mi información?',
    respuesta: [
      'Con el botón de respaldo: el programa crea un respaldo cifrado con una frase de paso distinta de su contraseña. Guárdelo en una USB que no viva junto a la computadora.',
      'Para recuperar sus datos en otra computadora: instale InmutalKey y, en la bienvenida, elija «Restaurar respaldo».',
    ],
  },
  {
    id: 'contrasena',
    pregunta: '¿Y si olvido mi contraseña?',
    respuesta: [
      'Active su Clave de Rescate desde el primer día (Configuración → Seguridad): 24 letras y números que le permiten crear una contraseña nueva.',
      'Sin contraseña y sin Clave de Rescate nadie puede abrir su expediente, ni siquiera nosotros. Es lo que protege a sus pacientes.',
    ],
  },
  {
    id: 'aviso-windows',
    pregunta: 'Windows muestra un aviso al instalar. ¿Qué hago?',
    respuesta: [
      'El instalador aún no tiene un certificado comercial de firma de código, por eso Windows puede mostrar «Windows protegió su PC».',
      'Antes de instalar, compruebe que el archivo es el original comparando su huella SHA-256. Después elija «Más información» y «Ejecutar de todas formas».',
    ],
    enlace: { href: '/verificar', texto: 'Cómo verificar el instalador' },
  },
  {
    id: 'mac',
    pregunta: '¿Funciona en Mac?',
    respuesta: ['Por ahora solo en Windows 10 y Windows 11. La versión para Mac está en evaluación.'],
  },
  {
    id: 'efirma',
    pregunta: '¿Puedo usar mi e.firma del SAT?',
    respuesta: [
      'Sí, es opcional. Además del sello de InmutalKey, puede sellar sus notas con su e.firma. Sus archivos .cer y .key no salen de su computadora.',
    ],
  },
  {
    id: 'demo',
    pregunta: '¿Puedo practicar sin capturar pacientes reales?',
    respuesta: [
      'Sí. Los pacientes de demostración viven en una base aparte con 50 expedientes ficticios. Al purgarla se borra completa sin tocar sus expedientes.',
    ],
  },
  {
    id: 'importar',
    pregunta: '¿Puedo pasar mis expedientes de otro sistema?',
    respuesta: ['Hoy no. InmutalKey empieza con expedientes nuevos; la importación desde otros sistemas no está disponible.'],
  },
  {
    id: 'soporte',
    pregunta: '¿Quién me ayuda si tengo dudas?',
    respuesta: [
      'El mismo equipo que desarrolla InmutalKey, por WhatsApp o por correo.',
      ...(estaDefinido(licencia.soporteFueraDeFundadores) ? [licencia.soporteFueraDeFundadores] : []),
    ],
  },
];
