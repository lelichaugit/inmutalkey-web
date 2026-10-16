// Chats simulados (ChatSimulado.astro): cuando el teléfono asoma (20 % a la vista), la conversación se reproduce una
// vez, sin espera inicial.
//  · el primer mensaje del médico (.ya-enviado) ya está enviado desde el inicio: se ve con dos palomitas grises y pasa
//    a azules cuando InmutalKey responde; así el teléfono nunca se ve vacío
//  · los demás mensajes del médico: se teclean en la barra de abajo (el micrófono cambia a "enviar"), se envían con una
//    palomita, pasan a dos grises (entregado) y a azules (leído)
//  · mensajes de InmutalKey: "escribiendo…" en la cabecera y la burbuja de tres puntos antes de llegar
// Con movimiento reducido no se reproduce: todo queda visible y leído, igual que sin JS.

const espera = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Teclea `texto` en el campo: rápido y parejo, como quien escribe en el celular (máximo ~1.6 s). */
async function teclear(campo: HTMLElement, texto: string): Promise<void> {
  const total = Math.min(Math.max(texto.length * 32, 500), 1600);
  const pasos = Math.max(Math.round(total / 45), 1);
  for (let i = 1; i <= pasos; i++) {
    campo.textContent = texto.slice(0, Math.round((texto.length * i) / pasos));
    await espera(total / pasos);
  }
}

function marcarTodo(chat: HTMLElement): void {
  chat.querySelectorAll<HTMLElement>('[data-mensaje]').forEach((m) => m.classList.add('es-visible', 'es-entregado', 'es-leido'));
}

async function reproducir(chat: HTMLElement): Promise<void> {
  const mensajes = [...chat.querySelectorAll<HTMLElement>('[data-mensaje]')];
  const escribiendo = chat.querySelector<HTMLElement>('[data-escribiendo]');
  const estado = chat.querySelector<HTMLElement>('[data-chat-estado]');
  const lista = chat.querySelector<HTMLElement>('[data-chat-mensajes]');
  const campo = chat.querySelector<HTMLElement>('[data-chat-escrito]');
  let pendientesDeLeer: HTMLElement[] = [];

  for (const m of mensajes) {
    if (m.classList.contains('ya-enviado')) {
      m.classList.add('es-entregado');
      pendientesDeLeer.push(m);
      continue;
    }
    const deInmutalKey = m.classList.contains('de-inmutalkey');
    const texto = m.querySelector('.burbuja-texto')?.textContent?.trim() ?? '';

    if (deInmutalKey) {
      // Quien responde ya leyó lo anterior: palomitas azules.
      pendientesDeLeer.forEach((p) => p.classList.add('es-leido'));
      pendientesDeLeer = [];
      await espera(450);
      if (escribiendo) {
        escribiendo.hidden = false;
        lista?.append(escribiendo);
      }
      if (estado) estado.textContent = 'escribiendo…';
      await espera(Math.min(700 + texto.length * 13, 2100));
      if (escribiendo) escribiendo.hidden = true;
      if (estado) estado.textContent = 'en línea';
      m.classList.add('es-visible');
      await espera(700);
    } else {
      if (campo) {
        chat.classList.add('tecleando');
        await teclear(campo, texto);
        await espera(260);
        campo.textContent = '';
        chat.classList.remove('tecleando');
      } else {
        await espera(900);
      }
      m.classList.add('es-visible');
      pendientesDeLeer.push(m);
      window.setTimeout(() => m.classList.add('es-entregado'), 380);
      await espera(650);
    }
  }
  // Al final, lo último que envió el médico también se lee.
  await espera(600);
  pendientesDeLeer.forEach((p) => p.classList.add('es-leido'));
}

export function iniciarChats(raiz: ParentNode): void {
  const chats = [...raiz.querySelectorAll<HTMLElement>('[data-chat]')];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    chats.forEach(marcarTodo);
    return;
  }
  const io = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        void reproducir(e.target as HTMLElement);
      }
    },
    { threshold: 0.2 },
  );
  chats.forEach((c) => io.observe(c));
}
