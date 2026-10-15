// Desplazamiento suave con Lenis (darkroomengineering/lenis) para rueda de ratón y trackpad: Windows y Mac.
// En pantallas táctiles (iPhone, iPad, Android) no se carga: su scroll nativo ya tiene inercia y es el más fluido.
// Lenis desplaza la ventana de verdad, así que `position: sticky`, IntersectionObserver y el motor de scroll siguen
// funcionando igual.
import Lenis from 'lenis';

export function iniciarSuave(): Lenis {
  return new Lenis({
    autoRaf: true,
    // 0.1 es el valor de Lenis; un poco más alto responde antes en ratones de rueda por pasos (Windows).
    lerp: 0.12,
    smoothWheel: true,
    syncTouch: false,
    // Al ir a otra página no arrastra la inercia.
    stopInertiaOnNavigate: true,
  });
}
