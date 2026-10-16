import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { usuarioDePeticion } from "./auth";
import { ENV } from "./env";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const usuario = usuarioDePeticion(req);
  return { req, res, usuario, isAdmin: usuario?.rol === "admin" };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // Sin esto tRPC envía la traza (stack) si NODE_ENV no es "production". Solo en local con --dev.
  isDev: ENV.isDev,
  errorFormatter({ shape, error }) {
    if (ENV.isDev || error.code !== "INTERNAL_SERVER_ERROR") return shape;
    // En producción, un fallo interno no revela detalles (SQL, rutas, librerías...). El detalle queda en el log.
    const { stack: _stack, ...data } = shape.data as typeof shape.data & { stack?: string };
    return { ...shape, message: "Error interno. Inténtalo de nuevo más tarde.", data };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
/** Cualquier usuario con sesión (admin o abogado). */
export const userProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.usuario) throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión para continuar" });
  return next({ ctx: { ...ctx, usuario: ctx.usuario } });
});

/** Solo administradores. */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.usuario) throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión para continuar" });
  if (ctx.usuario.rol !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "No tienes permiso para esto" });
  return next({ ctx: { ...ctx, usuario: ctx.usuario } });
});
