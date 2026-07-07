import type { Metadata } from "next";
import { getCalendarMonth, getGanttBookings } from "@/lib/booking/engine";
import { CalendarioClient } from "@/components/admin/CalendarioClient";

export const metadata: Metadata = { title: "Calendario", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  // Mes/año por defecto en la zona del hotel (no la del servidor/UTC en Vercel).
  const [year, month] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })
    .split("-")
    .map(Number);
  const calendar = await getCalendarMonth(year, month);
  const afterLast =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const gantt = await getGanttBookings(calendar.days[0], afterLast);
  return <CalendarioClient initialCalendar={calendar} initialGantt={gantt} />;
}
