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
export const POLITICA_VERSION = "2026-10-15";

export type NuevoLead = {
  nombre: string;
  telefono: string;
  email: string;
  tipoCliente: "particular" | "empresa";
  especialidad: string; // nombre, p. ej. "Familia"
  descripcion: string;
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
export type Derivacion = { id: number; despachoId: number; despacho: string; createdAt: string };
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
    `INSERT INTO leads (nombre, telefono, email, tipo_cliente, especialidad_id, localidad, descripcion,
                        presupuesto, origen, consentimiento_at, politica_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    l.nombre.trim(),
    l.telefono.trim(),
    l.email.trim().toLowerCase(),
    l.tipoCliente,
    idEspecialidad(l.especialidad),
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
    where.push(`(nombre LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR telefono LIKE ? ESCAPE '\\' OR localidad LIKE ? ESCAPE '\\')`);
    p.push(q, q, q, q);
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
      `SELECT d.id, d.despacho_id, d.created_at, s.nombre FROM lead_derivaciones d
       JOIN despachos s ON s.id = d.despacho_id WHERE d.lead_id = ? ORDER BY d.created_at`,
      id
    ).map(d => ({ id: Number(d.id), despachoId: Number(d.despacho_id), despacho: String(d.nombre), createdAt: String(d.created_at) })),
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
export function eliminarLead(id: number): boolean {
  return Number(run("DELETE FROM leads WHERE id = ?", id).changes) > 0;
}

/** Borra los leads más antiguos que `dias` (plazo de conservación). Devuelve cuántos borró. */
export function purgarLeadsAntiguos(dias: number): number {
  if (!Number.isFinite(dias) || dias <= 0) return 0;
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString();
  return Number(run("DELETE FROM leads WHERE created_at < ?", limite).changes);
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

/** Registra que los datos del lead se comunicaron a un despacho (y lo pasa a "en_proceso" si era nuevo). */
export function derivarLead(leadId: number, despachoId: number): void {
  transaccion(db(), () => {
    run("INSERT OR IGNORE INTO lead_derivaciones (lead_id, despacho_id) VALUES (?, ?)", leadId, despachoId);
    const r = get("SELECT estado FROM leads WHERE id = ?", leadId);
    if (r?.estado === "nuevo") actualizarEstadoLead(leadId, "en_proceso");
  });
}

export function quitarDerivacion(leadId: number, despachoId: number): boolean {
  return Number(run("DELETE FROM lead_derivaciones WHERE lead_id = ? AND despacho_id = ?", leadId, despachoId).changes) > 0;
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

export type Abogado = Despacho & { email: string; cuentaActiva: boolean; registradoAt: string; ultimoAcceso: string | null };

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
    `SELECT x.*, u.email AS u_email, u.activo AS u_activo, u.created_at AS u_creado, u.ultimo_acceso AS u_acceso
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
