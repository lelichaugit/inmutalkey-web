-- Solicitudes de derechos ARCO (LFPDPPP 2025). Plazo: 20 días hábiles para responder y 15 para hacerlo efectivo.
CREATE TABLE solicitudes_arco (
  id INTEGER PRIMARY KEY,
  correo TEXT NOT NULL CHECK (correo = lower(trim(correo)) AND length(correo) <= 160),
  tipo TEXT NOT NULL CHECK (tipo IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion')),
  detalle TEXT NOT NULL DEFAULT '' CHECK (length(detalle) <= 1000),
  creado_utc TEXT NOT NULL,
  resuelto_utc TEXT
);

CREATE INDEX idx_arco_pendientes ON solicitudes_arco (resuelto_utc);
