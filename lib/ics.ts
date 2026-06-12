// ============================================================
// Generador de archivo de calendario (.ics) para la reserva.
// Evento de día completo: DTSTART = llegada, DTEND = salida
// (exclusivo, que es justo como funciona una estancia de hotel).
// ============================================================
import { site } from "./site";

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function dateBasic(iso: string): string {
  // yyyy-mm-dd -> yyyymmdd
  return iso.replaceAll("-", "");
}

export function bookingIcs({
  ref,
  checkin,
  checkout,
}: {
  ref: string;
  checkin: string;
  checkout: string;
}): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const host = new URL(site.url).host;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${site.legalName}//Reservas//ES`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ref}@${host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateBasic(checkin)}`,
    `DTEND;VALUE=DATE:${dateBasic(checkout)}`,
    `SUMMARY:${esc(`Estancia en ${site.legalName} (${ref})`)}`,
    `LOCATION:${esc(`${site.address.street}, ${site.address.locality}, ${site.address.region}, México`)}`,
    `DESCRIPTION:${esc(`Reserva ${ref}. Se confirma por WhatsApp y el pago es en el hotel. ${site.url}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
