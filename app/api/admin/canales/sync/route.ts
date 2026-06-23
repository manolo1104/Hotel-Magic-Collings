import { NextResponse } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { syncAllChannels } from "@/lib/admin/ical";

export const runtime = "nodejs";

export async function POST() {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await syncAllChannels();
  return NextResponse.json({ ok: true, ...result });
}
