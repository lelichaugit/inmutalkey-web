// Módulo base de todas las páginas. Todo es mejora progresiva: sin este script el sitio se lee completo.
//  · `.js` en <html> (activa los revelados) y `.movimiento` si el sistema no pide reducir el movimiento (activa las
//    escenas fijadas, el parallax y el texto que se ilumina)
//  · desplazamiento suave con Lenis en escritorio (rueda y trackpad); en pantallas táctiles, el scroll nativo
//  · motor de scroll (scroll.ts): escenas `[data-escena]`, `[data-progreso-scroll]`, `[data-parallax]`,
//    `[data-texto-luz]` y la barra de progreso de lectura, en una sola pasada por cuadro
//  · revelado al entrar en vista: `.revelar`, `[data-animar]` (titulares palabra por palabra), `[data-escalonar]`
//    y contadores `[data-contar]` — API en docs/ANIMACIONES.md
//  · navegación: fondo al hacer scroll, isotipo que se "acomoda", sección activa (barra, riel y título en móvil),
//    foco accesible al saltar a una sección y botón de compartir
//  · carga diferida de los módulos de cada sección (escenas, simulador, signos, chats)

import type Lenis from 'lenis';
import { iniciarScroll } from './scroll';

const raiz = document.documentElement;
raiz.classList.add('js');

const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!movimientoReducido.matches) raiz.classList.add('movimiento');

// ───────────── Scroll ─────────────

const barra = document.querySelector<HTMLElement>('[data-barra-progreso]');
const nav = document.querySelector<HTMLElement>('[data-nav]');
const arriba = document.querySelector<HTMLElement>('[data-arriba]');
let ultimoY = window.scrollY;
let progresoEscrito = '';
// El botón flotante se retira donde ya hay datos de contacto a la vista (pie y cierre): no tapa texto ni se repite.
let cercaDeContacto = false;

const motor = iniciarScroll({
  movimiento: !movimientoReducido.matches,
  alCuadro(y, alto) {
    if (barra) {
      const total = raiz.scrollHeight - alto;
      const progreso = total > 0 ? Math.min(Math.max(y / total, 0), 1).toFixed(4) : '0';
      if (progreso !== progresoEscrito) {
        progresoEscrito = progreso;
        barra.style.setProperty('--progreso', progreso);
      }
    }
    const conScroll = y > 8 ? 'si' : 'no';
    if (nav && nav.dataset['scroll'] !== conScroll) nav.dataset['scroll'] = conScroll;

    // La barra se esconde al bajar (pasado el primer pantallazo) y vuelve en cuanto se sube.
    const delta = y - ultimoY;
    if (nav && Math.abs(delta) > 6) {
      const ocupada = nav.matches(':focus-within') || Boolean(nav.querySelector('details[open]'));
      const oculta = delta > 0 && y > alto * 0.9 && !ocupada ? 'si' : 'no';
      if (nav.dataset['oculta'] !== oculta) nav.dataset['oculta'] = oculta;
      ultimoY = y;
    }
    const visible = y > alto * 1.5 && !cercaDeContacto ? 'si' : 'no';
    if (arriba && arriba.dataset['visible'] !== visible) arriba.dataset['visible'] = visible;
  },
});

const zonasContacto = document.querySelectorAll('footer, [data-sin-flotante]');
if (arriba && zonasContacto.length > 0 && 'IntersectionObserver' in window) {
  const visibles = new Set<Element>();
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) visibles.add(e.target);
      else visibles.delete(e.target);
    }
    cercaDeContacto = visibles.size > 0;
    motor.pedirCuadro();
  });
  zonasContacto.forEach((z) => io.observe(z));
}

// Desplazamiento suave (Lenis) solo con ratón o trackpad: en iPhone, iPad y Android el scroll nativo ya es suave.
let suave: Lenis | null = null;
if (!movimientoReducido.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  void import('./suave').then((m) => {
    suave = m.iniciarSuave();
    if (raiz.classList.contains('menu-abierto')) suave.stop();
  });
}

// ───────────── Revelado ─────────────

/** Envuelve cada palabra de un titular en `.palabra > span` (con --w) para que suban en cascada. */
function partirTitular(el: HTMLElement): void {
  if (el.dataset['partido'] === 'si') return;
  el.dataset['partido'] = 'si';
  let n = 0;
  const caminante = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textos: Text[] = [];
  while (caminante.nextNode()) textos.push(caminante.currentNode as Text);
  for (const t of textos) {
    const partes = (t.textContent ?? '').split(/(\s+)/);
    const fragmento = document.createDocumentFragment();
    for (const parte of partes) {
      if (parte === '') continue;
      if (/^\s+$/.test(parte)) {
        fragmento.append(document.createTextNode(parte));
        continue;
      }
      const envoltura = document.createElement('span');
      envoltura.className = 'palabra';
      const interior = document.createElement('span');
      interior.textContent = parte;
      interior.style.setProperty('--w', String(n++));
      envoltura.append(interior);
      fragmento.append(envoltura);
    }
    t.replaceWith(fragmento);
  }
}

/** Cuenta de 0 al número final que ya trae el HTML (respeta decimales y separadores es-MX). */
function contar(el: HTMLElement): void {
  const final = Number(el.dataset['contar']);
  if (!Number.isFinite(final)) return;
  const decimales = (el.dataset['contar']?.split('.')[1] ?? '').length;
  const formato = new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const duracion = 1400;
  const inicio = performance.now();
  const paso = (ahora: number): void => {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const suave = 1 - Math.pow(1 - t, 3);
    el.textContent = formato.format(final * suave);
    if (t < 1) window.requestAnimationFrame(paso);
  };
  window.requestAnimationFrame(paso);
}

// Cascadas: los hijos animados de cada [data-escalonar] reciben su turno (--i).
document.querySelectorAll<HTMLElement>('[data-escalonar]').forEach((contenedor) => {
  let i = 0;
  for (const hijo of contenedor.querySelectorAll<HTMLElement>(':scope > [data-animar], :scope > .revelar, :scope > * > [data-animar]')) {
    if (hijo.closest('[data-escalonar]') !== contenedor) continue;
    hijo.style.setProperty('--i', String(i++));
  }
});

const porRevelar = document.querySelectorAll<HTMLElement>('.revelar, [data-animar]');
const contadores = document.querySelectorAll<HTMLElement>('[data-contar]');
if (movimientoReducido.matches || !('IntersectionObserver' in window)) {
  porRevelar.forEach((el) => el.classList.add('es-visible'));
} else {
  document.querySelectorAll<HTMLElement>('[data-animar="titulo"]').forEach(partirTitular);
  // `cortina` oculta el elemento con clip-path y IntersectionObserver descuenta ese recorte (nunca lo vería entrar):
  // se observa a su contenedor y se revela el elemento.
  const porObjetivo = new Map<Element, HTMLElement[]>();
  porRevelar.forEach((el) => {
    const objetivo = el.dataset['animar'] === 'cortina' ? (el.parentElement ?? el) : el;
    porObjetivo.set(objetivo, [...(porObjetivo.get(objetivo) ?? []), el]);
  });
  const io = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        for (const el of porObjetivo.get(e.target) ?? []) el.classList.add('es-visible');
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );
  porObjetivo.forEach((_, objetivo) => io.observe(objetivo));

  const ioContar = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        contar(e.target as HTMLElement);
      }
    },
    { threshold: 0.6 },
  );
  contadores.forEach((el) => ioContar.observe(el));
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

// Sección activa: se marca en la barra (con un indicador que se desliza), en el riel lateral y, en móvil,
// su nombre sustituye al de la marca en la barra.
const enlacesSeccion = [...document.querySelectorAll<HTMLAnchorElement>('a[data-seccion]')];
const indicador = document.querySelector<HTMLElement>('[data-nav-indicador]');
const capitulo = document.querySelector<HTMLElement>('[data-nav-capitulo]');
const secciones = [...new Set(enlacesSeccion.map((a) => a.dataset['seccion']))]
  .map((id) => (id ? document.getElementById(id) : null))
  .filter((el): el is HTMLElement => el !== null)
  .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

function marcarSeccion(id: string | null): void {
  for (const a of enlacesSeccion) {
    if (a.dataset['seccion'] === id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
  if (capitulo && nav) {
    const etiqueta = enlacesSeccion.find((a) => a.dataset['seccion'] === id && a.dataset['etiqueta'])?.dataset['etiqueta'];
    if (etiqueta && capitulo.textContent !== etiqueta) {
      capitulo.textContent = etiqueta;
      capitulo.classList.remove('es-nuevo');
      void capitulo.offsetWidth;
      capitulo.classList.add('es-nuevo');
    }
    nav.dataset['capitulo'] = etiqueta ? 'si' : 'no';
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
  menu.addEventListener('toggle', () => {
    raiz.classList.toggle('menu-abierto', menu.open);
    if (menu.open) suave?.stop();
    else suave?.start();
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

// Al saltar a una sección (enlace interno), el foco va a ella para que lectores de pantalla y teclado sigan ahí.
// Con Lenis el salto es suyo (misma curva que la rueda); sin Lenis, lo hace el navegador (`scroll-behavior: smooth`).
function enfocarDestino(destino: HTMLElement): void {
  if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
  destino.focus({ preventScroll: true });
}

document.addEventListener('click', (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target instanceof Element ? ev.target.closest<HTMLAnchorElement>('a[href*="#"]') : null;
  if (!a || a.origin !== location.origin || a.pathname !== location.pathname || a.hash.length < 2) return;
  const destino = document.getElementById(decodeURIComponent(a.hash.slice(1)));
  if (!destino) return;
  if (suave) {
    ev.preventDefault();
    // El menú del celular se cierra en este mismo clic: se libera el scroll antes de saltar.
    raiz.classList.remove('menu-abierto');
    suave.start();
    if (location.hash !== a.hash) history.pushState(null, '', a.hash);
    // Destino calculado con la posición real de la ventana (no con el estado interno de Lenis, que puede ir un cuadro
    // atrás si la página se movió justo antes del clic), menos el `scroll-padding-top` de la barra.
    const margen = Number.parseFloat(getComputedStyle(raiz).scrollPaddingTop) || 0;
    const y = destino.getBoundingClientRect().top + window.scrollY - margen;
    suave.scrollTo(y, { force: true, onComplete: () => enfocarDestino(destino) });
    return;
  }
  if ('onscrollend' in window) window.addEventListener('scrollend', () => enfocarDestino(destino), { once: true });
  else setTimeout(() => enfocarDestino(destino), 700);
});

// Compartir con un colega: hoja nativa del teléfono si existe; si no, el enlace de WhatsApp que trae el HTML.
document.querySelectorAll<HTMLAnchorElement>('a[data-compartir]').forEach((a) => {
  a.addEventListener('click', (ev) => {
    if (typeof navigator.share !== 'function') return;
    ev.preventDefault();
    navigator
      .share({ title: a.dataset['titulo'] ?? document.title, text: a.dataset['texto'] ?? '', url: a.dataset['url'] ?? location.origin })
      .catch(() => {
        /* el usuario canceló */
      });
  });
});

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

// Al iniciar, un módulo puede cambiar alturas: se vuelve a medir para que las escenas de abajo no se desfasen.
if (!movimientoReducido.matches) {
  cargarCerca('[data-historia]', () => import('./escenas').then((m) => m.iniciarEscenas(document)).then(motor.medir), '400px 0px');
}
cargarCerca('[data-demo]', () => import('./demo').then((m) => m.iniciarDemo(document)).then(motor.medir));
cargarCerca('[data-signos]', () => import('./signos').then((m) => m.iniciarSignos(document)).then(motor.medir));
cargarCerca('[data-chat]', () => import('./chat').then((m) => m.iniciarChats(document)).then(motor.medir));
