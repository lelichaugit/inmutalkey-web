// Panel /admin (solo para Alan). Habla con /api/admin/* y arma la interfaz con nodos y textContent: los datos que
// escribieron los médicos nunca se interpretan como HTML.

import type { FilaLead } from '../worker/rutas/admin';

type Hijo = Node | string | number | null | undefined | false;

function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  atributos: Record<string, string | boolean | undefined> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false) continue;
    nodo.setAttribute(nombre, valor === true ? '' : valor);
  }
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(typeof hijo === 'string' || typeof hijo === 'number' ? String(hijo) : hijo);
  }
  return nodo;
}

const fecha = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' }) : '—';

const porcentaje = (parte: number, total: number): string => (total > 0 ? `${Math.round((parte / total) * 100)} %` : '—');

class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(`/api/admin${ruta}`, {
    method: opciones.metodo ?? 'GET',
    credentials: 'same-origin',
    headers: opciones.cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(opciones.cuerpo === undefined ? {} : { body: JSON.stringify(opciones.cuerpo) }),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as { mensaje?: string; error?: string; campos?: Record<string, string> };
  if (!respuesta.ok) {
    const detalle = datos.campos ? Object.entries(datos.campos).map(([c, m]) => `${c}: ${m}`).join(' · ') : '';
    throw new ErrorApi(respuesta.status, datos.mensaje ?? (detalle || datos.error) ?? `Error ${respuesta.status}`);
  }
  return datos as T;
}

export function iniciarPanel(raiz: Document): void {
  const $ = <T extends Element>(selector: string): T => {
    const nodo = raiz.querySelector<T>(selector);
    if (!nodo) throw new Error(`Falta ${selector}`);
    return nodo;
  };
  const aviso = $<HTMLElement>('[data-aviso]');

  function avisar(texto: string, error = false): void {
    aviso.textContent = texto;
    aviso.classList.toggle('error', error);
    aviso.hidden = false;
    window.setTimeout(() => {
      if (aviso.textContent === texto) aviso.hidden = true;
    }, 6000);
  }

  async function intentar(accion: () => Promise<void>, boton?: HTMLButtonElement): Promise<void> {
    if (boton) boton.disabled = true;
    try {
      await accion();
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'Algo salió mal', true);
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  // ── Pestañas ──
  const cargadores: Record<string, () => Promise<void>> = {};
  for (const boton of raiz.querySelectorAll<HTMLButtonElement>('[data-pestana]')) {
    boton.addEventListener('click', () => {
      const nombre = boton.dataset.pestana ?? '';
      for (const b of raiz.querySelectorAll<HTMLButtonElement>('[data-pestana]')) b.setAttribute('aria-pressed', String(b === boton));
      for (const s of raiz.querySelectorAll<HTMLElement>('[data-seccion]')) s.hidden = s.dataset.seccion !== nombre;
      const cargar = cargadores[nombre];
      if (cargar) void intentar(cargar);
    });
  }

  // ── Sesión ──
  void intentar(async () => {
    const { correo } = await api<{ correo: string }>('/sesion');
    $('[data-sesion]').textContent = `Sesión: ${correo}`;
  });

  // ── Métricas ──
  const formMetricas = $<HTMLFormElement>('[data-form-metricas]');
  interface Metricas {
    rango: { desde: string; hasta: string };
    visitasWebAnalytics: number | null;
    embudo: { fuente: string; visitas: number; iniciados: number; enviados: number; confirmados: number; prueba: number; cliente: number }[];
    totales: { visitas: number; iniciados: number; enviados: number; confirmados: number; prueba: number; cliente: number };
    primerContacto: { horasPromedio: number | null; leads: number };
    whatsapp: { prueba: number; fundadores: number; general: number };
    demos: number;
    faq: { id: string; pregunta: string; aperturas: number }[];
    descargas: { version: string; generadas: number; usadas: number }[];
    arcoPendientes: { folio: number; tipo: string; diasHabiles: number }[];
  }

  cargadores.metricas = async () => {
    const datos = new FormData(formMetricas);
    const consulta = new URLSearchParams();
    for (const campo of ['desde', 'hasta']) {
      const valor = datos.get(campo);
      if (typeof valor === 'string' && valor) consulta.set(campo, valor);
    }
    const m = await api<Metricas>(`/metricas?${consulta}`);
    (formMetricas.elements.namedItem('desde') as HTMLInputElement).value = m.rango.desde;
    (formMetricas.elements.namedItem('hasta') as HTMLInputElement).value = m.rango.hasta;

    const t = m.totales;
    const tarjeta = (valor: string | number, texto: string, alerta = false) =>
      el('div', { class: alerta ? 'panel-tarjeta alerta' : 'panel-tarjeta' }, el('strong', {}, valor), el('span', {}, texto));
    const arcoUrgente = m.arcoPendientes.some((a) => a.diasHabiles >= 15);
    $('[data-metricas-tarjetas]').replaceChildren(
      tarjeta(m.visitasWebAnalytics ?? '—', 'Visitas (Web Analytics)'),
      tarjeta(t.visitas, 'Páginas vistas (sitio)'),
      tarjeta(t.enviados, `Leads · ${porcentaje(t.enviados, t.visitas)} de las visitas`),
      tarjeta(t.confirmados, `Confirmados · ${porcentaje(t.confirmados, t.enviados)}`),
      tarjeta(t.prueba, `En prueba o clientes · ${porcentaje(t.prueba, t.confirmados)}`),
      tarjeta(t.cliente, `Clientes · ${porcentaje(t.cliente, t.prueba)} de las pruebas`),
      tarjeta(
        m.primerContacto.horasPromedio === null ? '—' : `${m.primerContacto.horasPromedio} h`,
        `Tiempo promedio a primer contacto (${m.primerContacto.leads} leads)`,
      ),
      tarjeta(m.whatsapp.prueba + m.whatsapp.fundadores + m.whatsapp.general, `Clics a WhatsApp (${m.whatsapp.fundadores} Fundadores)`),
      tarjeta(m.demos, 'Simulador iniciado'),
      tarjeta(m.arcoPendientes.length, 'Solicitudes ARCO abiertas', arcoUrgente),
    );

    const columnas = ['Origen', 'Visitas', 'Iniciaron', 'Enviaron', 'Confirmaron', 'Prueba', 'Cliente', 'Visita → cliente'];
    $('[data-tabla-embudo]').replaceChildren(
      el('thead', {}, el('tr', {}, ...columnas.map((c, i) => el('th', { class: i ? 'numero' : undefined }, c)))),
      el(
        'tbody',
        {},
        ...[...m.embudo, { fuente: 'total', ...t }].map((f) =>
          el(
            'tr',
            {},
            el('td', {}, f.fuente === 'tarjeta' ? 'tarjeta (QR)' : f.fuente),
            ...[f.visitas, f.iniciados, f.enviados, f.confirmados, f.prueba, f.cliente].map((n) => el('td', { class: 'numero' }, n)),
            el('td', { class: 'numero' }, porcentaje(f.cliente, f.visitas)),
          ),
        ),
      ),
    );

    $('[data-tabla-faq]').replaceChildren(
      el('thead', {}, el('tr', {}, el('th', {}, 'Pregunta'), el('th', { class: 'numero' }, 'Aperturas'))),
      el(
        'tbody',
        {},
        ...(m.faq.length ? m.faq : [{ id: '', pregunta: 'Sin datos en el periodo', aperturas: 0 }]).map((f) =>
          el('tr', {}, el('td', { class: 'envolver' }, f.pregunta), el('td', { class: 'numero' }, f.aperturas)),
        ),
      ),
    );

    $('[data-tabla-descargas]').replaceChildren(
      el('thead', {}, el('tr', {}, el('th', {}, 'Versión'), el('th', { class: 'numero' }, 'Enlaces'), el('th', { class: 'numero' }, 'Descargadas'))),
      el(
        'tbody',
        {},
        ...(m.descargas.length ? m.descargas : [{ version: 'Sin datos en el periodo', generadas: 0, usadas: 0 }]).map((d) =>
          el('tr', {}, el('td', {}, d.version), el('td', { class: 'numero' }, d.generadas), el('td', { class: 'numero' }, d.usadas)),
        ),
      ),
    );
  };

  formMetricas.addEventListener('submit', (e) => {
    e.preventDefault();
    void intentar(cargadores.metricas ?? (async () => undefined));
  });

  // ── Leads ──
  const formLeads = $<HTMLFormElement>('[data-form-leads]');
  let paginaLeads = 1;

  function consultaLeads(): URLSearchParams {
    const consulta = new URLSearchParams();
    for (const [clave, valor] of new FormData(formLeads)) if (typeof valor === 'string' && valor.trim()) consulta.set(clave, valor.trim());
    return consulta;
  }

  function filaDetalle(lead: FilaLead, columnas: number): HTMLTableRowElement {
    const campos: [string, string][] = [
      ['Correo', lead.correo],
      ['Teléfono', lead.telefono ?? '—'],
      ['Estado', lead.estado],
      ['Dónde consulta', lead.tipo_practica],
      ['Pacientes por semana', lead.pacientes_semana_rango],
      ['Sistema', lead.so],
      ['Cómo se enteró', lead.como_se_entero],
      ['Qué usa hoy', lead.usa_hoy],
      ['UTM', [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ')],
      ['Aviso aceptado', `${lead.version_aviso} · ${fecha(lead.consentimiento_utc)}`],
      ['Confirmó correo', fecha(lead.confirmado_utc)],
      ['Primer contacto', fecha(lead.primer_contacto_utc)],
      ['Estatus desde', fecha(lead.estatus_utc)],
    ];
    const notas = el('textarea', { rows: '3', maxlength: '4000', class: 'panel-ancho' }) as HTMLTextAreaElement;
    notas.value = lead.notas_internas;
    const guardar = el('button', { type: 'button' }, 'Guardar notas');
    guardar.addEventListener('click', () =>
      void intentar(async () => {
        await api(`/leads/${lead.id}`, { metodo: 'PATCH', cuerpo: { notas_internas: notas.value } });
        avisar('Notas guardadas');
      }, guardar),
    );
    const borrar = el('button', { type: 'button', class: 'peligro' }, 'Borrar definitivamente');
    borrar.addEventListener('click', () => {
      if (!window.confirm(`¿Borrar a ${lead.nombre} y todo lo relacionado? Úsalo para una cancelación ARCO. No se puede deshacer.`)) return;
      void intentar(async () => {
        await api(`/leads/${lead.id}`, { metodo: 'DELETE', cuerpo: {} });
        avisar('Lead borrado');
        await cargarLeads();
      }, borrar);
    });
    return el(
      'tr',
      { class: 'detalle' },
      el(
        'td',
        { colspan: String(columnas) },
        el('dl', { class: 'panel-detalle' }, ...campos.flatMap(([t, v]) => [el('dt', {}, t), el('dd', {}, v)])),
        el('label', {}, 'Notas internas', notas),
        el('div', { class: 'panel-acciones' }, guardar, borrar),
      ),
    );
  }

  async function cargarLeads(): Promise<void> {
    const consulta = consultaLeads();
    consulta.set('pagina', String(paginaLeads));
    const datos = await api<{ leads: FilaLead[]; total: number; pagina: number; porPagina: number }>(`/leads?${consulta}`);
    const exportar = consultaLeads();
    $<HTMLAnchorElement>('[data-exportar]').href = `/api/admin/leads.csv${exportar.size ? `?${exportar}` : ''}`;
    $('[data-leads-total]').textContent = `${datos.total} lead(s)`;

    const encabezados = ['#', 'Registro', 'Nombre', 'Especialidad', 'Ciudad', 'Origen', 'Correo', 'Estatus', ''];
    const cuerpo = el('tbody');
    for (const lead of datos.leads) {
      const selector = el('select', { 'aria-label': `Estatus de ${lead.nombre}` }) as HTMLSelectElement;
      for (const e of ['nuevo', 'contactado', 'prueba', 'cliente', 'descartado']) selector.append(el('option', { value: e }, e));
      selector.value = lead.estatus;
      selector.addEventListener('change', () =>
        void intentar(async () => {
          await api(`/leads/${lead.id}`, { metodo: 'PATCH', cuerpo: { estatus: selector.value } });
          avisar(`${lead.nombre}: ${selector.value}`);
        }),
      );

      const aprobar = el('button', { type: 'button', disabled: !lead.confirmado_utc }, 'Aprobar prueba');
      aprobar.title = lead.confirmado_utc ? 'Envía el enlace de descarga (72 h, un solo uso)' : 'Aún no confirma su correo';
      aprobar.addEventListener('click', () => {
        if (!window.confirm(`¿Enviar a ${lead.correo} su enlace de descarga?`)) return;
        void intentar(async () => {
          const r = await api<{ version: string; expira_utc: string }>(`/leads/${lead.id}/aprobar-prueba`, { metodo: 'POST', cuerpo: {} });
          avisar(`Enlace de la versión ${r.version} enviado; vence ${fecha(r.expira_utc)}`);
          await cargarLeads();
        }, aprobar);
      });

      const ver = el('button', { type: 'button', 'aria-expanded': 'false' }, 'Detalles');
      const fila = el(
        'tr',
        {},
        el('td', { class: 'numero' }, lead.id),
        el('td', {}, fecha(lead.creado_utc)),
        el('td', {}, lead.nombre),
        el('td', {}, lead.especialidad),
        el('td', {}, `${lead.ciudad}, ${lead.estado}`),
        el('td', {}, lead.utm_source),
        el('td', { class: lead.confirmado_utc ? 'si' : 'no' }, lead.confirmado_utc ? 'Confirmado' : 'Pendiente'),
        el('td', {}, selector),
        el('td', {}, el('div', { class: 'panel-acciones' }, aprobar, ver)),
      );
      let detalle: HTMLTableRowElement | null = null;
      ver.addEventListener('click', () => {
        if (detalle) {
          detalle.remove();
          detalle = null;
          ver.setAttribute('aria-expanded', 'false');
        } else {
          detalle = filaDetalle(lead, encabezados.length);
          fila.after(detalle);
          ver.setAttribute('aria-expanded', 'true');
        }
      });
      cuerpo.append(fila);
    }
    if (!datos.leads.length) cuerpo.append(el('tr', {}, el('td', { colspan: String(encabezados.length) }, 'Sin resultados')));
    $('[data-tabla-leads]').replaceChildren(el('thead', {}, el('tr', {}, ...encabezados.map((h) => el('th', {}, h)))), cuerpo);

    const paginas = Math.max(1, Math.ceil(datos.total / datos.porPagina));
    const anterior = el('button', { type: 'button', disabled: paginaLeads <= 1 }, 'Anterior');
    const siguiente = el('button', { type: 'button', disabled: paginaLeads >= paginas }, 'Siguiente');
    anterior.addEventListener('click', () => {
      paginaLeads--;
      void intentar(cargarLeads);
    });
    siguiente.addEventListener('click', () => {
      paginaLeads++;
      void intentar(cargarLeads);
    });
    $('[data-paginas]').replaceChildren(anterior, el('span', { class: 'panel-nota' }, `Página ${paginaLeads} de ${paginas}`), siguiente);
  }

  cargadores.leads = cargarLeads;
  formLeads.addEventListener('submit', (e) => {
    e.preventDefault();
    paginaLeads = 1;
    void intentar(cargarLeads);
  });

  // ── Testimonios ──
  interface Testimonio {
    id: number;
    lead_id: number;
    texto: string;
    nombre_publico: string | null;
    nombre: string;
    especialidad: string;
    consentimiento_publicacion_utc: string | null;
    publicado: number;
  }

  cargadores.testimonios = async () => {
    const { testimonios } = await api<{ testimonios: Testimonio[] }>('/testimonios');
    const cuerpo = el('tbody');
    for (const t of testimonios) {
      const boton = el('button', { type: 'button', disabled: !t.consentimiento_publicacion_utc }, t.publicado ? 'Ocultar' : 'Publicar');
      boton.addEventListener('click', () =>
        void intentar(async () => {
          await api(`/testimonios/${t.id}`, { metodo: 'PATCH', cuerpo: { publicado: !t.publicado } });
          await cargadores.testimonios?.();
        }, boton),
      );
      cuerpo.append(
        el(
          'tr',
          {},
          el('td', {}, `${t.nombre_publico ?? t.nombre} (lead ${t.lead_id})`),
          el('td', { class: 'envolver' }, t.texto),
          el('td', {}, t.consentimiento_publicacion_utc ? t.consentimiento_publicacion_utc.slice(0, 10) : 'Sin consentimiento'),
          el('td', { class: t.publicado ? 'si' : 'no' }, t.publicado ? 'Publicado' : 'Oculto'),
          el('td', {}, boton),
        ),
      );
    }
    if (!testimonios.length) cuerpo.append(el('tr', {}, el('td', { colspan: '5' }, 'Aún no hay testimonios')));
    $('[data-tabla-testimonios]').replaceChildren(
      el('thead', {}, el('tr', {}, ...['Médico', 'Texto', 'Consentimiento', 'Estado', ''].map((h) => el('th', {}, h)))),
      cuerpo,
    );
  };

  const formTestimonio = $<HTMLFormElement>('[data-form-testimonio]');
  formTestimonio.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = new FormData(formTestimonio);
    const cuerpo: Record<string, unknown> = {
      lead_id: Number(datos.get('lead_id')),
      texto: String(datos.get('texto') ?? ''),
    };
    const nombre = String(datos.get('nombre_publico') ?? '').trim();
    const consentimiento = String(datos.get('consentimiento_fecha') ?? '');
    if (nombre) cuerpo.nombre_publico = nombre;
    if (consentimiento) cuerpo.consentimiento_fecha = consentimiento;
    void intentar(async () => {
      await api('/testimonios', { metodo: 'POST', cuerpo });
      formTestimonio.reset();
      avisar('Testimonio guardado (oculto hasta que lo publiques)');
      await cargadores.testimonios?.();
    }, formTestimonio.querySelector('button') ?? undefined);
  });

  // ── Versiones ──
  interface Version {
    version: string;
    clave_r2: string;
    nombre_archivo: string;
    sha256: string;
    tamano_bytes: number | null;
    publicada_utc: string;
    vigente: number;
    descargas: number;
  }

  cargadores.versiones = async () => {
    const { versiones } = await api<{ versiones: Version[] }>('/versiones');
    const cuerpo = el('tbody');
    for (const v of versiones) {
      const boton = el('button', { type: 'button', disabled: v.vigente === 1 }, v.vigente ? 'Vigente' : 'Marcar vigente');
      boton.addEventListener('click', () =>
        void intentar(async () => {
          await api(`/versiones/${encodeURIComponent(v.version)}/vigente`, { metodo: 'POST', cuerpo: {} });
          await cargadores.versiones?.();
        }, boton),
      );
      cuerpo.append(
        el(
          'tr',
          {},
          el('td', {}, v.version),
          el('td', {}, v.nombre_archivo),
          el('td', { class: 'envolver' }, el('code', {}, v.sha256)),
          el('td', { class: 'numero' }, v.tamano_bytes ? `${(v.tamano_bytes / 1_048_576).toFixed(1)} MB` : '—'),
          el('td', { class: 'numero' }, v.descargas),
          el('td', {}, fecha(v.publicada_utc)),
          el('td', {}, boton),
        ),
      );
    }
    if (!versiones.length) cuerpo.append(el('tr', {}, el('td', { colspan: '7' }, 'Aún no hay versiones registradas')));
    $('[data-tabla-versiones]').replaceChildren(
      el('thead', {}, el('tr', {}, ...['Versión', 'Archivo', 'SHA-256', 'Tamaño', 'Descargas', 'Registrada', ''].map((h) => el('th', {}, h)))),
      cuerpo,
    );
  };

  const formVersion = $<HTMLFormElement>('[data-form-version]');
  formVersion.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = new FormData(formVersion);
    void intentar(async () => {
      await api('/versiones', {
        metodo: 'POST',
        cuerpo: {
          version: String(datos.get('version') ?? '').trim(),
          clave_r2: String(datos.get('clave_r2') ?? '').trim(),
          nombre_archivo: String(datos.get('nombre_archivo') ?? '').trim(),
          sha256: String(datos.get('sha256') ?? '').trim(),
          vigente: datos.get('vigente') === 'on',
        },
      });
      formVersion.reset();
      avisar('Versión registrada');
      await cargadores.versiones?.();
    }, formVersion.querySelector('button') ?? undefined);
  });

  // ── ARCO ──
  interface Arco {
    id: number;
    correo: string;
    tipo: string;
    detalle: string;
    creado_utc: string;
    resuelto_utc: string | null;
    diasHabiles: number;
  }

  cargadores.arco = async () => {
    const { solicitudes } = await api<{ solicitudes: Arco[] }>('/arco');
    const cuerpo = el('tbody');
    for (const s of solicitudes) {
      const boton = el('button', { type: 'button', disabled: Boolean(s.resuelto_utc) }, s.resuelto_utc ? 'Resuelta' : 'Marcar resuelta');
      boton.addEventListener('click', () => {
        if (!window.confirm(`¿Marcar el folio ${s.id} como resuelto? Hazlo cuando ya respondiste al titular.`)) return;
        void intentar(async () => {
          await api(`/arco/${s.id}/resolver`, { metodo: 'POST', cuerpo: {} });
          await cargadores.arco?.();
        }, boton);
      });
      const plazo = s.resuelto_utc ? `Resuelta ${fecha(s.resuelto_utc)}` : `${s.diasHabiles} de 20 días hábiles`;
      cuerpo.append(
        el(
          'tr',
          {},
          el('td', { class: 'numero' }, s.id),
          el('td', {}, fecha(s.creado_utc)),
          el('td', {}, s.tipo),
          el('td', {}, s.correo),
          el('td', { class: 'envolver' }, s.detalle || '—'),
          el('td', { class: !s.resuelto_utc && s.diasHabiles >= 15 ? 'no' : undefined }, plazo),
          el('td', {}, boton),
        ),
      );
    }
    if (!solicitudes.length) cuerpo.append(el('tr', {}, el('td', { colspan: '7' }, 'Sin solicitudes')));
    $('[data-tabla-arco]').replaceChildren(
      el('thead', {}, el('tr', {}, ...['Folio', 'Recibida', 'Derecho', 'Correo', 'Detalle', 'Plazo', ''].map((h) => el('th', {}, h)))),
      cuerpo,
    );
  };

  // ── Ajustes ──
  const formConfig = $<HTMLFormElement>('[data-form-config]');
  cargadores.config = async () => {
    const { total_cupos } = await api<{ total_cupos: number }>('/config');
    (formConfig.elements.namedItem('total_cupos') as HTMLInputElement).value = String(total_cupos);
  };
  formConfig.addEventListener('submit', (e) => {
    e.preventDefault();
    const total = Number((formConfig.elements.namedItem('total_cupos') as HTMLInputElement).value);
    void intentar(async () => {
      await api('/config', { metodo: 'PUT', cuerpo: { total_cupos: total } });
      avisar('Guardado. El sitio lo refleja en menos de un minuto.');
    }, formConfig.querySelector('button') ?? undefined);
  });

  void intentar(cargadores.metricas);
}
