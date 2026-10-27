-- Médicos interesados en el programa Fundadores. Solo datos comerciales: nada clínico, ni IP, ni user-agent.
-- Fechas en UTC con formato ISO 8601 (toISOString). Sin BEGIN/COMMIT: wrangler aplica cada migración de forma atómica.
CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  creado_utc TEXT NOT NULL,
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 3 AND 120),
  correo TEXT NOT NULL UNIQUE CHECK (correo = lower(trim(correo)) AND length(correo) <= 160),
  telefono TEXT CHECK (telefono IS NULL OR (length(telefono) BETWEEN 10 AND 15 AND telefono NOT GLOB '*[^0-9]*')),
  especialidad TEXT NOT NULL CHECK (length(especialidad) BETWEEN 3 AND 80),
  estado TEXT NOT NULL,
  ciudad TEXT NOT NULL CHECK (length(ciudad) BETWEEN 2 AND 80),
  tipo_practica TEXT NOT NULL,
  pacientes_semana_rango TEXT NOT NULL,
  so TEXT NOT NULL,
  como_se_entero TEXT NOT NULL,
  usa_hoy TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT 'directo',
  utm_medium TEXT,
  utm_campaign TEXT,
  version_aviso TEXT NOT NULL,
  consentimiento_utc TEXT NOT NULL,
  confirmado_utc TEXT,
  estatus TEXT NOT NULL DEFAULT 'nuevo' CHECK (estatus IN ('nuevo', 'contactado', 'prueba', 'cliente', 'descartado')),
  -- Cuándo cambió el estatus por última vez: la retención de los descartados cuenta 12 meses desde aquí.
  estatus_utc TEXT NOT NULL,
  primer_contacto_utc TEXT,
  notas_internas TEXT NOT NULL DEFAULT '' CHECK (length(notas_internas) <= 4000)
);

CREATE INDEX idx_leads_estatus ON leads (estatus);
CREATE INDEX idx_leads_creado ON leads (creado_utc);
CREATE INDEX idx_leads_fuente ON leads (utm_source);
