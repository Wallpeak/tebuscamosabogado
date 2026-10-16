/**
 * Bandeja del abogado: solicitudes nuevas (resumen sin datos de contacto), aceptadas (con contacto) e historial.
 */
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { fecha, telefonoWhatsApp } from "@/lib/panel";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Check, Clock, Inbox, Mail, MessageCircle, Phone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Oferta = RouterOutputs["abogados"]["bandeja"]["ofertas"][number];
type Pestana = "nuevas" | "aceptadas" | "historial";

/** "quedan 5 h" / "quedan 25 min" */
function quedan(iso: string | null) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  return min >= 60 ? `quedan ${Math.floor(min / 60)} h` : `quedan ${min} min`;
}

export default function Bandeja({ aprobado }: { aprobado: boolean }) {
  const bandeja = trpc.abogados.bandeja.useQuery(undefined, { enabled: aprobado, refetchInterval: 60_000 });
  const [pestana, setPestana] = useState<Pestana>("nuevas");
  const [aceptando, setAceptando] = useState<Oferta | null>(null);
  const [rechazando, setRechazando] = useState<Oferta | null>(null);
  const [motivo, setMotivo] = useState("");
  const utils = trpc.useUtils();

  const responder = trpc.abogados.responder.useMutation({
    onSuccess: (_r, v) => {
      setAceptando(null);
      setRechazando(null);
      setMotivo("");
      utils.abogados.bandeja.invalidate();
      if (v.respuesta === "aceptada") {
        toast.success("Solicitud aceptada: ya tienes los datos de contacto");
        setPestana("aceptadas");
      } else toast.success("Solicitud rechazada");
    },
    onError: e => {
      toast.error(e.message);
      utils.abogados.bandeja.invalidate();
    },
  });

  if (!aprobado)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="w-5 h-5" /> Solicitudes de clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">Cuando tu cuenta esté aprobada, aquí verás las solicitudes de clientes.</CardContent>
      </Card>
    );

  const ofertas = bandeja.data?.ofertas ?? [];
  const grupos: Record<Pestana, Oferta[]> = {
    nuevas: ofertas.filter(o => o.estado === "enviada"),
    aceptadas: ofertas.filter(o => o.estado === "aceptada"),
    historial: ofertas.filter(o => o.estado === "rechazada" || o.estado === "caducada"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="w-5 h-5" /> Solicitudes de clientes
        </CardTitle>
        <div className="flex gap-1 border-b -mx-6 px-6" role="tablist">
          {(
            [
              ["nuevas", "Nuevas"],
              ["aceptadas", "Aceptadas"],
              ["historial", "Historial"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${pestana === id ? "border-blue-900 text-blue-900" : "border-transparent text-gray-600"}`}
            >
              {label}
              {grupos[id].length > 0 && <span className="ml-1 text-xs tabular-nums">({grupos[id].length})</span>}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {bandeja.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : grupos[pestana].length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            {pestana === "nuevas" ? "No tienes solicitudes nuevas. Te avisaremos por email cuando llegue una." : "Nada por aquí todavía."}
          </p>
        ) : (
          <ul className="space-y-3">
            {grupos[pestana].map(o => (
              <li key={o.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-blue-900">{o.especialidad}</strong>
                  {o.provincia && <Badge variant="outline">{o.provincia}</Badge>}
                  {o.localidad && <span className="text-sm text-gray-600">{o.localidad}</span>}
                  <Badge variant="outline">{o.tipoCliente === "empresa" ? "Empresa" : "Particular"}</Badge>
                  {o.estado === "enviada" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-amber-800">
                      <Clock className="w-3.5 h-3.5" /> {quedan(o.expiraAt)}
                    </span>
                  )}
                  {o.estado === "rechazada" && <Badge className="bg-red-100 text-red-900 ml-auto">Rechazada</Badge>}
                  {o.estado === "caducada" && <Badge className="bg-gray-200 text-gray-700 ml-auto">Cerrada / sin respuesta</Badge>}
                </div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-2">{o.descripcion}</p>
                <p className="text-xs text-gray-500">
                  Recibida {fecha(o.recibidaAt, true)}
                  {o.presupuesto && ` · presupuesto orientativo: ${o.presupuesto}`}
                </p>

                {o.contacto && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                    <p className="text-sm">
                      <strong>{o.contacto.nombre}</strong> · aceptada {fecha(o.respondidaAt, true)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${o.contacto.telefono.replace(/\s/g, "")}`}>
                          <Phone className="w-4 h-4" /> {o.contacto.telefono}
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="text-green-800 border-green-300">
                        <a href={`https://wa.me/${telefonoWhatsApp(o.contacto.telefono)}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`mailto:${o.contacto.email}`}>
                          <Mail className="w-4 h-4" /> {o.contacto.email}
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {o.estado === "enviada" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setAceptando(o)}>
                      <Check className="w-4 h-4" /> Aceptar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200" onClick={() => setRechazando(o)}>
                      <X className="w-4 h-4" /> Rechazar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={aceptando != null} onOpenChange={o => !o && setAceptando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aceptar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Verás el nombre, teléfono y email del cliente para contactarle. Aceptar tiene un coste de{" "}
              <strong>{bandeja.data?.precio ?? ""} € + IVA</strong>, que se incluye en tu factura mensual aunque el cliente no llegue a contratarte. A partir de ese momento tratas sus datos como
              responsable, con secreto profesional, según las condiciones para abogados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-700 hover:bg-green-800"
              disabled={responder.isPending}
              onClick={e => {
                e.preventDefault();
                if (aceptando) responder.mutate({ id: aceptando.id, respuesta: "aceptada" });
              }}
            >
              Aceptar ({bandeja.data?.precio ?? ""} € + IVA)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rechazando != null} onOpenChange={o => !o && setRechazando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar la solicitud</AlertDialogTitle>
            <AlertDialogDescription>Opcional: dinos por qué, para enviarte solicitudes que encajen mejor.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} rows={2} placeholder="Ej.: no llevo este tipo de asuntos" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={responder.isPending}
              onClick={e => {
                e.preventDefault();
                if (rechazando) responder.mutate({ id: rechazando.id, respuesta: "rechazada", motivo: motivo.trim() || undefined });
              }}
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
