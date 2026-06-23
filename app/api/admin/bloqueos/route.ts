import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { blockDates } from "@/lib/booking/engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  const result = await blockDates({
    roomId: String(body.roomId ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    motivo: body.motivo ? String(body.motivo) : undefined,
    nota: body.nota ? String(body.nota) : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
