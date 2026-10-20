import { NextResponse, type NextRequest } from "next/server";
import { tomarPendientes } from "@/lib/bot/admin";
import { anotarPuenteVivo } from "@/lib/bot/config";
import { rechazoPuente } from "@/lib/bot/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El puente pregunta cada minuto qué mandar sin que el huésped haya escrito:
 * recordatorios de apartados, avisos de vencimiento y mensajes del panel.
 * Así no hace falta un cron en Vercel (el plan gratis solo da uno al día).
 */
export async function GET(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;
  const mensajes = await tomarPendientes();
  await anotarPuenteVivo();
  return NextResponse.json({ ok: true, mensajes });
}
