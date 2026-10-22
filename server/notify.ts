import { enviarEmail } from "./email";
import { ENV } from "./env";

/** Tiempo máximo de espera por canal: un servicio caído no debe dejar peticiones colgadas. */
const TIMEOUT_MS = 8000;

/** Quita secretos (token del bot, URL del webhook) de cualquier texto antes de escribirlo en el log. */
const sinSecretos = (texto: string) =>
  [ENV.telegramBotToken, ENV.notifyWebhookUrl].filter(Boolean).reduce((t, s) => t.split(s).join("***"), texto);

/**
 * Avisa al propietario de un nuevo lead. Nunca lanza errores: un fallo del aviso
 * no debe hacer fallar el formulario (el lead ya está guardado).
 * Canales opcionales: Telegram y/o un webhook genérico (Slack, Discord, Make, n8n...).
 */
export async function notifyNewLead(text: string): Promise<void> {
  const sends: Promise<Response>[] = [];
  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  if (ENV.telegramBotToken && ENV.telegramChatId) {
    sends.push(post(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, { chat_id: ENV.telegramChatId, text }));
  }
  if (ENV.notifyWebhookUrl) {
    // `text` lo entiende Slack; `content`, Discord.
    sends.push(post(ENV.notifyWebhookUrl, { text, content: text }));
  }

  if (ENV.notifyEmail) {
    void enviarEmail({ para: ENV.notifyEmail, asunto: "Nuevo lead en Te Buscamos Abogado", texto: text });
  }

  if (sends.length === 0) {
    if (ENV.notifyEmail) return;
    console.info("[aviso] Nuevo lead recibido (no hay canal de aviso configurado).");
    return;
  }

  const results = await Promise.allSettled(sends);
  for (const r of results) {
    if (r.status === "rejected") {
      const e = r.reason as Error & { cause?: unknown };
      console.warn("[aviso] No se pudo enviar:", sinSecretos(`${e?.name ?? "Error"}: ${e?.message ?? r.reason}${e?.cause ? ` (${String(e.cause)})` : ""}`));
    } else if (!r.value.ok) console.warn(`[aviso] El canal respondió ${r.value.status}`);
  }
}
