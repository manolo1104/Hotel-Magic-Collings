// ============================================================
// POST /api/pagar — procesa el pago embebido (Bricks) de una reserva.
// Recibe el formData del Payment Brick (token de tarjeta) y cobra el monto.
// Si se aprueba, confirma la reserva y dispara correos + push a Kora.
// El webhook /api/mp/webhook queda como respaldo para pagos asíncronos.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { procesarPago, pagosActivos, type BrickFormData } from "@/lib/mp";
import {
  getBookingById,
  confirmarPago,
  marcarEmailsEnviados,
  marcarKoraPushed,
} from "@/lib/booking/engine";
import { enviarCorreosReserva } from "@/lib/email/reservas";
import { pushLeadToKora } from "@/lib/kora";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!pagosActivos()) {
    return NextResponse.json(
      { ok: false, error: "El pago en línea no está disponible." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { bookingId?: string; formData?: BrickFormData }
    | null;
  if (!body?.bookingId || !body?.formData) {
    return NextResponse.json({ ok: false, error: "Datos de pago incompletos." }, { status: 400 });
  }

  const booking = await getBookingById(String(body.bookingId));
  if (!booking) {
    return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });
  }
  if (booking.estadoPago === "pagado") {
    return NextResponse.json({ ok: true, status: "approved", yaPagado: true });
  }

  const monto = booking.montoACobrar ?? booking.total;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
  const ref = booking.id.slice(0, 8).toUpperCase();

  try {
    const pago = await procesarPago({
      bookingId: booking.id,
      monto,
      descripcion: `Hotel Magic Collinn — reserva ${ref}`,
      baseUrl,
      formData: body.formData,
    });

    if (pago.status === "approved") {
      const { changed, booking: fresh } = await confirmarPago({
        bookingId: booking.id,
        paymentId: pago.paymentId,
        mpStatus: pago.status,
        montoPagado: pago.monto,
      });
      if (changed && fresh) {
        await Promise.allSettled([
          enviarCorreosReserva(fresh).then(() => marcarEmailsEnviados(fresh.id)),
          pushLeadToKora(fresh).then((ok) => (ok ? marcarKoraPushed(fresh.id) : undefined)),
        ]);
      }
      return NextResponse.json({ ok: true, status: "approved", paymentId: pago.paymentId });
    }

    if (pago.status === "rejected" || pago.status === "cancelled") {
      // No se cancela la reserva: el huésped puede reintentar con otra tarjeta.
      return NextResponse.json({
        ok: false,
        status: pago.status,
        error: "El pago fue rechazado. Revisa los datos o intenta con otra tarjeta.",
      });
    }

    // in_process / pending (revisión, OXXO…): el webhook confirmará al acreditarse.
    return NextResponse.json({
      ok: true,
      status: pago.status,
      paymentId: pago.paymentId,
      pendiente: true,
    });
  } catch (e) {
    console.error("Error procesando pago:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos procesar el pago. Intenta de nuevo." },
      { status: 502 },
    );
  }
}
