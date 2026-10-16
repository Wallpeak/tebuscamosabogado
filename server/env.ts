// Carga `.env` si existe (Node ≥ 20.12 lo trae integrado; en producción el hosting define las variables).
try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usan las variables del entorno */
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
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  // Avisos de nuevos leads (opcionales; si no hay ninguno, solo se registra en el log).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL ?? "",
  /** Número de WhatsApp (solo dígitos, con prefijo de país). Vive solo en el servidor: nunca en el código de la web. */
  whatsappNumber: (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "").replace(/^00/, ""),
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
  // JWT_SECRET es opcional: si falta, el servidor genera uno y lo guarda en la base de datos.
  if (ENV.jwtSecret && ENV.jwtSecret.length < 32) problems.push("JWT_SECRET, si se define, debe tener al menos 32 caracteres");
  if (ENV.adminPassword.length < 6) problems.push("ADMIN_PASSWORD es obligatoria (mínimo 6 caracteres)");
  if (!ENV.isDev && ENV.adminPassword === DEV_PASSWORD) problems.push("ADMIN_PASSWORD no puede ser la contraseña de desarrollo");
  if (!ENV.isDev && ENV.jwtSecret && ENV.jwtSecret === ENV.adminPassword) problems.push("JWT_SECRET y ADMIN_PASSWORD deben ser distintos");
  if (ENV.whatsappNumber && !/^\d{8,15}$/.test(ENV.whatsappNumber)) problems.push("WHATSAPP_NUMBER debe ser el número con prefijo de país, p. ej. 34600111222");
  if (ENV.notifyWebhookUrl && !ENV.notifyWebhookUrl.startsWith("https://")) problems.push("NOTIFY_WEBHOOK_URL debe empezar por https://");
  if (problems.length === 0) return;
  const msg = `[config] ${problems.join("; ")}. Revisa .env.example.`;
  if (ENV.isDev) console.warn(msg);
  else throw new Error(msg);
}
