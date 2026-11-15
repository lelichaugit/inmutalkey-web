# Publicar inmutalkey.com en Cloudflare

El sitio se publica como **Worker con Static Assets** (el flujo actual de *Workers & Pages* al importar un repositorio
de Git): Cloudflare compila el sitio y `wrangler deploy` sube `dist/` a su red. La configuración vive en
`wrangler.toml`. Cada push a la rama de producción vuelve a publicar.

## 1. Ajustes de compilación del Worker

En **Workers & Pages → inmutalkey-web → Settings → Build**:

| Campo | Valor |
|---|---|
| Git repository | `lelichaugit/inmutalkey-web` |
| Production branch | `main` (o `claude/compassionate-hopper-546l4v` mientras no exista `main`) |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

El nombre del Worker en el panel debe ser **`inmutalkey-web`**, igual que `name` en `wrangler.toml`.

`build:cloudflare` procesa primero lo que haya en `capturas/` (render 3D del logo, avatar del chat y capturas de la
app) y luego compila. Así basta con subir imágenes a GitHub.

**Variables de compilación** (*Settings → Build → Variables and secrets*), opcionales:

| Variable | Valor | Para qué |
|---|---|---|
| `SITE_ENV` | `produccion` | Explícito; sin ella el sitio ya asume producción |
| `NODE_VERSION` | `22` | El repositorio ya lo indica en `.nvmrc` |

Después de guardar, en **Deployments** usa **Retry build** (o haz cualquier push). Al terminar, el sitio responde en
`https://inmutalkey-web.<tu-subdominio>.workers.dev`.

> Si el build falla con "falta un número de WhatsApp válido" o "el build de producción no se publica", es el guardian
> del sitio: el mensaje dice exactamente qué corregir.

## 2. Conectar el dominio

1. En el Worker: **Settings → Domains & Routes → Add → Custom domain** → `inmutalkey.com` → **Add domain**.
   Como el dominio ya está en tu cuenta de Cloudflare, el DNS y el certificado se crean solos.
2. Repite con `www.inmutalkey.com`.
3. Espera a que ambos aparezcan como activos (normalmente minutos).

## 3. Redirigir www → inmutalkey.com

1. En el dominio **inmutalkey.com** → **Rules** → **Redirect Rules** → **Create rule**.
2. Nombre: `www a dominio principal`.
3. *When incoming requests match*: **Custom filter expression** → `Hostname` `equals` `www.inmutalkey.com`.
4. *Then*: **Dynamic** → `concat("https://inmutalkey.com", http.request.uri.path)` → código **301** →
   activa **Preserve query string**.
5. **Deploy**.

## 4. Ajustes recomendados de la zona

- **SSL/TLS** → modo **Full (strict)**.
- **SSL/TLS → Edge Certificates** → **Always Use HTTPS**: activado.
- No actives *Rocket Loader* ni *Email Address Obfuscation*: inyectan scripts que la política de seguridad del sitio
  (CSP) bloquea a propósito.

## 5. Comprobar que todo quedó bien

- `https://inmutalkey.com` abre el sitio y `https://www.inmutalkey.com` redirige a él.
- `https://inmutalkey.com/verificar` abre sin `.html`; `/una-pagina-que-no-existe` muestra la 404 propia.
- `https://inmutalkey.com/sitemap.xml` y `/robots.txt` responden.
- En las herramientas del navegador (pestaña Red), la portada trae el encabezado `Content-Security-Policy`.
- Los botones de WhatsApp abren el chat con el mensaje prellenado.

Para probar lo mismo en tu computadora: `npm run build:cloudflare` y luego `npx wrangler dev` (usa el mismo motor que
Cloudflare, con los encabezados de `public/_headers`).

## 6. Cambiar contenido después

| Qué | Dónde |
|---|---|
| Precio, lugares, fechas, correo, datos legales | `src/site.config.ts` (los `TODO_DEFINIR`) |
| Versión vigente y huellas SHA-256 | `src/site.config.ts` → `version` |
| Logos, favicon, iconos, imagen OG | `marca/` → `npm run marca` · `npm run og` |
| Capturas de la app (solo bóveda demo) | Subir a `capturas/` (ver `capturas/LEEME.md`) |
| Preguntas frecuentes | `src/data/faq.ts` |

Las ramas que no son de producción generan una versión de vista previa con su propia dirección.

## 7. Backend (Fase C): qué ya está hecho y qué te toca

El Worker de `/api/*` y `/admin` vive en `src/worker/` (detalle técnico y contrato de la API: `docs/BACKEND.md`).

**Ya hecho desde Claude (27-oct-2026):**

- Base D1 `inmutalkey-web` creada (región WNAM) con su ID en `wrangler.toml`.
- Las 8 migraciones (0001–0008) aplicadas en producción y registradas en `d1_migrations`: `npm run db:migrar`
  dirá "No migrations to apply". Las siguientes (`0009_…`) se aplican con ese mismo comando.

**Te toca en el panel de Cloudflare (en este orden).** Hasta terminar los pasos 8 a 11, no fusiones la rama del
backend a la de producción: el deploy fallaría si falta el bucket de R2, y el sitio actual seguiría publicado sin
cambios.

## 8. R2: bucket de instaladores

1. **R2 Object Storage → Enable** (pide un método de pago aunque te quedes en el nivel gratuito: 10 GB y egreso gratis).
2. **Create bucket** → `inmutalkey-instaladores` → ubicación automática. **No** actives acceso público ni dominio
   público: el bucket es privado y solo se descarga con URL firmada de 5 minutos.
3. Sube los archivos de la versión vigente a las rutas que espera el sitio (`src/site.config.ts` → `version.paquetes`):

   | Objeto en `inmutalkey-instaladores` | SHA-256 |
   |---|---|
   | `instaladores/0.4.0/InmutalKey_0.4.0_Instalador.exe` | `d8cf81a06db3214e7ff460b1446aa533e44a893a84cd302efd77cc467516190e` |
   | `instaladores/0.4.0/InmutalKey_0.4.0_Beta.zip` | `1f7c72d1111fca139b269f8f5abd1fad783a6efb5721e137decad1fba82f8d67` |

   Luego en **/admin → Instaladores** registra la versión `0.4.0` con la ruta del **instalador** (los campos ya muestran
   esos valores como ejemplo), su nombre de archivo y su huella, marcada como vigente: ese es el archivo que descarga el
   enlace personal. El ZIP queda en R2 para compartirlo a mano; el sitio publica su huella en `/verificar`.
   Al cambiar de versión: actualiza `version` en `site.config.ts` (las pruebas exigen huellas de 64 hex y el número de
   versión en el nombre), sube los archivos y regístralos en /admin con las mismas huellas.
4. **R2 → Manage API tokens → Create API token**: permiso **Object Read only**, limitado al bucket
   `inmutalkey-instaladores`, sin vencimiento o con el que prefieras. Guarda el *Access Key ID*, el
   *Secret Access Key* y tu *Account ID* (sale en la misma pantalla).

## 9. Correo saliente (Cloudflare Email Sending)

Requiere **Workers Paid** (5 USD al mes; incluye 3,000 correos al mes). Tu correo de Hostinger no se toca: Cloudflare
pone sus registros en el subdominio `cf-bounce` y la recepción de `contacto@inmutalkey.com` sigue en Hostinger.

1. **Workers & Pages → Plans** → Workers Paid.
2. **Compute → Email Service → Email Sending → Onboard Domain** → `inmutalkey.com`.
3. **Trampa con DMARC**: el asistente ofrece crear un TXT en `_dmarc.inmutalkey.com`. **No lo aceptes**: ya tienes uno
   (`v=DMARC1; p=none`) y con dos registros los servidores ignoran tu política. En su lugar, edita el existente:
   - Ahora: `v=DMARC1; p=none; rua=mailto:contacto@inmutalkey.com; adkim=r; aspf=r`
   - En 3 o 4 semanas, si los reportes salen limpios (Hostinger y Cloudflare con DKIM alineado):
     `v=DMARC1; p=quarantine; rua=mailto:contacto@inmutalkey.com`
4. **No cambies** el SPF de la raíz (`v=spf1 include:_spf.mail.hostinger.com ~all`) ni los MX de Hostinger. Cloudflare
   usa `cf-bounce.inmutalkey.com` para el sobre del mensaje y firma con DKIM de `inmutalkey.com`: DMARC pasa por DKIM.
5. El remitente es `avisos@inmutalkey.com` (`CORREO_REMITENTE` en `wrangler.toml`). No necesita buzón; si quieres que
   las respuestas lleguen, los correos ya llevan *Reply-To* al médico (avisos internos) o puedes crear el alias en
   Hostinger.
6. Prueba: desde el panel de Email Sending manda un correo de prueba a una cuenta de Gmail y revisa en
   "Mostrar original" que diga `DKIM: PASS` y `DMARC: PASS`.

**Alternativa sin pagar (Resend, 100 correos al día):** `CORREO_PROVEEDOR = "resend"` en `wrangler.toml`, alta del
dominio en Resend (sus registros van en `send.inmutalkey.com`, tampoco tocan Hostinger), el secreto `RESEND_API_KEY`
y borra el bloque `[[send_email]]` de `wrangler.toml` (en el plan Free ese binding no aplica).
Resend sería un encargado más (EE. UU.) que hay que declarar en el aviso de privacidad.

## 10. Turnstile

1. **Turnstile → Add widget** → nombre `inmutalkey.com`, dominio `inmutalkey.com`, modo **Managed**.
2. La **site key** (pública) va en `src/site.config.ts` → `turnstile.siteKey` (mientras sea `TODO_DEFINIR`, los
   formularios de producción se muestran deshabilitados con la invitación a WhatsApp).
3. La **secret key** va como secreto `TURNSTILE_SECRET` (paso 12).

## 11. Cloudflare Access para /admin

1. **Zero Trust** (plan gratuito) → elige el nombre de tu equipo; queda `<equipo>.cloudflareaccess.com`. Escríbelo en
   `ACCESS_EQUIPO` de `wrangler.toml` si no es `inmutalkey.cloudflareaccess.com`.
2. **Access → Applications → Add an application → Self-hosted**:
   - Nombre: `Panel InmutalKey`. Dominios: `inmutalkey.com/admin` **y** `inmutalkey.com/api/admin` (dos rutas en la
     misma aplicación).
   - Duración de sesión: 24 h.
   - Política **Allow** → *Include* → *Emails* → solo tu correo. Método de inicio: *One-time PIN* (código por correo).
3. Copia el **Application Audience (AUD) Tag** de la aplicación: va como secreto `ACCESS_AUD`.
4. El Worker revisa por su cuenta el JWT de Access (firma, audiencia, vencimiento y correo). Si algún día Access se
   desactiva por error, `/admin` sigue respondiendo 401.

## 12. Secretos del Worker

Desde tu computadora, en la carpeta del repo (`npx wrangler login` la primera vez), uno por uno:

```sh
npx wrangler secret put TURNSTILE_SECRET      # paso 10
npx wrangler secret put LIMITE_SAL            # texto aleatorio largo (p. ej. de un gestor de contraseñas)
npx wrangler secret put ACCESS_AUD            # paso 11
npx wrangler secret put ADMIN_CORREOS         # tu correo (o varios separados por coma)
npx wrangler secret put R2_CUENTA_ID          # paso 8
npx wrangler secret put R2_ACCESS_KEY_ID      # paso 8
npx wrangler secret put R2_SECRET_ACCESS_KEY  # paso 8
npx wrangler secret put SESION_SECRETO        # texto aleatorio largo, distinto de LIMITE_SAL
npx wrangler secret put GOOGLE_CLIENT_SECRET  # paso 16 (si activas Google)
```

Opcional, para ver las visitas de Web Analytics en el panel: `CF_API_TOKEN_ANALITICA` (token con *Account Analytics:
Read*), `CF_CUENTA_ID` y `WA_SITE_TAG` (sale en **Web Analytics → tu sitio → Manage site**). Sin ellos, el panel usa
solo las vistas agregadas que registra el propio sitio.

Nunca pongas secretos en `wrangler.toml`, en `.dev.vars` subido a Git ni en el chat.

## 13. Publicar

1. Fusiona la rama del backend a la de producción. Cloudflare compila (`npm run build:cloudflare`) y despliega.
2. Comprueba:
   - `https://inmutalkey.com/api/fundadores/cupo` → `{"total":0,"restantes":0}`.
   - `https://inmutalkey.com/admin` → te pide el código de Access y luego muestra el panel con tu correo arriba.
   - En **Ajustes** del panel pon los lugares totales; en **Instaladores** registra la versión con su SHA-256
     (`Get-FileHash .\archivo.exe -Algorithm SHA256` en PowerShell).
   - Regístrate tú mismo en `/fundadores` con un correo de prueba: al confirmar debes caer en `/descarga` con tu
     enlace. Pruébalo también desde el celular («Mandármelo al correo») y con Google (§16).
   - Si alguien confirmó antes de que hubiera versión vigente: **Instaladores → Enviar enlace a quienes esperan**.
   - **Workers & Pages → inmutalkey-web → Settings → Triggers**: aparece el cron `17 9 * * *` (retención diaria).
3. Local: copia `.dev.vars.example` a `.dev.vars`, `npm run db:migrar:local` y `npm run dev:worker`
   (panel en `http://localhost:8787/admin` sin Access, solo con `ENTORNO=desarrollo`).

## 14. HSTS con preload

El encabezado ya lleva `preload`, pero **no** inscribas el dominio en hstspreload.org hasta que todos los subdominios
que uses (correo web, `cf-bounce`, futuros) respondan por HTTPS: la inscripción tarda meses en revertirse y obliga a
HTTPS en todo `*.inmutalkey.com` en los navegadores.

## 15. Costos mensuales esperados (USD)

| Concepto | Con Cloudflare Email Sending | Con Resend |
|---|---|---|
| Workers | 5 (Paid) | 0 (Free) |
| Correo | incluido (3,000/mes; luego 0.35 por 1,000) | 0 (100/día, 3,000/mes) |
| D1, R2 (≤ 10 GB), Turnstile, Access (≤ 50 usuarios), cron, rate limiting, inicio con Google | 0 | 0 |
| **Total** | **≈ 5** | **0** |

Cada médico que descarga gasta unos 3 correos (confirmación, aviso a ti y, si lo pide, el enlace por correo): con
3,000 al mes caben ~1,000 registros. El instalador (~85 MB) sale de R2 sin costo de transferencia.

## 16. Inicio con Google

El médico puede registrarse con su cuenta de Google: el sitio recibe solo su nombre y su correo ya verificado
(alcances `openid email profile`, sin pasar por la revisión de Google porque no son alcances sensibles).

1. **console.cloud.google.com** → crea el proyecto `InmutalKey`.
2. **Google Auth Platform → Branding**: nombre `InmutalKey`, correo de soporte `contacto@inmutalkey.com`, logotipo
   (opcional), página principal `https://inmutalkey.com`, política de privacidad `https://inmutalkey.com/privacidad`,
   dominio autorizado `inmutalkey.com`.
3. **Audience**: tipo *External* → **Publish app** (en *Testing* solo entran los correos que agregues a mano).
4. **Data access**: agrega solo `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`.
5. **Clients → Create client → Web application**:
   - *Authorized redirect URIs*: `https://inmutalkey.com/api/auth/google/callback`
   - (Para probar en tu computadora agrega también `http://localhost:8787/api/auth/google/callback`.)
6. Copia el **Client ID** en `GOOGLE_CLIENT_ID` de `wrangler.toml` (es público) y el **Client secret** como secreto
   `GOOGLE_CLIENT_SECRET`. `SESION_SECRETO` también tiene que existir (§12).
7. Logotipo del botón: las reglas de marca de Google piden su «G» oficial. Descárgala de la guía *Sign in with Google
   branding guidelines* y guárdala como `public/brand/terceros/google-g.svg`; el build la muestra sola.
8. Enciende el botón en producción: `google.habilitado: true` en `src/site.config.ts`.

Comprueba: en `/fundadores`, **Continuar con Google** → eliges tu cuenta → regresas con el correo bloqueado y
«Conectado con Google» → completas → caes en `/descarga`. Si vuelves a entrar con Google ya registrado, vas directo a
la descarga.
