// ============================================================
// AVISOS PARA GERSAY — por WhatsApp (los manda el puente a su número
// personal) y por correo de respaldo. No van a un grupo: los envíos a grupos
// de whatsapp-web.js están rotos desde julio de 2026 (lo vio Camila).
// ============================================================
import type { BotCotizacion } from "../db/schema";
import { formatMXN } from "../booking/engine";
import { site } from "../site";
import { enviarEmail } from "../email/resend";
import { datosBancarios } from "./config";
import { cuandoVence, fechaCorta } from "./fechas";
import { telefonoLegible, waMe } from "./telefono";
import type { HabitacionCotizada } from "./cotizacion";

export type TipoAlerta = "cotizacion" | "comprobante" | "persona" | "falla";
export type Alerta = { tipo: TipoAlerta; texto: string };

function contacto(nombre: string, telefono: string): string {
  const wa = waMe(telefono);
  return wa ? `${nombre} · ${telefonoLegible(telefono)} · ${wa}` : `${nombre} · (su número no se ve en WhatsApp)`;
}

function cuartos(c: BotCotizacion): string {
  const hs = (Array.isArray(c.habitaciones) ? c.habitaciones : []) as HabitacionCotizada[];
  return hs.map((h) => `🛏️ ${h.nombre} (${h.huespedes}p) ${formatMXN(h.total)}`).join("\n");
}

export function alertaCotizacion(c: BotCotizacion, reemplazo?: string): Alerta {
  const sinBanco = datosBancarios()
    ? []
    : ["⚠️ El bot NO tiene los datos bancarios: mándale tú al huésped los datos para transferir."];
  return {
    tipo: "cotizacion",
    texto: [
      `📋 *Nueva cotización ${c.folio}* (bot de WhatsApp)${reemplazo ? ` — reemplaza a ${reemplazo}` : ""}`,
      `Huésped: ${contacto(c.nombre, c.telefono)}`,
      `${fechaCorta(c.checkin)} → ${fechaCorta(c.checkout)} (${c.noches} ${c.noches === 1 ? "noche" : "noches"}), ${c.huespedes} personas`,
      cuartos(c),
      `Total ${formatMXN(c.total)} · Anticipo ${formatMXN(c.anticipo)} · Resta ${formatMXN(c.saldo)}`,
      `Apartado hasta ${cuandoVence(c.apartadoHasta)}`,
      ...sinBanco,
    ].join("\n"),
  };
}

export function alertaComprobante(args: {
  cotizacion: BotCotizacion | null;
  nombre: string;
  telefono: string;
  lectura: string;
  apartadoVencido: boolean;
  cuartoOcupado: boolean;
}): Alerta {
  const { cotizacion: c } = args;
  if (!c)
    return {
      tipo: "comprobante",
      texto: [
        "🔔 *Llegó un comprobante SIN cotización del bot*",
        `De: ${contacto(args.nombre, args.telefono)}`,
        args.lectura ? `Lo que se lee: ${args.lectura}` : "",
        "Revísalo y contesta tú desde el teléfono del hotel.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  const avisos = [
    ...(args.cuartoOcupado
      ? ["🔴 El apartado había vencido y el cuarto YA SE OCUPÓ: reubícalo antes de confirmar."]
      : args.apartadoVencido
        ? ["⚠️ El apartado había vencido; el cuarto seguía libre y se volvió a apartar."]
        : []),
  ];
  const pin = process.env.BOT_ADMIN_PIN?.trim() ? "<tu PIN>" : "<PIN (falta configurarlo)>";
  return {
    tipo: "comprobante",
    texto: [
      `🔔 *Comprobante recibido — ${c.folio}*`,
      `Huésped: ${contacto(c.nombre, c.telefono)}`,
      `${fechaCorta(c.checkin)} → ${fechaCorta(c.checkout)}, ${c.huespedes} personas`,
      `Esperado: ${formatMXN(c.anticipo)} (total ${formatMXN(c.total)})`,
      args.lectura ? `Lo que se lee en el comprobante: ${args.lectura}` : "No se pudo leer el monto: revísalo a ojo.",
      ...avisos,
      "",
      `Si el dinero ya está en la cuenta, escribe al WhatsApp del hotel:`,
      `confirmar ${c.folio} ${pin}`,
      `o confírmalo en el panel: ${site.url}/admin/whatsapp`,
    ].join("\n"),
  };
}

export function alertaPersona(args: { nombre: string; telefono: string; motivo: string; resumen: string }): Alerta {
  return {
    tipo: "persona",
    texto: [
      "🙋 *Un huésped necesita a una persona*",
      `${contacto(args.nombre, args.telefono)}`,
      `Motivo: ${args.motivo}`,
      args.resumen ? `Resumen: ${args.resumen}` : "",
      "Contéstale desde el teléfono del hotel: en cuanto le escribas, el bot se calla en ese chat por 12 horas.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function alertaFalla(args: { nombre: string; telefono: string; detalle: string }): Alerta {
  return {
    tipo: "falla",
    texto: `⚠️ El bot no pudo contestarle a ${contacto(args.nombre, args.telefono)}. Escríbele tú, por favor.\nDetalle: ${args.detalle.slice(0, 200)}`,
  };
}

/** Correo de respaldo de los avisos importantes (las fallas solo van por WhatsApp). */
export async function enviarAlertasPorCorreo(alertas: Alerta[]): Promise<void> {
  const importantes = alertas.filter((a) => a.tipo !== "falla");
  if (importantes.length === 0) return;
  const duenos = (process.env.OWNER_EMAIL || site.email)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await Promise.allSettled(
    importantes.map((a) =>
      enviarEmail({
        to: duenos,
        subject: `[Bot WhatsApp] ${a.texto.split("\n")[0].replace(/\*/g, "").slice(0, 90)}`,
        html: `<pre style="font-family:system-ui,sans-serif;font-size:14px;white-space:pre-wrap">${escaparHtml(a.texto)}</pre>`,
      }),
    ),
  );
}

function escaparHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
