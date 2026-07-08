import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getQuote, updateQuote } from "@/lib/booking/engine";
import { enviarCotizacion } from "@/lib/email/cotizacion";
import { correosActivos } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!correosActivos())
    return NextResponse.json(
      { ok: false, error: "El correo no está configurado (RESEND_API_KEY)." },
      { status: 503 },
    );
  const { id } = await params;
  const q = await getQuote(id);
  if (!q) return NextResponse.json({ ok: false, error: "Cotización no encontrada." }, { status: 404 });
  if (!q.email)
    return NextResponse.json(
      { ok: false, error: "La cotización no tiene correo del cliente." },
      { status: 400 },
    );
  const sent = await enviarCotizacion(q);
  if (sent) await updateQuote(id, { estado: "enviada" });
  return NextResponse.json(
    sent ? { ok: true } : { ok: false, error: "No se pudo enviar el correo." },
    { status: sent ? 200 : 502 },
  );
}
