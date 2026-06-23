import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { getCleaningToday, saveChecklistResult } from "@/lib/admin/operations";

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
  const result = await saveChecklistResult({
    roomId: String(body.roomId),
    fecha: String(body.fecha),
    itemsCompletados: Array.isArray(body.itemsCompletados)
      ? (body.itemsCompletados as string[])
      : [],
    totalItems: Number(body.totalItems ?? 0),
    personal: body.personal ? String(body.personal) : undefined,
    observaciones: body.observaciones ? String(body.observaciones) : undefined,
  });
  return NextResponse.json(result);
}
