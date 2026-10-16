import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ESTADOS, estadoInfo, fecha, telefonoWhatsApp, type Estado } from "@/lib/panel";
import { trpc } from "@/lib/trpc";
import { Mail, MessageCircle, Phone, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Ficha de un lead: datos, acciones de contacto, estado, notas, derivaciones e historial. */
export default function LeadDetalle({ id, onClose }: { id: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const lead = trpc.leads.detail.useQuery(id ?? 0, { enabled: id != null });
  const [nota, setNota] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  /** Tras cualquier cambio: recargar ficha, listado y estadísticas. */
  const refrescar = () => {
    if (id != null) utils.leads.detail.invalidate(id);
    utils.leads.list.invalidate();
    utils.stats.invalidate();
  };
  const alFallar = (e: { message: string }) => toast.error(e.message || "No se pudo guardar");

  const cambiarEstado = trpc.leads.updateStatus.useMutation({ onSuccess: () => (refrescar(), toast.success("Estado actualizado")), onError: alFallar });
  const addNote = trpc.leads.addNote.useMutation({ onSuccess: () => (setNota(""), refrescar()), onError: alFallar });
  const deleteNote = trpc.leads.deleteNote.useMutation({ onSuccess: refrescar, onError: alFallar });
  const quitar = trpc.leads.quitarDerivacion.useMutation({ onSuccess: refrescar, onError: alFallar });
  const borrar = trpc.leads.delete.useMutation({
    onSuccess: () => {
      setConfirmarBorrado(false);
      onClose();
      utils.leads.list.invalidate();
      utils.stats.invalidate();
      toast.success("Lead eliminado");
    },
    onError: alFallar,
  });

  const l = lead.data;

  return (
    <>
      <Dialog open={id != null} onOpenChange={abierto => !abierto && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {!l ? (
            <div className="flex justify-center py-12">
              <DialogTitle className="sr-only">Cargando lead</DialogTitle>
              <Spinner />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                  {l.nombre}
                  <Badge className={estadoInfo(l.estado).clase}>{estadoInfo(l.estado).label}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {l.especialidad} · {l.tipoCliente === "empresa" ? "Empresa" : "Particular"} · recibido el {fecha(l.fechaRecepcion, true)}
                </DialogDescription>
              </DialogHeader>

              {/* Contacto rápido */}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${l.telefono.replace(/\s/g, "")}`}>
                    <Phone className="w-4 h-4" /> {l.telefono}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-green-800 border-green-300">
                  <a href={`https://wa.me/${telefonoWhatsApp(l.telefono)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${l.email}`}>
                    <Mail className="w-4 h-4" /> {l.email}
                  </a>
                </Button>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Dato titulo="Provincia" valor={l.provincia} />
                <Dato titulo="Localidad" valor={l.localidad} />
                <Dato titulo="Presupuesto" valor={l.presupuesto} />
                <Dato titulo="Primer contacto" valor={l.contactadoAt ? fecha(l.contactadoAt, true) : "Pendiente"} />
                <Dato titulo="Consentimiento" valor={`${fecha(l.consentimientoAt, true)} (política ${l.politicaVersion})`} />
                <Dato titulo="Origen" valor={l.origen} />
              </dl>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Descripción del caso</h3>
                <p className="text-gray-900 p-3 bg-gray-50 rounded whitespace-pre-wrap text-sm">{l.descripcion}</p>
              </section>

              <section className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700 mr-2">Estado</h3>
                {ESTADOS.map(e => (
                  <Button
                    key={e.value}
                    size="sm"
                    variant={l.estado === e.value ? "default" : "outline"}
                    className={l.estado === e.value ? "bg-blue-900 hover:bg-blue-900" : ""}
                    disabled={cambiarEstado.isPending || l.estado === e.value}
                    onClick={() => cambiarEstado.mutate({ id: l.id, estado: e.value as Estado })}
                  >
                    {e.label}
                  </Button>
                ))}
              </section>

              {/* Notas */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas internas</h3>
                <form
                  className="flex gap-2 mb-3"
                  onSubmit={e => {
                    e.preventDefault();
                    if (nota.trim()) addNote.mutate({ leadId: l.id, texto: nota });
                  }}
                >
                  <Textarea
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Ej.: llamado, devolver la llamada el lunes"
                    maxLength={2000}
                    rows={2}
                    aria-label="Nueva nota"
                  />
                  <Button type="submit" disabled={!nota.trim() || addNote.isPending} className="self-end bg-blue-900 hover:bg-blue-800" aria-label="Guardar nota">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                {l.notas.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin notas.</p>
                ) : (
                  <ul className="space-y-2">
                    {l.notas.map(n => (
                      <li key={n.id} className="flex gap-2 items-start bg-amber-50 border border-amber-100 rounded p-2 text-sm">
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap text-gray-900">{n.texto}</p>
                          <p className="text-xs text-gray-500 mt-1">{fecha(n.createdAt, true)}</p>
                        </div>
                        <button onClick={() => deleteNote.mutate(n.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Borrar nota">
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Abogados: ofertas enviadas y envío nuevo */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Abogados</h3>
                {l.derivaciones.length > 0 && (
                  <ul className="space-y-1 mb-3">
                    {l.derivaciones.map(d => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm border rounded px-3 py-1.5">
                        <span className="font-medium">{d.despacho}</span>
                        <Badge className={ESTADO_OFERTA[d.estado].clase}>{d.registrado ? ESTADO_OFERTA[d.estado].label : "Derivado a mano"}</Badge>
                        <span className="text-xs text-gray-500">
                          enviado {fecha(d.createdAt, true)}
                          {d.estado === "enviada" && d.expiraAt && ` · caduca ${fecha(d.expiraAt, true)}`}
                          {d.respondidaAt && d.registrado && ` · respondió ${fecha(d.respondidaAt, true)}`}
                        </span>
                        {d.motivo && <span className="text-xs text-gray-600">«{d.motivo}»</span>}
                        {!(d.registrado && d.estado === "aceptada") && (
                          <button
                            onClick={() => quitar.mutate({ leadId: l.id, despachoId: d.despachoId })}
                            className="ml-auto text-gray-400 hover:text-red-600 p-1"
                            aria-label={`Quitar ${d.despacho}`}
                            title={d.estado === "enviada" ? "Cancelar la solicitud" : "Quitar"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <EnviarAAbogados leadId={l.id} provincia={l.provincia} onEnviado={refrescar} />
              </section>

              {/* Historial */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial</h3>
                <ol className="border-l-2 border-gray-200 pl-4 space-y-1 text-sm">
                  {l.historial.map(h => (
                    <li key={h.id}>
                      <span className="text-gray-500">{fecha(h.createdAt, true)}</span> ·{" "}
                      {h.estadoAnterior ? (
                        <>
                          {estadoInfo(h.estadoAnterior).label} → <strong>{estadoInfo(h.estadoNuevo).label}</strong>
                        </>
                      ) : (
                        <>Recibido como <strong>{estadoInfo(h.estadoNuevo).label}</strong></>
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              <div className="flex justify-end pt-2 border-t">
                <Button variant="ghost" className="text-red-700 hover:text-red-800 hover:bg-red-50" onClick={() => setConfirmarBorrado(true)}>
                  <Trash2 className="w-4 h-4" /> Eliminar lead
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán sus datos personales y notas. Si algún abogado ya lo aceptó, se conserva solo el registro anónimo de a quién se comunicó y cuándo (prueba de la cesión y facturación). No se puede deshacer. Úsalo también para atender una solicitud de supresión (RGPD).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                if (id != null) borrar.mutate(id);
              }}
              disabled={borrar.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {borrar.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-gray-500">{titulo}</dt>
      <dd className="font-medium text-gray-900">{valor || "—"}</dd>
    </div>
  );
}

const ESTADO_OFERTA = {
  enviada: { label: "Esperando respuesta", clase: "bg-amber-100 text-amber-900" },
  aceptada: { label: "Aceptada", clase: "bg-green-100 text-green-900" },
  rechazada: { label: "Rechazada", clase: "bg-red-100 text-red-900" },
  caducada: { label: "Sin respuesta / cerrada", clase: "bg-gray-200 text-gray-700" },
} as const;

/** Lista de abogados disponibles ordenados por encaje; se marcan varios y se envía. */
function EnviarAAbogados({ leadId, provincia, onEnviado }: { leadId: number; provincia: string | null; onEnviado: () => void }) {
  const candidatos = trpc.leads.candidatos.useQuery(leadId);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [verTodos, setVerTodos] = useState(false);
  const utils = trpc.useUtils();
  const enviar = trpc.leads.enviar.useMutation({
    onSuccess: r => {
      setElegidos([]);
      utils.leads.candidatos.invalidate(leadId);
      onEnviado();
      toast.success(
        [r.ofertas && `${r.ofertas} solicitud${r.ofertas > 1 ? "es" : ""} enviada${r.ofertas > 1 ? "s" : ""}`, r.directas && `${r.directas} derivación${r.directas > 1 ? "es" : ""} a mano`]
          .filter(Boolean)
          .join(" · ")
      );
    },
    onError: e => toast.error(e.message),
  });

  const lista = candidatos.data ?? [];
  const encajan = lista.filter(c => c.especialidad && (!provincia || c.provincia));
  const mostrados = verTodos ? lista : encajan;

  if (candidatos.isLoading) return <Spinner />;
  if (!lista.length)
    return <p className="text-sm text-gray-500">No hay más abogados disponibles. Aprueba abogados en la pestaña «Abogados» o añade despachos.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        Los abogados con cuenta reciben primero un resumen <strong>sin datos de contacto</strong> y deciden si lo aceptan. Los despachos sin cuenta quedan como
        «derivado a mano» (les pasas tú los datos).
      </p>
      {mostrados.length === 0 ? (
        <p className="text-sm text-gray-500">Ninguno cubre esta especialidad{provincia ? ` en ${provincia}` : ""}.</p>
      ) : (
        <ul className="border rounded divide-y max-h-56 overflow-y-auto">
          {mostrados.map(c => (
            <li key={c.despachoId}>
              <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <Checkbox
                  checked={elegidos.includes(c.despachoId)}
                  onCheckedChange={v => setElegidos(e => (v ? [...e, c.despachoId] : e.filter(x => x !== c.despachoId)))}
                />
                <span className="flex-1">{c.nombre}</span>
                {c.especialidad && <Badge variant="outline">especialidad</Badge>}
                {c.provincia && <Badge variant="outline">provincia</Badge>}
                {!c.registrado && <Badge className="bg-gray-100 text-gray-700">sin cuenta</Badge>}
                <span className="text-xs text-gray-500 tabular-nums" title="Solicitudes recibidas en 30 días">
                  {c.recientes} / 30 d
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!elegidos.length || enviar.isPending}
          onClick={() => enviar.mutate({ leadId, despachoIds: elegidos })}
          className="bg-blue-900 hover:bg-blue-800"
        >
          <Send className="w-4 h-4" /> Enviar a {elegidos.length || "…"}
        </Button>
        {lista.length > encajan.length && (
          <button className="text-sm underline text-gray-600" onClick={() => setVerTodos(v => !v)}>
            {verTodos ? "Ver solo los que encajan" : `Ver todos (${lista.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
