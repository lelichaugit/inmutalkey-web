// Monitor de signos (sección #signos): IMC en vivo y validación de SpO₂ con las reglas de la app.
//
// Además (solo presentación):
//  · los trazos de ECG y pletismografía se generan al ancho real de cada franja (1 px de pantalla = 1 unidad: las
//    ondas no se deforman en celular) y el barrido se ajusta para ir a 72 latidos por minuto;
//  · la primera vez que el monitor entra en vista, el peso "se captura" de 0 a 70 kg y el IMC y la marca de la
//    escala lo siguen. Si el médico toca un campo, la animación se detiene en el valor de ejemplo.
// El dibujo ligado al scroll es CSS (Signos.astro, --p de data-progreso-scroll).

import { calcularImc, clasificarImc, errorSpo2, ETIQUETA_IMC, leerNumero } from '../lib/imc';

// ───────────── Trazos (también los usa Signos.astro al construir la página) ─────────────

/** Ancho de un latido a 72 lpm en la franja (px); la velocidad de barrido sale de aquí. */
const LATIDO = 130;
const PERIODO_S = 60 / 72;

const r = (n: number): string => (Math.round(n * 10) / 10).toString();

function latidos(ancho: number): { n: number; b: number } {
  const n = Math.max(2, Math.round(ancho / LATIDO));
  return { n, b: ancho / n };
}

/** Derivación II: P, QRS y T por latido, con la línea base al 56 % del alto. */
export function trazoEcg(ancho: number, alto: number): string {
  const { n, b } = latidos(ancho);
  const s = b / LATIDO;
  const k = alto / 72;
  const y0 = alto * 0.56;
  const y = (dy: number): string => r(y0 - dy * k);
  let d = `M0 ${r(y0)}`;
  for (let i = 0; i < n; i++) {
    const x = (dx: number): string => r(i * b + dx * s);
    d +=
      ` L${x(16)} ${y(0)} Q${x(22)} ${y(9)} ${x(28)} ${y(0)} L${x(38)} ${y(0)}` +
      ` L${x(41)} ${y(-4)} L${x(46)} ${y(30)} L${x(51)} ${y(-9)} L${x(55)} ${y(0)}` +
      ` L${x(68)} ${y(0)} Q${x(79)} ${y(14)} ${x(90)} ${y(0)} L${x(LATIDO)} ${y(0)}`;
  }
  return d;
}

/** Pletismografía (SpO₂): subida rápida, muesca dicrótica y bajada lenta, un poco después de cada QRS. */
export function trazoPleth(ancho: number, alto: number): string {
  const { b } = latidos(ancho);
  const bajo = r(alto * 0.82);
  const pico = r(alto * 0.18);
  const muesca = r(alto * 0.52);
  const rebote = r(alto * 0.45);
  let d = `M0 ${bajo}`;
  for (let x0 = b * 0.35; x0 + b <= ancho + 0.5; x0 += b) {
    const x = (f: number): string => r(x0 + f * b);
    d +=
      ` L${x(0)} ${bajo} C${x(0.08)} ${bajo} ${x(0.12)} ${pico} ${x(0.2)} ${pico}` +
      ` C${x(0.27)} ${pico} ${x(0.33)} ${muesca} ${x(0.38)} ${muesca}` +
      ` C${x(0.42)} ${muesca} ${x(0.44)} ${rebote} ${x(0.48)} ${rebote}` +
      ` C${x(0.56)} ${rebote} ${x(0.78)} ${bajo} ${x(1)} ${bajo}`;
  }
  return `${d} L${r(ancho)} ${bajo}`;
}

const GENERADORES = { ecg: trazoEcg, pleth: trazoPleth } as const;
type Onda = keyof typeof GENERADORES;
const esOnda = (v: string | undefined): v is Onda => v === 'ecg' || v === 'pleth';

/** Vuelve a trazar cada onda a su tamaño real (y al cambiar de tamaño). */
function ajustarOndas(seccion: HTMLElement): void {
  const monitor = seccion.querySelector<HTMLElement>('[data-monitor]');
  const svgs = [...seccion.querySelectorAll<SVGSVGElement>('svg[data-onda]')];
  if (svgs.length === 0) return;
  let ultimo = '';
  const trazar = (): void => {
    const medidas = svgs.map((svg) => {
      const caja = svg.parentElement ?? svg;
      return { svg, ancho: Math.round(caja.clientWidth), alto: Math.round(svg.getBoundingClientRect().height) };
    });
    const firma = medidas.map((m) => `${m.ancho}x${m.alto}`).join(',');
    if (firma === ultimo || medidas.some((m) => m.ancho < 40 || m.alto < 20)) return;
    ultimo = firma;
    for (const { svg, ancho, alto } of medidas) {
      const tipo = svg.dataset['onda'];
      const trazo = svg.querySelector('path');
      if (!esOnda(tipo) || !trazo) continue;
      svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
      trazo.setAttribute('d', GENERADORES[tipo](ancho, alto));
    }
    // El barrido cruza la franja a la velocidad de los latidos: un QRS cada 0.83 s, como el corazón que late al lado.
    const ancho = medidas[0]?.ancho ?? 0;
    if (monitor && ancho > 0) monitor.style.setProperty('--barrido', `${((ancho / latidos(ancho).b) * PERIODO_S).toFixed(3)}s`);
  };
  trazar();
  if ('ResizeObserver' in window) {
    let pendiente = false;
    new ResizeObserver(() => {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(() => {
        pendiente = false;
        trazar();
      });
    }).observe(svgs[0]?.parentElement ?? seccion);
  }
}

// ───────────── Monitor ─────────────

const numero = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function iniciarMonitor(seccion: HTMLElement): void {
  const campo = (n: string): HTMLInputElement | null => seccion.querySelector<HTMLInputElement>(`input[name="${n}"]`);
  const peso = campo('peso');
  const talla = campo('talla');
  const spo2 = campo('spo2');
  const valor = seccion.querySelector<HTMLElement>('[data-imc-valor]');
  const texto = seccion.querySelector<HTMLElement>('[data-imc-texto]');
  const formula = seccion.querySelector<HTMLElement>('[data-imc-formula]');
  const resultado = seccion.querySelector<HTMLElement>('[data-imc-resultado]');
  const marca = seccion.querySelector<HTMLElement>('[data-gauge-marca]');
  const caja = seccion.querySelector<HTMLElement>('[data-lectura-spo2]');
  const aviso = seccion.querySelector<HTMLElement>('[data-error-spo2]');

  const actualizar = (): void => {
    const p = leerNumero(peso?.value ?? '');
    const t = leerNumero(talla?.value ?? '');
    const imc = calcularImc(p, t);
    if (valor) valor.textContent = imc === null ? '—' : imc.toFixed(1);
    if (texto) texto.textContent = imc !== null ? ETIQUETA_IMC[clasificarImc(imc)] : animando ? 'Calculando…' : 'Revisa peso y talla';
    if (formula) formula.textContent = imc === null ? 'peso ÷ talla²' : `${numero(p)} kg ÷ (${(t / 100).toFixed(2)} m)²`;
    if (marca && imc !== null) marca.style.setProperty('--pos', String(Math.min(Math.max((imc - 15) / 30, 0), 1)));

    const error = spo2 && spo2.value.trim() !== '' ? errorSpo2(leerNumero(spo2.value)) : null;
    caja?.classList.toggle('es-invalido', error !== null);
    spo2?.setAttribute('aria-invalid', String(error !== null));
    if (aviso) {
      aviso.hidden = error === null;
      aviso.textContent = error ?? '';
    }
  };

  // El IMC "se calcula a la vista": el peso se captura de 0 al valor de ejemplo y el resultado lo sigue.
  let cuadro = 0;
  let animando = false;
  const pesoFinal = peso?.value ?? '';
  const terminar = (): void => {
    if (!animando) return;
    animando = false;
    window.cancelAnimationFrame(cuadro);
    if (peso) peso.value = pesoFinal;
    seccion.classList.remove('es-capturando');
    resultado?.removeAttribute('aria-busy');
    actualizar();
  };
  const capturar = (): void => {
    const final = leerNumero(pesoFinal);
    if (!peso || !Number.isFinite(final)) return;
    animando = true;
    seccion.classList.add('es-capturando');
    resultado?.setAttribute('aria-busy', 'true');
    const inicio = performance.now();
    const duracion = 1500;
    const paso = (ahora: number): void => {
      if (!animando) return;
      const f = Math.min((ahora - inicio) / duracion, 1);
      peso.value = String(Math.round(final * (1 - Math.pow(1 - f, 3))));
      actualizar();
      if (f < 1) {
        cuadro = window.requestAnimationFrame(paso);
        return;
      }
      terminar();
      resultado?.classList.add('es-calculado');
      window.setTimeout(() => resultado?.classList.remove('es-calculado'), 1600);
    };
    cuadro = window.requestAnimationFrame(paso);
  };

  seccion.addEventListener('focusin', terminar);
  seccion.addEventListener('input', actualizar);
  actualizar();

  const zona = seccion.querySelector('[data-imc-zona]');
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (zona && !reducido && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e], obs) => {
        if (!e?.isIntersecting) return;
        obs.disconnect();
        if (!seccion.contains(document.activeElement)) capturar();
      },
      { threshold: 0.7 },
    ).observe(zona);
  }

  ajustarOndas(seccion);
}

export async function iniciarSignos(raiz: ParentNode): Promise<void> {
  raiz.querySelectorAll<HTMLElement>('[data-signos]').forEach(iniciarMonitor);
  // La galería de capturas va justo debajo y base.ts no le asigna módulo: se descarga desde aquí, solo si existe.
  if (raiz.querySelector('[data-galeria]')) await import('./capturas').then((m) => m.iniciarCapturas(raiz));
}
