// Antes del primer pintado (script clásico externo: la CSP no admite scripts en línea).
//  · .js y .movimiento en <html> (sin esperar al módulo diferido: evita saltos de CLS).
//  · Tema elegido a mano (claro, oscuro o aurora) desde localStorage; sin elección, manda prefers-color-scheme.
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) h.classList.add('movimiento');
  try {
    var t = window.localStorage.getItem('ik-tema');
    if (t === 'claro' || t === 'oscuro' || t === 'aurora') h.setAttribute('data-theme', t);
  } catch (e) {
    /* Almacenamiento bloqueado: se queda el tema del sistema. */
  }
})();
