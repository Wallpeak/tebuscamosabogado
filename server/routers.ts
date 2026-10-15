import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { checkPassword, createSessionToken, loginLimiter, SESSION_COOKIE, sessionCookieOptions } from "./auth";
import * as db from "./db";
import { notifyNewLead } from "./notify";
import { adminProcedure, publicProcedure, router } from "./trpc";

const id = z.number().int().positive();
const estado = z.enum(db.ESTADOS);
const opcional = (max: number) => z.string().trim().max(max).optional().nullable();

/** Convierte "no encontrado" (false/null) en un 404 de tRPC. */
function existe<T>(valor: T, que = "Registro"): NonNullable<T> {
  if (valor === false || valor == null) throw new TRPCError({ code: "NOT_FOUND", message: `${que} no encontrado` });
  return valor as NonNullable<T>;
}

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

  /** Públicos: los usa la web. */
  especialidades: router({
    list: publicProcedure.query(() => db.listarEspecialidades()),
  }),

  eventos: router({
    // Contadores anónimos (sin IP ni identificadores). "formulario_enviado" lo registra el servidor.
    track: publicProcedure
      .input(z.object({ tipo: z.enum(["visita", "click_whatsapp", "click_telefono"]), pagina: z.string().max(200).optional() }))
      .mutation(({ input }) => {
        db.registrarEvento(input.tipo, input.pagina);
        return { ok: true } as const;
      }),
  }),

  leads: router({
    create: publicProcedure
      .input(
        z.object({
          nombre: z.string().trim().min(1).max(255),
          telefono: z.string().trim().min(9).max(20),
          email: z.string().trim().email().max(320),
          tipoCliente: z.enum(["particular", "empresa"]),
          especialidad: z.string().trim().min(1).max(100),
          localidad: opcional(120),
          descripcion: z.string().trim().min(10).max(2000),
          presupuesto: opcional(50),
          // Consentimiento expreso (casilla no premarcada): obligatorio para tratar y comunicar los datos.
          aceptaPrivacidad: z.literal(true),
        })
      )
      .mutation(({ input }) => {
        const { aceptaPrivacidad: _consent, ...lead } = input;
        db.crearLead(lead);
        db.registrarEvento("formulario_enviado", "/");
        // Minimización: el aviso no incluye la descripción del caso. No se espera ni puede romper la respuesta.
        void notifyNewLead(`Nuevo lead: ${input.nombre} · ${input.especialidad}. Consulta el detalle en el panel privado.`);
        return { ok: true } as const;
      }),

    /** Privados: panel de administración. */
    list: adminProcedure
      .input(
        z
          .object({
            estado: estado.optional(),
            especialidadId: id.optional(),
            desde: z.string().datetime().optional(),
            hasta: z.string().datetime().optional(),
            busqueda: z.string().max(100).optional(),
            limite: z.number().int().min(1).max(5000).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional()
      )
      .query(({ input }) => db.listarLeads(input)),

    detail: adminProcedure.input(id).query(({ input }) => existe(db.obtenerLead(input), "Lead")),

    updateStatus: adminProcedure.input(z.object({ id, estado })).mutation(({ input }) => {
      existe(db.actualizarEstadoLead(input.id, input.estado), "Lead");
      return { ok: true } as const;
    }),

    delete: adminProcedure.input(id).mutation(({ input }) => {
      existe(db.eliminarLead(input), "Lead");
      return { ok: true } as const;
    }),

    addNote: adminProcedure
      .input(z.object({ leadId: id, texto: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => {
        existe(db.obtenerLead(input.leadId), "Lead");
        return { id: db.agregarNota(input.leadId, input.texto) };
      }),

    deleteNote: adminProcedure.input(id).mutation(({ input }) => {
      existe(db.eliminarNota(input), "Nota");
      return { ok: true } as const;
    }),

    derivar: adminProcedure.input(z.object({ leadId: id, despachoId: id })).mutation(({ input }) => {
      existe(db.obtenerLead(input.leadId), "Lead");
      db.derivarLead(input.leadId, input.despachoId);
      return { ok: true } as const;
    }),

    quitarDerivacion: adminProcedure.input(z.object({ leadId: id, despachoId: id })).mutation(({ input }) => {
      existe(db.quitarDerivacion(input.leadId, input.despachoId), "Derivación");
      return { ok: true } as const;
    }),
  }),

  despachos: router({
    list: adminProcedure.query(() => db.listarDespachos()),

    save: adminProcedure
      .input(
        z.object({
          id: id.optional(),
          nombre: z.string().trim().min(1).max(255),
          email: z.string().trim().email().max(320).optional().nullable(),
          telefono: opcional(20),
          colegio: opcional(120),
          numColegiado: opcional(40),
          activo: z.boolean().optional(),
          especialidades: z.array(z.string().max(100)).max(50).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id: despachoId, ...datos } = input;
        return { id: db.guardarDespacho(datos, despachoId) };
      }),
  }),

  stats: adminProcedure
    .input(z.object({ dias: z.number().int().min(1).max(3650).default(30) }).optional())
    .query(({ input }) => db.obtenerEstadisticas(input?.dias ?? 30)),
});

export type AppRouter = typeof appRouter;
