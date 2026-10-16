/**
 * Endurecimiento HTTP sin dependencias: cabeceras de seguridad y filtros previos a la API.
 */
import type { NextFunction, Request, Response } from "express";

/**
 * Content-Security-Policy para la web compilada por Vite (todo el JS y CSS sale de /assets).
 * `style-src 'unsafe-inline'` es necesario porque algunos componentes (avisos, diálogos) insertan estilos.
 * En desarrollo no se aplica: Vite inyecta scripts en línea para la recarga en caliente.
 */
export function politicaCsp(analyticsOrigin = ""): string {
  const extra = analyticsOrigin ? ` ${analyticsOrigin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self'${extra}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${extra}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Cabeceras para todas las respuestas. */
export function cabecerasSeguridad({ produccion, analyticsOrigin = "" }: { produccion: boolean; analyticsOrigin?: string }) {
  const csp = politicaCsp(analyticsOrigin);
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (produccion) {
      res.setHeader("Content-Security-Policy", csp);
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }
    // Ni la API (datos personales) ni el panel deben quedarse en cachés ni en buscadores.
    if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
    if (req.path.startsWith("/api/") || req.path.startsWith("/dashboard")) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  };
}

/** Máximo de llamadas agrupadas en una sola petición tRPC (`/api/trpc/a,b,c?batch=1`). */
export const MAX_BATCH = 10;

/**
 * Filtro de la API tRPC (montar en "/api/trpc"):
 * - limita el agrupado de llamadas (evita multiplicar el trabajo por petición);
 * - en escrituras (POST) exige JSON y, si el navegador envía `Origin`, que sea esta misma web (anti-CSRF,
 *   además de la cookie SameSite=Lax).
 */
export function filtroApi(req: Request, res: Response, next: NextFunction) {
  const llamadas = req.path.replace(/^\//, "").split(",").length;
  if (llamadas > MAX_BATCH) return void res.status(400).json({ error: "Demasiadas llamadas en una sola petición" });

  if (req.method === "POST") {
    if (!req.is("application/json")) return void res.status(415).json({ error: "Se esperaba JSON" });
    const origin = req.get("origin");
    if (origin && !mismoOrigen(origin, req)) return void res.status(403).json({ error: "Origen no permitido" });
  }
  next();
}

function mismoOrigen(origin: string, req: Request) {
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const propios = [req.get("host"), ...(req.get("x-forwarded-host")?.split(",") ?? [])].map(h => h?.trim()).filter(Boolean);
  return propios.includes(host);
}
