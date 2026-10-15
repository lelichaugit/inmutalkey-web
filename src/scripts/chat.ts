// Chats simulados: cuando el teléfono entra en vista, los mensajes llegan uno a uno. Los de InmutalKey
// van precedidos de "escribiendo…"; los del médico se marcan como leídos poco después. Corre una sola vez.

const espera = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function reproducir(chat: HTMLElement): Promise<void> {
  const mensajes = [...chat.querySelectorAll<HTMLElement>('[data-mensaje]')];
  const escribiendo = chat.querySelector<HTMLElement>('[data-escribiendo]');
  const estado = chat.querySelector<HTMLElement>('[data-chat-estado]');
  const lista = chat.querySelector<HTMLElement>('[data-chat-mensajes]');

  for (const m of mensajes) {
    const deInmutalKey = m.classList.contains('de-inmutalkey');
    const largo = m.textContent?.length ?? 40;
    if (deInmutalKey && escribiendo) {
      escribiendo.hidden = false;
      if (estado) estado.textContent = 'escribiendo…';
      lista?.append(escribiendo);
      await espera(Math.min(700 + largo * 14, 2200));
      escribiendo.hidden = true;
      if (estado) estado.textContent = 'en línea';
    } else {
      await espera(Math.min(600 + largo * 8, 1500));
    }
    m.classList.add('es-visible');
    if (!deInmutalKey) window.setTimeout(() => m.classList.add('es-leido'), 900);
    await espera(350);
  }
}

export function iniciarChats(raiz: ParentNode): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        void reproducir(e.target as HTMLElement);
      }
    },
    { threshold: 0.45 },
  );
  raiz.querySelectorAll<HTMLElement>('[data-chat]').forEach((c) => io.observe(c));
}
