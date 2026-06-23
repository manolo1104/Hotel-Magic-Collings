import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { convertQuoteToBooking } from "@/lib/booking/engine";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const result = await convertQuoteToBooking(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
