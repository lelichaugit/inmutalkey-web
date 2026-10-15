// Módulo base de todas las páginas. Todo es mejora progresiva: sin este script el sitio se lee completo.
//  · `.js` en <html> (activa .revelar y la barra de progreso)
//  · barra de progreso de lectura
//  · `--p` (0→1) en elementos `[data-progreso-scroll]` mientras cruzan la ventana: animaciones de scroll en CSS
//  · revelado al entrar en vista
//  · barra de navegación: fondo al hacer scroll e isotipo que se "acomoda" cuando el logo 3D sale de vista
//  · carga diferida de escenas.ts (GSAP) solo si la página tiene escenas y el usuario acepta movimiento

const raiz = document.documentElement;
raiz.classList.add('js');

const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');

// ───────────── Scroll: barra de progreso y progreso por elemento ─────────────

const barra = document.querySelector<HTMLElement>('[data-barra-progreso]');
const nav = document.querySelector<HTMLElement>('[data-nav]');
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

  // 0 cuando el borde superior del elemento toca el borde inferior de la ventana; 1 cuando su borde inferior sale por arriba.
  for (const el of conProgreso) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--p', limitar((alto - r.top) / (alto + r.height)).toFixed(4));
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

// El menú móvil (<details>) se cierra al elegir una sección o al tocar fuera.
const menu = document.querySelector<HTMLDetailsElement>('[data-nav-menu]');
if (menu) {
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

// ───────────── Escenas (GSAP diferido) ─────────────

const primeraEscena = document.querySelector('[data-escena]');
if (primeraEscena && !movimientoReducido.matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entradas, obs) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      void import('./escenas').then((m) => m.iniciarEscenas(document));
    },
    { rootMargin: '400px 0px' },
  );
  io.observe(primeraEscena);
}
