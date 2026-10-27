// Turnstile se descarga solo cuando alguien empieza a llenar un formulario (y nunca en el HTML: el guardian lo
// prohíbe). Es la única excepción de la CSP: challenges.cloudflare.com en script-src y frame-src.

interface OpcionesWidget {
  sitekey: string;
  action: string;
  theme: 'dark' | 'light' | 'auto';
  language: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface ApiTurnstile {
  render(contenedor: HTMLElement, opciones: OpcionesWidget): string;
  getResponse(id: string): string | undefined;
  reset(id: string): void;
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

let carga: Promise<ApiTurnstile> | null = null;

function cargarScript(): Promise<ApiTurnstile> {
  carga ??= new Promise<ApiTurnstile>((resolver, rechazar) => {
    if (window.turnstile) {
      resolver(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.addEventListener('load', () => (window.turnstile ? resolver(window.turnstile) : rechazar(new Error('turnstile'))));
    script.addEventListener('error', () => {
      carga = null;
      rechazar(new Error('turnstile'));
    });
    document.head.append(script);
  });
  return carga;
}

export interface Widget {
  /** Token vigente o undefined si aún no se resuelve el reto. */
  token(): string | undefined;
  reiniciar(): void;
}

export async function montarTurnstile(contenedor: HTMLElement, sitekey: string, accion: string): Promise<Widget> {
  const api = await cargarScript();
  const id = api.render(contenedor, {
    sitekey,
    action: accion,
    theme: 'dark',
    language: 'es',
    // Visible solo si hace falta que la persona interactúe.
    appearance: 'interaction-only',
  });
  return {
    token: () => api.getResponse(id) || undefined,
    reiniciar: () => api.reset(id),
  };
}
