// Monitor de signos de la portada (Signos.astro). Se descarga cuando la sección se acerca a la vista.
//  · IMC en vivo con la clasificación de la OMS y marca en la escala (mismas reglas que la app: lib/imc.ts).
//  · SpO₂ fuera de 30–100 %: aviso en rojo, como en la app antes de firmar.
//  · `.en-vista` en la sección mientras el monitor se ve: fuera de vista, el barrido y el latido se pausan (batería).
// Sin este módulo el monitor se ve completo y quieto, con los valores de ejemplo.

import { calcularImc, clasificarImc, errorSpo2, ETIQUETA_IMC, leerNumero } from '../lib/imc';

/** Escala del medidor: de IMC 15 a 45. */
const posicion = (imc: number): number => Math.min(Math.max((imc - 15) / 30, 0), 1);

function iniciar(seccion: HTMLElement): void {
  const entrada = (nombre: string): HTMLInputElement | null => seccion.querySelector<HTMLInputElement>(`input[name="${nombre}"]`);
  const peso = entrada('peso');
  const talla = entrada('talla');
  const spo2 = entrada('spo2');
  const valor = seccion.querySelector<HTMLElement>('[data-sg-imc]');
  const clase = seccion.querySelector<HTMLElement>('[data-sg-clase]');
  const formula = seccion.querySelector<HTMLElement>('[data-sg-formula]');
  const marca = seccion.querySelector<HTMLElement>('[data-sg-marca]');
  const aviso = seccion.querySelector<HTMLElement>('[data-sg-aviso]');
  const tarjetaSpo2 = seccion.querySelector<HTMLElement>('[data-sg-spo2]');

  const actualizar = (): void => {
    const p = leerNumero(peso?.value ?? '');
    const t = leerNumero(talla?.value ?? '');
    const imc = calcularImc(p, t);
    if (valor) valor.textContent = imc === null ? '—' : imc.toFixed(1);
    if (clase) clase.textContent = imc === null ? 'Revise peso y talla' : ETIQUETA_IMC[clasificarImc(imc)];
    if (formula) formula.textContent = imc === null ? 'peso ÷ talla²' : `${p} kg ÷ (${(t / 100).toFixed(2)} m)²`;
    if (marca) {
      marca.hidden = imc === null;
      if (imc !== null) marca.style.setProperty('--pos', posicion(imc).toFixed(3));
    }

    const error = spo2 && spo2.value.trim() !== '' ? errorSpo2(leerNumero(spo2.value)) : null;
    spo2?.setAttribute('aria-invalid', String(error !== null));
    tarjetaSpo2?.classList.toggle('sg-invalido', error !== null);
    if (aviso) {
      aviso.hidden = error === null;
      aviso.textContent = error ?? '';
    }
  };

  seccion.addEventListener('input', actualizar);
  actualizar();

  const monitor = seccion.querySelector('[data-sg-monitor]');
  if (!monitor || !('IntersectionObserver' in window)) {
    seccion.classList.add('en-vista');
    return;
  }
  new IntersectionObserver(([e]) => seccion.classList.toggle('en-vista', e?.isIntersecting ?? false), { threshold: 0.15 }).observe(monitor);
}

export function iniciarSignos(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-signos]').forEach(iniciar);
}
