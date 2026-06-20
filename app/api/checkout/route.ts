// ============================================================
// POST /api/checkout — crea la reserva (hold) + preferencia de Mercado Pago.
// Devuelve el initPoint de Checkout Pro para redirigir al huésped.
// Solo activo si MP_ACCESS_TOKEN está configurado.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { createBooking, setMpPreference } from "@/lib/booking/engine";
import { crearPreferencia, pagosActivos } from "@/lib/mp";
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

  const email = body.email ? String(body.email) : undefined;
  const result = await createBooking({
    slug: String(body.slug ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    huespedes: Number(body.huespedes ?? 1),
    nombre: String(body.nombre ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    email,
    modalidadPago: modalidad,
  });

  if (!result.ok || !result.id || result.montoACobrar == null) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "No pudimos crear la reserva." },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
  const etiqueta = modalidad === "anticipo" ? "anticipo 50%" : "pago total";

  try {
    const { preferenceId, initPoint } = await crearPreferencia({
      bookingId: result.id,
      titulo: `Magic Collinn — ${result.nombreTipo ?? "Habitación"} (${etiqueta})`,
      monto: result.montoACobrar,
      baseUrl,
      email,
      nombre: String(body.nombre ?? ""),
    });
    await setMpPreference(result.id, preferenceId);
    return NextResponse.json({ ok: true, bookingId: result.id, initPoint });
  } catch (e) {
    console.error("Error creando preferencia MP:", e);
    return NextResponse.json(
      { ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo o reserva por WhatsApp." },
      { status: 502 },
    );
  }
}
