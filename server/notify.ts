import { ENV } from "./env";

/**
 * Avisa al propietario de un nuevo lead. Nunca lanza errores: un fallo del aviso
 * no debe hacer fallar el formulario (el lead ya está guardado).
 * Canales opcionales: Telegram y/o un webhook genérico (Slack, Discord, Make, n8n...).
 */
export async function notifyNewLead(text: string): Promise<void> {
  const sends: Promise<Response>[] = [];

  if (ENV.telegramBotToken && ENV.telegramChatId) {
    sends.push(
      fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: ENV.telegramChatId, text }),
      })
    );
  }
  if (ENV.notifyWebhookUrl) {
    sends.push(
      fetch(ENV.notifyWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `text` lo entiende Slack; `content`, Discord.
        body: JSON.stringify({ text, content: text }),
      })
    );
  }

  if (sends.length === 0) {
    console.info("[aviso] Nuevo lead recibido (no hay canal de aviso configurado).");
    return;
  }

  const results = await Promise.allSettled(sends);
  for (const r of results) {
    if (r.status === "rejected") console.warn("[aviso] No se pudo enviar:", r.reason);
    else if (!r.value.ok) console.warn(`[aviso] El canal respondió ${r.value.status}`);
  }
}
