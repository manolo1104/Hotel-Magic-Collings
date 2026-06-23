import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getCalendarMonth, getGanttBookings } from "@/lib/booking/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year = Number(sp.get("year")) || now.getFullYear();
  const month = Number(sp.get("month")) || now.getMonth() + 1;

  const calendar = await getCalendarMonth(year, month);
  const first = calendar.days[0];
  const afterLast =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const gantt = await getGanttBookings(first, afterLast);
  return NextResponse.json({ ok: true, calendar, gantt });
}
