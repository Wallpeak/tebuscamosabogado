import type { Request, Response } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { crearLimitador } from "./rateLimit";
import { cabecerasSeguridad, filtroApi, MAX_BATCH, politicaCsp } from "./security";
import { crearRutaWhatsApp, esBot, urlWhatsApp } from "./whatsapp";

beforeAll(() => db.abrirBD(":memory:"));
afterAll(() => db.cerrarBD());

const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Petición y respuesta mínimas de Express para probar middlewares sin servidor. */
function mock(opts: { path?: string; method?: string; headers?: Record<string, string>; query?: Record<string, string>; ip?: string } = {}) {
  const headers = Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const req = {
    path: opts.path ?? "/",
    method: opts.method ?? "GET",
    ip: opts.ip ?? "1.1.1.1",
    query: opts.query ?? {},
    headers,
    get: (h: string) => headers[h.toLowerCase()],
    is: (t: string) => (headers["content-type"]?.startsWith(t) ? t : false),
  };
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    location: "",
    body: undefined as unknown,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    type() {
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    send(b: unknown) {
      this.body = b;
      return this;
    },
    redirect(c: number, url: string) {
      this.statusCode = c;
      this.location = url;
    },
  };
  return { req: req as unknown as Request, res: res as typeof res & Response };
}

describe("cabeceras de seguridad", () => {
  it("en producción incluye CSP, HSTS y las básicas", () => {
    const { req, res } = mock({ path: "/" });
    const next = vi.fn();
    cabecerasSeguridad({ produccion: true })(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
  });

  it("en desarrollo no aplica CSP (Vite usa scripts en línea)", () => {
    const { req, res } = mock();
    cabecerasSeguridad({ produccion: false })(req, res, vi.fn());
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });

  it("la API no se guarda en caché", () => {
    const { req, res } = mock({ path: "/api/trpc/leads.list" });
    cabecerasSeguridad({ produccion: true })(req, res, vi.fn());
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("permite el origen de la analítica si se configura", () => {
    expect(politicaCsp("https://stats.example.com")).toContain("script-src 'self' https://stats.example.com");
  });
});

describe("filtro de la API", () => {
  it("rechaza lotes demasiado grandes", () => {
    const { req, res } = mock({ path: "/" + Array(MAX_BATCH + 1).fill("auth.me").join(",") });
    const next = vi.fn();
    filtroApi(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza escrituras desde otra web (CSRF)", () => {
    const { req, res } = mock({
      method: "POST",
      path: "/leads.delete",
      headers: { host: "tebuscamosabogado.es", origin: "https://malo.example", "content-type": "application/json" },
    });
    filtroApi(req, res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("rechaza escrituras que no son JSON", () => {
    const { req, res } = mock({ method: "POST", path: "/auth.login", headers: { host: "x.es", "content-type": "text/plain" } });
    filtroApi(req, res, vi.fn());
    expect(res.statusCode).toBe(415);
  });

  it("deja pasar las peticiones de la propia web", () => {
    const { req, res } = mock({
      method: "POST",
      path: "/leads.create",
      headers: { host: "tebuscamosabogado.es", origin: "https://tebuscamosabogado.es", "content-type": "application/json" },
    });
    const next = vi.fn();
    filtroApi(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("botón de WhatsApp (/api/whatsapp)", () => {
  const numero = "34600111222";
  const clics = () => db.obtenerEstadisticas(1).eventos.click_whatsapp;

  it("redirige a wa.me con el mensaje, sin caché, y cuenta el clic", () => {
    const antes = clics();
    const { req, res } = mock({ headers: { "user-agent": NAVEGADOR }, query: { p: "/" } });
    crearRutaWhatsApp(numero)(req, res);
    expect(res.statusCode).toBe(302);
    expect(res.location).toBe(urlWhatsApp(numero));
    expect(res.location).toContain("?text=");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(clics()).toBe(antes + 1);
  });

  it("a los robots no les da el número ni cuenta el clic", () => {
    const antes = clics();
    for (const ua of ["Googlebot/2.1", "curl/8.0", "facebookexternalhit/1.1", ""]) {
      const { req, res } = mock({ headers: ua ? { "user-agent": ua } : {} });
      crearRutaWhatsApp(numero)(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.location).toBe("");
    }
    expect(clics()).toBe(antes);
    expect(esBot(NAVEGADOR)).toBe(false);
  });

  it("limita las peticiones por IP", () => {
    const ruta = crearRutaWhatsApp(numero, crearLimitador({ max: 2, ventanaMs: 60_000 }));
    const codigos = [1, 2, 3].map(() => {
      const { req, res } = mock({ headers: { "user-agent": NAVEGADOR }, ip: "9.9.9.9" });
      ruta(req, res);
      return res.statusCode;
    });
    expect(codigos).toEqual([302, 302, 429]);
  });

  it("sin WHATSAPP_NUMBER responde 404", () => {
    const { req, res } = mock({ headers: { "user-agent": NAVEGADOR } });
    crearRutaWhatsApp("")(req, res);
    expect(res.statusCode).toBe(404);
  });
});
