// Desplazamiento suave en escritorio (decisión de Alan, 15-nov-2026): Lenis solo con ratón o trackpad y sin «reducir
// movimiento». En pantallas táctiles este módulo ni se descarga: el scroll nativo del teléfono ya tiene inercia.
// Lenis mueve la ventana de verdad (no un contenedor con transform), así que `position: sticky`, los
// IntersectionObserver y el motor de escenas trabajan igual con él que sin él.
import Lenis from 'lenis';

export type Suave = Lenis;

export function iniciarSuave(): Suave {
  return new Lenis({
    autoRaf: true,
    // Un poco más vivo que el valor de fábrica (0.1): la rueda por muescas de Windows responde antes.
    lerp: 0.12,
    smoothWheel: true,
    syncTouch: false,
    // Al ir a otra página no se arrastra la inercia del gesto anterior.
    stopInertiaOnNavigate: true,
  });
}
