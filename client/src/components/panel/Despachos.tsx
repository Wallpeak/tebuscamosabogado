import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Despacho } from "@/lib/panel";
import { trpc } from "@/lib/trpc";
import { Pencil, Plus } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

type Form = {
  id?: number;
  nombre: string;
  email: string;
  telefono: string;
  colegio: string;
  numColegiado: string;
  activo: boolean;
  especialidades: string[];
};
const VACIO: Form = { nombre: "", email: "", telefono: "", colegio: "", numColegiado: "", activo: true, especialidades: [] };

/** Pestaña "Despachos": abogados colaboradores a los que se derivan los leads. */
export default function Despachos() {
  const utils = trpc.useUtils();
  const lista = trpc.despachos.list.useQuery();
  const especialidades = trpc.especialidades.list.useQuery();
  const [form, setForm] = useState<Form | null>(null);

  const guardar = trpc.despachos.save.useMutation({
    onSuccess: () => {
      setForm(null);
      utils.despachos.list.invalidate();
      toast.success("Despacho guardado");
    },
    onError: e => toast.error(e.message || "No se pudo guardar"),
  });

  const editar = (d: Despacho) =>
    setForm({
      id: d.id,
      nombre: d.nombre,
      email: d.email ?? "",
      telefono: d.telefono ?? "",
      colegio: d.colegio ?? "",
      numColegiado: d.numColegiado ?? "",
      activo: d.activo,
      especialidades: d.especialidades,
    });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!form?.nombre.trim()) return;
    const vacio = (s: string) => s.trim() || null;
    guardar.mutate({
      id: form.id,
      nombre: form.nombre,
      email: vacio(form.email),
      telefono: vacio(form.telefono),
      colegio: vacio(form.colegio),
      numColegiado: vacio(form.numColegiado),
      activo: form.activo,
      especialidades: form.especialidades,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-sm text-gray-600">
          Abogados o despachos colegiados a los que derivas consultas. Cada derivación queda registrada en la ficha del lead.
        </p>
        <Button onClick={() => setForm(VACIO)} className="bg-blue-900 hover:bg-blue-800 shrink-0">
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      {lista.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !lista.data?.length ? (
        <Card>
          <CardContent className="text-center text-gray-600 py-8">Todavía no hay despachos.</CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.data.map(d => (
            <Card key={d.id} className={`gap-3 ${d.activo ? "" : "opacity-60"}`}>
              <CardHeader className="flex-row items-start justify-between">
                <CardTitle className="text-base">
                  {d.nombre}
                  {!d.activo && <Badge className="ml-2 bg-gray-200 text-gray-700">Inactivo</Badge>}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => editar(d)} aria-label={`Editar ${d.nombre}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-1">
                {d.colegio && (
                  <p>
                    {d.colegio}
                    {d.numColegiado && ` · nº ${d.numColegiado}`}
                  </p>
                )}
                {d.telefono && <p>{d.telefono}</p>}
                {d.email && <p className="truncate">{d.email}</p>}
                <div className="flex flex-wrap gap-1 pt-1">
                  {d.especialidades.map(e => (
                    <Badge key={e} variant="outline">
                      {e}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={form != null} onOpenChange={abierto => !abierto && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar despacho" : "Nuevo despacho"}</DialogTitle>
            <DialogDescription>Comprueba que el abogado está colegiado antes de derivarle consultas.</DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={enviar} className="space-y-3">
              <Campo etiqueta="Nombre *">
                <Input required maxLength={255} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Email">
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Input type="tel" maxLength={20} value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </Campo>
                <Campo etiqueta="Colegio de la Abogacía">
                  <Input maxLength={120} value={form.colegio} onChange={e => setForm({ ...form, colegio: e.target.value })} />
                </Campo>
                <Campo etiqueta="Nº de colegiado">
                  <Input maxLength={40} value={form.numColegiado} onChange={e => setForm({ ...form, numColegiado: e.target.value })} />
                </Campo>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-2">Especialidades</legend>
                <div className="grid grid-cols-2 gap-2">
                  {especialidades.data?.map(e => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.especialidades.includes(e.nombre)}
                        onCheckedChange={c =>
                          setForm({
                            ...form,
                            especialidades: c ? [...form.especialidades, e.nombre] : form.especialidades.filter(x => x !== e.nombre),
                          })
                        }
                      />
                      {e.nombre}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.activo} onCheckedChange={c => setForm({ ...form, activo: c === true })} />
                Activo (aparece al derivar)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardar.isPending} className="bg-blue-900 hover:bg-blue-800">
                  {guardar.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 mb-1 block">{etiqueta}</span>
      {children}
    </label>
  );
}
