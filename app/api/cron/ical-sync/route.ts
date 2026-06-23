import { NextResponse, type NextRequest } from "next/server";
import { syncAllChannels } from "@/lib/admin/ical";

export const runtime = "nodejs";

// Sincronización automática de OTAs. Protegida por CRON_SECRET (Vercel Cron / curl).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await syncAllChannels();
  return NextResponse.json({ ok: true, ...result });
}
