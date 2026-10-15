# Animaciones y navegación — API del sitio

Todo vive en `src/styles/global.css` (sección *Movimiento*) y `src/scripts/base.ts`. Es mejora progresiva:
sin JavaScript, o con "reducir movimiento" activado en el sistema, el contenido se ve completo y quieto.

## Reglas

1. **Nada en el primer pantallazo se oculta** (H1 del hero, botones del hero): es lo primero que ve quien escanea el QR.
2. **Sin `style=` ni `<script>` en línea** (la CSP los bloquea y el guardian detiene el build). Las variables por
   elemento (`--i`, `--w`, `--p`) las pone `base.ts` con CSSOM.
3. **Un elemento, un `transform`**: `data-animar` y `data-parallax` usan `transform`; si necesitas ambos, anida.
4. **Solo `transform`, `opacity`, `filter` y `clip-path`** para animar: corren en la GPU y no mueven el layout
   (celulares de gama media a 60 fps).
5. Contenido que se crea con JS (por ejemplo, opciones de una lista) no recibe el atributo de alcance de Astro:
   estilízalo con `:global(...)`.

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
| `data-progreso-scroll` | `base.ts` pone `--p` (0 → 1 mientras cruza la ventana) y `--salida` (0 → 1 al salir por arriba) para usarlas en `calc()` |

## Otros

| Atributo | Efecto |
|---|---|
| `data-contar="7"` | El número cuenta de 0 a 7 al verse (el HTML ya trae el 7; admite decimales: `"38.2"`) |
| `a[data-compartir]` | Abre la hoja nativa de compartir del teléfono; sin ella, sigue el enlace de WhatsApp (`Compartir.astro`) |
| `a[data-seccion][data-etiqueta]` | Enlace que participa en la sección activa: barra, riel lateral y título de sección en la barra del celular |

## Navegación

- **Barra**: transparente sobre el hero, sólida al bajar; se oculta al bajar y vuelve al subir.
- **Celular**: dentro de una sección, el nombre de la sección sustituye a "InmutalKey" en la barra; menú a pantalla
  completa con "Compartir con un colega"; botón flotante de WhatsApp.
- **Escritorio ancho (≥ 1360 px)**: riel lateral de puntos con el nombre de cada sección (`Riel.astro`).
- **Enlaces internos**: desplazamiento suave y el foco pasa a la sección destino (teclado y lectores de pantalla).
- **Entre páginas**: View Transitions de CSS y precarga al pasar el cursor.
