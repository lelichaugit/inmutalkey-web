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
| Precio, lugares, fechas, correo, instalador, datos legales | `src/site.config.ts` (los `TODO_DEFINIR`) |
| Render 3D del logo, avatar del chat, capturas de la app | Subir a `capturas/` (ver `capturas/LEEME.md`) |
| Preguntas frecuentes | `src/data/faq.ts` |
| Funciones del producto | `src/data/funciones.ts` |

Las ramas que no son de producción generan una versión de vista previa con su propia dirección.

## 7. Pendiente para la Fase C (formularios y reseñas)

1. **Workers & Pages → D1** → **Create database** → `inmutalkey-web`; su ID va en `wrangler.toml` junto con el Worker
   de `/api/*` (ya está la plantilla comentada).
2. **Turnstile** → **Add widget** para `inmutalkey.com` → la *site key* (pública) va a la configuración y la
   *secret key* como secreto.
3. En el Worker: **Settings → Variables and Secrets** → secretos `TURNSTILE_SECRET_KEY` y `RATE_LIMIT_SALT`
   (texto aleatorio largo).
4. Migraciones: `npx wrangler d1 migrations apply inmutalkey-web --remote`.
