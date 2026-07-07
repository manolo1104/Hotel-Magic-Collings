import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getCleaningToday, saveChecklistResult } from "@/lib/admin/operations";
import { UUID_RE } from "@/lib/booking/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const fecha =
    req.nextUrl.searchParams.get("fecha") ||
    new Date().toLocaleDateString("en-CA");
  return NextResponse.json({ ok: true, fecha, cuartos: await getCleaningToday(fecha) });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.roomId || !body?.fecha)
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  const roomId = String(body.roomId);
  const fecha = String(body.fecha);
  if (!UUID_RE.test(roomId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  const result = await saveChecklistResult({
    roomId,
    fecha,
    itemsCompletados: Array.isArray(body.itemsCompletados)
      ? (body.itemsCompletados as string[])
      : [],
    totalItems: Number(body.totalItems ?? 0),
    personal: body.personal ? String(body.personal) : undefined,
    observaciones: body.observaciones ? String(body.observaciones) : undefined,
  });
  return NextResponse.json(result);
}
