// Motor de escenas de la portada. Una escena cuenta algo por PASOS: el HTML ya trae el estado final (lo que se ve sin
// JS o con «reducir movimiento») y aquí solo se decide en qué paso va, para que el CSS lo anime con transiciones.
//
//   <div data-escena data-escena-marcas="0.2 0.5 0.8" [data-escena-auto="1400"]>
//     <div data-escenario>…</div>
//   </div>
//
//  · Fijada: si el CSS deja `[data-escenario]` en `position: sticky`, el paso sale del scroll (avance 0 → 1 mientras
//    el escenario está pegado). Las marcas son los avances donde empieza cada paso.
//  · Sin fijar (celular, donde el componente no la fija): con `data-escena-auto` los pasos se reproducen solos, una
//    vez, cuando la escena entra en vista (cada N ms); sin él, queda en su estado final.
//  · La raíz recibe `.escena-lista` (hay motor), `data-paso="n"`, `.alcanzo-1…n` y el evento `escena:paso`.
//  · `--p` (avance continuo) se escribe SOLO en los descendientes `[data-p]`: una variable heredada obliga a recalcular
//    el estilo de todo el subárbol en cada cuadro, y eso en un celular de gama media se nota.
//  · `[data-huella][data-huella-paso="n"]`: la huella se «decodifica» carácter por carácter al llegar a su paso.
//  · `[data-escena-repetir]`: botón que vuelve a reproducir una escena automática.
//
// Rendimiento: la geometría se mide al iniciar y cuando algo cambia de tamaño; en cada cuadro solo se lee
// `window.scrollY` y se escribe lo que cambió. Se carga diferido desde base.ts y nunca con movimiento reducido.

interface Escena {
  readonly raiz: HTMLElement;
  readonly escenario: HTMLElement | null;
  readonly marcas: readonly number[];
  readonly destinos: readonly HTMLElement[];
  readonly autoMs: number;
  top: number;
  recorrido: number;
  fija: boolean;
  paso: number;
  avance: string;
  reloj: number;
  reproducida: boolean;
}

export interface MotorEscenas {
  /** Actualiza ya, en este cuadro (Lenis mueve la página dentro de su propio requestAnimationFrame). */
  cuadro(): void;
}

const acotar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function fijarPaso(e: Escena, n: number): void {
  if (n === e.paso) return;
  const anterior = e.paso;
  e.paso = n;
  e.raiz.dataset['paso'] = String(n);
  for (let i = 1; i <= e.marcas.length; i++) e.raiz.classList.toggle(`alcanzo-${i}`, i <= n);
  e.raiz.dispatchEvent(new CustomEvent('escena:paso', { detail: { paso: n, anterior } }));
}

function reproducir(e: Escena): void {
  window.clearInterval(e.reloj);
  e.reproducida = true;
  fijarPaso(e, 0);
  e.reloj = window.setInterval(() => {
    if (e.fija || e.paso >= e.marcas.length) {
      window.clearInterval(e.reloj);
      return;
    }
    fijarPaso(e, e.paso + 1);
  }, e.autoMs);
}

// ───────────── Huella que se decodifica ─────────────

const HEX = '0123456789abcdef';

function decodificar(el: HTMLElement): void {
  const final = el.dataset['huella'] ?? el.textContent ?? '';
  const letras = [...final];
  const cambian = letras.flatMap((c, i) => (HEX.includes(c) ? [i] : []));
  const inicio = performance.now();
  let ultimo = 0;
  const cuadro = (ahora: number): void => {
    const t = (ahora - inicio) / 900;
    if (t >= 1) {
      el.textContent = final;
      return;
    }
    // ~30 cambios por segundo bastan; el primer tercio es puro ruido y luego se fija de izquierda a derecha.
    if (ahora - ultimo > 32) {
      ultimo = ahora;
      const fijos = Math.floor(Math.max(0, (t - 0.3) / 0.7) * cambian.length);
      const salida = letras.slice();
      cambian.forEach((pos, n) => {
        if (n >= fijos) salida[pos] = HEX.charAt(Math.floor(Math.random() * 16));
      });
      el.textContent = salida.join('');
    }
    window.requestAnimationFrame(cuadro);
  };
  window.requestAnimationFrame(cuadro);
}

// ───────────── Motor ─────────────

export function iniciarEscenas(documento: ParentNode): MotorEscenas {
  const escenas: Escena[] = [...documento.querySelectorAll<HTMLElement>('[data-escena]')].map((raiz) => ({
    raiz,
    escenario: raiz.querySelector<HTMLElement>('[data-escenario]'),
    marcas: (raiz.dataset['escenaMarcas'] ?? '')
      .split(/[\s,]+/)
      .map(Number)
      .filter((m) => Number.isFinite(m) && m > 0 && m <= 1)
      .sort((a, b) => a - b),
    destinos: [...raiz.querySelectorAll<HTMLElement>('[data-p]')],
    autoMs: Number(raiz.dataset['escenaAuto'] ?? 0) || 0,
    top: 0,
    recorrido: 1,
    fija: false,
    paso: -1,
    avance: '',
    reloj: 0,
    reproducida: false,
  }));

  let pendiente = false;
  let idCuadro = 0;

  function cuadro(): void {
    if (pendiente) window.cancelAnimationFrame(idCuadro);
    pendiente = false;
    const y = window.scrollY;
    for (const e of escenas) {
      if (!e.fija) continue;
      const p = acotar((y - e.top) / e.recorrido);
      const texto = p.toFixed(3);
      if (texto !== e.avance) {
        e.avance = texto;
        for (const d of e.destinos) d.style.setProperty('--p', texto);
      }
      let n = 0;
      while (n < e.marcas.length && p >= (e.marcas[n] ?? 2)) n++;
      fijarPaso(e, n);
    }
  }

  const pedirCuadro = (): void => {
    if (pendiente) return;
    pendiente = true;
    idCuadro = window.requestAnimationFrame(cuadro);
  };

  function medir(): void {
    const y = window.scrollY;
    for (const e of escenas) {
      const fija = e.escenario !== null && getComputedStyle(e.escenario).position === 'sticky';
      e.top = e.raiz.getBoundingClientRect().top + y;
      e.recorrido = Math.max(e.raiz.offsetHeight - (e.escenario?.offsetHeight ?? window.innerHeight), 1);
      const primera = e.paso === -1;
      if (fija !== e.fija || primera) {
        e.fija = fija;
        window.clearInterval(e.reloj);
        if (!fija) {
          // Sin fijar: fuera variables. Al iniciar, una escena automática espera en el paso 0 a entrar en vista; si
          // dejó de fijarse por un cambio de ancho (ya pudo estar a la vista), se queda en su estado final.
          e.avance = '';
          for (const d of e.destinos) d.style.removeProperty('--p');
          const espera = primera && e.autoMs > 0;
          if (!espera) e.reproducida = true;
          fijarPaso(e, espera ? 0 : e.marcas.length);
        }
      }
    }
    cuadro();
  }

  for (const e of escenas) {
    e.raiz.classList.add('escena-lista');
    const huellas = [...e.raiz.querySelectorAll<HTMLElement>('[data-huella-paso]')];
    if (huellas.length > 0) {
      e.raiz.addEventListener('escena:paso', (ev) => {
        const { paso, anterior } = (ev as CustomEvent<{ paso: number; anterior: number }>).detail;
        for (const h of huellas) {
          const suyo = Number(h.dataset['huellaPaso'] ?? 0);
          if (paso >= suyo && anterior < suyo && anterior >= 0) decodificar(h);
        }
      });
    }
    e.raiz.querySelector<HTMLButtonElement>('[data-escena-repetir]')?.addEventListener('click', () => {
      if (!e.fija && e.autoMs > 0) reproducir(e);
    });
  }

  // Escenas automáticas: arrancan una sola vez, cuando se ven de verdad (no al asomar).
  const automaticas = escenas.filter((e) => e.autoMs > 0);
  if (automaticas.length > 0 && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const e = automaticas.find((x) => (x.escenario ?? x.raiz) === entrada.target);
          if (!e || !entrada.isIntersecting || e.fija || e.reproducida) continue;
          reproducir(e);
        }
      },
      { threshold: 0.45 },
    );
    automaticas.forEach((e) => io.observe(e.escenario ?? e.raiz));
  }

  let medicion = false;
  const pedirMedicion = (): void => {
    if (medicion) return;
    medicion = true;
    window.requestAnimationFrame(() => {
      medicion = false;
      medir();
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(pedirMedicion).observe(document.body);
  window.addEventListener('resize', pedirMedicion, { passive: true });
  window.addEventListener('load', pedirMedicion, { once: true });
  window.addEventListener('scroll', pedirCuadro, { passive: true });

  medir();
  return { cuadro };
}
