/**
 * Cuentas y sesiones (sin dependencias externas).
 *
 * - Contraseñas: hash scrypt con sal (nunca se guarda la contraseña).
 * - Sesión: token aleatorio en una cookie httpOnly; en la BD solo su hash. Dura 30 días por navegador.
 *   Cerrar sesión la borra; cambiar la contraseña cierra las demás sesiones del usuario.
 * - Primer administrador: se crea al arrancar con ADMIN_EMAIL (por defecto "admin") y ADMIN_PASSWORD.
 *   Si se cambia ADMIN_PASSWORD en el hosting, al reiniciar se aplica a esa cuenta (vía de rescate).
 */
import type { CookieOptions, Request } from "express";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as db from "./db";
import { ENV } from "./env";
import { crearLimitador } from "./rateLimit";

export const SESSION_COOKIE = "tba_session";
const SESSION_DIAS = 30;
const RECUPERACION_MINUTOS = 60;

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: !ENV.isDev,
  path: "/",
  maxAge: SESSION_DIAS * 24 * 60 * 60 * 1000,
};

// ─── Contraseñas ─────────────────────────────────────────────────────────────

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };
export const PASSWORD_MIN = 6;

export function hashPassword(password: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(password, sal, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export function verificarPassword(password: string, guardado: string): boolean {
  const [alg, N, r, p, sal, hash] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const calculado = scryptSync(password, Buffer.from(sal, "base64"), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(calculado, esperado);
}

/** Para no revelar si un email existe: se calcula un hash igual de lento aunque no haya usuario. */
const HASH_FALSO = hashPassword(randomBytes(12).toString("hex"));

// ─── Tokens y cookies ────────────────────────────────────────────────────────

const nuevoToken = () => randomBytes(32).toString("base64url");
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const dentroDe = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Lee una cookie de la cabecera sin dependencias. */
function leerCookie(req: Request, nombre: string): string | undefined {
  for (const parte of (req.headers.cookie ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

const tokenDe = (req: Request) => leerCookie(req, SESSION_COOKIE);

// ─── Sesiones ────────────────────────────────────────────────────────────────

/** Comprueba email y contraseña. Devuelve el usuario si son correctos y la cuenta está activa. */
export function comprobarCredenciales(email: string, password: string): db.Usuario | null {
  const u = db.buscarUsuarioParaLogin(email);
  const ok = verificarPassword(password, u?.passwordHash ?? HASH_FALSO);
  if (!u || !ok || !u.activo) return null;
  const { passwordHash: _hash, ...usuario } = u;
  return usuario;
}

/** Abre una sesión para el usuario y devuelve el token que va en la cookie. */
export function abrirSesion(usuarioId: number): string {
  const token = nuevoToken();
  db.crearSesion(hashToken(token), usuarioId, dentroDe(SESSION_DIAS * 86_400_000));
  db.registrarAcceso(usuarioId);
  return token;
}

export function usuarioDePeticion(req: Request): db.Usuario | null {
  const token = tokenDe(req);
  return token ? db.usuarioDeSesion(hashToken(token)) : null;
}

export function cerrarSesion(req: Request): void {
  const token = tokenDe(req);
  if (token) db.borrarSesion(hashToken(token));
}

/** Cambia la contraseña del usuario; mantiene abierta la sesión de esta petición y cierra las demás. */
export function cambiarPassword(usuarioId: number, nueva: string, req?: Request): void {
  const token = req ? tokenDe(req) : undefined;
  db.cambiarPasswordUsuario(usuarioId, hashPassword(nueva), token ? hashToken(token) : undefined);
}

// ─── Recuperación de contraseña ──────────────────────────────────────────────

/** Crea un enlace de un solo uso (60 min). Devuelve el token, o null si el email no corresponde a una cuenta activa. */
export function crearEnlaceRecuperacion(email: string): { token: string; usuario: db.Usuario } | null {
  const u = db.buscarUsuarioParaLogin(email);
  if (!u || !u.activo) return null;
  const token = nuevoToken();
  db.crearRecuperacion(hashToken(token), u.id, dentroDe(RECUPERACION_MINUTOS * 60_000));
  const { passwordHash: _hash, ...usuario } = u;
  return { token, usuario };
}

/** Usa el enlace: pone la contraseña nueva y cierra todas las sesiones. false si el enlace no vale. */
export function restablecerPassword(token: string, nueva: string): boolean {
  const usuarioId = db.consumirRecuperacion(hashToken(token));
  if (!usuarioId) return false;
  db.cambiarPasswordUsuario(usuarioId, hashPassword(nueva));
  return true;
}

// ─── Administrador inicial ───────────────────────────────────────────────────

/**
 * Crea el primer administrador con ADMIN_EMAIL / ADMIN_PASSWORD si no existe.
 * Si ADMIN_PASSWORD ha cambiado desde el último arranque, la aplica a esa cuenta
 * (así siempre se puede recuperar el acceso desde la configuración del hosting).
 */
export function prepararAdminInicial(): void {
  if (!ENV.adminPassword) return;
  const huella = createHash("sha256").update(`${ENV.adminEmail}\n${ENV.adminPassword}`).digest("hex");
  const existente = db.buscarUsuarioParaLogin(ENV.adminEmail);

  if (!existente) {
    db.crearUsuario({ email: ENV.adminEmail, nombre: "Administrador", rol: "admin", passwordHash: hashPassword(ENV.adminPassword) });
    console.info(`[auth] Creado el administrador "${ENV.adminEmail}".`);
  } else if (db.ajuste("admin_env_huella", () => huella) !== huella) {
    db.cambiarPasswordUsuario(existente.id, hashPassword(ENV.adminPassword));
    console.info(`[auth] ADMIN_PASSWORD ha cambiado: aplicada al usuario "${ENV.adminEmail}".`);
  }
  db.guardarAjuste("admin_env_huella", huella);
}

// ─── Freno contra fuerza bruta ───────────────────────────────────────────────

/** 10 intentos fallidos por IP cada 15 minutos (holgado para no bloquear a quien se equivoca). */
const fallosPorIp = crearLimitador({ max: 10, ventanaMs: 15 * 60 * 1000 });
/** Peticiones de "he olvidado mi contraseña": 5 por IP y hora. */
export const limiteRecuperacion = crearLimitador({ max: 5, ventanaMs: 60 * 60 * 1000 });

export const loginLimiter = {
  isBlocked: (ip: string) => fallosPorIp.agotado(ip),
  fail: (ip: string) => void fallosPorIp.consumir(ip),
  reset: (ip: string) => fallosPorIp.reset(ip),
};
