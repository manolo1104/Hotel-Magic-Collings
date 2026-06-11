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
    created_at timestamp NOT NULL DEFAULT now()
  )`,
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
