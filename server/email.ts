/**
 * Envío de emails (sin dependencias): API de Resend (https://resend.com) por HTTPS.
 * Sin RESEND_API_KEY: en local se muestra el email en la consola; en producción solo se avisa en el log.
 * Nunca lanza errores: devuelve true/false.
 */
import { ENV } from "./env";

export type Email = { para: string; asunto: string; texto: string };

export async function enviarEmail({ para, asunto, texto }: Email): Promise<boolean> {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    if (ENV.isDev) console.info(`\n[email · local] Para: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    else console.warn("[email] No configurado (RESEND_API_KEY y EMAIL_FROM): no se ha enviado el email.");
    return false;
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
