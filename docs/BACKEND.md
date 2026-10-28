# Backend de inmutalkey.com

Actualizado: 28-oct-2026 (registro con Google y descarga directa). Despliegue y pasos del panel: `README_DEPLOY.md` §7–§15. Proceso ARCO: `docs/ARCO.md`.
Borrador para el abogado: `docs/PRIVACIDAD_DATOS_Y_FINALIDADES.md`.

**Alcance:** este backend **no** toca datos clínicos ni de pacientes. Solo maneja datos comerciales de médicos
interesados (leads), métricas agregadas de uso del sitio, testimonios autorizados, enlaces de descarga y solicitudes
ARCO. Las licencias se firman fuera (en la computadora de Alan); el backend nunca tiene la llave privada Ed25519.

## Arquitectura

```
Navegador ──► Cloudflare (inmutalkey.com)
               ├─ /*            → dist/ (Static Assets, sin invocar código)
               ├─ /api/*        → Worker src/worker/index.ts (Hono)
               └─ /admin        → Access (borde) → Worker (2.ª revisión del JWT) → dist/admin.html
Worker ──► D1 `inmutalkey-web` (leads, eventos, testimonios, descargas, ARCO)
       ──► R2 `inmutalkey-instaladores` (privado; URL firmada de 5 min con credencial de solo lectura)
       ──► Email Sending (binding `EMAIL`) o Resend
       ──► Turnstile siteverify · llaves públicas de Access
Cron diario 09:17 UTC ──► retención + aviso ARCO
```

| Pieza | Archivo |
|---|---|
| Entrada, middlewares, rutas | `src/worker/index.ts` |
| Rutas públicas (contrato) | `src/worker/rutas/publicas.ts` |
| API del panel | `src/worker/rutas/admin.ts` |
| Retención | `src/worker/tareas/retencion.ts` |
| Access (JWT RS256) | `src/worker/lib/acceso.ts` |
| Cabeceras, CORS | `src/worker/lib/seguridad.ts` |
| Logs sin datos personales | `src/worker/lib/registro.ts` |
| Correo y plantillas | `src/worker/lib/correo.ts`, `plantillas.ts` |
| URL firmada de R2 | `src/worker/lib/r2.ts` |
| Validación compartida (zod) | `src/compartido/leads.ts` |
| Lista cerrada de eventos | `src/compartido/eventos.ts` (+ `eventos-validos.ts` para el Worker) |
| Panel | `src/pages/admin.astro` + `src/scripts/admin.ts` |
| Formularios del sitio | `src/pages/fundadores.astro`, `derechos.astro`, `src/scripts/formularios.ts` |

Dependencias nuevas (regla 9 de `GEMINI.md`): `hono` (router, sin dependencias), `aws4fetch` (firma SigV4 de la URL
de R2, sin SDK). Las pruebas usan `getPlatformProxy` de Wrangler (ya instalado), porque el pool de Workers de Vitest
aún no soporta Vitest 5.

## Contrato de la API

Cambios respecto al encargo original, **avisados** y justificados (los filtros de correo corporativo, como Outlook Safe
Links y los antivirus, abren los enlaces antes que la persona):

1. `GET /api/confirmar/:token` ya **no confirma**: redirige a `/fundadores/confirmar#t=…` y ahí un botón hace
   `POST /api/confirmar`. Si no, el filtro "confirmaría" por el médico y el doble opt-in no probaría nada.
2. `GET /api/descarga/:token` ya **no gasta** el enlace: redirige a `/descarga#t=…` y el botón hace
   `POST /api/descarga`, que devuelve la URL firmada. Si no, el filtro gastaría la descarga de un solo uso.
3. El token viaja en el fragmento (`#`), que el navegador no manda al servidor: no queda en logs.

| Método y ruta | Respuesta |
|---|---|
| `POST /api/leads` | `201 {ok:true}` (correo) · `201 {ok:true, destino}` (con Google) · `400 {error:'validacion'\|'verificacion', campos}` · `429` |
| `GET /api/confirmar/:token` | `302 /fundadores/confirmar#t=…` · `302 /fundadores/gracias` (ya usado) · `302 /fundadores/confirmar?estado=vencido` |
| `POST /api/confirmar` `{token}` | `200 {ok:true, destino}` (destino = `/descarga#t=…` o `/fundadores/gracias?estado=pronto\|limite`) · `410` · `429` |
| `GET /api/fundadores/cupo` | `{total, restantes}` · caché 60 s |
| `POST /api/eventos` `{evento, utm_source}` o `{eventos:[…], utm_source}` | `204` siempre |
| `GET /api/testimonios` | `[{nombre, especialidad, ciudad, texto, fecha}]` · caché 5 min |
| `GET /api/versiones` | `[{version, nombre_archivo, sha256, tamano_bytes, publicada_utc, vigente}]` · caché 5 min |
| `GET /api/descarga/:token` | `302 /descarga#t=…` · `410` |
| `POST /api/descarga` `{token}` | `200 {url}` (JSON) o `303` (formulario) · `410` · `503` (sin credenciales R2; el token se libera) |
| `POST /api/descarga/reenviar` `{correo, turnstile}` | `202 {ok:true}` siempre; si el correo está confirmado, llega un enlace nuevo |
| `POST /api/descarga/a-mi-correo` `{token}` | `200 {ok:true, correo: 'an•••@dominio'}` (mismo enlace, sin gastarlo) · `410` |
| `GET /api/auth/google/inicio` | `302` a Google (PKCE S256, state, nonce) · `302 /fundadores?google=no-disponible` |
| `GET /api/auth/google/callback` | `302 /descarga#t=…` (ya registrado) · `302 /fundadores?google=listo` (nuevo) · `?google=cancelado\|error` |
| `GET /api/auth/sesion` | `{correo, nombre}` del registro con Google en curso · `204` |
| `POST /api/auth/salir` | `204` (borra la cookie de registro) |
| `POST /api/arco` `{correo, tipo, detalle?, turnstile}` | `201 {ok:true, folio}` · `400` · `429` |

Por qué `POST /api/descarga` devuelve JSON a la página: en Chrome, la CSP `form-action 'self'` también bloquea la
redirección de un `<form>` hacia otro dominio (R2). La página hace `fetch` y navega a la URL.

Panel (`/api/admin/*`, todo tras Access + JWT): `GET sesion`, `GET leads` (filtros `estatus`, `fuente`,
`confirmado`, `q`, `pagina`), `PATCH leads/:id {estatus?, notas_internas?}`, `DELETE leads/:id`,
`POST leads/:id/aprobar-prueba`, `GET leads.csv`, `GET metricas?desde&hasta`, `GET|POST testimonios`,
`PATCH testimonios/:id {publicado}`, `GET|POST versiones`, `POST versiones/:version/vigente`, `POST versiones/notificar-pendientes`, `GET|PUT config`,
`GET arco`, `POST arco/:id/resolver`. Las acciones que cambian algo exigen `Content-Type: application/json` y el
origen del sitio.

## Modelo de datos (D1)

Migraciones correlativas en `migrations/`, solo aditivas (hay una prueba que prohíbe `DROP TABLE`). Fechas en UTC
ISO 8601.

| Tabla | Notas |
|---|---|
| `leads` | Campos del encargo + `estatus_utc` (desde cuándo tiene ese estatus; la retención de descartados cuenta desde aquí). Correo único y normalizado (CHECK). Teléfono solo dígitos. |
| `confirmaciones` | **Agregada**: token de doble opt-in (solo SHA-256), 72 h, uso único. |
| `fundadores_config` | Un registro; `total_cupos = 0` = sin definir (el sitio no muestra el contador). |
| `eventos_diarios` | `(fecha, evento, utm_source) → contador`. Fecha en hora del centro de México. |
| `testimonios` | + `nombre_publico` opcional. CHECK: no se puede publicar sin `consentimiento_publicacion_utc`. |
| `versiones` | **Agregada**: versión, ruta en R2, nombre, SHA-256 público, tamaño, una sola vigente. |
| `descargas` | Token (solo SHA-256), versión, 72 h, uso único. |
| `solicitudes_arco` | + `detalle` (texto libre para rectificación u oposición). |

Ninguna tabla tiene IP, user-agent ni identificador de visitante (prueba `tests/worker/privacidad.test.ts`, que revisa
nombres de columna y, tras un recorrido completo, que la IP y el user-agent no aparezcan en ningún valor).

## Registro y descarga directa (28-oct)

El médico descarga solo, sin aprobación manual, en cuanto prueba que el correo es suyo:

```
Con correo:  /fundadores → POST /api/leads → correo con enlace → /fundadores/confirmar (clic) → POST /api/confirmar
             → destino /descarga#t=… (instalación guiada)
Con Google:  /fundadores → /api/auth/google/inicio → Google → /api/auth/google/callback
             · nuevo       → /fundadores?google=listo (correo bloqueado, completa datos) → POST /api/leads → /descarga#t=…
             · registrado  → /descarga#t=… directo
Vuelve:      formulario otra vez, «Pide un enlace nuevo» en /descarga o Google → enlace nuevo
Celular/Mac: /descarga lo detecta en el navegador y ofrece «Mandármelo al correo» (mismo enlace, sin gastarlo)
```

- `emitirDescarga` (`src/worker/lib/descargas.ts`): solo leads confirmados y no descartados, con versión vigente,
  máximo 5 enlaces por lead en 24 h; pone el lead en `prueba` (sin tocar `primer_contacto_utc`, que mide el contacto
  humano de Alan).
- Si alguien confirma sin versión vigente: va a `/fundadores/gracias?estado=pronto`. En cuanto publiques la versión,
  **Instaladores → Enviar enlace a quienes esperan** (50 por clic).
- Google: OpenID Connect con PKCE S256, `state` (contra CSRF de OAuth) y `nonce` (contra repetición) en una cookie
  firmada HMAC de 10 min; se verifica la firma del `id_token` con las llaves públicas de Google, `aud`, `iss`, `exp`,
  `nonce` y `email_verified`. El médico nuevo lleva su identidad en otra cookie firmada de 30 min (`ik_registro`,
  HttpOnly, Secure, SameSite=Lax, Path=/api): al registrar, el correo sale de la cookie, no del formulario. Con Google
  no se pide Turnstile ni correo de confirmación. No se guarda el identificador de Google ni la foto; solo
  `metodo_registro = 'google'` (migración 0008).

## Reglas de negocio

- **Cupo:** `total_cupos − leads con estatus 'cliente'` (`ESTATUS_QUE_OCUPAN_CUPO` en `src/compartido/leads.ts`).
  Cambió el 28-oct: con la descarga directa cada prueba es automática y, si contaran, el cupo se agotaría sin ventas.
- **Lead repetido:** misma respuesta `201` (no revela qué correos existen); no pisa los datos guardados; reenvía la
  confirmación solo si sigue pendiente y pasaron 10 minutos.
- **Campo trampa** (`sitio_web`): si llega lleno, `201` sin guardar.
- **Aviso de lead:** a `contacto@` solo cuando el médico confirma su correo, una vez.
- **Aprobar prueba (panel):** sigue disponible para reenviar un enlace a mano; exige correo confirmado y una versión vigente; si el correo falla, no queda enlace ni cambia el
  estatus. Pone `prueba` (un `cliente` sigue siendo `cliente`) y registra `primer_contacto_utc` si no existía.
- **primer_contacto_utc:** se fija la primera vez que el lead sale de `nuevo`; no se reescribe.
- **Eventos:** lista cerrada; `utm_source` en lista cerrada (`tarjeta` = QR de las tarjetas); lo desconocido → `otro`.
  Sin repetidos por solicitud. El sitio no envía nada si el navegador pide no ser rastreado (GPC o DNT).
- **Retención (cron):** sin confirmar a los 30 días; descartados a los 12 meses de descartarlos; tokens de
  confirmación vencidos a los 7 días; ARCO resueltas a los 24 meses (plazo a validar con el abogado). Los eventos
  agregados se conservan. Borrar un lead arrastra sus confirmaciones, descargas y testimonios.
- **Límite de frecuencia:** binding nativo (aproximado, por ubicación de Cloudflare): 5/min por IP en formularios,
  60/min en eventos. La llave es `SHA-256(sal + ámbito + IP)` y vive solo en memoria.

## Seguridad

- CSP: la del sitio (`public/_headers`) más `static.cloudflareinsights.com` (Web Analytics) en `script-src` y
  `cloudflareinsights.com` en `connect-src`. La API responde con `default-src 'none'`; el panel, solo `'self'`.
- HSTS 2 años con `includeSubDomains; preload` (ver README_DEPLOY §14 antes de inscribirlo), `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva, `frame-ancestors 'none'`.
- CORS: solo `ORIGEN` (+ `ORIGENES_EXTRA` en desarrollo). Otro origen → 403 (eventos → 204).
- Secretos solo con `wrangler secret put` (lista en `wrangler.toml`).
- Logs: `{metodo, ruta (patrón), estado, ms}`; errores con nombre y código, y los correos enmascarados.
- CSV del panel con protección contra fórmulas (`=`, `+`, `-`, `@`) y BOM para Excel.
- `/admin`: Access en el borde y validación propia del JWT (RS256, `aud`, `iss`, `exp`, correo en `ADMIN_CORREOS`).

## Licencias: diseño para la fase 2 (no implementado)

Fase 1 (hoy): Alan firma la licencia en su computadora y la adjunta por correo. El backend no guarda licencias ni la
llave privada.

Fase 2 propuesta, sin tocar la llave:
1. Tabla `licencias` (lead_id, id_instalacion, archivo firmado en texto, emitida_utc): solo guarda lo que Alan sube ya
   firmado desde el panel.
2. Portal `/mi-cuenta` con magic link: reutiliza el mismo patrón de token de un solo uso (`confirmaciones`) con
   vencimiento de 15 min y sesión corta (cookie `HttpOnly; Secure; SameSite=Strict` firmada con HMAC).
3. El médico descarga su licencia y su instalador desde ahí; la firma sigue fuera de la nube.

## Pruebas

`npm test` (todas) o `npm run test:worker` (solo backend). Miniflare vía `getPlatformProxy`: D1 y R2 locales reales
con las migraciones del repo; correo, límite de frecuencia, Turnstile y las llaves de Access son dobles. Cubren:
validación, Turnstile simulado, campo trampa, duplicados, CORS, cabeceras, eventos fuera de lista, paridad de eventos
sitio–Worker, cupo, testimonios con y sin consentimiento, tokens de confirmación y descarga (vencimiento, uso único y
concurrencia), URL firmada, panel (JWT válido e inválidos, CSRF, CSV, métricas), ARCO, retención y privacidad
(esquema, valores y logs).
