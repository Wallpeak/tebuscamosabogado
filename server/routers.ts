import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  abrirSesion,
  hashPassword,
  cambiarPassword,
  cerrarSesion,
  comprobarCredenciales,
  crearEnlaceRecuperacion,
  limiteRecuperacion,
  loginLimiter,
  PASSWORD_MIN,
  restablecerPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./auth";
import * as db from "./db";
import { enviarEmail, urlPublica } from "./email";
import { ENV } from "./env";
import { notifyNewLead } from "./notify";
import { enviarLead, repartirAutomatico } from "./reparto";
import { crearLimitador } from "./rateLimit";
import { CONDICIONES_ABOGADOS_VERSION, PRECIO_LEAD_EUR } from "./condiciones";
import { PROVINCIAS } from "./provincias";
import { abogadoProcedure, adminProcedure, publicProcedure, router, userProcedure } from "./trpc";

const id = z.number().int().positive();
const estado = z.enum(db.ESTADOS);
const opcional = (max: number) => z.string().trim().max(max).optional().nullable();

const passwordNueva = z.string().min(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres`).max(200);

const provincias = z.array(z.enum(PROVINCIAS)).min(1, "Elige al menos una provincia").max(PROVINCIAS.length);
const especialidadesAbogado = z.array(z.string().trim().min(1).max(100)).min(1, "Elige al menos una especialidad").max(50);
const telefono = z.string().trim().regex(/^\+?[\d\s().-]{9,20}$/, "Teléfono no válido");

/** Email a un abogado (no bloquea ni falla la petición). */
const avisarAbogado = (para: string, asunto: string, texto: string) => void enviarEmail({ para, asunto, texto: `${texto}\n\n— Te Buscamos Abogado` });

const ipDe = (ctx: { req: { ip?: string } }) => ctx.req.ip ?? "desconocida";

/** Límites por IP de los endpoints públicos (contra spam e inflado de estadísticas). */
export const limites = {
  formulario: crearLimitador({ max: 5, ventanaMs: 60 * 60 * 1000 }), // 5 solicitudes por hora
  eventos: crearLimitador({ max: 30, ventanaMs: 10 * 60 * 1000 }), // 30 eventos cada 10 min
  registroAbogados: crearLimitador({ max: 3, ventanaMs: 60 * 60 * 1000 }), // 3 altas por hora
};

/** Tiempo mínimo para rellenar el formulario: por debajo, casi seguro que es un robot. */
export const TIEMPO_MINIMO_MS = 3000;

/** Convierte "no encontrado" (false/null) en un 404 de tRPC. */
function existe<T>(valor: T, que = "Registro"): NonNullable<T> {
  if (valor === false || valor == null) throw new TRPCError({ code: "NOT_FOUND", message: `${que} no encontrado` });
  return valor as NonNullable<T>;
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ({ isAdmin: ctx.isAdmin, usuario: ctx.usuario })),

    login: publicProcedure
      .input(z.object({ email: z.string().trim().min(1).max(320), password: z.string().min(1).max(200) }))
      .mutation(({ ctx, input }) => {
        const ip = ipDe(ctx);
        if (loginLimiter.isBlocked(ip)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Prueba en 15 minutos." });
        }
        const usuario = comprobarCredenciales(input.email, input.password);
        if (!usuario) {
          loginLimiter.fail(ip);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contraseña incorrectos" });
        }
        loginLimiter.reset(ip);
        ctx.res.cookie(SESSION_COOKIE, abrirSesion(usuario.id), sessionCookieOptions);
        return { ok: true, rol: usuario.rol } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      cerrarSesion(ctx.req);
      const { maxAge: _maxAge, ...opts } = sessionCookieOptions;
      ctx.res.clearCookie(SESSION_COOKIE, opts);
      return { ok: true } as const;
    }),

    /** Cambiar la contraseña estando dentro (pide la actual). Cierra las sesiones de otros navegadores. */
    changePassword: userProcedure
      .input(z.object({ actual: z.string().min(1).max(200), nueva: passwordNueva }))
      .mutation(({ ctx, input }) => {
        if (!comprobarCredenciales(ctx.usuario.email, input.actual)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La contraseña actual no es correcta" });
        }
        cambiarPassword(ctx.usuario.id, input.nueva, ctx.req);
        return { ok: true } as const;
      }),

    /** "He olvidado mi contraseña": envía un enlace por email. Responde igual exista o no la cuenta. */
    requestReset: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ ctx, input }) => {
      if (!limiteRecuperacion.consumir(ipDe(ctx))) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Has pedido varios enlaces seguidos. Prueba dentro de una hora." });
      }
      const enlace = crearEnlaceRecuperacion(input.email);
      if (enlace) {
        const url = urlPublica(`/restablecer?token=${enlace.token}`, ctx.req.get("host"));
        if (!url) console.warn("[auth] Falta PUBLIC_URL: no se puede enviar el enlace de recuperación.");
        else
          await enviarEmail({
            para: enlace.usuario.email,
            asunto: "Cambia tu contraseña · Te Buscamos Abogado",
            texto: `Hola${enlace.usuario.nombre ? ` ${enlace.usuario.nombre}` : ""}:\n\nPara poner una contraseña nueva, abre este enlace (vale 1 hora y un solo uso):\n\n${url}\n\nSi no lo has pedido tú, ignora este mensaje: tu contraseña sigue igual.`,
          });
      }
      return { ok: true } as const;
    }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200), nueva: passwordNueva }))
      .mutation(({ input }) => {
        if (!restablecerPassword(input.token, input.nueva)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El enlace ha caducado o ya se usó. Pide uno nuevo." });
        }
        return { ok: true } as const;
      }),
  }),

  /** Públicos: los usa la web. */
  especialidades: router({
    list: publicProcedure.query(() => db.listarEspecialidades()),
  }),

  eventos: router({
    // Contadores anónimos (no se guarda la IP; solo se usa en memoria para el límite).
    // "formulario_enviado" lo registra el propio servidor ("click_whatsapp" queda solo por los datos antiguos).
    track: publicProcedure
      .input(z.object({ tipo: z.enum(["visita", "click_telefono"]), pagina: z.string().max(200).optional() }))
      .mutation(({ ctx, input }) => {
        // Por encima del límite se ignora en silencio: no es un error para el visitante.
        if (limites.eventos.consumir(ipDe(ctx))) db.registrarEvento(input.tipo, input.pagina);
        return { ok: true } as const;
      }),
  }),

  leads: router({
    create: publicProcedure
      .input(
        z.object({
          nombre: z.string().trim().min(1).max(255),
          telefono: z.string().trim().regex(/^\+?[\d\s().-]{9,20}$/, "Teléfono no válido"),
          email: z.string().trim().email().max(320),
          tipoCliente: z.enum(["particular", "empresa"]),
          especialidad: z.string().trim().min(1).max(100),
          provincia: z.enum(PROVINCIAS).optional().nullable(),
          localidad: opcional(120),
          descripcion: z.string().trim().min(10).max(2000),
          presupuesto: opcional(50),
          // Consentimiento expreso (casilla no premarcada): obligatorio para tratar y comunicar los datos.
          aceptaPrivacidad: z.literal(true),
          // Antispam: campo trampa invisible (las personas lo dejan vacío) y ms desde que se abrió el formulario.
          website: z.string().max(200).optional(),
          tiempoMs: z.number().int().min(0).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        if (!limites.formulario.consumir(ipDe(ctx))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Has enviado varias solicitudes seguidas. Prueba de nuevo más tarde." });
        }
        const { aceptaPrivacidad: _consent, website, tiempoMs, ...lead } = input;
        if (website || (tiempoMs !== undefined && tiempoMs < TIEMPO_MINIMO_MS)) {
          // Al robot se le responde "ok" para que no aprenda a esquivarlo; no se guarda nada.
          console.info("[antispam] Solicitud descartada");
          return { ok: true } as const;
        }
        const leadId = db.crearLead(lead);
        db.registrarEvento("formulario_enviado", "/");
        repartirAutomatico(leadId); // solo si REPARTO_AUTOMATICO=1
        // Minimización: el aviso no incluye la descripción del caso. No se espera ni puede romper la respuesta.
        void notifyNewLead(`Nuevo lead de ${input.especialidad}${input.provincia ? ` en ${input.provincia}` : ""}. Consulta el detalle en el panel privado.`);
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

    /** Despachos disponibles ordenados por encaje con el lead (especialidad, provincia, carga reciente). */
    candidatos: adminProcedure.input(id).query(({ input }) => db.candidatosParaLead(input)),

    /** Envía el lead: oferta a los abogados con cuenta; derivación directa a los despachos sin cuenta. */
    enviar: adminProcedure.input(z.object({ leadId: id, despachoIds: z.array(id).min(1).max(20) })).mutation(({ input }) => {
      existe(db.obtenerLead(input.leadId), "Lead");
      const r = enviarLead(input.leadId, input.despachoIds);
      if (!r.ofertas && !r.directas) throw new TRPCError({ code: "BAD_REQUEST", message: "Ninguno de esos despachos está disponible (activo y aprobado)" });
      return r;
    }),

    quitarDerivacion: adminProcedure.input(z.object({ leadId: id, despachoId: id })).mutation(({ input }) => {
      if (!db.quitarDerivacion(input.leadId, input.despachoId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede quitar: el abogado ya la aceptó y queda registrada la comunicación de datos" });
      }
      return { ok: true } as const;
    }),
  }),

  /** Área de abogados: registro público y ficha propia. */
  abogados: router({
    registro: publicProcedure
      .input(
        z.object({
          nombre: z.string().trim().min(2).max(255),
          email: z.string().trim().email().max(320),
          password: passwordNueva,
          telefono,
          colegio: z.string().trim().min(2).max(120),
          numColegiado: z.string().trim().min(1).max(40),
          especialidades: especialidadesAbogado,
          provincias,
          aceptaCondiciones: z.literal(true),
          website: z.string().max(200).optional(), // campo trampa
        })
      )
      .mutation(({ ctx, input }) => {
        if (!limites.registroAbogados.consumir(ipDe(ctx))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados registros seguidos. Prueba dentro de una hora." });
        }
        if (input.website) return { ok: true } as const; // robot: no se guarda nada
        if (db.emailRegistrado(input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese email. Entra o usa «¿Has olvidado la contraseña?»." });
        }
        const { usuarioId } = db.registrarAbogado({
          ...input,
          passwordHash: hashPassword(input.password),
          condicionesVersion: CONDICIONES_ABOGADOS_VERSION,
        });
        ctx.res.cookie(SESSION_COOKIE, abrirSesion(usuarioId), sessionCookieOptions);
        avisarAbogado(
          input.email,
          "Hemos recibido tu solicitud",
          `Hola ${input.nombre}:\n\nGracias por registrarte. Vamos a comprobar tus datos de colegiación y te avisaremos por email cuando tu cuenta esté aprobada.`
        );
        if (ENV.notifyEmail) {
          void enviarEmail({
            para: ENV.notifyEmail,
            asunto: "Nuevo abogado pendiente de revisión",
            texto: `${input.nombre} (${input.colegio}, nº ${input.numColegiado}) se ha registrado. Revísalo en el panel, pestaña «Abogados».`,
          });
        }
        return { ok: true } as const;
      }),

    perfil: abogadoProcedure.query(({ ctx }) => existe(db.perfilAbogado(ctx.usuario.id), "Perfil")),

    /** Bandeja: solicitudes recibidas. Sin datos de contacto hasta aceptarlas. */
    bandeja: abogadoProcedure.query(({ ctx }) => ({ ofertas: db.listarOfertasAbogado(ctx.usuario.id), horas: ENV.ofertaHoras, precio: PRECIO_LEAD_EUR })),

    responder: abogadoProcedure
      .input(z.object({ id, respuesta: z.enum(["aceptada", "rechazada"]), motivo: z.string().trim().max(300).optional() }))
      .mutation(({ ctx, input }) => {
        const r = db.responderOferta(ctx.usuario.id, input.id, input.respuesta, { motivo: input.motivo, maxAceptaciones: ENV.maxAbogadosPorLead });
        if (!r.ok) {
          const mensajes = {
            no_existe: "Esa solicitud no existe.",
            no_pendiente: "Ya respondiste a esta solicitud.",
            caducada: "El plazo para responder ha terminado.",
            completo: "Otro abogado ya ha aceptado esta solicitud.",
            cuenta_no_aprobada: "Tu cuenta aún no está aprobada.",
          } as const;
          throw new TRPCError({ code: r.motivo === "no_existe" ? "NOT_FOUND" : "BAD_REQUEST", message: mensajes[r.motivo] });
        }
        const lead = db.obtenerLead(r.leadId);
        if (input.respuesta === "aceptada") {
          if (ENV.notifyEmail && lead)
            void enviarEmail({ para: ENV.notifyEmail, asunto: "Solicitud aceptada", texto: `${r.despacho} ha aceptado el lead nº ${lead.id} (${lead.especialidad}). Detalle en el panel.` });
        } else {
          // Rechazada: con reparto automático se busca otro abogado; si no queda nadie, se avisa al admin.
          const nuevas = repartirAutomatico(r.leadId);
          const resumen = db.resumenOfertas(r.leadId);
          if (!nuevas && !resumen.enviada && !resumen.aceptada && ENV.notifyEmail && lead)
            void enviarEmail({ para: ENV.notifyEmail, asunto: "Lead sin abogado", texto: `Nadie ha aceptado el lead nº ${lead.id} (${lead.especialidad}). Revísalo en el panel.` });
        }
        return { ok: true } as const;
      }),

    actualizarPerfil: abogadoProcedure
      .input(
        z.object({
          nombre: z.string().trim().min(2).max(255),
          telefono,
          colegio: z.string().trim().min(2).max(120).optional(),
          numColegiado: z.string().trim().min(1).max(40).optional(),
          especialidades: especialidadesAbogado,
          provincias,
        })
      )
      .mutation(({ ctx, input }) => {
        existe(db.actualizarPerfilAbogado(ctx.usuario.id, input), "Perfil");
        return { ok: true } as const;
      }),

    /** Panel de administración. */
    list: adminProcedure
      .input(z.object({ estado: z.enum(["pendiente", "aprobado", "rechazado"]).optional() }).optional())
      .query(({ input }) => db.listarAbogados(input?.estado)),

    revisar: adminProcedure
      .input(z.object({ id, estado: z.enum(["aprobado", "rechazado"]), motivo: z.string().trim().max(500).optional() }))
      .mutation(({ input }) => {
        existe(db.revisarAbogado(input.id, input.estado, input.motivo), "Abogado");
        const a = db.obtenerAbogado(input.id);
        if (a) {
          const entrar = urlPublica("/abogados");
          if (input.estado === "aprobado")
            avisarAbogado(a.email, "Tu cuenta está aprobada", `Hola ${a.nombre}:\n\nHemos verificado tus datos y tu cuenta ya está activa.${entrar ? ` Entra en ${entrar}` : ""}`);
          else
            avisarAbogado(
              a.email,
              "No hemos podido aprobar tu cuenta",
              `Hola ${a.nombre}:\n\nNo hemos podido aprobar tu registro${input.motivo ? ` por este motivo: ${input.motivo}` : ""}. Puedes corregir tus datos desde tu área y escribirnos para revisarlo de nuevo.`
            );
        }
        return { ok: true } as const;
      }),

    activar: adminProcedure.input(z.object({ id, activo: z.boolean() })).mutation(({ input }) => {
      existe(db.activarAbogado(input.id, input.activo), "Abogado");
      return { ok: true } as const;
    }),
  }),

  despachos: router({
    list: adminProcedure.query(() => db.listarDespachos()),

    /** Informe de actividad de un despacho en un periodo (p. ej. un mes) para facturar a mano. */
    informe: adminProcedure
      .input(z.object({ despachoId: id, desde: z.string().datetime(), hasta: z.string().datetime() }))
      .query(({ input }) => {
        if (input.hasta <= input.desde) throw new TRPCError({ code: "BAD_REQUEST", message: "Periodo no válido" });
        return existe(db.informeDespacho(input.despachoId, input.desde, input.hasta), "Despacho");
      }),

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
