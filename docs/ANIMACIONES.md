# Animaciones y navegación — API del sitio

Todo vive en `src/styles/global.css` (sección *Movimiento*), `src/scripts/base.ts`, `src/scripts/scroll.ts` (motor
de scroll) y `src/scripts/suave.ts` (Lenis). Es mejora progresiva: sin JavaScript, o con "reducir movimiento" activado
en el sistema, el contenido se ve completo y quieto.

## Cómo se mueve la página en cada dispositivo

| Dispositivo | Desplazamiento | Escenas |
|---|---|---|
| Windows y Mac (ratón o trackpad) | **Lenis** (`darkroomengineering/lenis`, se descarga solo aquí, 5.5 KB) suaviza la rueda | Motor de scroll |
| iPhone, iPad, Android (táctil) | Scroll nativo del sistema (ya tiene inercia; Lenis no se carga) | Motor de scroll |
| "Reducir movimiento" o sin JS | Nativo, sin suavizado | No se fijan: se ven en su estado final |

Lenis desplaza la ventana de verdad, así que `position: sticky` e IntersectionObserver funcionan igual en todos. El
motor (`scroll.ts`) solo lee `window.scrollY` una vez por cuadro y escribe variables CSS que cambiaron; la geometría
se mide al iniciar y cuando algo cambia de tamaño (no hay `getBoundingClientRect` por cuadro).

Clases en `<html>`: `.js` (hay JS: revelados) y `.movimiento` (hay JS y no se pidió reducir movimiento: escenas
fijadas, parallax, texto que se ilumina).

## Reglas

1. **Nada en el primer pantallazo se oculta** (H1 del hero, botones del hero): es lo primero que ve quien escanea el QR.
2. **Sin `style=` ni `<script>` en línea** (la CSP los bloquea y el guardian detiene el build). Las variables por
   elemento (`--i`, `--w`, `--p`) las pone `base.ts` con CSSOM.
3. **Un elemento, un `transform`**: `data-animar` y `data-parallax` usan `transform`; si necesitas ambos, anida.
4. **Solo `transform`, `opacity`, `filter` y `clip-path`** para animar: corren en la GPU y no mueven el layout
   (celulares de gama media a 60 fps).
5. Contenido que se crea con JS (por ejemplo, opciones de una lista) no recibe el atributo de alcance de Astro:
   estilízalo con `:global(...)`.
6. **En escenas, siempre `var(--p, 1)`**: el valor por omisión es el estado final, el que se ve sin JS o con
   movimiento reducido.
7. **Nada de `overflow: hidden` en un ancestro de un `sticky`** (rompe la fijación; `overflow: clip` sí se puede).
   Recorta dentro de `[data-escenario]`.
8. **No metas `data-parallax` ni `data-progreso-scroll` dentro de un `[data-escenario]`**: dentro de una escena
   fijada, todo se deriva de su `--p`.
9. **Zonas con scroll propio** (listas del simulador, carruseles): `data-lenis-prevent` para que Lenis no las
   secuestre en escritorio.
10. **Celular primero**: escenas más cortas (`--largo` ≈ 2), nada de efectos que dependan del cursor, objetivos
    táctiles de 44 px y texto de cuerpo de 16 px o más.

## Revelado al entrar en vista

| Atributo | Efecto |
|---|---|
| `data-animar="subir"` | Aparece subiendo 28 px (alias: clase `.revelar`) |
| `data-animar="aparecer"` | Solo aparece |
| `data-animar="escala"` | Crece de 94 % a 100 % |
| `data-animar="izquierda"` / `"derecha"` | Entra desde el lado |
| `data-animar="desenfoque"` | Pasa de borroso a nítido |
| `data-animar="cortina"` | Se descubre de arriba hacia abajo (`clip-path`) |
| `data-animar="titulo"` | Titular que sube **palabra por palabra** (`base.ts` envuelve cada palabra) |
| `data-retraso="1".."6"` | Retraso extra de 100 a 600 ms |
| `data-escalonar` (contenedor) | Sus hijos animados (directos o nietos) entran en cascada cada 85 ms |

## Ligado al scroll

| Atributo | Efecto |
|---|---|
| `data-parallax="suave" \| "medio" \| "fuerte" \| "inverso"` | Se desplaza 48 / 96 / 160 / −72 px a lo largo de su paso por la ventana |
| `data-progreso-scroll` | `--p` (0 → 1 mientras cruza la ventana) y `--salida` (0 → 1 al salir por arriba) para usarlas en `calc()` |
| `data-texto-luz` | Párrafo que se ilumina palabra por palabra al leerlo (`--lectura` 0 → 1; cada palabra lleva `--w` y el contenedor `--n`) |

## Escenas fijadas (estilo Apple)

```html
<section data-escena data-escena-marcas="0.2 0.45 0.7">   <!-- alto: --largo × alto de ventana (con .movimiento) -->
  <div data-escenario>…</div>                             <!-- se queda fijo arriba (100svh) mientras avanza -->
</section>
```

| Variable / atributo en la sección | Valor |
|---|---|
| `--largo` (lo pones tú en el CSS del componente) | Cuántas pantallas mide la escena. Fijación = `--largo − 1` pantallas de scroll. Celular ≈ 2, escritorio 2.5–4 |
| `--p` | 0 → 1 mientras el escenario está fijo |
| `--e` | Entrada: 0 cuando la escena asoma por abajo, 1 cuando se fija |
| `--s` | Salida: 0 cuando el final de la escena llega al borde inferior, 1 cuando sale por arriba |
| `data-escena-marcas` → `data-paso="n"` + `.alcanzo-1…n` + evento `escena:paso` | Pasos discretos para cambios con transición (textos, sellos) |

Tramos dentro de una escena (avance local 0 → 1 entre `a` y `b` de `--p`):

```css
.escena { --t: clamp(0, (var(--p, 1) - 0.2) / 0.25, 1); }          /* 0 antes de 0.2, 1 después de 0.45 */
.nota   { transform: translate3d(0, calc((1 - var(--t)) * 40px), 0) scale(calc(0.9 + var(--t) * 0.1)); }
```

## La llave (`Isotipo3D.astro`)

Render 3D con transparencia real (`public/brand/llave-3d-*.{avif,webp}`, desde `capturas/logomain-*`) y, con `plano`,
su plano técnico vectorial alineado al píxel + una línea de escáner. Toma el **alto** de su contenedor.

| Prop / variable | Efecto |
|---|---|
| `prioridad` | Solo la del hero (carga inmediata) |
| `brillo` | Luz que recorre la llave, recortada a su silueta (`--brillo` 0 → 1 la mueve; sin ella cruza una vez al cargar) |
| `plano` | Plano técnico debajo + escáner |
| `reflejo` | Reflejo en un "piso" pulido debajo de la llave (misma imagen, sin otra descarga); `--reflejo` 0 → 1 (0.3 por omisión) |
| `--materia` (0 → 1) | Cuánto de la llave es sólido, de arriba hacia abajo; debajo del escáner se ve el plano. Registrada con `@property`: se anima con `@keyframes` |

## Otros

| Atributo | Efecto |
|---|---|
| `data-contar="7"` | El número cuenta de 0 a 7 al verse (el HTML ya trae el 7; admite decimales: `"38.2"`) |
| `data-sin-flotante` | Zona donde se retira el botón flotante de WhatsApp (ya hay contacto a la vista o es interactiva: simulador, signos, cierre; el pie también) |
| `a[data-compartir]` | Abre la hoja nativa de compartir del teléfono; sin ella, sigue el enlace de WhatsApp (`Compartir.astro`) |
| `a[data-seccion][data-etiqueta]` | Enlace que participa en la sección activa: barra, riel lateral y título de sección en la barra del celular |

## Navegación

- **Barra**: transparente sobre el hero, sólida al bajar; se oculta al bajar y vuelve al subir.
- **Celular**: dentro de una sección, el nombre de la sección sustituye a "InmutalKey" en la barra; menú a pantalla
  completa con "Compartir con un colega"; botón flotante de WhatsApp.
- **Escritorio ancho (≥ 1360 px)**: riel lateral de puntos con el nombre de cada sección (`Riel.astro`).
- **Enlaces internos**: desplazamiento suave y el foco pasa a la sección destino (teclado y lectores de pantalla).
- **Entre páginas**: View Transitions de CSS y precarga al pasar el cursor.
