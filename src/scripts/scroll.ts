// Motor de scroll: una sola pasada por cuadro (requestAnimationFrame) que convierte la posición de la página en
// variables CSS. API en docs/ANIMACIONES.md.
//
// Funciona igual con Lenis (escritorio: rueda y trackpad suavizados) que con el scroll nativo de iPhone, iPad y
// Android: en ambos casos la ventana se desplaza de verdad y aquí solo se lee `window.scrollY`. Con Lenis, base.ts
// llama a `cuadroAhora()` desde su evento `scroll` (sincroniza el primer cuadro de cada gesto; sin pasadas dobles).
//
// Rendimiento: la geometría se mide al iniciar y cuando algo cambia de tamaño (offsetTop, que ignora los transform:
// el parallax no se mide a sí mismo). En cada cuadro no se lee el DOM; solo se escriben las variables que cambiaron,
// así que un elemento lejos de la vista (valores ya en 0 o 1) no cuesta nada.
//
// Destinos ([data-p]): una variable CSS escrita en un contenedor se hereda y obliga a recalcular el estilo de TODO su
// subárbol en cada cuadro (en Integridad eran ~260 elementos: 13 fps en un Android de gama media). Si una pista tiene
// descendientes con `data-p`, las variables se escriben solo en ellos (los que de verdad se mueven); si no, en la
// pista misma. Cada `[data-p]` pertenece a la pista rastreada más cercana hacia arriba (o a sí mismo).

type Tipo = 'escena' | 'progreso' | 'parallax' | 'luz';

interface Pista {
  el: HTMLElement;
  tipo: Tipo;
  /** Borde superior en coordenadas del documento, sin transforms. */
  top: number;
  alto: number;
  /** Alto del escenario fijo (solo escenas). */
  escenario: number;
  /** ¿El escenario está fijo (sticky) a este ancho? Una escena que el CSS no fija (p. ej. "Qué incluye" en celular)
   *  no recibe variables: se queda en su estado final y no recalcula estilos en cada cuadro. */
  fija: boolean;
  /** Umbrales de --p que cuentan como pasos (solo escenas con data-escena-marcas). */
  marcas: number[];
  /** Tope de --p (`data-progreso-hasta`): pasado ese punto ya no se escribe y el subárbol no se recalcula. */
  hasta: number;
  /** ¿Escribe --salida? Solo con `data-progreso-salida` (cada variable escrita recalcula el estilo del subárbol). */
  salida: boolean;
  paso: number;
  escritos: Map<string, string>;
  /** Dónde se escriben las variables: sus `[data-p]` o, si no tiene, la pista misma. */
  destinos: HTMLElement[];
}

export interface OpcionesScroll {
  /** ¿Se permiten escenas fijadas, parallax y texto que se ilumina? (false con movimiento reducido) */
  movimiento: boolean;
  /** Se llama una vez por cuadro con scroll, después de actualizar las variables. */
  alCuadro?: (y: number, altoVentana: number) => void;
}

export interface MotorScroll {
  /** Vuelve a medir (después de cambiar contenido que mueve la página). */
  medir(): void;
  /** Pide un cuadro (por ejemplo, después de un salto programático). */
  pedirCuadro(): void;
  /**
   * Actualiza las variables ya, en este cuadro, y cancela el cuadro pendiente (nunca dos pasadas por cuadro). Para
   * Lenis: mueve la ventana dentro de su requestAnimationFrame; en el primer cuadro de cada gesto aún no hay evento
   * `scroll` del navegador que pida un cuadro, y sin esta llamada las variables irían ese cuadro detrás.
   */
  cuadroAhora(): void;
}

const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function topDocumento(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/** Envuelve cada palabra en `.luz-palabra` (con --w) y deja el total en --n del contenedor. */
function partirEnPalabras(el: HTMLElement): void {
  if (el.dataset['partido'] === 'si') return;
  el.dataset['partido'] = 'si';
  let n = 0;
  const caminante = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textos: Text[] = [];
  while (caminante.nextNode()) textos.push(caminante.currentNode as Text);
  for (const t of textos) {
    const fragmento = document.createDocumentFragment();
    for (const parte of (t.textContent ?? '').split(/(\s+)/)) {
      if (parte === '') continue;
      if (/^\s+$/.test(parte)) {
        fragmento.append(document.createTextNode(parte));
        continue;
      }
      const palabra = document.createElement('span');
      palabra.className = 'luz-palabra';
      palabra.textContent = parte;
      palabra.style.setProperty('--w', String(n++));
      fragmento.append(palabra);
    }
    t.replaceWith(fragmento);
  }
  el.style.setProperty('--n', String(Math.max(n, 1)));
}

export function iniciarScroll({ movimiento, alCuadro }: OpcionesScroll): MotorScroll {
  const pistas: Pista[] = [];
  const agregar = (selector: string, tipo: Tipo): void => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const marcas = (el.dataset['escenaMarcas'] ?? '')
        .split(/[\s,]+/)
        .map(Number)
        .filter((m) => Number.isFinite(m) && m > 0 && m <= 1)
        .sort((a, b) => a - b);
      const hasta = Number(el.dataset['progresoHasta'] ?? 1);
      pistas.push({
        el,
        tipo,
        top: 0,
        alto: 0,
        escenario: 0,
        fija: true,
        marcas,
        paso: -1,
        escritos: new Map(),
        hasta: Number.isFinite(hasta) && hasta > 0 && hasta <= 1 ? hasta : 1,
        salida: el.hasAttribute('data-progreso-salida'),
        destinos: [],
      });
    });
  };

  agregar('[data-progreso-scroll]', 'progreso');
  if (movimiento) {
    agregar('[data-escena]', 'escena');
    agregar('[data-parallax]', 'parallax');
    document.querySelectorAll<HTMLElement>('[data-texto-luz]').forEach(partirEnPalabras);
    agregar('[data-texto-luz]', 'luz');
  }

  // Reparte los [data-p] entre sus pistas.
  const porElemento = new Map<HTMLElement, Pista>();
  for (const p of pistas) if (!porElemento.has(p.el)) porElemento.set(p.el, p);
  document.querySelectorAll<HTMLElement>('[data-p]').forEach((el) => {
    for (let n: HTMLElement | null = el; n; n = n.parentElement) {
      const pista = porElemento.get(n);
      if (pista) {
        pista.destinos.push(el);
        return;
      }
    }
  });
  for (const p of pistas) if (p.destinos.length === 0) p.destinos.push(p.el);

  let altoVentana = window.innerHeight;
  let pendiente = false;
  let idCuadro = 0;

  const escribir = (p: Pista, nombre: string, valor: number): void => {
    const texto = valor.toFixed(4);
    if (p.escritos.get(nombre) === texto) return;
    p.escritos.set(nombre, texto);
    for (const d of p.destinos) d.style.setProperty(nombre, texto);
  };

  const marcarPaso = (p: Pista, avance: number): void => {
    if (p.marcas.length === 0) return;
    let n = 0;
    while (n < p.marcas.length && avance >= (p.marcas[n] ?? 2)) n++;
    if (n === p.paso) return;
    p.paso = n;
    p.el.dataset['paso'] = String(n);
    for (let i = 1; i <= p.marcas.length; i++) p.el.classList.toggle(`alcanzo-${i}`, i <= n);
    p.el.dispatchEvent(new CustomEvent('escena:paso', { detail: { paso: n } }));
  };

  function cuadro(): void {
    // Si llega antes que el cuadro pedido (Lenis → cuadroAhora), ese cuadro sobra: se cancela.
    if (pendiente) window.cancelAnimationFrame(idCuadro);
    pendiente = false;
    const y = window.scrollY;
    const vh = altoVentana;
    for (const p of pistas) {
      switch (p.tipo) {
        case 'escena': {
          if (!p.fija) break;
          // --p: avance mientras el escenario está fijo. --e: entrada (borde superior de la ventana inferior a la
          // superior). --s: salida (borde inferior de la escena de la ventana inferior a la superior).
          const avance = limitar((y - p.top) / Math.max(p.alto - p.escenario, 1));
          escribir(p, '--p', avance);
          escribir(p, '--e', limitar((y + vh - p.top) / vh));
          escribir(p, '--s', limitar((y + vh - p.top - p.alto) / vh));
          marcarPaso(p, avance);
          break;
        }
        case 'progreso':
        case 'parallax':
          // --p: 0 cuando el borde superior toca el borde inferior de la ventana; 1 cuando el inferior sale por arriba.
          escribir(p, '--p', Math.min(limitar((y + vh - p.top) / (vh + p.alto)), p.hasta));
          if (p.salida) escribir(p, '--salida', limitar((y - p.top) / Math.max(p.alto, 1)));
          break;
        case 'luz':
          // --lectura: 0 cuando el texto asoma al 82 % de la ventana; 1 cuando su final sube al 42 %.
          escribir(p, '--lectura', limitar((y + vh * 0.82 - p.top) / (p.alto + vh * 0.4)));
          break;
      }
    }
    alCuadro?.(y, vh);
  }

  function pedirCuadro(): void {
    if (pendiente) return;
    pendiente = true;
    idCuadro = window.requestAnimationFrame(cuadro);
  }

  function medir(): void {
    altoVentana = window.innerHeight;
    for (const p of pistas) {
      p.top = topDocumento(p.el);
      p.alto = p.el.offsetHeight;
      if (p.tipo === 'escena') {
        const escenario = p.el.querySelector<HTMLElement>('[data-escenario]');
        p.escenario = escenario?.offsetHeight ?? altoVentana;
        const fija = !escenario || getComputedStyle(escenario).position === 'sticky';
        if (!fija && p.fija) {
          // Deja de fijarse (cambió el ancho): fuera variables, todos los pasos alcanzados = estado final.
          for (const nombre of p.escritos.keys()) for (const d of p.destinos) d.style.removeProperty(nombre);
          p.escritos.clear();
          marcarPaso(p, 1);
        }
        p.fija = fija;
      }
    }
    pedirCuadro();
  }

  // Volver a medir cuando cambie algo que mueva la página: tamaño de la ventana, imágenes y fuentes que terminan de
  // cargar, secciones que se abren (preguntas, simulador) o el propio tamaño de cada pista.
  let medicionPendiente = false;
  const pedirMedicion = (): void => {
    if (medicionPendiente) return;
    medicionPendiente = true;
    window.requestAnimationFrame(() => {
      medicionPendiente = false;
      medir();
    });
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(pedirMedicion);
    ro.observe(document.body);
    for (const p of pistas) ro.observe(p.el);
  }
  window.addEventListener('resize', pedirMedicion, { passive: true });
  window.addEventListener('load', pedirMedicion, { once: true });
  void document.fonts?.ready.then(pedirMedicion);
  window.addEventListener('scroll', pedirCuadro, { passive: true });

  medir();
  cuadro();
  return { medir, pedirCuadro, cuadroAhora: cuadro };
}
