/**
 * Limitador de peticiones en memoria (ventana fija por clave, normalmente la IP).
 * Sin dependencias. Al ser en memoria se reinicia con el servidor y no se comparte
 * entre varias instancias: suficiente para una web con un solo proceso.
 */
export type Limitador = {
  /** Suma un uso a `clave`. Devuelve `true` si sigue dentro del límite. */
  consumir(clave: string, ahora?: number): boolean;
  /** `true` si `clave` ya agotó el límite en la ventana actual (no suma uso). */
  agotado(clave: string, ahora?: number): boolean;
  /** Olvida la clave (p. ej. tras un login correcto). */
  reset(clave: string): void;
  /** Segundos que faltan para que se libere `clave` (0 si no está limitada). */
  segundosRestantes(clave: string, ahora?: number): number;
};

export function crearLimitador({ max, ventanaMs, maxClaves = 10_000 }: { max: number; ventanaMs: number; maxClaves?: number }): Limitador {
  const usos = new Map<string, { n: number; desde: number }>();

  const vigente = (clave: string, ahora: number) => {
    const u = usos.get(clave);
    if (u && ahora - u.desde >= ventanaMs) {
      usos.delete(clave);
      return undefined;
    }
    return u;
  };

  // Evita que una avalancha de IPs distintas agote la memoria: limpia caducadas y, si no basta, las más antiguas.
  const podar = (ahora: number) => {
    if (usos.size < maxClaves) return;
    for (const [k, u] of usos) if (ahora - u.desde >= ventanaMs) usos.delete(k);
    for (const k of usos.keys()) {
      if (usos.size < maxClaves) break;
      usos.delete(k);
    }
  };

  return {
    consumir(clave, ahora = Date.now()) {
      const u = vigente(clave, ahora);
      if (u) return ++u.n <= max;
      podar(ahora);
      usos.set(clave, { n: 1, desde: ahora });
      return 1 <= max;
    },
    agotado(clave, ahora = Date.now()) {
      return (vigente(clave, ahora)?.n ?? 0) >= max;
    },
    reset(clave) {
      usos.delete(clave);
    },
    segundosRestantes(clave, ahora = Date.now()) {
      const u = vigente(clave, ahora);
      return u && u.n >= max ? Math.ceil((u.desde + ventanaMs - ahora) / 1000) : 0;
    },
  };
}
