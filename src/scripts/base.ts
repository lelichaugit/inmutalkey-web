// Módulo base de todas las páginas. Todo es mejora progresiva: sin este script el sitio se lee completo y quieto.
//  · `.js` y `.movimiento` en <html> (ya las pone public/clases.js antes del primer pintado; aquí por si acaso)
//  · barra de cristal: sombra al hacer scroll, se retira al bajar y vuelve al subir; sección activa
//  · menú del celular (<details>): inerte lo de atrás, se cierra al elegir, al tocar fuera o con Escape
//  · selector de tema (tema.ts) y revelado suave al entrar en vista (`.revelar`, cascada con `data-escalonar`)
//  · carga diferida: formularios (solo donde hay) y eventos agregados (en reposo)

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

// Al saltar a una sección, el foco va a ella (lectores de pantalla y teclado siguen ahí).
document.addEventListener('click', (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>('a[href*="#"]') : null;
  if (!a || a.origin !== location.origin || a.pathname !== location.pathname || a.hash.length < 2) return;
  const destino = document.getElementById(decodeURIComponent(a.hash.slice(1)));
  if (!destino) return;
  const enfocar = () => {
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  };
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
enReposo(() => void import('./eventos').then((m) => m.iniciarEventos(document)));
if (document.querySelector('[data-formulario], [data-confirmacion], [data-pagina-descarga], [data-cupo], [data-testimonios-vivos], [data-versiones-vivas], [data-gracias]')) {
  void import('./formularios').then((m) => m.iniciarFormularios(document));
}
