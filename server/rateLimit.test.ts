import { describe, expect, it } from "vitest";
import { crearLimitador } from "./rateLimit";

describe("limitador", () => {
  it("permite hasta `max` usos por ventana y luego bloquea", () => {
    const l = crearLimitador({ max: 3, ventanaMs: 1000 });
    expect([1, 2, 3, 4].map(() => l.consumir("ip", 0))).toEqual([true, true, true, false]);
    expect(l.agotado("ip", 10)).toBe(true);
    expect(l.segundosRestantes("ip", 500)).toBe(1);
  });

  it("se libera al terminar la ventana", () => {
    const l = crearLimitador({ max: 1, ventanaMs: 1000 });
    l.consumir("ip", 0);
    expect(l.consumir("ip", 999)).toBe(false);
    expect(l.consumir("ip", 1000)).toBe(true);
  });

  it("cada clave lleva su propia cuenta y reset la olvida", () => {
    const l = crearLimitador({ max: 1, ventanaMs: 1000 });
    l.consumir("a", 0);
    expect(l.consumir("b", 0)).toBe(true);
    l.reset("a");
    expect(l.agotado("a", 0)).toBe(false);
  });

  it("agotado no suma usos", () => {
    const l = crearLimitador({ max: 1, ventanaMs: 1000 });
    for (let i = 0; i < 5; i++) l.agotado("ip", 0);
    expect(l.consumir("ip", 0)).toBe(true);
  });

  it("no crece sin límite con muchas claves distintas", () => {
    const l = crearLimitador({ max: 1, ventanaMs: 1000, maxClaves: 100 });
    for (let i = 0; i < 1000; i++) l.consumir(`ip${i}`, 0);
    // Las más antiguas se descartan: la primera vuelve a estar libre, la última sigue contada.
    expect(l.agotado("ip0", 0)).toBe(false);
    expect(l.agotado("ip999", 0)).toBe(true);
  });
});
