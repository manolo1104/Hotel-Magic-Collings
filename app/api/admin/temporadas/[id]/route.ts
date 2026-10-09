import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import {
  actualizarTemporada,
  borrarTemporada,
  type TemporadaInput,
  type TipoAjuste,
} from "@/lib/booking/temporadas";

export const runtime = "nodejs";

/**
 * Edita una temporada. Sirve igual para el interruptor de "activa" (manda solo
 * ese campo) que para guardar el formulario entero.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  // Solo viajan los campos presentes: así un PATCH de `{activa:false}` no
  // borra el nombre ni mueve las fechas.
  const cambios: Partial<TemporadaInput> = {};
  if (body.nombre != null) cambios.nombre = String(body.nombre);
  if (body.desde != null) cambios.desde = String(body.desde);
  if (body.hasta != null) cambios.hasta = String(body.hasta);
  if ("roomTypeId" in body) cambios.roomTypeId = body.roomTypeId ? String(body.roomTypeId) : null;
  if (body.tipoAjuste != null) cambios.tipoAjuste = String(body.tipoAjuste) as TipoAjuste;
  if (body.valor != null) cambios.valor = Number(body.valor);
  if (body.activa != null) cambios.activa = Boolean(body.activa);

  const result = await actualizarTemporada(id, cambios);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const result = await borrarTemporada(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
