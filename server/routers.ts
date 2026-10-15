import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { checkPassword, createSessionToken, loginLimiter, SESSION_COOKIE, sessionCookieOptions } from "./auth";
import { createLead, deleteLead, getLeads, updateLeadStatus } from "./db";
import { notifyNewLead } from "./notify";
import { adminProcedure, publicProcedure, router } from "./trpc";

const estadoSchema = z.enum(["nuevo", "en_proceso", "cerrado"]);

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ({ isAdmin: ctx.isAdmin })),

    login: publicProcedure
      .input(z.object({ password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip ?? "desconocida";
        if (loginLimiter.isBlocked(ip)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Prueba en 15 minutos." });
        }
        if (!checkPassword(input.password)) {
          loginLimiter.fail(ip);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Contraseña incorrecta" });
        }
        loginLimiter.reset(ip);
        ctx.res.cookie(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
        return { ok: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const { maxAge: _maxAge, ...opts } = sessionCookieOptions;
      ctx.res.clearCookie(SESSION_COOKIE, opts);
      return { ok: true } as const;
    }),
  }),

  leads: router({
    create: publicProcedure
      .input(
        z.object({
          nombre: z.string().min(1).max(255),
          telefono: z.string().min(9).max(20),
          email: z.string().email().max(320),
          tipoCliente: z.enum(["particular", "empresa"]),
          especialidad: z.string().min(1).max(100),
          descripcion: z.string().min(10).max(2000),
          presupuesto: z.string().max(50).optional(),
          // Consentimiento expreso (casilla no premarcada): obligatorio para tratar y comunicar los datos.
          aceptaPrivacidad: z.literal(true),
        })
      )
      .mutation(async ({ input }) => {
        const { aceptaPrivacidad: _consent, ...lead } = input;
        await createLead(lead);
        // Minimización: el aviso no incluye la descripción del caso. No se espera ni puede romper la respuesta.
        void notifyNewLead(
          `Nuevo lead: ${input.nombre} · ${input.especialidad}. Consulta el detalle en el panel privado.`
        );
        return { ok: true } as const;
      }),

    list: adminProcedure.query(() => getLeads()),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number().int(), estado: estadoSchema }))
      .mutation(async ({ input }) => {
        await updateLeadStatus(input.id, input.estado);
        return { ok: true } as const;
      }),

    delete: adminProcedure.input(z.number().int()).mutation(async ({ input }) => {
      await deleteLead(input);
      return { ok: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
