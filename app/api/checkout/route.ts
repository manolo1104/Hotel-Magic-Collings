// ============================================================
// POST /api/checkout — crea la reserva (hold) para el pago embebido.
// Devuelve el monto a cobrar; el cobro lo hace /api/pagar con el Brick.
// Solo activo si MP_ACCESS_TOKEN está configurado.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { createBooking } from "@/lib/booking/engine";
import { pagosActivos } from "@/lib/mp";
import type { ModalidadPago } from "@/lib/booking/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!pagosActivos()) {
    return NextResponse.json(
      { ok: false, error: "El pago en línea no está disponible por ahora." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const modalidad = body.modalidadPago as ModalidadPago;
  if (modalidad !== "total" && modalidad !== "anticipo") {
    return NextResponse.json({ ok: false, error: "Elige cómo quieres pagar." }, { status: 400 });
  }

  const result = await createBooking({
    slug: String(body.slug ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    huespedes: Number(body.huespedes ?? 1),
    nombre: String(body.nombre ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    email: body.email ? String(body.email) : undefined,
    modalidadPago: modalidad,
  });

  if (!result.ok || !result.id || result.montoACobrar == null) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "No pudimos crear la reserva." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.id,
    montoACobrar: result.montoACobrar,
    total: result.total,
    saldoPendiente: result.saldoPendiente,
    nombreTipo: result.nombreTipo,
  });
}
