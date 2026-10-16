// Escenas que dependen del scroll y no caben en CSS puro. Se carga diferido desde base.ts solo cuando la página
// tiene `[data-historia]` y el usuario no pidió movimiento reducido.
//
// Historia de integridad (Integridad.astro): la escena fijada la mueve el motor de scroll (--p en sus [data-p],
// data-paso y el evento `escena:paso`). Aquí solo vive lo que CSS no puede hacer: la huella que se "decodifica"
// carácter por carácter cuando la escena llega a su paso (`data-huella="…" data-huella-paso="n"`): la de la nota
// sellada (9f2c41e8…b07a, paso 3) y la que deja una alteración por fuera de la app (paso 5, en la lupa). El HTML ya trae
// la huella final, así que sin este módulo (sin JS o con movimiento reducido) se ve tal cual. Las huellas viven en una
// zona aria-hidden: los cambios de texto no llegan a los lectores de pantalla.

const HEX = '0123456789abcdef';
/** Duración total del efecto (ms): cada carácter se fija en orden, de izquierda a derecha. */
const DURACION = 950;
/** Intervalo entre cambios de los caracteres aún sin fijar (ms): ~30 cuadros por segundo basta. */
const CADENCIA = 34;

interface Huella {
  el: HTMLElement;
  final: string;
  paso: number;
  cuadro: number;
}

function azar(): string {
  return HEX.charAt(Math.floor(Math.random() * HEX.length));
}

function decodificar(h: Huella): void {
  window.cancelAnimationFrame(h.cuadro);
  const caracteres = [...h.final];
  // Solo cambian los dígitos hexadecimales; los puntos suspensivos y espacios se quedan quietos.
  const posiciones = caracteres.map((c, i) => (HEX.includes(c) ? i : -1)).filter((i) => i >= 0);
  const total = Math.max(posiciones.length, 1);
  const inicio = performance.now();
  let ultimo = 0;

  const paso = (ahora: number): void => {
    const t = (ahora - inicio) / DURACION;
    if (t >= 1) {
      h.el.textContent = h.final;
      return;
    }
    if (ahora - ultimo >= CADENCIA) {
      ultimo = ahora;
      // Los primeros 30 % del tiempo todo es ruido; después se van fijando en orden.
      const fijos = Math.floor(Math.max(0, (t - 0.3) / 0.7) * total);
      const salida = caracteres.slice();
      posiciones.forEach((pos, n) => {
        if (n >= fijos) salida[pos] = azar();
      });
      h.el.textContent = salida.join('');
    }
    h.cuadro = window.requestAnimationFrame(paso);
  };
  h.cuadro = window.requestAnimationFrame(paso);
}

function iniciarHistoria(historia: HTMLElement): void {
  const huellas: Huella[] = [...historia.querySelectorAll<HTMLElement>('[data-huella]')].map((el) => ({
    el,
    final: el.dataset['huella'] ?? el.textContent ?? '',
    paso: Number(el.dataset['huellaPaso'] ?? '0'),
    cuadro: 0,
  }));
  if (huellas.length === 0) return;

  // El motor pone data-paso antes de avisar con `escena:paso`; este módulo llega tarde (diferido), así que parte del
  // paso actual y solo anima al cruzar un paso hacia adelante.
  let anterior = Number(historia.dataset['paso'] ?? '0');
  historia.addEventListener('escena:paso', () => {
    const actual = Number(historia.dataset['paso'] ?? '0');
    for (const h of huellas) {
      if (actual >= h.paso && anterior < h.paso) decodificar(h);
    }
    anterior = actual;
  });
}

export function iniciarEscenas(raiz: ParentNode): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  raiz.querySelectorAll<HTMLElement>('[data-historia]').forEach(iniciarHistoria);
}
