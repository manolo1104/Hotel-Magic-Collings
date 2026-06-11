// ============================================================
// ESQUEMA DRIZZLE — inventario, disponibilidad y reservas
// Postgres en producción · PGlite (embebido) en desarrollo.
// Magic Collinn tiene su PROPIA base de datos (no comparte con mi-hotel).
// ============================================================
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

// 2 registros: "sencilla", "doble"
export const roomTypes = pgTable("room_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // "sencilla" | "doble"
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
  capacidad: integer("capacidad").notNull(),
  tarifaBase: integer("tarifa_base").notNull(), // MXN por noche
  amenidades: text("amenidades").array().notNull().default([]),
  fotos: text("fotos").array().notNull().default([]),
});

// 6 registros físicos (3 sencillas + 3 dobles)
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  numero: text("numero").notNull(),
  activa: boolean("activa").notNull().default(true),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  checkin: date("checkin", { mode: "string" }).notNull(),
  checkout: date("checkout", { mode: "string" }).notNull(),
  huespedes: integer("huespedes").notNull(),
  nombre: text("nombre").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email"),
  estado: text("estado").notNull().default("pendiente"), // pendiente | confirmada | cancelada
  total: integer("total").notNull(), // MXN
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RoomType = typeof roomTypes.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
