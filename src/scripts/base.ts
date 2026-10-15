// Módulo base de todas las páginas. Todo es mejora progresiva: sin este script el sitio se lee completo.
//  · `.js` en <html> (activa .revelar y la barra de progreso)
//  · barra de progreso de lectura
//  · `--p` y `--salida` (0→1) en elementos `[data-progreso-scroll]`: animaciones ligadas al scroll en CSS
//  · revelado al entrar en vista
//  · barra de navegación: fondo al hacer scroll e isotipo que se "acomoda" cuando el logo 3D sale de vista
//  · carga diferida de los módulos de cada sección (escenas, simulador, signos, chats)

const raiz = document.documentElement;
raiz.classList.add('js');

const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');

// ───────────── Scroll: barra de progreso y progreso por elemento ─────────────

const barra = document.querySelector<HTMLElement>('[data-barra-progreso]');
const nav = document.querySelector<HTMLElement>('[data-nav]');
const arriba = document.querySelector<HTMLElement>('[data-arriba]');
let ultimoY = window.scrollY;
const conProgreso = new Set<HTMLElement>();
let pendiente = false;

function limitar(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pintar(): void {
  pendiente = false;
  const y = window.scrollY;
  const alto = window.innerHeight;

  if (barra) {
    const total = raiz.scrollHeight - alto;
    barra.style.setProperty('--progreso', total > 0 ? limitar(y / total).toFixed(4) : '0');
  }
  nav?.setAttribute('data-scroll', y > 8 ? 'si' : 'no');

  // La barra se esconde al bajar (pasado el primer pantallazo) y vuelve en cuanto se sube.
  const delta = y - ultimoY;
  if (nav && Math.abs(delta) > 6) {
    const ocupada = nav.matches(':focus-within') || Boolean(nav.querySelector('details[open]'));
    nav.dataset['oculta'] = delta > 0 && y > alto * 0.9 && !ocupada ? 'si' : 'no';
    ultimoY = y;
  }
  if (arriba) arriba.dataset['visible'] = y > alto * 1.5 ? 'si' : 'no';

  // --p: 0 cuando el borde superior del elemento toca el borde inferior de la ventana; 1 cuando su borde inferior sale por arriba.
  // --salida: 0 con el elemento alineado arriba de la ventana; 1 cuando ya salió por completo hacia arriba.
  for (const el of conProgreso) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--p', limitar((alto - r.top) / (alto + r.height)).toFixed(4));
    el.style.setProperty('--salida', limitar(-r.top / Math.max(r.height, 1)).toFixed(4));
  }
}

function alHacerScroll(): void {
  if (pendiente) return;
  pendiente = true;
  window.requestAnimationFrame(pintar);
}

const elementosProgreso = document.querySelectorAll<HTMLElement>('[data-progreso-scroll]');
if (elementosProgreso.length > 0 && 'IntersectionObserver' in window) {
  // Solo se calculan los que están cerca de la vista.
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) conProgreso.add(el);
        else conProgreso.delete(el);
      }
      alHacerScroll();
    },
    { rootMargin: '25% 0px' },
  );
  elementosProgreso.forEach((el) => io.observe(el));
}

window.addEventListener('scroll', alHacerScroll, { passive: true });
window.addEventListener('resize', alHacerScroll, { passive: true });
pintar();

// ───────────── Revelado ─────────────

const porRevelar = document.querySelectorAll<HTMLElement>('.revelar');
if (movimientoReducido.matches || !('IntersectionObserver' in window)) {
  porRevelar.forEach((el) => el.classList.add('es-visible'));
} else {
  const io = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('es-visible');
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  );
  porRevelar.forEach((el) => io.observe(el));
}

// ───────────── Navegación ─────────────

const isotipoPrincipal = document.querySelector<HTMLElement>('[data-isotipo-principal]');
if (nav && nav.dataset['logo'] === 'diferido') {
  if (isotipoPrincipal && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => {
        if (e) nav.dataset['logo'] = e.isIntersecting ? 'diferido' : 'visible';
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0.15 },
    ).observe(isotipoPrincipal);
  } else {
    nav.dataset['logo'] = 'visible';
  }
}

// Sección activa: el enlace se marca y el indicador se desliza bajo él.
const enlacesSeccion = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav] a[data-seccion]')];
const indicador = document.querySelector<HTMLElement>('[data-nav-indicador]');
const secciones = [...new Set(enlacesSeccion.map((a) => a.dataset['seccion']))]
  .map((id) => (id ? document.getElementById(id) : null))
  .filter((el): el is HTMLElement => el !== null);

function marcarSeccion(id: string | null): void {
  for (const a of enlacesSeccion) {
    if (a.dataset['seccion'] === id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
  if (!indicador) return;
  const activo = enlacesSeccion.find((a) => a.dataset['seccion'] === id && a.closest('.nav-enlaces'));
  const lista = activo?.closest('ul');
  if (!activo || !lista) {
    indicador.style.setProperty('--o', '0');
    return;
  }
  const base = lista.getBoundingClientRect();
  const r = activo.getBoundingClientRect();
  indicador.style.setProperty('--x', `${r.left - base.left + 12}px`);
  indicador.style.setProperty('--w', `${r.width - 24}px`);
  indicador.style.setProperty('--o', '1');
}

if (secciones.length > 0 && 'IntersectionObserver' in window) {
  const visibles = new Set<string>();
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) visibles.add(e.target.id);
        else visibles.delete(e.target.id);
      }
      const activa = secciones.find((s) => visibles.has(s.id));
      marcarSeccion(activa ? activa.id : null);
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  secciones.forEach((s) => io.observe(s));
  window.addEventListener('resize', () => marcarSeccion(enlacesSeccion.find((a) => a.hasAttribute('aria-current'))?.dataset['seccion'] ?? null), {
    passive: true,
  });
}

// El menú móvil (<details>) ocupa la pantalla: bloquea el scroll de fondo y se cierra al elegir una sección,
// al tocar fuera o con Escape.
const menu = document.querySelector<HTMLDetailsElement>('[data-nav-menu]');
if (menu) {
  menu.addEventListener('toggle', () => raiz.classList.toggle('menu-abierto', menu.open));
  menu.addEventListener('click', (ev) => {
    if (ev.target instanceof Element && ev.target.closest('a')) menu.open = false;
  });
  document.addEventListener('click', (ev) => {
    if (menu.open && ev.target instanceof Node && !menu.contains(ev.target)) menu.open = false;
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
}

// ───────────── Módulos diferidos ─────────────
// Cada sección interactiva trae su propio módulo, que se descarga solo cuando la sección se acerca a la vista.

function cargarCerca(selector: string, cargar: () => Promise<void>, margen = '600px 0px'): void {
  const primero = document.querySelector(selector);
  if (!primero) return;
  if (!('IntersectionObserver' in window)) {
    void cargar();
    return;
  }
  const io = new IntersectionObserver(
    (entradas, obs) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      void cargar();
    },
    { rootMargin: margen },
  );
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}

if (!movimientoReducido.matches) {
  cargarCerca('[data-escena]', () => import('./escenas').then((m) => m.iniciarEscenas(document)), '400px 0px');
}
cargarCerca('[data-demo]', () => import('./demo').then((m) => m.iniciarDemo(document)));
cargarCerca('[data-signos]', () => import('./signos').then((m) => m.iniciarSignos(document)));
cargarCerca('[data-chat]', () => import('./chat').then((m) => m.iniciarChats(document)));
