// Simulador de InmutalKey (sección #demo). Se reproduce solo por capítulos cuando entra en vista y se pausa
// al salir. La nota de evolución es real: el semáforo, el IMC, la validación de SpO₂ y la búsqueda CIE-10
// usan las mismas reglas que la app (src/lib/*). Todo el texto se escribe con textContent/value.

import { buscarCie10, type Diagnostico } from '../lib/cie10';
import { calcularImc, clasificarImc, errorSpo2, ETIQUETA_IMC, leerNumero } from '../lib/imc';
import { calcularSemaforo, ETIQUETA_SEMAFORO, type DatosNota } from '../lib/semaforo';

type IdCapitulo = 'agenda' | 'consulta' | 'firma' | 'receta' | 'correccion' | 'auditoria' | 'respaldo';
type Pantalla = 'agenda' | 'consulta' | 'expediente' | 'receta';
type Campo = HTMLInputElement | HTMLTextAreaElement;

const ORDEN: readonly IdCapitulo[] = ['agenda', 'consulta', 'firma', 'receta', 'correccion', 'auditoria', 'respaldo'];
const CAMPOS_NOTA = ['motivo', 'evolucion', 'taSistolica', 'taDiastolica', 'fc', 'fr', 'temperatura', 'spo2', 'peso', 'talla', 'exploracion', 'pronostico', 'plan'] as const;

class Cancelado extends Error {}

class Demo {
  private readonly app: HTMLElement;
  private readonly principal: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly cursor: HTMLElement;
  private readonly narracion: HTMLElement | null;
  private readonly toasts: HTMLElement;
  private readonly botones: HTMLButtonElement[];
  private readonly pausa: HTMLButtonElement | null;
  private readonly finales = new Map<Campo, string>();
  private readonly reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private token = 0;
  private pausado = false;
  private visible = false;
  private reproduciendo = false;
  private iniciado = false;
  private actual: IdCapitulo = 'consulta';

  constructor(private readonly seccion: HTMLElement) {
    const q = <T extends Element>(sel: string): T => {
      const el = seccion.querySelector<T>(sel);
      if (!el) throw new Error(`demo: falta ${sel}`);
      return el;
    };
    this.app = q('[data-app]');
    this.principal = q('[data-principal]');
    this.form = q('[data-nota]');
    this.cursor = q('[data-cursor]');
    this.toasts = q('[data-toasts]');
    this.narracion = seccion.querySelector('[data-narracion]');
    this.botones = [...seccion.querySelectorAll<HTMLButtonElement>('[data-capitulo]')];
    this.pausa = seccion.querySelector('[data-control="pausa"]');

    for (const nombre of [...CAMPOS_NOTA, 'buscarCie10']) {
      const c = this.campo(nombre);
      if (c) this.finales.set(c, c.value);
    }

    this.enlazar();
    this.actualizarNota();
    this.vigilarVisibilidad();
  }

  // ───────────── Utilidades ─────────────

  private campo(nombre: string): Campo | null {
    const el = this.form.elements.namedItem(nombre);
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
  }

  private el<T extends HTMLElement = HTMLElement>(sel: string): T | null {
    return this.app.querySelector<T>(sel);
  }

  private async esperar(ms: number, t: number): Promise<void> {
    let restante = this.reducido ? Math.min(ms, 120) : ms;
    while (restante > 0) {
      if (t !== this.token) throw new Cancelado();
      const paso = Math.min(50, restante);
      await new Promise((r) => setTimeout(r, paso));
      if (!this.pausado && this.visible) restante -= paso;
    }
    if (t !== this.token) throw new Cancelado();
  }

  private narrar(texto: string): void {
    if (this.narracion) this.narracion.textContent = texto;
  }

  private mostrar(p: Pantalla): void {
    if (this.app.dataset['pantalla'] !== p) {
      this.app.dataset['pantalla'] = p;
      this.principal.scrollTop = 0;
    }
  }

  private toast(texto: string, tipo: 'exito' | 'alerta' | 'info' = 'info'): void {
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = texto;
    this.toasts.append(t);
    window.setTimeout(() => t.classList.add('es-saliendo'), 3200);
    window.setTimeout(() => t.remove(), 3500);
  }

  private desplazarA(el: Element): void {
    if (!this.principal.contains(el)) return;
    const caja = this.principal.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const destino = this.principal.scrollTop + (r.top - caja.top) - caja.height * 0.32;
    this.principal.scrollTo({ top: Math.max(0, destino), behavior: this.reducido ? 'auto' : 'smooth' });
  }

  private async apuntar(el: Element, t: number): Promise<void> {
    this.desplazarA(el);
    await this.esperar(this.principal.contains(el) ? 380 : 60, t);
    if (this.reducido) return;
    const a = this.app.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    this.cursor.style.setProperty('--cx', `${r.left - a.left + Math.min(r.width * 0.55, 60)}px`);
    this.cursor.style.setProperty('--cy', `${r.top - a.top + r.height * 0.55}px`);
    this.app.classList.add('con-cursor');
    await this.esperar(820, t);
  }

  private async clic(el: Element | null, t: number): Promise<void> {
    if (!el) return;
    await this.apuntar(el, t);
    this.cursor.classList.add('es-clic');
    el.classList.add('es-presionado');
    await this.esperar(260, t);
    this.cursor.classList.remove('es-clic');
    el.classList.remove('es-presionado');
  }

  private async escribir(c: Campo | null, texto: string, t: number, cps = 42): Promise<void> {
    if (!c) return;
    this.desplazarA(c);
    c.classList.add('es-escribiendo');
    c.value = '';
    for (const letra of texto) {
      c.value += letra;
      c.dispatchEvent(new Event('input', { bubbles: true }));
      await this.esperar(1000 / cps + Math.random() * 18, t);
    }
    c.classList.remove('es-escribiendo');
    await this.esperar(160, t);
  }

  private avance(fraccion: number): void {
    const b = this.botones.find((x) => x.dataset['capitulo'] === this.actual);
    b?.querySelector<HTMLElement>('.capitulo-avance span')?.style.setProperty('--avance', String(fraccion));
  }

  private abrirModal(nombre: string): void {
    this.app.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = m.dataset['modal'] !== nombre));
  }

  private cerrarModales(): void {
    this.app.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = true));
  }

  // ───────────── Nota en vivo ─────────────

  private datosNota(): DatosNota {
    const v = (n: string): string => this.campo(n)?.value ?? '';
    return {
      motivo: v('motivo'),
      evolucion: v('evolucion'),
      taSistolica: v('taSistolica'),
      taDiastolica: v('taDiastolica'),
      fc: v('fc'),
      fr: v('fr'),
      temperatura: v('temperatura'),
      peso: v('peso'),
      talla: v('talla'),
      omisionSignos: '',
      exploracion: v('exploracion'),
      diagnostico: v('diagnostico'),
      cie10: v('cie10'),
      pronostico: v('pronostico'),
      plan: v('plan'),
    };
  }

  private actualizarNota(): void {
    const s = calcularSemaforo(this.datosNota());
    const semaforo = this.el('[data-semaforo]');
    if (semaforo) semaforo.dataset['semaforo'] = s.estado;
    const texto = this.el('[data-semaforo-texto]');
    if (texto) texto.textContent = ETIQUETA_SEMAFORO[s.estado];
    const conteo = this.el('[data-semaforo-conteo]');
    if (conteo) conteo.textContent = `${s.cumplidos} de 7`;
    const firmar = this.el<HTMLButtonElement>('[data-accion="firmar"]');
    if (firmar) firmar.disabled = s.estado !== 'verde';

    const imc = calcularImc(leerNumero(this.campo('peso')?.value ?? ''), leerNumero(this.campo('talla')?.value ?? ''));
    const salida = this.el('[data-imc]');
    const clase = this.el('[data-imc-clase]');
    if (salida) salida.textContent = imc === null ? '—' : imc.toFixed(1);
    if (clase) clase.textContent = imc === null ? 'Peso y talla' : ETIQUETA_IMC[clasificarImc(imc)];

    const spo2 = this.campo('spo2');
    const aviso = this.el('[data-spo2-error]');
    if (spo2 && aviso) {
      const error = spo2.value.trim() === '' ? null : errorSpo2(leerNumero(spo2.value));
      aviso.hidden = error === null;
      aviso.textContent = error ?? '';
      spo2.classList.toggle('es-invalido', error !== null);
    }
  }

  private borradorPendiente = false;

  private marcarBorrador(): void {
    this.borradorPendiente = true;
  }

  private cicloBorrador(): void {
    // Como en la app: el borrador se guarda cada 3 s si hubo cambios.
    window.setInterval(() => {
      if (!this.borradorPendiente || this.app.dataset['pantalla'] !== 'consulta') return;
      this.borradorPendiente = false;
      const b = this.el('[data-borrador]');
      if (!b) return;
      b.classList.add('es-guardando');
      window.setTimeout(() => b.classList.remove('es-guardando'), 450);
    }, 3000);
  }

  // ───────────── CIE-10 ─────────────

  private resultados: Diagnostico[] = [];
  private resaltado = -1;

  private listaCie10(): HTMLElement | null {
    return this.el('[data-cie10-lista]');
  }

  private pintarCie10(consulta: string): void {
    const lista = this.listaCie10();
    const entrada = this.campo('buscarCie10');
    if (!lista || !entrada) return;
    this.resultados = buscarCie10(consulta, 5);
    this.resaltado = this.resultados.length > 0 ? 0 : -1;
    lista.replaceChildren(
      ...this.resultados.map((d, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.dataset['codigo'] = d.codigo;
        if (i === this.resaltado) b.classList.add('es-resaltado');
        const clave = document.createElement('b');
        clave.textContent = d.codigo;
        const nombre = document.createElement('span');
        nombre.textContent = d.nombre;
        b.append(clave, nombre);
        b.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          this.elegirCie10(d);
        });
        li.append(b);
        return li;
      }),
    );
    lista.hidden = this.resultados.length === 0;
    entrada.setAttribute('aria-expanded', String(!lista.hidden));
  }

  private elegirCie10(d: Diagnostico): void {
    const entrada = this.campo('buscarCie10');
    const cie = this.campo('cie10');
    const dx = this.campo('diagnostico');
    if (entrada) entrada.value = `${d.codigo} · ${d.nombre}`;
    if (cie) cie.value = d.codigo;
    if (dx) dx.value = d.nombre;
    const lista = this.listaCie10();
    if (lista) lista.hidden = true;
    entrada?.setAttribute('aria-expanded', 'false');
    this.actualizarNota();
    this.marcarBorrador();
  }

  // ───────────── Estados de partida por capítulo ─────────────

  private llenarNota(valores: 'vacia' | 'completa'): void {
    for (const [c, final] of this.finales) c.value = valores === 'completa' ? final : '';
    const cie = this.campo('cie10');
    const dx = this.campo('diagnostico');
    if (cie) cie.value = valores === 'completa' ? 'J02.9' : '';
    if (dx) dx.value = valores === 'completa' ? 'Faringitis aguda no especificada' : '';
    const lista = this.listaCie10();
    if (lista) lista.hidden = true;
    this.actualizarNota();
  }

  private estadoCita(estado: 'actual' | 'en-atencion' | 'atendida'): void {
    const insignia = this.el('[data-estado-cita]');
    const iniciar = this.el<HTMLButtonElement>('[data-accion="iniciar"]');
    const fila = this.el('[data-cita="10:00"]');
    const mini = this.el('[data-agenda-mini="10:00"]');
    const textoMini = mini?.querySelector('[data-agenda-estado]');
    if (insignia) insignia.textContent = estado === 'actual' ? 'Ahora' : estado === 'en-atencion' ? 'En atención' : 'Atendida';
    if (iniciar) iniciar.hidden = estado !== 'actual';
    fila?.classList.toggle('cita-atendida', estado === 'atendida');
    mini?.classList.toggle('cita-actual', estado !== 'atendida');
    mini?.classList.toggle('cita-atendida', estado === 'atendida');
    if (textoMini) textoMini.textContent = estado === 'actual' ? 'Programada' : estado === 'en-atencion' ? 'En atención' : 'Atendida';
  }

  private estadoExpediente(sellada: boolean, conAddendum: boolean): void {
    const nota = this.el('[data-nota-sellada]');
    nota?.classList.remove('es-sellando');
    nota?.classList.toggle('es-sellada', sellada);
    const form = this.el('[data-addendum-form]');
    if (form) form.hidden = true;
    const add = this.el('[data-addendum]');
    if (add) add.hidden = !conAddendum;
    const insignia = this.el('[data-con-addendums]');
    if (insignia) insignia.hidden = !conAddendum;
    const contenido = this.el<HTMLInputElement>('[name="contenidoAddendum"]');
    if (contenido) contenido.value = '';
  }

  private reiniciarDialogos(): void {
    this.cerrarModales();
    const clave = this.el<HTMLInputElement>('[data-clave]');
    if (clave) clave.value = '';
    this.app.querySelectorAll('[data-auditoria]').forEach((li) => li.classList.remove('es-verificado'));
    const ra = this.el('[data-auditoria-resultado]');
    if (ra) ra.hidden = true;
    const rr = this.el('[data-respaldo-resultado]');
    if (rr) rr.hidden = true;
    this.el('[data-destino-usb]')?.classList.remove('es-elegido');
    const destino = this.el('[data-destino-texto]');
    if (destino) destino.textContent = 'Unidad alterna: sin elegir';
    this.el('[data-progreso] span')?.style.setProperty('--avance', '0');
  }

  private preparar(id: IdCapitulo): void {
    this.reiniciarDialogos();
    this.toasts.replaceChildren();
    this.app.classList.remove('con-cursor');
    const hoja = this.el('[data-hoja]');
    if (hoja) hoja.dataset['hoja'] = 'media';
    this.app.querySelectorAll<HTMLButtonElement>('[data-formato]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['formato'] === 'media')));

    const i = ORDEN.indexOf(id);
    this.estadoCita(i === 0 ? 'actual' : i <= 2 ? 'en-atencion' : 'atendida');
    this.llenarNota(i >= 2 ? 'completa' : 'vacia');
    this.estadoExpediente(i >= 3, i >= 5);
    this.mostrar(i === 0 ? 'agenda' : i <= 2 ? 'consulta' : 'expediente');
  }

  // ───────────── Capítulos ─────────────

  private async capitulo(id: IdCapitulo, t: number): Promise<void> {
    switch (id) {
      case 'agenda': {
        this.narrar('Al abrir InmutalKey ves las citas de hoy. La de las 10:00 es la actual.');
        await this.esperar(1600, t);
        this.avance(0.4);
        await this.clic(this.el('[data-accion="iniciar"]'), t);
        this.estadoCita('en-atencion');
        this.toast('Consulta iniciada: María Fernanda López');
        this.narrar('Un clic en "Iniciar consulta" abre la nota del paciente. La cita pasa a "En atención".');
        this.avance(1);
        await this.esperar(1700, t);
        return;
      }
      case 'consulta': {
        this.mostrar('consulta');
        this.narrar('Escribe la nota. El semáforo revisa los 7 requisitos de la NOM-004 mientras avanzas.');
        await this.esperar(900, t);
        await this.escribir(this.campo('motivo'), this.finales.get(this.campo('motivo') as Campo) ?? '', t);
        await this.escribir(this.campo('evolucion'), this.finales.get(this.campo('evolucion') as Campo) ?? '', t, 70);
        this.avance(0.3);
        this.narrar('Signos vitales: el IMC se calcula solo con el peso y la talla.');
        for (const n of ['taSistolica', 'taDiastolica', 'fc', 'fr', 'temperatura', 'spo2', 'peso', 'talla']) {
          const c = this.campo(n);
          await this.escribir(c, c ? (this.finales.get(c) ?? '') : '', t, 16);
        }
        this.avance(0.55);
        await this.escribir(this.campo('exploracion'), this.finales.get(this.campo('exploracion') as Campo) ?? '', t, 75);
        this.narrar('Busca el diagnóstico por nombre o por clave CIE-10.');
        const buscar = this.campo('buscarCie10');
        await this.escribir(buscar, 'faring', t, 10);
        this.pintarCie10('faring');
        await this.esperar(700, t);
        const opcion = this.el('[data-cie10-lista] [data-codigo="J02.9"]');
        await this.clic(opcion, t);
        const d = buscarCie10('J02.9', 1)[0];
        if (d) this.elegirCie10(d);
        this.avance(0.75);
        await this.escribir(this.campo('pronostico'), this.finales.get(this.campo('pronostico') as Campo) ?? '', t, 60);
        await this.escribir(this.campo('plan'), this.finales.get(this.campo('plan') as Campo) ?? '', t, 80);
        this.app.classList.remove('con-cursor');
        this.narrar('Semáforo en verde: la nota cumple los 7 requisitos y ya se puede firmar.');
        this.avance(1);
        await this.esperar(2000, t);
        return;
      }
      case 'firma': {
        this.narrar('Al firmar, InmutalKey te pide tu contraseña y la llave sella la nota.');
        await this.clic(this.el('[data-accion="firmar"]'), t);
        await this.firmar(t);
        return;
      }
      case 'receta': {
        this.narrar('La receta sale de la nota firmada: con folio, expediente y sello.');
        await this.esperar(900, t);
        await this.clic(this.el('[data-accion="receta"]'), t);
        this.mostrar('receta');
        this.avance(0.35);
        await this.esperar(1500, t);
        this.narrar('Elige el formato que usas: carta o media carta.');
        await this.formato('carta', t);
        await this.esperar(1500, t);
        await this.formato('media', t);
        this.avance(0.8);
        await this.esperar(900, t);
        await this.clic(this.el('[data-accion="imprimir"]'), t);
        this.toast('Enviando a la impresora…');
        this.avance(1);
        await this.esperar(1800, t);
        return;
      }
      case 'correccion': {
        this.narrar('¿Te equivocaste en una nota firmada? No se edita: se corrige con un addendum.');
        await this.esperar(900, t);
        await this.clic(this.el('[data-accion="editar"]'), t);
        this.toast('Las notas firmadas no se modifican. Agrega un addendum.', 'alerta');
        this.avance(0.25);
        await this.esperar(1500, t);
        await this.clic(this.el('[data-accion="addendum"]'), t);
        const form = this.el('[data-addendum-form]');
        if (form) form.hidden = false;
        this.narrar('Eliges el motivo de catálogo y escribes la corrección.');
        const motivo = this.el<HTMLSelectElement>('[name="motivoAddendum"]');
        await this.clic(motivo, t);
        if (motivo) motivo.selectedIndex = 0;
        this.avance(0.5);
        await this.escribir(this.el<HTMLInputElement>('[name="contenidoAddendum"]'), 'Temperatura correcta: 38.4 °C.', t, 30);
        await this.clic(this.el('[data-accion="firmar-addendum"]'), t);
        this.estadoExpediente(true, true);
        this.desplazarA(this.el('[data-addendum]') ?? this.principal);
        this.toast('Addendum firmado y sellado', 'exito');
        this.narrar('La corrección queda sellada junto a la nota. La original no cambia y el expediente muestra las dos.');
        this.avance(1);
        await this.esperar(2400, t);
        return;
      }
      case 'auditoria': {
        this.narrar('Cuando quieras, audita todo tu archivo: InmutalKey vuelve a calcular cada huella y cada firma.');
        await this.esperar(900, t);
        await this.clic(this.el('[data-accion="auditar"]'), t);
        this.app.classList.remove('con-cursor');
        this.abrirModal('auditoria');
        const filas = [...this.app.querySelectorAll('[data-auditoria]')];
        for (const [i, f] of filas.entries()) {
          await this.esperar(750, t);
          f.classList.add('es-verificado');
          this.avance((i + 1) / (filas.length + 1));
        }
        await this.esperar(400, t);
        const r = this.el('[data-auditoria-resultado]');
        if (r) r.hidden = false;
        this.narrar('Íntegro. Si alguien hubiera alterado algo por fuera del programa, aquí lo verías.');
        this.avance(1);
        await this.esperar(2600, t);
        this.cerrarModales();
        return;
      }
      case 'respaldo': {
        this.narrar('Respalda con un clic. Puedes elegir tu USB y la copia se compara con el original.');
        await this.esperar(900, t);
        await this.clic(this.el('[data-accion="respaldar"]'), t);
        this.abrirModal('respaldo');
        await this.esperar(600, t);
        await this.clic(this.el('[data-accion="examinar"]'), t);
        this.el('[data-destino-usb]')?.classList.add('es-elegido');
        const destino = this.el('[data-destino-texto]');
        if (destino) destino.textContent = 'USB (E:) › Respaldos';
        this.app.classList.remove('con-cursor');
        this.avance(0.35);
        const barra = this.el('[data-progreso] span');
        for (let p = 0; p <= 20; p++) {
          barra?.style.setProperty('--avance', String(p / 20));
          await this.esperar(110, t);
        }
        const r = this.el('[data-respaldo-resultado]');
        if (r) r.hidden = false;
        this.toast('Respaldo guardado y verificado en 2 ubicaciones', 'exito');
        this.narrar('Listo: así de simple es un día con InmutalKey. ¿Lo probamos en tu consultorio?');
        this.avance(1);
        await this.esperar(3000, t);
        this.cerrarModales();
        return;
      }
    }
  }

  private async formato(f: 'carta' | 'media', t: number): Promise<void> {
    const b = this.el(`[data-formato="${f}"]`);
    await this.clic(b, t);
    this.app.querySelectorAll<HTMLButtonElement>('[data-formato]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const hoja = this.el('[data-hoja]');
    if (hoja) hoja.dataset['hoja'] = f;
  }

  /** Firma: contraseña, la llave sella la nota y la cita queda atendida. También la dispara el médico con el botón. */
  private async firmar(t: number): Promise<void> {
    this.copiarNotaAlExpediente();
    this.abrirModal('firma');
    this.avance(0.2);
    const clave = this.el<HTMLInputElement>('[data-clave]');
    await this.escribir(clave, '••••••••', t, 14);
    await this.clic(this.el('[data-accion="confirmar-firma"]'), t);
    this.cerrarModales();
    this.app.classList.remove('con-cursor');
    this.mostrar('expediente');
    this.estadoExpediente(false, false);
    const nota = this.el('[data-nota-sellada]');
    await this.esperar(350, t);
    nota?.classList.add('es-sellando', 'es-sellada');
    this.avance(0.6);
    await this.esperar(1500, t);
    this.toast('Nota firmada y sellada', 'exito');
    await this.esperar(700, t);
    this.estadoCita('atendida');
    this.toast('Cita de las 10:00 marcada como atendida', 'exito');
    this.narrar('Desde ahora la nota no se puede modificar, y la cita se marcó como atendida sola.');
    this.avance(1);
    await this.esperar(2400, t);
  }

  /** La nota sellada muestra lo que haya escrito el médico (o el ejemplo). */
  private copiarNotaAlExpediente(): void {
    const d = this.datosNota();
    const v = (n: string): string => this.campo(n)?.value.trim() ?? '';
    const filas = this.app.querySelectorAll<HTMLElement>('[data-nota-sellada] dd');
    const imc = this.el('[data-imc]')?.textContent ?? '—';
    const textos = [
      d.motivo.trim(),
      `TA ${v('taSistolica')}/${v('taDiastolica')} · FC ${v('fc')} · FR ${v('fr')} · T ${v('temperatura')} °C · SpO₂ ${v('spo2')} % · IMC ${imc}`,
      `${d.cie10} · ${d.diagnostico}`,
      d.plan.trim(),
    ];
    filas.forEach((dd, i) => {
      const texto = textos[i];
      if (texto) dd.textContent = texto;
    });
  }

  // ───────────── Reproducción ─────────────

  private marcar(id: IdCapitulo): void {
    this.actual = id;
    const i = ORDEN.indexOf(id);
    this.botones.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(j === i));
      b.classList.toggle('es-hecho', j < i);
      b.querySelector<HTMLElement>('.capitulo-avance span')?.style.setProperty('--avance', j < i ? '1' : '0');
    });
  }

  private ponerPausa(pausado: boolean): void {
    this.pausado = pausado;
    if (!this.pausa) return;
    this.pausa.setAttribute('aria-pressed', String(pausado));
    const texto = this.pausa.querySelector('[data-control-texto]');
    if (texto) texto.textContent = pausado ? (this.reproduciendo ? 'Reanudar' : 'Ver de nuevo') : 'Pausar';
  }

  private async reproducirDesde(id: IdCapitulo, opciones: { preparar?: boolean; soloUno?: boolean } = {}): Promise<void> {
    const t = ++this.token;
    this.iniciado = true;
    this.reproduciendo = true;
    this.ponerPausa(false);
    try {
      for (const c of ORDEN.slice(ORDEN.indexOf(id))) {
        this.marcar(c);
        if (opciones.preparar !== false || c !== id) this.preparar(c);
        if (c === 'firma' && opciones.preparar === false) await this.firmar(t);
        else await this.capitulo(c, t);
        this.botones[ORDEN.indexOf(c)]?.classList.add('es-hecho');
        if (opciones.soloUno) break;
      }
      this.reproduciendo = false;
      this.app.classList.remove('con-cursor');
      this.ponerPausa(true);
    } catch (e) {
      if (!(e instanceof Cancelado)) throw e;
    }
  }

  // ───────────── Eventos ─────────────

  private enlazar(): void {
    this.botones.forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset['capitulo'] as IdCapitulo | undefined;
        if (id) void this.reproducirDesde(id);
      }),
    );

    this.pausa?.addEventListener('click', () => {
      if (!this.reproduciendo) {
        void this.reproducirDesde('agenda');
        return;
      }
      this.ponerPausa(!this.pausado);
    });

    this.seccion.querySelector('[data-control="reiniciar"]')?.addEventListener('click', () => void this.reproducirDesde('agenda'));

    const tema = this.seccion.querySelector<HTMLSelectElement>('[data-control="tema"]');
    tema?.addEventListener('change', () => {
      this.app.dataset['tema'] = tema.value;
    });

    // La nota responde a lo que escriba el médico; si toma el control, la reproducción se detiene.
    this.form.addEventListener('input', (ev) => {
      const objetivo = ev.target;
      if (objetivo instanceof HTMLInputElement && objetivo.name === 'buscarCie10') {
        const cie = this.campo('cie10');
        const dx = this.campo('diagnostico');
        if (cie) cie.value = '';
        if (dx) dx.value = '';
        if (ev.isTrusted) this.pintarCie10(objetivo.value);
      }
      this.actualizarNota();
      this.marcarBorrador();
    });

    this.form.addEventListener('focusin', (ev) => {
      if (!(ev.target instanceof HTMLElement) || !ev.target.matches('input, textarea')) return;
      if (this.reproduciendo) {
        this.token++;
        this.reproduciendo = false;
        this.app.classList.remove('con-cursor');
        this.ponerPausa(true);
      }
      this.narrar('Tu turno: borra o cambia algo y mira cómo responden el semáforo, el IMC y la búsqueda CIE-10.');
    });

    const entradaCie = this.campo('buscarCie10');
    entradaCie?.addEventListener('keydown', (ev) => {
      if (!(ev instanceof KeyboardEvent)) return;
      const lista = this.listaCie10();
      if (!lista || lista.hidden || this.resultados.length === 0) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const n = this.resultados.length;
        this.resaltado = (this.resaltado + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
        lista.querySelectorAll('button').forEach((b, i) => b.classList.toggle('es-resaltado', i === this.resaltado));
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const d = this.resultados[this.resaltado];
        if (d) this.elegirCie10(d);
      } else if (ev.key === 'Escape') {
        lista.hidden = true;
      }
    });
    entradaCie?.addEventListener('blur', () => {
      const lista = this.listaCie10();
      if (lista) window.setTimeout(() => (lista.hidden = true), 150);
    });

    this.form.addEventListener('submit', (ev) => ev.preventDefault());

    this.el('[data-accion="firmar"]')?.addEventListener('click', (ev) => {
      if (!ev.isTrusted) return;
      void this.reproducirDesde('firma', { preparar: false, soloUno: true });
    });

    this.cicloBorrador();
  }

  private vigilarVisibilidad(): void {
    const io = new IntersectionObserver(
      ([e]) => {
        this.visible = Boolean(e?.isIntersecting);
        if (this.visible && !this.iniciado && !this.reducido) void this.reproducirDesde('agenda');
      },
      { threshold: 0.35 },
    );
    io.observe(this.app);
  }
}

export function iniciarDemo(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-demo]').forEach((s) => new Demo(s));
}
