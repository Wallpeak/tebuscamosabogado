/**
 * Cliente SMTP mínimo y sin dependencias (node:tls / node:net) para enviar con el correo del hosting
 * (p. ej. Hostinger: smtp.hostinger.com, puerto 465). Admite TLS directo (465) y STARTTLS (587).
 * Solo envía texto plano a un destinatario: es todo lo que necesita la web.
 */
import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

export type ConfigSmtp = {
  host: string;
  port: number;
  user: string;
  password: string;
  /** Opciones TLS extra (solo para pruebas, p. ej. un certificado propio). */
  tls?: tls.ConnectionOptions;
  timeoutMs?: number;
};

export type MensajeSmtp = { de: string; para: string; asunto: string; texto: string };

/** Extrae la dirección de "Nombre <correo@dominio>" o devuelve el correo tal cual. */
export const direccion = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim();

/** Quita saltos de línea: evita que alguien inyecte cabeceras a través de un campo. */
const linea = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** Asunto o nombre con acentos codificado según RFC 2047. */
const cabeceraUtf8 = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

function remitente(de: string) {
  const m = de.match(/^(.*)<([^>]+)>\s*$/);
  if (!m) return linea(de);
  const nombre = linea(m[1]).replace(/^"|"$/g, "");
  return nombre ? `${cabeceraUtf8(nombre)} <${linea(m[2])}>` : `<${linea(m[2])}>`;
}

export function construirMensaje({ de, para, asunto, texto }: MensajeSmtp): string {
  const dominio = direccion(de).split("@")[1] || "localhost";
  const cuerpo = Buffer.from(texto.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  return [
    `From: ${remitente(de)}`,
    `To: <${linea(direccion(para))}>`,
    `Subject: ${cabeceraUtf8(linea(asunto))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${dominio}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    cuerpo,
  ].join("\r\n");
}

/** Envía un email. Lanza un error si el servidor lo rechaza o no responde. */
export async function enviarSmtp(cfg: ConfigSmtp, msg: MensajeSmtp): Promise<void> {
  const timeout = cfg.timeoutMs ?? 15000;
  const directo = cfg.port === 465;
  let socket: net.Socket = directo
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, ...cfg.tls })
    : net.connect({ host: cfg.host, port: cfg.port });
  socket.setTimeout(timeout);

  let bufer = "";
  let esperando: { resolve: (r: { code: number; text: string }) => void; reject: (e: Error) => void } | null = null;
  let fallo: Error | null = null;

  const alRecibir = (d: Buffer) => {
    bufer += d.toString("utf8");
    // Una respuesta termina en una línea "250 ..." (con espacio); las "250-..." son continuación.
    const lineas = bufer.split("\r\n");
    for (let i = 0; i < lineas.length - 1; i++) {
      if (/^\d{3} /.test(lineas[i]) || /^\d{3}$/.test(lineas[i])) {
        const texto = lineas.slice(0, i + 1).join("\n");
        bufer = lineas.slice(i + 1).join("\r\n");
        const e = esperando;
        esperando = null;
        e?.resolve({ code: Number(lineas[i].slice(0, 3)), text: texto });
        return;
      }
    }
  };
  const alFallar = (err: Error) => {
    fallo = err;
    esperando?.reject(err);
    esperando = null;
  };
  const escuchar = (s: net.Socket) => {
    s.on("data", alRecibir);
    s.on("error", alFallar);
    s.on("timeout", () => alFallar(new Error("Tiempo de espera agotado")));
    s.on("close", () => alFallar(new Error("Conexión cerrada por el servidor")));
  };
  escuchar(socket);

  const respuesta = () =>
    new Promise<{ code: number; text: string }>((resolve, reject) => {
      if (fallo) return reject(fallo);
      esperando = { resolve, reject };
      alRecibir(Buffer.alloc(0)); // por si ya había una respuesta completa en el búfer
    });
  const comando = async (linea: string | null, esperado: number, oculto = false) => {
    if (linea !== null) socket.write(linea + "\r\n");
    const r = await respuesta();
    if (r.code !== esperado) throw new Error(`SMTP ${oculto ? "(autenticación)" : (linea ?? "saludo").split(" ")[0]}: ${r.text.slice(0, 200)}`);
    return r;
  };

  try {
    if (directo) await new Promise<void>((ok, ko) => (socket as tls.TLSSocket).once("secureConnect", ok).once("error", ko));
    await comando(null, 220);
    const nombre = "tebuscamosabogado";
    let ehlo = await comando(`EHLO ${nombre}`, 250);

    if (!directo) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error("El servidor no admite STARTTLS: usa el puerto 465");
      await comando("STARTTLS", 220);
      socket.removeAllListeners();
      socket = tls.connect({ socket, servername: cfg.host, ...cfg.tls });
      escuchar(socket);
      await new Promise<void>((ok, ko) => (socket as tls.TLSSocket).once("secureConnect", ok).once("error", ko));
      ehlo = await comando(`EHLO ${nombre}`, 250);
    }

    if (/AUTH[ =-][^\n]*PLAIN/i.test(ehlo.text)) {
      await comando(`AUTH PLAIN ${Buffer.from(`\0${cfg.user}\0${cfg.password}`).toString("base64")}`, 235, true);
    } else {
      await comando("AUTH LOGIN", 334);
      await comando(Buffer.from(cfg.user).toString("base64"), 334, true);
      await comando(Buffer.from(cfg.password).toString("base64"), 235, true);
    }

    await comando(`MAIL FROM:<${linea(direccion(msg.de))}>`, 250);
    await comando(`RCPT TO:<${linea(direccion(msg.para))}>`, 250);
    await comando("DATA", 354);
    // El cuerpo va en base64, así que ninguna línea empieza por "." y no hace falta escaparlas.
    await comando(construirMensaje(msg) + "\r\n.", 250);
    socket.write("QUIT\r\n");
  } finally {
    socket.removeAllListeners("close");
    socket.on("error", () => {});
    socket.end();
  }
}
