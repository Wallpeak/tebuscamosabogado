import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { createLead, getLeads, getLeadById, updateLeadStatus, deleteLead, getPaginaLegal, createOrUpdatePaginaLegal } from "./db";
import { z } from "zod";
import { notifyOwner } from "./_core/notification";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leads: router({
    create: publicProcedure
      .input(z.object({
        nombre: z.string().min(1).max(255),
        telefono: z.string().min(9).max(20),
        email: z.string().email().max(320),
        tipoCliente: z.enum(["particular", "empresa"]),
        especialidad: z.string().min(1).max(100),
        descripcion: z.string().min(10).max(2000),
        presupuesto: z.string().max(50).optional(),
        // Consentimiento expreso (casilla no premarcada): obligatorio para tratar y comunicar los datos.
        aceptaPrivacidad: z.literal(true),
      }))
      .mutation(async ({ input }) => {
        const lead = await createLead({
          nombre: input.nombre,
          telefono: input.telefono,
          email: input.email,
          tipoCliente: input.tipoCliente,
          especialidad: input.especialidad,
          descripcion: input.descripcion,
          presupuesto: input.presupuesto,
        });
        
        // Notify owner (minimización: no se envía la descripción del caso al servicio externo de notificaciones)
        await notifyOwner({
          title: "Nuevo Lead Recibido",
          content: `Nombre: ${input.nombre}\nEspecialidad: ${input.especialidad}\nConsulta el detalle en el panel privado.`,
        });
        
        return lead;
      }),
    
    list: protectedProcedure
      .use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized');
        return next({ ctx });
      })
      .input(z.object({
        estado: z.string().optional(),
        especialidad: z.string().optional(),
        tipoCliente: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getLeads(input);
      }),
    
    getById: protectedProcedure
      .use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized');
        return next({ ctx });
      })
      .input(z.number())
      .query(async ({ input }) => {
        return getLeadById(input);
      }),
    
    updateStatus: protectedProcedure
      .use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized');
        return next({ ctx });
      })
      .input(z.object({
        id: z.number(),
        estado: z.enum(["nuevo", "en_proceso", "cerrado"]),
      }))
      .mutation(async ({ input }) => {
        await updateLeadStatus(input.id, input.estado);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized');
        return next({ ctx });
      })
      .input(z.number())
      .mutation(async ({ input }) => {
        await deleteLead(input);
        return { success: true };
      }),
  }),
  
  // Endpoint público de testimonios eliminado: no se publican testimonios no verificados
  // (art. 20.2 TRLGDCU / Directiva (UE) 2019/2161). La tabla `testimonios` se conserva sin uso.

  paginasLegales: router({
    get: publicProcedure
      .input(z.enum(["aviso_legal", "privacidad", "cookies"]))
      .query(async ({ input }) => {
        return getPaginaLegal(input);
      }),
    
    createOrUpdate: protectedProcedure
      .use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized');
        return next({ ctx });
      })
      .input(z.object({
        tipo: z.enum(["aviso_legal", "privacidad", "cookies"]),
        contenido: z.string(),
      }))
      .mutation(async ({ input }) => {
        await createOrUpdatePaginaLegal(input.tipo, input.contenido);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
