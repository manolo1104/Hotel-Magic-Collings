import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { blockDates, unblockDay, unblockRange } from "@/lib/booking/engine";

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

/**
 * Abre fechas cerradas. Dos formas, según lo que traiga el cuerpo:
 *   · `{ roomId, fecha }`            → libera UN día suelto (clic en el calendario).
 *   · `{ roomId?, checkin, checkout }` → abre un RANGO entero; sin `roomId`, en
 *     todos los cuartos. Es el reverso del formulario "Bloquear fechas".
 *
 * Distinto de DELETE /api/admin/bloqueos/[id], que borra un bloqueo concreto de
 * la lista "Bloqueos del mes".
 */
export async function DELETE(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  if (body.checkin || body.checkout) {
    const result = await unblockRange({
      roomId: body.roomId ? String(body.roomId) : undefined,
      checkin: String(body.checkin ?? ""),
      checkout: String(body.checkout ?? ""),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const result = await unblockDay({
    roomId: String(body.roomId ?? ""),
    fecha: String(body.fecha ?? ""),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
