// ============================================================
// PLANTILLAS DE CORREO (HTML inline) — Magic Collinn
// Estilos en línea para máxima compatibilidad con clientes de correo.
// Marca "Garza & Río": verde ribera + terracota + papel + arena.
// Tipografías email-safe: Georgia (titulares, evoca Newsreader),
// system sans (cuerpo) y Courier (etiquetas, evoca Space Mono).
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
  nosConociste: string | null;
}

export function mxn(n: number): string {
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

// Tokens Garza & Río
const VERDE = "#234A31"; // verde ribera (principal)
const TERRA = "#B75C38"; // terracota (CTA)
const PAPEL = "#FCF8F0"; // fondo exterior
const ARENA = "#C9A968"; // arena palma (etiquetas sobre verde)
const TINTA = "#23281F"; // texto principal
const LINEA = "#E2D8C6"; // bordes
const GARZA = "#FBFAF4"; // blanco garza (tarjeta)
const MUTED = "#6E6656"; // texto secundario

// Pilas tipográficas email-safe
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

/** Badge redondeado. Tonos: verde (confirmado), terra (acción/aviso), rio (info). */
export function chip(texto: string, tono: "verde" | "terra" | "rio" = "verde"): string {
  const c =
    tono === "terra"
      ? { bg: "#F7E9E0", fg: TERRA }
      : tono === "rio"
        ? { bg: "#E4EEF0", fg: "#3E7F8C" }
        : { bg: "#E6EDE7", fg: VERDE };
  return `<div style="display:inline-block;background:${c.bg};color:${c.fg};font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:7px 14px;border-radius:999px;">${texto}</div>`;
}

/** Fila clave/valor para tablas de resumen. */
export function fila(k: string, v: string, fuerte = false): string {
  return `<tr><td style="padding:9px 0;color:${MUTED};font-size:14px;font-family:${SANS};">${k}</td>
     <td style="padding:9px 0;text-align:right;font-size:14px;font-family:${SANS};${fuerte ? `font-weight:700;color:${VERDE}` : `color:${TINTA}`};">${v}</td></tr>`;
}

/** Tabla de resumen con filas k/v, bordeada arriba y abajo. */
export function tablaResumen(filas: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid ${LINEA};border-bottom:1px solid ${LINEA};">${filas}</table>`;
}

/** Botón CTA terracota. */
export function ctaBoton(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;background:${TERRA};color:#ffffff;text-decoration:none;font-family:${SANS};font-weight:600;font-size:15px;padding:13px 24px;border-radius:10px;">${texto}</a>`;
}

/** Layout base de marca: tarjeta sobre papel, header verde con la garza. */
export function layout(preheader: string, inner: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPEL};font-family:${SANS};color:${TINTA};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${GARZA};border-radius:16px;overflow:hidden;border:1px solid ${LINEA};">
<tr><td style="background:${VERDE};padding:26px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:16px;vertical-align:middle;"><img src="${site.url}/correo/garza.png" width="48" height="48" alt="La garza de Magic Collinn" style="display:block;border-radius:12px;"></td>
<td style="vertical-align:middle;">
<div style="font-family:${SERIF};font-size:22px;font-weight:600;color:#ffffff;letter-spacing:.2px;">Hotel Magic Collinn</div>
<div style="font-family:${MONO};font-size:10px;letter-spacing:3px;color:${ARENA};margin-top:5px;">AXTLA &middot; HUASTECA POTOSINA</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:32px;">${inner}</td></tr>
<tr><td style="padding:20px 32px;background:${PAPEL};border-top:1px solid ${LINEA};">
<div style="font-size:12px;line-height:1.7;color:${MUTED};">
${site.address.street}, ${site.locality}, ${site.region} ${site.address.postalCode}<br>
WhatsApp ${site.phone} · ${site.email}
</div>
<div style="font-family:${MONO};font-size:10px;letter-spacing:2px;color:${ARENA};margin-top:10px;">RESERVA DIRECTA, SIN INTERMEDIARIOS</div>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function filaResumen(datos: DatosCorreo): string {
  return tablaResumen(`
${fila("Habitación", datos.nombreTipo)}
${fila("Llegada", fmtFecha(datos.checkin) + ` · desde ${site.checkIn} h`)}
${fila("Salida", fmtFecha(datos.checkout) + ` · antes de ${site.checkOut} h`)}
${fila("Huéspedes", String(datos.huespedes))}
${fila("Total de la estancia", mxn(datos.total))}
${fila("Pagado en línea", mxn(datos.montoPagado), true)}
${fila("Saldo a pagar en el hotel", mxn(datos.saldoPendiente))}
`);
}

/**
 * Cómo va el dinero de una reserva. El panel puede reenviar este mismo correo
 * para una reserva creada a mano (sin un peso cobrado en línea), así que el
 * texto NO puede dar por hecho que está pagada: decirle "pagaste un anticipo"
 * a quien no ha pagado nada es peor que no mandar el correo.
 */
function estadoDinero(d: DatosCorreo): "pagada" | "anticipo" | "sin_pago" {
  if (d.montoPagado > 0 && d.saldoPendiente <= 0) return "pagada";
  if (d.montoPagado > 0) return "anticipo";
  return "sin_pago";
}

/** Correo de confirmación para el HUÉSPED. */
export function correoHuesped(datos: DatosCorreo): string {
  const dinero = estadoDinero(datos);
  const encabezado =
    dinero === "pagada"
      ? "está <strong>confirmada y pagada</strong>"
      : dinero === "anticipo"
        ? "está <strong>confirmada</strong> con anticipo"
        : "está <strong>confirmada</strong>";
  const detallePago =
    dinero === "pagada"
      ? "Tu estancia quedó pagada por completo. No tienes que pagar nada más al llegar."
      : dinero === "anticipo"
        ? `Pagaste un anticipo. El saldo de <strong>${mxn(datos.saldoPendiente)}</strong> se cubre directamente en el hotel al llegar (efectivo, tarjeta, transferencia u OXXO).`
        : `El total de <strong>${mxn(datos.total)}</strong> se paga en el hotel al llegar (efectivo, tarjeta, transferencia u OXXO).`;
  const inner = `
${chip("Reserva confirmada")}
<h1 style="font-family:${SERIF};font-size:26px;font-weight:600;margin:18px 0 6px;color:${TINTA};">¡Gracias, ${datos.nombre}!</h1>
<p style="font-size:15px;line-height:1.65;color:#4a4d40;margin:0 0 4px;">
Tu reserva en el Hotel Magic Collinn ${encabezado}. Tu número de reserva es
<strong style="color:${TERRA};">${datos.ref}</strong>.</p>
${filaResumen(datos)}
<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0 0 18px;">${detallePago}</p>
<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0 0 6px;">
<strong>Cancelación:</strong> ${site.cancelacion}</p>
<div style="margin-top:16px;">${ctaBoton(`https://wa.me/${site.whatsapp}`, "Escríbenos por WhatsApp")}</div>
<p style="font-family:${SERIF};font-style:italic;font-size:14px;line-height:1.6;color:${MUTED};margin:24px 0 0;">Te esperamos en el corazón de Axtla de Terrazas. Descansa: aquí ya todo está listo.</p>`;
  return layout(
    `Reserva ${datos.ref} confirmada en Magic Collinn`,
    inner,
  );
}

/** Aviso de nueva reserva para el DUEÑO. */
export function correoDueno(datos: DatosCorreo): string {
  const dinero = estadoDinero(datos);
  // `modalidad` solo la llena el checkout en línea; en las reservas hechas a
  // mano viene vacía y hay que leer el dinero real.
  const modalidadTxt =
    dinero === "sin_pago"
      ? "Sin pago en línea"
      : dinero === "anticipo" || datos.modalidad === "anticipo"
        ? `Anticipo de ${mxn(datos.montoPagado)}`
        : "Pago total";
  const titulo =
    dinero === "sin_pago" ? "Reserva sin pago en línea" : "Nueva reserva pagada";
  const inner = `
${chip(titulo, "terra")}
<h1 style="font-family:${SERIF};font-size:23px;font-weight:600;margin:18px 0 6px;color:${TINTA};">${datos.nombre} · ${datos.nombreTipo}</h1>
<p style="font-size:14px;line-height:1.6;color:#4a4d40;margin:0;">Reserva <strong>${datos.ref}</strong> · Cuarto asignado <strong>${datos.numeroCuarto}</strong> · ${modalidadTxt}</p>
${filaResumen(datos)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
${fila("WhatsApp del huésped", `<a href="https://wa.me/${datos.whatsapp.replace(/[^0-9]/g, "")}" style="color:${TERRA};">${datos.whatsapp}</a>`)}
${fila("Correo", datos.email ?? "—")}
${datos.nosConociste ? fila("Nos conoció por", datos.nosConociste) : ""}
</table>`;
  return layout(`Nueva reserva pagada: ${datos.nombre} (${datos.ref})`, inner);
}

/**
 * Cotización para el CLIENTE.
 *
 * Antes se le mandaba el mismo HTML del comprobante imprimible
 * (`quoteHtml`), que está pensado para el navegador: encabezado en flexbox,
 * `@media print`, un botón "Imprimir" con `onclick` y la garza en ruta
 * relativa. En un cliente de correo eso llega con el logo roto y un botón que
 * no hace nada. Esta plantilla usa el mismo layout de tablas que el resto de
 * los correos del hotel.
 */
export function correoCotizacion(datos: {
  ref: string;
  cliente: string;
  nombreTipo: string;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  precioTotal: number;
  notas: string | null;
}): string {
  const inner = `
${chip("Cotización", "rio")}
<h1 style="font-family:${SERIF};font-size:26px;font-weight:600;margin:18px 0 6px;color:${TINTA};">Hola, ${datos.cliente}</h1>
<p style="font-size:15px;line-height:1.65;color:#4a4d40;margin:0 0 4px;">
Esta es la cotización que preparamos para tu estancia en el Hotel Magic Collinn. Tu folio es
<strong style="color:${TERRA};">${datos.ref}</strong>.</p>
${tablaResumen(`
${fila("Habitación", datos.nombreTipo)}
${fila("Llegada", fmtFecha(datos.checkin) + ` · desde ${site.checkIn} h`)}
${fila("Salida", fmtFecha(datos.checkout) + ` · antes de ${site.checkOut} h`)}
${fila("Noches", String(datos.noches))}
${fila("Huéspedes", String(datos.huespedes))}
${fila("Precio total", mxn(datos.precioTotal), true)}
`)}
${
  datos.notas
    ? `<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0 0 18px;">${datos.notas}</p>`
    : ""
}
<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0 0 18px;">
Esta cotización no aparta el cuarto: la disponibilidad se confirma al reservar. Escríbenos y lo dejamos listo.</p>
<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0 0 6px;">
<strong>Cancelación:</strong> ${site.cancelacion}</p>
<div style="margin-top:16px;">${ctaBoton(`https://wa.me/${site.whatsapp}`, "Reservar por WhatsApp")}</div>
<p style="font-family:${SERIF};font-style:italic;font-size:14px;line-height:1.6;color:${MUTED};margin:24px 0 0;">Te esperamos en el corazón de Axtla de Terrazas.</p>`;
  return layout(`Tu cotización ${datos.ref} en Magic Collinn`, inner);
}
