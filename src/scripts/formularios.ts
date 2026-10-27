// Formularios que hablan con la API: registro a Fundadores y solicitud de derechos ARCO. Mejora progresiva:
// la validación nativa del navegador avisa lo básico y el Worker decide; sus errores se pintan junto a cada campo.

import { enviarEvento, origenActual } from './eventos';
import { montarTurnstile, type Widget } from './turnstile';

interface RespuestaError {
  readonly error?: string;
  readonly campos?: Record<string, string>;
}

function limpiarErrores(form: HTMLFormElement): void {
  form.querySelectorAll('[data-error-de]').forEach((n) => n.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((n) => n.removeAttribute('aria-invalid'));
}

function pintarErrores(form: HTMLFormElement, campos: Record<string, string>): void {
  let primero: HTMLElement | null = null;
  for (const [nombre, mensaje] of Object.entries(campos)) {
    const control = form.elements.namedItem(nombre);
    const nodo = control instanceof RadioNodeList ? (control[0] as HTMLElement | undefined) : (control as HTMLElement | null);
    const ancla = nodo?.closest('.campo, .casilla, fieldset') ?? form.querySelector('[data-estado]');
    const aviso = document.createElement('small');
    aviso.className = 'campo-error';
    aviso.dataset.errorDe = nombre;
    aviso.textContent = mensaje;
    if (nodo && 'setAttribute' in nodo) {
      nodo.setAttribute('aria-invalid', 'true');
      aviso.id = `error-${nombre}`;
      nodo.setAttribute('aria-describedby', aviso.id);
    }
    ancla?.append(aviso);
    primero ??= nodo ?? null;
  }
  primero?.focus();
}

function estado(form: HTMLFormElement, texto: string, tipo: 'info' | 'error' = 'info'): void {
  const nodo = form.querySelector<HTMLElement>('[data-estado]');
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.dataset.tipo = tipo;
}

function prepararTurnstile(form: HTMLFormElement, accion: string, alEmpezar?: () => void): () => Promise<Widget | null> {
  const sitekey = form.dataset.sitekey;
  const contenedor = form.querySelector<HTMLElement>('[data-turnstile]');
  let widget: Promise<Widget | null> | null = null;
  const montar = (): Promise<Widget | null> => {
    if (!sitekey || !contenedor) return Promise.resolve(null);
    widget ??= montarTurnstile(contenedor, sitekey, accion).catch(() => {
      widget = null;
      return null;
    });
    return widget;
  };
  form.addEventListener(
    'focusin',
    () => {
      alEmpezar?.();
      void montar();
    },
    { once: true },
  );
  return montar;
}

/** Espera hasta ~8 s a que Turnstile entregue el token (el reto suele resolverse solo, sin que la persona haga nada). */
async function esperarToken(widget: Widget | null): Promise<string | undefined> {
  if (!widget) return undefined;
  for (let i = 0; i < 40; i++) {
    const token = widget.token();
    if (token) return token;
    await new Promise((r) => setTimeout(r, 200));
  }
  return undefined;
}

function iniciarFundadores(form: HTMLFormElement): void {
  const turnstile = prepararTurnstile(form, 'lead', () => enviarEvento('formulario_iniciado'));
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(form);
    if (!form.reportValidity()) return;
    if (boton) boton.disabled = true;
    estado(form, 'Enviando…');
    try {
      const widget = await turnstile();
      const token = await esperarToken(widget);
      const datos = new FormData(form);
      const texto = (n: string): string => String(datos.get(n) ?? '');
      const origen = origenActual();
      const cuerpo = {
        nombre: texto('nombre'),
        correo: texto('correo'),
        telefono: texto('telefono'),
        especialidad: texto('especialidad'),
        estado: texto('estado'),
        ciudad: texto('ciudad'),
        tipo_practica: texto('tipo_practica'),
        pacientes_semana_rango: texto('pacientes_semana_rango'),
        so: texto('so'),
        como_se_entero: texto('como_se_entero'),
        usa_hoy: texto('usa_hoy'),
        consentimiento: datos.get('consentimiento') === 'on',
        version_aviso: form.dataset.versionAviso ?? '',
        sitio_web: texto('sitio_web'),
        ...origen,
        ...(token ? { turnstile: token } : {}),
      };
      const respuesta = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      if (respuesta.status === 201) {
        const listo = form.parentElement?.querySelector<HTMLElement>('[data-enviado]');
        if (listo) {
          form.hidden = true;
          listo.hidden = false;
          listo.focus();
        } else {
          estado(form, 'Listo. Revisa tu correo para confirmar tu registro.');
        }
        return;
      }
      widget?.reiniciar();
      if (respuesta.status === 429) {
        estado(form, 'Recibimos varios envíos seguidos. Espera un minuto y vuelve a intentarlo.', 'error');
        return;
      }
      const error = (await respuesta.json().catch(() => ({}))) as RespuestaError;
      if (error.campos && Object.keys(error.campos).length) {
        pintarErrores(form, error.campos);
        estado(form, 'Revisa los campos marcados.', 'error');
      } else {
        estado(form, 'No pudimos enviar tu registro. Intenta de nuevo o escríbenos por WhatsApp.', 'error');
      }
    } catch {
      estado(form, 'Sin conexión. Revisa tu internet e intenta de nuevo.', 'error');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

function iniciarArco(form: HTMLFormElement): void {
  const turnstile = prepararTurnstile(form, 'arco');
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(form);
    if (!form.reportValidity()) return;
    if (boton) boton.disabled = true;
    estado(form, 'Enviando…');
    try {
      const widget = await turnstile();
      const token = await esperarToken(widget);
      const datos = new FormData(form);
      const respuesta = await fetch('/api/arco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: String(datos.get('correo') ?? ''),
          tipo: String(datos.get('tipo') ?? ''),
          detalle: String(datos.get('detalle') ?? ''),
          sitio_web: String(datos.get('sitio_web') ?? ''),
          ...(token ? { turnstile: token } : {}),
        }),
      });
      if (respuesta.status === 201) {
        const { folio } = (await respuesta.json()) as { folio: number };
        form.reset();
        estado(
          form,
          `Recibimos tu solicitud (folio ${folio}). Te responderemos al correo que escribiste en un máximo de 20 días hábiles; antes podemos pedirte confirmar tu identidad.`,
        );
        return;
      }
      widget?.reiniciar();
      const error = (await respuesta.json().catch(() => ({}))) as RespuestaError;
      if (error.campos && Object.keys(error.campos).length) pintarErrores(form, error.campos);
      estado(form, respuesta.status === 429 ? 'Espera un minuto y vuelve a intentarlo.' : 'Revisa los datos e intenta de nuevo.', 'error');
    } catch {
      estado(form, 'Sin conexión. Revisa tu internet e intenta de nuevo.', 'error');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

/** Lee el token del fragmento (#t=…) y lo borra de la barra y del historial. */
function tokenDelFragmento(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
  if (window.location.hash) history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function mostrar(raiz: ParentNode, nombre: string): void {
  raiz.querySelectorAll<HTMLElement>('[data-paso]').forEach((p) => {
    p.hidden = p.dataset.paso !== nombre;
  });
}

function iniciarConfirmacion(raiz: HTMLElement): void {
  if (new URLSearchParams(window.location.search).get('estado') === 'vencido') {
    mostrar(raiz, 'vencido');
    return;
  }
  const token = tokenDelFragmento();
  if (!token) {
    mostrar(raiz, 'vencido');
    return;
  }
  mostrar(raiz, 'confirmar');
  const boton = raiz.querySelector<HTMLButtonElement>('[data-confirmar]');
  boton?.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      const r = await fetch('/api/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (r.ok) {
        window.location.assign('/fundadores/gracias');
        return;
      }
      mostrar(raiz, r.status === 410 ? 'vencido' : 'error');
    } catch {
      mostrar(raiz, 'error');
    } finally {
      boton.disabled = false;
    }
  });
}

function iniciarDescarga(raiz: HTMLElement): void {
  const token = tokenDelFragmento();
  const form = raiz.querySelector<HTMLFormElement>('form[data-descarga]');
  const campo = form?.querySelector<HTMLInputElement>('input[name="token"]');
  if (!token || !form || !campo) {
    mostrar(raiz, 'vencido');
    return;
  }
  campo.value = token;
  mostrar(raiz, 'descargar');
  const boton = form.querySelector<HTMLButtonElement>('button');
  form.addEventListener('submit', async (e) => {
    // fetch + navegación en lugar del envío normal: la CSP (form-action 'self') bloquearía la redirección a R2.
    e.preventDefault();
    if (boton) boton.disabled = true;
    try {
      const r = await fetch('/api/descarga', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (r.ok) {
        const { url } = (await r.json()) as { url: string };
        window.location.assign(url);
        mostrar(raiz, 'iniciada');
        return;
      }
      // El enlace es de un solo uso: si ya se gastó o venció, no hay reintento posible desde aquí.
      mostrar(raiz, r.status === 410 ? 'vencido' : 'descargar');
      if (r.status !== 410 && boton) boton.disabled = false;
    } catch {
      if (boton) boton.disabled = false;
    }
  });
}

async function iniciarCupo(nodo: HTMLElement): Promise<void> {
  try {
    const r = await fetch('/api/fundadores/cupo');
    if (!r.ok) return;
    const { total, restantes } = (await r.json()) as { total: number; restantes: number };
    if (total <= 0) return;
    nodo.textContent = restantes > 0 ? `Quedan ${restantes} de ${total} lugares de fundador.` : 'Los lugares de fundador se agotaron. Regístrate para la lista de espera.';
    nodo.hidden = false;
  } catch {
    // Sin dato: no se muestra.
  }
}

interface Testimonio {
  readonly nombre: string;
  readonly especialidad: string;
  readonly ciudad: string;
  readonly texto: string;
}

/** Testimonios aprobados en el panel: se pintan con textContent dentro de la banda reservada (oculta si no hay). */
async function iniciarTestimonios(banda: HTMLElement): Promise<void> {
  const lista = banda.querySelector('[data-lista]');
  if (!lista) return;
  try {
    const r = await fetch('/api/testimonios');
    if (!r.ok) return;
    const testimonios = (await r.json()) as Testimonio[];
    if (!testimonios.length) return;
    lista.replaceChildren(
      ...testimonios.slice(0, 12).map((t) => {
        const li = document.createElement('li');
        li.className = 'testimonio';
        const cita = document.createElement('blockquote');
        cita.textContent = t.texto;
        const autor = document.createElement('p');
        autor.className = 'testimonio-autor';
        const nombre = document.createElement('strong');
        nombre.textContent = t.nombre;
        const detalle = document.createElement('span');
        detalle.textContent = `${t.especialidad} · ${t.ciudad}`;
        autor.append(nombre, detalle);
        li.append(cita, autor);
        return li;
      }),
    );
    banda.hidden = false;
  } catch {
    // Sin testimonios: la banda sigue oculta.
  }
}

interface VersionPublica {
  readonly version: string;
  readonly nombre_archivo: string;
  readonly sha256: string;
  readonly vigente: boolean;
}

/** /verificar: huellas oficiales registradas en el panel (GET /api/versiones). */
async function iniciarVersiones(caja: HTMLElement): Promise<void> {
  const lista = caja.querySelector('[data-lista]');
  if (!lista) return;
  try {
    const r = await fetch('/api/versiones');
    if (!r.ok) return;
    const versiones = (await r.json()) as VersionPublica[];
    if (!versiones.length) return;
    lista.replaceChildren(
      ...versiones.map((v) => {
        const li = document.createElement('li');
        const titulo = document.createElement('strong');
        titulo.textContent = `${v.version}${v.vigente ? ' (vigente)' : ''}`;
        const archivo = document.createTextNode(` · ${v.nombre_archivo} · SHA-256: `);
        const huella = document.createElement('code');
        huella.className = 'huella-viva';
        huella.textContent = v.sha256.toUpperCase();
        li.append(titulo, archivo, huella);
        return li;
      }),
    );
    caja.hidden = false;
  } catch {
    // Sin conexión: queda la huella del build (si existe) o la invitación a pedirla.
  }
}

export function iniciarFormularios(raiz: Document): void {
  raiz.querySelectorAll<HTMLFormElement>('form[data-formulario="fundadores"]').forEach(iniciarFundadores);
  raiz.querySelectorAll<HTMLFormElement>('form[data-formulario="arco"]').forEach(iniciarArco);
  raiz.querySelectorAll<HTMLElement>('[data-confirmacion]').forEach(iniciarConfirmacion);
  raiz.querySelectorAll<HTMLElement>('[data-pagina-descarga]').forEach(iniciarDescarga);
  raiz.querySelectorAll<HTMLElement>('[data-cupo]').forEach((n) => void iniciarCupo(n));
  raiz.querySelectorAll<HTMLElement>('[data-testimonios-vivos]').forEach((n) => void iniciarTestimonios(n));
  raiz.querySelectorAll<HTMLElement>('[data-versiones-vivas]').forEach((n) => void iniciarVersiones(n));
}
