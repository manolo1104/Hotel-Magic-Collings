import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { MODELO, botActivo, datosBancarios } from "@/lib/bot/config";
import { rechazoPuente } from "@/lib/bot/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chequeo al arrancar el puente: ¿la llave de Anthropic sirve? Si la cuenta
 * se deshabilita (le pasó a Paraíso en julio: 5 días caído sin que nadie se
 * enterara), el puente avisa a Gersay en vez de fallar en silencio.
 */
export async function GET(req: NextRequest) {
  const rechazo = rechazoPuente(req);
  if (rechazo) return rechazo;

  let anthropic = "ok";
  try {
    await new Anthropic({ maxRetries: 1, timeout: 20_000 }).messages.create({
      model: MODELO,
      max_tokens: 16,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "ok" }],
    });
  } catch (err) {
    anthropic = err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err);
  }

  return NextResponse.json({
    ok: anthropic === "ok",
    modelo: MODELO,
    anthropic,
    botActivo: await botActivo().catch(() => false),
    datosBancarios: datosBancarios() !== null,
    pinConfigurado: Boolean(process.env.BOT_ADMIN_PIN?.trim()),
  });
}
