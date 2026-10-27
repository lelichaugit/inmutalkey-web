import { describe, expect, it } from 'vitest';

import { esquemaLead, normalizarCorreo } from '../../src/compartido/leads';
import { esTokenValido, llaveLimite, sha256Hex, tokenNuevo } from '../../src/worker/lib/cripto';
import { escaparHtml } from '../../src/worker/lib/plantillas';
import { diasHabilesEntre, esFechaCorta, fechaMexico } from '../../src/worker/lib/tiempo';

describe('tokens', () => {
  it('32 bytes en base64url (43 caracteres), distintos cada vez', () => {
    const a = tokenNuevo();
    const b = tokenNuevo();
    expect(esTokenValido(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(esTokenValido('x'.repeat(42))).toBe(false);
    expect(esTokenValido(`${'x'.repeat(42)}/`)).toBe(false);
  });

  it('sha256Hex coincide con el vector conocido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('la llave del límite no contiene la IP y cambia con la sal', async () => {
    const llave = await llaveLimite('sal', 'leads', '203.0.113.9');
    expect(llave).not.toContain('203.0.113.9');
    expect(llave).not.toBe(await llaveLimite('otra-sal', 'leads', '203.0.113.9'));
  });
});

describe('tiempo', () => {
  it('fecha en hora del centro de México', () => {
    expect(fechaMexico(new Date('2026-10-28T05:59:00Z'))).toBe('2026-10-27');
    expect(fechaMexico(new Date('2026-10-28T06:00:00Z'))).toBe('2026-10-28');
  });

  it('días hábiles: sin fines de semana y sin contar el día de la solicitud', () => {
    // Viernes 23 → lunes 26: un día hábil.
    expect(diasHabilesEntre(new Date('2026-10-23T18:00:00Z'), new Date('2026-10-26T18:00:00Z'))).toBe(1);
    expect(diasHabilesEntre(new Date('2026-10-24T18:00:00Z'), new Date('2026-10-25T18:00:00Z'))).toBe(0);
    expect(diasHabilesEntre(new Date('2026-09-29T18:00:00Z'), new Date('2026-10-27T18:00:00Z'))).toBe(20);
  });

  it('esFechaCorta rechaza fechas imposibles', () => {
    expect(esFechaCorta('2026-02-28')).toBe(true);
    expect(esFechaCorta('2026-02-31')).toBe(false);
    expect(esFechaCorta('26-2-1')).toBe(false);
  });
});

describe('validación compartida del formulario', () => {
  it('normaliza correo, espacios y teléfono', () => {
    const r = esquemaLead.safeParse({
      nombre: '  Dr.   Juan  Pérez ',
      correo: ' JUAN@Ejemplo.MX ',
      telefono: '+52 (229) 152-5800',
      especialidad: 'Cardiología',
      estado: 'Veracruz',
      ciudad: 'Xalapa',
      tipo_practica: 'consultorio_propio',
      pacientes_semana_rango: 'hasta_20',
      so: 'windows',
      como_se_entero: 'redes',
      usa_hoy: 'papel',
      consentimiento: true,
      version_aviso: '2026-10-27-borrador',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nombre).toBe('Dr. Juan Pérez');
      expect(r.data.correo).toBe('juan@ejemplo.mx');
      expect(r.data.telefono).toBe('522291525800');
    }
    expect(normalizarCorreo(' A@B.MX ')).toBe('a@b.mx');
  });
});

describe('correos', () => {
  it('escapa HTML de los datos que escribe el médico', () => {
    expect(escaparHtml('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
  });
});
