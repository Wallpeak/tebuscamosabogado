import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descargarLeadsCsv, diaAIso, ESTADOS, estadoInfo, fecha, type Estado } from "@/lib/panel";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ChevronLeft, ChevronRight, Download, StickyNote } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import LeadDetalle from "./LeadDetalle";

const POR_PAGINA = 50;

/** Pestaña "Leads": filtros en el servidor, tabla paginada, exportación CSV y ficha de cada lead. */
export default function Leads() {
  const [estado, setEstado] = useState<"todos" | Estado>("todos");
  const [especialidadId, setEspecialidadId] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<number | null>(null);

  // Espera a que se deje de escribir para buscar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto), 300);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => setPagina(0), [estado, especialidadId, desde, hasta, busqueda]);

  const filtros = {
    estado: estado === "todos" ? undefined : estado,
    especialidadId: especialidadId === "todas" ? undefined : Number(especialidadId),
    desde: desde ? diaAIso(desde) : undefined,
    hasta: hasta ? diaAIso(hasta, true) : undefined,
    busqueda: busqueda || undefined,
  };

  const especialidades = trpc.especialidades.list.useQuery();
  const lista = trpc.leads.list.useQuery({ ...filtros, limite: POR_PAGINA, offset: pagina * POR_PAGINA });
  const utils = trpc.useUtils();
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    setExportando(true);
    try {
      const todo = await utils.leads.list.fetch({ ...filtros, limite: 5000 });
      if (todo.items.length === 0) return void toast.info("No hay leads con estos filtros");
      descargarLeadsCsv(todo.items);
    } catch {
      toast.error("No se pudo exportar");
    } finally {
      setExportando(false);
    }
  };

  const limpiar = () => {
    setEstado("todos");
    setEspecialidadId("todas");
    setDesde("");
    setHasta("");
    setTexto("");
  };

  const total = lista.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <CardContent className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Campo etiqueta="Buscar" className="lg:col-span-2">
            <Input placeholder="Nombre, email, teléfono o localidad" value={texto} onChange={e => setTexto(e.target.value)} />
          </Campo>
          <Campo etiqueta="Estado">
            <Select value={estado} onValueChange={v => setEstado(v as typeof estado)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map(e => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etiqueta="Especialidad">
            <Select value={especialidadId} onValueChange={setEspecialidadId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {especialidades.data?.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etiqueta="Desde">
            <Input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta">
            <Input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} />
          </Campo>
          <div className="flex gap-2 lg:col-span-6 justify-end">
            <Button variant="outline" onClick={limpiar}>
              Limpiar filtros
            </Button>
            <Button onClick={exportar} disabled={exportando} className="bg-blue-900 hover:bg-blue-800">
              <Download className="w-4 h-4" /> {exportando ? "Exportando..." : "Exportar CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 overflow-hidden">
        {lista.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !lista.data?.items.length ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No hay leads que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.data.items.map(l => (
                  <TableRow
                    key={l.id}
                    onClick={() => setAbierto(l.id)}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && setAbierto(l.id)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-blue-50/50 focus-visible:bg-blue-50"
                  >
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{fecha(l.fechaRecepcion, true)}</TableCell>
                    <TableCell className="font-medium">
                      {l.nombre}
                      {l.numNotas > 0 && <StickyNote className="inline w-3.5 h-3.5 ml-1.5 text-gray-400" aria-label={`${l.numNotas} notas`} />}
                      {l.origen !== "suprimido" && <div className="md:hidden text-xs text-gray-500">{l.telefono}</div>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-600">
                      {l.origen === "suprimido" ? (
                        <span className="italic text-gray-400">Datos suprimidos</span>
                      ) : (
                        <>
                          {l.telefono}
                          <div className="text-xs">{l.email}</div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.especialidad}
                      {l.provincia && <div className="text-xs text-gray-500">{l.provincia}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge className={estadoInfo(l.estado).clase}>{estadoInfo(l.estado).label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
          <span>
            {total} {total === 1 ? "lead" : "leads"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} aria-label="Página anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="tabular-nums">
              {pagina + 1} / {paginas}
            </span>
            <Button variant="outline" size="sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)} aria-label="Página siguiente">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <LeadDetalle id={abierto} onClose={() => setAbierto(null)} />
    </div>
  );
}

function Campo({ etiqueta, className, children }: { etiqueta: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-gray-700 mb-1 block">{etiqueta}</span>
      {children}
    </label>
  );
}
