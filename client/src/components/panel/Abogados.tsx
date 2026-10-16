import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { fecha } from "@/lib/panel";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Check, Mail, Phone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Abogado = RouterOutputs["abogados"]["list"][number];
type Filtro = "pendiente" | "aprobado" | "rechazado" | "todos";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "pendiente", label: "Pendientes" },
  { id: "aprobado", label: "Aprobados" },
  { id: "rechazado", label: "Rechazados" },
  { id: "todos", label: "Todos" },
];

const ESTADO: Record<string, { label: string; clase: string }> = {
  pendiente: { label: "Pendiente", clase: "bg-amber-100 text-amber-900" },
  aprobado: { label: "Aprobado", clase: "bg-green-100 text-green-900" },
  rechazado: { label: "Rechazado", clase: "bg-red-100 text-red-900" },
};

/** Pestaña "Abogados": revisar registros (comprobar colegiación), aprobar, rechazar y desactivar. */
export default function Abogados() {
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [rechazando, setRechazando] = useState<Abogado | null>(null);
  const [motivo, setMotivo] = useState("");
  const utils = trpc.useUtils();
  const lista = trpc.abogados.list.useQuery(filtro === "todos" ? undefined : { estado: filtro });

  const refrescar = () => {
    utils.abogados.list.invalidate();
    utils.despachos.list.invalidate();
  };
  const revisar = trpc.abogados.revisar.useMutation({
    onSuccess: (_r, v) => {
      refrescar();
      setRechazando(null);
      setMotivo("");
      toast.success(v.estado === "aprobado" ? "Abogado aprobado: le avisamos por email" : "Registro rechazado");
    },
    onError: e => toast.error(e.message),
  });
  const activar = trpc.abogados.activar.useMutation({ onSuccess: refrescar, onError: e => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              filtro === f.id ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-600">
        Antes de aprobar, comprueba en el censo de letrados del Consejo General de la Abogacía o del Colegio indicado que el número de colegiado existe, está
        ejerciente y corresponde a ese nombre.
      </p>

      {lista.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !lista.data?.length ? (
        <Card>
          <CardContent className="text-center text-gray-600 py-8">No hay abogados en este estado.</CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {lista.data.map(a => (
            <Card key={a.id} className={`gap-3 ${a.cuentaActiva ? "" : "opacity-60"}`}>
              <CardHeader>
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {a.nombre}
                  <Badge className={ESTADO[a.estado].clase}>{ESTADO[a.estado].label}</Badge>
                  {!a.cuentaActiva && <Badge className="bg-gray-200 text-gray-700">Desactivado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-2">
                <p>
                  <strong>{a.colegio}</strong> · nº colegiado <strong>{a.numColegiado}</strong>
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href={`mailto:${a.email}`} className="flex items-center gap-1 underline">
                    <Mail className="w-3.5 h-3.5" /> {a.email}
                  </a>
                  {a.telefono && (
                    <a href={`tel:${a.telefono.replace(/\s/g, "")}`} className="flex items-center gap-1 underline">
                      <Phone className="w-3.5 h-3.5" /> {a.telefono}
                    </a>
                  )}
                </div>
                <Etiquetas titulo="Especialidades" valores={a.especialidades} />
                <Etiquetas titulo="Provincias" valores={a.provincias} />
                <p className="text-xs text-gray-500">
                  Registrado el {fecha(a.registradoAt, true)} · último acceso {fecha(a.ultimoAcceso, true)}
                </p>
                {a.estado === "rechazado" && a.motivoRechazo && <p className="text-xs text-red-800">Motivo: {a.motivoRechazo}</p>}

                <div className="flex flex-wrap gap-2 pt-2">
                  {a.estado !== "aprobado" && (
                    <Button size="sm" className="bg-green-700 hover:bg-green-800" disabled={revisar.isPending} onClick={() => revisar.mutate({ id: a.id, estado: "aprobado" })}>
                      <Check className="w-4 h-4" /> Aprobar
                    </Button>
                  )}
                  {a.estado !== "rechazado" && (
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200" onClick={() => setRechazando(a)}>
                      <X className="w-4 h-4" /> Rechazar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={activar.isPending} onClick={() => activar.mutate({ id: a.id, activo: !a.cuentaActiva })}>
                    {a.cuentaActiva ? "Desactivar cuenta" : "Reactivar cuenta"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rechazando != null} onOpenChange={o => !o && setRechazando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar a {rechazando?.nombre}</DialogTitle>
            <DialogDescription>Le enviaremos un email con el motivo para que pueda corregir sus datos.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ej.: no encontramos el nº de colegiado en el censo del Colegio indicado"
            aria-label="Motivo del rechazo"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={revisar.isPending}
              onClick={() => rechazando && revisar.mutate({ id: rechazando.id, estado: "rechazado", motivo: motivo.trim() || undefined })}
            >
              Rechazar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Etiquetas({ titulo, valores }: { titulo: string; valores: string[] }) {
  if (!valores.length) return null;
  return (
    <div>
      <span className="text-xs text-gray-500">{titulo}: </span>
      <span className="inline-flex flex-wrap gap-1">
        {valores.map(v => (
          <Badge key={v} variant="outline">
            {v}
          </Badge>
        ))}
      </span>
    </div>
  );
}
