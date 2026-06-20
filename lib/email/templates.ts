// ============================================================
// PLANTILLAS DE CORREO (HTML inline) — Magic Collinn
// Estilos en línea para máxima compatibilidad con clientes de correo.
// Marca: verde Huasteca (#143a2a) + terracota (#b35b29) + crema (#f7f3ea).
// ============================================================
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { site } from "@/lib/site";

export interface DatosCorreo {
  ref: string;
  nombre: string;
  nombreTipo: string;
  numeroCuarto: string;
  checkin: string; // ISO
  checkout: string; // ISO
  huespedes: number;
  total: number;
  montoPagado: number;
  saldoPendiente: number;
  modalidad: string | null; // total | anticipo
  whatsapp: string;
  email: string | null;
}

function mxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}

function fmtFecha(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "EEEE d 'de' MMMM yyyy", {
      locale: es,
    });
  } catch {
    return iso;
  }
}

const BRAND = "#143a2a";
const ACCENT = "#b35b29";
const CREMA = "#f7f3ea";

function layout(preheader: string, inner: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREMA};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREMA};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e1d4;">
<tr><td style="background:${BRAND};padding:28px 32px;">
<div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.2px;">Hotel Magic Collinn</div>
<div style="font-size:13px;color:#cfe0d4;margin-top:2px;">Axtla de Terrazas · Huasteca Potosina</div>
</td></tr>
<tr><td style="padding:32px;">${inner}</td></tr>
<tr><td style="padding:20px 32px;background:#faf7f0;border-top:1px solid #ece6d9;font-size:12px;color:#6b6b63;">
${site.address.street}, ${site.locality}, ${site.region} ${site.address.postalCode}<br>
WhatsApp ${site.phone} · ${site.email}
</td></tr>
</table>
<div style="font-size:11px;color:#9a9a90;margin-top:14px;">Reserva directa, sin intermediarios.</div>
</td></tr></table></body></html>`;
}

function filaResumen(datos: DatosCorreo): string {
  const fila = (k: string, v: string, fuerte = false) =>
    `<tr><td style="padding:8px 0;color:#6b6b63;font-size:14px;">${k}</td>
     <td style="padding:8px 0;text-align:right;font-size:14px;${fuerte ? "font-weight:700;color:" + BRAND : "color:#1c1c1a"};">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #ece6d9;border-bottom:1px solid #ece6d9;">
${fila("Habitación", datos.nombreTipo)}
${fila("Llegada", fmtFecha(datos.checkin) + ` · desde ${site.checkIn} h`)}
${fila("Salida", fmtFecha(datos.checkout) + ` · antes de ${site.checkOut} h`)}
${fila("Huéspedes", String(datos.huespedes))}
${fila("Total de la estancia", mxn(datos.total))}
${fila("Pagado en línea", mxn(datos.montoPagado), true)}
${fila("Saldo a pagar en el hotel", mxn(datos.saldoPendiente))}
</table>`;
}

/** Correo de confirmación para el HUÉSPED. */
export function correoHuesped(datos: DatosCorreo): string {
  const inner = `
<div style="display:inline-block;background:#e8f0ea;color:${BRAND};font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;">RESERVA CONFIRMADA</div>
<h1 style="font-size:24px;margin:16px 0 6px;color:#1c1c1a;">¡Gracias, ${datos.nombre}!</h1>
<p style="font-size:15px;line-height:1.6;color:#46463f;margin:0 0 4px;">
Tu reserva en el Hotel Magic Collinn está <strong>confirmada y pagada</strong>. Tu número de reserva es
<strong style="color:${ACCENT};">${datos.ref}</strong>.</p>
${filaResumen(datos)}
<p style="font-size:14px;line-height:1.6;color:#46463f;margin:0 0 18px;">
${datos.saldoPendiente > 0
  ? `Pagaste un anticipo. El saldo de <strong>${mxn(datos.saldoPendiente)}</strong> se cubre directamente en el hotel al llegar (efectivo, tarjeta, transferencia u OXXO).`
  : `Tu estancia quedó pagada por completo. No tienes que pagar nada más al llegar.`}
</p>
<p style="font-size:14px;line-height:1.6;color:#46463f;margin:0 0 6px;">
<strong>Cancelación:</strong> ${site.cancelacion}</p>
<a href="https://wa.me/${site.whatsapp}" style="display:inline-block;margin-top:14px;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Escríbenos por WhatsApp</a>
<p style="font-size:13px;line-height:1.6;color:#8a8a80;margin:22px 0 0;">Te esperamos en el corazón de Axtla de Terrazas.</p>`;
  return layout(
    `Reserva ${datos.ref} confirmada en Magic Collinn`,
    inner,
  );
}

/** Aviso de nueva reserva pagada para el DUEÑO. */
export function correoDueno(datos: DatosCorreo): string {
  const modalidadTxt =
    datos.modalidad === "anticipo" ? "Anticipo 50%" : "Pago total";
  const inner = `
<div style="display:inline-block;background:#fbeee4;color:${ACCENT};font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;">NUEVA RESERVA PAGADA</div>
<h1 style="font-size:22px;margin:16px 0 6px;color:#1c1c1a;">${datos.nombre} · ${datos.nombreTipo}</h1>
<p style="font-size:14px;line-height:1.6;color:#46463f;margin:0;">Reserva <strong>${datos.ref}</strong> · Cuarto asignado <strong>${datos.numeroCuarto}</strong> · ${modalidadTxt}</p>
${filaResumen(datos)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
<tr><td style="padding:6px 0;color:#6b6b63;font-size:14px;">WhatsApp del huésped</td><td style="padding:6px 0;text-align:right;font-size:14px;"><a href="https://wa.me/${datos.whatsapp.replace(/[^0-9]/g, "")}" style="color:${ACCENT};">${datos.whatsapp}</a></td></tr>
<tr><td style="padding:6px 0;color:#6b6b63;font-size:14px;">Correo</td><td style="padding:6px 0;text-align:right;font-size:14px;">${datos.email ?? "—"}</td></tr>
</table>`;
  return layout(`Nueva reserva pagada: ${datos.nombre} (${datos.ref})`, inner);
}
