// Monitor de signos (sección #signos): IMC en vivo y validación de SpO₂ con las reglas de la app.

import { calcularImc, clasificarImc, errorSpo2, ETIQUETA_IMC, leerNumero } from '../lib/imc';

function iniciarMonitor(seccion: HTMLElement): void {
  const campo = (n: string): HTMLInputElement | null => seccion.querySelector<HTMLInputElement>(`input[name="${n}"]`);
  const peso = campo('peso');
  const talla = campo('talla');
  const spo2 = campo('spo2');
  const valor = seccion.querySelector<HTMLElement>('[data-imc-valor]');
  const texto = seccion.querySelector<HTMLElement>('[data-imc-texto]');
  const marca = seccion.querySelector<HTMLElement>('[data-gauge-marca]');
  const caja = seccion.querySelector<HTMLElement>('[data-lectura-spo2]');
  const aviso = seccion.querySelector<HTMLElement>('[data-error-spo2]');

  const actualizar = (): void => {
    const imc = calcularImc(leerNumero(peso?.value ?? ''), leerNumero(talla?.value ?? ''));
    if (valor) valor.textContent = imc === null ? '—' : imc.toFixed(1);
    if (texto) texto.textContent = imc === null ? 'Revisa peso y talla' : ETIQUETA_IMC[clasificarImc(imc)];
    if (marca && imc !== null) marca.style.setProperty('--pos', String(Math.min(Math.max((imc - 15) / 30, 0), 1)));

    const error = spo2 && spo2.value.trim() !== '' ? errorSpo2(leerNumero(spo2.value)) : null;
    caja?.classList.toggle('es-invalido', error !== null);
    spo2?.setAttribute('aria-invalid', String(error !== null));
    if (aviso) {
      aviso.hidden = error === null;
      aviso.textContent = error ?? '';
    }
  };

  seccion.addEventListener('input', actualizar);
  actualizar();
}

export function iniciarSignos(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-signos]').forEach(iniciarMonitor);
}
