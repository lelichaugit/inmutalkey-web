# Procedimiento ARCO (borrador operativo, validar con el abogado)

Ley aplicable: LFPDPPP publicada en el DOF el 20-mar-2025 (autoridad: Secretaría Anticorrupción y Buen Gobierno).
Plazos: **responder en 20 días hábiles** desde que se recibe la solicitud y, si procede, **hacerla efectiva en los
15 días hábiles siguientes**. Cada plazo puede ampliarse una vez cuando se justifique; avisa al titular dentro del
plazo original.

## Cómo llegan

- Formulario `/derechos` → tabla `solicitudes_arco` + correo a `contacto@inmutalkey.com` con el folio.
- Correo directo a `contacto@inmutalkey.com`: regístralo tú. Hoy el panel no crea solicitudes a mano; anota el caso en
  las notas del lead o pide que use el formulario.

## Paso a paso

1. **Día 0:** llega el aviso con el folio. El panel (pestaña ARCO) cuenta los días hábiles. El cron te avisa por correo
   a partir del día hábil 15. El conteo no descuenta festivos: avisa antes, nunca después.
2. **Verifica la identidad** antes de entregar, corregir o borrar algo: responde desde `contacto@` al correo
   registrado en el lead y pide que conteste desde ahí. No pidas identificaciones oficiales salvo que el abogado lo
   indique: guardarlas sería tratar más datos de los necesarios.
3. **Atiende según el derecho:**
   - **Acceso:** busca el correo en Leads y expórtalo (CSV con filtro `q=correo`). Envíale sus datos en el cuerpo del
     correo. Incluye, si existen, sus testimonios y las fechas de sus descargas.
   - **Rectificación:** hoy el panel solo edita estatus y notas. Para corregir un dato, ejecuta el `UPDATE` en
     Cloudflare (D1 → Console) sobre ese lead y anótalo en sus notas internas. Nunca toques `consentimiento_utc` ni
     `version_aviso`.
   - **Cancelación:** en Leads → Detalles → **Borrar definitivamente**. Se borran también sus confirmaciones,
     descargas y testimonios. Los agregados diarios no contienen nada suyo. Si tienes copias exportadas en CSV,
     bórralas también.
   - **Oposición:** cambia el estatus a `descartado` y anota en notas a qué uso se opuso. Si se opone a todo
     contacto, trátalo como cancelación.
4. **Responde por escrito** al titular con lo que hiciste y la fecha.
5. Marca la solicitud como **resuelta** en el panel. Las resueltas se borran solas a los 24 meses (plazo propuesto
   como evidencia de cumplimiento; confírmalo con el abogado).

## Datos que no están en este sistema

Conversaciones de WhatsApp, correos de Hostinger y CSV exportados viven fuera del backend. Una cancelación también
debe cubrirlos. Inclúyelos en tu respuesta.
