import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { guardarFoto } from "@/lib/booking/habitaciones";

export const runtime = "nodejs";

/** Sube UNA foto (campo `foto`, ya reducida por el navegador) y devuelve su URL. */
export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("foto");
  if (!(archivo instanceof File))
    return NextResponse.json({ ok: false, error: "No llegó ninguna foto." }, { status: 400 });

  const result = await guardarFoto(Buffer.from(await archivo.arrayBuffer()));
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
