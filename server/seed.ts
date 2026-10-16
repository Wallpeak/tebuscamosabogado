/**
 * Datos de ejemplo para probar la web en local: `pnpm seed`.
 * Solo escribe en la base de datos local (DATABASE_PATH o data/tebuscamos.db). No usar en producción.
 */
import { hashPassword } from "./auth";
import * as db from "./db";
import { CONDICIONES_ABOGADOS_VERSION } from "./provincias";
import { ENV } from "./env";

if (process.env.NODE_ENV === "production") throw new Error("seed no se ejecuta en producción");

db.abrirBD(ENV.databasePath);

const despachos = [
  { nombre: "Despacho de ejemplo A", colegio: "ICAM", especialidades: ["Familia", "Civil"] },
  { nombre: "Despacho de ejemplo B", colegio: "ICAB", especialidades: ["Laboral", "Mercantil"] },
].map(d => db.guardarDespacho(d));

const nombres = ["Cliente Prueba 1", "Cliente Prueba 2", "Cliente Prueba 3", "Cliente Prueba 4", "Cliente Prueba 5", "Cliente Prueba 6"];
const especialidades = ["Familia", "Laboral", "Civil", "Penal", "Mercantil", "Inmobiliario"];

nombres.forEach((nombre, i) => {
  const id = db.crearLead({
    nombre,
    telefono: `60000000${i}`,
    email: `prueba${i}@example.com`,
    tipoCliente: i % 3 === 0 ? "empresa" : "particular",
    especialidad: especialidades[i],
    provincia: ["Madrid", "Barcelona", "Valencia"][i % 3],
    localidad: ["Madrid", "Barcelona", "Valencia"][i % 3],
    descripcion: "Consulta de ejemplo generada para probar el panel.",
    origen: "demo",
  });
  if (i % 2 === 0) db.actualizarEstadoLead(id, "en_proceso");
  if (i === 0) {
    db.agregarNota(id, "Nota de ejemplo: llamar el lunes.");
    db.derivarLead(id, despachos[0]);
  }
  if (i === 5) db.actualizarEstadoLead(id, "cerrado");
});

for (let i = 0; i < 40; i++) db.registrarEvento("visita", "/");
for (let i = 0; i < 7; i++) db.registrarEvento("click_whatsapp", "/");

const alta = (email: string, nombre: string, aprobar: boolean) => {
  if (db.emailRegistrado(email)) return null;
  const { despachoId } = db.registrarAbogado({
    email,
    passwordHash: hashPassword("demo1234"),
    nombre,
    telefono: "600999999",
    colegio: "ICAM",
    numColegiado: "00000",
    especialidades: ["Familia", "Civil", "Laboral"],
    provincias: ["Madrid", "Barcelona", "Valencia"],
    condicionesVersion: CONDICIONES_ABOGADOS_VERSION,
  });
  if (aprobar) db.revisarAbogado(despachoId, "aprobado");
  return despachoId;
};
const aprobado = alta("abogado-demo@example.com", "Abogado de ejemplo", true);
alta("pendiente-demo@example.com", "Abogada pendiente de ejemplo", false);
// Dos solicitudes en la bandeja del abogado aprobado.
if (aprobado) for (const leadId of db.listarLeads({ limite: 2 }).items.map(l => l.id)) db.enviarOferta(leadId, aprobado, 48);

console.log(`Datos de ejemplo creados en ${ENV.databasePath}`);
console.log('Abogados de prueba (contraseña demo1234): abogado-demo@example.com (aprobado, con 2 solicitudes) y pendiente-demo@example.com (pendiente)');
db.cerrarBD();
