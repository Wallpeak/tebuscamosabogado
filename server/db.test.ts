import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as db from "./db";

beforeAll(() => db.abrirBD(":memory:"));
afterAll(() => db.cerrarBD());

const base = {
  nombre: "Ana",
  telefono: "600111222",
  email: "ANA@example.com",
  tipoCliente: "particular" as const,
  especialidad: "familia",
  descripcion: "Consulta sobre custodia",
  localidad: "Madrid",
};

describe("base de datos", () => {
  it("trae las especialidades iniciales", () => {
    expect(db.listarEspecialidades().map(e => e.nombre)).toContain("Familia");
  });

  it("crea un lead con consentimiento e historial inicial", () => {
    const id = db.crearLead(base);
    const l = db.obtenerLead(id)!;
    expect(l.especialidad).toBe("Familia");
    expect(l.email).toBe("ana@example.com");
    expect(l.politicaVersion).toBe(db.POLITICA_VERSION);
    expect(l.historial).toHaveLength(1);
  });

  it("especialidad desconocida → Otros", () => {
    const id = db.crearLead({ ...base, especialidad: "No existe" });
    expect(db.obtenerLead(id)!.especialidad).toBe("Otros");
  });

  it("registra cambios de estado y la fecha de primer contacto", () => {
    const id = db.crearLead(base);
    db.actualizarEstadoLead(id, "en_proceso");
    db.actualizarEstadoLead(id, "en_proceso");
    const l = db.obtenerLead(id)!;
    expect(l.historial).toHaveLength(2);
    expect(l.contactadoAt).not.toBeNull();
  });

  it("deriva a un despacho y borra en cascada", () => {
    const id = db.crearLead(base);
    db.agregarNota(id, "Llamado");
    const despacho = db.guardarDespacho({ nombre: "Despacho Uno", especialidades: ["Familia"] });
    db.derivarLead(id, despacho);
    expect(db.obtenerLead(id)!.derivaciones[0].despacho).toBe("Despacho Uno");
    expect(db.obtenerLead(id)!.estado).toBe("en_proceso");
    expect(db.eliminarLead(id)).toBe(true);
    expect(db.listarNotas(id)).toHaveLength(0);
  });

  it("filtra y busca sin inyección de comodines", () => {
    expect(db.listarLeads({ busqueda: "madr" }).total).toBeGreaterThan(0);
    expect(db.listarLeads({ busqueda: "%" }).total).toBe(0);
  });

  it("rechaza datos inválidos a nivel de BD", () => {
    expect(() => db.crearLead({ ...base, telefono: "1" })).toThrow();
  });

  it("calcula estadísticas con eventos", () => {
    db.registrarEvento("click_whatsapp", "/");
    const s = db.obtenerEstadisticas(30);
    expect(s.eventos.click_whatsapp).toBe(1);
    expect(s.total).toBe(db.listarLeads().total);
  });
});
