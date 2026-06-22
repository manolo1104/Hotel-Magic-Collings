import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getBookingById } from "@/lib/booking/engine";
import { enviarCorreosReserva } from "@/lib/email/reservas";
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
  const b = await getBookingById(id);
  if (!b) return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });
  if (!b.email)
    return NextResponse.json(
      { ok: false, error: "Esta reserva no tiene correo del huésped." },
      { status: 400 },
    );
  await enviarCorreosReserva(b);
  return NextResponse.json({ ok: true });
}
