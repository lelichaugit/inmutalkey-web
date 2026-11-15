// Brillo que sigue al cursor. Cada grupo `[data-brillo]` reparte la posición del puntero entre sus celdas `.brillo`
// como `--mx` / `--my` (px, relativas a cada celda), y el CSS mueve con `transform` un halo detrás del contenido
// (global.css, «Brillo»). Así también se iluminan las celdas vecinas, como una sola lámina de vidrio.
//
// Solo con puntero fino (ratón o trackpad) y sin «reducir movimiento»: base.ts no descarga este módulo en táctiles.
// Una lectura y una escritura por cuadro (requestAnimationFrame): primero se miden todas las celdas, luego se escribe.

export function iniciarBrillo(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-brillo]').forEach((grupo) => {
    const celdas = grupo.classList.contains('brillo') ? [grupo] : [...grupo.querySelectorAll<HTMLElement>('.brillo')];
    if (celdas.length === 0) return;
    let x = 0;
    let y = 0;
    let pendiente = false;

    const pintar = (): void => {
      pendiente = false;
      const cajas = celdas.map((c) => c.getBoundingClientRect());
      celdas.forEach((c, i) => {
        const caja = cajas[i];
        if (!caja) return;
        c.style.setProperty('--mx', `${Math.round(x - caja.left)}px`);
        c.style.setProperty('--my', `${Math.round(y - caja.top)}px`);
      });
    };

    grupo.addEventListener(
      'pointermove',
      (ev) => {
        if (ev.pointerType === 'touch') return;
        x = ev.clientX;
        y = ev.clientY;
        grupo.classList.add('con-brillo');
        if (pendiente) return;
        pendiente = true;
        window.requestAnimationFrame(pintar);
      },
      { passive: true },
    );
    grupo.addEventListener('pointerleave', () => grupo.classList.remove('con-brillo'));
  });
}
