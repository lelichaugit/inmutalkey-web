// Escenas con scrub de scroll (GSAP + ScrollTrigger). Se carga diferido desde base.ts solo cuando la página
// tiene `[data-escena]` y el usuario no pidió movimiento reducido. Se completa en la Fase B
// (historia de integridad, logo 3D del hero, nube, PortaVault).

export function iniciarEscenas(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-escena]').forEach((el) => {
    el.dataset['escenaLista'] = 'si';
  });
}
