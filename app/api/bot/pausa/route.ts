import { NextResponse, type NextRequest } from "next/server";
import { pausar } from "@/lib/bot/admin";
import { PAUSA_HUMANA_HORAS } from "@/lib/bot/config";
import { CHAT_ID_RE, rechazoPuente, texto } from "@/lib/bot/http";

export const runtime = "nodejs";

/**
 * Toma humana: el puente vio que alguien escribió A MANO desde el teléfono
 * del hotel en un chat, así que el bot se calla ahí (o vuelve, con minutos 0).
 */
export async function POST(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const chatId = texto(body?.chatId, 100);
  if (!CHAT_ID_RE.test(chatId))
    return NextResponse.json({ ok: false, error: "Falta chatId." }, { status: 400 });
  const pedidos = Number(body?.minutos);
  const minutos = Number.isFinite(pedidos) ? Math.max(0, Math.min(pedidos, 7 * 24 * 60)) : PAUSA_HUMANA_HORAS * 60;
  const ok = await pausar(chatId, minutos);
  return NextResponse.json({ ok });
}
