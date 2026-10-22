import { MAX_ABOGADOS_DEFECTO, OFERTA_HORAS_DEFECTO } from "./condiciones";

// Carga `.env` y/o `configuracion.env` si existen (Node ≥ 20.12 lo trae integrado; en producción el hosting
// define las variables). Las variables que ya existen no se sobrescriben.
for (const archivo of [".env", "configuracion.env"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    /* no existe: se usan las variables del entorno */
  }
}

/** Configuración del servidor. Todas las variables están documentadas en `.env.example`. */
export const ENV = {
  /** El servidor arranca en modo desarrollo (Vite + recarga) solo con `--dev`. */
  isDev: process.argv.includes("--dev"),
  port: Number(process.env.PORT) || 3000,
  /** Interfaz de escucha. En desarrollo, solo este equipo (127.0.0.1) salvo que se indique otra. */
  host: process.env.HOST || (process.argv.includes("--dev") ? "127.0.0.1" : undefined),
  /**
   * Nº de proxies de confianza delante del servidor (para leer la IP real de X-Forwarded-For).
   * 1 en Render/Railway/Fly.io o detrás de un Nginx; 0 si el servidor está expuesto directamente
   * (si no, cualquiera podría falsear su IP y saltarse los límites de intentos).
   */
  trustProxy: process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY) || 0,
  /** Archivo SQLite. Debe estar en un disco persistente del hosting. */
  databasePath: process.env.DATABASE_PATH || "data/tebuscamos.db",
  /** Días que se conservan los leads antes de borrarse solos (0 = no borrar). */
  leadRetentionDays: Number(process.env.LEAD_RETENTION_DAYS) || 0,
  /** Usuario (email) del primer administrador. Por defecto "admin" para que sea fácil de recordar. */
  adminEmail: (process.env.ADMIN_EMAIL || "admin").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /** Dirección pública de la web (https://...), para los enlaces de los emails. */
  publicUrl: process.env.PUBLIC_URL ?? "",
  // Emails (opcional). Con el correo del hosting (SMTP) o con https://resend.com
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  // Bandeja de abogados
  /** Horas que tiene un abogado para aceptar o rechazar una solicitud antes de que caduque. */
  ofertaHoras: Math.max(1, Number(process.env.OFERTA_HORAS) || OFERTA_HORAS_DEFECTO),
  /** Cuántos abogados pueden aceptar un mismo lead (al llegar al tope se cierran las demás ofertas). */
  maxAbogadosPorLead: Math.max(1, Number(process.env.MAX_ABOGADOS_POR_LEAD) || MAX_ABOGADOS_DEFECTO),
  /** "1" = cada lead nuevo se envía solo a los abogados que encajan (especialidad + provincia). */
  repartoAutomatico: process.env.REPARTO_AUTOMATICO === "1",
  /** A cuántos abogados a la vez se envía cada lead en el reparto automático. */
  repartoAbogados: Math.max(1, Number(process.env.REPARTO_ABOGADOS) || 3),
  /** Email que recibe el aviso de cada lead nuevo (opcional). */
  notifyEmail: process.env.NOTIFY_EMAIL ?? "",
  // Avisos de nuevos leads (opcionales; si no hay ninguno, solo se registra en el log).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL ?? "",
  /** Origen del script de analítica (si hay), para permitirlo en la CSP. */
  analyticsOrigin: origen(process.env.VITE_ANALYTICS_SCRIPT_URL),
};

function origen(url?: string) {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/** Contraseña que solo existe en local con `--dev`. En producción se rechaza. */
const DEV_PASSWORD = "admin-local-1234";

// En local (`pnpm dev`) se puede arrancar sin .env: valores de prueba que NUNCA se usan en producción.
if (ENV.isDev) {
  if (!ENV.adminPassword) {
    ENV.adminPassword = DEV_PASSWORD;
    console.info(`[dev] Sin ADMIN_PASSWORD: entra en /dashboard con "${DEV_PASSWORD}".`);
  }
}

/** Falla al arrancar en producción si falta algo imprescindible; en desarrollo solo avisa. */
export function checkEnv() {
  // El modo desarrollo trae contraseña por defecto y Vite: nunca en un servidor de producción.
  if (ENV.isDev && process.env.NODE_ENV === "production") throw new Error("[config] --dev no se puede usar con NODE_ENV=production");
  const problems: string[] = [];
  if (ENV.adminPassword.length < 6) problems.push("ADMIN_PASSWORD es obligatoria (mínimo 6 caracteres)");
  if (ENV.publicUrl && !/^https?:\/\//.test(ENV.publicUrl)) problems.push("PUBLIC_URL debe empezar por https://");
  if (!ENV.isDev && ENV.adminPassword === DEV_PASSWORD) problems.push("ADMIN_PASSWORD no puede ser la contraseña de desarrollo");
  if (ENV.smtpHost && ![465, 587].includes(ENV.smtpPort)) problems.push("SMTP_PORT debe ser 465 (SSL) o 587 (STARTTLS)");
  if (ENV.notifyWebhookUrl && !ENV.notifyWebhookUrl.startsWith("https://")) problems.push("NOTIFY_WEBHOOK_URL debe empezar por https://");
  // El email es opcional: si falta algo, la web arranca igual y solo avisa (no se envían emails).
  if (ENV.smtpHost && (!ENV.smtpUser || !ENV.smtpPassword))
    console.warn("[config] Email por SMTP sin terminar: faltan SMTP_USER (el email del buzón) o SMTP_PASSWORD. No se enviarán emails.");
  if (problems.length === 0) return;
  const msg = `[config] ${problems.join("; ")}. Revisa .env.example.`;
  if (ENV.isDev) console.warn(msg);
  else throw new Error(msg);
}
