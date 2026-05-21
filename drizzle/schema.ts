import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table for capturing client inquiries
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  telefono: varchar("telefono", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  tipoCliente: mysqlEnum("tipoCliente", ["particular", "empresa"]).notNull(),
  especialidad: varchar("especialidad", { length: 100 }).notNull(),
  descripcion: text("descripcion").notNull(),
  presupuesto: varchar("presupuesto", { length: 50 }),
  estado: mysqlEnum("estado", ["nuevo", "en_proceso", "cerrado"]).default("nuevo").notNull(),
  fechaRecepcion: timestamp("fechaRecepcion").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Testimonios table for client testimonials
 */
export const testimonios = mysqlTable("testimonios", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  ciudad: varchar("ciudad", { length: 100 }).notNull(),
  tipoCaso: varchar("tipoCaso", { length: 100 }).notNull(),
  contenido: text("contenido").notNull(),
  destacado: int("destacado").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Testimonio = typeof testimonios.$inferSelect;
export type InsertTestimonio = typeof testimonios.$inferInsert;

/**
 * Legal pages table for storing legal content
 */
export const paginasLegales = mysqlTable("paginasLegales", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["aviso_legal", "privacidad", "cookies"]).notNull().unique(),
  contenido: text("contenido").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaginaLegal = typeof paginasLegales.$inferSelect;
export type InsertPaginaLegal = typeof paginasLegales.$inferInsert;