import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Solicitudes de contacto recibidas desde el formulario de la web. */
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
