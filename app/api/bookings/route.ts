import { NextResponse, type NextRequest } from "next/server";
import { createBooking } from "@/lib/booking/engine";
import type { CreateBookingInput } from "@/lib/booking/types";

export const runtime = "nodejs";

// Crea una reserva en estado "pendiente" y asigna un cuarto físico libre.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CreateBookingInput | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const result = await createBooking({
    slug: String(body.slug ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    huespedes: Number(body.huespedes ?? 1),
    nombre: String(body.nombre ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    email: body.email ? String(body.email) : undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
