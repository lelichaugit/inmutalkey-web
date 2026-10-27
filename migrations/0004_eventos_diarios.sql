-- Uso del sitio solo como agregados diarios. Sin IP, sin user-agent, sin identificador de visitante.
-- utm_source pertenece a una lista cerrada (src/compartido/eventos.ts); 'directo' cuando no hubo campaña.
CREATE TABLE eventos_diarios (
  fecha TEXT NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  evento TEXT NOT NULL CHECK (length(evento) <= 64),
  utm_source TEXT NOT NULL DEFAULT 'directo' CHECK (length(utm_source) <= 20),
  contador INTEGER NOT NULL DEFAULT 0 CHECK (contador >= 0),
  PRIMARY KEY (fecha, evento, utm_source)
) WITHOUT ROWID;
