// ============================================================
// Canales OTA (Booking/Expedia) — importa reservas vía iCal como bloqueos.
// Cada canal mapea 1 cuarto físico. Cada sync REEMPLAZA los bloqueos del canal.
// ============================================================
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { otaChannels, blocks, rooms } from "@/lib/db/schema";
import type { OtaChannel } from "@/lib/db/schema";

export interface IcalEvent {
  start: string; // ISO yyyy-mm-dd
  end: string;
  uid: string;
}

/** Parser mínimo de VEVENTs (fechas all-day, que es lo que exportan las OTAs). */
export function parseIcal(text: string): IcalEvent[] {
  const out: IcalEvent[] = [];
  const parts = text.split("BEGIN:VEVENT");
  for (let i = 1; i < parts.length; i++) {
    const ev = parts[i];
    const start = matchDate(ev, "DTSTART");
    const end = matchDate(ev, "DTEND");
    const uid = (ev.match(/UID:(.+)/)?.[1] ?? "").trim().slice(0, 200);
    if (start && end) out.push({ start, end, uid });
  }
  return out;
}

function matchDate(ev: string, field: string): string | null {
  const m = ev.match(new RegExp(`${field}[^:\\n]*:(\\d{8})`));
  if (!m) return null;
  const r = m[1];
  return `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`;
}

export type OtaChannelView = OtaChannel & { numero: string };

export async function listOtaChannels(): Promise<OtaChannelView[]> {
  await ensureDb();
  const rows = await db
    .select({ ch: otaChannels, numero: rooms.numero })
    .from(otaChannels)
    .leftJoin(rooms, eq(otaChannels.roomId, rooms.id))
    .orderBy(desc(otaChannels.createdAt));
  return rows.map((r) => ({ ...r.ch, numero: r.numero ?? "—" }));
}

export async function addOtaChannel(input: {
  roomId: string;
  platform: string;
  icalUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureDb();
  if (!input.roomId) return { ok: false, error: "Elige un cuarto." };
  if (!/^https?:\/\//.test(input.icalUrl))
    return { ok: false, error: "La URL del calendario no es válida." };
  await db.insert(otaChannels).values({
    roomId: input.roomId,
    platform: input.platform === "expedia" ? "expedia" : "booking",
    icalUrl: input.icalUrl.trim(),
  });
  return { ok: true };
}

export async function deleteOtaChannel(id: string): Promise<{ ok: boolean }> {
  await ensureDb();
  await db.delete(blocks).where(eq(blocks.otaChannelId, id));
  await db.delete(otaChannels).where(eq(otaChannels.id, id));
  return { ok: true };
}

/** Sincroniza un canal: descarga iCal y reemplaza sus bloqueos. Best-effort. */
export async function syncChannel(
  channel: OtaChannel,
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const res = await fetch(channel.icalUrl, {
      headers: { "User-Agent": "MagicCollinn/1.0 (+reservas)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const events = parseIcal(text);

    // Reemplazo total de los bloqueos de este canal (idempotente)
    await db.delete(blocks).where(eq(blocks.otaChannelId, channel.id));
    if (events.length > 0) {
      await db.insert(blocks).values(
        events.map((e) => ({
          roomId: channel.roomId,
          checkin: e.start,
          checkout: e.end,
          motivo: "ota",
          origen: channel.platform,
          otaChannelId: channel.id,
          uid: e.uid,
          nota: `Reserva ${channel.platform}`,
        })),
      );
    }
    await db
      .update(otaChannels)
      .set({ lastSync: new Date(), lastStatus: "ok", blocksFound: events.length })
      .where(eq(otaChannels.id, channel.id));
    return { ok: true, count: events.length };
  } catch (e) {
    await db
      .update(otaChannels)
      .set({ lastSync: new Date(), lastStatus: "error" })
      .where(eq(otaChannels.id, channel.id));
    return { ok: false, count: 0, error: String(e) };
  }
}

export async function syncAllChannels(): Promise<{ canales: number; bloqueos: number; errores: number }> {
  await ensureDb();
  const channels = await db.select().from(otaChannels).where(eq(otaChannels.activo, true));
  let bloqueos = 0;
  let errores = 0;
  for (const ch of channels) {
    const r = await syncChannel(ch);
    bloqueos += r.count;
    if (!r.ok) errores++;
  }
  return { canales: channels.length, bloqueos, errores };
}
