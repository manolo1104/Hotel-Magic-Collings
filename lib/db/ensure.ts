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
    fotos text[] NOT NULL DEFAULT '{}',
    precios integer[] NOT NULL DEFAULT '{}'
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
    origen text NOT NULL DEFAULT 'web',
    notas text NOT NULL DEFAULT '',
    nos_conociste text NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente text NOT NULL,
    telefono text NOT NULL,
    email text,
    room_type_id uuid REFERENCES room_types(id),
    slug text,
    checkin date NOT NULL,
    checkout date NOT NULL,
    huespedes integer NOT NULL DEFAULT 1,
    noches integer NOT NULL,
    precio_total integer NOT NULL,
    notas text NOT NULL DEFAULT '',
    estado text NOT NULL DEFAULT 'borrador',
    booking_id uuid REFERENCES bookings(id),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ota_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id),
    platform text NOT NULL DEFAULT 'booking',
    ical_url text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    last_sync timestamp,
    last_status text DEFAULT 'pending',
    blocks_found integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id),
    checkin date NOT NULL,
    checkout date NOT NULL,
    motivo text NOT NULL DEFAULT 'manual',
    origen text,
    ota_channel_id uuid REFERENCES ota_channels(id),
    uid text,
    nota text NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS guest_notes (
    email text PRIMARY KEY,
    notas text NOT NULL DEFAULT '',
    oculto_desde timestamp,
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cleaning_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id),
    fecha date NOT NULL,
    turno text NOT NULL DEFAULT 'manana',
    personal text NOT NULL DEFAULT '',
    items_completados text[] NOT NULL DEFAULT '{}',
    items_pendientes text[] NOT NULL DEFAULT '{}',
    observaciones text NOT NULL DEFAULT '',
    estado text NOT NULL DEFAULT 'en_proceso',
    completado_en timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ambito text NOT NULL,
    tarea text NOT NULL,
    frecuencia_dias integer NOT NULL DEFAULT 30,
    ultima_vez date,
    proxima_vez date,
    notas text NOT NULL DEFAULT '',
    responsable text NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS beds24_cola (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    beds24_booking_id integer NOT NULL,
    intentos integer NOT NULL DEFAULT 0,
    ultimo_error text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS app_state (
    clave text PRIMARY KEY,
    valor text NOT NULL DEFAULT '',
    updated_at timestamp NOT NULL DEFAULT now()
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
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'web'`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notas text NOT NULL DEFAULT ''`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nos_conociste text NOT NULL DEFAULT ''`,
  // Precio por ocupación (el hotel cobra distinto según cuánta gente entra)
  `ALTER TABLE room_types ADD COLUMN IF NOT EXISTS precios integer[] NOT NULL DEFAULT '{}'`,
  // Channel manager (Beds24 ↔ Booking.com)
  `ALTER TABLE room_types ADD COLUMN IF NOT EXISTS beds24_room_id integer`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS beds24_booking_id integer`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS beds24_estado text`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS beds24_synced_at timestamp`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS beds24_error text`,
  `ALTER TABLE blocks ADD COLUMN IF NOT EXISTS beds24_booking_id integer`,
  `ALTER TABLE blocks ADD COLUMN IF NOT EXISTS beds24_estado text`,
  // Una reserva de Beds24 se importa UNA sola vez aunque lleguen el webhook y
  // la repesca a la vez: el índice único hace que la carrera falle en la BD.
  `CREATE UNIQUE INDEX IF NOT EXISTS bookings_beds24_id_uq ON bookings (beds24_booking_id) WHERE beds24_booking_id IS NOT NULL`,
  // "Eliminar cliente" en el panel: esconde la ficha sin tocar sus reservas.
  `ALTER TABLE guest_notes ADD COLUMN IF NOT EXISTS oculto_desde timestamp`,
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
        precios: [...t.precios],
        amenidades: [...t.amenidades],
        fotos: [...t.fotos],
      })
      .returning({ id: roomTypes.id });

    if (t.units.length > 0) {
      await db
        .insert(rooms)
        .values(t.units.map((numero) => ({ roomTypeId: rt.id, numero })));
    }
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
