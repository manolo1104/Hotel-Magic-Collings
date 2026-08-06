// ============================================================
// SINCRONIZACIÓN CON BEDS24 — las dos direcciones
//
//   SALIDA  sitio → Beds24 → Booking
//     Cada reserva del motor (y cada bloqueo de mantenimiento) se crea también
//     en Beds24, que cierra la fecha en Booking.com. Al cancelarse aquí, se
//     cancela allá y la fecha se libera sola.
//
//   ENTRADA Booking → Beds24 → sitio
//     El webhook de Beds24 (app/api/beds24/webhook) avisa al instante; el reloj
//     repesca cada pocos minutos por si un aviso se perdió.
//
// PRINCIPIO DE DISEÑO — reconciliación, no eventos sueltos.
// Cada reserva guarda en `beds24_estado` lo ÚLTIMO que se logró dejar en
// Beds24. El estado DESEADO se deduce de `isReservaActiva` (la misma función
// que decide si el cuarto está ocupado en el sitio). Si no coinciden, se
// corrige. Por eso una subida fallida —red caída, Beds24 en mantenimiento— se
// reintenta sola en la corrida siguiente, sin colas ni reintentos manuales.
// ============================================================
import { and, eq, gte, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { conCandado } from "@/lib/db/lock";
import { appState, beds24Cola, blocks, bookings, rooms, roomTypes } from "@/lib/db/schema";
import type { Booking, RoomType } from "@/lib/db/schema";
import { isReservaActiva, todayISO, UUID_RE } from "@/lib/booking/engine";
import {
  beds24Activo,
  guardarReservas,
  listarHabitaciones,
  listarReservas,
  type AltaReserva,
  type Beds24Booking,
  type Beds24Room,
} from "./client";

// Canales cuyas reservas NACEN fuera: nunca se vuelven a subir a Beds24.
const ORIGENES_OTA = new Set(["booking", "expedia", "airbnb", "ota"]);
// Estados de Beds24 que sí ocupan inventario.
const ESTADOS_OCUPAN = new Set(["confirmed", "new", "black"]);
// Tope de subidas por corrida: Beds24 cobra créditos por llamada y limita por
// ventanas de 5 minutos. Lo que no entre se hace en la corrida siguiente.
const MAX_POR_CORRIDA = 25;
// Traslape al repescar: se relee un poco hacia atrás por si los relojes van
// desfasados. Re-procesar es inofensivo (todo el flujo es idempotente).
const TRASLAPE_MIN = 10;

export interface ResultadoBeds24 {
  activo: boolean;
  omitido?: boolean;
  importadas: number;
  subidas: number;
  canceladas: number;
  errores: number;
  detalle?: string;
}

// ── Una cosa a la vez por reserva ───────────────────────────
// Sobre la MISMA reserva pueden caer dos sincronizaciones a la vez: el aviso
// inmediato (al reservar o cancelar) y la corrida del reloj. Si se enciman,
// las dos leen el estado viejo y la más lenta gana: se ha visto crear en
// Beds24 una reserva que aquí ya estaba cancelada, dejando la fecha cerrada en
// Booking para siempre. Aquí se encolan para que cada una lea el estado ya
// actualizado por la anterior.
const global_ = globalThis as unknown as { __mcBeds24Colas?: Map<string, Promise<unknown>> };
const colas = (global_.__mcBeds24Colas ??= new Map<string, Promise<unknown>>());

function enSerie<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = colas.get(clave) ?? Promise.resolve();
  // `.then(fn, fn)` encadena tanto si la anterior salió bien como si falló:
  // un error no debe atorar la cola de esa reserva.
  const actual = anterior.then(fn, fn);
  const marcador = actual.then(
    () => {},
    () => {},
  );
  colas.set(clave, marcador);
  void marcador.then(() => {
    if (colas.get(clave) === marcador) colas.delete(clave);
  });
  return actual;
}

// ── Estado persistente (cursor de repesca) ──────────────────
async function leerEstado(clave: string): Promise<string | null> {
  const [row] = await db.select().from(appState).where(eq(appState.clave, clave)).limit(1);
  return row?.valor ?? null;
}

async function guardarEstado(clave: string, valor: string): Promise<void> {
  await db
    .insert(appState)
    .values({ clave, valor, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appState.clave, set: { valor, updatedAt: new Date() } });
}

/** "YYYY-MM-DDTHH:MM:SS" en UTC, que es el formato que espera Beds24. */
function paraBeds24(d: Date): string {
  return d.toISOString().slice(0, 19);
}

// ── Emparejamiento tipo de habitación ↔ habitación de Beds24 ─
export interface EmparejamientoView {
  roomTypeId: string;
  slug: string;
  nombre: string;
  unidades: number;
  beds24RoomId: number | null;
}

export async function listarEmparejamientos(): Promise<EmparejamientoView[]> {
  await ensureDb();
  const [tipos, cuartos] = await Promise.all([
    db.select().from(roomTypes).orderBy(roomTypes.tarifaBase),
    db.select().from(rooms).where(eq(rooms.activa, true)),
  ]);
  return tipos.map((t) => ({
    roomTypeId: t.id,
    slug: t.slug,
    nombre: t.nombre,
    unidades: cuartos.filter((c) => c.roomTypeId === t.id).length,
    beds24RoomId: t.beds24RoomId,
  }));
}

/** Habitaciones de la cuenta de Beds24, para elegirlas en el panel. */
export async function habitacionesDisponibles(): Promise<Beds24Room[]> {
  if (!beds24Activo()) return [];
  return await listarHabitaciones();
}

export async function emparejar(
  roomTypeId: string,
  beds24RoomId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  if (!UUID_RE.test(roomTypeId)) return { ok: false, error: "Tipo de habitación inválido." };
  if (beds24RoomId !== null && !Number.isInteger(beds24RoomId))
    return { ok: false, error: "El id de Beds24 debe ser un número." };
  // Dos tipos apuntando a la misma habitación de Beds24 duplicarían el
  // inventario: el mismo cuarto se vendería dos veces.
  if (beds24RoomId !== null) {
    const [dup] = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.beds24RoomId, beds24RoomId), ne(roomTypes.id, roomTypeId)))
      .limit(1);
    if (dup)
      return { ok: false, error: "Esa habitación de Beds24 ya está emparejada con otro tipo." };
  }
  await db.update(roomTypes).set({ beds24RoomId }).where(eq(roomTypes.id, roomTypeId));
  return { ok: true };
}

// ── SALIDA: sitio → Beds24 ──────────────────────────────────
function partirNombre(completo: string): { firstName: string; lastName: string } {
  const partes = completo.trim().split(/\s+/);
  if (partes.length <= 1) return { firstName: completo.trim() || "Huésped", lastName: "" };
  return { firstName: partes[0], lastName: partes.slice(1).join(" ") };
}

/** Estado que DEBERÍA tener la reserva en Beds24 según el estado del sitio. */
function estadoDeseado(b: Booking): "confirmed" | "cancelled" {
  return isReservaActiva(b, new Date()) ? "confirmed" : "cancelled";
}

async function tipoDeReserva(b: Booking): Promise<RoomType | null> {
  const [row] = await db
    .select({ tipo: roomTypes })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(rooms.id, b.roomId))
    .limit(1);
  return row?.tipo ?? null;
}

/**
 * Deja UNA reserva como debe quedar en Beds24. Idempotente: si ya está en el
 * estado correcto no llama a la API. Nunca lanza: registra el error en la
 * propia reserva para que el reloj lo reintente y el panel lo muestre.
 */
export function reconciliarReserva(bookingId: string): Promise<"ok" | "sin-cambio" | "error"> {
  if (!beds24Activo()) return Promise.resolve("sin-cambio");
  return enSerie(`reserva:${bookingId}`, () => reconciliarReservaInterno(bookingId));
}

async function reconciliarReservaInterno(
  bookingId: string,
): Promise<"ok" | "sin-cambio" | "error"> {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b) return "sin-cambio";

  const deseado = estadoDeseado(b);
  if (b.beds24Estado === deseado) return "sin-cambio";

  // Reserva que nació en una OTA y todavía no existe aquí arriba: no se sube
  // (ya vive en Beds24) y tampoco hay nada que cancelar.
  const naceFuera = ORIGENES_OTA.has(b.origen);
  if (b.beds24BookingId == null && (deseado === "cancelled" || naceFuera)) {
    await db.update(bookings).set({ beds24Estado: deseado }).where(eq(bookings.id, b.id));
    return "sin-cambio";
  }

  try {
    if (b.beds24BookingId == null) {
      const tipo = await tipoDeReserva(b);
      if (!tipo?.beds24RoomId) return "sin-cambio"; // tipo sin emparejar todavía
      const { firstName, lastName } = partirNombre(b.nombre);
      const ref = b.id.slice(0, 8).toUpperCase();
      const alta: AltaReserva = {
        roomId: tipo.beds24RoomId,
        status: "confirmed",
        arrival: b.checkin,
        departure: b.checkout,
        numAdult: Math.min(99, Math.max(1, b.huespedes)),
        firstName,
        lastName,
        email: b.email ?? undefined,
        mobile: b.whatsapp || undefined,
        price: b.total,
        // El id de nuestra reserva viaja en apiReference: así, cuando esta
        // misma reserva regrese por el webhook, se reconoce como propia y no
        // se duplica.
        apiReference: b.id,
        referer: "Sitio web Magic Collinn",
        notes: `Reserva ${ref} del sitio web de Magic Collinn.`,
      };
      const [nuevoId] = await guardarReservas([alta]);
      await db
        .update(bookings)
        .set({
          beds24BookingId: nuevoId,
          beds24Estado: "confirmed",
          beds24SyncedAt: new Date(),
          beds24Error: null,
        })
        .where(eq(bookings.id, b.id));
      return "ok";
    }

    // Modificar: basta el id + lo que cambia. Se mandan también las fechas por
    // si el hotel las editó en el panel después de haberla subido.
    await guardarReservas([
      {
        id: b.beds24BookingId,
        status: deseado,
        arrival: b.checkin,
        departure: b.checkout,
      },
    ]);
    await db
      .update(bookings)
      .set({ beds24Estado: deseado, beds24SyncedAt: new Date(), beds24Error: null })
      .where(eq(bookings.id, b.id));
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[beds24] no se pudo sincronizar la reserva ${b.id}:`, msg);
    await db
      .update(bookings)
      .set({ beds24Error: msg.slice(0, 500), beds24SyncedAt: new Date() })
      .where(eq(bookings.id, b.id));
    return "error";
  }
}

/**
 * Espeja un bloqueo (mantenimiento / cierre manual) en Beds24 como reserva
 * "black", que cierra la fecha en Booking sin cobrar nada.
 */
export function reconciliarBloqueo(blockId: string): Promise<"ok" | "sin-cambio" | "error"> {
  if (!beds24Activo()) return Promise.resolve("sin-cambio");
  return enSerie(`bloqueo:${blockId}`, () => reconciliarBloqueoInterno(blockId));
}

async function reconciliarBloqueoInterno(
  blockId: string,
): Promise<"ok" | "sin-cambio" | "error"> {
  const [bl] = await db.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);
  if (!bl) return "sin-cambio";
  // Los bloqueos que VIENEN de una OTA no se devuelven a la OTA.
  if (bl.motivo === "ota" || bl.beds24Estado === "black") return "sin-cambio";

  const [row] = await db
    .select({ tipo: roomTypes })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(rooms.id, bl.roomId))
    .limit(1);
  if (!row?.tipo.beds24RoomId) return "sin-cambio";

  try {
    const [id] = await guardarReservas([
      {
        roomId: row.tipo.beds24RoomId,
        status: "black",
        arrival: bl.checkin,
        departure: bl.checkout,
        firstName: bl.motivo === "mantenimiento" ? "Mantenimiento" : "Bloqueo",
        lastName: "Magic Collinn",
        apiReference: bl.id,
        notes: bl.nota || "Bloqueado desde el panel del hotel.",
      },
    ]);
    await db
      .update(blocks)
      .set({ beds24BookingId: id, beds24Estado: "black" })
      .where(eq(blocks.id, bl.id));
    return "ok";
  } catch (e) {
    console.error(`[beds24] no se pudo espejar el bloqueo ${bl.id}:`, e);
    return "error";
  }
}

/**
 * Apunta una baja pendiente. Se usa cuando el panel BORRA un bloqueo: la fila
 * desaparece y con ella el id de Beds24, así que la baja se guarda aparte para
 * que el reloj la ejecute. Sin esto la fecha se quedaría cerrada en Booking.
 */
export async function encolarBaja(beds24BookingId: number | null): Promise<void> {
  if (!beds24Activo() || beds24BookingId == null) return;
  try {
    await db.insert(beds24Cola).values({ beds24BookingId });
  } catch (e) {
    console.error("[beds24] no se pudo encolar la baja:", e);
  }
}

async function vaciarCola(): Promise<{ canceladas: number; errores: number }> {
  const pendientes = await db.select().from(beds24Cola).limit(MAX_POR_CORRIDA);
  let canceladas = 0;
  let errores = 0;
  for (const p of pendientes) {
    try {
      await guardarReservas([{ id: p.beds24BookingId, status: "cancelled" }]);
      await db.delete(beds24Cola).where(eq(beds24Cola.id, p.id));
      canceladas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores++;
      // Tras varios intentos fallidos se abandona: si la reserva ya no existe
      // en Beds24, reintentar para siempre solo quema créditos.
      if (p.intentos + 1 >= 5) {
        console.error(`[beds24] baja ${p.beds24BookingId} abandonada tras 5 intentos:`, msg);
        await db.delete(beds24Cola).where(eq(beds24Cola.id, p.id));
      } else {
        await db
          .update(beds24Cola)
          .set({ intentos: p.intentos + 1, ultimoError: msg.slice(0, 500) })
          .where(eq(beds24Cola.id, p.id));
      }
    }
  }
  return { canceladas, errores };
}

// ── ENTRADA: Beds24 → sitio ─────────────────────────────────
export type ResultadoImport = "propia" | "creada" | "actualizada" | "sin-mapa" | "ignorada";

/**
 * Mete en nuestra base una reserva que Beds24 nos reporta (venga del webhook o
 * de la repesca). Idempotente por `beds24_booking_id`.
 */
export async function importarReservaBeds24(b: Beds24Booking): Promise<ResultadoImport> {
  await ensureDb();
  if (!b?.id || !b.arrival || !b.departure) return "ignorada";

  // ¿Es una reserva NUESTRA que volvió de rebote? Se reconoce por apiReference.
  if (b.apiReference && UUID_RE.test(b.apiReference)) {
    const [propia] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, b.apiReference))
      .limit(1);
    if (propia) {
      // Solo se anota el vínculo; el estado lo manda el sitio, no Beds24.
      if (propia.beds24BookingId !== b.id)
        await db
          .update(bookings)
          .set({ beds24BookingId: b.id, beds24SyncedAt: new Date() })
          .where(eq(bookings.id, propia.id));
      return "propia";
    }
  }

  const ocupa = ESTADOS_OCUPAN.has(b.status);
  const [existente] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.beds24BookingId, b.id))
    .limit(1);

  if (existente) {
    await db
      .update(bookings)
      .set({
        checkin: b.arrival,
        checkout: b.departure,
        estado: ocupa ? "confirmada" : "cancelada",
        beds24Estado: ocupa ? "confirmed" : "cancelled",
        beds24SyncedAt: new Date(),
        ...(b.price != null ? { total: Math.round(b.price) } : {}),
      })
      .where(eq(bookings.id, existente.id));
    return "actualizada";
  }

  // Cancelada que nunca llegamos a ver: no hay nada que crear.
  if (!ocupa) return "ignorada";

  const [tipo] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.beds24RoomId, b.roomId))
    .limit(1);
  if (!tipo) {
    console.warn(
      `[beds24] reserva ${b.id} de una habitación (${b.roomId}) que no está emparejada con ningún tipo; se ignora.`,
    );
    return "sin-mapa";
  }

  // Asigna una unidad física libre de ese tipo.
  const { occupiedRoomIds } = await import("@/lib/booking/engine");
  const unidades = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.roomTypeId, tipo.id), eq(rooms.activa, true)));
  if (unidades.length === 0) return "sin-mapa";
  const ocupadas = await occupiedRoomIds(b.arrival, b.departure);
  const libre = unidades.find((u) => !ocupadas.has(u.id));
  // Si no hay ninguna libre, la sobreventa YA ocurrió (dos ventas simultáneas
  // por lados distintos). Se guarda igual, marcada, para que el hotel la vea y
  // la resuelva; esconderla sería peor.
  const sobreventa = !libre;
  const unidad = libre ?? unidades[0];

  const nombre =
    `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim() || `Huésped ${b.channel ?? "OTA"}`;
  const origen = b.channel === "expedia" ? "expedia" : b.channel === "booking" ? "booking" : "ota";

  try {
    await db.insert(bookings).values({
      roomId: unidad.id,
      checkin: b.arrival,
      checkout: b.departure,
      huespedes: Math.max(1, (b.numAdult ?? 1) + (b.numChild ?? 0)),
      nombre,
      whatsapp: b.mobile || b.phone || "—",
      email: b.email || null,
      estado: "confirmada",
      total: Math.round(b.price ?? 0),
      // El huésped paga en la OTA, no aquí: no hay cobro en línea que rastrear.
      estadoPago: "no_iniciado",
      origen,
      notas:
        (sobreventa ? "⚠️ SOBREVENTA: no había unidad libre al importarla. " : "") +
        `Importada de ${b.channel ?? "OTA"} vía Beds24 (#${b.id}).`,
      beds24BookingId: b.id,
      beds24Estado: "confirmed",
      beds24SyncedAt: new Date(),
    });
  } catch (e) {
    // El índice único de beds24_booking_id: el webhook y la repesca llegaron a
    // la vez y el otro ganó. No es un error.
    console.warn(`[beds24] reserva ${b.id} ya estaba importada:`, e);
    return "ignorada";
  }
  if (sobreventa)
    console.error(
      `[beds24] ⚠️ SOBREVENTA al importar la reserva ${b.id} (${b.arrival} → ${b.departure}).`,
    );
  return "creada";
}

// ── El barrido completo (lo llama el reloj y el botón del panel) ─
export async function sincronizarBeds24(): Promise<ResultadoBeds24> {
  const vacio: ResultadoBeds24 = {
    activo: false,
    importadas: 0,
    subidas: 0,
    canceladas: 0,
    errores: 0,
  };
  if (!beds24Activo()) return { ...vacio, detalle: "Beds24 no está configurado." };

  const r = await conCandado("beds24-sync", async () => {
    await ensureDb();
    let importadas = 0;
    let subidas = 0;
    let canceladas = 0;
    let errores = 0;

    // 1) ENTRADA — reservas nuevas o modificadas desde la última corrida.
    const ahora = new Date();
    const cursor = await leerEstado("beds24_modified_from");
    const desde = cursor
      ? new Date(new Date(cursor).getTime() - TRASLAPE_MIN * 60_000)
      : new Date(ahora.getTime() - 7 * 24 * 60 * 60_000); // primer arranque: 7 días
    try {
      const remotas = await listarReservas({
        modifiedFrom: paraBeds24(desde),
        status: ["confirmed", "new", "request", "cancelled", "black", "inquiry"],
      });
      for (const rem of remotas) {
        const res = await importarReservaBeds24(rem);
        if (res === "creada" || res === "actualizada") importadas++;
      }
      // El cursor solo avanza si la lectura terminó bien: si falló, la próxima
      // corrida vuelve a pedir el mismo rango y no se pierde ninguna reserva.
      await guardarEstado("beds24_modified_from", paraBeds24(ahora));
    } catch (e) {
      errores++;
      console.error("[beds24] falló la repesca de reservas:", e);
    }

    // 2) SALIDA — reservas del sitio cuyo estado en Beds24 no coincide.
    const hoy = todayISO();
    // Solo las que aún afectan disponibilidad; el pasado ya no importa. El
    // hotel tiene 6 cuartos, así que son pocas filas y el filtro fino
    // (comparar estado real vs. estado en Beds24) se hace aquí abajo.
    const candidatas = await db
      .select()
      .from(bookings)
      .where(gte(bookings.checkout, hoy));
    let hechas = 0;
    for (const b of candidatas) {
      if (hechas >= MAX_POR_CORRIDA) break;
      if (b.beds24Estado === estadoDeseado(b)) continue;
      const res = await reconciliarReserva(b.id);
      if (res === "ok") {
        hechas++;
        if (estadoDeseado(b) === "cancelled") canceladas++;
        else subidas++;
      } else if (res === "error") {
        hechas++;
        errores++;
      }
    }

    // 3) SALIDA — bloqueos de mantenimiento todavía sin espejo.
    const bloqueos = await db
      .select()
      .from(blocks)
      .where(and(gte(blocks.checkout, hoy), isNull(blocks.beds24Estado), ne(blocks.motivo, "ota")))
      .limit(MAX_POR_CORRIDA);
    for (const bl of bloqueos) {
      const res = await reconciliarBloqueo(bl.id);
      if (res === "ok") subidas++;
      else if (res === "error") errores++;
    }

    // 4) Bajas pendientes (bloqueos borrados en el panel).
    const cola = await vaciarCola();
    canceladas += cola.canceladas;
    errores += cola.errores;

    return { activo: true, importadas, subidas, canceladas, errores };
  });

  return r ?? { ...vacio, activo: true, omitido: true };
}

// ── Resumen para el panel ───────────────────────────────────
export interface EstadoBeds24 {
  activo: boolean;
  emparejamientos: EmparejamientoView[];
  ultimaSync: string | null;
  pendientesDeSubir: number;
  conError: number;
  importadas: number;
}

export async function estadoBeds24(): Promise<EstadoBeds24> {
  await ensureDb();
  const emparejamientos = await listarEmparejamientos();
  if (!beds24Activo())
    return {
      activo: false,
      emparejamientos,
      ultimaSync: null,
      pendientesDeSubir: 0,
      conError: 0,
      importadas: 0,
    };

  const hoy = todayISO();
  const [ultimaSync, futuras] = await Promise.all([
    leerEstado("beds24_modified_from"),
    db.select().from(bookings).where(gte(bookings.checkout, hoy)),
  ]);
  return {
    activo: true,
    emparejamientos,
    ultimaSync,
    pendientesDeSubir: futuras.filter((b) => b.beds24Estado !== estadoDeseado(b)).length,
    conError: futuras.filter((b) => b.beds24Error).length,
    importadas: futuras.filter((b) => ORIGENES_OTA.has(b.origen)).length,
  };
}
