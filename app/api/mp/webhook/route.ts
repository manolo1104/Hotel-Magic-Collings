// ============================================================
// POST /api/mp/webhook — notificación de Mercado Pago (FUENTE DE VERDAD).
// No confía en el payload: consulta el pago por id con el SDK autenticado.
// Idempotente: confirma una sola vez, dispara correos + push a Kora una vez.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { obtenerPago } from "@/lib/mp";
import {
  confirmarPago,
  marcarPagoRechazado,
  marcarEmailsEnviados,
  marcarKoraPushed,
} from "@/lib/booking/engine";
import { enviarCorreosReserva } from "@/lib/email/reservas";
import { pushLeadToKora } from "@/lib/kora";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const body = (await req.json().catch(() => null)) as
      | { type?: string; topic?: string; data?: { id?: string | number }; id?: string | number }
      | null;

    // El "tipo" llega por query (?type= / ?topic=) o en el body
    const tipo =
      url.searchParams.get("type") ??
      url.searchParams.get("topic") ??
      body?.type ??
      body?.topic;
    if (tipo && tipo !== "payment") {
      return NextResponse.json({ ok: true, ignored: tipo });
    }

    // El id del pago llega por query (?data.id= / ?id=) o en el body
    const paymentId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      (body?.data?.id != null ? String(body.data.id) : null) ??
      (body?.id != null ? String(body.id) : null);
    if (!paymentId) {
      return NextResponse.json({ ok: true, note: "sin payment id" });
    }

    const pago = await obtenerPago(String(paymentId));
    if (!pago.bookingId) {
      return NextResponse.json({ ok: true, note: "sin external_reference" });
    }

    if (pago.status === "approved") {
      const { changed, booking } = await confirmarPago({
        bookingId: pago.bookingId,
        paymentId: pago.paymentId,
        mpStatus: pago.status,
        montoPagado: pago.monto,
      });
      // Efectos secundarios SOLO en la transición real (exactamente una vez)
      if (changed && booking) {
        await Promise.allSettled([
          enviarCorreosReserva(booking).then(() => marcarEmailsEnviados(booking.id)),
          pushLeadToKora(booking).then((ok) => (ok ? marcarKoraPushed(booking.id) : undefined)),
        ]);
      }
    } else if (pago.status === "rejected" || pago.status === "cancelled") {
      // Libera el cuarto (no toca reservas ya pagadas)
      await marcarPagoRechazado(pago.bookingId, pago.paymentId, pago.status);
    }
    // pending / in_process → aún no se confirma (esperamos otra notificación)

    return NextResponse.json({ ok: true });
  } catch (e) {
    // 200 + log: evita reintentos infinitos de MP por errores no recuperables.
    console.error("Webhook MP error:", e);
    return NextResponse.json({ ok: true });
  }
}
