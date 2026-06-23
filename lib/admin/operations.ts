// ============================================================
// Operaciones: limpieza diaria + mantenimiento preventivo (Drizzle)
// ============================================================
import { and, eq, gt, lte, ne, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { rooms, roomTypes, bookings, cleaningLog, maintenanceTasks } from "@/lib/db/schema";
import { maintenanceSeed } from "./cleaning-config";

function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA");
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

// ── Limpieza ────────────────────────────────────────────────
export interface CleaningRoom {
  roomId: string;
  numero: string;
  tipo: string;
  ocupado: boolean;
  saleHoy: boolean;
  estado: string; // pendiente | en_proceso | completo
  itemsCompletados: string[];
  personal: string;
  observaciones: string;
}

export async function getCleaningToday(fecha: string): Promise<CleaningRoom[]> {
  await ensureDb();
  const [roomsRows, enCasa, salidas, logRows] = await Promise.all([
    db
      .select({ id: rooms.id, numero: rooms.numero, tipo: roomTypes.nombre })
      .from(rooms)
      .leftJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.activa, true))
      .orderBy(asc(rooms.numero)),
    db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(
        and(
          ne(bookings.estado, "cancelada"),
          ne(bookings.estado, "expirada"),
          lte(bookings.checkin, fecha),
          gt(bookings.checkout, fecha),
        ),
      ),
    db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(and(ne(bookings.estado, "cancelada"), eq(bookings.checkout, fecha))),
    db.select().from(cleaningLog).where(eq(cleaningLog.fecha, fecha)),
  ]);

  const ocupados = new Set(enCasa.map((b) => b.roomId));
  const saleSet = new Set(salidas.map((s) => s.roomId));
  const logByRoom = new Map(logRows.map((l) => [l.roomId, l]));

  return roomsRows.map((r) => {
    const log = logByRoom.get(r.id);
    return {
      roomId: r.id,
      numero: r.numero,
      tipo: r.tipo ?? "—",
      ocupado: ocupados.has(r.id),
      saleHoy: saleSet.has(r.id),
      estado: log?.estado ?? "pendiente",
      itemsCompletados: log?.itemsCompletados ?? [],
      personal: log?.personal ?? "",
      observaciones: log?.observaciones ?? "",
    };
  });
}

export async function saveChecklistResult(input: {
  roomId: string;
  fecha: string;
  itemsCompletados: string[];
  totalItems: number;
  personal?: string;
  observaciones?: string;
}): Promise<{ ok: boolean }> {
  await ensureDb();
  const completo =
    input.totalItems > 0 && input.itemsCompletados.length >= input.totalItems;
  const estado = completo
    ? "completo"
    : input.itemsCompletados.length > 0
      ? "en_proceso"
      : "pendiente";
  const [existing] = await db
    .select({ id: cleaningLog.id })
    .from(cleaningLog)
    .where(and(eq(cleaningLog.roomId, input.roomId), eq(cleaningLog.fecha, input.fecha)))
    .limit(1);
  const values = {
    itemsCompletados: input.itemsCompletados,
    personal: input.personal ?? "",
    observaciones: input.observaciones ?? "",
    estado,
    completadoEn: completo ? new Date() : null,
  };
  if (existing) {
    await db.update(cleaningLog).set(values).where(eq(cleaningLog.id, existing.id));
  } else {
    await db
      .insert(cleaningLog)
      .values({ roomId: input.roomId, fecha: input.fecha, ...values });
  }
  return { ok: true };
}

// ── Mantenimiento ───────────────────────────────────────────
export interface MaintTask {
  id: string;
  ambito: string;
  tarea: string;
  frecuenciaDias: number;
  ultimaVez: string | null;
  proximaVez: string | null;
  responsable: string;
  notas: string;
  overdue: boolean;
  diasRestantes: number | null;
}

export async function getMaintenanceTasks(): Promise<MaintTask[]> {
  await ensureDb();
  let rows = await db.select().from(maintenanceTasks).orderBy(asc(maintenanceTasks.proximaVez));
  if (rows.length === 0) {
    const roomsRows = await db
      .select({ numero: rooms.numero })
      .from(rooms)
      .where(eq(rooms.activa, true))
      .orderBy(asc(rooms.numero));
    const seed = maintenanceSeed(roomsRows.map((r) => r.numero));
    const hoy = hoyISO();
    await db.insert(maintenanceTasks).values(
      seed.map((s) => ({
        ambito: s.ambito,
        tarea: s.tarea,
        frecuenciaDias: s.frecuenciaDias,
        proximaVez: hoy,
      })),
    );
    rows = await db.select().from(maintenanceTasks).orderBy(asc(maintenanceTasks.proximaVez));
  }
  const hoy = hoyISO();
  const hoyMs = new Date(`${hoy}T12:00:00`).getTime();
  return rows.map((t) => {
    const overdue = t.proximaVez != null && t.proximaVez < hoy;
    const diasRestantes = t.proximaVez
      ? Math.round((new Date(`${t.proximaVez}T12:00:00`).getTime() - hoyMs) / 86_400_000)
      : null;
    return {
      id: t.id,
      ambito: t.ambito,
      tarea: t.tarea,
      frecuenciaDias: t.frecuenciaDias,
      ultimaVez: t.ultimaVez,
      proximaVez: t.proximaVez,
      responsable: t.responsable,
      notas: t.notas,
      overdue,
      diasRestantes,
    };
  });
}

export async function markMaintenanceDone(
  id: string,
  responsable?: string,
): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  const [t] = await db.select().from(maintenanceTasks).where(eq(maintenanceTasks.id, id)).limit(1);
  if (!t) return { ok: false, error: "Tarea no encontrada." };
  const hoy = hoyISO();
  await db
    .update(maintenanceTasks)
    .set({
      ultimaVez: hoy,
      proximaVez: addDays(hoy, t.frecuenciaDias),
      responsable: responsable?.trim() || t.responsable,
    })
    .where(eq(maintenanceTasks.id, id));
  return { ok: true };
}

export async function addMaintenanceTask(input: {
  ambito: string;
  tarea: string;
  frecuenciaDias: number;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  if (!input.tarea?.trim()) return { ok: false, error: "Escribe la tarea." };
  await db.insert(maintenanceTasks).values({
    ambito: input.ambito?.trim() || "hotel",
    tarea: input.tarea.trim(),
    frecuenciaDias: Math.max(1, Math.floor(input.frecuenciaDias) || 30),
    proximaVez: hoyISO(),
  });
  return { ok: true };
}
