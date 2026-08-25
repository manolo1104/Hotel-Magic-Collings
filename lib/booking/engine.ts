// ============================================================
// MOTOR DE RESERVAS — funciones puras + acceso a datos aislado
// Aislado detrás de funciones para poder, en el futuro, mover el
// inventario a Kora sustituyendo solo la fuente de datos (no la UI).
// Patrón de lógica inspirado en mi-hotel/lib/booking.ts (referencia).
// ============================================================
import { and, eq, gt, gte, lt, lte, ne, or, isNull, sql, desc, asc } from "drizzle-orm";
import { site } from "../site";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { roomTypes, rooms, bookings, blocks, guestNotes, quotes } from "../db/schema";
import type { Booking, Quote } from "../db/schema";
import { FORMAS_PAGO } from "./types";
import type {
  AvailabilityParams,
  AvailabilityResult,
  AvailableRoomType,
  CreateBookingInput,
  CreateBookingResult,
} from "./types";

// Tipos internos que se OCULTAN del sitio público (home, /habitaciones,
// /buscar, widget del hero). Siguen reservables por link directo a
// /reservar?tipo=<slug> (que pide `includeHidden`) y visibles en el
// panel /admin (que pasa includeHidden:true).
export const HIDDEN_SLUGS = new Set<string>([
  "prueba", // cuarto de $10 para probar cobros reales de Mercado Pago
  // Inventario ANTERIOR, sustituido por las categorías reales de Gersay
  // (matrimonial, king-size, doble-queen, suite). Sus filas se conservan en la
  // base porque cuelgan de ellas cuartos y reservas viejas, pero no deben
  // venderse ni aparecer en el sitio: sus tarifas ($850/$1,200) eran de relleno.
  "sencilla",
  "doble",
]);

// ── Aviso al channel manager (Beds24 → Booking.com) ─────────
/**
 * Avisa a Beds24 de un cambio SIN hacer esperar al huésped ni al panel.
 * Se importa de forma perezosa para no cargar el channel manager en cada
 * petición y para evitar un ciclo de importaciones con lib/beds24/sync.
 *
 * Si esto falla no se pierde nada: el reloj reconcilia lo que quede pendiente
 * en su siguiente corrida (comparando el estado real contra `beds24_estado`).
 */
type SyncBeds24 = typeof import("@/lib/beds24/sync");
function avisarBeds24(accion: (m: SyncBeds24) => Promise<unknown>): void {
  if (!process.env.BEDS24_REFRESH_TOKEN?.trim()) return;
  void import("@/lib/beds24/sync")
    .then(accion)
    .catch((e) => console.error("[beds24] aviso inmediato falló (lo hará el reloj):", e));
}

// ── Helpers puros de fecha/precio ───────────────────────────
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

/**
 * "Hoy" EN EL HOTEL, no en el servidor.
 *
 * Railway corre en UTC, seis horas adelante de Xilitla: sin `timeZone`, a partir
 * de las 18:00 el sitio ya creía que era mañana. Eso rechazaba una reserva para
 * esa misma noche con "la fecha de llegada no puede estar en el pasado", y en el
 * panel corría un día las etiquetas de "Llega hoy" y "Sale hoy".
 */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: site.timeZone });
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

/**
 * Precio de UNA noche según cuánta gente se hospeda, que es como cobra el
 * hotel: una Doble Queen son $1,200 con dos personas y $1,440 con cuatro.
 *
 * `precios` va indexado por ocupación (posición 0 = 1 persona). Si el tipo no
 * tiene tabla de precios cargada se usa `tarifaBase`, y si vienen más
 * huéspedes que precios se cobra el último (el de ocupación máxima) en vez de
 * caer a `undefined` y facturar NaN.
 */
export function precioPorNoche(
  tipo: { tarifaBase: number; precios?: number[] | null },
  huespedes: number,
): number {
  const precios = tipo.precios ?? [];
  if (precios.length === 0) return tipo.tarifaBase;
  const n = Math.max(1, Math.floor(Number(huespedes) || 1));
  return precios[Math.min(n, precios.length) - 1];
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
  /**
   * Reserva que NO cuenta como ocupante. Se usa al EDITAR: una reserva siempre
   * se ocupa a sí misma, así que sin esto cambiarle el cuarto o las fechas
   * chocaría contra su propia fila y el panel diría "ya está ocupado".
   */
  excluirBookingId?: string,
): Promise<Set<string>> {
  const [bookingRows, blockRows] = await Promise.all([
    db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(
        and(
          ne(bookings.estado, "cancelada"),
          ne(bookings.estado, "expirada"),
          excluirBookingId && UUID_RE.test(excluirBookingId)
            ? ne(bookings.id, excluirBookingId)
            : undefined,
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
      const precioNoche = precioPorNoche(t, huespedes);
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
        precioNoche,
        precioTotal: precioNoche * noches,
      };
    })
    .filter(
      (t) =>
        t.capacidad >= huespedes &&
        t.disponibles > 0 &&
        (params.includeHidden || !HIDDEN_SLUGS.has(t.slug)),
    );

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
  if ((input.nosConociste?.trim().length ?? 0) > 60)
    return { ok: false, error: "La respuesta de dónde nos conociste es demasiado larga." };

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
  // El precio depende de cuánta gente entra, no solo del tipo de habitación.
  const total = precioPorNoche(tipo, huespedes) * noches;

  // Modalidad de pago: cuánto se cobra en línea ahora y el hold del cuarto.
  //  · sin modalidad → reserva por WhatsApp (sin pago en línea)
  //  · "total" → 100% ahora · "anticipo" → 50% ahora, resto en el hotel
  //
  // El anticipo SOLO existe con 2 noches o más: una noche suelta se paga
  // completa. Se valida aquí y no solo en el formulario porque el cliente es
  // manipulable — sin esta guarda, un POST a mano apartaría una noche pagando
  // la mitad. No se "corrige" a 100% en silencio: cobrar el doble de lo que el
  // huésped eligió sería peor que rechazar y que lo vuelva a intentar.
  const conPago =
    input.modalidadPago === "total" || input.modalidadPago === "anticipo";
  if (input.modalidadPago === "anticipo" && noches < 2)
    return {
      ok: false,
      error:
        "Con una sola noche la reserva se paga completa. Elige pagar el total, o agrega otra noche para poder pagar el 50%.",
    };
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
      nosConociste: input.nosConociste?.trim() || "",
      estado: "pendiente",
      total,
      estadoPago: conPago ? "iniciado" : "no_iniciado",
      modalidadPago: input.modalidadPago ?? null,
      montoACobrar,
      saldoPendiente,
      expiraEn,
    })
    .returning({ id: bookings.id, estado: bookings.estado });

  // Cierra la fecha en Booking desde YA, incluso mientras el huésped teclea la
  // tarjeta: el sitio cuenta el "hold" como ocupado, y si Booking no se entera
  // podría vender el mismo cuarto en esos 30 minutos. Si el pago no se
  // completa, el reloj cancela el espejo solo y la fecha se libera.
  avisarBeds24((m) => m.reconciliarReserva(created.id));

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
  if (!UUID_RE.test(id)) return null;
  await ensureDb();
  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    return b ?? null;
  } catch {
    return null;
  }
}

export type BookingView = Booking & { nombreTipo: string; numeroCuarto: string };

// UUID v4/genérico: evita golpear la BD (y un 500) con un ref de URL inválido.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * ¿La reserva ocupa inventario AHORA? Misma regla que occupiedRoomIds/
 * getCalendarMonth: cancelada/expirada no cuentan, y un "hold" de pago
 * (estado_pago='iniciado') con expiraEn ya vencida libera el cuarto.
 * Fuente única para que KPIs, insights y disponibilidad sean coherentes.
 */
export function isReservaActiva(
  b: { estado: string; estadoPago: string; expiraEn: Date | null },
  ahora: Date,
): boolean {
  if (b.estado === "cancelada" || b.estado === "expirada") return false;
  if (
    b.estadoPago === "iniciado" &&
    b.expiraEn != null &&
    new Date(b.expiraEn).getTime() < ahora.getTime()
  )
    return false;
  return true;
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
      // El cobro en línea deja constancia de su vía, igual que el panel
      // apunta "efectivo" o "transferencia" cuando cobra fuera del sitio.
      formaPago: "mercado_pago",
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
  // Pago rechazado → el cuarto vuelve a estar a la venta, también en Booking.
  avisarBeds24((m) => m.reconciliarReserva(bookingId));
}

/**
 * Pago en revisión (in_process/pending de MP): conserva el hold del cuarto
 * SIN que venza mientras MP acredita (expiraEn=null lo cuenta como ocupado en
 * occupiedRoomIds), evitando que el cuarto se libere y se sobrevenda.
 */
export async function marcarPagoPendiente(
  bookingId: string,
  paymentId: string,
  mpStatus: string,
): Promise<void> {
  await ensureDb();
  await db
    .update(bookings)
    .set({ mpPaymentId: paymentId, mpStatus, expiraEn: null })
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

/**
 * Cuartos físicos activos con su tipo, para los desplegables del panel.
 *
 * Se quedan fuera los que cuelgan de un tipo interno o retirado
 * (`HIDDEN_SLUGS`): el cuarto de prueba de $10 y las categorías viejas. Son
 * cuartos que no se venden, y ofrecerlos en "cambiar de habitación" solo sirve
 * para mudar a un huésped real a un cuarto que no existe.
 */
export async function listRooms(): Promise<{ id: string; numero: string; tipo: string }[]> {
  await ensureDb();
  const rows = await db
    .select({
      id: rooms.id,
      numero: rooms.numero,
      tipo: roomTypes.nombre,
      slug: roomTypes.slug,
    })
    .from(rooms)
    .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(rooms.activa, true))
    .orderBy(asc(rooms.numero));
  return rows
    .filter((r) => !r.slug || !HIDDEN_SLUGS.has(r.slug))
    .map((r) => ({ id: r.id, numero: r.numero, tipo: r.tipo ?? "—" }));
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
  nosConociste?: string;
  formaPago?: string;
  // Cuarto preferido. Lo manda el calendario: si el dueño hizo clic en el 102,
  // la reserva debe caer en el 102 y no en el primer libre de ese tipo. Si está
  // ocupado o no es de ese tipo, se ignora y se elige normal.
  roomId?: string;
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
  // Sin cuartos asignados NUNCA va a haber uno libre, y decir "no hay libres en
  // esas fechas" manda al dueño a buscar un choque que no existe. Le pasa a la
  // Matrimonial (categoría real, todavía sin cuartos) y a las retiradas.
  if (typeRooms.length === 0)
    return {
      ok: false,
      error: `"${tipo.nombre}" no tiene ningún cuarto activo asignado, así que no se puede reservar en ninguna fecha. Asígnale cuartos o elige otra categoría.`,
    };
  const occupied = await occupiedRoomIds(input.checkin, input.checkout);
  const preferido =
    input.roomId && typeRooms.find((r) => r.id === input.roomId && !occupied.has(r.id));
  const free = preferido || typeRooms.find((r) => !occupied.has(r.id));
  if (!free)
    return { ok: false, error: "No hay cuartos libres de ese tipo en esas fechas." };

  const noches = calcNights(input.checkin, input.checkout);
  const total =
    input.total != null && input.total >= 0
      ? Math.round(input.total)
      : precioPorNoche(tipo, huespedes) * noches;
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
      estadoPago:
        montoPagado >= total && total > 0
          ? "pagado"
          : montoPagado > 0
            ? "parcial"
            : "no_iniciado",
      montoPagado,
      saldoPendiente: Math.max(0, total - montoPagado),
      origen: input.origen?.trim() || "manual",
      notas: input.notas?.trim() || "",
      nosConociste: input.nosConociste?.trim() || "",
      // Solo tiene sentido apuntar la vía si de verdad entró dinero.
      formaPago: montoPagado > 0 ? formaPagoValida(input.formaPago) : "",
    })
    .returning({ id: bookings.id });

  avisarBeds24((m) => m.reconciliarReserva(created.id));

  return { ok: true, id: created.id, estado: "confirmada", total };
}

/** Normaliza la forma de pago: fuera del catálogo, se guarda vacía. */
function formaPagoValida(v: string | null | undefined): string {
  const limpio = (v ?? "").trim();
  return FORMAS_PAGO.some((f) => f.valor === limpio) ? limpio : "";
}

/** Estados de reserva que el panel acepta. */
const ESTADOS_RESERVA = ["pendiente", "confirmada", "cancelada", "expirada"];
/** Estados de pago que el panel acepta (los mismos que pinta el badge). */
const ESTADOS_PAGO = ["no_iniciado", "iniciado", "parcial", "pagado", "rechazado"];
/** Un estado que NO ocupa inventario: la reserva no le quita el cuarto a nadie. */
function liberaCuarto(estado: string): boolean {
  return estado === "cancelada" || estado === "expirada";
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
    estadoPago?: string;
    /** Cambio de habitación: id del cuarto físico al que se muda la reserva. */
    roomId?: string;
    formaPago?: string;
    notas?: string;
    nosConociste?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!b) return { ok: false, error: "Reserva no encontrada." };

  if (changes.estado != null && !ESTADOS_RESERVA.includes(changes.estado))
    return { ok: false, error: "Estado inválido." };
  if (changes.estadoPago != null && !ESTADOS_PAGO.includes(changes.estadoPago))
    return { ok: false, error: "Estado de pago inválido." };

  const checkin = changes.checkin ?? b.checkin;
  const checkout = changes.checkout ?? b.checkout;
  if ((changes.checkin || changes.checkout) && calcNights(checkin, checkout) < 1)
    return { ok: false, error: "La salida debe ser posterior a la llegada." };

  const huespedes =
    changes.huespedes != null ? Math.max(1, Math.floor(changes.huespedes)) : b.huespedes;
  const estado = changes.estado ?? b.estado;

  // ── Cambio de habitación / de fechas ──────────────────────
  // Mover una reserva es lo mismo que crear una: hay que comprobar que el
  // cuarto destino esté libre en el rango destino, o el panel abre la puerta a
  // la sobreventa que el motor público sí cuida.
  const roomIdDestino =
    changes.roomId && changes.roomId !== b.roomId ? changes.roomId : b.roomId;
  const cambiaCuarto = roomIdDestino !== b.roomId;
  const cambianFechas = checkin !== b.checkin || checkout !== b.checkout;
  const vuelveAOcupar = liberaCuarto(b.estado) && !liberaCuarto(estado);

  if (cambiaCuarto && !UUID_RE.test(roomIdDestino))
    return { ok: false, error: "Cuarto no válido." };

  if (cambiaCuarto || cambianFechas || vuelveAOcupar) {
    const [destino] = await db
      .select({ room: rooms, tipo: roomTypes })
      .from(rooms)
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.id, roomIdDestino))
      .limit(1);
    if (!destino?.room) return { ok: false, error: "Cuarto no encontrado." };
    if (cambiaCuarto && !destino.room.activa)
      return { ok: false, error: `El cuarto ${destino.room.numero} está desactivado.` };
    if (destino.tipo && destino.tipo.capacidad < huespedes)
      return {
        ok: false,
        error: `El cuarto ${destino.room.numero} (${destino.tipo.nombre}) admite hasta ${destino.tipo.capacidad} huéspedes.`,
      };
    // Una reserva cancelada no le quita el cuarto a nadie: solo se comprueba
    // el choque si de verdad va a ocupar inventario.
    if (!liberaCuarto(estado)) {
      const ocupados = await occupiedRoomIds(checkin, checkout, id);
      if (ocupados.has(roomIdDestino))
        return {
          ok: false,
          error: `El cuarto ${destino.room.numero} ya está ocupado o bloqueado del ${checkin} al ${checkout}.`,
        };
    }
  }

  const total =
    changes.total != null ? Math.max(0, Math.round(changes.total)) : b.total;
  let montoPagado =
    changes.montoPagado != null
      ? Math.max(0, Math.round(changes.montoPagado))
      : b.montoPagado;

  // ── Estado del pago ───────────────────────────────────────
  // El dueño manda: si marca la reserva como "Pagada", el dinero cobrado se
  // pone al día solo (cobró en efectivo, por transferencia o en el mostrador,
  // fuera de Mercado Pago). Antes esto era imposible en un caso muy común: una
  // reserva con `estado_pago = 'iniciado'` (el huésped abrió el checkout y
  // pagó por otro lado) se quedaba en "Esperando pago" para siempre, porque el
  // recálculo se saltaba justo ese estado.
  let estadoPago = b.estadoPago;
  if (changes.estadoPago != null) {
    estadoPago = changes.estadoPago;
    if (estadoPago === "pagado" && changes.montoPagado == null) montoPagado = total;
    if (estadoPago === "no_iniciado" && changes.montoPagado == null) montoPagado = 0;
  } else if (changes.montoPagado != null || changes.total != null) {
    estadoPago =
      montoPagado >= total && total > 0
        ? "pagado"
        : montoPagado > 0
          ? "parcial"
          : // Un cobro en línea a medias sigue siendo "esperando pago";
            // ponerlo en "sin pago" borraría que el huésped ya arrancó.
            b.estadoPago === "iniciado"
            ? "iniciado"
            : "no_iniciado";
  }

  const set: Partial<typeof bookings.$inferInsert> = {
    total,
    montoPagado,
    estadoPago,
    saldoPendiente: Math.max(0, total - montoPagado),
  };
  // Cobrada del todo: ya no hay hold de pago que pueda expirar y soltar el cuarto.
  if (estadoPago === "pagado") set.expiraEn = null;
  if (cambiaCuarto) set.roomId = roomIdDestino;
  if (changes.nombre != null) set.nombre = changes.nombre.trim();
  if (changes.whatsapp != null) set.whatsapp = changes.whatsapp.trim();
  if (changes.email !== undefined)
    set.email = changes.email ? String(changes.email).trim() : null;
  if (changes.checkin) set.checkin = checkin;
  if (changes.checkout) set.checkout = checkout;
  if (changes.huespedes != null) set.huespedes = huespedes;
  if (changes.estado) set.estado = changes.estado;
  if (changes.notas != null) set.notas = changes.notas.trim();
  if (changes.nosConociste != null)
    set.nosConociste = changes.nosConociste.trim().slice(0, 60);
  if (changes.formaPago != null) set.formaPago = formaPagoValida(changes.formaPago);
  // Sin dinero cobrado no hay vía que apuntar.
  if (montoPagado === 0) set.formaPago = "";

  await db.update(bookings).set(set).where(eq(bookings.id, id));
  // Las fechas, el cuarto o el estado pudieron cambiar → que Booking se entere.
  avisarBeds24((m) => m.reconciliarReserva(id));
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
  // Libera la fecha también en Booking.
  avisarBeds24((m) => m.reconciliarReserva(id));
  return { ok: true };
}

/**
 * BORRA una reserva de la base para siempre (no es cancelar: la fila desaparece
 * y con ella el historial y el dinero que aportaba a Ingresos).
 *
 * Dos cosas hay que desatar antes de borrar, o el DELETE falla o deja basura:
 *   · Una cotización convertida apunta a esta reserva (`quotes.booking_id`).
 *     La llave foránea impediría el borrado, así que primero se suelta y la
 *     cotización vuelve a "aceptada pero sin reserva".
 *   · Si la reserva vive también en Beds24, su id se va con la fila. Sin la
 *     lápida en la cola, la fecha se quedaría cerrada en Booking para siempre
 *     — el mismo cuidado que ya tiene `unblock`.
 */
export async function deleteBooking(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Reserva no encontrada." };
  await ensureDb();

  await db.update(quotes).set({ bookingId: null }).where(eq(quotes.bookingId, id));

  const res = await db
    .delete(bookings)
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id, beds24BookingId: bookings.beds24BookingId });
  if (res.length === 0) return { ok: false, error: "Reserva no encontrada." };

  avisarBeds24((m) => m.encolarBaja(res[0].beds24BookingId));
  return { ok: true };
}

// ── Calendario y bloqueos ───────────────────────────────────
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export type DayStatus = "libre" | "reservada" | "bloqueada";

/** Reserva que toca el mes, con lo justo para la ficha de un día del calendario. */
export interface CalendarBooking {
  id: string;
  roomId: string;
  nombre: string;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  total: number;
  montoPagado: number;
  estadoPago: string;
  origen: string;
  ref: string; // folio corto que el panel ya enseña (8 primeros del uuid)
}

export interface CalendarData {
  year: number;
  month: number; // 1-12
  days: string[];
  rooms: { id: string; numero: string; tipo: string; tarifa: number }[];
  grid: Record<string, Record<string, DayStatus>>;
  bloqueos: {
    id: string;
    roomId: string;
    checkin: string;
    checkout: string;
    motivo: string;
    origen: string | null;
    nota: string;
  }[];
  /** Reservas que traslapan el mes: la ficha del día las busca por cuarto+fecha. */
  reservas: CalendarBooking[];
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

  const [roomsTodos, bookingRows, blockRows] = await Promise.all([
    db
      .select({
        id: rooms.id,
        numero: rooms.numero,
        tipo: roomTypes.nombre,
        tarifa: roomTypes.tarifaBase,
        slug: roomTypes.slug,
      })
      .from(rooms)
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.activa, true)),
    db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        checkin: bookings.checkin,
        checkout: bookings.checkout,
        nombre: bookings.nombre,
        huespedes: bookings.huespedes,
        total: bookings.total,
        montoPagado: bookings.montoPagado,
        estadoPago: bookings.estadoPago,
        origen: bookings.origen,
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

  // Fuera los cuartos internos o de categorías retiradas: la rejilla es la
  // vista de lo que se VENDE, y su desplegable alimenta "Bloquear fechas".
  const roomsRows = roomsTodos.filter((r) => !r.slug || !HIDDEN_SLUGS.has(r.slug));

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
      tarifa: r.tarifa ?? 0,
    })),
    grid,
    bloqueos: blockRows.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      checkin: b.checkin,
      checkout: b.checkout,
      motivo: b.motivo,
      origen: b.origen,
      nota: b.nota,
    })),
    reservas: bookingRows.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      nombre: b.nombre,
      checkin: b.checkin,
      checkout: b.checkout,
      noches: calcNights(b.checkin, b.checkout),
      huespedes: b.huespedes,
      total: b.total,
      montoPagado: b.montoPagado,
      estadoPago: b.estadoPago,
      origen: b.origen,
      ref: b.id.slice(0, 8).toUpperCase(),
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
        // Coherente con getCalendarMonth/occupiedRoomIds: ocultar holds vencidos
        or(
          ne(bookings.estadoPago, "iniciado"),
          isNull(bookings.expiraEn),
          gt(bookings.expiraEn, sql`now()`),
        ),
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
}): Promise<{ ok: boolean; yaEstaba?: boolean; error?: string }> {
  if (!UUID_RE.test(input.roomId))
    return { ok: false, error: "Elige un cuarto válido." };
  await ensureDb();
  if (
    !isValidISODate(input.checkin) ||
    !isValidISODate(input.checkout) ||
    calcNights(input.checkin, input.checkout) < 1
  )
    return { ok: false, error: "Rango de fechas inválido." };
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.id, input.roomId))
    .limit(1);
  if (!room) return { ok: false, error: "Cuarto no encontrado." };

  // ¿Ya estaba cerrado ese rango completo? Sin esto, repetir el formulario
  // creaba filas idénticas: pasó de verdad, cuatro veces seguidas, porque el
  // panel no daba ninguna señal de que el bloqueo hubiera entrado.
  const yaCubren = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      and(
        eq(blocks.roomId, input.roomId),
        lte(blocks.checkin, input.checkin),
        gte(blocks.checkout, input.checkout),
      ),
    )
    .limit(1);
  if (yaCubren.length > 0) return { ok: true, yaEstaba: true };

  const [creado] = await db
    .insert(blocks)
    .values({
      roomId: input.roomId,
      checkin: input.checkin,
      checkout: input.checkout,
      motivo: input.motivo === "mantenimiento" ? "mantenimiento" : "manual",
      nota: input.nota?.trim() || "",
    })
    .returning({ id: blocks.id });
  // Cerrar por mantenimiento aquí debe cerrar también en Booking.
  avisarBeds24((m) => m.reconciliarBloqueo(creado.id));
  return { ok: true };
}

/** Quita un bloqueo manual/mantenimiento (los de OTA se gestionan por sync). */
export async function unblock(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(id))
    return { ok: false, error: "Bloqueo no encontrado o pertenece a un canal OTA." };
  await ensureDb();
  const res = await db
    .delete(blocks)
    .where(and(eq(blocks.id, id), ne(blocks.motivo, "ota")))
    .returning({ id: blocks.id, beds24BookingId: blocks.beds24BookingId });
  if (res.length === 0)
    return { ok: false, error: "Bloqueo no encontrado o pertenece a un canal OTA." };
  // La fila ya no existe: la baja en Beds24 se apunta aparte para que el reloj
  // la ejecute, o la fecha se quedaría cerrada en Booking para siempre.
  avisarBeds24((m) => m.encolarBaja(res[0].beds24BookingId));
  return { ok: true };
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin arrastrar zona horaria. */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Libera UN SOLO día de un cuarto, como el calendario de Paraíso.
 *
 * El panel guarda los bloqueos como RANGOS `[checkin, checkout)`, así que soltar
 * un día de en medio no es un DELETE: hay que partir el rango en los dos trozos
 * que sobreviven. Sin esto, desbloquear el 15 de un bloqueo del 10 al 20 abriría
 * los diez días a la venta sin que nadie lo pida — justo el tipo de fuga que
 * termina en sobreventa.
 *
 * Los bloqueos de OTA no se tocan: los gobierna la sincronización iCal/Beds24 y
 * borrarlos aquí los repondría en la siguiente corrida.
 */
export async function unblockDay(input: {
  roomId: string;
  fecha: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(input.roomId))
    return { ok: false, error: "Cuarto no válido." };
  if (!isValidISODate(input.fecha))
    return { ok: false, error: "Fecha no válida." };
  await ensureDb();

  const siguiente = addDaysISO(input.fecha, 1);
  const cubren = await db
    .select()
    .from(blocks)
    .where(
      and(
        eq(blocks.roomId, input.roomId),
        lte(blocks.checkin, input.fecha),
        gt(blocks.checkout, input.fecha),
      ),
    );

  if (cubren.length === 0)
    return { ok: false, error: "Esa fecha no está bloqueada." };
  if (cubren.every((b) => b.motivo === "ota"))
    return {
      ok: false,
      error:
        "Esta fecha la cerró un canal (Booking/Expedia). Libérala en la extranet del canal, no aquí.",
    };

  for (const bl of cubren) {
    if (bl.motivo === "ota") continue; // lo gestiona el sync, no el panel

    await db.delete(blocks).where(eq(blocks.id, bl.id));
    avisarBeds24((m) => m.encolarBaja(bl.beds24BookingId));

    // Los dos trozos que sobreviven al quitar el día. Cualquiera puede quedar
    // vacío (si el día era el primero o el último del rango).
    const trozos = [
      { checkin: bl.checkin, checkout: input.fecha },
      { checkin: siguiente, checkout: bl.checkout },
    ].filter((t) => t.checkin < t.checkout);

    for (const t of trozos) {
      const [nuevo] = await db
        .insert(blocks)
        .values({
          roomId: bl.roomId,
          checkin: t.checkin,
          checkout: t.checkout,
          motivo: bl.motivo,
          origen: bl.origen,
          nota: bl.nota,
        })
        .returning({ id: blocks.id });
      avisarBeds24((m) => m.reconciliarBloqueo(nuevo.id));
    }
  }

  return { ok: true };
}

// ── Notas CRM por huésped ───────────────────────────────────
/** Mapa email → notas (para construir el CRM). */
/**
 * ABRE un rango completo de fechas: el reverso exacto de "Bloquear fechas".
 *
 * Quitar bloqueos día por día es inservible cuando se cerró un mes entero, así
 * que aquí se recorta CUALQUIER bloqueo que toque `[checkin, checkout)`. Un
 * bloqueo que sobresale del rango no se borra: se parte y sobreviven los trozos
 * de fuera, igual que en `unblockDay`. Abrir de más sería una fuga hacia la
 * sobreventa.
 *
 * `roomId` vacío = todos los cuartos del hotel.
 *
 * Los bloqueos de OTA no se tocan (los gobierna la sincronización del canal);
 * si el rango solo tenía de esos, se avisa en vez de mentir con un "listo".
 */
export async function unblockRange(input: {
  roomId?: string;
  checkin: string;
  checkout: string;
}): Promise<{ ok: boolean; abiertos?: number; ota?: number; error?: string }> {
  const roomId = input.roomId?.trim() || "";
  if (roomId && !UUID_RE.test(roomId))
    return { ok: false, error: "Elige un cuarto válido." };
  if (
    !isValidISODate(input.checkin) ||
    !isValidISODate(input.checkout) ||
    calcNights(input.checkin, input.checkout) < 1
  )
    return { ok: false, error: "Rango de fechas inválido." };

  await ensureDb();
  const solapan = await db
    .select()
    .from(blocks)
    .where(
      and(
        roomId ? eq(blocks.roomId, roomId) : undefined,
        lt(blocks.checkin, input.checkout),
        gt(blocks.checkout, input.checkin),
      ),
    );

  const ota = solapan.filter((b) => b.motivo === "ota").length;
  const abribles = solapan.filter((b) => b.motivo !== "ota");
  if (abribles.length === 0)
    return {
      ok: false,
      error:
        ota > 0
          ? "En ese rango solo hay fechas cerradas por un canal (Booking/Expedia). Ábrelas en la extranet del canal, no aquí."
          : "No hay fechas bloqueadas en ese rango.",
    };

  for (const bl of abribles) {
    await db.delete(blocks).where(eq(blocks.id, bl.id));
    avisarBeds24((m) => m.encolarBaja(bl.beds24BookingId));

    // Lo que quedaba FUERA del rango sigue cerrado.
    const trozos = [
      { checkin: bl.checkin, checkout: input.checkin },
      { checkin: input.checkout, checkout: bl.checkout },
    ].filter((t) => t.checkin < t.checkout);

    for (const t of trozos) {
      const [creado] = await db
        .insert(blocks)
        .values({
          roomId: bl.roomId,
          checkin: t.checkin,
          checkout: t.checkout,
          motivo: bl.motivo,
          origen: bl.origen,
          nota: bl.nota,
        })
        .returning({ id: blocks.id });
      avisarBeds24((m) => m.reconciliarBloqueo(creado.id));
    }
  }

  return { ok: true, abiertos: abribles.length, ota };
}

export async function getGuestNotes(): Promise<Record<string, string>> {
  await ensureDb();
  const rows = await db.select().from(guestNotes);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.email] = r.notas;
  return map;
}

/**
 * Fichas de cliente que el panel escondió, con la fecha en que se escondieron
 * (ISO). El CRM las descarta salvo que el huésped haya reservado después.
 */
export async function getHiddenGuests(): Promise<Record<string, string>> {
  await ensureDb();
  const rows = await db.select().from(guestNotes);
  const map: Record<string, string> = {};
  for (const r of rows)
    if (r.ocultoDesde) map[r.email] = r.ocultoDesde.toISOString();
  return map;
}

/**
 * "Elimina" la ficha de un cliente: borra sus notas privadas y la esconde de
 * /clientes. NO toca sus reservas — el dinero cobrado sigue contando en
 * Ingresos y el historial sigue en /reservas. Si vuelve a reservar, reaparece.
 */
export async function hideGuest(email: string): Promise<{ ok: boolean; error?: string }> {
  const key = email.toLowerCase().trim();
  if (!key) return { ok: false, error: "Falta el correo." };
  await ensureDb();
  const ahora = new Date();
  await db
    .insert(guestNotes)
    .values({ email: key, notas: "", ocultoDesde: ahora, updatedAt: ahora })
    .onConflictDoUpdate({
      target: guestNotes.email,
      set: { notas: "", ocultoDesde: ahora, updatedAt: ahora },
    });
  return { ok: true };
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
      // Escribir una nota es volver a trabajar con ese cliente: si la ficha
      // estaba escondida, vuelve a la lista.
      set: { notas, ocultoDesde: null, updatedAt: new Date() },
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
  const huespedes = Math.floor(input.huespedes) || 1;
  if (tipo && huespedes > tipo.capacidad)
    return { ok: false, error: "Ese tipo de habitación no admite tantos huéspedes." };
  const precioTotal =
    input.precioTotal != null && input.precioTotal >= 0
      ? Math.round(input.precioTotal)
      : tipo
        ? precioPorNoche(tipo, huespedes) * noches
        : 0;
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
      huespedes,
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
    /** Cambio de habitación: slug del tipo al que se pasa la cotización. */
    slug?: string;
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
  const noches = calcNights(checkin, checkout);
  const huespedes =
    changes.huespedes != null ? Math.max(1, Math.floor(changes.huespedes)) : q.huespedes;

  // Tipo destino: el nuevo si lo cambian, si no el que ya tenía (hace falta
  // para validar la capacidad aunque solo cambien los huéspedes).
  const [tipo] = changes.slug
    ? await db.select().from(roomTypes).where(eq(roomTypes.slug, changes.slug)).limit(1)
    : q.roomTypeId
      ? await db.select().from(roomTypes).where(eq(roomTypes.id, q.roomTypeId)).limit(1)
      : [];
  if (changes.slug && !tipo)
    return { ok: false, error: "Ese tipo de habitación no existe." };
  if (tipo && tipo.capacidad < huespedes)
    return { ok: false, error: "Ese tipo de habitación no admite tantos huéspedes." };

  const set: Partial<typeof quotes.$inferInsert> = {};
  if (changes.cliente != null) set.cliente = changes.cliente.trim();
  if (changes.telefono != null) set.telefono = changes.telefono.trim();
  if (changes.email !== undefined)
    set.email = changes.email ? String(changes.email).trim() : null;
  if (changes.checkin || changes.checkout) {
    if (noches < 1) return { ok: false, error: "Las fechas no son válidas." };
    set.checkin = checkin;
    set.checkout = checkout;
    set.noches = noches;
  }
  if (changes.slug && tipo) {
    set.roomTypeId = tipo.id;
    // `quotes.slug` guarda el NOMBRE del tipo (es lo que se imprime en el PDF).
    set.slug = tipo.nombre;
  }
  if (changes.huespedes != null) set.huespedes = huespedes;
  if (changes.precioTotal != null) set.precioTotal = Math.round(changes.precioTotal);
  else if (changes.slug && tipo)
    // Cambió de habitación sin tocar el precio: recalcular con la tarifa nueva,
    // o la cotización saldría con el cuarto nuevo y el precio del viejo.
    set.precioTotal = precioPorNoche(tipo, huespedes) * noches;
  if (changes.notas != null) set.notas = changes.notas.trim();
  if (changes.estado) set.estado = changes.estado;
  await db.update(quotes).set(set).where(eq(quotes.id, id));
  return { ok: true };
}

/**
 * BORRA una cotización de la base para siempre.
 *
 * Si ya se convirtió en reserva, la reserva NO se toca: solo desaparece el
 * presupuesto. Borrar el papel no debe cancelarle el cuarto a nadie.
 */
export async function deleteQuote(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Cotización no encontrada." };
  await ensureDb();
  const res = await db.delete(quotes).where(eq(quotes.id, id)).returning({ id: quotes.id });
  if (res.length === 0) return { ok: false, error: "Cotización no encontrada." };
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
/**
 * Tipos de habitación para el SITIO PÚBLICO (/habitaciones, /buscar, home).
 *
 * Se descartan dos cosas que no se pueden vender:
 *   · los tipos internos o retirados (HIDDEN_SLUGS);
 *   · los que no tienen NINGÚN cuarto físico activo — anunciar una categoría
 *     sin inventario manda al huésped a un buscador que nunca se la ofrece.
 *     Es el caso de la Matrimonial mientras Gersay termina de reacomodar.
 *
 * `includeHidden` es la vista del panel /admin: devuelve todo sin filtrar,
 * porque ahí sí hay que ver los tipos retirados y los que se quedaron sin
 * cuartos para poder administrarlos.
 */
export async function getRoomTypes(opts?: { includeHidden?: boolean }) {
  await ensureDb();
  const rows = await db.select().from(roomTypes).orderBy(roomTypes.tarifaBase);
  if (opts?.includeHidden) return rows;

  const activos = await db.select().from(rooms).where(eq(rooms.activa, true));
  const conInventario = new Set(activos.map((r) => r.roomTypeId));
  return rows.filter((t) => !HIDDEN_SLUGS.has(t.slug) && conInventario.has(t.id));
}

/**
 * Tipos VENDIBLES, para los desplegables del panel.
 *
 * Fuera los internos y retirados (`HIDDEN_SLUGS`): el cuarto de prueba de $10 y
 * las categorías viejas (Sencilla, Doble). `getRoomTypes` ordena por tarifa, así
 * que el de prueba era el más barato y salía PRESELECCIONADO en "Nueva reserva":
 * bastaba no tocar el desplegable para crear una reserva de $10.
 *
 * A diferencia de `getRoomTypes()` (sitio público), aquí NO se exige inventario:
 * el panel sí debe poder cotizar una categoría real que hoy esté sin cuartos
 * asignados, como la Matrimonial mientras Gersay reacomoda.
 *
 * El tipo de prueba sigue existiendo en la base y se sigue pudiendo reservar por
 * link directo a `/reservar?tipo=prueba`, que es como se prueban cobros reales
 * de Mercado Pago. Lo que se quitó es que aparezca en el catálogo del panel.
 */
export async function getRoomTypesPanel() {
  await ensureDb();
  const rows = await db.select().from(roomTypes).orderBy(roomTypes.tarifaBase);
  return rows.filter((t) => !HIDDEN_SLUGS.has(t.slug));
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
