// Trazos del monitor de signos (Signos.astro): se calculan al compilar, sin imágenes ni librerías.
// Son ilustrativos (un ritmo sinusal regular y su onda de pulso), no una señal real de ningún paciente.

const r = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Cuántos latidos caben y cuánto mide cada uno (≈ `latido` px). */
function ritmo(ancho: number, latido: number): { n: number; paso: number } {
  const n = Math.max(2, Math.round(ancho / latido));
  return { n, paso: ancho / n };
}

/** Derivación II: onda P, complejo QRS y onda T por latido; línea base al 60 % del alto. */
export function trazoEcg(ancho: number, alto: number, latido = 130): string {
  const { n, paso } = ritmo(ancho, latido);
  const base = alto * 0.6;
  const k = alto / 80;
  const y = (mv: number): string => r(base - mv * k);
  let d = `M0 ${r(base)}`;
  for (let i = 0; i < n; i++) {
    const x = (t: number): string => r((i + t) * paso);
    d +=
      ` H${x(0.1)} Q${x(0.16)} ${y(10)} ${x(0.22)} ${y(0)}` +
      ` H${x(0.3)} L${x(0.33)} ${y(-5)} L${x(0.37)} ${y(38)} L${x(0.41)} ${y(-11)} L${x(0.44)} ${y(0)}` +
      ` H${x(0.56)} Q${x(0.65)} ${y(16)} ${x(0.74)} ${y(0)} H${x(1)}`;
  }
  return d;
}

/** Pletismografía (la onda del oxímetro): subida rápida tras cada QRS, muesca dicrótica y bajada lenta. */
export function trazoPleth(ancho: number, alto: number, latido = 130): string {
  const { n, paso } = ritmo(ancho, latido);
  const bajo = r(alto * 0.82);
  const pico = r(alto * 0.2);
  const muesca = r(alto * 0.56);
  const rebote = r(alto * 0.48);
  let d = `M0 ${bajo}`;
  for (let i = 0; i < n; i++) {
    const x = (t: number): string => r((i + t) * paso);
    d +=
      ` L${x(0.42)} ${bajo} C${x(0.47)} ${bajo} ${x(0.49)} ${pico} ${x(0.54)} ${pico}` +
      ` C${x(0.6)} ${pico} ${x(0.63)} ${muesca} ${x(0.67)} ${muesca}` +
      ` C${x(0.7)} ${muesca} ${x(0.71)} ${rebote} ${x(0.74)} ${rebote}` +
      ` C${x(0.82)} ${rebote} ${x(0.92)} ${bajo} ${x(1)} ${bajo}`;
  }
  return d;
}
