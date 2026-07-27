import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { listBookings, createManualBooking } from "@/lib/booking/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const reservas = await listBookings();
  return NextResponse.json({ ok: true, reservas });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  const result = await createManualBooking({
    slug: String(body.slug ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    huespedes: Number(body.huespedes ?? 1),
    nombre: String(body.nombre ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    email: body.email ? String(body.email) : undefined,
    total: body.total != null && body.total !== "" ? Number(body.total) : undefined,
    montoPagado:
      body.montoPagado != null && body.montoPagado !== ""
        ? Number(body.montoPagado)
        : undefined,
    notas: body.notas ? String(body.notas) : undefined,
    origen: body.origen ? String(body.origen) : undefined,
    nosConociste: body.nosConociste ? String(body.nosConociste) : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
