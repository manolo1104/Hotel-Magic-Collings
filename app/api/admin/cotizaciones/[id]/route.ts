import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { updateQuote } from "@/lib/booking/engine";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await updateQuote(id, body ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
