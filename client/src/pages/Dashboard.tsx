import { LoginForm, MiCuenta, TarjetaAcceso } from "@/components/Acceso";
import Abogados from "@/components/panel/Abogados";
import Despachos from "@/components/panel/Despachos";
import Leads from "@/components/panel/Leads";
import Resumen from "@/components/panel/Resumen";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { BarChart3, Building2, Inbox, LogOut, Scale, UserRound } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

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
  const usuario = me.data?.usuario;
  if (!usuario) return <LoginForm onSuccess={() => me.refetch()} />;
  if (!me.data?.isAdmin) return <SinPermiso onLogout={() => me.refetch()} />;
  return <LeadsPanel usuario={usuario} onLogout={() => me.refetch()} />;
}

/** Usuario con sesión pero sin rol de administrador (p. ej., un abogado antes de que exista su área). */
function SinPermiso({ onLogout }: { onLogout: () => void }) {
  const logout = trpc.auth.logout.useMutation({ onSettled: onLogout });
  return (
    <TarjetaAcceso titulo="Sin acceso al panel" descripcion="Tu cuenta no tiene permiso para ver el panel de gestión.">
      <div className="space-y-2">
        <Button asChild className="w-full bg-blue-900 hover:bg-blue-800">
          <Link href="/abogados">Ir al área de abogados</Link>
        </Button>
        <Button variant="outline" className="w-full" onClick={() => logout.mutate()}>
          Salir
        </Button>
      </div>
    </TarjetaAcceso>
  );
}

const SECCIONES = [
  { id: "resumen", label: "Resumen", icono: BarChart3, Componente: Resumen },
  { id: "leads", label: "Leads", icono: Inbox, Componente: Leads },
  { id: "abogados", label: "Abogados", icono: Scale, Componente: Abogados },
  { id: "despachos", label: "Despachos", icono: Building2, Componente: Despachos },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

function LeadsPanel({ usuario, onLogout }: { usuario: { email: string; nombre: string }; onLogout: () => void }) {
  const [cuenta, setCuenta] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({ onSettled: onLogout });
  const [seccion, setSeccion] = useState<Seccion>(() => {
    const h = window.location.hash.slice(1);
    return SECCIONES.some(p => p.id === h) ? (h as Seccion) : "resumen";
  });
  const sinAtender = trpc.stats.useQuery({ dias: 30 }).data?.porEstado.nuevo ?? 0;
  const pendientes = trpc.abogados.list.useQuery({ estado: "pendiente" }).data?.length ?? 0;
  const contador: Partial<Record<Seccion, { n: number; texto: string }>> = {
    leads: { n: sinAtender, texto: "sin atender" },
    abogados: { n: pendientes, texto: "pendientes de revisión" },
  };

  const cambiar = (p: Seccion) => {
    setSeccion(p);
    history.replaceState(null, "", `#${p}`);
  };
  const Activa = SECCIONES.find(p => p.id === seccion)!.Componente;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 pt-3 flex justify-between items-center gap-4">
          <h1 className="text-lg md:text-2xl font-bold text-blue-900">Panel de gestión</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCuenta(true)} className="flex items-center gap-2" aria-label="Mi cuenta">
              <UserRound className="w-4 h-4" />
              <span className="hidden sm:inline">Mi cuenta</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
        <nav className="container mx-auto px-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Secciones del panel">
          {SECCIONES.map(({ id, label, icono: Icono }) => (
            <button
              key={id}
              role="tab"
              aria-selected={seccion === id}
              onClick={() => cambiar(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                seccion === id ? "border-blue-900 text-blue-900" : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icono className="w-4 h-4" />
              {label}
              {(contador[id]?.n ?? 0) > 0 && (
                <span className="bg-blue-900 text-white text-xs rounded-full px-2 py-0.5 tabular-nums" aria-label={`${contador[id]!.n} ${contador[id]!.texto}`}>
                  {contador[id]!.n}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-4 py-6" role="tabpanel">
        <Activa />
      </main>
      <MiCuenta abierto={cuenta} onClose={() => setCuenta(false)} usuario={usuario} />
    </div>
  );
}
