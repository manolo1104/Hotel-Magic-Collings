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
  // pendiente | confirmada | cancelada | expirada
  estado: text("estado").notNull().default("pendiente"),
  total: integer("total").notNull(), // MXN (precio total de la estancia)

  // ── Pago en línea (Mercado Pago) ───────────────────────────
  // no_iniciado (reserva por WhatsApp) | iniciado (esperando pago) |
  // pagado | rechazado | reembolsado | expirado
  estadoPago: text("estado_pago").notNull().default("no_iniciado"),
  modalidadPago: text("modalidad_pago"), // total | anticipo
  montoACobrar: integer("monto_a_cobrar"), // MXN a cobrar en línea
  montoPagado: integer("monto_pagado").notNull().default(0), // MXN acreditados
  saldoPendiente: integer("saldo_pendiente"), // MXN a pagar en el hotel
  mpPreferenceId: text("mp_preference_id"),
  mpPaymentId: text("mp_payment_id"),
  mpStatus: text("mp_status"), // status crudo de Mercado Pago
  pagadoEn: timestamp("pagado_en"),
  expiraEn: timestamp("expira_en"), // hold del cuarto mientras paga
  koraPushedAt: timestamp("kora_pushed_at"), // idempotencia push a Kora
  emailsSentAt: timestamp("emails_sent_at"), // idempotencia de correos

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RoomType = typeof roomTypes.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
