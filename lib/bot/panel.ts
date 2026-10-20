// ============================================================
// DATOS PARA LA SECCIÓN «WhatsApp» DEL PANEL (/admin/whatsapp)
// Lo que Gersay necesita ver de un vistazo: qué pagos confirmar, qué está
// apartado, y de qué está hablando el bot con cada huésped.
// ============================================================
import { and, asc, desc, eq, inArray, notLike } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { botChats, botCotizaciones, botMensajes, botSalida, type BotCotizacion } from "../db/schema";
import { MODELO, botActivo, datosBancarios, puenteVisto } from "./config";
import { PREFIJO_PRUEBA } from "./prueba";
import { cotizacionesDelChat, type HabitacionCotizada } from "./cotizacion";
import { cuandoVence, fechaCorta } from "./fechas";
import { formatMXN } from "../booking/engine";

export type CotizacionPanel = {
  folio: string;
  chatId: string;
  nombre: string;
  telefono: string;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  cuartos: string[];
  total: number;
  anticipo: number;
  saldo: number;
  estado: string;
  apartadoHasta: string;
  comprobanteNota: string;
  creada: string;
};

export type ChatPanel = {
  chatId: string;
  nombre: string;
  telefono: string;
  ultimo: string;
  pausadoHasta: string | null;
  etapa: string;
  vistaPrevia: string;
};

function aPanel(c: BotCotizacion): CotizacionPanel {
  return {
    folio: c.folio,
    chatId: c.chatId,
    nombre: c.nombre,
    telefono: c.telefono,
    checkin: c.checkin,
    checkout: c.checkout,
    noches: c.noches,
    huespedes: c.huespedes,
    cuartos: (c.habitaciones as HabitacionCotizada[]).map((h) => `${h.nombre} (${h.huespedes}p)`),
    total: c.total,
    anticipo: c.anticipo,
    saldo: c.saldo,
    estado: c.estado,
    apartadoHasta: c.apartadoHasta.toISOString(),
    comprobanteNota: c.comprobanteNota,
    creada: c.createdAt.toISOString(),
  };
}

export async function datosPanel() {
  await ensureDb();
  const [activo, visto, cotizaciones, chats] = await Promise.all([
    botActivo(),
    puenteVisto(),
    // Las pláticas del probador no son huéspedes: no se listan.
    db
      .select()
      .from(botCotizaciones)
      .where(notLike(botCotizaciones.chatId, `${PREFIJO_PRUEBA}%`))
      .orderBy(desc(botCotizaciones.createdAt))
      .limit(60),
    db
      .select()
      .from(botChats)
      .where(notLike(botChats.chatId, `${PREFIJO_PRUEBA}%`))
      .orderBy(desc(botChats.ultimoMensajeEn))
      .limit(30),
  ]);
  const ahora = Date.now();
  // Un apartado que ya pasó su hora se muestra como vencido aunque nadie lo haya leído.
  const al = cotizaciones.map((c) =>
    c.estado === "vigente" && c.apartadoHasta.getTime() <= ahora ? { ...c, estado: "vencida" } : c,
  );

  const chatsPanel: ChatPanel[] = await Promise.all(
    chats.map(async (ch) => {
      const cots = await cotizacionesDelChat(ch.chatId);
      const enJuego = cots.find((c) => c.estado === "vigente" || c.estado === "comprobante") ?? cots[0] ?? null;
      const [ultimo] = await db
        .select({ contenido: botMensajes.contenido })
        .from(botMensajes)
        .where(and(eq(botMensajes.chatId, ch.chatId), eq(botMensajes.rol, "user")))
        .orderBy(desc(botMensajes.orden))
        .limit(1);
      return {
        chatId: ch.chatId,
        nombre: ch.nombre,
        telefono: ch.telefono,
        ultimo: ch.ultimoMensajeEn.toISOString(),
        pausadoHasta: ch.pausadoHasta && ch.pausadoHasta.getTime() > ahora ? ch.pausadoHasta.toISOString() : null,
        etapa: etapaParaGersay(enJuego),
        vistaPrevia: ultimo ? textoDelHuesped(ultimo.contenido).replace(/^\[([\s\S]*)\]$/, "📎 $1").slice(0, 140) : "",
      };
    }),
  );

  return {
    estado: {
      activo,
      // El puente reporta cada minuto: 3 min sin noticias = desconectado.
      conectado: visto !== null && ahora - visto.getTime() < 3 * 60_000,
      vistoPorUltimaVez: visto?.toISOString() ?? null,
      modelo: MODELO,
      datosBancarios: datosBancarios() !== null,
      pin: Boolean(process.env.BOT_ADMIN_PIN?.trim()),
      avisos: Boolean(process.env.OWNER_EMAIL?.trim()),
    },
    porConfirmar: al.filter((c) => c.estado === "comprobante").map(aPanel),
    apartadas: al.filter((c) => c.estado === "vigente").map(aPanel),
    confirmadas: al.filter((c) => c.estado === "confirmada").slice(0, 10).map(aPanel),
    chats: chatsPanel,
  };
}

export type DatosPanel = Awaited<ReturnType<typeof datosPanel>>;

/** En qué va la plática, en una línea que Gersay entienda de un vistazo. */
function etapaParaGersay(c: BotCotizacion | null): string {
  if (!c) return "Preguntando (sin cotización)";
  const fechas = `${fechaCorta(c.checkin)} → ${fechaCorta(c.checkout)}, ${c.huespedes} personas, ${formatMXN(c.total)}`;
  switch (c.estado) {
    case "vigente":
      return `Cotización ${c.folio} apartada (${fechas}); vence ${cuandoVence(c.apartadoHasta)}`;
    case "comprobante":
      return `Mandó comprobante de ${c.folio} (${fechas}): falta que confirmes el pago`;
    case "confirmada":
      return `Reserva ${c.folio} confirmada (${fechas})`;
    case "vencida":
      return `Su cotización ${c.folio} venció sin pago (${fechas})`;
    default:
      return "Preguntando (sin cotización vigente)";
  }
}

/** Texto que escribió el huésped, sin el bloque de contexto ni avisos internos. */
function textoDelHuesped(contenido: unknown): string {
  if (typeof contenido === "string") return contenido;
  if (!Array.isArray(contenido)) return "";
  return (contenido as { type: string; text?: string }[])
    .filter((b) => b.type === "text" && b.text && !/^<(contexto_del_hotel|aviso_interno)>/.test(b.text))
    .map((b) => b.text)
    .join("\n");
}

export type LineaPlatica = { quien: "huesped" | "bot" | "hotel"; texto: string; en: string };

/** La plática como la vería el huésped (sin herramientas ni contexto interno). */
export async function platica(chatId: string): Promise<LineaPlatica[]> {
  await ensureDb();
  const [mensajes, salida] = await Promise.all([
    db
      .select()
      .from(botMensajes)
      .where(eq(botMensajes.chatId, chatId))
      .orderBy(asc(botMensajes.orden))
      .limit(400),
    db
      .select()
      .from(botSalida)
      .where(and(eq(botSalida.chatId, chatId), inArray(botSalida.motivo, ["cotizacion", "confirmacion", "recordatorio", "vencida"])))
      .orderBy(asc(botSalida.createdAt)),
  ]);
  const lineas: LineaPlatica[] = [];
  for (const m of mensajes) {
    const texto =
      m.rol === "user"
        ? textoDelHuesped(m.contenido)
        : (Array.isArray(m.contenido) ? (m.contenido as { type: string; text?: string }[]) : [])
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text)
            .join("\n\n");
    if (texto.trim()) lineas.push({ quien: m.rol === "user" ? "huesped" : "bot", texto, en: m.createdAt.toISOString() });
  }
  for (const s of salida)
    if (s.enviadoEn) lineas.push({ quien: "hotel", texto: s.texto, en: s.enviadoEn.toISOString() });
  return lineas.sort((a, b) => a.en.localeCompare(b.en));
}
