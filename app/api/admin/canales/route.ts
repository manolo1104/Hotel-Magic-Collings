import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { listOtaChannels, addOtaChannel } from "@/lib/admin/ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, canales: await listOtaChannels() });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  const result = await addOtaChannel({
    roomId: String(body.roomId ?? ""),
    platform: String(body.platform ?? "booking"),
    icalUrl: String(body.icalUrl ?? ""),
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
