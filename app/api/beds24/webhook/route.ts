// ============================================================
// POST /api/beds24/webhook — aviso instantáneo de Beds24
//
// Cuando entra (o cambia) una reserva en Booking.com, Beds24 llama aquí y la
// reserva aparece en el sitio en segundos, sin esperar al reloj.
//
// CÓMO SE CONFIGURA (en Beds24):
//   Settings → Properties → Access → Booking webhooks
//   URL: https://www.hotelmagicollinn.com/api/beds24/webhook?secret=<BEDS24_WEBHOOK_SECRET>
//   Activar "include booking data" para que el aviso traiga la reserva completa.
//
// SEGURIDAD: Beds24 no firma sus avisos, así que el secreto viaja en la URL
// (que solo conocen Beds24 y el servidor). Sin BEDS24_WEBHOOK_SECRET el
// endpoint responde 404: mejor no existir que aceptar cualquier cosa.
//
// El reloj (lib/scheduler.ts) repesca igual cada pocos minutos, así que perder
// un aviso retrasa la reserva, no la pierde.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { importarReservaBeds24 } from "@/lib/beds24/sync";
import type { Beds24Booking } from "@/lib/beds24/client";

export const runtime = "nodejs";

/** Compara sin filtrar información por el tiempo que tarda. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Beds24 puede mandar la reserva suelta, dentro de `booking` o en un arreglo. */
function extraerReservas(cuerpo: unknown): Beds24Booking[] {
  if (!cuerpo || typeof cuerpo !== "object") return [];
  if (Array.isArray(cuerpo)) return cuerpo.flatMap(extraerReservas);
  const obj = cuerpo as Record<string, unknown>;
  for (const clave of ["booking", "data", "bookings"]) {
    if (obj[clave]) return extraerReservas(obj[clave]);
  }
  return typeof obj.id === "number" || typeof obj.id === "string"
    ? [obj as unknown as Beds24Booking]
    : [];
}

export async function POST(req: NextRequest) {
  const secreto = process.env.BEDS24_WEBHOOK_SECRET?.trim();
  if (!secreto) return new NextResponse("No encontrado", { status: 404 });

  const recibido = req.nextUrl.searchParams.get("secret") ?? "";
  if (!igualSeguro(recibido, secreto))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cuerpo = await req.json().catch(() => null);
  const reservas = extraerReservas(cuerpo);
  if (reservas.length === 0) {
    console.warn("[beds24] webhook sin reservas reconocibles:", JSON.stringify(cuerpo)?.slice(0, 400));
    // 200 a propósito: un 4xx haría a Beds24 reintentar un aviso que nunca
    // vamos a poder procesar, y acabaría desactivando el webhook.
    return NextResponse.json({ ok: true, procesadas: 0 });
  }

  let procesadas = 0;
  for (const r of reservas) {
    try {
      const res = await importarReservaBeds24(r);
      if (res === "creada" || res === "actualizada") procesadas++;
    } catch (e) {
      console.error("[beds24] el webhook falló al importar una reserva:", e);
      // 500 para que Beds24 reintente: aquí sí puede ser un fallo pasajero
      // (base de datos ocupada) y perder la reserva sería sobreventa.
      return NextResponse.json({ error: "Error al importar" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, procesadas });
}
