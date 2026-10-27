-- Doble opt-in: token de un solo uso. Se guarda solo su SHA-256 (hex); el token viaja únicamente en el correo.
CREATE TABLE confirmaciones (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  creado_utc TEXT NOT NULL,
  expira_utc TEXT NOT NULL,
  usado_utc TEXT
);

CREATE INDEX idx_confirmaciones_lead ON confirmaciones (lead_id);
