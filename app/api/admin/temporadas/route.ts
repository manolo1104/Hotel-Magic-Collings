import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import {
  crearTemporada,
  listarTemporadas,
  type TipoAjuste,
} from "@/lib/booking/temporadas";

export const runtime = "nodejs";

export async function GET() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, temporadas: await listarTemporadas() });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  const result = await crearTemporada({
    nombre: String(body.nombre ?? ""),
    desde: String(body.desde ?? ""),
    hasta: String(body.hasta ?? ""),
    roomTypeId: body.roomTypeId ? String(body.roomTypeId) : null,
    tipoAjuste: String(body.tipoAjuste ?? "porcentaje") as TipoAjuste,
    valor: Number(body.valor),
    activa: body.activa == null ? true : Boolean(body.activa),
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
