import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { saveGuestNote } from "@/lib/booking/engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { email?: string; notas?: string }
    | null;
  if (!body?.email)
    return NextResponse.json({ ok: false, error: "Falta el correo." }, { status: 400 });
  await saveGuestNote(String(body.email), String(body.notas ?? ""));
  return NextResponse.json({ ok: true });
}
