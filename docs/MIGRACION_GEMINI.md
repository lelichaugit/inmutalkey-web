# Continuar el proyecto con Gemini

Todo lo necesario para seguir está en el repositorio `lelichaugit/inmutalkey-web`: el código, `GEMINI.md` (contexto que
Gemini CLI carga solo), `docs/TRASPASO.md` (estado, decisiones y funciones verificadas de la app),
`docs/ANIMACIONES.md` (API de scroll y animación), `README_DEPLOY.md` (Cloudflare) y `npm run revisar` (la revisión
multi-dispositivo que se usó para validar el sitio).

## 1. Elige cómo trabajar

| | Gemini CLI (recomendado) | Chat de Gemini (web o app) |
|---|---|---|
| Lee el proyecto | Solo: carga `GEMINI.md` y abre los archivos que necesita | Tienes que darle el contexto y los archivos |
| Cambia archivos | Sí, en tu copia local | No: te da el texto y tú lo aplicas |
| Corre pruebas y build | Sí (`npm test`, `npm run build:cloudflare`, `npm run revisar`) | No: lo compruebas tú o Cloudflare |
| Sube cambios | Tú haces `git push` (o se lo pides) | Tú los subes desde GitHub |

### Opción A — Gemini CLI en tu computadora

1. Instala Node 22 y Git. Clona: `git clone https://github.com/lelichaugit/inmutalkey-web.git` y entra a la carpeta.
2. `git checkout claude/compassionate-hopper-546l4v` (la rama con todo el trabajo; ver §3) y `npm ci`.
3. Una vez: `npx playwright install chromium` (para `npm run revisar`).
4. Instala Gemini CLI siguiendo su guía oficial y ejecútalo dentro de la carpeta del proyecto: leerá `GEMINI.md`.
5. Pega el mensaje inicial de la §2 (la primera vez) y luego pide tareas con la plantilla de la §4.

### Opción B — Chat de Gemini

1. Si tu Gemini permite importar un repositorio de GitHub o adjuntar una carpeta, adjunta `lelichaugit/inmutalkey-web`.
   Si no, adjunta `GEMINI.md`, `docs/TRASPASO.md`, `docs/ANIMACIONES.md` y los archivos que vayas a cambiar.
2. Pega el mensaje inicial de la §2.
3. Pídele cambios como **archivos completos** (no fragmentos sueltos). Aplícalos en GitHub: abre el archivo → lápiz
   (Edit) → pega → *Commit changes* en tu rama de trabajo.
4. Revisa el despliegue en Cloudflare (Workers & Pages → inmutalkey-web → Deployments): si el build falla, el log dice
   qué corregir (el guardian explica cada caso). Luego ábrelo en tu celular.

## 2. Mensaje inicial (pégalo tal cual al empezar)

```text
Vas a continuar el desarrollo del sitio inmutalkey.com (repositorio lelichaugit/inmutalkey-web). Antes de proponer
nada, lee GEMINI.md, docs/TRASPASO.md y docs/ANIMACIONES.md: ahí están el producto, las reglas, la arquitectura y el
estado actual. Resumen:

- InmutalKey es un expediente clínico de escritorio (Windows) para consultorios privados en México: cada nota firmada
  queda sellada (huella SHA-256 encadenada + firma Ed25519), no se puede modificar y funciona sin internet. El público
  son médicos, no técnicos. El sitio se presenta sobre todo desde el celular (QR o WhatsApp).
- Stack: Astro 5 estático, TypeScript estricto sin any, CSS propio, Vitest; se publica como Worker con Static Assets
  en Cloudflare. Scroll: Lenis en escritorio, nativo en táctil, y un motor propio de escenas fijadas estilo Apple
  (src/scripts/scroll.ts) con variables CSS (--p) escritas solo en los elementos [data-p].
- Reglas que no se rompen: CSP estricta (sin style=, sin <script> ni <style> en línea, sin recursos de terceros); todo
  funciona sin JS y con "reducir movimiento" (var(--p, 1) = estado final); solo se anima transform/opacity/clip-path;
  celular primero (16 px, toques de 44 px, sin desborde a 360 px); nombres de @property únicos; solo afirmaciones de
  producto verificadas en docs/TRASPASO.md §1 (nada de PortaVault, cifras, CIE-11, recuperación de contraseña,
  validez legal; el respaldo sirve para recuperar en la misma computadora); jerga técnica solo como etiqueta
  secundaria junto a una en lenguaje de consultorio.
- Datos variables solo en src/site.config.ts (TODO_DEFINIR = no se muestra).

Forma de trabajo: una tarea a la vez. Primero dime qué archivos vas a tocar y por qué; luego entrega los archivos
completos modificados (o los cambios exactos), explica cómo verificarlo (npm run check, npx tsc --noEmit -p ., npm test,
npm run build:cloudflare con el guardian "sin hallazgos", y para lo visual npx wrangler dev + npm run revisar) y
propón el mensaje de commit en español con el formato "tipo(web): descripción". Si algo contradice las reglas o no
está verificado en TRASPASO §1, dímelo en lugar de inventarlo. Responde en español.
```

## 3. Ramas y despliegue

- Hoy todo el trabajo está en la rama `claude/compassionate-hopper-546l4v` (la que Cloudflare compila si así está
  configurado en *Settings → Build → Production branch*; revísalo ahí).
- Recomendado para seguir ordenado: en GitHub crea `main` a partir de esa rama, ponla como *Production branch* en
  Cloudflare y trabaja cada cambio en una rama propia que luego unes a `main` (cada rama no productiva genera una
  vista previa con su propia dirección).
- No hay secretos en el repositorio. Los ajustes de Cloudflare (dominios, redirección www, SSL) están en
  `README_DEPLOY.md`.

## 4. Plantilla para pedir una tarea

```text
Tarea: <qué quieres, en una o dos frases>.
Dónde se ve: <sección o página; celular / escritorio>.
Criterio de terminado: <cómo sabrás que está bien>.
Recuerda: reglas de GEMINI.md, archivos completos, cómo verificarlo y mensaje de commit.
```

## 5. Antes de publicar (lista corta)

1. `npm run check` y `npx tsc --noEmit -p .` sin errores; `npm test` en verde.
2. `npm run build:cloudflare` con "[guardian] sin hallazgos".
3. `npx wrangler dev` y en otra terminal `npm run revisar`: "Sin problemas en ningún perfil" (desbordes, errores,
   CSP, CLS y escenas fijadas en iPhone, Android, iPad y escritorio, sin JS y con movimiento reducido).
4. Mirar en el celular real (Safari en iPhone): aquí solo se probó Chromium.

## 6. Pendientes y siguientes pasos

**De Alan (no se pueden resolver desde el código):**
- Razón social y domicilio del responsable (aviso de privacidad, LFPDPPP) y revisión de abogado de `/privacidad` y
  `/terminos-fundadores`; después, `legal.revisadoPorAbogado: true` en `site.config.ts` (vuelven al sitemap e índice).
- Precios, cupos, fecha del precio de fundador y nota de IVA (`precios.*`, `cupos.*`).
- Instalador: nombre real del archivo, versión y huella SHA-256 (`instalador.*`) para `/verificar`.
- En la app: que el respaldo incluya `clinica.salt` y la llave de firma (hoy la copia solo abre en la misma
  computadora; el sitio lo dice así).
- Capturas reales de la app en `capturas/` (la galería aparece sola) y avatar del chat (`capturas/*logowsp*`).
- Probar en iPhone y Mac con Safari.

**Técnicos (de la auditoría, en orden de impacto):**
1. Hero: aún recalcula ~50 elementos por cuadro mientras se fija (aros SVG y anotaciones); se podría simplificar.
2. "Qué incluye" en celular: el carril recalcula las tarjetas visibles al entrar y salir (~16 ms a CPU 4x).
3. HTML de la portada: el contorno de la llave se repite 3 veces en línea (~7 KB cada uno); un `<symbol>` lo reduce.
4. Simulador en táctil: la ventana mide siempre lo que la consulta (deja espacio bajo agenda/receta) para no mover la
   página al cambiar de pantalla; se puede afinar.
5. "Cómo funciona" a 390×664: la maqueta queda en 13.7 px (limitada por el alto); la llave del sellado se puede
   agrandar (`--ig-llave-h` de 45cqh a ~52cqh).
6. A futuro: `animation-timeline: view()` como mejora progresiva para revelados simples (corre fuera del hilo principal).
7. Fase C: formularios con D1 y Turnstile (`README_DEPLOY.md` §7) para reseñas de fundadores.
