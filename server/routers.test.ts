import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ENV se lee al importar: definir las variables antes de cargar los módulos.
process.env.JWT_SECRET = "s".repeat(40);
process.env.ADMIN_PASSWORD = "contraseña-de-prueba";

let appRouter: typeof import("./routers").appRouter;
let auth: typeof import("./auth");

beforeAll(async () => {
  ({ appRouter } = await import("./routers"));
  auth = await import("./auth");
});

function makeCaller(opts: { ip?: string; isAdmin?: boolean } = {}) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  const req = { ip: opts.ip ?? "1.1.1.1", headers: {} };
  const caller = appRouter.createCaller({
    req: req as unknown as Request,
    res: res as unknown as Response,
    isAdmin: opts.isAdmin ?? false,
  });
  return { caller, res };
}

describe("auth", () => {
  it("rechaza una contraseña incorrecta", async () => {
    const { caller, res } = makeCaller({ ip: "2.2.2.2" });
    await expect(caller.auth.login({ password: "mala" })).rejects.toBeInstanceOf(TRPCError);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("con la contraseña correcta crea una sesión válida", async () => {
    const { caller, res } = makeCaller({ ip: "3.3.3.3" });
    await caller.auth.login({ password: "contraseña-de-prueba" });
    expect(res.cookie).toHaveBeenCalledOnce();
    const [name, token] = res.cookie.mock.calls[0];
    const req = { headers: { cookie: `${name}=${token}` } } as unknown as Request;
    expect(await auth.isAdminRequest(req)).toBe(true);
  });

  it("bloquea tras 5 intentos fallidos", async () => {
    const { caller } = makeCaller({ ip: "4.4.4.4" });
    for (let i = 0; i < 5; i++) await caller.auth.login({ password: "mala" }).catch(() => {});
    await expect(caller.auth.login({ password: "contraseña-de-prueba" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("logout borra la cookie", async () => {
    const { caller, res } = makeCaller();
    await caller.auth.logout();
    expect(res.clearCookie).toHaveBeenCalledWith(auth.SESSION_COOKIE, expect.any(Object));
  });
});

describe("leads", () => {
  it("el listado exige sesión de administrador", async () => {
    const { caller } = makeCaller();
    await expect(caller.leads.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("el formulario exige aceptar la privacidad", async () => {
    const { caller } = makeCaller();
    await expect(
      caller.leads.create({
        nombre: "Ana",
        telefono: "600000000",
        email: "ana@example.com",
        tipoCliente: "particular",
        especialidad: "Civil",
        descripcion: "Descripción de prueba",
        aceptaPrivacidad: false as unknown as true,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
