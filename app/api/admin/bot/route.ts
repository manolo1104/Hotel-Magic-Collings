import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { aplicar, pausar, type Accion } from "@/lib/bot/admin";
import { PAUSA_HUMANA_HORAS, ponerBotActivo } from "@/lib/bot/config";
import { platica } from "@/lib/bot/panel";

export const runtime = "nodejs";

/** La plática de un chat (para desplegarla en el panel). */
export async function GET(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const chatId = req.nextUrl.searchParams.get("chatId") ?? "";
  if (!chatId) return NextResponse.json({ ok: false, error: "Falta chatId." }, { status: 400 });
  return NextResponse.json({ ok: true, lineas: await platica(chatId) });
}

const ACCIONES: Accion[] = ["confirmar", "cancelar", "pausar", "continuar"];

/** Botones del panel: confirmar pago, cancelar, pausar/reanudar un chat, encender/apagar. */
export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = String(body?.accion ?? "");
  const objetivo = String(body?.objetivo ?? "").slice(0, 100);

  if (accion === "encender" || accion === "apagar") {
    await ponerBotActivo(accion === "encender");
    return NextResponse.json({ ok: true, respuesta: accion === "encender" ? "Bot encendido." : "Bot apagado." });
  }
  if (!ACCIONES.includes(accion as Accion) || !objetivo)
    return NextResponse.json({ ok: false, error: "Acción no válida." }, { status: 400 });

  // pausar/continuar llegan con el chatId: se resuelven directo, sin buscar por teléfono.
  if (accion === "pausar" || accion === "continuar") {
    const ok = await pausar(objetivo, accion === "pausar" ? PAUSA_HUMANA_HORAS * 60 : 0);
    return NextResponse.json({ ok, respuesta: ok ? "Listo." : "No encontré ese chat." });
  }
  const r = await aplicar(accion as Accion, objetivo, { encolar: true });
  const ok = !r.respuesta.startsWith("❌");
  return NextResponse.json({ ok, respuesta: r.respuesta }, { status: ok ? 200 : 400 });
}
