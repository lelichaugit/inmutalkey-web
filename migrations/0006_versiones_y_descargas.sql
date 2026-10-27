-- Versiones del instalador que viven en R2 y su SHA-256 público (se muestra en /verificar).
CREATE TABLE versiones (
  version TEXT PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 32),
  clave_r2 TEXT NOT NULL CHECK (length(clave_r2) BETWEEN 1 AND 200),
  nombre_archivo TEXT NOT NULL CHECK (length(nombre_archivo) BETWEEN 1 AND 120),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  tamano_bytes INTEGER CHECK (tamano_bytes IS NULL OR tamano_bytes > 0),
  publicada_utc TEXT NOT NULL,
  -- La versión que se ofrece al aprobar una prueba. Solo una puede estar vigente.
  vigente INTEGER NOT NULL DEFAULT 0 CHECK (vigente IN (0, 1))
);

CREATE UNIQUE INDEX idx_versiones_una_vigente ON versiones (vigente) WHERE vigente = 1;

-- Enlace de descarga: token de un solo uso con expiración de 72 h. Se guarda solo su SHA-256.
CREATE TABLE descargas (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  version TEXT NOT NULL REFERENCES versiones (version),
  creado_utc TEXT NOT NULL,
  expira_utc TEXT NOT NULL,
  usado_utc TEXT
);

CREATE INDEX idx_descargas_lead ON descargas (lead_id);
CREATE INDEX idx_descargas_version ON descargas (version);
