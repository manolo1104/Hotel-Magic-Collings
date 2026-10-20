import { NextResponse, type NextRequest } from "next/server";
import { ejecutarComando } from "@/lib/bot/admin";
import { rechazoPuente, texto } from "@/lib/bot/http";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Comandos de Gersay escritos al WhatsApp del hotel ("confirmar MC-7K2P 1234").
 * El puente reenvía el texto tal cual; aquí se revisa el PIN.
 */
export async function POST(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await ejecutarComando(texto(body?.texto, 200));
  return NextResponse.json({ ok: true, ...r });
}
