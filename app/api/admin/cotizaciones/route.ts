import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { listQuotes, createQuote } from "@/lib/booking/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, cotizaciones: await listQuotes() });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  const result = await createQuote({
    cliente: String(body.cliente ?? ""),
    telefono: String(body.telefono ?? ""),
    email: body.email ? String(body.email) : undefined,
    slug: String(body.slug ?? ""),
    checkin: String(body.checkin ?? ""),
    checkout: String(body.checkout ?? ""),
    huespedes: Number(body.huespedes ?? 1),
    precioTotal:
      body.precioTotal != null && body.precioTotal !== ""
        ? Number(body.precioTotal)
        : undefined,
    notas: body.notas ? String(body.notas) : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
