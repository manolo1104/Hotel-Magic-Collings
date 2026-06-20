// ============================================================
// ARRANQUE IDEMPOTENTE DE LA BASE DE DATOS
// Crea las tablas si no existen y siembra los 6 cuartos si está vacía.
// Se ejecuta una sola vez por proceso (cacheado en globalThis).
// Hace que el sitio funcione en localhost sin ningún paso manual.
// ============================================================
import { sql } from "drizzle-orm";
import { db } from "./index";
import { roomTypes, rooms } from "./schema";
import { roomTypeSeed } from "./seed-data";

const DDL = [
  `CREATE TABLE IF NOT EXISTS room_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    nombre text NOT NULL,
    descripcion text NOT NULL,
    capacidad integer NOT NULL,
    tarifa_base integer NOT NULL,
    amenidades text[] NOT NULL DEFAULT '{}',
    fotos text[] NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id uuid NOT NULL REFERENCES room_types(id),
    numero text NOT NULL,
    activa boolean NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id),
    checkin date NOT NULL,
    checkout date NOT NULL,
    huespedes integer NOT NULL,
    nombre text NOT NULL,
    whatsapp text NOT NULL,
    email text,
    estado text NOT NULL DEFAULT 'pendiente',
    total integer NOT NULL,
    estado_pago text NOT NULL DEFAULT 'no_iniciado',
    modalidad_pago text,
    monto_a_cobrar integer,
    monto_pagado integer NOT NULL DEFAULT 0,
    saldo_pendiente integer,
    mp_preference_id text,
    mp_payment_id text,
    mp_status text,
    pagado_en timestamp,
    expira_en timestamp,
    kora_pushed_at timestamp,
    emails_sent_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
];

// Migraciones idempotentes para BASES DE DATOS YA EXISTENTES (PGlite local o
// Postgres en producción). `CREATE TABLE IF NOT EXISTS` no agrega columnas a una
// tabla preexistente, así que añadimos las de pago con ADD COLUMN IF NOT EXISTS
// (soportado por Postgres y PGlite). Inofensivo si ya existen.
const MIGRATIONS = [
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estado_pago text NOT NULL DEFAULT 'no_iniciado'`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS modalidad_pago text`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS monto_a_cobrar integer`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS monto_pagado integer NOT NULL DEFAULT 0`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS saldo_pendiente integer`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_preference_id text`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_payment_id text`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS mp_status text`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pagado_en timestamp`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expira_en timestamp`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kora_pushed_at timestamp`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS emails_sent_at timestamp`,
];

export async function seedRooms(): Promise<void> {
  for (const t of roomTypeSeed) {
    const [rt] = await db
      .insert(roomTypes)
      .values({
        slug: t.slug,
        nombre: t.nombre,
        descripcion: t.descripcion,
        capacidad: t.capacidad,
        tarifaBase: t.tarifaBase,
        amenidades: [...t.amenidades],
        fotos: [...t.fotos],
      })
      .returning({ id: roomTypes.id });

    await db
      .insert(rooms)
      .values(t.units.map((numero) => ({ roomTypeId: rt.id, numero })));
  }
}

async function init(): Promise<void> {
  for (const stmt of DDL) {
    await db.execute(sql.raw(stmt));
  }
  for (const stmt of MIGRATIONS) {
    await db.execute(sql.raw(stmt));
  }
  const existing = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .limit(1);
  if (existing.length === 0) {
    await seedRooms();
  }
}

const globalForReady = globalThis as unknown as { __mcReady?: Promise<void> };

/** Garantiza tablas + datos semilla. Idempotente y cacheado por proceso. */
export function ensureDb(): Promise<void> {
  return (globalForReady.__mcReady ??= init());
}
