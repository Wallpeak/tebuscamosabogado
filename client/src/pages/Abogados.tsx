/**
 * Área de abogados: registro (/abogados/registro) y zona privada (/abogados) con estado de la cuenta y perfil.
 * La bandeja de solicitudes está en components/Bandeja.tsx.
 */
import { CampoPassword, LoginForm, MiCuenta, TarjetaAcceso, useLimpiarDatosSesion } from "@/components/Acceso";
import Bandeja from "@/components/Bandeja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, LogOut, Scale, UserRound, XCircle } from "lucide-react";
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { MAX_ABOGADOS_DEFECTO, OFERTA_HORAS_DEFECTO, precioTexto } from "../../../server/condiciones";
import { PROVINCIAS } from "../../../server/provincias";

type DatosPerfil = {
  nombre: string;
  telefono: string;
  colegio: string;
  numColegiado: string;
  especialidades: string[];
  provincias: string[];
};

const VACIO: DatosPerfil = { nombre: "", telefono: "", colegio: "", numColegiado: "", especialidades: [], provincias: [] };

// ─── Registro ────────────────────────────────────────────────────────────────

export function RegistroAbogado() {
  const [, navegar] = useLocation();
  const [datos, setDatos] = useState<DatosPerfil>(VACIO);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [website, setWebsite] = useState(""); // campo trampa para robots
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const registro = trpc.abogados.registro.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navegar("/abogados");
    },
    onError: e => setError(e.message || "No se pudo completar el registro."),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const falta = validar(datos);
    if (falta) return setError(falta);
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (!acepta) return setError("Debes aceptar las condiciones para abogados.");
    registro.mutate({ ...datos, email: email.trim(), password, aceptaCondiciones: true, website });
  };

  return (
    <Pagina>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-900">Registro para abogados</CardTitle>
          <CardDescription>
            Recibe solicitudes de clientes de tu especialidad y provincia. Revisaremos tus datos de colegiación antes de activar la cuenta.
          </CardDescription>
          <ul className="mt-3 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded p-3 space-y-1">
            <li>
              <strong>Registrarte, recibir y rechazar solicitudes es gratis.</strong>
            </li>
            <li>
              Solo pagas <strong>{precioTexto()}</strong> por cada solicitud que aceptes, con independencia de tus honorarios y de si el cliente te
              contrata. Factura mensual.
            </li>
            <li>
              Ves un resumen sin datos de contacto y decides en {OFERTA_HORAS_DEFECTO} h.{" "}
              {MAX_ABOGADOS_DEFECTO === 1 ? "Cada solicitud la acepta un solo abogado." : `Cada solicitud la pueden aceptar hasta ${MAX_ABOGADOS_DEFECTO} abogados.`}
            </li>
          </ul>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo etiqueta="Email (será tu usuario) *">
                <Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </Campo>
              <Campo etiqueta="Contraseña * (mín. 6)">
                <CampoPassword valor={password} onChange={setPassword} nueva />
              </Campo>
            </div>
            <CamposPerfil datos={datos} onChange={setDatos} editaColegio />
            {/* Campo trampa: invisible para personas */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0"
            />
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox checked={acepta} onCheckedChange={c => setAcepta(c === true)} className="mt-0.5" />
              <span>
                Soy abogado/a colegiado/a ejerciente y acepto las{" "}
                <a href="/condiciones-abogados" target="_blank" className="underline text-blue-900">
                  condiciones para abogados
                </a>
                , incluido el precio por solicitud aceptada, y he leído la{" "}
                <a href="/privacidad" target="_blank" className="underline text-blue-900">
                  política de privacidad
                </a>
                .
              </span>
            </label>
            <AvisoError texto={error} />
            <Button type="submit" className="w-full h-12 text-base bg-blue-900 hover:bg-blue-800" disabled={registro.isPending}>
              {registro.isPending ? "Enviando..." : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm">
              ¿Ya tienes cuenta?{" "}
              <Link href="/abogados" className="underline text-blue-900">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </Pagina>
  );
}

// ─── Zona privada ────────────────────────────────────────────────────────────

export function AreaAbogado() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  if (me.isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  const usuario = me.data?.usuario;
  if (!usuario) return <LoginAbogado onSuccess={() => me.refetch()} />;
  if (usuario.rol !== "abogado")
    return (
      <TarjetaAcceso titulo="Zona de abogados" descripcion="Has entrado con una cuenta de administración.">
        <Button asChild className="w-full bg-blue-900 hover:bg-blue-800">
          <Link href="/dashboard">Ir al panel de gestión</Link>
        </Button>
      </TarjetaAcceso>
    );
  return <PanelAbogado usuario={usuario} onLogout={() => me.refetch()} />;
}

function LoginAbogado({ onSuccess }: { onSuccess: () => void }) {
  return (
    <LoginForm
      onSuccess={onSuccess}
      titulo="Área de abogados"
      pie={
        <p className="text-center text-sm border-t pt-4">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/abogados/registro" className="underline text-blue-900">
            Regístrate como abogado
          </Link>
        </p>
      }
    />
  );
}

function PanelAbogado({ usuario, onLogout }: { usuario: { email: string; nombre: string }; onLogout: () => void }) {
  const perfil = trpc.abogados.perfil.useQuery();
  const limpiar = useLimpiarDatosSesion();
  const logout = trpc.auth.logout.useMutation({ onSettled: () => (limpiar(), onLogout()) });
  const [cuenta, setCuenta] = useState(false);
  const p = perfil.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-lg md:text-2xl font-bold text-blue-900">Área de abogados</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCuenta(true)} aria-label="Mi cuenta">
              <UserRound className="w-4 h-4" /> <span className="hidden sm:inline">Mi cuenta</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {!p ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <EstadoCuenta estado={p.estado} motivo={p.motivoRechazo} />
            <Bandeja aprobado={p.estado === "aprobado" && p.activo} />
            <EditarPerfil
              key={p.id}
              inicial={{
                nombre: p.nombre,
                telefono: p.telefono ?? "",
                colegio: p.colegio ?? "",
                numColegiado: p.numColegiado ?? "",
                especialidades: p.especialidades,
                provincias: p.provincias,
              }}
              editaColegio={p.estado === "pendiente"}
              onGuardado={() => perfil.refetch()}
            />
          </>
        )}
      </main>
      <MiCuenta abierto={cuenta} onClose={() => setCuenta(false)} usuario={usuario} />
    </div>
  );
}

function EstadoCuenta({ estado, motivo }: { estado: string; motivo: string | null }) {
  if (estado === "aprobado")
    return (
      <Aviso icono={<CheckCircle2 className="w-6 h-6 text-green-700" />} clase="bg-green-50 border-green-200">
        <strong>Cuenta aprobada.</strong> Ya puedes recibir solicitudes de clientes.
      </Aviso>
    );
  if (estado === "rechazado")
    return (
      <Aviso icono={<XCircle className="w-6 h-6 text-red-700" />} clase="bg-red-50 border-red-200">
        <strong>No hemos podido aprobar tu cuenta.</strong>
        {motivo && <> Motivo: {motivo.replace(/[.\s]+$/, "")}.</>} Si crees que es un error, escríbenos.
      </Aviso>
    );
  return (
    <Aviso icono={<Clock className="w-6 h-6 text-amber-700" />} clase="bg-amber-50 border-amber-200">
      <strong>Cuenta en revisión.</strong> Estamos comprobando tus datos de colegiación. Te avisaremos por email.
    </Aviso>
  );
}

function EditarPerfil({ inicial, editaColegio, onGuardado }: { inicial: DatosPerfil; editaColegio: boolean; onGuardado: () => void }) {
  const [datos, setDatos] = useState(inicial);
  const [error, setError] = useState("");
  const guardar = trpc.abogados.actualizarPerfil.useMutation({
    onSuccess: () => {
      toast.success("Perfil guardado");
      onGuardado();
    },
    onError: e => setError(e.message || "No se pudo guardar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tu perfil</CardTitle>
        <CardDescription>Las solicitudes se reparten según tus especialidades y provincias.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={e => {
            e.preventDefault();
            setError("");
            const falta = validar(datos);
            if (falta) return setError(falta);
            guardar.mutate(editaColegio ? datos : { ...datos, colegio: undefined, numColegiado: undefined });
          }}
        >
          <CamposPerfil datos={datos} onChange={setDatos} editaColegio={editaColegio} />
          <AvisoError texto={error} />
          <Button type="submit" disabled={guardar.isPending} className="bg-blue-900 hover:bg-blue-800">
            {guardar.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Piezas compartidas ──────────────────────────────────────────────────────

function validar(d: DatosPerfil): string {
  if (d.nombre.trim().length < 2) return "Escribe tu nombre o el de tu despacho.";
  if (!/^\+?[\d\s().-]{9,20}$/.test(d.telefono.trim())) return "Revisa el teléfono.";
  if (d.colegio.trim().length < 2 || !d.numColegiado.trim()) return "Indica tu Colegio y tu número de colegiado.";
  if (!d.especialidades.length) return "Elige al menos una especialidad.";
  if (!d.provincias.length) return "Elige al menos una provincia.";
  return "";
}

function CamposPerfil({ datos, onChange, editaColegio }: { datos: DatosPerfil; onChange: Dispatch<SetStateAction<DatosPerfil>>; editaColegio: boolean }) {
  const especialidades = trpc.especialidades.list.useQuery();
  const set = (parcial: Partial<DatosPerfil>) => onChange(d => ({ ...d, ...parcial }));

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre y apellidos o despacho *">
          <Input value={datos.nombre} maxLength={255} onChange={e => set({ nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Teléfono profesional *">
          <Input type="tel" value={datos.telefono} maxLength={20} onChange={e => set({ telefono: e.target.value })} />
        </Campo>
        <Campo etiqueta="Colegio de la Abogacía *">
          <Input value={datos.colegio} maxLength={120} disabled={!editaColegio} placeholder="Ej.: ICAM" onChange={e => set({ colegio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Nº de colegiado *">
          <Input value={datos.numColegiado} maxLength={40} disabled={!editaColegio} onChange={e => set({ numColegiado: e.target.value })} />
        </Campo>
      </div>
      {!editaColegio && <p className="text-xs text-gray-500 -mt-2">El Colegio y el nº de colegiado ya están verificados. Para cambiarlos, escríbenos.</p>}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Especialidades *</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {especialidades.data?.map(e => (
            <Opcion key={e.id} texto={e.nombre} marcado={datos.especialidades.includes(e.nombre)} onChange={c => onChange(d => ({ ...d, especialidades: alternar(d.especialidades, e.nombre, c) }))} />
          ))}
        </div>
      </fieldset>

      <SelectorProvincias valor={datos.provincias} onChange={f => onChange(d => ({ ...d, provincias: f(d.provincias) }))} />
    </>
  );
}

function SelectorProvincias({ valor, onChange }: { valor: string[]; onChange: (f: (v: string[]) => string[]) => void }) {
  const [filtro, setFiltro] = useState("");
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visibles = [...PROVINCIAS].sort((a, b) => a.localeCompare(b, "es")).filter(p => normal(p).includes(normal(filtro)));

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 mb-2">
        Provincias en las que ejerces * <span className="text-gray-500 font-normal">({valor.length} {valor.length === 1 ? "elegida" : "elegidas"})</span>
      </legend>
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {valor.map(p => (
            <Badge key={p} variant="outline" className="cursor-pointer" onClick={() => onChange(v => v.filter(x => x !== p))}>
              {p} ✕
            </Badge>
          ))}
        </div>
      )}
      <Input placeholder="Buscar provincia..." value={filtro} onChange={e => setFiltro(e.target.value)} className="mb-2" aria-label="Buscar provincia" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded p-2">
        {visibles.map(p => (
          <Opcion key={p} texto={p} marcado={valor.includes(p)} onChange={c => onChange(v => alternar(v, p, c))} />
        ))}
      </div>
    </fieldset>
  );
}

const alternar = (lista: string[], valor: string, marcar: boolean) => (marcar ? [...new Set([...lista, valor])] : lista.filter(x => x !== valor));

function Opcion({ texto, marcado, onChange }: { texto: string; marcado: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={marcado} onCheckedChange={c => onChange(c === true)} />
      {texto}
    </label>
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

const AvisoError = ({ texto }: { texto: string }) =>
  texto ? (
    <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
      {texto}
    </p>
  ) : null;

function Aviso({ icono, clase, children }: { icono: ReactNode; clase: string; children: ReactNode }) {
  return (
    <div className={`flex gap-3 items-start border rounded-lg p-4 text-sm ${clase}`}>
      {icono}
      <p className="text-gray-900">{children}</p>
    </div>
  );
}

function Pagina({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Scale className="w-7 h-7 text-[#001a4d]" aria-hidden="true" />
          <a href="/" className="text-lg font-bold text-[#001a4d]">
            Te Buscamos Abogado
          </a>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
