CREATE TABLE cuota_ia (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  minuto INTEGER NOT NULL, llamadas_minuto INTEGER NOT NULL,
  dia INTEGER NOT NULL, llamadas_dia INTEGER NOT NULL
);
