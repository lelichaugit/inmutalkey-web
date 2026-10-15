# Publicar inmutalkey.com en Cloudflare Pages

Tiempo estimado: 10–15 minutos de clics. Todo se hace en el panel de Cloudflare (dash.cloudflare.com) con la cuenta
donde compraste el dominio. Después de esto, **cada push a la rama de producción publica el sitio solo**.

## 0. Antes de empezar

- El código vive en GitHub: `lelichaugit/inmutalkey-web`.
- La rama de producción recomendada es `main`. Hoy el trabajo está en `claude/compassionate-hopper-546l4v`:
  fusiónala a `main` (con un pull request) o, para salir hoy mismo, usa esa rama como rama de producción en el paso 2
  y cámbiala a `main` después.

## 1. Crear el proyecto de Pages

1. **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git** (o "Import an existing Git repository").
2. Autoriza a Cloudflare en GitHub y elige el repositorio **inmutalkey-web**.
3. Configuración del build:

| Campo | Valor |
|---|---|
| Project name | `inmutalkey-web` |
| Production branch | `main` (o la rama de trabajo, ver paso 0) |
| Framework preset | `Astro` |
| Build command | `npm run build:cloudflare` |
| Build output directory | `dist` |
| Root directory | *(vacío)* |

`build:cloudflare` procesa primero lo que haya en `capturas/` (render 3D del logo, avatar del chat y capturas de la
app) y luego compila. Así basta con subir imágenes a GitHub.

4. **Environment variables** (en *Production*):

| Variable | Valor |
|---|---|
| `SITE_ENV` | `produccion` |
| `NODE_VERSION` | `22` |

   En *Preview* (opcional, para ver las reseñas de ejemplo en las ramas de prueba):
   `SITE_ENV` = `preview` y `SHOW_EXAMPLE_REVIEWS` = `true`.

5. **Save and Deploy**. Al terminar tendrás una dirección `https://inmutalkey-web.pages.dev`. Revísala.

> Si el build falla con "falta un número de WhatsApp válido" o "el build de producción no se publica", es el guardian
> del sitio haciendo su trabajo: el mensaje dice exactamente qué corregir.

## 2. Conectar el dominio

1. En el proyecto: **Custom domains** → **Set up a custom domain** → escribe `inmutalkey.com` → **Activate domain**.
   Como el dominio ya está en Cloudflare, el registro DNS se crea solo.
2. Repite con `www.inmutalkey.com`.
3. Espera a que ambos digan **Active** (normalmente minutos).

## 3. Redirigir www → inmutalkey.com

Pages no redirige dominios por sí solo; se hace con una regla de la zona:

1. En el dominio **inmutalkey.com** → **Rules** → **Redirect Rules** → **Create rule**.
2. Nombre: `www a dominio principal`.
3. *When incoming requests match*: **Custom filter expression** → `Hostname` `equals` `www.inmutalkey.com`.
4. *Then*: **Dynamic** → expresión `concat("https://inmutalkey.com", http.request.uri.path)` → código **301** →
   activa **Preserve query string**.
5. **Deploy**.

## 4. Ajustes recomendados de la zona

- **SSL/TLS** → modo **Full (strict)**.
- **SSL/TLS → Edge Certificates** → **Always Use HTTPS**: activado.
- No actives *Rocket Loader* ni *Email Address Obfuscation*: inyectan scripts que la política de seguridad del sitio
  (CSP) bloquea a propósito.

## 5. Comprobar que todo quedó bien

- `https://inmutalkey.com` abre el sitio y `https://www.inmutalkey.com` redirige a él.
- `https://inmutalkey.com/una-pagina-que-no-existe` muestra la página 404 propia.
- `https://inmutalkey.com/sitemap.xml` y `/robots.txt` responden.
- En las herramientas del navegador (pestaña Red), la página principal trae el encabezado `Content-Security-Policy`.
- Los botones de WhatsApp abren el chat con el mensaje prellenado.

## 6. Cambiar contenido después

| Qué | Dónde |
|---|---|
| Precios, lugares, fechas, correo, instalador, datos legales | `src/site.config.ts` (los `TODO_DEFINIR`) |
| Render 3D del logo, avatar del chat, capturas de la app | Subir a `capturas/` (ver `capturas/LEEME.md`) |
| Preguntas frecuentes | `src/data/faq.ts` |
| Funciones del producto | `src/data/funciones.ts` |

Cada commit a la rama de producción vuelve a publicar el sitio. Las demás ramas generan una vista previa con su propia
dirección `*.inmutalkey-web.pages.dev`.

## 7. Pendiente para la Fase C (formularios y reseñas)

Cuando se agreguen los formularios:

1. **Workers & Pages → D1** → **Create database** → `inmutalkey-web`. Copia su ID en `wrangler.toml` (`database_id`).
2. En el proyecto de Pages → **Settings → Bindings** → **D1 database**: variable `DB` → base `inmutalkey-web`.
3. **Turnstile** → **Add widget** para `inmutalkey.com` → copia la *site key* (pública) a la configuración y guarda la
   *secret key* como secreto.
4. **Settings → Variables and Secrets** → secretos `TURNSTILE_SECRET_KEY` y `RATE_LIMIT_SALT` (texto aleatorio largo).
5. Aplicar migraciones: `npx wrangler d1 migrations apply inmutalkey-web --remote`.
