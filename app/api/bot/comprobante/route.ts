import { NextResponse, type NextRequest } from "next/server";
import { procesarComprobante } from "@/lib/bot/comprobante";
import { enviarAlertasPorCorreo } from "@/lib/bot/alertas";
import { CHAT_ID_RE, rechazoPuente, texto } from "@/lib/bot/http";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel corta los cuerpos de más de 4.5 MB. Un comprobante que pase de ~3 MB
// llega sin archivo: igual se registra y Gersay lo ve en su WhatsApp.
const MAX_BASE64 = 4_000_000;

/** Llegó una imagen o PDF al chat: se trata como comprobante de pago. */
export async function POST(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const chatId = texto(body?.chatId, 100);
  if (!CHAT_ID_RE.test(chatId))
    return NextResponse.json({ ok: false, error: "Falta chatId." }, { status: 400 });
  const base64 = texto(body?.base64, MAX_BASE64 + 1);

  const r = await procesarComprobante({
    chatId,
    telefono: texto(body?.telefono, 30),
    nombre: texto(body?.nombre, 80),
    mime: texto(body?.mime, 80),
    base64: base64.length > MAX_BASE64 ? "" : base64,
  });
  await enviarAlertasPorCorreo(r.alertas);
  return NextResponse.json({ ok: true, ...r });
}
