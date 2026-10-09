// ============================================================
// TEMPORADAS — acceso a datos (la aritmética vive en temporadas-calc.ts)
// ============================================================
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { seasons, roomTypes } from "@/lib/db/schema";
import { diasEntre, esFechaValida } from "./temporadas-calc";
import type { Temporada, TemporadaInput, TemporadaView } from "./temporadas-calc";

export * from "./temporadas-calc";

// ── Lectura ─────────────────────────────────────────────────
function aTemporada(fila: typeof seasons.$inferSelect): Temporada {
  return {
    id: fila.id,
    nombre: fila.nombre,
    desde: fila.desde,
    hasta: fila.hasta,
    roomTypeId: fila.roomTypeId,
    tipoAjuste: fila.tipoAjuste === "precio" ? "precio" : "porcentaje",
    valor: fila.valor,
    activa: fila.activa,
  };
}

/**
 * Temporadas ACTIVAS, de la más reciente a la más antigua. Es la lista que
 * espera `temporadaDeNoche`, y la que se carga una sola vez por cotización.
 */
export async function temporadasVigentes(): Promise<Temporada[]> {
  await ensureDb();
  const filas = await db
    .select()
    .from(seasons)
    .where(eq(seasons.activa, true))
    .orderBy(desc(seasons.createdAt));
  return filas.map(aTemporada);
}

/** Todas, activas o no, con el nombre de la categoría. Para el panel. */
export async function listarTemporadas(): Promise<TemporadaView[]> {
  await ensureDb();
  const [filas, tipos] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.desde)),
    db.select().from(roomTypes),
  ]);
  return filas.map((f) => ({
    ...aTemporada(f),
    nombreTipo:
      tipos.find((t) => t.id === f.roomTypeId)?.nombre ?? "Todas las habitaciones",
    noches: diasEntre(f.desde, f.hasta) + 1,
  }));
}

// ── Escritura ───────────────────────────────────────────────
export interface Resultado {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Valida lo que llega del panel. Devuelve el mensaje de error o null.
 * Se valida aquí y no solo en el formulario porque la API es pública: un POST
 * a mano con `valor: -100` dejaría noches gratis.
 */
function validar(input: TemporadaInput): string | null {
  if (!input.nombre?.trim()) return "Ponle un nombre a la temporada.";
  if (input.nombre.trim().length > 60) return "El nombre es demasiado largo.";
  if (!esFechaValida(input.desde) || !esFechaValida(input.hasta))
    return "Las fechas no son válidas.";
  if (input.hasta < input.desde)
    return "La fecha final no puede ser anterior a la inicial.";
  if (diasEntre(input.desde, input.hasta) > 730)
    return "Una temporada no puede durar más de dos años.";
  if (input.tipoAjuste !== "porcentaje" && input.tipoAjuste !== "precio")
    return "Elige si el ajuste es por porcentaje o por precio.";
  if (!Number.isFinite(input.valor)) return "El valor no es un número.";
  if (input.tipoAjuste === "porcentaje") {
    if (input.valor === 0)
      return "Un 0% no cambia nada. Usa un número positivo para subir o negativo para bajar.";
    if (input.valor < -90 || input.valor > 500)
      return "El porcentaje debe estar entre -90% y +500%.";
  } else if (input.valor < 1) {
    return "El precio de la noche debe ser de al menos $1.";
  }
  return null;
}

export async function crearTemporada(input: TemporadaInput): Promise<Resultado> {
  const error = validar(input);
  if (error) return { ok: false, error };
  await ensureDb();
  const [creada] = await db
    .insert(seasons)
    .values({
      nombre: input.nombre.trim(),
      desde: input.desde,
      hasta: input.hasta,
      roomTypeId: input.roomTypeId || null,
      tipoAjuste: input.tipoAjuste,
      valor: Math.round(input.valor),
      activa: input.activa ?? true,
    })
    .returning({ id: seasons.id });
  return { ok: true, id: creada.id };
}

export async function actualizarTemporada(
  id: string,
  cambios: Partial<TemporadaInput>,
): Promise<Resultado> {
  await ensureDb();
  const [actual] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  if (!actual) return { ok: false, error: "Esa temporada ya no existe." };

  // Se valida la temporada COMPLETA tras el cambio, no solo los campos que
  // llegan: mover solo `hasta` puede dejar el rango al revés, y cambiar solo
  // `tipoAjuste` puede dejar un -15 donde ahora se espera un precio.
  const fusion: TemporadaInput = {
    nombre: cambios.nombre ?? actual.nombre,
    desde: cambios.desde ?? actual.desde,
    hasta: cambios.hasta ?? actual.hasta,
    roomTypeId: cambios.roomTypeId !== undefined ? cambios.roomTypeId : actual.roomTypeId,
    tipoAjuste:
      cambios.tipoAjuste ?? (actual.tipoAjuste === "precio" ? "precio" : "porcentaje"),
    valor: cambios.valor ?? actual.valor,
    activa: cambios.activa ?? actual.activa,
  };
  const error = validar(fusion);
  if (error) return { ok: false, error };

  await db
    .update(seasons)
    .set({
      nombre: fusion.nombre.trim(),
      desde: fusion.desde,
      hasta: fusion.hasta,
      roomTypeId: fusion.roomTypeId || null,
      tipoAjuste: fusion.tipoAjuste,
      valor: Math.round(fusion.valor),
      activa: fusion.activa ?? true,
    })
    .where(eq(seasons.id, id));
  return { ok: true, id };
}

/**
 * Borra una temporada. No toca ninguna reserva: el precio se congela en
 * `bookings.total` cuando se reserva, así que quitar la temporada cambia lo
 * que se cobrará de hoy en adelante, nunca lo ya vendido.
 */
export async function borrarTemporada(id: string): Promise<Resultado> {
  await ensureDb();
  const borradas = await db.delete(seasons).where(eq(seasons.id, id)).returning({ id: seasons.id });
  if (borradas.length === 0) return { ok: false, error: "Esa temporada ya no existe." };
  return { ok: true, id };
}

/** Enciende o apaga una temporada sin borrarla (para repetirla el año que viene). */
export async function alternarTemporada(id: string, activa: boolean): Promise<Resultado> {
  await ensureDb();
  const cambiadas = await db
    .update(seasons)
    .set({ activa })
    .where(eq(seasons.id, id))
    .returning({ id: seasons.id });
  if (cambiadas.length === 0) return { ok: false, error: "Esa temporada ya no existe." };
  return { ok: true, id };
}
