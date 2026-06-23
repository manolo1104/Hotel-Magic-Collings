// ============================================================
// MOTOR DE RESERVAS — funciones puras + acceso a datos aislado
// Aislado detrás de funciones para poder, en el futuro, mover el
// inventario a Kora sustituyendo solo la fuente de datos (no la UI).
// Patrón de lógica inspirado en mi-hotel/lib/booking.ts (referencia).
// ============================================================
import { and, eq, gt, lt, ne, or, isNull, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { roomTypes, rooms, bookings, blocks, guestNotes, quotes } from "../db/schema";
import type { Booking, Quote } from "../db/schema";
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
/**
 * IDs de cuartos físicos ocupados por un booking que se traslapa con el rango.
 * Cuenta como ocupado todo booking activo EXCEPTO los "holds" de pago vencidos:
 * una reserva con `estado_pago = 'iniciado'` cuya `expira_en` ya pasó libera el
 * cuarto automáticamente (el huésped empezó a pagar y abandonó). Así el
 * inventario no se bloquea por checkouts no completados, sin necesidad de cron.
 */
export async function occupiedRoomIds(
  checkin: string,
  checkout: string,
): Promise<Set<string>> {
  const [bookingRows, blockRows] = await Promise.all([
    db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(
        and(
          ne(bookings.estado, "cancelada"),
          ne(bookings.estado, "expirada"),
          lt(bookings.checkin, checkout), // booking empieza antes del checkout buscado
          gt(bookings.checkout, checkin), // booking termina después del checkin buscado
          // No contar holds de pago vencidos:
          or(
            ne(bookings.estadoPago, "iniciado"), // confirmada / WhatsApp / etc.
            isNull(bookings.expiraEn),
            gt(bookings.expiraEn, sql`now()`), // hold aún vigente
          ),
        ),
      ),
    // Bloqueos manuales / mantenimiento / OTA que traslapan el rango
    db
      .select({ roomId: blocks.roomId })
      .from(blocks)
      .where(and(lt(blocks.checkin, checkout), gt(blocks.checkout, checkin))),
  ]);
  const set = new Set(bookingRows.map((r) => r.roomId));
  for (const r of blockRows) set.add(r.roomId);
  return set;
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

  // Modalidad de pago: cuánto se cobra en línea ahora y el hold del cuarto.
  //  · sin modalidad → reserva por WhatsApp (sin pago en línea)
  //  · "total" → 100% ahora · "anticipo" → 50% ahora, resto en el hotel
  const conPago =
    input.modalidadPago === "total" || input.modalidadPago === "anticipo";
  const montoACobrar = !conPago
    ? null
    : input.modalidadPago === "anticipo"
      ? Math.round(total / 2)
      : total;
  const saldoPendiente = montoACobrar === null ? null : total - montoACobrar;
  // Hold de 30 min mientras el huésped completa el pago en Mercado Pago.
  const HOLD_MIN = 30;
  const expiraEn = conPago ? new Date(Date.now() + HOLD_MIN * 60_000) : null;

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
      estadoPago: conPago ? "iniciado" : "no_iniciado",
      modalidadPago: input.modalidadPago ?? null,
      montoACobrar,
      saldoPendiente,
      expiraEn,
    })
    .returning({ id: bookings.id, estado: bookings.estado });

  return {
    ok: true,
    id: created.id,
    estado: created.estado,
    total,
    modalidadPago: input.modalidadPago,
    montoACobrar: montoACobrar ?? undefined,
    saldoPendiente: saldoPendiente ?? undefined,
    nombreTipo: tipo.nombre,
  };
}

/** Lee una reserva por id (para páginas de retorno y panel). */
export async function getBookingById(id: string): Promise<Booking | null> {
  await ensureDb();
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return b ?? null;
}

export type BookingView = Booking & { nombreTipo: string; numeroCuarto: string };

// UUID v4/genérico: evita golpear la BD (y un 500) con un ref de URL inválido.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reserva enriquecida con nombre del tipo y número de cuarto. */
export async function getBookingView(id: string): Promise<BookingView | null> {
  if (!UUID_RE.test(id)) return null;
  await ensureDb();
  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!b) return null;
    let nombreTipo = "Habitación";
    let numeroCuarto = "—";
    const [room] = await db.select().from(rooms).where(eq(rooms.id, b.roomId)).limit(1);
    if (room) {
      numeroCuarto = room.numero;
      const [tipo] = await db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.id, room.roomTypeId))
        .limit(1);
      if (tipo) nombreTipo = tipo.nombre;
    }
    return { ...b, nombreTipo, numeroCuarto };
  } catch {
    return null;
  }
}

/** Asocia la preferencia de Mercado Pago a la reserva. */
export async function setMpPreference(
  bookingId: string,
  preferenceId: string,
): Promise<void> {
  await db
    .update(bookings)
    .set({ mpPreferenceId: preferenceId })
    .where(eq(bookings.id, bookingId));
}

/**
 * Marca la reserva como pagada de forma IDEMPOTENTE. El UPDATE condicional
 * (`estado_pago <> 'pagado'`) garantiza que solo UNA llamada efectúe la
 * transición aunque Mercado Pago reintente o mande webhooks duplicados.
 * `changed=true` ⇒ esta llamada confirmó el pago (dispara correos + Kora 1 vez).
 */
export async function confirmarPago(args: {
  bookingId: string;
  paymentId: string;
  mpStatus: string;
  montoPagado: number;
}): Promise<{ changed: boolean; booking: Booking | null }> {
  await ensureDb();
  const [prev] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, args.bookingId))
    .limit(1);
  if (!prev) return { changed: false, booking: null };

  const updated = await db
    .update(bookings)
    .set({
      estado: "confirmada",
      estadoPago: "pagado",
      mpPaymentId: args.paymentId,
      mpStatus: args.mpStatus,
      montoPagado: args.montoPagado,
      saldoPendiente: Math.max(0, prev.total - args.montoPagado),
      pagadoEn: new Date(),
    })
    .where(and(eq(bookings.id, args.bookingId), ne(bookings.estadoPago, "pagado")))
    .returning({ id: bookings.id });

  const [fresh] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, args.bookingId))
    .limit(1);
  return { changed: updated.length > 0, booking: fresh ?? null };
}

/** Pago rechazado/cancelado → libera el cuarto (no toca reservas ya pagadas). */
export async function marcarPagoRechazado(
  bookingId: string,
  paymentId: string | null,
  mpStatus: string,
): Promise<void> {
  await ensureDb();
  await db
    .update(bookings)
    .set({ estado: "cancelada", estadoPago: "rechazado", mpPaymentId: paymentId, mpStatus })
    .where(and(eq(bookings.id, bookingId), ne(bookings.estadoPago, "pagado")));
}

/** Marca de idempotencia: correos enviados. */
export async function marcarEmailsEnviados(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({ emailsSentAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

/** Marca de idempotencia: reserva empujada a Kora. */
export async function marcarKoraPushed(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({ koraPushedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

/** Número de cuartos físicos activos (para ocupación/RevPAR). */
export async function countActiveRooms(): Promise<number> {
  await ensureDb();
  const rows = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.activa, true));
  return rows.length;
}

/** Lista de reservas (con cuarto y tipo) para el panel /admin. */
export async function listBookings(): Promise<BookingView[]> {
  await ensureDb();
  const rows = await db
    .select({ booking: bookings, numero: rooms.numero, nombreTipo: roomTypes.nombre })
    .from(bookings)
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .orderBy(desc(bookings.createdAt));
  return rows.map((r) => ({
    ...r.booking,
    numeroCuarto: r.numero ?? "—",
    nombreTipo: r.nombreTipo ?? "—",
  }));
}

/** Crea una reserva MANUAL desde el panel (confirmada, sin hold de pago). */
export async function createManualBooking(input: {
  slug: string;
  checkin: string;
  checkout: string;
  huespedes: number;
  nombre: string;
  whatsapp: string;
  email?: string;
  total?: number; // override del precio (si no, tarifa × noches)
  montoPagado?: number; // anticipo/pago en efectivo ya registrado
  notas?: string;
  origen?: string; // manual (default) | whatsapp | booking | expedia
}): Promise<CreateBookingResult> {
  const huespedes = Math.floor(Number(input.huespedes));
  const error = validateRange({
    checkin: input.checkin,
    checkout: input.checkout,
    huespedes,
  });
  if (error) return { ok: false, error };
  if (!input.nombre?.trim()) return { ok: false, error: "Escribe el nombre del huésped." };
  if (!input.whatsapp?.trim())
    return { ok: false, error: "Escribe el WhatsApp o teléfono del huésped." };

  await ensureDb();
  const [tipo] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.slug, input.slug))
    .limit(1);
  if (!tipo) return { ok: false, error: "Tipo de habitación no encontrado." };
  if (tipo.capacidad < huespedes)
    return { ok: false, error: "Ese tipo de habitación no admite tantos huéspedes." };

  const typeRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.roomTypeId, tipo.id), eq(rooms.activa, true)));
  const occupied = await occupiedRoomIds(input.checkin, input.checkout);
  const free = typeRooms.find((r) => !occupied.has(r.id));
  if (!free)
    return { ok: false, error: "No hay cuartos libres de ese tipo en esas fechas." };

  const noches = calcNights(input.checkin, input.checkout);
  const total =
    input.total != null && input.total >= 0
      ? Math.round(input.total)
      : tipo.tarifaBase * noches;
  const montoPagado =
    input.montoPagado != null && input.montoPagado > 0
      ? Math.round(input.montoPagado)
      : 0;

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
      estado: "confirmada",
      total,
      estadoPago: montoPagado > 0 && montoPagado >= total ? "pagado" : "no_iniciado",
      montoPagado,
      saldoPendiente: Math.max(0, total - montoPagado),
      origen: input.origen?.trim() || "manual",
      notas: input.notas?.trim() || "",
    })
    .returning({ id: bookings.id });

  return { ok: true, id: created.id, estado: "confirmada", total };
}

/** Actualiza los campos editables de una reserva desde el panel. */
export async function updateBooking(
  id: string,
  changes: {
    nombre?: string;
    whatsapp?: string;
    email?: string | null;
    checkin?: string;
    checkout?: string;
    huespedes?: number;
    total?: number;
    montoPagado?: number;
    estado?: string;
    notas?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!b) return { ok: false, error: "Reserva no encontrada." };

  const checkin = changes.checkin ?? b.checkin;
  const checkout = changes.checkout ?? b.checkout;
  if ((changes.checkin || changes.checkout) && calcNights(checkin, checkout) < 1)
    return { ok: false, error: "La salida debe ser posterior a la llegada." };

  const total = changes.total != null ? Math.round(changes.total) : b.total;
  const montoPagado =
    changes.montoPagado != null ? Math.round(changes.montoPagado) : b.montoPagado;

  const set: Partial<typeof bookings.$inferInsert> = {
    total,
    montoPagado,
    saldoPendiente: Math.max(0, total - montoPagado),
  };
  if (changes.nombre != null) set.nombre = changes.nombre.trim();
  if (changes.whatsapp != null) set.whatsapp = changes.whatsapp.trim();
  if (changes.email !== undefined)
    set.email = changes.email ? String(changes.email).trim() : null;
  if (changes.checkin) set.checkin = checkin;
  if (changes.checkout) set.checkout = checkout;
  if (changes.huespedes != null) set.huespedes = Math.floor(changes.huespedes);
  if (changes.estado) set.estado = changes.estado;
  if (changes.notas != null) set.notas = changes.notas.trim();

  await db.update(bookings).set(set).where(eq(bookings.id, id));
  return { ok: true };
}

/** Cancela una reserva (libera el cuarto automáticamente; no borra la fila). */
export async function cancelBooking(id: string): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const res = await db
    .update(bookings)
    .set({ estado: "cancelada" })
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id });
  if (res.length === 0) return { ok: false, error: "Reserva no encontrada." };
  return { ok: true };
}

// ── Calendario y bloqueos ───────────────────────────────────
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export type DayStatus = "libre" | "reservada" | "bloqueada";
export interface CalendarData {
  year: number;
  month: number; // 1-12
  days: string[];
  rooms: { id: string; numero: string; tipo: string }[];
  grid: Record<string, Record<string, DayStatus>>;
  bloqueos: {
    id: string;
    roomId: string;
    checkin: string;
    checkout: string;
    motivo: string;
    nota: string;
  }[];
}

/** Estado (libre/reservada/bloqueada) de cada cuarto × día del mes. */
export async function getCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarData> {
  await ensureDb();
  const lastDay = new Date(year, month, 0).getDate();
  const first = `${year}-${pad2(month)}-01`;
  const afterLast =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) days.push(`${year}-${pad2(month)}-${pad2(d)}`);

  const [roomsRows, bookingRows, blockRows] = await Promise.all([
    db
      .select({ id: rooms.id, numero: rooms.numero, tipo: roomTypes.nombre })
      .from(rooms)
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.activa, true)),
    db
      .select({
        roomId: bookings.roomId,
        checkin: bookings.checkin,
        checkout: bookings.checkout,
      })
      .from(bookings)
      .where(
        and(
          ne(bookings.estado, "cancelada"),
          ne(bookings.estado, "expirada"),
          lt(bookings.checkin, afterLast),
          gt(bookings.checkout, first),
          or(
            ne(bookings.estadoPago, "iniciado"),
            isNull(bookings.expiraEn),
            gt(bookings.expiraEn, sql`now()`),
          ),
        ),
      ),
    db
      .select()
      .from(blocks)
      .where(and(lt(blocks.checkin, afterLast), gt(blocks.checkout, first))),
  ]);

  const grid: CalendarData["grid"] = {};
  for (const r of roomsRows) {
    grid[r.id] = {};
    for (const day of days) grid[r.id][day] = "libre";
  }
  for (const bk of bookingRows) {
    const g = grid[bk.roomId];
    if (!g) continue;
    for (const day of days)
      if (day >= bk.checkin && day < bk.checkout) g[day] = "reservada";
  }
  for (const bl of blockRows) {
    const g = grid[bl.roomId];
    if (!g) continue;
    for (const day of days)
      if (day >= bl.checkin && day < bl.checkout && g[day] === "libre")
        g[day] = "bloqueada";
  }

  return {
    year,
    month,
    days,
    rooms: roomsRows.map((r) => ({
      id: r.id,
      numero: r.numero,
      tipo: r.tipo ?? "—",
    })),
    grid,
    bloqueos: blockRows.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      checkin: b.checkin,
      checkout: b.checkout,
      motivo: b.motivo,
      nota: b.nota,
    })),
  };
}

export interface GanttBooking {
  roomId: string;
  numero: string;
  nombre: string;
  checkin: string;
  checkout: string;
  estado: string;
}

/** Reservas activas que traslapan [from, to) para la línea de tiempo. */
export async function getGanttBookings(
  from: string,
  to: string,
): Promise<GanttBooking[]> {
  await ensureDb();
  const rows = await db
    .select({
      roomId: bookings.roomId,
      numero: rooms.numero,
      nombre: bookings.nombre,
      checkin: bookings.checkin,
      checkout: bookings.checkout,
      estado: bookings.estado,
    })
    .from(bookings)
    .leftJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(
      and(
        ne(bookings.estado, "cancelada"),
        ne(bookings.estado, "expirada"),
        lt(bookings.checkin, to),
        gt(bookings.checkout, from),
      ),
    )
    .orderBy(bookings.checkin);
  return rows.map((r) => ({ ...r, numero: r.numero ?? "—" }));
}

/** Bloquea un rango de fechas para un cuarto (manual o mantenimiento). */
export async function blockDates(input: {
  roomId: string;
  checkin: string;
  checkout: string;
  motivo?: string;
  nota?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  if (
    !isValidISODate(input.checkin) ||
    !isValidISODate(input.checkout) ||
    calcNights(input.checkin, input.checkout) < 1
  )
    return { ok: false, error: "Rango de fechas inválido." };
  await db.insert(blocks).values({
    roomId: input.roomId,
    checkin: input.checkin,
    checkout: input.checkout,
    motivo: input.motivo === "mantenimiento" ? "mantenimiento" : "manual",
    nota: input.nota?.trim() || "",
  });
  return { ok: true };
}

/** Quita un bloqueo manual/mantenimiento (los de OTA se gestionan por sync). */
export async function unblock(id: string): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const res = await db
    .delete(blocks)
    .where(and(eq(blocks.id, id), ne(blocks.motivo, "ota")))
    .returning({ id: blocks.id });
  if (res.length === 0)
    return { ok: false, error: "Bloqueo no encontrado o pertenece a un canal OTA." };
  return { ok: true };
}

// ── Notas CRM por huésped ───────────────────────────────────
/** Mapa email → notas (para construir el CRM). */
export async function getGuestNotes(): Promise<Record<string, string>> {
  await ensureDb();
  const rows = await db.select().from(guestNotes);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.email] = r.notas;
  return map;
}

/** Guarda/actualiza las notas de un huésped (upsert por email). */
export async function saveGuestNote(email: string, notas: string): Promise<void> {
  await ensureDb();
  const key = email.toLowerCase().trim();
  if (!key) return;
  await db
    .insert(guestNotes)
    .values({ email: key, notas, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: guestNotes.email,
      set: { notas, updatedAt: new Date() },
    });
}

// ── Cotizaciones ────────────────────────────────────────────
export type QuoteView = Quote & { nombreTipo: string };

export async function listQuotes(): Promise<QuoteView[]> {
  await ensureDb();
  const rows = await db
    .select({ q: quotes, tipo: roomTypes.nombre })
    .from(quotes)
    .leftJoin(roomTypes, eq(quotes.roomTypeId, roomTypes.id))
    .orderBy(desc(quotes.createdAt));
  return rows.map((r) => ({ ...r.q, nombreTipo: r.tipo ?? r.q.slug ?? "—" }));
}

export async function getQuote(id: string): Promise<QuoteView | null> {
  if (!UUID_RE.test(id)) return null;
  await ensureDb();
  const [r] = await db
    .select({ q: quotes, tipo: roomTypes.nombre })
    .from(quotes)
    .leftJoin(roomTypes, eq(quotes.roomTypeId, roomTypes.id))
    .where(eq(quotes.id, id))
    .limit(1);
  return r ? { ...r.q, nombreTipo: r.tipo ?? r.q.slug ?? "—" } : null;
}

export async function createQuote(input: {
  cliente: string;
  telefono: string;
  email?: string;
  slug: string;
  checkin: string;
  checkout: string;
  huespedes: number;
  precioTotal?: number;
  notas?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!input.cliente?.trim()) return { ok: false, error: "Escribe el nombre del cliente." };
  if (calcNights(input.checkin, input.checkout) < 1)
    return { ok: false, error: "Las fechas no son válidas." };
  await ensureDb();
  const [tipo] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.slug, input.slug))
    .limit(1);
  const noches = calcNights(input.checkin, input.checkout);
  const precioTotal =
    input.precioTotal != null && input.precioTotal >= 0
      ? Math.round(input.precioTotal)
      : (tipo?.tarifaBase ?? 0) * noches;
  const [created] = await db
    .insert(quotes)
    .values({
      cliente: input.cliente.trim(),
      telefono: input.telefono.trim(),
      email: input.email?.trim() || null,
      roomTypeId: tipo?.id ?? null,
      slug: tipo?.nombre ?? input.slug,
      checkin: input.checkin,
      checkout: input.checkout,
      huespedes: Math.floor(input.huespedes) || 1,
      noches,
      precioTotal,
      notas: input.notas?.trim() || "",
      estado: "borrador",
    })
    .returning({ id: quotes.id });
  return { ok: true, id: created.id };
}

export async function updateQuote(
  id: string,
  changes: {
    cliente?: string;
    telefono?: string;
    email?: string | null;
    checkin?: string;
    checkout?: string;
    huespedes?: number;
    precioTotal?: number;
    notas?: string;
    estado?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!q) return { ok: false, error: "Cotización no encontrada." };
  const checkin = changes.checkin ?? q.checkin;
  const checkout = changes.checkout ?? q.checkout;
  const set: Partial<typeof quotes.$inferInsert> = {};
  if (changes.cliente != null) set.cliente = changes.cliente.trim();
  if (changes.telefono != null) set.telefono = changes.telefono.trim();
  if (changes.email !== undefined)
    set.email = changes.email ? String(changes.email).trim() : null;
  if (changes.checkin || changes.checkout) {
    if (calcNights(checkin, checkout) < 1)
      return { ok: false, error: "Las fechas no son válidas." };
    set.checkin = checkin;
    set.checkout = checkout;
    set.noches = calcNights(checkin, checkout);
  }
  if (changes.huespedes != null) set.huespedes = Math.floor(changes.huespedes);
  if (changes.precioTotal != null) set.precioTotal = Math.round(changes.precioTotal);
  if (changes.notas != null) set.notas = changes.notas.trim();
  if (changes.estado) set.estado = changes.estado;
  await db.update(quotes).set(set).where(eq(quotes.id, id));
  return { ok: true };
}

/** Convierte una cotización en reserva (idempotente vía quotes.bookingId). */
export async function convertQuoteToBooking(
  id: string,
): Promise<{ ok: boolean; bookingId?: string; error?: string }> {
  await ensureDb();
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!q) return { ok: false, error: "Cotización no encontrada." };
  if (q.bookingId) return { ok: true, bookingId: q.bookingId };

  const [tipo] = q.roomTypeId
    ? await db.select().from(roomTypes).where(eq(roomTypes.id, q.roomTypeId)).limit(1)
    : [];
  if (!tipo) return { ok: false, error: "La cotización no tiene un tipo de habitación válido." };

  const result = await createManualBooking({
    slug: tipo.slug,
    checkin: q.checkin,
    checkout: q.checkout,
    huespedes: q.huespedes,
    nombre: q.cliente,
    whatsapp: q.telefono,
    email: q.email ?? undefined,
    total: q.precioTotal,
    notas: q.notas,
    origen: "manual",
  });
  if (!result.ok || !result.id) return { ok: false, error: result.error };
  await db
    .update(quotes)
    .set({ estado: "aceptada", bookingId: result.id })
    .where(eq(quotes.id, id));
  return { ok: true, bookingId: result.id };
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
