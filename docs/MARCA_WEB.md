# inmutalkey.com · Marca «Cristal Sellado» (v0.4.0)

Aplicación web de `docs/IDENTIDAD_MARCA.md` de **lelichaugit/clinica-nom004** (tag `v0.4.0`). Si este documento y la
identidad difieren, gana la identidad; si la identidad y el código de la app difieren, gana el código de la app.

## Archivos

| Qué | Dónde |
|---|---|
| Tokens (§8 tal cual) y temas | `src/styles/tokens.css` |
| Aurora, cristal, botones, campos, avisos, prosa, revelado | `src/styles/global.css` |
| Formularios y estados de la API · guía de instalación | `src/styles/formularios.css` · `src/styles/instalacion.css` |
| Activos oficiales (copiados sin redibujar) | `marca/` → `npm run marca` → `public/brand/`, favicon e iconos |
| Imagen Open Graph 1200×630 | `npm run og` → `public/og.png` (se versiona) |
| Fuente | `public/fonts/inter-variable.woff2`: Inter 4.1 oficial (rsms/inter), ejes `wght` y `opsz`, con `cv05` y `tnum`, recortada a los caracteres del sitio (57 KB) |

## Temas

- Sin elección: sigue a `prefers-color-scheme` (Niebla de día, Marino de noche).
- Selector (barra y menú del celular): Sistema · Claro · Oscuro · **Aurora** (variante eléctrica del oscuro, tema
  `oscuro-aurora` de la app). Se guarda en `localStorage["ik-tema"]` y `public/clases.js` lo aplica antes del primer
  pintado (sin parpadeo).
- `.tema-marino` = lámina oscura dentro de cualquier tema (hero, cierre, pie, maqueta de la app).
- Texto secundario: `--texto-2` (mezcla de `--texto-suave` con `--texto`). El `#4A5868` de §8 da 6.4:1 sobre el fondo
  Niebla; `--texto-2` da ≥ 7:1 también encima de la aurora, como exige la app.

## Reglas visuales

- **Cristal real** (`.cristal`, `backdrop-filter`) solo en la barra y 1–2 paneles por vista (hero: la maqueta;
  /descarga: la tarjeta del instalador). Tarjetas repetidas: `.tarjeta` (vidrio simulado, sin blur) y `.tarjeta-viva`
  para hover con `--halo-acento`.
- Radios 9/13/18/24 (`--radio-sm/--radio/--radio-lg/--radio-xl`), sombras `--elev-1/2/3` tintadas en Abismo.
- Foco: `--anillo-foco` (doble anillo) en todo lo interactivo; en contraste alto de Windows vuelve el contorno.
- Botones: `.boton`, `.boton-primario` (`--grad-primario` con brillo interior y halo), `.boton-grande`.
- Campos: radio 9 px, foco doble, errores bajo cada campo (`.campo-error`) redactados sin culpar.
- Logo: siempre `Logo.astro` (azul en claro, plata en oscuro, mono blanco en el pie). Nunca recolorear ni girar en 2D.

## Movimiento

- Solo `opacity` y `transform`. Todo se apaga con `prefers-reduced-motion`; el vidrio y la aurora, con
  `prefers-reduced-transparency`.
- Logo del hero: un giro de 360° en `rotateY` al cargar (900 ms, `cubic-bezier(.45, 0, .2, 1)`, impulso 1.12 y destello
  a la mitad con una segunda capa que solo cambia de opacidad).
- Aurora: deriva de 46 s solo con puntero fino (escritorio). En táctiles queda quieta: bajo el cristal de la barra,
  cada cuadro de deriva obliga a recalcular el desenfoque (+540 ms de bloqueo medido en Lighthouse móvil).
- Sombra del logo del hero: halo radial, no `filter: drop-shadow` (el filtro inflaba su área y lo volvía el LCP).
- Revelado: `.revelar` (+ `data-escalonar` en el contenedor para la cascada).
- Desplazamiento: Lenis (`src/scripts/suave.ts`) solo con puntero fino y sin «reducir movimiento»; en táctiles, scroll
  nativo (el módulo no se descarga). Los saltos a secciones los hace Lenis y el foco pasa al destino.
- Brillo del cursor: grupo `data-brillo` con celdas `.brillo`; `src/scripts/brillo.ts` escribe `--mx`/`--my` por celda
  una vez por cuadro. Solo puntero fino. En reposo el halo no se pinta (ni ocupa capa).

## Escenas por pasos (`src/scripts/escenas.ts`)

Problema, Integridad, «Un día en su consultorio» y Bóveda. Regla de oro: **el HTML y el CSS por omisión son el estado
final** (lo que se ve sin JS, con «reducir movimiento» o si el motor no carga). El motor solo decide el paso.

```html
<div data-escena data-escena-marcas="0.2 0.5 0.8" data-escena-auto="1700">
  <div data-escenario>… <div data-escena-vista>ilustración</div> …</div>
</div>
```

| Qué | Cómo |
|---|---|
| Fijar | El **componente** decide con CSS dónde `[data-escenario]` es `position: sticky` (siempre bajo `.movimiento`). Fijada → el paso sale del scroll |
| Sin fijar | Con `data-escena-auto` (ms por paso) se reproduce sola, una vez, cuando `[data-escena-vista]` entra en vista; `[data-escena-repetir]` la repite. Sin `auto`, estado final |
| Estado | La raíz recibe `.escena-lista`, `data-paso="n"`, `.alcanzo-1…n` y el evento `escena:paso` |
| CSS | Oculto «aún no llega» con `.escena-lista …`, mostrado con `.alcanzo-N …` (misma especificidad, después). Lo que solo vive en un paso, con `.escena-lista[data-paso='n']` |
| Avance continuo | `--p` (0 → 1) se escribe **solo** en los `[data-p]` (barra de progreso, carril, filas): una variable heredada recalcula todo el subárbol en cada cuadro |
| Huella | `data-huella="…" data-huella-paso="n"` se decodifica al llegar a su paso |
| Estilos | `<style is:global>` con prefijo por sección (`pb-`, `ig-`, `sim-`, `sg-`, `dia-`, `bv-`): las clases de estado las pone el motor y no llevan el atributo de alcance de Astro |

Dónde se fija cada una: Integridad en cualquier ancho (si la ventana mide ≥ 35 rem de alto); Problema, «Un día» y Bóveda
solo en escritorio (≥ 62 rem). En celular, Problema y Bóveda se reproducen solas y «Un día» son tarjetas apiladas.
`npm run revisar` comprueba que cada escena fijada se queda pegada mientras cruza la ventana.

## Escala

16 px de base hasta 1920 px; por encima crece con el ancho (`clamp(100%, 0.8333vw, 200%)`, 32 px en 4K) para que todo
mantenga su proporción sin pistas vacías. Todo el sitio está en `rem`, así que el zoom del navegador (70–200 %) también
lo escala. La maqueta de la app usa unidades de contenedor (`cqi`) y se reacomoda por debajo de 34 rem.

## Imágenes

- La maqueta de la app (`MockupApp.astro`) es HTML/CSS con pacientes ficticios y códigos CIE-10 oficiales, rotulada
  «Ilustración de la app con expedientes ficticios». Si se usan capturas reales, solo de la bóveda demo
  (Ctrl+Shift+D en la app), subidas a `capturas/`.
- El simulador, las escenas y el monitor de signos también son HTML/CSS con los mismos pacientes ficticios. **Sin
  cédulas ni teléfonos**, ni siquiera de ejemplo (hay prueba en `tests/portada.test.ts`).
- Nunca fotos de pacientes ni pantallas con datos reales.

## Voz

Usted, frases cortas, serena y precisa. Lo verificable sí (NOM-004-SSA3-2012, SQLCipher AES-256, Ed25519, sin internet,
los datos no salen del equipo); nada de «100 % seguro», certificaciones ni cifras. PortaVault no se menciona: aún no
existe como producto.
