import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, leads, InsertLead, testimonios, paginasLegales, Lead } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Leads queries
 */
export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leads).values(lead);
  return result;
}

export async function getLeads(filters?: {
  estado?: string;
  especialidad?: string;
  tipoCliente?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query: any = db.select().from(leads);
  
  if (filters?.estado) {
    query = query.where(eq(leads.estado, filters.estado as any));
  }
  if (filters?.especialidad) {
    query = query.where(eq(leads.especialidad, filters.especialidad));
  }
  if (filters?.tipoCliente) {
    query = query.where(eq(leads.tipoCliente, filters.tipoCliente as any));
  }
  
  return await query.orderBy((table: any) => desc(table.fechaRecepcion));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function updateLeadStatus(id: number, estado: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set({ estado: estado as any }).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leads).where(eq(leads.id, id));
}

/**
 * Testimonios queries
 */
export async function getTestimonios() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(testimonios).orderBy((table) => desc(table.destacado));
}

/**
 * Legal pages queries
 */
export async function getPaginaLegal(tipo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(paginasLegales).where(eq(paginasLegales.tipo, tipo as any)).limit(1);
  return result[0];
}

export async function createOrUpdatePaginaLegal(tipo: string, contenido: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getPaginaLegal(tipo);
  if (existing) {
    await db.update(paginasLegales).set({ contenido }).where(eq(paginasLegales.tipo, tipo as any));
  } else {
    await db.insert(paginasLegales).values({ tipo: tipo as any, contenido });
  }
}
