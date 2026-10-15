import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Trash2, Eye, Filter, LogOut, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/** Puerta de acceso: muestra el login si no hay sesión de administrador. */
export default function Dashboard() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  if (me.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }
  if (!me.data?.isAdmin) return <LoginForm onSuccess={() => me.refetch()} />;
  return <LeadsPanel onLogout={() => me.refetch()} />;
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      setPassword("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message || "No se pudo iniciar sesión"),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Lock className="w-5 h-5" /> Panel privado
          </CardTitle>
          <CardDescription>Introduce la contraseña de administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) login.mutate({ password });
            }}
          >
            <Input
              type="password"
              autoComplete="current-password"
              aria-label="Contraseña"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full bg-blue-900 hover:bg-blue-800" disabled={login.isPending}>
              {login.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LeadsPanel({ onLogout }: { onLogout: () => void }) {
  const logoutMutation = trpc.auth.logout.useMutation({ onSettled: onLogout });

  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const leadsQuery = trpc.leads.list.useQuery();
  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado correctamente");
      leadsQuery.refetch();
      setSelectedLead(null);
      setShowDetails(false);
    },
    onError: () => {
      toast.error("Error al actualizar el estado");
    },
  });

  const deleteMutation = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead eliminado correctamente");
      leadsQuery.refetch();
      setShowDeleteDialog(false);
      setLeadToDelete(null);
    },
    onError: () => {
      toast.error("Error al eliminar el lead");
    },
  });

  const leads = leadsQuery.data?.items ?? [];

  // Filtrar leads
  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead: any) => {
      const cumpleEstado = filtroEstado === "todos" || lead.estado === filtroEstado;
      const cumpleEspecialidad = filtroEspecialidad === "todos" || lead.especialidad === filtroEspecialidad;
      const cumpleBusqueda =
        busqueda === "" ||
        lead.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        lead.email.toLowerCase().includes(busqueda.toLowerCase()) ||
        lead.telefono.includes(busqueda);

      return cumpleEstado && cumpleEspecialidad && cumpleBusqueda;
    });
  }, [leads, filtroEstado, filtroEspecialidad, busqueda]);

  // Estadísticas
  const stats = {
    total: leads.length,
    nuevo: leads.filter((l: any) => l.estado === "nuevo").length,
    enProceso: leads.filter((l: any) => l.estado === "en_proceso").length,
    cerrado: leads.filter((l: any) => l.estado === "cerrado").length,
  };

  const especialidades = Array.from(new Set(leads.map((l: any) => l.especialidad))).sort();

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "nuevo":
        return <Badge className="bg-blue-100 text-blue-900">Nuevo</Badge>;
      case "en_proceso":
        return <Badge className="bg-yellow-100 text-yellow-900">En Proceso</Badge>;
      case "cerrado":
        return <Badge className="bg-green-100 text-green-900">Cerrado</Badge>;
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  const handleUpdateStatus = (leadId: number, nuevoEstado: string) => {
    updateStatusMutation.mutate({ id: leadId, estado: nuevoEstado as any });
  };

  const handleDeleteClick = (leadId: number) => {
    setLeadToDelete(leadId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (leadToDelete) {
      deleteMutation.mutate(leadToDelete);
    }
  };

  const handleViewDetails = (lead: any) => {
    setSelectedLead(lead);
    setNewStatus(lead.estado);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-900">Panel de Gestión de Leads</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Nuevos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.nuevo}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">En Proceso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.enProceso}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cerrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.cerrado}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Búsqueda</label>
                <Input
                  placeholder="Nombre, email o teléfono..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="border-gray-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Estado</label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Especialidad</label>
                <Select value={filtroEspecialidad} onValueChange={setFiltroEspecialidad}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {especialidades.map((esp: any) => (
                      <SelectItem key={esp as string} value={esp as string}>
                        {esp as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusqueda("");
                    setFiltroEstado("todos");
                    setFiltroEspecialidad("todos");
                  }}
                  className="w-full"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({leadsFiltrados.length})</CardTitle>
            <CardDescription>
              Gestiona y realiza seguimiento de todas las solicitudes de asesoramiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leadsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : leadsFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No hay leads que coincidan con los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-bold">Nombre</TableHead>
                      <TableHead className="font-bold">Email</TableHead>
                      <TableHead className="font-bold">Especialidad</TableHead>
                      <TableHead className="font-bold">Estado</TableHead>
                      <TableHead className="font-bold">Fecha</TableHead>
                      <TableHead className="font-bold text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsFiltrados.map((lead: any) => (
                      <TableRow key={lead.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{lead.nombre}</TableCell>
                        <TableCell className="text-sm text-gray-600">{lead.email}</TableCell>
                        <TableCell className="text-sm">{lead.especialidad}</TableCell>
                        <TableCell>{getEstadoBadge(lead.estado)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(lead.fechaRecepcion).toLocaleDateString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(lead)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(lead.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Lead</DialogTitle>
            <DialogDescription>Información completa y opciones de gestión</DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nombre</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.nombre}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Teléfono</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.telefono}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Tipo de Cliente</label>
                  <p className="text-lg font-semibold text-gray-900 capitalize">{selectedLead.tipoCliente}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Especialidad</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.especialidad}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Presupuesto</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLead.presupuesto || "No especificado"}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Descripción del Caso</label>
                <p className="text-gray-900 mt-2 p-3 bg-gray-50 rounded">{selectedLead.descripcion}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 block mb-2">Cambiar Estado</label>
                <div className="flex gap-2">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="cerrado">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => handleUpdateStatus(selectedLead.id, newStatus)}
                    disabled={updateStatusMutation.isPending}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    {updateStatusMutation.isPending ? "Actualizando..." : "Actualizar"}
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  <strong>Recibido:</strong> {new Date(selectedLead.fechaRecepcion).toLocaleString("es-ES")}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmación de Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El lead será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
