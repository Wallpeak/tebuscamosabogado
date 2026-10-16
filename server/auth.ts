import { parse as parseCookie } from "cookie";
import type { CookieOptions, Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { crearLimitador } from "./rateLimit";

/**
 * Acceso al panel: una única cuenta de administrador.
 * La contraseña está en ADMIN_PASSWORD y la sesión es un JWT firmado en una cookie httpOnly.
 */
export const SESSION_COOKIE = "tba_session";
const SESSION_HOURS = 12;

/**
 * La clave de firma depende de JWT_SECRET *y* de la contraseña: si se cambia cualquiera de las dos,
 * todas las sesiones abiertas dejan de valer (útil si la contraseña se ha filtrado).
 */
const secretKey = () =>
  createHmac("sha256", ENV.jwtSecret).update(`sesion-panel:${createHash("sha256").update(ENV.adminPassword).digest("hex")}`).digest();
const sha256 = (s: string) => createHash("sha256").update(s).digest();

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: !ENV.isDev,
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
};

export function checkPassword(input: string): boolean {
  if (!ENV.adminPassword) return false;
  return timingSafeEqual(sha256(input), sha256(ENV.adminPassword));
}

export function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

/** Sesiones cerradas con "Cerrar sesión": jti → caducidad (s). En memoria hasta que el token caduca. */
const revocadas = new Map<string, number>();

async function leerSesion(req: Request) {
  if (!ENV.jwtSecret) return null;
  const token = parseCookie(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || !payload.jti || revocadas.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  return (await leerSesion(req)) !== null;
}

/** Invalida en el servidor el token de esta petición (no basta con borrar la cookie: alguien podría haberla copiado). */
export async function revokeSession(req: Request): Promise<void> {
  const s = await leerSesion(req);
  if (!s?.jti) return;
  const ahora = Date.now() / 1000;
  for (const [jti, exp] of revocadas) if (exp < ahora) revocadas.delete(jti);
  revocadas.set(s.jti, s.exp ?? ahora + SESSION_HOURS * 3600);
}

/**
 * Freno contra fuerza bruta (en memoria):
 * - 5 intentos fallidos por IP cada 15 minutos;
 * - 50 fallidos en total cada 15 minutos (por si alguien reparte el ataque entre muchas IPs).
 */
const fallosPorIp = crearLimitador({ max: 5, ventanaMs: 15 * 60 * 1000 });
const fallosGlobales = crearLimitador({ max: 50, ventanaMs: 15 * 60 * 1000 });

export const loginLimiter = {
  isBlocked: (ip: string) => fallosPorIp.agotado(ip) || fallosGlobales.agotado("*"),
  fail(ip: string) {
    fallosPorIp.consumir(ip);
    fallosGlobales.consumir("*");
  },
  reset: (ip: string) => fallosPorIp.reset(ip),
};
