// ============================================================
// CONEXIÓN CON KORA (híbrida) — empuja cada reserva pagada al CRM de Kora
// usando su endpoint público existente POST /api/leads. Así la reserva
// aparece en el panel de Kora sin acoplar las bases de datos.
// ============================================================
import type { Booking } from "@/lib/db/schema";

const KORA_LEADS_URL =
  process.env.KORA_LEADS_URL || "https://kora-hotel.com/api/leads";

/** Empuja la reserva como lead/registro al CRM de Kora. Best-effort. */
export async function pushLeadToKora(b: Booking): Promise<boolean> {
  try {
    const ref = b.id.slice(0, 8).toUpperCase();
    const nota =
      `Reserva web ${ref}: ${b.checkin} → ${b.checkout}, ${b.huespedes} huésped(es). ` +
      `Pagado en línea ${b.montoPagado} MXN de ${b.total} (saldo ${b.saldoPendiente ?? 0}).`;
    const res = await fetch(KORA_LEADS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: b.nombre,
        whatsapp: b.whatsapp,
        email: b.email ?? "",
        hotel: "Magic Collinn",
        origen: "reserva-magic-collinn",
        mensaje: nota,
        _gotcha: "", // honeypot del endpoint de Kora (vacío = humano)
      }),
    });
    if (!res.ok) console.warn("Kora /api/leads respondió", res.status);
    return res.ok;
  } catch (e) {
    console.error("Push a Kora falló:", e);
    return false;
  }
}
