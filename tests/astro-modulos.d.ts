// Solo para `tsc --noEmit` (sin el plugin de Astro): `astro check` resuelve los .astro con sus tipos reales.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
  const Componente: AstroComponentFactory;
  export default Componente;
}
