-- Testimonios de médicos (fase 1: los captura Alan desde /admin con la fecha del consentimiento del médico).
-- No se publica nada sin consentimiento (CHECK). El nombre público puede ser distinto al del lead ("Dra. Ana L.").
CREATE TABLE testimonios (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 20 AND 600),
  nombre_publico TEXT CHECK (nombre_publico IS NULL OR length(nombre_publico) BETWEEN 3 AND 80),
  consentimiento_publicacion_utc TEXT,
  publicado INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
  creado_utc TEXT NOT NULL,
  CHECK (publicado = 0 OR consentimiento_publicacion_utc IS NOT NULL)
);

CREATE INDEX idx_testimonios_publicado ON testimonios (publicado);
