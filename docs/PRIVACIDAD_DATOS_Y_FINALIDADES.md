# Borrador técnico: datos que recabamos y finalidades (sitio inmutalkey.com)

> **Documento para el abogado, no es el aviso de privacidad.** Describe con exactitud lo que hace el sistema al
> 27-oct-2026 (código en `src/worker/` y migraciones en `migrations/`) para que se redacte el aviso conforme a la
> LFPDPPP publicada en el DOF el 20-mar-2025 (autoridad: Secretaría Anticorrupción y Buen Gobierno). La página
> `/privacidad` actual es anterior a este backend y **no** refleja todo lo de aquí: hay que actualizarla y cambiar
> `VERSION_AVISO_VIGENTE` en `src/compartido/leads.ts` al publicarla.

## 1. Responsable

Pendiente: nombre o razón social, domicilio y correo para privacidad (`legal.*` en `src/site.config.ts`). Contacto
operativo: contacto@inmutalkey.com.

## 2. Titulares

Médicos y profesionales de la salud que se registran en el programa Fundadores, piden ejercer derechos ARCO o
autorizan publicar un testimonio. **El sitio no recaba datos de pacientes ni datos de salud.** El formulario pide no
incluirlos.

## 3. Datos por origen

| Origen | Datos | Obligatorio |
|---|---|---|
| Formulario `/fundadores` | Nombre, correo, especialidad, estado, ciudad, dónde da consulta (categoría), rango de pacientes por semana, sistema operativo de su computadora, cómo se enteró, qué usa hoy para sus expedientes | Sí |
| | Teléfono | No |
| | Origen de campaña (`utm_source`, `utm_medium`, `utm_campaign`), p. ej. "tarjeta" del QR impreso | Automático, si llegó por un enlace con campaña |
| | Versión del aviso aceptada y fecha y hora del consentimiento | Automático |
| Confirmación por correo | Fecha y hora de confirmación | Automático |
| Gestión interna | Estatus comercial (nuevo, contactado, prueba, cliente, descartado), fecha de primer contacto, notas internas de Alan | Interno |
| Descarga del instalador | Versión enviada, fecha de creación, vencimiento y uso del enlace | Automático |
| Testimonio | Texto, nombre público elegido, fecha en que el médico autorizó publicarlo | Con consentimiento expreso |
| Formulario `/derechos` | Correo, derecho que ejerce, detalle libre | Sí (salvo detalle) |
| Uso del sitio | **Solo conteos diarios** por tipo de evento (página vista, formulario iniciado, clic a WhatsApp por intención, pregunta frecuente abierta, simulador visto) y origen de campaña | No identifica a nadie |

**No se guarda:** dirección IP, user-agent, cookies de rastreo ni identificador de visitante. La IP se usa solo en
memoria, durante la solicitud, para derivar una llave cifrada (SHA-256 con sal secreta) que limita envíos abusivos; no
se escribe en la base ni en los registros. El navegador guarda el origen de campaña en `sessionStorage` (solo esa
pestaña, se borra al cerrarla) para atribuir el registro; no es una cookie ni identifica a la persona. Si el navegador
envía Global Privacy Control o Do Not Track, no se envía ninguna métrica.

## 4. Finalidades

Necesarias (dan origen a la relación):
1. Confirmar que el correo pertenece a quien se registró (doble confirmación).
2. Contactar al médico sobre el programa Fundadores y su prueba; enviarle el enlace personal de descarga del
   instalador.
3. Administrar su participación: estatus, licencia (emitida fuera de este sistema) y soporte.
4. Atender solicitudes de derechos ARCO.
5. Proteger el sitio contra envíos automatizados (Turnstile, límite de frecuencia, campo trampa).

Secundarias (requieren poder negarse sin afectar las necesarias; **hoy el formulario no separa una casilla para
ellas**, decidir con el abogado si se agrega):
6. Medir qué canales (tarjeta QR, redes, congreso) traen registros, con datos del propio lead (`utm_*`,
   "cómo se enteró").
7. Publicar el testimonio del médico, solo con su autorización expresa y la fecha registrada.

Las estadísticas de uso del sitio son conteos sin datos personales.

## 5. Encargados y transferencias

| Proveedor | Para qué | Ubicación |
|---|---|---|
| Cloudflare, Inc. | Alojamiento del sitio y la API, base de datos D1, almacenamiento R2 de instaladores, Turnstile, Access (panel), Web Analytics (sin cookies) y envío de correo (Email Service) | EE. UU. y red global |
| Hostinger | Buzón `contacto@inmutalkey.com` (avisos internos, respuestas) | Por confirmar |
| Resend (solo si se elige en lugar de Cloudflare Email) | Envío de correos al médico | EE. UU. |
| Meta (WhatsApp) | Solo si el médico decide escribir por WhatsApp | Global |

Revisar con el abogado si esto constituye remisión a encargados (sin consentimiento) o transferencia, y las cláusulas
de cada proveedor.

## 6. Conservación (implementado)

| Dato | Plazo |
|---|---|
| Registro sin confirmar el correo | Se borra a los 30 días |
| Lead descartado | Se borra 12 meses después de descartarlo |
| Lead activo, en prueba o cliente | Mientras dure la relación (no se borra solo) |
| Tokens de confirmación vencidos | Se borran 7 días después de vencer |
| Solicitudes ARCO resueltas | Se borran a los 24 meses (proponer al abogado) |
| Conteos diarios de uso | Indefinido (no son datos personales) |
| Registros técnicos del Worker | Según Cloudflare Workers Logs (no contienen datos personales) |

## 7. Derechos ARCO y revocación

Formulario `/derechos` o correo a contacto@. Respuesta en 20 días hábiles y ejecución en 15 (procedimiento:
`docs/ARCO.md`). La cancelación borra al lead y lo relacionado. Revocar el consentimiento equivale a pedir la
cancelación u oposición.

## 8. Medidas de seguridad (resumen para el aviso)

Conexión cifrada (HTTPS con HSTS), panel protegido con Cloudflare Access y una segunda verificación propia, tokens de
un solo uso guardados como huella, base sin IP ni user-agent, registros sin datos personales, instaladores en
almacenamiento privado con enlaces de 5 minutos, validación y límite de frecuencia en todos los formularios.

## 9. Pendientes para el abogado

1. Datos del responsable (nombre o razón social, domicilio, correo de privacidad).
2. ¿Casilla separada para finalidades secundarias (medición de canales) o basta el aviso?
3. Plazo de conservación de clientes y de las solicitudes ARCO resueltas.
4. Calificación de cada proveedor (encargado o transferencia) y mención de servidores fuera de México.
5. Texto del consentimiento del formulario (hoy: "Autorizo que InmutalKey use estos datos para contactarme sobre el
   programa Fundadores y mi prueba, conforme al aviso de privacidad. Puedo pedir que los borren en cualquier
   momento.").
6. Mecanismo para comunicar cambios al aviso. Cada versión aceptada queda registrada por lead (`version_aviso`).
