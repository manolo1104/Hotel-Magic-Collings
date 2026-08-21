import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { hideGuest } from "@/lib/booking/engine";

export const runtime = "nodejs";

/**
 * Elimina la ficha de un cliente de /clientes SIN tocar sus reservas: la ficha
 * no es una fila propia, se arma sumando las reservas del mismo correo.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { email } = await params;
  const result = await hideGuest(decodeURIComponent(email));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
