import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { isAdminRequest } from "./auth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  return { req, res, isAdmin: await isAdminRequest(req) };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión para continuar" });
  return next();
});
