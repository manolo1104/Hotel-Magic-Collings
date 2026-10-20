// ============================================================
// COTIZACIONES DEL BOT — apartar, recordar, confirmar
// La regla que se copia de Camila: el MODELO elige qué cotizar; el CÓDIGO
// calcula total, anticipo y saldo y arma el resumen con los datos para
// transferir. Así un número nunca sale "inventado" por la IA.
//
// Cada cuarto cotizado es una reserva real del motor (origen 'whatsapp') en
// estado de apartado (`estado_pago = 'iniciado'` + `expira_en`): ocupa el
// cuarto mientras el huésped transfiere y se libera sola si no paga, igual
// que un checkout abandonado de la web.
// ============================================================
import { randomInt } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { bookings, botCotizaciones, type Booking, type BotCotizacion } from "../db/schema";
import {
  UUID_RE,
  calcNights,
  createBooking,
  formatMXN,
  getAvailability,
  getBookingById,
  getRoomTypeBySlug,
  occupiedRoomIds,
  todayISO,
  totalEstancia,
  updateBooking,
  validateRange,
} from "../booking/engine";
import type { CreateBookingResult } from "../booking/types";
import { esChatDePrueba } from "./prueba";
import { site } from "../site";
import {
  APARTADO_CON_COMPROBANTE_MIN,
  APARTADO_MIN,
  MAX_CUARTOS,
  datosBancarios,
} from "./config";
import { cuandoVence, fechaLarga } from "./fechas";

export type HabitacionCotizada = {
  slug: string;
  nombre: string;
  huespedes: number;
  total: number;
  bookingId: string;
};

export type EstadoCotizacion =
  | "vigente"
  | "comprobante"
  | "confirmada"
  | "reemplazada"
  | "vencida"
  | "cancelada";

// Sin 0/O ni 1/I/L: el folio se dicta y se teclea.
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function nuevoFolio(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `MC-${s}`;
}

export const FOLIO_RE = /\bMC-[2-9A-HJ-NP-Z]{4}\b/i;

/** Anticipo: una noche se paga completa; dos o más, la mitad (como la web). */
export function anticipoDe(totales: number[], noches: number): number {
  return totales.reduce((s, t) => s + (noches < 2 ? t : Math.round(t / 2)), 0);
}

function habitacionesDe(c: BotCotizacion): HabitacionCotizada[] {
  return Array.isArray(c.habitaciones) ? (c.habitaciones as HabitacionCotizada[]) : [];
}

// ── Lectura ───────────────────────────────────────────────────

export async function cotizacionPorFolio(folio: string): Promise<BotCotizacion | null> {
  await ensureDb();
  const [c] = await db
    .select()
    .from(botCotizaciones)
    .where(eq(botCotizaciones.folio, folio.trim().toUpperCase()))
    .limit(1);
  return c ? await alDia(c) : null;
}

/** Cotizaciones del chat, la más reciente primero (con vencimientos al día). */
export async function cotizacionesDelChat(chatId: string): Promise<BotCotizacion[]> {
  await ensureDb();
  const filas = await db
    .select()
    .from(botCotizaciones)
    .where(eq(botCotizaciones.chatId, chatId))
    .orderBy(desc(botCotizaciones.createdAt))
    .limit(10);
  return Promise.all(filas.map(alDia));
}

/** La que está en juego: apartada sin pagar o con comprobante en revisión. */
export async function cotizacionVigente(chatId: string): Promise<BotCotizacion | null> {
  const todas = await cotizacionesDelChat(chatId);
  return todas.find((c) => c.estado === "vigente" || c.estado === "comprobante") ?? null;
}

/**
 * Un apartado vencido se marca al leerlo (no hace falta reloj): el motor ya
 * dejó de contar esas reservas como ocupadas en el mismo instante.
 */
async function alDia(c: BotCotizacion): Promise<BotCotizacion> {
  if (c.estado !== "vigente" || c.apartadoHasta.getTime() > Date.now()) return c;
  await db
    .update(botCotizaciones)
    .set({ estado: "vencida" })
    .where(and(eq(botCotizaciones.folio, c.folio), eq(botCotizaciones.estado, "vigente")));
  return { ...c, estado: "vencida" };
}

// ── Crear ─────────────────────────────────────────────────────

export type ResultadoCotizacion =
  | { ok: true; cotizacion: BotCotizacion; resumen: string; reemplazo?: string }
  | { ok: false; error: string; motivo?: "comprobante_previo" | "sin_lugar" | "datos" };

export async function crearCotizacion(input: {
  chatId: string;
  telefono: string;
  nombre: string;
  email?: string | null;
  checkin: string;
  checkout: string;
  habitaciones: { slug: string; huespedes: number }[];
}): Promise<ResultadoCotizacion> {
  await ensureDb();
  const nombre = input.nombre.trim().slice(0, 120);
  if (nombre.length < 2) return { ok: false, motivo: "datos", error: "Falta el nombre del huésped." };
  const habitaciones = input.habitaciones
    .map((h) => ({ slug: String(h.slug).trim(), huespedes: Math.floor(Number(h.huespedes)) }))
    .filter((h) => h.slug && h.huespedes >= 1);
  if (habitaciones.length === 0)
    return { ok: false, motivo: "datos", error: "Indica qué habitación(es) y cuántas personas en cada una." };
  if (habitaciones.length > MAX_CUARTOS)
    return { ok: false, motivo: "datos", error: `Máximo ${MAX_CUARTOS} habitaciones por cotización.` };
  const huespedes = habitaciones.reduce((s, h) => s + h.huespedes, 0);
  const rango = validateRange({ checkin: input.checkin, checkout: input.checkout, huespedes });
  if (rango) return { ok: false, motivo: "datos", error: rango };
  const email = input.email?.trim() && /.+@.+\..+/.test(input.email) ? input.email.trim() : null;
  const noches = calcNights(input.checkin, input.checkout);

  // Una cotización nueva REEMPLAZA a la anterior sin pagar (cambio de fechas
  // o de cuartos). Con comprobante ya enviado no se toca: eso lo ve una persona.
  const previa = await cotizacionVigente(input.chatId);
  if (previa?.estado === "comprobante")
    return {
      ok: false,
      motivo: "comprobante_previo",
      error: `Ya hay un comprobante en revisión para el folio ${previa.folio}; un cambio lo tiene que hacer el equipo del hotel.`,
    };
  // Se suelta ANTES de apartar lo nuevo: si el huésped solo cambia de fechas,
  // sus propios cuartos apartados le estorbarían.
  if (previa) await soltarReservas(previa);

  let folio = nuevoFolio();
  for (let i = 0; i < 5 && (await existeFolio(folio)); i++) folio = nuevoFolio();

  const creadas: HabitacionCotizada[] = [];
  const prueba = esChatDePrueba(input.chatId);
  const pedidos = new Map<string, number>(); // solo para el modo prueba
  for (const h of habitaciones) {
    const r = prueba
      ? await cotizarSinApartar(h.slug, h.huespedes, input.checkin, input.checkout, pedidos)
      : await createBooking({
      slug: h.slug,
      checkin: input.checkin,
      checkout: input.checkout,
      huespedes: h.huespedes,
      nombre,
      whatsapp: input.telefono || "WhatsApp",
      email: email ?? undefined,
      nosConociste: "WhatsApp",
      modalidadPago: noches < 2 ? "total" : "anticipo",
      holdMinutos: APARTADO_MIN,
      origen: "whatsapp",
      notas: `Cotización ${folio} del bot de WhatsApp`,
    });
    if (!r.ok || (!r.id && !prueba)) {
      // Se deshace lo apartado en esta vuelta y se le devuelve lo suyo.
      for (const c of creadas) if (UUID_RE.test(c.bookingId)) await updateBooking(c.bookingId, { estado: "expirada" });
      if (previa) await recuperarReservas(previa);
      return {
        ok: false,
        motivo: "sin_lugar",
        error: r.error ?? "Ya no hay disponibilidad para esa combinación.",
      };
    }
    creadas.push({
      slug: h.slug,
      nombre: r.nombreTipo ?? h.slug,
      huespedes: h.huespedes,
      total: r.total ?? 0,
      bookingId: r.id ?? "",
    });
  }

  if (previa) await marcar(previa.folio, "reemplazada");

  const total = creadas.reduce((s, c) => s + c.total, 0);
  const anticipo = anticipoDe(
    creadas.map((c) => c.total),
    noches,
  );
  const apartadoHasta = new Date(Date.now() + APARTADO_MIN * 60_000);
  const [cotizacion] = await db
    .insert(botCotizaciones)
    .values({
      folio,
      chatId: input.chatId,
      telefono: input.telefono,
      nombre,
      email,
      checkin: input.checkin,
      checkout: input.checkout,
      noches,
      huespedes,
      habitaciones: creadas,
      total,
      anticipo,
      saldo: total - anticipo,
      apartadoHasta,
      createdAt: new Date(),
    })
    .returning();

  return {
    ok: true,
    cotizacion,
    resumen: resumenCotizacion(cotizacion),
    ...(previa ? { reemplazo: previa.folio } : {}),
  };
}

/**
 * Modo prueba (probador del panel): el MISMO precio y la MISMA revisión de
 * disponibilidad que una cotización real, pero sin crear la reserva.
 */
async function cotizarSinApartar(
  slug: string,
  huespedes: number,
  checkin: string,
  checkout: string,
  pedidos: Map<string, number>,
): Promise<CreateBookingResult> {
  const tipo = await getRoomTypeBySlug(slug);
  if (!tipo) return { ok: false, error: "Tipo de habitación no encontrado." };
  if (tipo.capacidad < huespedes)
    return { ok: false, error: "Ese tipo de habitación no admite tantos huéspedes." };
  const libres = await getAvailability({ checkin, checkout, huespedes: 1 });
  const disponibles = libres.tipos.find((t) => t.slug === slug)?.disponibles ?? 0;
  const yaPedidos = pedidos.get(slug) ?? 0;
  if (yaPedidos >= disponibles)
    return { ok: false, error: "Ya no hay disponibilidad para esas fechas. Prueba con otras." };
  pedidos.set(slug, yaPedidos + 1);
  return {
    ok: true,
    id: "",
    total: await totalEstancia(tipo, huespedes, checkin, checkout),
    nombreTipo: tipo.nombre,
  };
}

async function existeFolio(folio: string): Promise<boolean> {
  const [f] = await db
    .select({ folio: botCotizaciones.folio })
    .from(botCotizaciones)
    .where(eq(botCotizaciones.folio, folio))
    .limit(1);
  return Boolean(f);
}

async function marcar(folio: string, estado: EstadoCotizacion): Promise<void> {
  await db.update(botCotizaciones).set({ estado }).where(eq(botCotizaciones.folio, folio));
}

/** Libera los cuartos apartados que sigan sin pagar (no toca lo cobrado). */
async function soltarReservas(c: BotCotizacion): Promise<void> {
  for (const h of habitacionesDe(c)) {
    const b = await getBookingById(h.bookingId);
    if (b && b.estadoPago === "iniciado" && b.estado === "pendiente")
      await updateBooking(b.id, { estado: "expirada" });
  }
}

/** Devuelve el apartado a una cotización que se soltó y no se pudo reemplazar. */
async function recuperarReservas(c: BotCotizacion): Promise<void> {
  for (const h of habitacionesDe(c)) {
    const b = await getBookingById(h.bookingId);
    if (b && b.estado === "expirada") await updateBooking(b.id, { estado: "pendiente" });
  }
}

// ── Textos que arma el código ─────────────────────────────────

const MAPA = "https://www.google.com/maps/search/?api=1&query=Hotel+Magic+Collinn+Axtla+de+Terrazas";

export function resumenCotizacion(c: BotCotizacion, ahora = new Date()): string {
  const lineasCuartos = habitacionesDe(c).map(
    (h) => `🛏️ ${h.nombre} (${h.huespedes} ${h.huespedes === 1 ? "persona" : "personas"}): ${formatMXN(h.total)}`,
  );
  const pago =
    c.noches < 2
      ? `✅ *Para apartar: ${formatMXN(c.anticipo)}* (una noche se paga completa)`
      : `✅ *Anticipo para apartar: ${formatMXN(c.anticipo)}* (50%)\n🏨 Resta al llegar: ${formatMXN(c.saldo)}`;
  const banco = datosBancarios();
  const transferir = banco
    ? [
        "Para apartar, transfiere o deposita a:",
        `Banco: ${banco.banco}`,
        `CLABE: ${banco.clabe}`,
        ...(banco.cuenta ? [`Cuenta (para depósito): ${banco.cuenta}`] : []),
        `Titular: ${banco.titular}`,
        `Concepto: ${c.folio}`,
      ].join("\n")
    : "En un momento el equipo del hotel te manda por aquí los datos para transferir.";
  return [
    `*Cotización ${c.folio}* · ${site.name}`,
    `📅 Llegada: ${fechaLarga(c.checkin)} (desde las ${site.checkIn})`,
    `📅 Salida: ${fechaLarga(c.checkout)} (hasta las ${site.checkOut}) · ${c.noches} ${c.noches === 1 ? "noche" : "noches"}`,
    ...lineasCuartos,
    `💰 *Total: ${formatMXN(c.total)}*`,
    pago,
    "",
    transferir,
    "",
    `Te aparto ${habitacionesDe(c).length > 1 ? "los cuartos" : "el cuarto"} hasta *${cuandoVence(c.apartadoHasta, ahora)}*`,
    "Mándame aquí la foto o el PDF del comprobante y te confirmamos.",
  ].join("\n");
}

export function textoConfirmacion(c: BotCotizacion): string {
  return [
    `✅ *¡Reserva confirmada!* Folio ${c.folio}`,
    `Recibimos tu pago de ${formatMXN(c.total - c.saldo)}. Te esperamos el ${fechaLarga(c.checkin, false)} a partir de las ${site.checkIn} (salida el ${fechaLarga(c.checkout, false)} hasta las ${site.checkOut}).`,
    ...(c.saldo > 0 ? [`Resta por pagar al llegar: ${formatMXN(c.saldo)}.`] : []),
    `📍 ${site.address.street}, ${site.address.locality}. Ubicación: ${MAPA}`,
    "Cualquier cosa, aquí estamos. ¡Buen viaje!",
  ].join("\n");
}

/**
 * Quita de la respuesta del modelo las líneas que repiten lo que ya va en el
 * resumen (folio, CLABE, montos): el resumen manda y no debe contradecirse.
 */
export function limpiarEco(texto: string, c: BotCotizacion): string {
  const banco = datosBancarios();
  const montos = [c.total, c.anticipo, c.saldo]
    .filter((n) => n > 0)
    .flatMap((n) => [n.toLocaleString("es-MX"), String(n)]);
  const prohibidos = [c.folio, ...(banco ? [banco.clabe] : []), ...montos];
  return texto
    .split("\n")
    .filter((l) => !prohibidos.some((p) => p && l.includes(p)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Comprobante ───────────────────────────────────────────────

export type ResultadoComprobante = {
  cotizacion: BotCotizacion | null;
  /** El apartado ya había vencido: hay que revisar que el cuarto siga libre. */
  apartadoVencido: boolean;
  cuartoOcupado: boolean;
};

/** Marca el comprobante y alarga el apartado para que Gersay alcance a revisarlo. */
export async function registrarComprobante(
  chatId: string,
  nota: string,
): Promise<ResultadoComprobante> {
  await ensureDb();
  const todas = await cotizacionesDelChat(chatId);
  const c =
    todas.find((x) => x.estado === "vigente" || x.estado === "comprobante") ??
    todas.find((x) => x.estado === "vencida") ??
    null;
  if (!c) return { cotizacion: null, apartadoVencido: false, cuartoOcupado: false };

  const apartadoVencido = c.estado === "vencida";
  let cuartoOcupado = false;
  const hasta = new Date(Date.now() + APARTADO_CON_COMPROBANTE_MIN * 60_000);
  for (const h of habitacionesDe(c)) {
    const b = await getBookingById(h.bookingId);
    if (!b || b.estadoPago !== "iniciado") continue;
    if (apartadoVencido || b.estado !== "pendiente") {
      // Se intenta recuperar el cuarto: solo si nadie lo tomó mientras tanto.
      const ocupados = await occupiedRoomIds(b.checkin, b.checkout, b.id);
      if (ocupados.has(b.roomId)) {
        cuartoOcupado = true;
        continue;
      }
      if (b.estado !== "pendiente") await updateBooking(b.id, { estado: "pendiente" });
    }
    await db.update(bookings).set({ expiraEn: hasta }).where(eq(bookings.id, b.id));
  }

  const [actualizada] = await db
    .update(botCotizaciones)
    .set({
      estado: "comprobante",
      comprobanteEn: new Date(),
      comprobanteNota: nota.slice(0, 500),
      apartadoHasta: hasta,
    })
    .where(eq(botCotizaciones.folio, c.folio))
    .returning();
  return { cotizacion: actualizada ?? c, apartadoVencido, cuartoOcupado };
}

// ── Confirmar / cancelar (lo hace Gersay) ─────────────────────

export type ResultadoConfirmacion =
  | { ok: true; cotizacion: BotCotizacion; reservas: Booking[]; yaEstaba?: boolean }
  | { ok: false; error: string };

export async function confirmarCotizacion(folio: string): Promise<ResultadoConfirmacion> {
  const c = await cotizacionPorFolio(folio);
  if (!c) return { ok: false, error: `No encuentro el folio ${folio.toUpperCase()}.` };
  if (c.estado === "confirmada") {
    const reservas = await reservasDe(c);
    return { ok: true, cotizacion: c, reservas, yaEstaba: true };
  }
  if (c.estado === "reemplazada" || c.estado === "cancelada")
    return { ok: false, error: `El folio ${c.folio} está ${c.estado}; revisa el más reciente de ese huésped.` };

  // Antes de cobrar nada: que ningún cuarto se haya ocupado mientras tanto.
  const reservas = await reservasDe(c);
  for (const b of reservas) {
    const ocupados = await occupiedRoomIds(b.checkin, b.checkout, b.id);
    if (ocupados.has(b.roomId))
      return {
        ok: false,
        error: `El cuarto de ${c.folio} ya se ocupó del ${b.checkin} al ${b.checkout} (el apartado había vencido). Reubícalo a mano desde el panel antes de confirmar.`,
      };
  }
  for (const b of reservas) {
    const r = await updateBooking(b.id, {
      estado: "confirmada",
      montoPagado: b.montoACobrar ?? b.total,
      formaPago: "transferencia",
    });
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo confirmar la reserva." };
  }
  const [confirmada] = await db
    .update(botCotizaciones)
    .set({ estado: "confirmada", confirmadaEn: new Date() })
    .where(eq(botCotizaciones.folio, c.folio))
    .returning();
  return { ok: true, cotizacion: confirmada ?? c, reservas: await reservasDe(c) };
}

export async function cancelarCotizacion(folio: string): Promise<{ ok: boolean; error?: string; cotizacion?: BotCotizacion }> {
  const c = await cotizacionPorFolio(folio);
  if (!c) return { ok: false, error: `No encuentro el folio ${folio.toUpperCase()}.` };
  if (c.estado === "confirmada")
    return { ok: false, error: `${c.folio} ya está confirmada y pagada; cancélala desde el panel (Reservas).` };
  await soltarReservas(c);
  await marcar(c.folio, "cancelada");
  return { ok: true, cotizacion: { ...c, estado: "cancelada" } };
}

async function reservasDe(c: BotCotizacion): Promise<Booking[]> {
  // Las cotizaciones del probador no tienen reservas (bookingId vacío).
  const ids = habitacionesDe(c).map((h) => h.bookingId).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return [];
  return db.select().from(bookings).where(inArray(bookings.id, ids));
}

/** Para el contexto del modelo: en qué va la plática con este huésped. */
export function etapaDe(c: BotCotizacion | null, ahora = new Date()): string {
  if (!c) return "nuevo (todavía sin cotización)";
  switch (c.estado) {
    case "vigente":
      return `cotización ${c.folio} apartada, esperando su comprobante de transferencia (el apartado vence ${cuandoVence(c.apartadoHasta, ahora)}); ${c.checkin} a ${c.checkout}, ${c.huespedes} personas, total ${formatMXN(c.total)}, anticipo ${formatMXN(c.anticipo)}`;
    case "comprobante":
      return `ya mandó comprobante de ${c.folio}; el equipo lo está revisando para confirmar`;
    case "confirmada":
      return `reserva ${c.folio} CONFIRMADA (${c.checkin} a ${c.checkout}); resta ${formatMXN(c.saldo)} al llegar`;
    case "vencida":
      return `su cotización ${c.folio} venció sin comprobante (${c.checkin} a ${c.checkout}); si sigue interesado hay que volver a consultar y cotizar`;
    default:
      return "nuevo (todavía sin cotización vigente)";
  }
}

/** Hoy en el hotel; reexportado para que las rutas no importen el motor. */
export { todayISO };
