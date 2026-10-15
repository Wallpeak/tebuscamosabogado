/**
 * Capa de datos: conexión a SQLite y todas las consultas de la web.
 *
 * - Motor: SQLite integrado en Node (`node:sqlite`, Node ≥ 22.13). Sin dependencias externas.
 * - Esquema: `server/schema.sql` (se aplica en cada arranque; es idempotente).
 * - Archivo: DATABASE_PATH (por defecto `data/tebuscamos.db`). Debe estar en un disco persistente.
 *
 * El resto del servidor solo habla con la BD a través de las funciones exportadas aquí.
 */
import { mkdirSync, readFileSync } from "node:fs";
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
export type Despacho = {
  id: number;
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
];

/** Abre (o devuelve) la conexión. `ruta` permite usar ':memory:' en tests. */
export function abrirBD(ruta = process.env.DATABASE_PATH || "data/tebuscamos.db"): DatabaseSync {
  if (_db) return _db;
  if (ruta !== ":memory:") mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });

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

export function listarDespachos(soloActivos = false): Despacho[] {
  return all(
    `SELECT s.*, group_concat(e.nombre, '|') AS esp FROM despachos s
     LEFT JOIN despacho_especialidades de ON de.despacho_id = s.id
     LEFT JOIN especialidades e ON e.id = de.especialidad_id
     ${soloActivos ? "WHERE s.activo = 1" : ""}
     GROUP BY s.id ORDER BY s.nombre`
  ).map(r => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    email: str(r.email),
    telefono: str(r.telefono),
    colegio: str(r.colegio),
    numColegiado: str(r.num_colegiado),
    activo: r.activo === 1,
    especialidades: r.esp ? String(r.esp).split("|") : [],
  }));
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
}
