// Guardia común de las rutas /api/bot/*: solo el puente de WhatsApp (con
// BOT_SECRET) puede llamarlas. Sin BOT_SECRET configurado, no existen (404).
import { NextResponse } from "next/server";
import { autorizadoPuente } from "./config";

export function rechazoPuente(req: Request): NextResponse | null {
  const ok = autorizadoPuente(req.headers.get("authorization"));
  if (ok === null) return new NextResponse("No encontrado", { status: 404 });
  if (!ok) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  return null;
}

export const CHAT_ID_RE = /^[\w.@:+-]{3,100}$/;

export function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
