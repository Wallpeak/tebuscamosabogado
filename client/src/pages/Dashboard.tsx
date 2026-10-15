import Despachos from "@/components/panel/Despachos";
import Leads from "@/components/panel/Leads";
import Resumen from "@/components/panel/Resumen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { BarChart3, Building2, Inbox, Lock, LogOut } from "lucide-react";
import { useState } from "react";
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

const SECCIONES = [
  { id: "resumen", label: "Resumen", icono: BarChart3, Componente: Resumen },
  { id: "leads", label: "Leads", icono: Inbox, Componente: Leads },
  { id: "despachos", label: "Despachos", icono: Building2, Componente: Despachos },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

function LeadsPanel({ onLogout }: { onLogout: () => void }) {
  const logoutMutation = trpc.auth.logout.useMutation({ onSettled: onLogout });
  const [seccion, setSeccion] = useState<Seccion>(() => {
    const h = window.location.hash.slice(1);
    return SECCIONES.some(p => p.id === h) ? (h as Seccion) : "resumen";
  });
  const sinAtender = trpc.stats.useQuery({ dias: 30 }).data?.porEstado.nuevo ?? 0;

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
          <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
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
              {id === "leads" && sinAtender > 0 && (
                <span className="bg-blue-900 text-white text-xs rounded-full px-2 py-0.5 tabular-nums" aria-label={`${sinAtender} sin atender`}>
                  {sinAtender}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-4 py-6" role="tabpanel">
        <Activa />
      </main>
    </div>
  );
}
