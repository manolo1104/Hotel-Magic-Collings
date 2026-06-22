// ============================================================
// COMPROBANTES HTML IMPRIMIBLES (reservas y cotizaciones)
// Sin librería de PDF: HTML + window.print() (patrón de mi-hotel).
// ============================================================
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { site } from "@/lib/site";
import type { BookingView } from "@/lib/booking/engine";

function mxn(n: number): string {
  return `$${Math.round(n ?? 0).toLocaleString("es-MX")} MXN`;
}
function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

const BRAND = "#143a2a";
const ACCENT = "#b35b29";

function doc(titulo: string, inner: string, forPrint?: boolean): string {
  const printScript = forPrint
    ? "<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>"
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a;background:#f7f3ea;padding:24px}
  .sheet{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e7e1d4;border-radius:14px;overflow:hidden}
  .hd{background:${BRAND};color:#fff;padding:24px 28px}
  .hd h1{margin:0;font-size:20px} .hd p{margin:2px 0 0;font-size:12px;color:#cfe0d4}
  .bd{padding:24px 28px}
  .chip{display:inline-block;background:#e8f0ea;color:${BRAND};font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  td{padding:8px 0;font-size:14px;border-bottom:1px solid #ece6d9}
  td.k{color:#6b6b63} td.v{text-align:right;font-weight:500}
  .tot td{border:0;padding-top:14px;font-size:16px;font-weight:700;color:${BRAND}}
  .ft{padding:16px 28px;background:#faf7f0;border-top:1px solid #ece6d9;font-size:12px;color:#6b6b63}
  .btn{display:inline-block;margin:16px 28px 0;color:${ACCENT};font-size:13px}
  @media print{.noprint{display:none}body{background:#fff;padding:0}.sheet{border:0}}
</style></head><body>
<div class="sheet">
  <div class="hd"><h1>Hotel Magic Collinn</h1><p>${site.address.street}, ${site.locality}, ${site.region}</p></div>
  <div class="bd">${inner}</div>
  <div class="ft">Reserva directa, sin intermediarios · WhatsApp ${site.phone} · ${site.email}</div>
</div>
<a class="btn noprint" href="#" onclick="window.print();return false">🖨️ Imprimir / Guardar PDF</a>
${printScript}
</body></html>`;
}

export function bookingHtml(b: BookingView, opts?: { forPrint?: boolean }): string {
  const ref = b.id.slice(0, 8).toUpperCase();
  const saldo = b.saldoPendiente ?? Math.max(0, b.total - b.montoPagado);
  const inner = `
<div class="chip">COMPROBANTE DE RESERVA</div>
<h2 style="margin:14px 0 2px;font-size:22px">${b.nombre}</h2>
<p style="margin:0;color:#6b6b63;font-size:13px">Reserva ${ref} · ${b.nombreTipo} · Cuarto ${b.numeroCuarto}</p>
<table>
  <tr><td class="k">Llegada</td><td class="v">${fmt(b.checkin)} · desde ${site.checkIn} h</td></tr>
  <tr><td class="k">Salida</td><td class="v">${fmt(b.checkout)} · antes de ${site.checkOut} h</td></tr>
  <tr><td class="k">Huéspedes</td><td class="v">${b.huespedes}</td></tr>
  <tr><td class="k">Contacto</td><td class="v">${b.whatsapp}${b.email ? " · " + b.email : ""}</td></tr>
  <tr><td class="k">Pagado</td><td class="v">${mxn(b.montoPagado)}</td></tr>
  <tr><td class="k">Saldo en el hotel</td><td class="v">${mxn(saldo)}</td></tr>
  <tr class="tot"><td>Total de la estancia</td><td class="v">${mxn(b.total)}</td></tr>
</table>
${b.notas ? `<p style="font-size:13px;color:#6b6b63;margin-top:8px"><strong>Notas:</strong> ${b.notas}</p>` : ""}
<p style="font-size:13px;color:#6b6b63;margin-top:14px">${site.cancelacion}</p>`;
  return doc(`Reserva ${ref}`, inner, opts?.forPrint);
}
