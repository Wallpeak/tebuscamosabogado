/**
 * Reparto de leads a abogados: envío de ofertas (manual desde el panel o automático),
 * avisos por email y reasignación cuando una oferta caduca o se rechaza.
 */
import * as db from "./db";
import { enviarEmail, urlPublica } from "./email";
import { ENV } from "./env";

/** Aviso al abogado de una solicitud nueva. Sin datos personales del cliente. */
function avisarOferta(despachoId: number, leadId: number) {
  const destino = db.emailDespacho(despachoId);
  const lead = db.obtenerLead(leadId);
  if (!destino || !lead) return;
  const url = urlPublica("/abogados");
  void enviarEmail({
    para: destino.email,
    asunto: `Nueva solicitud: ${lead.especialidad}${lead.provincia ? ` · ${lead.provincia}` : ""}`,
    texto:
      `Hola ${destino.nombre}:\n\nTienes una nueva solicitud de ${lead.especialidad}${lead.provincia ? ` en ${lead.provincia}` : ""}. ` +
      `Tienes ${ENV.ofertaHoras} horas para aceptarla o rechazarla.${url ? `\n\nEntra en ${url}` : ""}\n\n— Te Buscamos Abogado`,
  });
}

/**
 * Envía el lead a los despachos indicados. A los que tienen cuenta se les manda una oferta (la aceptan ellos);
 * a los que no, se registra como derivación directa (el admin les pasa los datos por su cuenta).
 */
export function enviarLead(leadId: number, despachoIds: number[]): { ofertas: number; directas: number } {
  const disponibles = new Map(db.listarDespachos(true).map(d => [d.id, d]));
  let ofertas = 0;
  let directas = 0;
  for (const id of despachoIds) {
    const d = disponibles.get(id);
    if (!d) continue;
    if (d.usuarioId != null) {
      if (db.enviarOferta(leadId, id, ENV.ofertaHoras)) {
        ofertas++;
        avisarOferta(id, leadId);
      }
    } else {
      db.derivarLead(leadId, id);
      directas++;
    }
  }
  return { ofertas, directas };
}

/**
 * Reparto automático: completa hasta REPARTO_ABOGADOS ofertas pendientes con abogados registrados
 * que cubren la especialidad (y la provincia, si el lead la indica). No hace nada si el lead ya está completo.
 */
export function repartirAutomatico(leadId: number): number {
  if (!ENV.repartoAutomatico) return 0;
  const lead = db.obtenerLead(leadId);
  if (!lead || lead.estado === "cerrado") return 0;
  const r = db.resumenOfertas(leadId);
  if (r.aceptada >= ENV.maxAbogadosPorLead) return 0;
  const faltan = ENV.repartoAbogados - r.enviada;
  if (faltan <= 0) return 0;
  const elegidos = db
    .candidatosParaLead(leadId)
    .filter(c => c.registrado && c.especialidad && (!lead.provincia || c.provincia))
    .slice(0, faltan)
    .map(c => c.despachoId);
  return enviarLead(leadId, elegidos).ofertas;
}

/**
 * Caduca las ofertas vencidas y, con reparto automático, las reasigna. Si un lead se queda sin
 * ninguna oferta pendiente ni aceptada, avisa al propietario (NOTIFY_EMAIL). Se llama periódicamente.
 */
export function revisarOfertas(): void {
  for (const leadId of db.caducarOfertas()) {
    const nuevas = repartirAutomatico(leadId);
    const r = db.resumenOfertas(leadId);
    const lead = db.obtenerLead(leadId);
    if (!nuevas && !r.enviada && !r.aceptada && lead && ENV.notifyEmail) {
      void enviarEmail({
        para: ENV.notifyEmail,
        asunto: "Lead sin abogado",
        texto: `Ningún abogado ha respondido a tiempo al lead nº ${lead.id} (${lead.especialidad}${lead.provincia ? `, ${lead.provincia}` : ""}). Revísalo en el panel.`,
      });
    }
  }
}
