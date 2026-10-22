import type { Request, Response } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { cabecerasSeguridad, filtroApi, MAX_BATCH, politicaCsp } from "./security";

beforeAll(() => db.abrirBD(":memory:"));
afterAll(() => db.cerrarBD());

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
