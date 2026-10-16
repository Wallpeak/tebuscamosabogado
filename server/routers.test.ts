import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ENV se lee al importar: definir las variables antes de cargar los módulos.
process.env.ADMIN_PASSWORD = "contraseña-de-prueba";

let appRouter: typeof import("./routers").appRouter;
let auth: typeof import("./auth");
let db: typeof import("./db");

beforeAll(async () => {
  ({ appRouter } = await import("./routers"));
  auth = await import("./auth");
  db = await import("./db");
  db.abrirBD(":memory:");
  auth.prepararAdminInicial();
});
afterAll(() => db.cerrarBD());

/** Llamador con petición simulada; si se pasa `cookie`, el contexto se construye como en el servidor real. */
function makeCaller(opts: { ip?: string; cookie?: string } = {}) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };
  const req = { ip: opts.ip ?? "1.1.1.1", headers: opts.cookie ? { cookie: opts.cookie } : {}, get: () => "localhost" } as unknown as Request;
  const usuario = auth.usuarioDePeticion(req);
  const caller = appRouter.createCaller({ req, res: res as unknown as Response, usuario, isAdmin: usuario?.rol === "admin" });
  return { caller, res };
}

const cookieDe = (res: { cookie: ReturnType<typeof vi.fn> }) => {
  const [name, token] = res.cookie.mock.calls[0];
  return `${name}=${token}`;
};

describe("auth", () => {
  it("rechaza una contraseña incorrecta", async () => {
    const { caller, res } = makeCaller({ ip: "2.2.2.2" });
    await expect(caller.auth.login({ email: "admin", password: "mala" })).rejects.toBeInstanceOf(TRPCError);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("con usuario y contraseña correctos abre una sesión de admin", async () => {
    const { caller, res } = makeCaller({ ip: "3.3.3.3" });
    await caller.auth.login({ email: "ADMIN", password: "contraseña-de-prueba" });
    const me = await makeCaller({ cookie: cookieDe(res) }).caller.auth.me();
    expect(me.isAdmin).toBe(true);
    expect(me.usuario?.email).toBe("admin");
  });

  it("bloquea tras 10 intentos fallidos", async () => {
    const { caller } = makeCaller({ ip: "4.4.4.4" });
    for (let i = 0; i < 10; i++) await caller.auth.login({ email: "admin", password: "mala" }).catch(() => {});
    await expect(caller.auth.login({ email: "admin", password: "contraseña-de-prueba" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("logout cierra la sesión en el servidor", async () => {
    const { caller, res } = makeCaller({ ip: "5.5.5.5" });
    await caller.auth.login({ email: "admin", password: "contraseña-de-prueba" });
    const cookie = cookieDe(res);
    const salir = makeCaller({ cookie });
    await salir.caller.auth.logout();
    expect(salir.res.clearCookie).toHaveBeenCalledWith(auth.SESSION_COOKIE, expect.any(Object));
    expect((await makeCaller({ cookie }).caller.auth.me()).usuario).toBeNull();
  });

  it("cambiar la contraseña exige la actual", async () => {
    const { caller, res } = makeCaller({ ip: "6.6.6.6" });
    await caller.auth.login({ email: "admin", password: "contraseña-de-prueba" });
    const dentro = makeCaller({ cookie: cookieDe(res) }).caller;
    await expect(dentro.auth.changePassword({ actual: "mala", nueva: "nueva-123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await dentro.auth.changePassword({ actual: "contraseña-de-prueba", nueva: "nueva-123" });
    await dentro.auth.changePassword({ actual: "nueva-123", nueva: "contraseña-de-prueba" });
  });

  it("recuperar contraseña responde igual exista o no la cuenta", async () => {
    await expect(makeCaller({ ip: "7.7.7.7" }).caller.auth.requestReset({ email: "nadie@example.com" })).resolves.toEqual({ ok: true });
    await expect(makeCaller().caller.auth.resetPassword({ token: "x".repeat(40), nueva: "abcdef" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

const lead = {
  nombre: "Ana",
  telefono: "+34 600 000 000",
  email: "ana@example.com",
  tipoCliente: "particular" as const,
  especialidad: "Civil",
  descripcion: "Descripción de prueba",
  aceptaPrivacidad: true as const,
  tiempoMs: 20_000,
};
const totalLeads = () => db.listarLeads().total;

describe("antispam del formulario", () => {
  it("guarda una solicitud normal", async () => {
    const antes = totalLeads();
    await makeCaller({ ip: "10.0.0.1" }).caller.leads.create(lead);
    expect(totalLeads()).toBe(antes + 1);
  });

  it("descarta en silencio si se rellena el campo trampa", async () => {
    const antes = totalLeads();
    await expect(makeCaller({ ip: "10.0.0.2" }).caller.leads.create({ ...lead, website: "http://spam" })).resolves.toEqual({ ok: true });
    expect(totalLeads()).toBe(antes);
  });

  it("descarta en silencio si se envía demasiado rápido", async () => {
    const antes = totalLeads();
    await makeCaller({ ip: "10.0.0.3" }).caller.leads.create({ ...lead, tiempoMs: 500 });
    expect(totalLeads()).toBe(antes);
  });

  it("limita los envíos por IP", async () => {
    const { caller } = makeCaller({ ip: "10.0.0.4" });
    for (let i = 0; i < 5; i++) await caller.leads.create(lead);
    await expect(caller.leads.create(lead)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("rechaza teléfonos con caracteres no válidos", async () => {
    await expect(makeCaller({ ip: "10.0.0.5" }).caller.leads.create({ ...lead, telefono: "<script>1234567" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("eventos", () => {
  it("el clic de WhatsApp ya no se puede registrar desde fuera (lo cuenta /api/whatsapp)", async () => {
    await expect(
      makeCaller().caller.eventos.track({ tipo: "click_whatsapp" as "visita" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("ignora en silencio el exceso de eventos de una misma IP", async () => {
    const { caller } = makeCaller({ ip: "10.0.0.9" });
    const visitas = () => db.obtenerEstadisticas(1).eventos.visita;
    const antes = visitas();
    for (let i = 0; i < 40; i++) await caller.eventos.track({ tipo: "visita", pagina: "/" });
    expect(visitas()).toBe(antes + 30);
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
