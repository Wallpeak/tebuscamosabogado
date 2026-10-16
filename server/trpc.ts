import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { isAdminRequest } from "./auth";
import { ENV } from "./env";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  return { req, res, isAdmin: await isAdminRequest(req) };
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
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión para continuar" });
  return next();
});
