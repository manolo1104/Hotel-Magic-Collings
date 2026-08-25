// ============================================================
// ENVÍO DE COTIZACIÓN POR CORREO
// ============================================================
import { enviarEmail, correosActivos } from "./resend";
import { correoCotizacion } from "./templates";
import type { QuoteView } from "@/lib/booking/engine";

/** Envía la cotización al cliente (si tiene correo). Devuelve si se envió. */
export async function enviarCotizacion(q: QuoteView): Promise<boolean> {
  if (!correosActivos() || !q.email) return false;
  const ref = q.id.slice(0, 8).toUpperCase();
  return enviarEmail({
    to: q.email,
    subject: `Tu cotización en Magic Collinn (${ref})`,
    // Plantilla de CORREO (tablas + logo absoluto), no el comprobante
    // imprimible: ese vive en /api/admin/cotizaciones/[id]/render.
    html: correoCotizacion({
      ref,
      cliente: q.cliente,
      nombreTipo: q.nombreTipo,
      checkin: q.checkin,
      checkout: q.checkout,
      noches: q.noches,
      huespedes: q.huespedes,
      precioTotal: q.precioTotal,
      notas: q.notas,
    }),
  });
}
