import type { RouterOutputs } from "./trpc";

export type Lead = RouterOutputs["leads"]["list"]["items"][number];
export type LeadDetalle = RouterOutputs["leads"]["detail"];
export type Despacho = RouterOutputs["despachos"]["list"][number];
export type Estado = Lead["estado"];

export const ESTADOS: { value: Estado; label: string; clase: string }[] = [
  { value: "nuevo", label: "Nuevo", clase: "bg-blue-100 text-blue-900" },
  { value: "en_proceso", label: "En proceso", clase: "bg-amber-100 text-amber-900" },
  { value: "cerrado", label: "Cerrado", clase: "bg-green-100 text-green-900" },
];
export const estadoInfo = (e: Estado) => ESTADOS.find(x => x.value === e) ?? ESTADOS[0];

export const fecha = (iso: string | null | undefined, conHora = false) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", conHora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" })
    : "—";

/** Número de teléfono solo con dígitos y prefijo 34 si es español sin prefijo (para wa.me). */
export function telefonoWhatsApp(tel: string) {
  const d = tel.replace(/\D/g, "");
  return d.length === 9 ? `34${d}` : d;
}

/** Fecha local "YYYY-MM-DD" → ISO del inicio de ese día (o del día siguiente si `finDeDia`). */
export function diaAIso(dia: string, finDeDia = false) {
  const d = new Date(`${dia}T00:00:00`);
  if (finDeDia) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** Descarga los leads en CSV (separador ";" y BOM para que Excel en español lo abra bien). */
export function descargarCsv(leads: Lead[]) {
  const columnas: [string, (l: Lead) => string | number | null][] = [
    ["ID", l => l.id],
    ["Fecha", l => fecha(l.fechaRecepcion, true)],
    ["Nombre", l => l.nombre],
    ["Teléfono", l => l.telefono],
    ["Email", l => l.email],
    ["Tipo", l => l.tipoCliente],
    ["Especialidad", l => l.especialidad],
    ["Localidad", l => l.localidad],
    ["Presupuesto", l => l.presupuesto],
    ["Estado", l => estadoInfo(l.estado).label],
    ["Contactado", l => fecha(l.contactadoAt, true)],
    ["Descripción", l => l.descripcion],
  ];
  const celda = (v: string | number | null) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmulas al abrir en Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [columnas.map(c => celda(c[0])), ...leads.map(l => columnas.map(c => celda(c[1](l))))]
    .map(fila => fila.join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
