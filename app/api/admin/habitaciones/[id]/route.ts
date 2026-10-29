import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { actualizarHabitacion } from "@/lib/booking/habitaciones";

export const runtime = "nodejs";

/** Guarda precios por persona, fotos (la primera es la portada), camas y descripción. */
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

  const result = await actualizarHabitacion(id, {
    precios: body.precios,
    fotos: body.fotos,
    camas: body.camas,
    descripcion: body.descripcion,
  });
  if (result.ok) {
    // Portada y /habitaciones son ISR (10 min): sin esto el huésped seguiría
    // viendo el precio viejo hasta que caduque la caché.
    revalidatePath("/", "layout");
    revalidatePath("/llms.txt");
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
