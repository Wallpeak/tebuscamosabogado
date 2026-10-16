import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { abrirBD, ajuste, purgarLeadsAntiguos } from "./db";
import { checkEnv, ENV } from "./env";
import { appRouter } from "./routers";
import { cabecerasSeguridad, filtroApi } from "./security";
import { createContext } from "./trpc";
import { crearRutaWhatsApp } from "./whatsapp";

async function main() {
  checkEnv();
  const publicDir = path.resolve(import.meta.dirname, "public");
  // La base de datos nunca dentro de la carpeta que se sirve en la web.
  if (path.resolve(ENV.databasePath).startsWith(publicDir + path.sep)) throw new Error("[config] DATABASE_PATH no puede estar dentro de la carpeta pública");
  abrirBD(ENV.databasePath); // crea el archivo y aplica el esquema si hace falta
  // Clave de las sesiones: si no se define JWT_SECRET, se genera una vez y se guarda en la BD
  // (así nadie tiene que configurarla y las sesiones sobreviven a los reinicios).
  if (!ENV.jwtSecret) ENV.jwtSecret = ajuste("jwt_secret", () => randomBytes(48).toString("base64url"));

  // Plazo de conservación (RGPD): borra cada día los leads más antiguos que LEAD_RETENTION_DAYS.
  if (ENV.leadRetentionDays > 0) {
    const purgar = () => {
      const n = purgarLeadsAntiguos(ENV.leadRetentionDays);
      if (n) console.info(`[bd] ${n} leads borrados por plazo de conservación`);
    };
    purgar();
    setInterval(purgar, 24 * 60 * 60 * 1000).unref();
  }

  const app = express();
  app.set("trust proxy", ENV.trustProxy); // nº de proxies del hosting delante (para IP real y https)
  app.disable("x-powered-by");
  app.use(cabecerasSeguridad({ produccion: !ENV.isDev, analyticsOrigin: ENV.analyticsOrigin }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/whatsapp", crearRutaWhatsApp(ENV.whatsappNumber));
  app.use(
    "/api/trpc",
    filtroApi,
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Fallos internos al log del servidor, sin los datos enviados (pueden ser personales).
      onError: ({ error, path: ruta }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[api] ${ruta ?? "?"}:`, error.cause ?? error);
      },
    })
  );
  // Cualquier otra ruta de /api: 404 en JSON (no la página de la web).
  app.use("/api", (_req, res) => res.status(404).json({ error: "No encontrado" }));

  if (ENV.isDev) {
    // Vite solo se carga en desarrollo: en producción no hace falta instalarlo.
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }

  // Errores no controlados: respuesta genérica, sin traza.
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 413 ? "Petición demasiado grande" : status === 500 ? "Error interno" : "Petición no válida" });
  });

  const onListen = () => {
    console.log(`Servidor en http://localhost:${ENV.port}/ (${ENV.isDev ? "desarrollo" : "producción"})`);
  };
  if (ENV.host) app.listen(ENV.port, ENV.host, onListen);
  else app.listen(ENV.port, onListen);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
