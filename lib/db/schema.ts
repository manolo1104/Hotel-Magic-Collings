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

  // Origen de la reserva: web | whatsapp | manual | booking | expedia
  origen: text("origen").notNull().default("web"),
  notas: text("notas").notNull().default(""), // notas internas del hotel

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// PANEL /admin — cotizaciones, bloqueos, CRM, operaciones, OTA
// ============================================================

// Cotizaciones/presupuestos simples (habitación + fechas + precio + notas)
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  cliente: text("cliente").notNull(),
  telefono: text("telefono").notNull(),
  email: text("email"),
  roomTypeId: uuid("room_type_id").references(() => roomTypes.id),
  slug: text("slug"), // tipo cotizado (redundante para mostrar sin join)
  checkin: date("checkin", { mode: "string" }).notNull(),
  checkout: date("checkout", { mode: "string" }).notNull(),
  huespedes: integer("huespedes").notNull().default(1),
  noches: integer("noches").notNull(),
  precioTotal: integer("precio_total").notNull(), // MXN, editable
  notas: text("notas").notNull().default(""),
  estado: text("estado").notNull().default("borrador"), // borrador|enviada|aceptada|expirada
  bookingId: uuid("booking_id").references(() => bookings.id), // al convertir
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Canales OTA (Booking/Expedia) que aportan bloqueos vía iCal
export const otaChannels = pgTable("ota_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  platform: text("platform").notNull().default("booking"), // booking|expedia
  icalUrl: text("ical_url").notNull(),
  activo: boolean("activo").notNull().default(true),
  lastSync: timestamp("last_sync"),
  lastStatus: text("last_status").default("pending"), // ok|error|pending
  blocksFound: integer("blocks_found").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bloqueos de cuarto (manuales, mantenimiento u OTA)
export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  checkin: date("checkin", { mode: "string" }).notNull(),
  checkout: date("checkout", { mode: "string" }).notNull(),
  motivo: text("motivo").notNull().default("manual"), // manual|mantenimiento|ota
  origen: text("origen"), // booking|expedia|null
  otaChannelId: uuid("ota_channel_id").references(() => otaChannels.id),
  uid: text("uid"), // UID del VEVENT (idempotencia)
  nota: text("nota").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notas CRM por huésped (clave = email en minúsculas)
export const guestNotes = pgTable("guest_notes", {
  email: text("email").primaryKey(),
  notas: text("notas").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Bitácora de limpieza por cuarto y día
export const cleaningLog = pgTable("cleaning_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  fecha: date("fecha", { mode: "string" }).notNull(),
  turno: text("turno").notNull().default("manana"), // manana|tarde
  personal: text("personal").notNull().default(""),
  itemsCompletados: text("items_completados").array().notNull().default([]),
  itemsPendientes: text("items_pendientes").array().notNull().default([]),
  observaciones: text("observaciones").notNull().default(""),
  estado: text("estado").notNull().default("en_proceso"), // en_proceso|completo|incompleto
  completadoEn: timestamp("completado_en"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tareas de mantenimiento preventivo
export const maintenanceTasks = pgTable("maintenance_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ambito: text("ambito").notNull(), // 'hotel' o número de cuarto ('101'…)
  tarea: text("tarea").notNull(),
  frecuenciaDias: integer("frecuencia_dias").notNull().default(30),
  ultimaVez: date("ultima_vez", { mode: "string" }),
  proximaVez: date("proxima_vez", { mode: "string" }),
  notas: text("notas").notNull().default(""),
  responsable: text("responsable").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RoomType = typeof roomTypes.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Block = typeof blocks.$inferSelect;
export type OtaChannel = typeof otaChannels.$inferSelect;
export type GuestNote = typeof guestNotes.$inferSelect;
export type CleaningLog = typeof cleaningLog.$inferSelect;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;
