/**
 * Botón de WhatsApp sin el número en la web: el botón enlaza a GET /api/whatsapp, que cuenta el clic
 * y redirige (302) a wa.me. El número (WHATSAPP_NUMBER) solo vive en el servidor, así que no aparece
 * en el HTML ni en el JavaScript y no lo recogen los robots que rastrean páginas.
 * Ojo: quien abre el chat sí ve el número en WhatsApp; para no exponer uno personal, usar un número dedicado.
 */
import type { Request, Response } from "express";
import * as db from "./db";
import { crearLimitador } from "./rateLimit";

export const MENSAJE_WHATSAPP = "Hola, me gustaría solicitar información sobre vuestros servicios de intermediación legal.";

/** Robots, rastreadores y generadores de vista previa: no reciben el número ni cuentan como clic. */
const BOT = /bot|crawl|spider|slurp|preview|scan|curl|wget|python|httpclient|headless|facebookexternalhit|whatsapp|telegram|discord|slack/i;
export const esBot = (ua: string | undefined) => !ua || BOT.test(ua);

export const urlWhatsApp = (numero: string, mensaje = MENSAJE_WHATSAPP) => `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

/** Página de origen del clic (solo rutas internas, para el contador del panel). */
const paginaValida = (p: unknown) => (typeof p === "string" && /^\/[\w\-/]{0,199}$/.test(p) ? p : "/");

export function crearRutaWhatsApp(numero: string, limite = crearLimitador({ max: 10, ventanaMs: 10 * 60 * 1000 })) {
  return (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.type("text/plain; charset=utf-8");

    if (!numero) return void res.status(404).send("WhatsApp no está disponible ahora mismo.");
    if (esBot(req.get("user-agent"))) return void res.status(403).send("No disponible.");
    if (!limite.consumir(req.ip ?? "desconocida")) {
      res.setHeader("Retry-After", String(limite.segundosRestantes(req.ip ?? "desconocida")));
      return void res.status(429).send("Demasiados intentos. Prueba de nuevo en unos minutos.");
    }

    if (req.method === "GET") db.registrarEvento("click_whatsapp", paginaValida(req.query.p));
    res.redirect(302, urlWhatsApp(numero));
  };
}
