// ============================================================
// GET /api/cron/beds24-sync — dispara la sincronización con Booking a mano.
// El reloj interno (lib/scheduler.ts) ya la corre solo; esto existe para
// poder forzarla desde fuera sin entrar al panel:
//   curl -H "Authorization: Bearer <CRON_SECRET>" .../api/cron/beds24-sync
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { sincronizarBeds24 } from "@/lib/beds24/sync";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await sincronizarBeds24();
  return NextResponse.json({ ok: true, ...result });
}
