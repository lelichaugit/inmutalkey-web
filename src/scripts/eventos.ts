// Uso del sitio, solo en agregados: "hoy hubo N vistas desde la tarjeta". Sin cookies, sin identificador de
// visitante, sin IP guardada (ver src/worker/rutas/publicas.ts). Si el navegador pide no ser rastreado
// (Global Privacy Control o Do Not Track), no se envía nada.
//
// El origen de campaña (utm_*) se toma de la URL de llegada, se guarda solo en esta pestaña (sessionStorage) para
// atribuir el registro si llega, y se quita de la barra de direcciones para que el enlace compartido salga limpio.

import { normalizarFuente, normalizarUtmLibre, PREFIJO_FAQ, type Evento } from '../compartido/eventos';
import { sitio } from '../site.config';

const CLAVE = 'ik-origen';

export interface Origen {
  readonly utm_source: string;
  readonly utm_medium: string | null;
  readonly utm_campaign: string | null;
}

function noRastrear(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

/** Lee utm_* de la URL (una vez por llegada) y los quita de la barra. */
function capturarOrigen(): void {
  const url = new URL(window.location.href);
  const fuente = url.searchParams.get('utm_source');
  if (fuente === null) return;
  const origen: Origen = {
    utm_source: normalizarFuente(fuente),
    utm_medium: normalizarUtmLibre(url.searchParams.get('utm_medium')),
    utm_campaign: normalizarUtmLibre(url.searchParams.get('utm_campaign')),
  };
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(origen));
  } catch {
    // Navegación privada estricta: se atribuye como "directo".
  }
  for (const p of [...url.searchParams.keys()]) if (p.startsWith('utm_')) url.searchParams.delete(p);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function origenActual(): Origen {
  try {
    const guardado = sessionStorage.getItem(CLAVE);
    if (guardado) {
      const o = JSON.parse(guardado) as Partial<Origen>;
      return {
        utm_source: normalizarFuente(o.utm_source),
        utm_medium: normalizarUtmLibre(o.utm_medium),
        utm_campaign: normalizarUtmLibre(o.utm_campaign),
      };
    }
  } catch {
    // Sin almacenamiento: directo.
  }
  return { utm_source: 'directo', utm_medium: null, utm_campaign: null };
}

export function enviarEvento(evento: Evento): void {
  if (noRastrear()) return;
  const cuerpo = JSON.stringify({ evento, utm_source: origenActual().utm_source });
  try {
    const enviado = navigator.sendBeacon?.('/api/eventos', new Blob([cuerpo], { type: 'application/json' }));
    if (!enviado) void fetch('/api/eventos', { method: 'POST', body: cuerpo, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  } catch {
    // Nunca romper la página por una métrica.
  }
}

/** Intención del clic a WhatsApp según el mensaje prellenado del enlace. */
function eventoWhatsApp(href: string): Evento {
  let texto = '';
  try {
    texto = new URL(href).searchParams.get('text') ?? '';
  } catch {
    return 'whatsapp_general';
  }
  if (texto === sitio.contacto.mensajes.prueba) return 'whatsapp_prueba';
  if (texto === sitio.contacto.mensajes.fundadores) return 'whatsapp_fundadores';
  return 'whatsapp_general';
}

export function iniciarEventos(raiz: Document): void {
  capturarOrigen();
  enviarEvento('pagina_vista');

  // Preguntas frecuentes: `toggle` no burbujea, se escucha en fase de captura. Solo al abrir.
  raiz.addEventListener(
    'toggle',
    (e) => {
      const detalles = e.target;
      if (!(detalles instanceof HTMLDetailsElement) || !detalles.open || !detalles.id.startsWith('faq-')) return;
      enviarEvento(`${PREFIJO_FAQ}${detalles.id.slice(4)}`);
    },
    true,
  );

  raiz.addEventListener('click', (e) => {
    const enlace = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="https://wa.me/"]') : null;
    if (enlace) enviarEvento(eventoWhatsApp(enlace.href));
  });

  // Simulador: arranca solo al entrar en vista; se cuenta una vez por página.
  const demo = raiz.querySelector('[data-demo]');
  if (demo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((x) => x.isIntersecting)) return;
        io.disconnect();
        enviarEvento('demo_iniciada');
      },
      { threshold: 0.4 },
    );
    io.observe(demo);
  }
}
