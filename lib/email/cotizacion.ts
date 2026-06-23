// ============================================================
// ENVÍO DE COTIZACIÓN POR CORREO
// ============================================================
import { enviarEmail, correosActivos } from "./resend";
import { quoteHtml } from "@/lib/admin/render-html";
import type { QuoteView } from "@/lib/booking/engine";

/** Envía la cotización al cliente (si tiene correo). Devuelve si se envió. */
export async function enviarCotizacion(q: QuoteView): Promise<boolean> {
  if (!correosActivos() || !q.email) return false;
  const ref = q.id.slice(0, 8).toUpperCase();
  return enviarEmail({
    to: q.email,
    subject: `Tu cotización en Magic Collinn (${ref})`,
    html: quoteHtml(q),
  });
}
