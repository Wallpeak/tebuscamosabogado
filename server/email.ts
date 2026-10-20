/**
 * Envío de emails (sin dependencias). Dos formas, la primera que esté configurada:
 *  1. SMTP del correo del hosting (p. ej. Hostinger): SMTP_HOST, SMTP_USER, SMTP_PASSWORD.
 *  2. API de Resend (https://resend.com): RESEND_API_KEY.
 * Sin ninguna: en local se muestra el email en la consola; en producción solo se avisa en el log.
 * Nunca lanza errores: devuelve true/false.
 */
import { ENV } from "./env";
import { enviarSmtp } from "./smtp";

export type Email = { para: string; asunto: string; texto: string };

/** Qué sistema de envío está activo (para el log de arranque). */
export const metodoEmail = () => (ENV.smtpHost && ENV.smtpUser && ENV.smtpPassword ? "smtp" : ENV.resendApiKey && ENV.emailFrom ? "resend" : "ninguno");

export async function enviarEmail({ para, asunto, texto }: Email): Promise<boolean> {
  const metodo = metodoEmail();
  if (metodo === "ninguno") {
    if (ENV.isDev) console.info(`\n[email · local] Para: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    else console.warn("[email] No configurado (SMTP_* o RESEND_API_KEY): no se ha enviado el email.");
    return false;
  }
  if (metodo === "smtp") {
    try {
      await enviarSmtp(
        { host: ENV.smtpHost, port: ENV.smtpPort, user: ENV.smtpUser, password: ENV.smtpPassword },
        { de: ENV.emailFrom || ENV.smtpUser, para, asunto, texto }
      );
      return true;
    } catch (e) {
      // El mensaje del servidor no lleva la contraseña (la autenticación se oculta en smtp.ts).
      console.warn("[email] No se pudo enviar por SMTP:", (e as Error)?.message ?? "Error");
      return false;
    }
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${ENV.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: ENV.emailFrom, to: [para], subject: asunto, text: texto }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn(`[email] El proveedor respondió ${r.status}`);
    return r.ok;
  } catch (e) {
    console.warn("[email] No se pudo enviar:", (e as Error)?.name ?? "Error");
    return false;
  }
}

/** Dirección pública de la web para los enlaces de los emails. */
export function urlPublica(rutaYQuery: string, hostPeticion?: string): string {
  // En producción solo PUBLIC_URL: no se fía de la cabecera Host (podría apuntar a otra web).
  const base = ENV.publicUrl || (ENV.isDev && hostPeticion ? `http://${hostPeticion}` : "");
  return base ? `${base.replace(/\/$/, "")}${rutaYQuery}` : "";
}
