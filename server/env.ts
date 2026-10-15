import "dotenv/config";

/** Configuración del servidor. Todas las variables están documentadas en `.env.example`. */
export const ENV = {
  /** El servidor arranca en modo desarrollo (Vite + recarga) solo con `--dev`. */
  isDev: process.argv.includes("--dev"),
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  // Avisos de nuevos leads (opcionales; si no hay ninguno, solo se registra en el log).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL ?? "",
};

/** Falla al arrancar en producción si falta algo imprescindible; en desarrollo solo avisa. */
export function checkEnv() {
  const problems: string[] = [];
  if (!ENV.databaseUrl) problems.push("DATABASE_URL no está definida");
  if (ENV.jwtSecret.length < 32) problems.push("JWT_SECRET debe tener al menos 32 caracteres");
  if (ENV.adminPassword.length < 12) problems.push("ADMIN_PASSWORD debe tener al menos 12 caracteres");
  if (problems.length === 0) return;
  const msg = `[config] ${problems.join("; ")}. Revisa .env.example.`;
  if (ENV.isDev) console.warn(msg);
  else throw new Error(msg);
}
