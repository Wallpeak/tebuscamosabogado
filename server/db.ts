import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { type InsertLead, type Lead, leads } from "../drizzle/schema";
import { ENV } from "./env";

let _db: ReturnType<typeof drizzle> | null = null;

function db() {
  if (!ENV.databaseUrl) throw new Error("Base de datos no configurada (DATABASE_URL)");
  _db ??= drizzle(ENV.databaseUrl);
  return _db;
}

export async function createLead(lead: InsertLead) {
  await db().insert(leads).values(lead);
}

export function getLeads() {
  return db().select().from(leads).orderBy(desc(leads.fechaRecepcion));
}

export async function updateLeadStatus(id: number, estado: Lead["estado"]) {
  await db().update(leads).set({ estado }).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  await db().delete(leads).where(eq(leads.id, id));
}
