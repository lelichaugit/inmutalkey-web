// Textos de los correos. Tono del sitio: tuteo, claro, sin promesas legales ni cifras. Cada correo trae versión en
// texto plano (la que leen muchos clientes de correo de hospital) y HTML mínimo sin imágenes ni rastreadores.

import type { Mensaje } from './correo';

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function html(parrafos: readonly string[], boton?: { href: string; texto: string }): string {
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 16px">${escaparHtml(p)}</p>`).join('');
  const accion = boton
    ? `<p style="margin:24px 0"><a href="${escaparHtml(boton.href)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0a87c4;color:#ffffff;text-decoration:none;font-weight:600">${escaparHtml(boton.texto)}</a></p>` +
      `<p style="margin:0 0 16px;color:#5b6475;font-size:14px">Si el botón no abre, copia este enlace en tu navegador:<br>${escaparHtml(boton.href)}</p>`
    : '';
  return (
    '<!doctype html><html lang="es-MX"><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1220;font-size:16px;line-height:1.5">' +
    `<div style="max-width:560px;margin:0 auto;padding:28px;background:#ffffff;border-radius:16px">${cuerpo}${accion}` +
    '<p style="margin:24px 0 0;color:#5b6475;font-size:13px">InmutalKey · inmutalkey.com</p></div></body></html>'
  );
}

export function correoConfirmacion(para: string, nombre: string, enlace: string): Mensaje {
  const parrafos = [
    `Hola, ${nombre}:`,
    'Recibimos tu registro al programa Fundadores de InmutalKey. Para terminar, confirma que este correo es tuyo.',
    'El enlace vence en 72 horas. Si no fuiste tú, ignora este mensaje: sin confirmación no te volveremos a escribir y tus datos se eliminan solos.',
  ];
  return {
    para,
    asunto: 'Confirma tu correo · InmutalKey Fundadores',
    texto: `${parrafos.join('\n\n')}\n\nConfirmar: ${enlace}\n\nInmutalKey · inmutalkey.com`,
    html: html(parrafos, { href: enlace, texto: 'Confirmar mi correo' }),
  };
}

export interface DatosAviso {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly telefono: string | null;
  readonly especialidad: string;
  readonly ciudad: string;
  readonly estado: string;
  readonly utm_source: string;
}

export function correoAvisoLead(para: string, lead: DatosAviso, panel: string, metodo: 'correo' | 'google' = 'correo'): Mensaje {
  const lineas = [
    `Nuevo lead confirmado (#${lead.id}) · ${metodo === 'google' ? 'con Google' : 'por correo'}`,
    `Nombre: ${lead.nombre}`,
    `Correo: ${lead.correo}`,
    `Teléfono: ${lead.telefono ?? '—'}`,
    `Especialidad: ${lead.especialidad}`,
    `Ciudad: ${lead.ciudad}, ${lead.estado}`,
    `Origen: ${lead.utm_source}`,
  ];
  return {
    para,
    asunto: `Lead confirmado: ${lead.nombre} (${lead.especialidad})`,
    texto: `${lineas.join('\n')}\n\nPanel: ${panel}`,
    html: html(lineas, { href: panel, texto: 'Abrir el panel' }),
    responderA: lead.correo,
  };
}

export function correoDescarga(para: string, nombre: string, enlace: string, version: string, sha256: string, verificar: string): Mensaje {
  const parrafos = [
    `Hola, ${nombre}:`,
    `Tu prueba de 30 días de InmutalKey está lista (versión ${version}). Abre este enlace en la computadora de tu consultorio: te guía paso a paso para descargar, comprobar e instalar.`,
    'El enlace es personal, vence en 72 horas y descarga una sola vez. Si se te pasa, pide otro en inmutalkey.com/descarga.',
    `Huella SHA-256 oficial del instalador: ${sha256}. Cómo revisarla: ${verificar}.`,
  ];
  return {
    para,
    asunto: 'Tu instalador de InmutalKey',
    texto: `${parrafos.join('\n\n')}\n\nDescargar: ${enlace}\n\nInmutalKey · inmutalkey.com`,
    html: html(parrafos, { href: enlace, texto: 'Abrir mi instalación guiada' }),
  };
}

export function correoAvisoArco(para: string, folio: number, tipo: string, correo: string, detalle: string): Mensaje {
  const lineas = [
    `Nueva solicitud ARCO (folio ${folio})`,
    `Derecho: ${tipo}`,
    `Correo del titular: ${correo}`,
    `Detalle: ${detalle || '—'}`,
    'Plazo legal: responder en 20 días hábiles y, si procede, hacerlo efectivo en los 15 siguientes. Verifica la identidad del titular antes de entregar o borrar datos (ver docs/ARCO.md).',
  ];
  return {
    para,
    asunto: `Solicitud ARCO #${folio}: ${tipo}`,
    texto: lineas.join('\n'),
    html: html(lineas),
    responderA: correo,
  };
}

export function correoArcoPorVencer(para: string, pendientes: readonly { folio: number; tipo: string; dias: number }[]): Mensaje {
  const lineas = [
    'Solicitudes ARCO cerca del plazo de 20 días hábiles:',
    ...pendientes.map((p) => `Folio ${p.folio} (${p.tipo}): ${p.dias} días hábiles transcurridos`),
    'El conteo no descuenta días festivos, así que el plazo real puede ser un poco mayor.',
  ];
  return { para, asunto: `ARCO: ${pendientes.length} solicitud(es) por vencer`, texto: lineas.join('\n'), html: html(lineas) };
}
