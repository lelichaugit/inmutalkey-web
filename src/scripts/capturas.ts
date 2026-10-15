// Galería de capturas (sección #capturas): botones anterior/siguiente para ratón y puntos de posición. El carril ya se
// desliza solo (dedo, trackpad, teclado, scroll-snap); esto solo lo complementa. Solo desplaza el carril, nunca la
// página. Lo descarga signos.ts únicamente si la galería existe (sin capturas publicadas, no se descarga).

function iniciarGaleria(galeria: HTMLElement): void {
  const carril = galeria.querySelector<HTMLElement>('[data-carril]');
  const controles = galeria.querySelector<HTMLElement>('[data-carril-controles]');
  if (!carril || !controles || !('IntersectionObserver' in window)) return;
  const items = [...carril.querySelectorAll<HTMLElement>('[data-captura]')];
  const puntos = [...controles.querySelectorAll<HTMLElement>('[data-carril-punto]')];
  const botones = [...controles.querySelectorAll<HTMLButtonElement>('[data-carril-ir]')];
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0;

  const marcar = (i: number): void => {
    actual = i;
    puntos.forEach((p, j) => p.classList.toggle('es-actual', j === i));
    botones.forEach((b) => {
      const dir = Number(b.dataset['carrilIr']);
      b.disabled = (dir < 0 && i === 0) || (dir > 0 && i === items.length - 1);
    });
  };

  // La captura actual es la más visible dentro del carril.
  const visibles = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) visibles.set(e.target, e.intersectionRatio);
      let mejor = actual;
      let razon = -1;
      items.forEach((el, i) => {
        const r = visibles.get(el) ?? 0;
        if (r > razon + 0.01) {
          razon = r;
          mejor = i;
        }
      });
      marcar(mejor);
    },
    { root: carril, threshold: [0.25, 0.5, 0.75, 1] },
  );
  items.forEach((el) => io.observe(el));

  botones.forEach((b) =>
    b.addEventListener('click', () => {
      const destino = items[Math.min(Math.max(actual + Number(b.dataset['carrilIr']), 0), items.length - 1)];
      if (!destino) return;
      const left = destino.offsetLeft - (carril.clientWidth - destino.offsetWidth) / 2;
      carril.scrollTo({ left: Math.max(0, left), behavior: reducido ? 'auto' : 'smooth' });
    }),
  );

  controles.hidden = false;
  marcar(0);
}

export function iniciarCapturas(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-galeria]').forEach(iniciarGaleria);
}
