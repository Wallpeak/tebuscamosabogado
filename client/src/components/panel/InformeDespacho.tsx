/**
 * Informe mensual de un despacho (facturación manual): solicitudes aceptadas, rechazadas y sin respuesta
 * del mes elegido, con importe opcional, exportación a Excel (CSV) e impresión / PDF.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TITULAR } from "@/lib/legalContent";
import { descargarCsv, fecha } from "@/lib/panel";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PRECIO_LEAD_EUR } from "../../../../server/condiciones";

type Informe = RouterOutputs["despachos"]["informe"];
type Fila = Informe["filas"][number];

const PRECIO_KEY = "tba_precio_lead";
const ESTADO: Record<Fila["estado"], { label: string; clase: string }> = {
  aceptada: { label: "Aceptada", clase: "bg-green-100 text-green-900" },
  rechazada: { label: "Rechazada", clase: "bg-red-100 text-red-900" },
  caducada: { label: "Sin respuesta", clase: "bg-gray-200 text-gray-700" },
  enviada: { label: "Pendiente", clase: "bg-amber-100 text-amber-900" },
};

/** Últimos 12 meses: { valor "2026-10", etiqueta "octubre de 2026", desde, hasta } en hora local. */
function meses() {
  const hoy = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const fin = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
    return {
      valor: `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: ini.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase()),
      desde: ini.toISOString(),
      hasta: fin.toISOString(),
    };
  });
}

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export default function InformeDespacho({ despachoId, nombre, onClose }: { despachoId: number | null; nombre: string; onClose: () => void }) {
  const opciones = meses();
  const [mes, setMes] = useState(opciones[0].valor);
  const [precio, setPrecio] = useState(() => {
    try {
      return localStorage.getItem(PRECIO_KEY) ?? String(PRECIO_LEAD_EUR);
    } catch {
      return String(PRECIO_LEAD_EUR);
    }
  });
  const periodo = opciones.find(o => o.valor === mes)!;
  const informe = trpc.despachos.informe.useQuery(
    { despachoId: despachoId ?? 0, desde: periodo.desde, hasta: periodo.hasta },
    { enabled: despachoId != null }
  );

  const cambiarPrecio = (v: string) => {
    setPrecio(v);
    try {
      localStorage.setItem(PRECIO_KEY, v);
    } catch {
      /* sin almacenamiento */
    }
  };
  const precioNum = Number(precio.replace(",", "."));
  const importe = precio && Number.isFinite(precioNum) && precioNum > 0 && informe.data ? informe.data.totales.aceptada * precioNum : null;

  const exportar = () => {
    const d = informe.data;
    if (!d) return;
    const filas = d.filas.map(f => [fecha(f.fecha, true), ESTADO[f.estado].label, f.especialidad, f.provincia, f.cliente, f.motivo, `#${f.leadId}`]);
    filas.push([], ["Aceptadas", d.totales.aceptada], ["Rechazadas", d.totales.rechazada], ["Sin respuesta", d.totales.caducada]);
    if (importe != null) filas.push([`Importe (${d.totales.aceptada} × ${euros(precioNum)}, sin impuestos)`, euros(importe)]);
    descargarCsv(
      `informe-${d.despacho.nombre.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${mes}.csv`,
      ["Fecha", "Estado", "Especialidad", "Provincia", "Cliente", "Motivo del rechazo", "Ref."],
      filas
    );
  };

  return (
    <Dialog open={despachoId != null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informe mensual · {nombre}</DialogTitle>
          <DialogDescription>Solicitudes respondidas en el mes (o cerradas sin respuesta). Las pendientes no entran.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Mes</span>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opciones.map(o => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Precio por aceptada (€ sin IVA)</span>
            <Input inputMode="decimal" value={precio} onChange={e => cambiarPrecio(e.target.value)} placeholder="Ej.: 30" className="w-40" />
          </label>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={exportar} disabled={!informe.data}>
              <Download className="w-4 h-4" /> Excel
            </Button>
            <Button onClick={() => informe.data && imprimir(informe.data, periodo.etiqueta, precioNum, importe)} disabled={!informe.data} className="bg-blue-900 hover:bg-blue-800">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>

        {informe.isLoading || !informe.data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Total titulo="Aceptadas" valor={informe.data.totales.aceptada} />
              <Total titulo="Rechazadas" valor={informe.data.totales.rechazada} />
              <Total titulo="Sin respuesta" valor={informe.data.totales.caducada} />
              <Total titulo="Importe (sin impuestos)" valor={importe == null ? "—" : euros(importe)} />
            </div>

            {informe.data.filas.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No hay solicitudes respondidas en este mes.</p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Provincia</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {informe.data.filas.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap text-sm">{fecha(f.fecha, true)}</TableCell>
                        <TableCell>
                          <Badge className={ESTADO[f.estado].clase}>{ESTADO[f.estado].label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{f.especialidad}</TableCell>
                        <TableCell className="text-sm">{f.provincia ?? "—"}</TableCell>
                        <TableCell className="text-sm">{f.cliente ?? "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600">{f.motivo ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Por protección de datos, el nombre del cliente solo aparece en las aceptadas (el abogado ya lo conoce). Este informe no es una factura.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Total({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-gray-600">{titulo}</div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{valor}</div>
    </div>
  );
}

/** Abre una página imprimible (el navegador permite imprimirla o guardarla como PDF). */
function imprimir(d: Informe, mes: string, precio: number, importe: number | null) {
  const esc = (v: unknown) =>
    String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const filas = d.filas
    .map(
      f =>
        `<tr><td>${esc(fecha(f.fecha, true))}</td><td>${esc(ESTADO[f.estado].label)}</td><td>${esc(f.especialidad)}</td><td>${esc(f.provincia ?? "—")}</td><td>${esc(f.cliente ?? "—")}</td><td>${esc(f.motivo ?? "")}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${esc(d.despacho.nombre)} · ${esc(mes)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px;color:#001a4d} h2{font-size:14px;margin:24px 0 8px}
  .cab{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #001a4d;padding-bottom:12px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f3f4f6} .tot td{font-weight:600} .nota{color:#555;font-size:11px;margin-top:16px}
  @media print{body{margin:12mm}}
</style></head><body>
<div class="cab">
  <div><h1>Informe de actividad · ${esc(mes)}</h1><div>${esc(TITULAR.nombre)} · NIF ${esc(TITULAR.nif)}</div><div>${esc(TITULAR.domicilio)}</div></div>
  <div><strong>${esc(d.despacho.nombre)}</strong><div>${esc(d.despacho.colegio ?? "")}${d.despacho.numColegiado ? ` · nº ${esc(d.despacho.numColegiado)}` : ""}</div><div>${esc(d.despacho.email ?? "")}</div></div>
</div>
<h2>Resumen</h2>
<table><tbody class="tot">
  <tr><td>Solicitudes aceptadas</td><td>${d.totales.aceptada}</td></tr>
  <tr><td>Solicitudes rechazadas</td><td>${d.totales.rechazada}</td></tr>
  <tr><td>Sin respuesta</td><td>${d.totales.caducada}</td></tr>
  ${importe != null ? `<tr><td>Importe (${d.totales.aceptada} × ${esc(euros(precio))}, sin impuestos)</td><td>${esc(euros(importe))}</td></tr>` : ""}
</tbody></table>
<h2>Detalle</h2>
${d.filas.length ? `<table><thead><tr><th>Fecha</th><th>Estado</th><th>Especialidad</th><th>Provincia</th><th>Cliente</th><th>Motivo</th></tr></thead><tbody>${filas}</tbody></table>` : "<p>No hay solicitudes respondidas en este mes.</p>"}
<p class="nota">Generado el ${esc(new Date().toLocaleString("es-ES"))}. Documento informativo, no es una factura. El nombre del cliente solo figura en las solicitudes aceptadas.</p>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return void toast.error("El navegador ha bloqueado la ventana. Permite las ventanas emergentes para esta web.");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
