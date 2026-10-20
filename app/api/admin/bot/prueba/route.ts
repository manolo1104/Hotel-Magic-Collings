import { NextResponse, type NextRequest } from "next/server";
import { sesionActiva } from "@/lib/admin/auth";
import { aplicar } from "@/lib/bot/admin";
import { procesarTurno } from "@/lib/bot/cerebro";
import { procesarComprobante } from "@/lib/bot/comprobante";
import { cotizacionVigente } from "@/lib/bot/cotizacion";
import { CHAT_ID_RE, texto } from "@/lib/bot/http";
import { TELEFONO_PRUEBA, esChatDePrueba } from "@/lib/bot/prueba";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BASE64 = 4_000_000; // Vercel corta los cuerpos de más de 4.5 MB

/**
 * Probador del panel: la plática pasa por el MISMO cerebro que WhatsApp (IA,
 * precios y disponibilidad reales) pero con un chat "prueba:…", que no aparta
 * cuartos ni avisa a nadie. Los avisos se devuelven para enseñarlos en pantalla.
 */
export async function POST(req: NextRequest) {
  if (!(await sesionActiva()))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const chatId = texto(body?.chatId, 100);
  if (!esChatDePrueba(chatId) || !CHAT_ID_RE.test(chatId))
    return NextResponse.json({ ok: false, error: "Chat de prueba no válido." }, { status: 400 });
  // "@lid" = prueba con el número oculto, como pasa con muchas cuentas nuevas.
  const telefono = chatId.endsWith("@lid") ? "" : TELEFONO_PRUEBA;
  const nombre = texto(body?.nombre, 80) || "Huésped de prueba";

  switch (body?.accion) {
    case "mensaje": {
      const mensaje = texto(body?.texto, 2000).trim();
      if (!mensaje) return NextResponse.json({ ok: false, error: "Escribe un mensaje." }, { status: 400 });
      const r = await procesarTurno({ chatId, telefono, nombre, mensajes: [mensaje] });
      return NextResponse.json({ ok: true, ...r });
    }
    case "comprobante": {
      const base64 = texto(body?.base64, MAX_BASE64 + 1);
      if (base64.length > MAX_BASE64)
        return NextResponse.json({ ok: false, error: "El archivo pesa demasiado (máximo ~3 MB)." }, { status: 400 });
      const r = await procesarComprobante({ chatId, telefono, nombre, mime: texto(body?.mime, 80), base64 });
      return NextResponse.json({ ok: true, ...r });
    }
    case "confirmar": {
      const c = await cotizacionVigente(chatId);
      if (!c)
        return NextResponse.json({ ok: false, error: "En esta prueba no hay ninguna cotización apartada." }, { status: 400 });
      const r = await aplicar("confirmar", c.folio);
      return NextResponse.json({
        ok: !r.respuesta.startsWith("❌"),
        respuestas: r.mensajesHuesped.map((m) => m.texto),
        alertas: [],
        aviso: r.respuesta,
      });
    }
    default:
      return NextResponse.json({ ok: false, error: "Acción no válida." }, { status: 400 });
  }
}
