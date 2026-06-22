import { type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getBookingView } from "@/lib/booking/engine";
import { bookingHtml } from "@/lib/admin/render-html";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const view = await getBookingView(id);
  if (!view) return new Response("Reserva no encontrada", { status: 404 });

  const forPrint = req.nextUrl.searchParams.get("print") === "1";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const html = bookingHtml(view, { forPrint });
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
  };
  if (download)
    headers["Content-Disposition"] = `attachment; filename="reserva-${id.slice(0, 8)}.html"`;
  return new Response(html, { headers });
}
