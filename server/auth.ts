import { parse as parseCookie } from "cookie";
import type { CookieOptions, Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

/**
 * Acceso al panel: una única cuenta de administrador.
 * La contraseña está en ADMIN_PASSWORD y la sesión es un JWT firmado en una cookie httpOnly.
 */
export const SESSION_COOKIE = "tba_session";
const SESSION_HOURS = 12;

const secretKey = () => new TextEncoder().encode(ENV.jwtSecret);
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
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  if (!ENV.jwtSecret) return false;
  const token = parseCookie(req.headers.cookie ?? "")[SESSION_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Freno básico contra fuerza bruta: 5 intentos fallidos por IP cada 15 minutos (en memoria). */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const failures = new Map<string, { count: number; since: number }>();

export const loginLimiter = {
  isBlocked(ip: string) {
    const f = failures.get(ip);
    if (!f) return false;
    if (Date.now() - f.since > WINDOW_MS) {
      failures.delete(ip);
      return false;
    }
    return f.count >= MAX_FAILS;
  },
  fail(ip: string) {
    const f = failures.get(ip);
    if (!f || Date.now() - f.since > WINDOW_MS) failures.set(ip, { count: 1, since: Date.now() });
    else f.count++;
  },
  reset(ip: string) {
    failures.delete(ip);
  },
};
