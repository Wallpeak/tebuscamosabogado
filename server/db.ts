/**
 * Capa de datos: conexión a SQLite y todas las consultas de la web.
 *
 * - Motor: SQLite integrado en Node (`node:sqlite`, Node ≥ 22.13). Sin dependencias externas.
 * - Esquema: `server/schema.sql` (se aplica en cada arranque; es idempotente).
 * - Archivo: DATABASE_PATH (por defecto `data/tebuscamos.db`). Debe estar en un disco persistente.
 *
 * El resto del servidor solo habla con la BD a través de las funciones exportadas aquí.
 */
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export const ESTADOS = ["nuevo", "en_proceso", "cerrado"] as const;
export type EstadoLead = (typeof ESTADOS)[number];

export const TIPOS_EVENTO = ["visita", "click_whatsapp", "click_telefono", "formulario_enviado"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Versión de la Política de Privacidad aceptada en el formulario. Súbela cuando cambie el texto. */
export const POLITICA_VERSION = "2026-10-21";

export type NuevoLead = {
  nombre: string;
  telefono: string;
  email: string;
  tipoCliente: "particular" | "empresa";
  especialidad: string; // nombre, p. ej. "Familia"
  descripcion: string;
  provincia?: string | null;
  localidad?: string | null;
  presupuesto?: string | null;
  origen?: string;
};

export type Lead = {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  tipoCliente: "particular" | "empresa";
  especialidadId: number;
  especialidad: string;
  provincia: string | null;
  localidad: string | null;
  descripcion: string;
  presupuesto: string | null;
  estado: EstadoLead;
  origen: string;
  consentimientoAt: string;
  politicaVersion: string;
  contactadoAt: string | null;
  fechaRecepcion: string;
  updatedAt: string;
  numNotas: number;
  numDerivaciones: number;
};

export type Nota = { id: number; leadId: number; texto: string; createdAt: string };
export type CambioEstado = { id: number; estadoAnterior: EstadoLead | null; estadoNuevo: EstadoLead; createdAt: string };
export type EstadoDespacho = "pendiente" | "aprobado" | "rechazado";
export type Despacho = {
  id: number;
  usuarioId: number | null;
  estado: EstadoDespacho;
  motivoRechazo: string | null;
  provincias: string[];
  nombre: string;
  email: string | null;
  telefono: string | null;
  colegio: string | null;
  numColegiado: string | null;
  activo: boolean;
  especialidades: string[];
};
export type EstadoOferta = "enviada" | "aceptada" | "rechazada" | "caducada";
export type Derivacion = {
  id: number;
  despachoId: number;
  despacho: string;
  /** true si el despacho tiene cuenta (la oferta la acepta él); false si lo gestiona el admin a mano. */
  registrado: boolean;
  estado: EstadoOferta;
  createdAt: string;
  expiraAt: string | null;
  respondidaAt: string | null;
  motivo: string | null;
};
export type LeadDetalle = Lead & { notas: Nota[]; historial: CambioEstado[]; derivaciones: Derivacion[] };

export type FiltrosLeads = {
  estado?: EstadoLead;
  especialidadId?: number;
  desde?: string; // ISO (incluido)
  hasta?: string; // ISO (excluido)
  busqueda?: string; // nombre, email, teléfono o localidad
  limite?: number;
  offset?: number;
};

// ─── Conexión ────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
let _db: DatabaseSync | null = null;

/**
 * Migraciones para cambios que el esquema idempotente no cubre (renombrar, mover datos...).
 * Se ejecutan en orden una sola vez; el número aplicado se guarda en PRAGMA user_version.
 * Para añadir una: push de una función nueva al final. Nunca editar las ya publicadas.
 */
const MIGRACIONES: Array<(db: DatabaseSync) => void> = [
  // 1: esquema inicial (lo crea schema.sql)
  () => {},
  // 2: abogados registrados — cada despacho puede pertenecer a una cuenta y pasa por revisión.
  d =>
    d.exec(`
      ALTER TABLE despachos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
      ALTER TABLE despachos ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
      ALTER TABLE despachos ADD COLUMN motivo_rechazo TEXT;
      ALTER TABLE despachos ADD COLUMN condiciones_at TEXT;
      ALTER TABLE despachos ADD COLUMN condiciones_version TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_despachos_usuario ON despachos (usuario_id) WHERE usuario_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_despachos_estado ON despachos (estado);
    `),
  // 3: provincia del lead y derivaciones como ofertas (el abogado acepta o rechaza).
  //    Las derivaciones anteriores eran directas (el admin pasaba los datos): quedan como "aceptada".
  d =>
    d.exec(`
      ALTER TABLE leads ADD COLUMN provincia TEXT;
      ALTER TABLE lead_derivaciones ADD COLUMN estado TEXT NOT NULL DEFAULT 'aceptada' CHECK (estado IN ('enviada', 'aceptada', 'rechazada', 'caducada'));
      ALTER TABLE lead_derivaciones ADD COLUMN expira_at TEXT;
      ALTER TABLE lead_derivaciones ADD COLUMN respondida_at TEXT;
      ALTER TABLE lead_derivaciones ADD COLUMN motivo TEXT;
      CREATE INDEX IF NOT EXISTS idx_leads_provincia ON leads (provincia);
      CREATE INDEX IF NOT EXISTS idx_derivaciones_estado ON lead_derivaciones (estado, expira_at);
    `),
];

/** Abre (o devuelve) la conexión. `ruta` permite usar ':memory:' en tests. */
export function abrirBD(ruta = process.env.DATABASE_PATH || "data/tebuscamos.db"): DatabaseSync {
  if (_db) return _db;
  if (ruta !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true, mode: 0o700 });
    soloPropietario(ruta);
  }

  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  db.exec(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf8"));

  const version = Number((db.prepare("PRAGMA user_version").get() as Row).user_version);
  for (let v = version; v < MIGRACIONES.length; v++) {
    transaccion(db, () => {
      MIGRACIONES[v](db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }

  _db = db;
  return db;
}

export function cerrarBD() {
  _db?.close();
  _db = null;
}

const db = () => _db ?? abrirBD();

/**
 * Datos personales: el archivo solo lo puede leer el usuario que ejecuta el servidor (0600).
 * Se crea vacío antes de abrirlo para que SQLite herede el permiso en los archivos -wal y -shm.
 * En Windows chmod no tiene efecto (allí lo controlan los permisos de la carpeta).
 */
function soloPropietario(ruta: string) {
  try {
    if (!existsSync(ruta)) closeSync(openSync(ruta, "a", 0o600));
    chmodSync(ruta, 0o600);
  } catch (err) {
    console.warn("[bd] No se pudieron ajustar los permisos del archivo:", (err as Error).message);
  }
}

function transaccion<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    conn.exec("COMMIT");
    return r;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

const all = (sql: string, ...p: SQLInputValue[]) => db().prepare(sql).all(...p) as Row[];
const get = (sql: string, ...p: SQLInputValue[]) => db().prepare(sql).get(...p) as Row | undefined;
const run = (sql: string, ...p: SQLInputValue[]) => db().prepare(sql).run(...p);
const ahora = () => new Date().toISOString();
const str = (v: unknown) => (v == null ? null : String(v));

// ─── Mapeo filas → objetos (snake_case en BD, camelCase en la app) ───────────

function aLead(r: Row): Lead {
  return {
    id: Number(r.id),
    nombre: String(r.nombre),
    telefono: String(r.telefono),
    email: String(r.email),
    tipoCliente: r.tipo_cliente as Lead["tipoCliente"],
    especialidadId: Number(r.especialidad_id),
    especialidad: String(r.especialidad),
    provincia: str(r.provincia),
    localidad: str(r.localidad),
    descripcion: String(r.descripcion),
    presupuesto: str(r.presupuesto),
    estado: r.estado as EstadoLead,
    origen: String(r.origen),
    consentimientoAt: String(r.consentimiento_at),
    politicaVersion: String(r.politica_version),
    contactadoAt: str(r.contactado_at),
    fechaRecepcion: String(r.created_at),
    updatedAt: String(r.updated_at),
    numNotas: Number(r.num_notas ?? 0),
    numDerivaciones: Number(r.num_derivaciones ?? 0),
  };
}

// ─── Especialidades ──────────────────────────────────────────────────────────

export function listarEspecialidades(soloActivas = true) {
  return all(
    `SELECT id, nombre, activa FROM especialidades ${soloActivas ? "WHERE activa = 1" : ""} ORDER BY orden, nombre`
  ).map(r => ({ id: Number(r.id), nombre: String(r.nombre), activa: r.activa === 1 }));
}

function idEspecialidad(nombre: string): number {
  const r =
    get("SELECT id FROM especialidades WHERE nombre = ? AND activa = 1", nombre.trim()) ??
    get("SELECT id FROM especialidades WHERE nombre = 'Otros'");
  if (!r) throw new Error("Falta la especialidad 'Otros' en la base de datos");
  return Number(r.id);
}

// ─── Leads ───────────────────────────────────────────────────────────────────

/** Guarda una solicitud del formulario con la prueba del consentimiento. Devuelve su id. */
export function crearLead(l: NuevoLead): number {
  const res = run(
    `INSERT INTO leads (nombre, telefono, email, tipo_cliente, especialidad_id, provincia, localidad, descripcion,
                        presupuesto, origen, consentimiento_at, politica_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    l.nombre.trim(),
    l.telefono.trim(),
    l.email.trim().toLowerCase(),
    l.tipoCliente,
    idEspecialidad(l.especialidad),
    l.provincia?.trim() || null,
    l.localidad?.trim() || null,
    l.descripcion.trim(),
    l.presupuesto?.trim() || null,
    l.origen ?? "formulario",
    ahora(),
    POLITICA_VERSION
  );
  return Number(res.lastInsertRowid);
}

/** Listado paginado con filtros. `total` es el número de resultados sin paginar. */
export function listarLeads(f: FiltrosLeads = {}): { items: Lead[]; total: number } {
  const where: string[] = [];
  const p: SQLInputValue[] = [];
  if (f.estado) (where.push("estado = ?"), p.push(f.estado));
  if (f.especialidadId) (where.push("especialidad_id = ?"), p.push(f.especialidadId));
  if (f.desde) (where.push("created_at >= ?"), p.push(f.desde));
  if (f.hasta) (where.push("created_at < ?"), p.push(f.hasta));
  if (f.busqueda?.trim()) {
    const q = `%${f.busqueda.trim().replace(/[%_\\]/g, c => "\\" + c)}%`;
    where.push(`(nombre LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR telefono LIKE ? ESCAPE '\\' OR localidad LIKE ? ESCAPE '\\' OR provincia LIKE ? ESCAPE '\\')`);
    p.push(q, q, q, q, q);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limite = Math.min(Math.max(f.limite ?? 500, 1), 5000);
  const offset = Math.max(f.offset ?? 0, 0);

  const total = Number(get(`SELECT count(*) AS n FROM v_leads ${w}`, ...p)?.n ?? 0);
  const items = all(`SELECT * FROM v_leads ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, ...p, limite, offset).map(aLead);
  return { items, total };
}

/** Ficha completa: datos, notas, historial de estados y despachos a los que se derivó. */
export function obtenerLead(id: number): LeadDetalle | null {
  const r = get("SELECT * FROM v_leads WHERE id = ?", id);
  if (!r) return null;
  return {
    ...aLead(r),
    notas: listarNotas(id),
    historial: all("SELECT * FROM lead_historial WHERE lead_id = ? ORDER BY created_at, id", id).map(h => ({
      id: Number(h.id),
      estadoAnterior: (h.estado_anterior ?? null) as EstadoLead | null,
      estadoNuevo: h.estado_nuevo as EstadoLead,
      createdAt: String(h.created_at),
    })),
    derivaciones: all(
      `SELECT d.*, s.nombre, s.usuario_id FROM lead_derivaciones d
       JOIN despachos s ON s.id = d.despacho_id WHERE d.lead_id = ? ORDER BY d.created_at`,
      id
    ).map(aDerivacion),
  };
}

/** Cambia el estado (el trigger guarda el historial). Marca `contactado_at` la primera vez que sale de "nuevo". */
export function actualizarEstadoLead(id: number, estado: EstadoLead): boolean {
  const res = run(
    `UPDATE leads SET estado = ?,
       contactado_at = CASE WHEN contactado_at IS NULL AND ? <> 'nuevo' THEN ? ELSE contactado_at END
     WHERE id = ?`,
    estado,
    estado,
    ahora(),
    id
  );
  return Number(res.changes) > 0;
}

/** Borra el lead y, en cascada, sus notas, historial y derivaciones (derecho de supresión). */
/**
 * Supresión de un lead (derecho de supresión o limpieza):
 * - si ningún abogado lo ha aceptado, se borra por completo (con notas, historial y ofertas);
 * - si alguno lo aceptó, se anonimiza: se borran los datos personales y las notas, pero se conserva
 *   el registro de a quién se comunicó y cuándo (prueba de la cesión y base de la facturación).
 */
export function eliminarLead(id: number): boolean {
  return transaccion(db(), () => {
    if (!get("SELECT 1 FROM leads WHERE id = ?", id)) return false;
    const aceptada = get("SELECT 1 FROM lead_derivaciones WHERE lead_id = ? AND estado = 'aceptada'", id);
    if (aceptada) anonimizarLeads("id = ?", id);
    else run("DELETE FROM leads WHERE id = ?", id);
    return true;
  });
}

/** Sustituye los datos personales por marcadores, borra las notas y cierra el lead. Mantiene fechas, especialidad, provincia y ofertas. */
function anonimizarLeads(condicion: string, ...p: SQLInputValue[]): number {
  run(`DELETE FROM lead_notas WHERE lead_id IN (SELECT id FROM leads WHERE ${condicion})`, ...p);
  return Number(
    run(
      `UPDATE leads SET nombre = '[suprimido]', telefono = '000000000', email = 'suprimido@invalid',
         descripcion = '[datos suprimidos]', localidad = NULL, presupuesto = NULL, origen = 'suprimido', estado = 'cerrado'
       WHERE ${condicion} AND origen <> 'suprimido'`,
      ...p
    ).changes
  );
}

/**
 * Plazo de conservación: los leads más antiguos que `dias` se borran si nadie los aceptó y se
 * anonimizan si algún abogado los aceptó (se conserva la prueba de la comunicación y la facturación).
 */
export function purgarLeadsAntiguos(dias: number): number {
  if (!Number.isFinite(dias) || dias <= 0) return 0;
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString();
  return transaccion(db(), () => {
    const conAceptada = "created_at < ? AND id IN (SELECT lead_id FROM lead_derivaciones WHERE estado = 'aceptada')";
    const anonimizados = anonimizarLeads(conAceptada, limite);
    const borrados = Number(
      run("DELETE FROM leads WHERE created_at < ? AND id NOT IN (SELECT lead_id FROM lead_derivaciones WHERE estado = 'aceptada')", limite).changes
    );
    return anonimizados + borrados;
  });
}

// ─── Notas ───────────────────────────────────────────────────────────────────

export function listarNotas(leadId: number): Nota[] {
  return all("SELECT * FROM lead_notas WHERE lead_id = ? ORDER BY created_at DESC, id DESC", leadId).map(n => ({
    id: Number(n.id),
    leadId: Number(n.lead_id),
    texto: String(n.texto),
    createdAt: String(n.created_at),
  }));
}

export function agregarNota(leadId: number, texto: string): number {
  return Number(run("INSERT INTO lead_notas (lead_id, texto) VALUES (?, ?)", leadId, texto.trim()).lastInsertRowid);
}

export function eliminarNota(id: number): boolean {
  return Number(run("DELETE FROM lead_notas WHERE id = ?", id).changes) > 0;
}

// ─── Despachos y derivaciones ────────────────────────────────────────────────

export type DatosDespacho = {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  colegio?: string | null;
  numColegiado?: string | null;
  activo?: boolean;
  especialidades?: string[]; // nombres
};

const SQL_DESPACHOS = `
  SELECT s.*,
    (SELECT group_concat(e.nombre, '|') FROM despacho_especialidades de JOIN especialidades e ON e.id = de.especialidad_id WHERE de.despacho_id = s.id) AS esp,
    (SELECT group_concat(p.provincia, '|') FROM despacho_provincias p WHERE p.despacho_id = s.id) AS prov
  FROM despachos s`;

const aDespacho = (r: Row): Despacho => ({
    id: Number(r.id),
    usuarioId: r.usuario_id == null ? null : Number(r.usuario_id),
    estado: (r.estado ?? "aprobado") as EstadoDespacho,
    motivoRechazo: str(r.motivo_rechazo),
    provincias: r.prov ? String(r.prov).split("|").sort() : [],
    nombre: String(r.nombre),
    email: str(r.email),
    telefono: str(r.telefono),
    colegio: str(r.colegio),
    numColegiado: str(r.num_colegiado),
    activo: r.activo === 1,
    especialidades: r.esp ? String(r.esp).split("|") : [],
});

/** Todos los despachos, o solo los que pueden recibir leads (activos y aprobados). */
export function listarDespachos(soloDisponibles = false): Despacho[] {
  return all(`${SQL_DESPACHOS} ${soloDisponibles ? "WHERE s.activo = 1 AND s.estado = 'aprobado'" : ""} ORDER BY s.nombre`).map(aDespacho);
}

/** Crea (sin `id`) o actualiza un despacho y sus especialidades. Devuelve su id. */
export function guardarDespacho(d: DatosDespacho, id?: number): number {
  return transaccion(db(), () => {
    const valores = [d.nombre.trim(), d.email ?? null, d.telefono ?? null, d.colegio ?? null, d.numColegiado ?? null, d.activo === false ? 0 : 1];
    let despachoId = id;
    if (despachoId) {
      run(`UPDATE despachos SET nombre = ?, email = ?, telefono = ?, colegio = ?, num_colegiado = ?, activo = ? WHERE id = ?`, ...valores, despachoId);
    } else {
      despachoId = Number(
        run(`INSERT INTO despachos (nombre, email, telefono, colegio, num_colegiado, activo) VALUES (?, ?, ?, ?, ?, ?)`, ...valores).lastInsertRowid
      );
    }
    if (d.especialidades) {
      run("DELETE FROM despacho_especialidades WHERE despacho_id = ?", despachoId);
      for (const nombre of d.especialidades) {
        run(
          `INSERT OR IGNORE INTO despacho_especialidades (despacho_id, especialidad_id)
           SELECT ?, id FROM especialidades WHERE nombre = ?`,
          despachoId,
          nombre
        );
      }
    }
    return despachoId;
  });
}

const aDerivacion = (d: Row): Derivacion => ({
  id: Number(d.id),
  despachoId: Number(d.despacho_id),
  despacho: String(d.nombre),
  registrado: d.usuario_id != null,
  estado: (d.estado ?? "aceptada") as EstadoOferta,
  createdAt: String(d.created_at),
  expiraAt: str(d.expira_at),
  respondidaAt: str(d.respondida_at),
  motivo: str(d.motivo),
});

const pasarAEnProceso = (leadId: number) => {
  if (get("SELECT estado FROM leads WHERE id = ?", leadId)?.estado === "nuevo") actualizarEstadoLead(leadId, "en_proceso");
};

/**
 * Derivación directa (despachos sin cuenta, que gestiona el admin a mano): queda registrada como
 * comunicación ya hecha ("aceptada") y pasa el lead a "en_proceso" si era nuevo.
 */
export function derivarLead(leadId: number, despachoId: number): void {
  transaccion(db(), () => {
    run("INSERT OR IGNORE INTO lead_derivaciones (lead_id, despacho_id, estado, respondida_at) VALUES (?, ?, 'aceptada', ?)", leadId, despachoId, ahora());
    pasarAEnProceso(leadId);
  });
}

/**
 * Quita una derivación. Solo si aún no se han comunicado los datos (oferta "enviada", rechazada o caducada)
 * o si es un despacho sin cuenta. Una oferta aceptada por un abogado registrado se conserva como registro de la cesión.
 */
export function quitarDerivacion(leadId: number, despachoId: number): boolean {
  return (
    Number(
      run(
        `DELETE FROM lead_derivaciones WHERE lead_id = ? AND despacho_id = ?
         AND (estado <> 'aceptada' OR despacho_id IN (SELECT id FROM despachos WHERE usuario_id IS NULL))`,
        leadId,
        despachoId
      ).changes
    ) > 0
  );
}

// ─── Eventos anónimos ────────────────────────────────────────────────────────

export function registrarEvento(tipo: TipoEvento, pagina?: string | null): void {
  run("INSERT INTO eventos (tipo, pagina) VALUES (?, ?)", tipo, pagina?.slice(0, 200) ?? null);
}

// ─── Estadísticas para el panel ──────────────────────────────────────────────

/** Resumen de los últimos `dias` días (por defecto 30) más totales históricos. */
export function obtenerEstadisticas(dias = 30) {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const porEstado = Object.fromEntries(ESTADOS.map(e => [e, 0])) as Record<EstadoLead, number>;
  for (const r of all("SELECT estado, count(*) AS n FROM leads GROUP BY estado")) porEstado[r.estado as EstadoLead] = Number(r.n);

  const eventos = Object.fromEntries(TIPOS_EVENTO.map(t => [t, 0])) as Record<TipoEvento, number>;
  for (const r of all("SELECT tipo, count(*) AS n FROM eventos WHERE created_at >= ? GROUP BY tipo", desde)) eventos[r.tipo as TipoEvento] = Number(r.n);

  const leadsPeriodo = Number(get("SELECT count(*) AS n FROM leads WHERE created_at >= ?", desde)?.n ?? 0);
  const tiempoMedio = get(
    `SELECT avg((julianday(contactado_at) - julianday(created_at)) * 24) AS h
     FROM leads WHERE contactado_at IS NOT NULL AND created_at >= ?`,
    desde
  )?.h;

  return {
    dias,
    total: Object.values(porEstado).reduce((a, b) => a + b, 0),
    porEstado,
    leadsPeriodo,
    porEspecialidad: all(
      `SELECT e.nombre AS especialidad, count(l.id) AS n FROM especialidades e
       LEFT JOIN leads l ON l.especialidad_id = e.id AND l.created_at >= ?
       GROUP BY e.id ORDER BY n DESC, e.orden`,
      desde
    ).map(r => ({ especialidad: String(r.especialidad), total: Number(r.n) })),
    porDia: all(
      `SELECT substr(created_at, 1, 10) AS dia, count(*) AS n FROM leads
       WHERE created_at >= ? GROUP BY dia ORDER BY dia`,
      desde
    ).map(r => ({ dia: String(r.dia), total: Number(r.n) })),
    eventos,
    /** Horas medias desde que entra un lead hasta que se marca como contactado. */
    horasHastaContacto: tiempoMedio == null ? null : Math.round(Number(tiempoMedio) * 10) / 10,
  };
}

// ─── Mantenimiento ───────────────────────────────────────────────────────────

/** Copia de seguridad consistente en caliente (crea un archivo .db nuevo en `destino`). */
export function copiaSeguridad(destino: string): void {
  mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
  db().prepare("VACUUM INTO ?").run(destino);
  soloPropietario(destino);
}

// ─── Ajustes internos ────────────────────────────────────────────────────────

/** Devuelve el valor guardado para `clave` o, si no existe, guarda y devuelve `crear()`. */
export function ajuste(clave: string, crear: () => string): string {
  const r = get("SELECT valor FROM ajustes WHERE clave = ?", clave);
  if (r) return String(r.valor);
  const valor = crear();
  run("INSERT INTO ajustes (clave, valor) VALUES (?, ?)", clave, valor);
  return valor;
}

export function guardarAjuste(clave: string, valor: string): void {
  run("INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor", clave, valor);
}

// ─── Usuarios, sesiones y recuperación de contraseña ─────────────────────────

export type Rol = "admin" | "abogado";
export type Usuario = { id: number; email: string; nombre: string; rol: Rol; activo: boolean; ultimoAcceso: string | null };

const aUsuario = (r: Row): Usuario => ({
  id: Number(r.id),
  email: String(r.email),
  nombre: String(r.nombre ?? ""),
  rol: r.rol as Rol,
  activo: r.activo === 1,
  ultimoAcceso: str(r.ultimo_acceso),
});

export function crearUsuario(u: { email: string; nombre?: string; rol: Rol; passwordHash: string }): number {
  return Number(
    run("INSERT INTO usuarios (email, nombre, rol, password_hash) VALUES (?, ?, ?, ?)", u.email.trim().toLowerCase(), u.nombre?.trim() ?? "", u.rol, u.passwordHash)
      .lastInsertRowid
  );
}

/** Usuario + hash de su contraseña (solo para comprobar el login). */
export function buscarUsuarioParaLogin(email: string): (Usuario & { passwordHash: string }) | null {
  const r = get("SELECT * FROM usuarios WHERE email = ?", email.trim().toLowerCase());
  return r ? { ...aUsuario(r), passwordHash: String(r.password_hash) } : null;
}

export function obtenerUsuario(id: number): Usuario | null {
  const r = get("SELECT * FROM usuarios WHERE id = ?", id);
  return r ? aUsuario(r) : null;
}

export function listarUsuarios(rol?: Rol): Usuario[] {
  return (rol ? all("SELECT * FROM usuarios WHERE rol = ? ORDER BY email", rol) : all("SELECT * FROM usuarios ORDER BY rol, email")).map(aUsuario);
}

export function obtenerHashUsuario(id: number): string | null {
  const r = get("SELECT password_hash FROM usuarios WHERE id = ?", id);
  return r ? String(r.password_hash) : null;
}

/** Cambia la contraseña y cierra todas las sesiones del usuario (salvo `conservarSesion`, la actual). */
export function cambiarPasswordUsuario(id: number, passwordHash: string, conservarSesion?: string): void {
  transaccion(db(), () => {
    run("UPDATE usuarios SET password_hash = ? WHERE id = ?", passwordHash, id);
    run("DELETE FROM sesiones WHERE usuario_id = ? AND token_hash IS NOT ?", id, conservarSesion ?? null);
  });
}

export function registrarAcceso(id: number): void {
  run("UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?", ahora(), id);
}

export function crearSesion(tokenHash: string, usuarioId: number, expiresAt: string): void {
  run("INSERT INTO sesiones (token_hash, usuario_id, expires_at) VALUES (?, ?, ?)", tokenHash, usuarioId, expiresAt);
}

/** Usuario de una sesión vigente y activa, o null. */
export function usuarioDeSesion(tokenHash: string): Usuario | null {
  const r = get(
    `SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.activo = 1`,
    tokenHash,
    ahora()
  );
  return r ? aUsuario(r) : null;
}

export function borrarSesion(tokenHash: string): void {
  run("DELETE FROM sesiones WHERE token_hash = ?", tokenHash);
}

export function crearRecuperacion(tokenHash: string, usuarioId: number, expiresAt: string): void {
  transaccion(db(), () => {
    // Solo vale el último enlace pedido.
    run("DELETE FROM recuperaciones WHERE usuario_id = ?", usuarioId);
    run("INSERT INTO recuperaciones (token_hash, usuario_id, expires_at) VALUES (?, ?, ?)", tokenHash, usuarioId, expiresAt);
  });
}

/** Marca el enlace como usado y devuelve su usuario, o null si no existe, caducó o ya se usó. */
export function consumirRecuperacion(tokenHash: string): number | null {
  const r = get("SELECT usuario_id FROM recuperaciones WHERE token_hash = ? AND usado_at IS NULL AND expires_at > ?", tokenHash, ahora());
  if (!r) return null;
  run("UPDATE recuperaciones SET usado_at = ? WHERE token_hash = ?", ahora(), tokenHash);
  return Number(r.usuario_id);
}

/** Limpieza diaria de sesiones y enlaces caducados. */
export function purgarAccesosCaducados(): void {
  const t = ahora();
  run("DELETE FROM sesiones WHERE expires_at <= ?", t);
  run("DELETE FROM recuperaciones WHERE expires_at <= ? OR usado_at IS NOT NULL", t);
}

// ─── Abogados registrados ────────────────────────────────────────────────────

export type NuevoAbogado = {
  email: string;
  passwordHash: string;
  nombre: string; // nombre del abogado o despacho
  telefono: string;
  colegio: string;
  numColegiado: string;
  especialidades: string[];
  provincias: string[];
  condicionesVersion: string;
};

export type Abogado = Despacho & {
  email: string;
  cuentaActiva: boolean;
  registradoAt: string;
  ultimoAcceso: string | null;
  /** Solicitudes recibidas por estado (sirve también para facturar las aceptadas). */
  ofertas: Record<EstadoOferta, number>;
};

function fijarRelaciones(despachoId: number, especialidades?: string[], provincias?: string[]) {
  if (especialidades) {
    run("DELETE FROM despacho_especialidades WHERE despacho_id = ?", despachoId);
    for (const nombre of especialidades)
      run("INSERT OR IGNORE INTO despacho_especialidades (despacho_id, especialidad_id) SELECT ?, id FROM especialidades WHERE nombre = ?", despachoId, nombre);
  }
  if (provincias) {
    run("DELETE FROM despacho_provincias WHERE despacho_id = ?", despachoId);
    for (const p of provincias) run("INSERT OR IGNORE INTO despacho_provincias (despacho_id, provincia) VALUES (?, ?)", despachoId, p);
  }
}

/** Alta de un abogado: crea su cuenta (rol abogado) y su ficha de despacho en estado "pendiente". */
export function registrarAbogado(a: NuevoAbogado): { usuarioId: number; despachoId: number } {
  return transaccion(db(), () => {
    const usuarioId = crearUsuario({ email: a.email, nombre: a.nombre, rol: "abogado", passwordHash: a.passwordHash });
    const despachoId = Number(
      run(
        `INSERT INTO despachos (nombre, email, telefono, colegio, num_colegiado, activo, usuario_id, estado, condiciones_at, condiciones_version)
         VALUES (?, ?, ?, ?, ?, 1, ?, 'pendiente', ?, ?)`,
        a.nombre.trim(),
        a.email.trim().toLowerCase(),
        a.telefono.trim(),
        a.colegio.trim(),
        a.numColegiado.trim(),
        usuarioId,
        ahora(),
        a.condicionesVersion
      ).lastInsertRowid
    );
    fijarRelaciones(despachoId, a.especialidades, a.provincias);
    return { usuarioId, despachoId };
  });
}

export function emailRegistrado(email: string): boolean {
  return !!get("SELECT 1 FROM usuarios WHERE email = ?", email.trim().toLowerCase());
}

/** Ficha de despacho de una cuenta de abogado. */
export function perfilAbogado(usuarioId: number): Despacho | null {
  const r = get(`${SQL_DESPACHOS} WHERE s.usuario_id = ?`, usuarioId);
  return r ? aDespacho(r) : null;
}

/** El abogado edita su ficha. Colegio y nº de colegiado solo mientras está pendiente de revisión. */
export function actualizarPerfilAbogado(
  usuarioId: number,
  d: { nombre: string; telefono: string; colegio?: string; numColegiado?: string; especialidades: string[]; provincias: string[] }
): boolean {
  return transaccion(db(), () => {
    const p = perfilAbogado(usuarioId);
    if (!p) return false;
    const editaColegio = p.estado === "pendiente";
    run(
      "UPDATE despachos SET nombre = ?, telefono = ?, colegio = ?, num_colegiado = ? WHERE id = ?",
      d.nombre.trim(),
      d.telefono.trim(),
      editaColegio && d.colegio ? d.colegio.trim() : p.colegio,
      editaColegio && d.numColegiado ? d.numColegiado.trim() : p.numColegiado,
      p.id
    );
    run("UPDATE usuarios SET nombre = ? WHERE id = ?", d.nombre.trim(), usuarioId);
    fijarRelaciones(p.id, d.especialidades, d.provincias);
    return true;
  });
}

/** Abogados registrados (con cuenta), opcionalmente por estado. Los pendientes primero. */
export function listarAbogados(estado?: EstadoDespacho): Abogado[] {
  return all(
    `SELECT x.*, u.email AS u_email, u.activo AS u_activo, u.created_at AS u_creado, u.ultimo_acceso AS u_acceso,
       (SELECT count(*) FROM lead_derivaciones d WHERE d.despacho_id = x.id AND d.estado = 'enviada') AS o_enviada,
       (SELECT count(*) FROM lead_derivaciones d WHERE d.despacho_id = x.id AND d.estado = 'aceptada') AS o_aceptada,
       (SELECT count(*) FROM lead_derivaciones d WHERE d.despacho_id = x.id AND d.estado = 'rechazada') AS o_rechazada,
       (SELECT count(*) FROM lead_derivaciones d WHERE d.despacho_id = x.id AND d.estado = 'caducada') AS o_caducada
     FROM (${SQL_DESPACHOS}) x JOIN usuarios u ON u.id = x.usuario_id
     ${estado ? "WHERE x.estado = ?" : ""}
     ORDER BY CASE x.estado WHEN 'pendiente' THEN 0 WHEN 'aprobado' THEN 1 ELSE 2 END, u.created_at DESC`,
    ...(estado ? [estado] : [])
  ).map(r => ({
    ...aDespacho(r),
    email: String(r.u_email),
    cuentaActiva: r.u_activo === 1,
    registradoAt: String(r.u_creado),
    ultimoAcceso: str(r.u_acceso),
    ofertas: { enviada: Number(r.o_enviada), aceptada: Number(r.o_aceptada), rechazada: Number(r.o_rechazada), caducada: Number(r.o_caducada) },
  }));
}

export function obtenerAbogado(despachoId: number): Abogado | null {
  return listarAbogados().find(a => a.id === despachoId) ?? null;
}

/** Aprobar o rechazar (con motivo). Devuelve false si no existe. */
export function revisarAbogado(despachoId: number, estado: "aprobado" | "rechazado", motivo?: string | null): boolean {
  return (
    Number(
      run(
        "UPDATE despachos SET estado = ?, motivo_rechazo = ? WHERE id = ? AND usuario_id IS NOT NULL",
        estado,
        estado === "rechazado" ? motivo?.trim() || null : null,
        despachoId
      ).changes
    ) > 0
  );
}

/** Activa o desactiva la cuenta del abogado (desactivar cierra sus sesiones y deja de recibir leads). */
export function activarAbogado(despachoId: number, activo: boolean): boolean {
  return transaccion(db(), () => {
    const r = get("SELECT usuario_id FROM despachos WHERE id = ? AND usuario_id IS NOT NULL", despachoId);
    if (!r) return false;
    const usuarioId = Number(r.usuario_id);
    run("UPDATE despachos SET activo = ? WHERE id = ?", activo ? 1 : 0, despachoId);
    run("UPDATE usuarios SET activo = ? WHERE id = ?", activo ? 1 : 0, usuarioId);
    if (!activo) run("DELETE FROM sesiones WHERE usuario_id = ?", usuarioId);
    return true;
  });
}

// ─── Ofertas a abogados (bandeja de entrada) ─────────────────────────────────

/** Solicitud tal como la ve el abogado: sin datos de contacto hasta que la acepta. */
export type Oferta = {
  id: number;
  leadId: number;
  estado: EstadoOferta;
  recibidaAt: string;
  expiraAt: string | null;
  respondidaAt: string | null;
  especialidad: string;
  provincia: string | null;
  localidad: string | null;
  tipoCliente: "particular" | "empresa";
  presupuesto: string | null;
  descripcion: string;
  /** Solo si la ha aceptado. */
  contacto: { nombre: string; telefono: string; email: string } | null;
};

/** Envía una oferta a un despacho con cuenta. false si ya se le había enviado ese lead. */
export function enviarOferta(leadId: number, despachoId: number, horas: number): boolean {
  return (
    Number(
      run(
        "INSERT OR IGNORE INTO lead_derivaciones (lead_id, despacho_id, estado, expira_at) VALUES (?, ?, 'enviada', ?)",
        leadId,
        despachoId,
        new Date(Date.now() + horas * 3_600_000).toISOString()
      ).changes
    ) > 0
  );
}

/** Bandeja del abogado: sus ofertas. Las pendientes ya vencidas se muestran como caducadas. */
export function listarOfertasAbogado(usuarioId: number): Oferta[] {
  const t = ahora();
  return all(
    `SELECT d.id, d.lead_id, d.estado, d.created_at, d.expira_at, d.respondida_at,
            l.provincia, l.localidad, l.tipo_cliente, l.presupuesto, l.descripcion, l.nombre, l.telefono, l.email, e.nombre AS especialidad
     FROM lead_derivaciones d
     JOIN despachos s ON s.id = d.despacho_id
     JOIN leads l ON l.id = d.lead_id
     JOIN especialidades e ON e.id = l.especialidad_id
     WHERE s.usuario_id = ?
     ORDER BY CASE d.estado WHEN 'enviada' THEN 0 WHEN 'aceptada' THEN 1 ELSE 2 END, d.created_at DESC`,
    usuarioId
  ).map(r => ({
    id: Number(r.id),
    leadId: Number(r.lead_id),
    estado: (r.estado === "enviada" && r.expira_at && String(r.expira_at) <= t ? "caducada" : r.estado) as EstadoOferta,
    recibidaAt: String(r.created_at),
    expiraAt: str(r.expira_at),
    respondidaAt: str(r.respondida_at),
    especialidad: String(r.especialidad),
    provincia: str(r.provincia),
    localidad: str(r.localidad),
    tipoCliente: r.tipo_cliente as Oferta["tipoCliente"],
    presupuesto: str(r.presupuesto),
    descripcion: String(r.descripcion),
    contacto: r.estado === "aceptada" ? { nombre: String(r.nombre), telefono: String(r.telefono), email: String(r.email) } : null,
  }));
}

export type RespuestaOferta =
  | { ok: true; leadId: number; despacho: string; cerradas: number }
  | { ok: false; motivo: "no_existe" | "no_pendiente" | "caducada" | "cuenta_no_aprobada" | "completo" };

/**
 * El abogado acepta o rechaza una oferta suya. Al aceptar:
 * - comprueba que sigue pendiente, sin caducar, y que su cuenta está aprobada y activa;
 * - respeta `maxAceptaciones` por lead; al llegar al tope, cierra ("caducada") las demás ofertas pendientes;
 * - pasa el lead a "en_proceso" si era nuevo.
 */
export function responderOferta(
  usuarioId: number,
  ofertaId: number,
  respuesta: "aceptada" | "rechazada",
  { motivo, maxAceptaciones = 1 }: { motivo?: string | null; maxAceptaciones?: number } = {}
): RespuestaOferta {
  return transaccion(db(), () => {
    const o = get(
      `SELECT d.*, s.nombre AS despacho, s.estado AS d_estado, s.activo AS d_activo FROM lead_derivaciones d
       JOIN despachos s ON s.id = d.despacho_id WHERE d.id = ? AND s.usuario_id = ?`,
      ofertaId,
      usuarioId
    );
    if (!o) return { ok: false, motivo: "no_existe" } as const;
    if (o.estado !== "enviada") return { ok: false, motivo: "no_pendiente" } as const;
    if (o.expira_at && String(o.expira_at) <= ahora()) {
      run("UPDATE lead_derivaciones SET estado = 'caducada' WHERE id = ?", ofertaId);
      return { ok: false, motivo: "caducada" } as const;
    }
    const leadId = Number(o.lead_id);

    if (respuesta === "rechazada") {
      run("UPDATE lead_derivaciones SET estado = 'rechazada', respondida_at = ?, motivo = ? WHERE id = ?", ahora(), motivo?.trim() || null, ofertaId);
      return { ok: true, leadId, despacho: String(o.despacho), cerradas: 0 } as const;
    }

    if (o.d_estado !== "aprobado" || o.d_activo !== 1) return { ok: false, motivo: "cuenta_no_aprobada" } as const;
    const aceptadas = Number(get("SELECT count(*) AS n FROM lead_derivaciones WHERE lead_id = ? AND estado = 'aceptada'", leadId)?.n ?? 0);
    if (aceptadas >= maxAceptaciones) {
      run("UPDATE lead_derivaciones SET estado = 'caducada', expira_at = ? WHERE id = ?", ahora(), ofertaId);
      return { ok: false, motivo: "completo" } as const;
    }
    run("UPDATE lead_derivaciones SET estado = 'aceptada', respondida_at = ? WHERE id = ?", ahora(), ofertaId);
    let cerradas = 0;
    if (aceptadas + 1 >= maxAceptaciones) {
      // Se cierran ya (no en su plazo): la fecha de cierre es ahora, para que el informe del mes la cuente bien.
      cerradas = Number(run("UPDATE lead_derivaciones SET estado = 'caducada', expira_at = ? WHERE lead_id = ? AND estado = 'enviada'", ahora(), leadId).changes);
    }
    pasarAEnProceso(leadId);
    return { ok: true, leadId, despacho: String(o.despacho), cerradas } as const;
  });
}

/** Marca como caducadas las ofertas pendientes vencidas. Devuelve los leads afectados (para reasignar). */
export function caducarOfertas(): number[] {
  const t = ahora();
  const leads = all("SELECT DISTINCT lead_id FROM lead_derivaciones WHERE estado = 'enviada' AND expira_at IS NOT NULL AND expira_at <= ?", t).map(r =>
    Number(r.lead_id)
  );
  if (leads.length) run("UPDATE lead_derivaciones SET estado = 'caducada' WHERE estado = 'enviada' AND expira_at IS NOT NULL AND expira_at <= ?", t);
  return leads;
}

/** Situación de las ofertas de un lead (para decidir si hay que reasignar). */
export function resumenOfertas(leadId: number): Record<EstadoOferta, number> {
  const r = Object.fromEntries((["enviada", "aceptada", "rechazada", "caducada"] as const).map(e => [e, 0])) as Record<EstadoOferta, number>;
  for (const x of all("SELECT estado, count(*) AS n FROM lead_derivaciones WHERE lead_id = ? GROUP BY estado", leadId)) r[x.estado as EstadoOferta] = Number(x.n);
  return r;
}

export type Candidato = { despachoId: number; nombre: string; registrado: boolean; especialidad: boolean; provincia: boolean; recientes: number };

/**
 * Despachos disponibles (aprobados y activos) que aún no tienen este lead, ordenados por encaje:
 * primero los que cubren especialidad y provincia; a igualdad, los que menos solicitudes han recibido en 30 días.
 */
export function candidatosParaLead(leadId: number): Candidato[] {
  const l = get("SELECT especialidad_id, provincia FROM leads WHERE id = ?", leadId);
  if (!l) return [];
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return all(
    `SELECT s.id, s.nombre, s.usuario_id,
       EXISTS (SELECT 1 FROM despacho_especialidades de WHERE de.despacho_id = s.id AND de.especialidad_id = ?) AS esp,
       EXISTS (SELECT 1 FROM despacho_provincias p WHERE p.despacho_id = s.id AND p.provincia = ?) AS prov,
       (SELECT count(*) FROM lead_derivaciones d WHERE d.despacho_id = s.id AND d.created_at >= ?) AS recientes
     FROM despachos s
     WHERE s.activo = 1 AND s.estado = 'aprobado'
       AND s.id NOT IN (SELECT despacho_id FROM lead_derivaciones WHERE lead_id = ?)
     ORDER BY (esp + prov) DESC, recientes ASC, s.nombre`,
    Number(l.especialidad_id),
    str(l.provincia),
    hace30,
    leadId
  ).map(r => ({
    despachoId: Number(r.id),
    nombre: String(r.nombre),
    registrado: r.usuario_id != null,
    especialidad: r.esp === 1,
    provincia: r.prov === 1,
    recientes: Number(r.recientes),
  }));
}

/** Email de la cuenta dueña de un despacho (para avisarle de una oferta), o null si no tiene cuenta. */
export function emailDespacho(despachoId: number): { email: string; nombre: string } | null {
  const r = get("SELECT u.email, s.nombre FROM despachos s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ? AND u.activo = 1", despachoId);
  return r ? { email: String(r.email), nombre: String(r.nombre) } : null;
}


// ─── Informe mensual por despacho (facturación manual) ───────────────────────

export type FilaInforme = {
  id: number;
  leadId: number;
  estado: EstadoOferta;
  /** Fecha que cuenta para el periodo: respuesta (aceptada/rechazada) o cierre (sin respuesta). */
  fecha: string;
  enviadaAt: string;
  especialidad: string;
  provincia: string | null;
  /** Solo en las aceptadas: el abogado ya conoce al cliente. En el resto no se incluye ningún dato del cliente. */
  cliente: string | null;
  motivo: string | null;
};

export type Informe = {
  despacho: { id: number; nombre: string; colegio: string | null; numColegiado: string | null; email: string | null; registrado: boolean };
  desde: string;
  hasta: string;
  filas: FilaInforme[];
  totales: { aceptada: number; rechazada: number; caducada: number };
};

/**
 * Actividad de un despacho en un periodo [desde, hasta): solicitudes aceptadas, rechazadas y sin respuesta.
 * Cuenta la fecha de respuesta (o la de cierre si no respondió). Las pendientes no entran.
 */
export function informeDespacho(despachoId: number, desde: string, hasta: string): Informe | null {
  const d = get(
    "SELECT s.id, s.nombre, s.colegio, s.num_colegiado, s.usuario_id, COALESCE(u.email, s.email) AS email FROM despachos s LEFT JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ?",
    despachoId
  );
  if (!d) return null;
  const filas = all(
    `SELECT x.*, e.nombre AS especialidad, l.provincia, l.nombre AS cliente
     FROM (SELECT d.*, COALESCE(d.respondida_at, d.expira_at, d.created_at) AS fecha_ref FROM lead_derivaciones d
           WHERE d.despacho_id = ? AND d.estado IN ('aceptada', 'rechazada', 'caducada')) x
     JOIN leads l ON l.id = x.lead_id
     JOIN especialidades e ON e.id = l.especialidad_id
     WHERE x.fecha_ref >= ? AND x.fecha_ref < ?
     ORDER BY x.fecha_ref, x.id`,
    despachoId,
    desde,
    hasta
  ).map(r => ({
    id: Number(r.id),
    leadId: Number(r.lead_id),
    estado: r.estado as EstadoOferta,
    fecha: String(r.fecha_ref),
    enviadaAt: String(r.created_at),
    especialidad: String(r.especialidad),
    provincia: str(r.provincia),
    cliente: r.estado === "aceptada" ? String(r.cliente) : null,
    motivo: r.estado === "rechazada" ? str(r.motivo) : null,
  }));
  const totales = { aceptada: 0, rechazada: 0, caducada: 0 };
  for (const f of filas) if (f.estado !== "enviada") totales[f.estado]++;
  return {
    despacho: {
      id: Number(d.id),
      nombre: String(d.nombre),
      colegio: str(d.colegio),
      numColegiado: str(d.num_colegiado),
      email: str(d.email),
      registrado: d.usuario_id != null,
    },
    desde,
    hasta,
    filas,
    totales,
  };
}
