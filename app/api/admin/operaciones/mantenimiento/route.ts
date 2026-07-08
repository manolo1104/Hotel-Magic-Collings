import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import {
  getMaintenanceTasks,
  markMaintenanceDone,
  addMaintenanceTask,
} from "@/lib/admin/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, tareas: await getMaintenanceTasks() });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  if (body.action === "add") {
    const result = await addMaintenanceTask({
      ambito: String(body.ambito ?? "hotel"),
      tarea: String(body.tarea ?? ""),
      frecuenciaDias: Number(body.frecuenciaDias ?? 30),
    });
    return NextResponse.json(result, { status: result.ok ? 201 : 400 });
  }
  const result = await markMaintenanceDone(
    String(body.id ?? ""),
    body.responsable ? String(body.responsable) : undefined,
  );
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.notFound ? 404 : 400,
  });
}
