-- Un solo registro (id = 1). total_cupos = 0 significa "sin definir": el sitio no muestra el medidor.
CREATE TABLE fundadores_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_cupos INTEGER NOT NULL DEFAULT 0 CHECK (total_cupos >= 0 AND total_cupos <= 100000)
);

INSERT INTO fundadores_config (id, total_cupos) VALUES (1, 0);
