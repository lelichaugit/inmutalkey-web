// Módulo base de todas las páginas. Todo es mejora progresiva: sin este script el sitio se lee completo y quieto.
//  · `.js` y `.movimiento` en <html> (ya las pone public/clases.js antes del primer pintado; aquí por si acaso)
//  · barra de cristal: sombra al hacer scroll, se retira al bajar y vuelve al subir; sección activa
//  · menú del celular (<details>): inerte lo de atrás, se cierra al elegir, al tocar fuera o con Escape
//  · selector de tema (tema.ts) y revelado suave al entrar en vista (`.revelar`, cascada con `data-escalonar`)
//  · desplazamiento suave con Lenis SOLO en escritorio (puntero fino) y sin «reducir movimiento» (suave.ts)
//  · carga diferida: escenas por pasos, brillo del cursor, simulador y monitor de signos (solo donde hay y cuando se
//    acercan a la vista), formularios y eventos agregados (en reposo)

import type { MotorEscenas } from './escenas';
import type { Suave } from './suave';
import { iniciarTema } from './tema';

const raiz = document.documentElement;
raiz.classList.add('js');
const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
raiz.classList.toggle('movimiento', !movimientoReducido.matches);

iniciarTema(document);

// ───────────── Barra ─────────────

const nav = document.querySelector<HTMLElement>('[data-nav]');
let ultimoY = window.scrollY;
let pendiente = false;

function alDesplazar(): void {
  pendiente = false;
  if (!nav) return;
  const y = window.scrollY;
  const conScroll = y > 8 ? 'si' : 'no';
  if (nav.dataset['scroll'] !== conScroll) nav.dataset['scroll'] = conScroll;
  const delta = y - ultimoY;
  if (Math.abs(delta) > 6) {
    const ocupada = nav.matches(':focus-within') || Boolean(nav.querySelector('details[open]'));
    const oculta = delta > 0 && y > window.innerHeight * 0.9 && !ocupada ? 'si' : 'no';
    if (nav.dataset['oculta'] !== oculta) nav.dataset['oculta'] = oculta;
    ultimoY = y;
  }
}

window.addEventListener(
  'scroll',
  () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(alDesplazar);
  },
  { passive: true },
);
alDesplazar();

// Sección activa en la barra (portada).
const enlacesSeccion = [...document.querySelectorAll<HTMLAnchorElement>('a[data-seccion]')];
const secciones = enlacesSeccion
  .map((a) => document.getElementById(a.dataset['seccion'] ?? ''))
  .filter((s): s is HTMLElement => s !== null);
if (secciones.length > 0 && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        for (const a of enlacesSeccion) {
          const propio = a.dataset['seccion'] === e.target.id;
          if (e.isIntersecting) {
            if (propio) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          } else if (propio) {
            a.removeAttribute('aria-current');
          }
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  secciones.forEach((s) => io.observe(s));
}

// ───────────── Menú del celular ─────────────

const menu = document.querySelector<HTMLDetailsElement>('[data-nav-menu]');
if (menu) {
  const detras = document.querySelectorAll<HTMLElement>('main, footer');
  menu.addEventListener('toggle', () => {
    detras.forEach((el) => {
      el.inert = menu.open;
    });
  });
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

// ───────────── Desplazamiento suave (solo escritorio) ─────────────

// Ratón o trackpad y sin «reducir movimiento». En iPhone, iPad y Android el módulo no se descarga: scroll nativo.
const punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)');
let suave: Suave | null = null;
let motor: MotorEscenas | null = null;

if (punteroFino.matches && !movimientoReducido.matches) {
  void import('./suave').then((m) => {
    const lenis = m.iniciarSuave();
    suave = lenis;
    // Las escenas se actualizan en el mismo cuadro en que Lenis mueve la página.
    lenis.on('scroll', () => motor?.cuadro());
    // Llegada desde otra página a /#seccion: el navegador saltó antes de que las fuentes y las escenas tomaran su
    // alto; se recoloca cuando todo cargó.
    const destino = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (destino) {
      const recolocar = (): void => lenis.scrollTo(destino, { immediate: true, force: true });
      if (document.readyState === 'complete') void document.fonts.ready.then(recolocar);
      else window.addEventListener('load', () => void document.fonts.ready.then(recolocar), { once: true });
    }
    // Si el médico activa «reducir movimiento» con la página abierta, vuelve el scroll nativo.
    movimientoReducido.addEventListener('change', (ev) => {
      if (!ev.matches || !suave) return;
      suave.destroy();
      suave = null;
    });
  });
}

// Al saltar a una sección, el foco va a ella (lectores de pantalla y teclado siguen ahí). Con Lenis el salto es suyo
// (misma curva que la rueda, respeta scroll-padding-top); sin Lenis lo hace el navegador (`scroll-behavior: smooth`).
document.addEventListener('click', (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>('a[href*="#"]') : null;
  if (!a || a.origin !== location.origin || a.pathname !== location.pathname || a.hash.length < 2) return;
  const destino = document.getElementById(decodeURIComponent(a.hash.slice(1)));
  if (!destino) return;
  const enfocar = (): void => {
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  };
  if (suave) {
    ev.preventDefault();
    history.pushState(history.state, '', a.hash);
    suave.scrollTo(destino, { onComplete: enfocar });
    return;
  }
  if ('onscrollend' in window) window.addEventListener('scrollend', enfocar, { once: true });
  else setTimeout(enfocar, 700);
});

// ───────────── Revelado al entrar en vista (solo opacity/transform) ─────────────

document.querySelectorAll<HTMLElement>('[data-escalonar]').forEach((contenedor) => {
  contenedor.querySelectorAll<HTMLElement>(':scope > .revelar').forEach((hijo, i) => hijo.style.setProperty('--i', String(i)));
});

const porRevelar = document.querySelectorAll<HTMLElement>('.revelar');
if (movimientoReducido.matches || !('IntersectionObserver' in window)) {
  porRevelar.forEach((el) => el.classList.add('es-visible'));
} else {
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('es-visible');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  porRevelar.forEach((el) => io.observe(el));
}

// ───────────── Carga diferida ─────────────

const enReposo = (tarea: () => void): void => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(tarea, { timeout: 3000 });
  else setTimeout(tarea, 1200);
};

/** Ejecuta `tarea` una vez, cuando alguno de los elementos se acerca a la vista (o ya, sin IntersectionObserver). */
function alAcercarse(selector: string, tarea: () => void): void {
  const elementos = document.querySelectorAll(selector);
  if (elementos.length === 0) return;
  if (!('IntersectionObserver' in window)) {
    tarea();
    return;
  }
  const io = new IntersectionObserver(
    (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      io.disconnect();
      tarea();
    },
    { rootMargin: '900px 0px' },
  );
  elementos.forEach((el) => io.observe(el));
}

// Escenas por pasos (Problema, Integridad, Un día, Bóveda): solo con movimiento. Sin el motor se ven completas.
if (!movimientoReducido.matches && document.querySelector('[data-escena]')) {
  enReposo(() => void import('./escenas').then((m) => (motor = m.iniciarEscenas(document))));
}
// Brillo que sigue al cursor: solo ratón o trackpad.
if (punteroFino.matches && !movimientoReducido.matches) {
  alAcercarse('[data-brillo]', () => void import('./brillo').then((m) => m.iniciarBrillo(document)));
}
alAcercarse('[data-simulador]', () => void import('./simulador').then((m) => m.iniciarSimulador(document)));
alAcercarse('[data-signos]', () => void import('./signos').then((m) => m.iniciarSignos(document)));

enReposo(() => void import('./eventos').then((m) => m.iniciarEventos(document)));
if (document.querySelector('[data-formulario], [data-confirmacion], [data-pagina-descarga], [data-cupo], [data-testimonios-vivos], [data-versiones-vivas], [data-gracias]')) {
  void import('./formularios').then((m) => m.iniciarFormularios(document));
}
