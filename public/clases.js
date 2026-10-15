// Clases de <html> antes del primer pintado (script clásico externo: la CSP no admite scripts en línea).
// Sin esto, .js y .movimiento llegaban con el módulo diferido y el hero "saltaba" (CLS). base.ts las vuelve a poner.
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) h.classList.add('movimiento');
})();
