import { NextResponse, type NextRequest } from "next/server";
import { procesarTurno } from "@/lib/bot/cerebro";
import { enviarAlertasPorCorreo } from "@/lib/bot/alertas";
import { CHAT_ID_RE, rechazoPuente, texto } from "@/lib/bot/http";

export const runtime = "nodejs";
// Haiku con 2–3 rondas de herramientas tarda segundos, pero un reintento del
// SDK por saturación puede alargarlo: se deja holgura.
export const maxDuration = 60;

/**
 * Una vuelta de conversación. El puente manda la ráfaga del huésped ya
 * juntada y recibe los textos a enviar + los avisos para Gersay.
 */
export async function POST(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const chatId = texto(body?.chatId, 100);
  const mensajes = Array.isArray(body?.mensajes)
    ? (body.mensajes as unknown[]).slice(-20).map((m) => texto(m, 2000))
    : [];
  if (!CHAT_ID_RE.test(chatId) || mensajes.length === 0)
    return NextResponse.json({ ok: false, error: "Falta chatId o mensajes." }, { status: 400 });

  const r = await procesarTurno({
    chatId,
    telefono: texto(body?.telefono, 30),
    nombre: texto(body?.nombre, 80),
    mensajes,
  });
  await enviarAlertasPorCorreo(r.alertas);
  return NextResponse.json({ ok: true, ...r });
}
