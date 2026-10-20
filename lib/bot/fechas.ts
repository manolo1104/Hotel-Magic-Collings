// ============================================================
// FECHAS DEL BOT — siempre la hora del HOTEL, nunca la del servidor
// Vercel corre en UTC: sin `site.timeZone` el bot creería que ya es mañana
// desde las 18:00 de Axtla (el mismo error que arregló 5615e3a en el motor).
// Las fechas ISO (AAAA-MM-DD) se operan a mediodía UTC para que ningún
// cambio de horario mueva el día.
// ============================================================
import { site } from "../site";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function aFecha(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** Suma (o resta) días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);
}

export function esIso(s: unknown): s is string {
  return typeof s === "string" && ISO_RE.test(s) && !Number.isNaN(aFecha(s).getTime());
}

/** "2027-01-16" → "sábado 16 de enero de 2027". */
export function fechaLarga(iso: string, conAnio = true): string {
  return aFecha(iso).toLocaleDateString("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(conAnio ? { year: "numeric" } : {}),
  }).replace(",", "");
}

/** "2027-01-16" → "vie 16 ene". */
export function fechaCorta(iso: string): string {
  return aFecha(iso)
    .toLocaleDateString("es-MX", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .replace(/\./g, "");
}

/** Hora del hotel para un instante: "5:05 p.m.". */
export function horaHotel(d: Date): string {
  return d
    .toLocaleTimeString("es-MX", {
      timeZone: site.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s+/g, " ")
    .replace(/a\.\s?m\./i, "a.m.")
    .replace(/p\.\s?m\./i, "p.m.");
}

/** Fecha ISO del hotel para un instante. */
export function isoHotel(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: site.timeZone });
}

/** "hoy a las 5:05 p.m." / "mañana a las 9:00 a.m." / "el sáb 17 ene a las …". */
export function cuandoVence(d: Date, ahora = new Date()): string {
  const dia = isoHotel(d);
  const hoy = isoHotel(ahora);
  const hora = horaHotel(d);
  // "a la 1:30", pero "a las 2:30": la una es singular.
  const a = `${hora.startsWith("1:") ? "a la" : "a las"} ${hora}`;
  if (dia === hoy) return `hoy ${a}`;
  if (dia === sumarDias(hoy, 1)) return `mañana ${a}`;
  return `el ${fechaCorta(dia)} ${a}`;
}

/** "martes 20 de octubre de 2026, 2:05 p.m." — para el contexto del modelo. */
export function ahoraEnElHotel(ahora = new Date()): string {
  return `${fechaLarga(isoHotel(ahora))}, ${horaHotel(ahora)}`;
}
