-- =============================================================================
-- Te Buscamos Abogado · Esquema de base de datos (SQLite)
--
-- Idempotente: se ejecuta en cada arranque (CREATE ... IF NOT EXISTS) desde
-- server/db.ts. Los cambios futuros que no sean "añadir" van como migraciones
-- numeradas en db.ts (PRAGMA user_version).
--
-- Fechas: texto ISO-8601 en UTC ('2026-10-16T08:30:00.000Z').
-- Relaciones:
--   especialidades 1─N leads
--   leads          1─N lead_notas        (se borran con el lead)
--   leads          1─N lead_historial    (se borran con el lead; lo rellena un trigger)
--   leads          N─M despachos         vía lead_derivaciones (registro de cesión de datos)
--   despachos      N─1 usuarios (abogado registrado; NULL si lo dio de alta el admin), N─M provincias
--   eventos        independiente y anónimo (estadísticas de la web, sin datos personales)
--   usuarios       1─N sesiones, 1─N recuperaciones (acceso al panel)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Catálogo de especialidades que ofrece la web (el formulario envía el nombre).
CREATE TABLE IF NOT EXISTS especialidades (
  id      INTEGER PRIMARY KEY,
  nombre  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  activa  INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden   INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO especialidades (nombre, orden) VALUES
  ('Penal', 1), ('Familia', 2), ('Laboral', 3), ('Mercantil', 4),
  ('Civil', 5), ('Administrativo', 6), ('Inmobiliario', 7), ('Otros', 99);

-- Solicitudes de contacto recibidas por el formulario.
CREATE TABLE IF NOT EXISTS leads (
  id               INTEGER PRIMARY KEY,
  nombre           TEXT    NOT NULL CHECK (length(nombre) BETWEEN 1 AND 255),
  telefono         TEXT    NOT NULL CHECK (length(telefono) BETWEEN 9 AND 20),
  email            TEXT    NOT NULL CHECK (length(email) <= 320),
  tipo_cliente     TEXT    NOT NULL CHECK (tipo_cliente IN ('particular', 'empresa')),
  especialidad_id  INTEGER NOT NULL REFERENCES especialidades(id) ON DELETE RESTRICT,
  localidad        TEXT    CHECK (localidad IS NULL OR length(localidad) <= 120),
  descripcion      TEXT    NOT NULL CHECK (length(descripcion) BETWEEN 10 AND 2000),
  presupuesto      TEXT    CHECK (presupuesto IS NULL OR length(presupuesto) <= 50),
  estado           TEXT    NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_proceso', 'cerrado')),
  origen           TEXT    NOT NULL DEFAULT 'formulario',
  -- Prueba del consentimiento (art. 7.1 RGPD): cuándo y con qué versión de la política.
  consentimiento_at       TEXT NOT NULL,
  politica_version        TEXT NOT NULL,
  contactado_at    TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_created      ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_estado       ON leads (estado);
CREATE INDEX IF NOT EXISTS idx_leads_especialidad ON leads (especialidad_id);

-- Notas internas del administrador sobre cada lead.
CREATE TABLE IF NOT EXISTS lead_notas (
  id          INTEGER PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  texto       TEXT    NOT NULL CHECK (length(texto) BETWEEN 1 AND 2000),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_notas_lead ON lead_notas (lead_id);

-- Historial de cambios de estado (lo rellenan los triggers de abajo).
CREATE TABLE IF NOT EXISTS lead_historial (
  id               INTEGER PRIMARY KEY,
  lead_id          INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  estado_anterior  TEXT,
  estado_nuevo     TEXT    NOT NULL,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_historial_lead ON lead_historial (lead_id);

CREATE TRIGGER IF NOT EXISTS trg_leads_alta
AFTER INSERT ON leads
BEGIN
  INSERT INTO lead_historial (lead_id, estado_anterior, estado_nuevo) VALUES (NEW.id, NULL, NEW.estado);
END;

CREATE TRIGGER IF NOT EXISTS trg_leads_cambio_estado
AFTER UPDATE OF estado ON leads
WHEN OLD.estado IS NOT NEW.estado
BEGIN
  INSERT INTO lead_historial (lead_id, estado_anterior, estado_nuevo) VALUES (NEW.id, OLD.estado, NEW.estado);
END;

CREATE TRIGGER IF NOT EXISTS trg_leads_updated_at
AFTER UPDATE ON leads
WHEN OLD.updated_at IS NEW.updated_at
BEGIN
  UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- Despachos o abogados colegiados a los que se pueden derivar consultas.
CREATE TABLE IF NOT EXISTS despachos (
  id              INTEGER PRIMARY KEY,
  nombre          TEXT    NOT NULL CHECK (length(nombre) BETWEEN 1 AND 255),
  email           TEXT,
  telefono        TEXT,
  colegio         TEXT,   -- Colegio de la Abogacía
  num_colegiado   TEXT,
  activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Especialidades que cubre cada despacho (N─M).
CREATE TABLE IF NOT EXISTS despacho_especialidades (
  despacho_id      INTEGER NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  especialidad_id  INTEGER NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
  PRIMARY KEY (despacho_id, especialidad_id)
);

-- Provincias en las que ejerce cada despacho (N─M).
CREATE TABLE IF NOT EXISTS despacho_provincias (
  despacho_id  INTEGER NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  provincia    TEXT    NOT NULL,
  PRIMARY KEY (despacho_id, provincia)
);

-- A qué despacho se comunicó cada lead y cuándo (registro de la cesión de datos).
CREATE TABLE IF NOT EXISTS lead_derivaciones (
  id           INTEGER PRIMARY KEY,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  despacho_id  INTEGER NOT NULL REFERENCES despachos(id) ON DELETE RESTRICT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (lead_id, despacho_id)
);
CREATE INDEX IF NOT EXISTS idx_derivaciones_despacho ON lead_derivaciones (despacho_id);

-- Eventos anónimos de la web para el panel (sin IP, sin cookies, sin datos personales).
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('visita', 'click_whatsapp', 'click_telefono', 'formulario_enviado')),
  pagina      TEXT CHECK (pagina IS NULL OR length(pagina) <= 200),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_fecha ON eventos (tipo, created_at);

-- Cuentas de acceso: administradores del panel y (más adelante) abogados.
CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 1 AND 320),
  nombre         TEXT    NOT NULL DEFAULT '' CHECK (length(nombre) <= 255),
  rol            TEXT    NOT NULL CHECK (rol IN ('admin', 'abogado')),
  password_hash  TEXT    NOT NULL,              -- scrypt: nunca se guarda la contraseña
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  ultimo_acceso  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sesiones abiertas (una por navegador). La cookie lleva un token aleatorio; aquí solo su hash.
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones (usuario_id);

-- Enlaces de "he olvidado mi contraseña" (un solo uso, caducan). Solo se guarda el hash del token.
CREATE TABLE IF NOT EXISTS recuperaciones (
  token_hash  TEXT    PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  usado_at    TEXT
);

-- Ajustes internos del servidor (p. ej. la clave de las sesiones si no se define JWT_SECRET).
CREATE TABLE IF NOT EXISTS ajustes (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);

-- Vista de leads con el nombre de la especialidad y sus contadores (la usa el panel).
DROP VIEW IF EXISTS v_leads;
CREATE VIEW v_leads AS
SELECT
  l.*,
  e.nombre AS especialidad,
  (SELECT count(*) FROM lead_notas n WHERE n.lead_id = l.id)        AS num_notas,
  (SELECT count(*) FROM lead_derivaciones d WHERE d.lead_id = l.id) AS num_derivaciones
FROM leads l
JOIN especialidades e ON e.id = l.especialidad_id;
