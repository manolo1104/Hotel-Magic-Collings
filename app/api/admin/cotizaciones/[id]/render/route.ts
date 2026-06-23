import { type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getQuote } from "@/lib/booking/engine";
import { quoteHtml } from "@/lib/admin/render-html";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const q = await getQuote(id);
  if (!q) return new Response("Cotización no encontrada", { status: 404 });
  const forPrint = req.nextUrl.searchParams.get("print") === "1";
  return new Response(quoteHtml(q, { forPrint }), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
