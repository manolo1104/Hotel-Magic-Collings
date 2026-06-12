// ============================================================
// MOTOR DE RESERVAS — funciones puras + acceso a datos aislado
// Aislado detrás de funciones para poder, en el futuro, mover el
// inventario a Kora sustituyendo solo la fuente de datos (no la UI).
// Patrón de lógica inspirado en mi-hotel/lib/booking.ts (referencia).
// ============================================================
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { roomTypes, rooms, bookings } from "../db/schema";
import type {
  AvailabilityParams,
  AvailabilityResult,
  AvailableRoomType,
  CreateBookingInput,
  CreateBookingResult,
} from "./types";

// ── Helpers puros de fecha/precio ───────────────────────────
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

export function todayISO(): string {
  // yyyy-mm-dd en zona local del servidor
  return new Date().toLocaleDateString("en-CA");
}

export function calcNights(checkin: string, checkout: string): number {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
    return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function formatMXN(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}

/** Valida un rango de fechas + huéspedes. Devuelve mensaje de error o null. */
export function validateRange(p: AvailabilityParams): string | null {
  if (!isValidISODate(p.checkin) || !isValidISODate(p.checkout))
    return "Selecciona fechas válidas de llegada y salida.";
  if (calcNights(p.checkin, p.checkout) < 1)
    return "La fecha de salida debe ser posterior a la de llegada.";
  if (p.checkin < todayISO())
    return "La fecha de llegada no puede estar en el pasado.";
  if (!Number.isFinite(p.huespedes) || p.huespedes < 1)
    return "Indica al menos un huésped.";
  return null;
}

// ── Disponibilidad ──────────────────────────────────────────
/** IDs de cuartos físicos ocupados (booking que se traslapa, estado ≠ cancelada). */
async function occupiedRoomIds(checkin: string, checkout: string): Promise<Set<string>> {
  const rows = await db
    .select({ roomId: bookings.roomId })
    .from(bookings)
    .where(
      and(
        ne(bookings.estado, "cancelada"),
        lt(bookings.checkin, checkout), // booking empieza antes del checkout buscado
        gt(bookings.checkout, checkin), // booking termina después del checkin buscado
      ),
    );
  return new Set(rows.map((r) => r.roomId));
}

export async function getAvailability(
  params: AvailabilityParams,
): Promise<AvailabilityResult> {
  const huespedes = Math.floor(Number(params.huespedes));
  const base = {
    checkin: params.checkin,
    checkout: params.checkout,
    huespedes,
    noches: calcNights(params.checkin, params.checkout),
    tipos: [] as AvailableRoomType[],
  };

  const error = validateRange({ ...params, huespedes });
  if (error) return { ok: false, error, ...base };

  await ensureDb();

  const [types, allRooms, occupied] = await Promise.all([
    db.select().from(roomTypes),
    db.select().from(rooms),
    occupiedRoomIds(params.checkin, params.checkout),
  ]);

  const noches = calcNights(params.checkin, params.checkout);

  const tipos: AvailableRoomType[] = types
    .map((t) => {
      const typeRooms = allRooms.filter((r) => r.roomTypeId === t.id && r.activa);
      const ocupadas = typeRooms.filter((r) => occupied.has(r.id)).length;
      const disponibles = typeRooms.length - ocupadas;
      return {
        id: t.id,
        slug: t.slug,
        nombre: t.nombre,
        descripcion: t.descripcion,
        capacidad: t.capacidad,
        tarifaBase: t.tarifaBase,
        amenidades: t.amenidades,
        fotos: t.fotos,
        disponibles,
        noches,
        precioTotal: t.tarifaBase * noches,
      };
    })
    .filter((t) => t.capacidad >= huespedes && t.disponibles > 0);

  return { ok: true, ...base, noches, tipos };
}

// ── Creación de reserva ─────────────────────────────────────
/** Crea una reserva en estado "pendiente" asignando un cuarto físico libre del tipo. */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const huespedes = Math.floor(Number(input.huespedes));
  const error = validateRange({
    checkin: input.checkin,
    checkout: input.checkout,
    huespedes,
  });
  if (error) return { ok: false, error };
  if (!input.nombre?.trim()) return { ok: false, error: "Escribe tu nombre." };
  if (!input.whatsapp?.trim())
    return { ok: false, error: "Escribe tu WhatsApp para confirmar la reserva." };
  // Límites de tamaño (sanidad server-side contra abuso)
  if (input.nombre.trim().length > 120)
    return { ok: false, error: "El nombre es demasiado largo." };
  if (input.whatsapp.trim().length > 30)
    return { ok: false, error: "Revisa tu número de WhatsApp." };
  if ((input.email?.trim().length ?? 0) > 120)
    return { ok: false, error: "El correo es demasiado largo." };

  await ensureDb();

  const [tipo] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.slug, input.slug))
    .limit(1);
  if (!tipo) return { ok: false, error: "Tipo de habitación no encontrado." };
  if (tipo.capacidad < huespedes)
    return { ok: false, error: "Ese tipo de habitación no admite tantos huéspedes." };

  // Revalida disponibilidad y elige un cuarto físico libre del tipo
  const typeRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.roomTypeId, tipo.id), eq(rooms.activa, true)));
  const occupied = await occupiedRoomIds(input.checkin, input.checkout);
  const free = typeRooms.find((r) => !occupied.has(r.id));
  if (!free)
    return {
      ok: false,
      error: "Ya no hay disponibilidad para esas fechas. Prueba con otras.",
    };

  const noches = calcNights(input.checkin, input.checkout);
  const total = tipo.tarifaBase * noches;

  const [created] = await db
    .insert(bookings)
    .values({
      roomId: free.id,
      checkin: input.checkin,
      checkout: input.checkout,
      huespedes,
      nombre: input.nombre.trim(),
      whatsapp: input.whatsapp.trim(),
      email: input.email?.trim() || null,
      estado: "pendiente",
      total,
    })
    .returning({ id: bookings.id, estado: bookings.estado });

  return { ok: true, id: created.id, estado: created.estado, total };
}

// ── Lectura simple de tipos (para /habitaciones) ────────────
export async function getRoomTypes() {
  await ensureDb();
  return db.select().from(roomTypes).orderBy(roomTypes.tarifaBase);
}

export async function getRoomTypeBySlug(slug: string) {
  await ensureDb();
  const [t] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.slug, slug))
    .limit(1);
  return t ?? null;
}
