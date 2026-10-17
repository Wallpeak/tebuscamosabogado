/**
 * Piezas de acceso reutilizables: tarjeta centrada, campo de contraseña con "ver", login,
 * "he olvidado mi contraseña", restablecer y cambiar contraseña.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "wouter";

const MIN = 6;
const USUARIO_KEY = "tba_ultimo_usuario";

/** Mensaje claro para quien no es técnico a partir del error de la API. */
const mensaje = (e: { message: string; data?: { code?: string } | null }) =>
  e.data?.code === "UNAUTHORIZED" ? "Usuario o contraseña incorrectos. Revisa mayúsculas y espacios." : e.message || "Algo ha fallado. Inténtalo de nuevo.";

/**
 * Al entrar o salir se borran de la caché los datos del usuario anterior (perfil, bandeja, leads…),
 * para que en un ordenador compartido nadie vea ni guarde datos de otra cuenta.
 */
export function useLimpiarDatosSesion() {
  const qc = useQueryClient();
  return () => qc.removeQueries({ predicate: q => !JSON.stringify(q.queryKey).startsWith('[["auth","me"]') });
}

export function TarjetaAcceso({ titulo, descripcion, children }: { titulo: string; descripcion?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 text-xl">
            <Lock className="w-5 h-5" /> {titulo}
          </CardTitle>
          {descripcion && <CardDescription>{descripcion}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

export function CampoPassword({
  valor,
  onChange,
  etiqueta = "Contraseña",
  nueva = false,
  autoFocus = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  etiqueta?: string;
  nueva?: boolean;
  autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input
        type={ver ? "text" : "password"}
        autoComplete={nueva ? "new-password" : "current-password"}
        aria-label={etiqueta}
        placeholder={etiqueta}
        value={valor}
        onChange={e => onChange(e.target.value)}
        className="h-12 text-lg pr-12"
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setVer(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-800"
        aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {ver ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

const AvisoError = ({ texto }: { texto: string }) =>
  texto ? (
    <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
      {texto}
    </p>
  ) : null;

const Ok = ({ children }: { children: ReactNode }) => (
  <p role="status" className="flex gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded p-3">
    <CheckCircle2 className="w-5 h-5 shrink-0" /> <span>{children}</span>
  </p>
);

/** Login con usuario (o email) y contraseña. Recuerda el último usuario en este navegador. */
export function LoginForm({ onSuccess, titulo = "Panel privado", pie }: { onSuccess: () => void; titulo?: string; pie?: ReactNode }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      return localStorage.getItem(USUARIO_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const limpiar = useLimpiarDatosSesion();
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      limpiar();
      try {
        localStorage.setItem(USUARIO_KEY, usuario.trim());
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      setPassword("");
      setError("");
      onSuccess();
    },
    onError: e => setError(mensaje(e)),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (usuario.trim() && password) login.mutate({ email: usuario.trim(), password });
  };

  return (
    <TarjetaAcceso titulo={titulo} descripcion="Escribe tu usuario y contraseña. Este navegador te recordará durante 30 días.">
      <form className="space-y-4" onSubmit={enviar}>
        <Input
          autoComplete="username"
          aria-label="Usuario o email"
          placeholder="Usuario o email"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
          className="h-12 text-lg"
          autoFocus={!usuario}
        />
        <CampoPassword valor={password} onChange={setPassword} autoFocus={!!usuario} />
        <AvisoError texto={error} />
        <Button type="submit" className="w-full h-12 text-base bg-blue-900 hover:bg-blue-800" disabled={login.isPending || !usuario.trim() || !password}>
          {login.isPending ? "Entrando..." : "Entrar"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/recuperar" className="text-blue-900 underline">
            ¿Has olvidado la contraseña?
          </Link>
        </p>
        {pie}
      </form>
    </TarjetaAcceso>
  );
}

/** Página /recuperar: pide el email y envía un enlace para cambiar la contraseña. */
export function Recuperar() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const pedir = trpc.auth.requestReset.useMutation({ onError: e => setError(mensaje(e)) });

  return (
    <TarjetaAcceso titulo="Recuperar contraseña" descripcion="Te enviaremos un enlace al email de tu cuenta para poner una contraseña nueva.">
      {pedir.isSuccess ? (
        <div className="space-y-4">
          <Ok>Si ese email tiene una cuenta, en unos minutos recibirás el enlace. Mira también en «Spam». El enlace vale 1 hora.</Ok>
          <VolverAlPanel />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setError("");
            if (email.trim()) pedir.mutate({ email: email.trim() });
          }}
        >
          <Input type="email" autoComplete="email" aria-label="Email" placeholder="Tu email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 text-lg" autoFocus />
          <AvisoError texto={error} />
          <Button type="submit" className="w-full h-12 text-base bg-blue-900 hover:bg-blue-800" disabled={pedir.isPending || !email.trim()}>
            {pedir.isPending ? "Enviando..." : "Enviar enlace"}
          </Button>
          <p className="text-xs text-gray-500">
            ¿La cuenta es «admin» sin email? Pide a quien gestiona el hosting que cambie la variable ADMIN_PASSWORD y reinicie la web.
          </p>
          <VolverAlPanel />
        </form>
      )}
    </TarjetaAcceso>
  );
}

/** Página /restablecer?token=...: pone la contraseña nueva. */
export function Restablecer() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const cambiar = trpc.auth.resetPassword.useMutation({ onError: e => setError(mensaje(e)) });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (nueva.length < MIN) return setError(`La contraseña debe tener al menos ${MIN} caracteres.`);
    if (nueva !== repetir) return setError("Las dos contraseñas no coinciden.");
    cambiar.mutate({ token, nueva });
  };

  return (
    <TarjetaAcceso titulo="Contraseña nueva">
      {!token ? (
        <div className="space-y-4">
          <AvisoError texto="El enlace no es válido. Pide uno nuevo." />
          <Link href="/recuperar" className="text-blue-900 underline text-sm">
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : cambiar.isSuccess ? (
        <div className="space-y-4">
          <Ok>Contraseña cambiada. Ya puedes entrar con la nueva.</Ok>
          <VolverAlPanel texto="Ir a entrar" />
        </div>
      ) : (
        <form className="space-y-4" onSubmit={enviar}>
          <CampoPassword valor={nueva} onChange={setNueva} etiqueta="Contraseña nueva" nueva autoFocus />
          <CampoPassword valor={repetir} onChange={setRepetir} etiqueta="Repite la contraseña" nueva />
          <AvisoError texto={error} />
          <Button type="submit" className="w-full h-12 text-base bg-blue-900 hover:bg-blue-800" disabled={cambiar.isPending || !nueva || !repetir}>
            {cambiar.isPending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      )}
    </TarjetaAcceso>
  );
}

const VolverAlPanel = ({ texto = "Volver a entrar" }: { texto?: string }) => (
  <p className="text-center text-sm">
    <Link href="/dashboard" className="text-blue-900 underline">
      {texto}
    </Link>
  </p>
);

/** Diálogo "Mi cuenta" del panel: datos del usuario y cambio de contraseña. */
export function MiCuenta({ abierto, onClose, usuario }: { abierto: boolean; onClose: () => void; usuario: { email: string; nombre: string } }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const cambiar = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setActual("");
      setNueva("");
      setRepetir("");
    },
    onError: e => setError(mensaje(e)),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (nueva.length < MIN) return setError(`La contraseña nueva debe tener al menos ${MIN} caracteres.`);
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");
    cambiar.mutate({ actual, nueva });
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={a => {
        if (!a) {
          cambiar.reset();
          setError("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mi cuenta</DialogTitle>
          <DialogDescription>
            Usuario: <strong>{usuario.email}</strong>
          </DialogDescription>
        </DialogHeader>
        {cambiar.isSuccess ? (
          <Ok>Contraseña cambiada. Se han cerrado las sesiones de otros navegadores.</Ok>
        ) : (
          <form className="space-y-3" onSubmit={enviar}>
            <h3 className="text-sm font-semibold text-gray-700">Cambiar contraseña</h3>
            <CampoPassword valor={actual} onChange={setActual} etiqueta="Contraseña actual" />
            <CampoPassword valor={nueva} onChange={setNueva} etiqueta="Contraseña nueva" nueva />
            <CampoPassword valor={repetir} onChange={setRepetir} etiqueta="Repite la nueva" nueva />
            <AvisoError texto={error} />
            <Button type="submit" className="w-full bg-blue-900 hover:bg-blue-800" disabled={cambiar.isPending || !actual || !nueva || !repetir}>
              {cambiar.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
