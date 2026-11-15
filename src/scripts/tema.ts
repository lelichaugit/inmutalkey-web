// Selector de tema (SelectorTema.astro): Sistema · Claro · Oscuro · Aurora.
// La elección se guarda en localStorage («ik-tema») y public/clases.js la aplica antes del primer pintado.
// Patrón de radiogroup accesible: un solo botón tabulable, flechas para moverse, Espacio/Enter para elegir.

export type Tema = 'sistema' | 'claro' | 'oscuro' | 'aurora';
const CLAVE = 'ik-tema';
const TEMAS: readonly Tema[] = ['sistema', 'claro', 'oscuro', 'aurora'];

export function esTema(valor: unknown): valor is Tema {
  return typeof valor === 'string' && (TEMAS as readonly string[]).includes(valor);
}

function leer(): Tema {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return esTema(v) ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

function aplicar(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema);
  try {
    if (tema === 'sistema') window.localStorage.removeItem(CLAVE);
    else window.localStorage.setItem(CLAVE, tema);
  } catch {
    /* Sin almacenamiento: el tema vale para esta visita. */
  }
}

function marcar(grupos: NodeListOf<HTMLElement>, tema: Tema): void {
  grupos.forEach((g) => {
    g.querySelectorAll<HTMLButtonElement>('button[data-tema]').forEach((b) => {
      const activo = b.dataset['tema'] === tema;
      b.setAttribute('aria-checked', String(activo));
      b.tabIndex = activo ? 0 : -1;
    });
  });
}

export function iniciarTema(raiz: Document): void {
  const grupos = raiz.querySelectorAll<HTMLElement>('[data-selector-tema]');
  if (grupos.length === 0) return;
  let actual = leer();
  marcar(grupos, actual);
  grupos.forEach((g) => {
    g.hidden = false;
    g.addEventListener('click', (ev) => {
      const b = ev.target instanceof Element ? ev.target.closest<HTMLButtonElement>('button[data-tema]') : null;
      const tema = b?.dataset['tema'];
      if (!esTema(tema)) return;
      actual = tema;
      aplicar(tema);
      marcar(grupos, tema);
    });
    g.addEventListener('keydown', (ev) => {
      const paso = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (paso === 0) return;
      ev.preventDefault();
      const siguiente = TEMAS[(TEMAS.indexOf(actual) + paso + TEMAS.length) % TEMAS.length] ?? 'sistema';
      actual = siguiente;
      aplicar(siguiente);
      marcar(grupos, siguiente);
      g.querySelector<HTMLButtonElement>(`button[data-tema="${siguiente}"]`)?.focus();
    });
  });
}
