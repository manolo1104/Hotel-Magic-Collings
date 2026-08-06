// ============================================================
// API del panel para el channel manager (Beds24 ↔ Booking.com).
//   GET  → estado + habitaciones de la cuenta de Beds24 para emparejar
//   POST → { accion: "emparejar" | "sincronizar" }
// Protegida por la sesión de /admin, igual que el resto del panel.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import {
  emparejar,
  estadoBeds24,
  habitacionesDisponibles,
  sincronizarBeds24,
} from "@/lib/beds24/sync";

export const runtime = "nodejs";

export async function GET() {
  if (!(await sesionActiva())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const estado = await estadoBeds24();
  // Si Beds24 está caído, el panel debe seguir abriendo: la lista de
  // habitaciones es un extra, no un requisito para ver el estado.
  let habitaciones: Awaited<ReturnType<typeof habitacionesDisponibles>> = [];
  let error: string | null = null;
  try {
    habitaciones = await habitacionesDisponibles();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ ok: true, ...estado, habitaciones, error });
}

export async function POST(req: NextRequest) {
  if (!(await sesionActiva())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    accion?: string;
    roomTypeId?: string;
    beds24RoomId?: number | null;
  } | null;

  if (body?.accion === "emparejar") {
    const res = await emparejar(
      String(body.roomTypeId ?? ""),
      body.beds24RoomId == null || body.beds24RoomId === 0 ? null : Number(body.beds24RoomId),
    );
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (body?.accion === "sincronizar") {
    try {
      const res = await sincronizarBeds24();
      return NextResponse.json({ ok: true, ...res });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
}
