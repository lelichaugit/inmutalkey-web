// Simulador de la portada (Simulador.astro). Se descarga cuando la sección se acerca a la vista.
//
//  · Pasos (pestañas con teclado): agenda → consulta → firma → receta → respaldo.
//  · Consulta: los campos responden con las mismas reglas que la app: semáforo de 7 requisitos (lib/semaforo.ts),
//    IMC con clasificación OMS y rango de SpO₂ (lib/imc.ts) y búsqueda CIE-10 (lib/cie10.ts).
//  · Firma: la huella SHA-256 se calcula aquí, en el navegador, con lo que el médico escribió. Si cambia una coma y
//    vuelve a firmar, sale distinta. Nada se envía a ningún lado.
//  · Receta: media hoja, Carta vertical u horizontal; si el tratamiento no cabe en media hoja, pasa a Carta vertical
//    y avisa (igual que la app). Respaldo: barra de avance y confirmación.
//  · Recorrido automático: solo en pantallas anchas (ahí la ventana no cambia de alto), una vez, al entrar en vista;
//    se detiene en cuanto el médico toca algo.
// Sin este módulo la sección muestra la consulta terminada, como ilustración.

import { buscarCie10, type Diagnostico } from '../lib/cie10';
import { calcularImc, clasificarImc, errorSpo2, ETIQUETA_IMC, leerNumero } from '../lib/imc';
import { calcularSemaforo, ETIQUETA_SEMAFORO, type DatosNota } from '../lib/semaforo';

const PASOS = ['agenda', 'consulta', 'firma', 'receta', 'respaldo'] as const;
type Paso = (typeof PASOS)[number];
const esPaso = (v: string | undefined): v is Paso => PASOS.includes(v as Paso);

/** Tiempo de cada paso en el recorrido automático (ms). */
const DURACION: Readonly<Record<Paso, number>> = { agenda: 3200, consulta: 4600, firma: 4600, receta: 4200, respaldo: 4600 };
/** A partir de este largo, el tratamiento ya no cabe en media hoja (aproximación para la simulación). */
const LIMITE_MEDIA_HOJA = 230;

async function huellaDe(texto: string): Promise<string | null> {
  if (!window.crypto?.subtle) return null;
  try {
    const bytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
  } catch {
    return null;
  }
}

function iniciar(seccion: HTMLElement): void {
  const uno = <T extends Element>(selector: string): T | null => seccion.querySelector<T>(selector);
  const todos = <T extends Element>(selector: string): T[] => [...seccion.querySelectorAll<T>(selector)];

  const app = uno<HTMLElement>('[data-sim-app]');
  const form = uno<HTMLFormElement>('[data-sim-nota]');
  const barraPasos = uno<HTMLElement>('[data-sim-pasos]');
  if (!app || !form || !barraPasos) return;

  const pestanas = todos<HTMLButtonElement>('[data-sim-paso]');
  const paneles = todos<HTMLElement>('[data-sim-panel]');
  const campo = (nombre: string): string =>
    (form.elements.namedItem(nombre) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ───────────── Nota y semáforo ─────────────

  const semaforo = uno<HTMLElement>('[data-sim-semaforo]');
  const cuentas = todos<HTMLElement>('[data-sim-cuenta]');
  const estadoTexto = uno<HTMLElement>('[data-sim-estado-texto]');
  const firmar = uno<HTMLButtonElement>('[data-sim-firmar]');
  const pista = uno<HTMLElement>('[data-sim-pista]');
  const imcValor = uno<HTMLElement>('[data-sim-imc]');
  const imcClase = uno<HTMLElement>('[data-sim-imc-clase]');
  const avisoSpo2 = uno<HTMLElement>('[data-sim-spo2]');
  const spo2 = form.elements.namedItem('spo2') as HTMLInputElement | null;

  const datos = (): DatosNota => ({
    motivo: campo('motivo'),
    evolucion: campo('evolucion'),
    taSistolica: campo('taSistolica'),
    taDiastolica: campo('taDiastolica'),
    fc: campo('fc'),
    fr: campo('fr'),
    temperatura: campo('temperatura'),
    peso: campo('peso'),
    talla: campo('talla'),
    omisionSignos: '',
    exploracion: campo('exploracion'),
    diagnostico: campo('diagnostico'),
    cie10: campo('cie10'),
    pronostico: campo('pronostico'),
    plan: campo('plan'),
  });

  let listaParaFirmar = true;

  const actualizar = (): void => {
    const s = calcularSemaforo(datos());
    listaParaFirmar = s.estado === 'verde';
    if (semaforo) semaforo.dataset['estado'] = s.estado;
    for (const c of cuentas) c.textContent = `${s.cumplidos} de ${s.requisitos.length} requisitos`;
    if (estadoTexto) estadoTexto.textContent = ETIQUETA_SEMAFORO[s.estado];
    for (const r of s.requisitos) uno(`[data-sim-req="${r.id}"]`)?.classList.toggle('cumple', r.cumple);
    firmar?.setAttribute('aria-disabled', String(!listaParaFirmar));
    if (pista) {
      const faltan = s.requisitos.length - s.cumplidos;
      pista.textContent = listaParaFirmar
        ? 'Lista: firme y vea cómo queda sellada.'
        : `${faltan === 1 ? 'Falta 1 requisito' : `Faltan ${faltan} requisitos`}: el semáforo le dice cuáles.`;
    }

    const imc = calcularImc(leerNumero(campo('peso')), leerNumero(campo('talla')));
    if (imcValor) imcValor.textContent = imc === null ? '—' : imc.toFixed(1);
    if (imcClase) imcClase.textContent = imc === null ? 'Revise peso y talla' : ETIQUETA_IMC[clasificarImc(imc)];

    const error = spo2 && spo2.value.trim() !== '' ? errorSpo2(leerNumero(spo2.value)) : null;
    spo2?.setAttribute('aria-invalid', String(error !== null));
    if (avisoSpo2) {
      avisoSpo2.hidden = error === null;
      avisoSpo2.textContent = error === null ? '' : `SpO₂: ${error}`;
    }
  };

  form.addEventListener('input', actualizar);
  form.addEventListener('submit', (ev) => ev.preventDefault());

  // ───────────── Diagnóstico CIE-10 (combobox) ─────────────

  const buscador = uno<HTMLInputElement>('#sim-cie10');
  const lista = uno<HTMLUListElement>('[data-sim-cie10]');
  const clave = form.elements.namedItem('cie10') as HTMLInputElement | null;
  const nombreDx = form.elements.namedItem('diagnostico') as HTMLInputElement | null;
  let resultados: Diagnostico[] = [];
  let activo = -1;

  const cerrarLista = (): void => {
    if (!lista || !buscador) return;
    lista.hidden = true;
    buscador.setAttribute('aria-expanded', 'false');
    buscador.removeAttribute('aria-activedescendant');
    activo = -1;
  };

  const marcar = (i: number): void => {
    if (!lista || !buscador) return;
    activo = i;
    [...lista.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    const opcion = lista.children[i];
    if (opcion) buscador.setAttribute('aria-activedescendant', opcion.id);
  };

  const elegir = (d: Diagnostico): void => {
    if (!buscador || !clave || !nombreDx) return;
    buscador.value = `${d.codigo} · ${d.nombre}`;
    clave.value = d.codigo;
    nombreDx.value = d.nombre;
    cerrarLista();
    actualizar();
  };

  if (buscador && lista && clave && nombreDx) {
    buscador.addEventListener('input', () => {
      // Texto libre no es diagnóstico: hasta elegir uno del catálogo, el requisito queda pendiente.
      clave.value = '';
      nombreDx.value = '';
      resultados = buscarCie10(buscador.value, 5);
      lista.replaceChildren(
        ...resultados.map((d, i) => {
          const li = document.createElement('li');
          li.id = `sim-cie10-op-${i}`;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          const codigo = document.createElement('b');
          codigo.textContent = d.codigo;
          li.append(codigo, document.createTextNode(d.nombre));
          return li;
        }),
      );
      lista.hidden = resultados.length === 0;
      buscador.setAttribute('aria-expanded', String(resultados.length > 0));
      activo = -1;
    });
    buscador.addEventListener('keydown', (ev) => {
      if (lista.hidden) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const n = resultados.length;
        marcar((activo + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const d = resultados[Math.max(activo, 0)];
        if (d) elegir(d);
      } else if (ev.key === 'Escape') {
        cerrarLista();
      }
    });
    // pointerdown (no click): se elige antes de que el campo pierda el foco y la lista se cierre.
    lista.addEventListener('pointerdown', (ev) => {
      const li = ev.target instanceof Element ? ev.target.closest('li') : null;
      const d = li ? resultados[[...lista.children].indexOf(li)] : undefined;
      if (!d) return;
      ev.preventDefault();
      elegir(d);
    });
    buscador.addEventListener('blur', () => window.setTimeout(cerrarLista, 120));
  }

  // ───────────── Firma, adenda, receta y respaldo ─────────────

  const ver = (nombre: string, texto: string): void => {
    const el = uno<HTMLElement>(`[data-sim-ver="${nombre}"]`);
    if (el) el.textContent = texto;
  };
  const huellaVista = uno<HTMLElement>('[data-sim-huella]');
  const explica = uno<HTMLElement>('[data-sim-explica]');
  let huellaAnterior: string | null = null;
  let contenidoAnterior = '';

  const sellar = (): void => {
    const d = datos();
    ver('motivo', d.motivo);
    const imc = calcularImc(leerNumero(d.peso), leerNumero(d.talla));
    const saturacion = campo('spo2').trim();
    ver(
      'signos',
      [
        `TA ${d.taSistolica}/${d.taDiastolica}`,
        `FC ${d.fc}`,
        `FR ${d.fr}`,
        `T ${d.temperatura} °C`,
        ...(saturacion ? [`SpO₂ ${saturacion} %`] : []),
        ...(imc === null ? [] : [`IMC ${imc.toFixed(1)}`]),
      ].join(' · '),
    );
    ver('dx', `${d.cie10} · ${d.diagnostico}`);
    ver('plan', d.plan);

    const contenido = JSON.stringify({ ...d, spo2: saturacion });
    void huellaDe(contenido).then((huella) => {
      if (!huella) return;
      if (huellaVista) huellaVista.textContent = huella;
      todos<HTMLElement>('[data-sim-rx-huella]').forEach((el) => (el.textContent = huella));
      if (explica && huellaAnterior && contenido !== contenidoAnterior) {
        explica.textContent = `Antes la huella era ${huellaAnterior}; ahora es ${huella}. Cambió el contenido, cambió la huella: así se nota cualquier alteración.`;
      }
      huellaAnterior = huella;
      contenidoAnterior = contenido;
    });
  };

  const hoja = uno<HTMLElement>('[data-sim-hoja]');
  const avisoHoja = uno<HTMLElement>('[data-sim-aviso-hoja]');
  const formatos = todos<HTMLButtonElement>('[data-sim-formato]');

  const ponerFormato = (id: string): void => {
    if (hoja) hoja.dataset['formato'] = id;
    formatos.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['simFormato'] === id)));
  };

  const prepararReceta = (): void => {
    const plan = campo('plan').trim();
    todos<HTMLElement>('[data-sim-rx]').forEach((el) => (el.textContent = plan));
    const noCabe = plan.length > LIMITE_MEDIA_HOJA && hoja?.dataset['formato'] === 'media';
    if (noCabe) ponerFormato('vertical');
    if (avisoHoja) avisoHoja.hidden = !noCabe;
  };

  formatos.forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset['simFormato'] ?? 'media';
      const noCabe = id === 'media' && campo('plan').trim().length > LIMITE_MEDIA_HOJA;
      ponerFormato(noCabe ? 'vertical' : id);
      if (avisoHoja) avisoHoja.hidden = !noCabe;
    }),
  );

  const adendaForm = uno<HTMLElement>('[data-sim-adenda-form]');
  const adenda = uno<HTMLElement>('[data-sim-adenda]');
  uno<HTMLButtonElement>('[data-sim-adenda-abrir]')?.addEventListener('click', () => {
    if (!adendaForm) return;
    adendaForm.hidden = false;
    adendaForm.querySelector<HTMLSelectElement>('select')?.focus();
  });
  uno<HTMLButtonElement>('[data-sim-adenda-firmar]')?.addEventListener('click', () => {
    if (!adendaForm || !adenda) return;
    const motivo = adendaForm.querySelector<HTMLSelectElement>('select')?.value ?? '';
    const texto = adendaForm.querySelector<HTMLInputElement>('input')?.value.trim() ?? '';
    const titulo = adenda.querySelector<HTMLElement>('[data-sim-adenda-titulo]');
    const cuerpo = adenda.querySelector<HTMLElement>('[data-sim-adenda-texto]');
    if (titulo) titulo.textContent = `Adenda 1 · ${motivo}`;
    if (cuerpo) cuerpo.textContent = texto === '' ? 'Sin texto.' : texto;
    adendaForm.hidden = true;
    adenda.hidden = false;
  });

  const progreso = uno<HTMLElement>('[data-sim-progreso]');
  const resultado = uno<HTMLElement>('[data-sim-resultado]');
  const ultimo = uno<HTMLElement>('[data-sim-ultimo]');
  let relojRespaldo = 0;
  const respaldar = (): void => {
    if (!progreso || !resultado) return;
    window.clearTimeout(relojRespaldo);
    resultado.hidden = true;
    progreso.classList.remove('va');
    // Un cuadro sin la clase para que la barra arranque de cero aunque ya se haya llenado antes.
    window.requestAnimationFrame(() => {
      progreso.classList.add('va');
      relojRespaldo = window.setTimeout(
        () => {
          resultado.hidden = false;
          if (ultimo) ultimo.textContent = 'Último respaldo: ahora';
        },
        reducido.matches ? 0 : 1700,
      );
    });
  };
  uno<HTMLButtonElement>('[data-sim-respaldar]')?.addEventListener('click', respaldar);

  // ───────────── Pasos ─────────────

  const mostrar = (paso: Paso, enfocar = false): void => {
    // A la firma se llega con la nota completa; si falta algo, el simulador lo dice y se queda en la consulta.
    if (paso === 'firma' && !listaParaFirmar) {
      paso = 'consulta';
      if (pista) pista.textContent = 'Para firmar, complete lo que el semáforo marca como pendiente.';
    }
    for (const p of paneles) p.hidden = p.dataset['simPanel'] !== paso;
    for (const t of pestanas) {
      const suya = t.dataset['simPaso'] === paso;
      t.setAttribute('aria-selected', String(suya));
      t.tabIndex = suya ? 0 : -1;
      if (suya) {
        // En celular la tira de pasos se desplaza sola hasta el paso activo (sin mover la página).
        barraPasos.scrollTo({ left: t.offsetLeft - 16, behavior: reducido.matches ? 'auto' : 'smooth' });
        if (enfocar) t.focus({ preventScroll: true });
      }
    }
    if (paso === 'firma') sellar();
    if (paso === 'receta') {
      sellar();
      prepararReceta();
    }
  };

  pestanas.forEach((t, i) => {
    t.addEventListener('click', () => {
      const paso = t.dataset['simPaso'];
      if (esPaso(paso)) mostrar(paso);
    });
    t.addEventListener('keydown', (ev) => {
      const n = pestanas.length;
      const destino =
        ev.key === 'ArrowRight' ? (i + 1) % n : ev.key === 'ArrowLeft' ? (i - 1 + n) % n : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1;
      const paso = pestanas[destino]?.dataset['simPaso'];
      if (destino < 0 || !esPaso(paso)) return;
      ev.preventDefault();
      mostrar(paso, true);
    });
  });

  todos<HTMLButtonElement>('[data-sim-ir]').forEach((b) =>
    b.addEventListener('click', () => {
      const paso = b.dataset['simIr'];
      if (esPaso(paso)) mostrar(paso);
    }),
  );
  firmar?.addEventListener('click', () => mostrar('firma'));

  // ───────────── Recorrido automático ─────────────

  const botonAuto = uno<HTMLButtonElement>('[data-sim-auto]');
  const textoAuto = uno<HTMLElement>('[data-sim-auto-texto]');
  let relojAuto = 0;
  let corriendo = false;

  const detener = (): void => {
    if (!corriendo) return;
    corriendo = false;
    window.clearTimeout(relojAuto);
    botonAuto?.setAttribute('aria-pressed', 'false');
    if (textoAuto) textoAuto.textContent = 'Ver el recorrido';
  };

  const avanzar = (i: number): void => {
    const paso = PASOS[i];
    if (!corriendo) return;
    if (!paso) {
      detener();
      mostrar('consulta');
      return;
    }
    mostrar(paso);
    if (paso === 'respaldo') respaldar();
    relojAuto = window.setTimeout(() => avanzar(i + 1), DURACION[paso]);
  };

  const recorrer = (): void => {
    corriendo = true;
    botonAuto?.setAttribute('aria-pressed', 'true');
    if (textoAuto) textoAuto.textContent = 'Pausar el recorrido';
    avanzar(0);
  };

  if (botonAuto) {
    botonAuto.hidden = false;
    botonAuto.setAttribute('aria-pressed', 'false');
    botonAuto.addEventListener('click', () => (corriendo ? detener() : recorrer()));
  }
  // Cualquier gesto del médico dentro del simulador detiene el recorrido: manda él.
  for (const zona of [app, barraPasos]) {
    zona.addEventListener('pointerdown', detener);
    zona.addEventListener('keydown', detener);
  }

  if (!reducido.matches && window.matchMedia('(min-width: 62rem)').matches && 'IntersectionObserver' in window) {
    let visto = false;
    new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting && !visto) {
          visto = true;
          recorrer();
        } else if (!e.isIntersecting) {
          detener();
        }
      },
      { threshold: 0.6 },
    ).observe(app);
  }

  actualizar();
}

export function iniciarSimulador(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLElement>('[data-simulador]').forEach(iniciar);
}
