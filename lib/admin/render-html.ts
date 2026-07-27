// ============================================================
// COMPROBANTES HTML IMPRIMIBLES (reservas y cotizaciones)
// Sin librería de PDF: HTML + window.print() (patrón de mi-hotel).
// ============================================================
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { site } from "@/lib/site";
import type { BookingView, QuoteView } from "@/lib/booking/engine";

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

// Tokens Garza & Río (alineados con lib/email/templates.ts)
const BRAND = "#234A31"; // verde ribera
const ACCENT = "#B75C38"; // terracota
const PAPEL = "#FCF8F0";
const ARENA = "#C9A968";
const LINEA = "#E2D8C6";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'Courier New',Courier,monospace";

function doc(titulo: string, inner: string, forPrint?: boolean): string {
  const printScript = forPrint
    ? "<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>"
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#23281F;background:${PAPEL};padding:24px}
  .sheet{max-width:640px;margin:0 auto;background:#FBFAF4;border:1px solid ${LINEA};border-radius:14px;overflow:hidden}
  .hd{background:${BRAND};color:#fff;padding:22px 28px;display:flex;align-items:center;gap:14px}
  .hd img{display:block;width:44px;height:44px;border-radius:11px}
  .hd h1{margin:0;font-size:20px;font-family:${SERIF};font-weight:600} .hd p{margin:4px 0 0;font-size:10px;font-family:${MONO};letter-spacing:3px;text-transform:uppercase;color:${ARENA}}
  .bd{padding:24px 28px}
  h2{font-family:${SERIF};font-weight:600}
  .chip{display:inline-block;background:#E6EDE7;color:${BRAND};font-size:11px;font-family:${MONO};font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 12px;border-radius:999px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  td{padding:8px 0;font-size:14px;border-bottom:1px solid ${LINEA}}
  td.k{color:#6E6656} td.v{text-align:right;font-weight:500}
  .tot td{border:0;padding-top:14px;font-size:16px;font-weight:700;color:${BRAND}}
  .ft{padding:16px 28px;background:${PAPEL};border-top:1px solid ${LINEA};font-size:12px;color:#6E6656}
  .ft .mono{font-family:${MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${ARENA};margin-top:6px}
  .btn{display:inline-block;margin:16px 28px 0;color:${ACCENT};font-size:13px}
  @media print{.noprint{display:none}body{background:#fff;padding:0}.sheet{border:0}}
</style></head><body>
<div class="sheet">
  <div class="hd"><img src="/correo/garza.png" alt="La garza de Magic Collinn"><div><h1>Hotel Magic Collinn</h1><p>Axtla &middot; Huasteca Potosina</p></div></div>
  <div class="bd">${inner}</div>
  <div class="ft">${site.address.street}, ${site.locality}, ${site.region} · WhatsApp ${site.phone} · ${site.email}<div class="mono">Reserva directa, sin intermediarios</div></div>
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
  ${b.nosConociste ? `<tr><td class="k">Nos conoció por</td><td class="v">${b.nosConociste}</td></tr>` : ""}
  <tr><td class="k">Pagado</td><td class="v">${mxn(b.montoPagado)}</td></tr>
  <tr><td class="k">Saldo en el hotel</td><td class="v">${mxn(saldo)}</td></tr>
  <tr class="tot"><td>Total de la estancia</td><td class="v">${mxn(b.total)}</td></tr>
</table>
${b.notas ? `<p style="font-size:13px;color:#6b6b63;margin-top:8px"><strong>Notas:</strong> ${b.notas}</p>` : ""}
<p style="font-size:13px;color:#6b6b63;margin-top:14px">${site.cancelacion}</p>`;
  return doc(`Reserva ${ref}`, inner, opts?.forPrint);
}

export function quoteHtml(q: QuoteView, opts?: { forPrint?: boolean }): string {
  const ref = q.id.slice(0, 8).toUpperCase();
  const inner = `
<div class="chip">COTIZACIÓN</div>
<h2 style="margin:14px 0 2px;font-size:22px">${q.cliente}</h2>
<p style="margin:0;color:#6b6b63;font-size:13px">Cotización ${ref} · ${q.nombreTipo}</p>
<table>
  <tr><td class="k">Llegada</td><td class="v">${fmt(q.checkin)}</td></tr>
  <tr><td class="k">Salida</td><td class="v">${fmt(q.checkout)}</td></tr>
  <tr><td class="k">Noches</td><td class="v">${q.noches}</td></tr>
  <tr><td class="k">Huéspedes</td><td class="v">${q.huespedes}</td></tr>
  <tr class="tot"><td>Precio total</td><td class="v">${mxn(q.precioTotal)}</td></tr>
</table>
${q.notas ? `<p style="font-size:13px;color:#6b6b63;margin-top:8px">${q.notas}</p>` : ""}
<p style="font-size:13px;color:#6b6b63;margin-top:14px">Para confirmar tu reserva, escríbenos por WhatsApp al ${site.phone}. ${site.cancelacion}</p>`;
  return doc(`Cotización ${ref}`, inner, opts?.forPrint);
}
