// Escenas que dependen del scroll y no caben en CSS puro. Se carga diferido desde base.ts solo cuando la página
// tiene `[data-escena]` y el usuario no pidió movimiento reducido.
//
// Historia de integridad: cada paso de texto que cruza la franja de lectura activa su estado en el escenario
// pegajoso (clases acumulativas `alcanzo-N` + `data-paso`), y la llave baja a sellar la nota.

function iniciarHistoria(historia: HTMLElement): void {
  const escena = historia.querySelector<HTMLElement>('[data-escena-dinamica]');
  const pasos = [...historia.querySelectorAll<HTMLElement>('[data-paso-n]')];
  if (!escena || pasos.length === 0) return;

  let actual = 0;
  const aplicar = (n: number): void => {
    if (n === actual) return;
    actual = n;
    escena.dataset['paso'] = String(n);
    for (let i = 1; i <= pasos.length; i++) escena.classList.toggle(`alcanzo-${i}`, i <= n);
    pasos.forEach((p, i) => p.classList.toggle('es-activo', i + 1 === n));
  };

  // Franja de lectura: entre el 45 % y el 70 % del alto de la ventana.
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        aplicar(Number((e.target as HTMLElement).dataset['pasoN'] ?? 0));
      }
    },
    { rootMargin: '-45% 0px -30% 0px' },
  );
  pasos.forEach((p) => io.observe(p));

  // Al volver a subir por encima del primer paso, el escenario regresa a la nota en blanco.
  const inicio = new IntersectionObserver(
    ([e]) => {
      if (e && e.isIntersecting === false && e.boundingClientRect.top > 0) aplicar(0);
    },
    { rootMargin: '0px 0px -30% 0px' },
  );
  const primero = pasos[0];
  if (primero) inicio.observe(primero);
}

export function iniciarEscenas(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-historia]').forEach(iniciarHistoria);
}
