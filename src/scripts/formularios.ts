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

const AVISOS_GOOGLE: Record<string, string> = {
  cancelado: 'Se canceló el inicio con Google. Puede intentarlo de nuevo o registrarse con su correo.',
  error: 'No pudimos completar el inicio con Google. Intente de nuevo o regístrese con su correo.',
  'no-disponible': 'El inicio con Google se habilita muy pronto. Mientras tanto, regístrese con su correo.',
  espera: 'Recibimos varios intentos seguidos. Espere un minuto y vuelva a intentarlo.',
};

/** Registro con Google en curso: correo verificado y bloqueado, nombre sugerido, sin Turnstile. */
async function prepararGoogle(form: HTMLFormElement): Promise<boolean> {
  const raiz = form.closest('main') ?? document;
  const estadoGoogle = new URLSearchParams(window.location.search).get('google');
  const aviso = raiz.querySelector<HTMLElement>('[data-aviso-google]');
  if (estadoGoogle && estadoGoogle !== 'listo') {
    if (aviso && AVISOS_GOOGLE[estadoGoogle]) {
      aviso.textContent = AVISOS_GOOGLE[estadoGoogle] ?? '';
      aviso.classList.add('problema');
      aviso.hidden = false;
    }
    return false;
  }
  if (estadoGoogle !== 'listo') return false;
  try {
    const r = await fetch('/api/auth/sesion', { credentials: 'same-origin' });
    if (r.status !== 200) {
      if (aviso) {
        aviso.textContent = 'Su sesión con Google venció (duran 30 minutos). Pulse de nuevo «Continuar con Google».';
        aviso.classList.add('problema');
        aviso.hidden = false;
      }
      return false;
    }
    const { correo, nombre } = (await r.json()) as { correo: string; nombre: string };
    const campoCorreo = form.elements.namedItem('correo');
    const campoNombre = form.elements.namedItem('nombre');
    if (campoCorreo instanceof HTMLInputElement) {
      campoCorreo.value = correo;
      campoCorreo.readOnly = true;
    }
    if (campoNombre instanceof HTMLInputElement && !campoNombre.value) campoNombre.value = nombre;
    raiz.querySelector<HTMLElement>('[data-registro-rapido]')?.setAttribute('hidden', '');
    const conectado = raiz.querySelector<HTMLElement>('[data-conectado]');
    const correoVisible = raiz.querySelector<HTMLElement>('[data-conectado-correo]');
    if (correoVisible) correoVisible.textContent = correo;
    if (conectado) conectado.hidden = false;
    const nota = form.querySelector<HTMLElement>('[data-nota-correo]');
    if (nota) nota.textContent = 'Verificado por Google.';
    const texto = form.querySelector<HTMLElement>('[data-enviar-texto]');
    if (texto) texto.textContent = 'Completar y descargar';
    form.querySelector<HTMLButtonElement>('button[type="submit"]')?.removeAttribute('disabled');
    form.querySelector('[data-turnstile]')?.setAttribute('hidden', '');
    raiz.querySelector<HTMLButtonElement>('[data-usar-otro]')?.addEventListener('click', async () => {
      await fetch('/api/auth/salir', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
      window.location.assign('/fundadores');
    });
    (form.elements.namedItem('especialidad') as HTMLInputElement | null)?.focus();
    return true;
  } catch {
    return false;
  }
}

function iniciarFundadores(form: HTMLFormElement): void {
  let conGoogle = false;
  void prepararGoogle(form).then((v) => {
    conGoogle = v;
  });
  const turnstile = prepararTurnstile(form, 'lead', () => enviarEvento('formulario_iniciado'));
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(form);
    if (!form.reportValidity()) return;
    if (boton) boton.disabled = true;
    estado(form, 'Enviando…');
    try {
      // Con Google el servidor no pide Turnstile: la identidad ya está probada.
      const widget = conGoogle ? null : await turnstile();
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
        credentials: 'same-origin',
        body: JSON.stringify(cuerpo),
      });
      if (respuesta.status === 201) {
        const { destino } = (await respuesta.json().catch(() => ({}))) as { destino?: string };
        // Con Google: directo a la instalación guiada (o a gracias si aún no hay instalador publicado).
        if (destino && destino.startsWith('/')) {
          estado(form, 'Listo. Abriendo su instalación guiada…');
          window.location.assign(destino);
          return;
        }
        const listo = form.parentElement?.querySelector<HTMLElement>('[data-enviado]');
        if (listo) {
          form.hidden = true;
          listo.hidden = false;
          listo.focus();
        } else {
          estado(form, 'Listo. Revise su correo para confirmar su registro.');
        }
        return;
      }
      widget?.reiniciar();
      if (respuesta.status === 429) {
        estado(form, 'Recibimos varios envíos seguidos. Espere un minuto y vuelva a intentarlo.', 'error');
        return;
      }
      const error = (await respuesta.json().catch(() => ({}))) as RespuestaError;
      if (error.campos && Object.keys(error.campos).length) {
        pintarErrores(form, error.campos);
        estado(form, 'Faltan o no cuadran algunos datos: los marcamos abajo de cada campo.', 'error');
      } else {
        estado(form, 'No pudimos enviar su registro. Intente de nuevo o escríbanos por WhatsApp.', 'error');
      }
    } catch {
      estado(form, 'Sin conexión. Revise su internet e intente de nuevo.', 'error');
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
          `Recibimos su solicitud (folio ${folio}). Le responderemos al correo que escribió en un máximo de 20 días hábiles; antes podemos pedirle confirmar su identidad.`,
        );
        return;
      }
      widget?.reiniciar();
      const error = (await respuesta.json().catch(() => ({}))) as RespuestaError;
      if (error.campos && Object.keys(error.campos).length) pintarErrores(form, error.campos);
      estado(form, respuesta.status === 429 ? 'Espere un minuto y vuelva a intentarlo.' : 'Revise los datos e intente de nuevo.', 'error');
    } catch {
      estado(form, 'Sin conexión. Revise su internet e intente de nuevo.', 'error');
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
        const { destino } = (await r.json().catch(() => ({}))) as { destino?: string };
        window.location.assign(destino && destino.startsWith('/') ? destino : '/fundadores/gracias');
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

/** Windows de escritorio: donde sí se instala InmutalKey. Solo se mira en el navegador; nada se envía. */
function esWindows(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  if (nav.userAgentData?.platform) return nav.userAgentData.platform === 'Windows' && !nav.userAgentData.mobile;
  return /Windows NT/i.test(navigator.userAgent);
}

interface Vigente {
  readonly version: string;
  readonly nombre_archivo: string;
  readonly sha256: string;
  readonly tamano_bytes: number | null;
  readonly vigente: boolean;
}

/** Datos de la versión vigente (nombre, tamaño y huella) desde el panel; si falla, quedan los del build. */
async function pintarVersion(raiz: HTMLElement): Promise<void> {
  try {
    const r = await fetch('/api/versiones');
    if (!r.ok) return;
    const vigente = ((await r.json()) as Vigente[]).find((v) => v.vigente);
    if (!vigente) return;
    const poner = (selector: string, texto: string): void => {
      raiz.querySelectorAll<HTMLElement>(selector).forEach((n) => {
        n.textContent = texto;
      });
    };
    poner('[data-version]', vigente.version);
    poner('[data-archivo]', vigente.nombre_archivo);
    if (vigente.tamano_bytes) poner('[data-tamano]', `${(vigente.tamano_bytes / 1_048_576).toFixed(0)} MB`);
    poner('[data-huella]', vigente.sha256.toUpperCase());
    const comando = raiz.querySelector('#comando-huella');
    if (comando) comando.textContent = `Get-FileHash "$env:USERPROFILE\\Downloads\\${vigente.nombre_archivo}" -Algorithm SHA256`;
  } catch {
    // Sin conexión: quedan los datos del build.
  }
}

function iniciarDescarga(raiz: HTMLElement): void {
  void pintarVersion(raiz);
  const token = tokenDelFragmento();
  const form = raiz.querySelector<HTMLFormElement>('form[data-descarga]');
  const campo = form?.querySelector<HTMLInputElement>('input[name="token"]');
  const vencido = new URLSearchParams(window.location.search).get('estado') === 'vencido';
  if (!token || !form || !campo) {
    raiz.querySelectorAll<HTMLElement>('[data-motivo]').forEach((p) => {
      p.hidden = p.dataset.motivo !== (vencido ? 'vencido' : 'sin-token');
    });
    mostrar(raiz, 'sin-enlace');
    return;
  }
  campo.value = token;
  mostrar(raiz, esWindows() ? 'descargar' : 'movil');

  raiz.querySelector<HTMLButtonElement>('[data-forzar]')?.addEventListener('click', () => mostrar(raiz, 'descargar'));

  const aMiCorreo = raiz.querySelector<HTMLButtonElement>('[data-a-mi-correo]');
  aMiCorreo?.addEventListener('click', async () => {
    aMiCorreo.disabled = true;
    try {
      const r = await fetch('/api/descarga/a-mi-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (r.ok) {
        const { correo } = (await r.json()) as { correo: string };
        const destino = raiz.querySelector('[data-correo-enmascarado]');
        if (destino) destino.textContent = correo;
        mostrar(raiz, 'enviado');
        return;
      }
      if (r.status === 410) {
        mostrar(raiz, 'sin-enlace');
        return;
      }
      aMiCorreo.disabled = false;
    } catch {
      aMiCorreo.disabled = false;
    }
  });

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
        raiz.querySelector<HTMLElement>('[data-paso="iniciada"]')?.focus();
        return;
      }
      // El enlace es de un solo uso: si ya se gastó o venció, se ofrece pedir otro.
      if (r.status === 410) {
        raiz.querySelectorAll<HTMLElement>('[data-motivo]').forEach((p) => {
          p.hidden = p.dataset.motivo !== 'vencido';
        });
        mostrar(raiz, 'sin-enlace');
        return;
      }
      mostrar(raiz, 'error');
    } catch {
      mostrar(raiz, 'error');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

function iniciarReenviar(form: HTMLFormElement): void {
  const turnstile = prepararTurnstile(form, 'reenviar');
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(form);
    if (!form.reportValidity()) return;
    if (boton) boton.disabled = true;
    estado(form, 'Enviando…');
    try {
      const token = await esperarToken(await turnstile());
      const correo = String(new FormData(form).get('correo') ?? '');
      const r = await fetch('/api/descarga/reenviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, ...(token ? { turnstile: token } : {}) }),
      });
      if (r.status === 202) {
        form.reset();
        estado(form, 'Si ese correo está registrado y confirmado, en un minuto le llega su enlace nuevo. Revise también correo no deseado.');
        return;
      }
      const error = (await r.json().catch(() => ({}))) as RespuestaError;
      if (error.campos && Object.keys(error.campos).length) pintarErrores(form, error.campos);
      estado(form, r.status === 429 ? 'Espere un minuto y vuelva a intentarlo.' : 'Revise el correo e intente de nuevo.', 'error');
    } catch {
      estado(form, 'Sin conexión. Revise su internet e intente de nuevo.', 'error');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

/** Botones «Copiar» (comando y huella). Sin API del portapapeles quedan ocultos y el texto se selecciona a mano. */
function iniciarCopiar(raiz: ParentNode): void {
  if (!navigator.clipboard) return;
  const aviso = raiz.querySelector<HTMLElement>('[data-copiar-aviso]');
  raiz.querySelectorAll<HTMLButtonElement>('button[data-copiar]').forEach((boton) => {
    const origen = document.getElementById(boton.dataset.copiar ?? '');
    const etiqueta = boton.querySelector<HTMLElement>('[data-copiar-texto]');
    if (!origen) return;
    boton.hidden = false;
    boton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(origen.textContent?.trim() ?? '');
        if (etiqueta) etiqueta.textContent = 'Copiado';
        if (aviso) aviso.textContent = 'Copiado al portapapeles';
        window.setTimeout(() => {
          if (etiqueta) etiqueta.textContent = 'Copiar';
        }, 2000);
      } catch {
        // Permiso denegado: el texto sigue a la vista para copiarlo a mano.
      }
    });
  });
}

function iniciarGracias(raiz: HTMLElement): void {
  const estadoGracias = new URLSearchParams(window.location.search).get('estado') ?? 'normal';
  const valido = ['normal', 'pronto', 'limite'].includes(estadoGracias) ? estadoGracias : 'normal';
  raiz.querySelectorAll<HTMLElement>('[data-estado-gracias]').forEach((p) => {
    p.hidden = p.dataset.estadoGracias !== valido;
  });
}

async function iniciarCupo(nodo: HTMLElement): Promise<void> {
  try {
    const r = await fetch('/api/fundadores/cupo');
    if (!r.ok) return;
    const { total, restantes } = (await r.json()) as { total: number; restantes: number };
    if (total <= 0) return;
    nodo.textContent = restantes > 0 ? `Quedan ${restantes} de ${total} lugares de fundador.` : 'Los lugares de fundador se agotaron. Regístrese para la lista de espera.';
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
  raiz.querySelectorAll<HTMLElement>('[data-pagina-descarga]').forEach((n) => {
    iniciarDescarga(n);
    iniciarCopiar(n);
  });
  raiz.querySelectorAll<HTMLFormElement>('form[data-formulario="reenviar"]').forEach(iniciarReenviar);
  raiz.querySelectorAll<HTMLElement>('[data-gracias]').forEach(iniciarGracias);
  raiz.querySelectorAll<HTMLElement>('[data-cupo]').forEach((n) => void iniciarCupo(n));
  raiz.querySelectorAll<HTMLElement>('[data-testimonios-vivos]').forEach((n) => void iniciarTestimonios(n));
  raiz.querySelectorAll<HTMLElement>('[data-versiones-vivas]').forEach((n) => void iniciarVersiones(n));
}
