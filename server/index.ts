import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import path from "node:path";
import { abrirBD, purgarLeadsAntiguos } from "./db";
import { checkEnv, ENV } from "./env";
import { appRouter } from "./routers";
import { createContext } from "./trpc";

async function main() {
  checkEnv();
  abrirBD(ENV.databasePath); // crea el archivo y aplica el esquema si hace falta

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
  app.set("trust proxy", 1); // detrás del proxy del hosting (para IP real y https)
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (ENV.isDev) {
    // Vite solo se carga en desarrollo: en producción no hace falta instalarlo.
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const publicDir = path.resolve(import.meta.dirname, "public");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }

  app.listen(ENV.port, () => {
    console.log(`Servidor en http://localhost:${ENV.port}/ (${ENV.isDev ? "desarrollo" : "producción"})`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
