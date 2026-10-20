// ============================================================
// LO QUE HACE GERSAY — confirmar pagos, cancelar, pausar el bot en un chat
// Por WhatsApp: escribe al número del hotel "confirmar MC-XXXX 1234".
// Se pide PIN porque con los chats @lid el número de quien escribe no
// siempre se ve: no se puede confiar en "si viene de Gersay".
// ============================================================
import { and, eq, gt, isNull, lt, lte, notLike, sql } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { appState, botChats, botCotizaciones, botSalida, type BotChat } from "../db/schema";
import { marcarEmailsEnviados } from "../booking/engine";
import { enviarCorreosReserva } from "../email/reservas";
import { PAUSA_HUMANA_HORAS, igualSeguro } from "./config";
import {
  FOLIO_RE,
  cancelarCotizacion,
  confirmarCotizacion,
  textoConfirmacion,
} from "./cotizacion";
import { cuandoVence } from "./fechas";
import { PREFIJO_PRUEBA, esChatDePrueba } from "./prueba";
import { diezDigitos } from "./telefono";

export type Accion = "confirmar" | "cancelar" | "pausar" | "continuar";
export type Comando = { accion: Accion; objetivo: string; pin: string };

/**
 * "confirmar MC-7K2P 1234" · "pausar 481 123 4567 1234". El PIN es SIEMPRE la
 * última palabra; en medio va el folio o el teléfono (con o sin espacios).
 */
export function parsearComando(texto: string): Comando | null {
  const partes = texto.trim().split(/\s+/);
  if (partes.length < 3) return null;
  const accion = partes[0].toLowerCase();
  if (!["confirmar", "cancelar", "pausar", "continuar"].includes(accion)) return null;
  const pin = partes[partes.length - 1];
  if (!/^\d{4,8}$/.test(pin)) return null;
  const objetivo = partes.slice(1, -1).join("");
  const esFolio = FOLIO_RE.test(objetivo) && objetivo.length === 7;
  const esTelefono = /^\+?\d{10,13}$/.test(objetivo.replace(/-/g, ""));
  if (accion === "confirmar" || accion === "cancelar") {
    if (!esFolio) return null;
  } else if (!esFolio && !esTelefono) return null;
  return { accion: accion as Accion, objetivo: esFolio ? objetivo.toUpperCase() : objetivo, pin };
}

/** ¿Parece un intento de comando? (para no mandárselo a la IA como plática) */
export function pareceComando(texto: string): boolean {
  return /^\s*(confirmar|cancelar|pausar|continuar)\s+\S+\s+\d{4,8}\s*$/i.test(texto) ||
    /^\s*(pausar|continuar)\s+[+\d][\d\s-]{9,16}\s+\d{4,8}\s*$/i.test(texto);
}

// ── Freno contra quien adivina el PIN ─────────────────────────
const CLAVE_FALLOS = "bot_pin_fallos";
const MAX_FALLOS = 5;

async function frenado(): Promise<boolean> {
  const [f] = await db.select().from(appState).where(eq(appState.clave, CLAVE_FALLOS)).limit(1);
  if (!f) return false;
  const [n, desde] = f.valor.split("|").map(Number);
  return n >= MAX_FALLOS && Date.now() - desde < 3_600_000;
}

async function anotarFallo(): Promise<void> {
  const [f] = await db.select().from(appState).where(eq(appState.clave, CLAVE_FALLOS)).limit(1);
  const [n, desde] = (f?.valor ?? "0|0").split("|").map(Number);
  const vigente = Date.now() - desde < 3_600_000;
  const valor = vigente ? `${n + 1}|${desde}` : `1|${Date.now()}`;
  await db
    .insert(appState)
    .values({ clave: CLAVE_FALLOS, valor })
    .onConflictDoUpdate({ target: appState.clave, set: { valor, updatedAt: new Date() } });
}

// ── Ejecutar ──────────────────────────────────────────────────

export type ResultadoAdmin = {
  respuesta: string; // para quien mandó el comando
  mensajesHuesped: { chatId: string; texto: string }[];
};

export async function ejecutarComando(texto: string): Promise<ResultadoAdmin> {
  await ensureDb();
  const pinReal = process.env.BOT_ADMIN_PIN?.trim();
  if (!pinReal) return { respuesta: "Los comandos están apagados: falta configurar BOT_ADMIN_PIN.", mensajesHuesped: [] };
  const cmd = parsearComando(texto);
  if (!cmd)
    return {
      respuesta: "No entendí el comando. Ejemplos: «confirmar MC-7K2P 1234», «pausar 481 123 4567 1234», «continuar MC-7K2P 1234».",
      mensajesHuesped: [],
    };
  if (await frenado()) return { respuesta: "Demasiados PIN incorrectos. Espera una hora.", mensajesHuesped: [] };
  if (!igualSeguro(cmd.pin, pinReal)) {
    await anotarFallo();
    return { respuesta: "PIN incorrecto.", mensajesHuesped: [] };
  }
  return aplicar(cmd.accion, cmd.objetivo);
}

/**
 * Lo mismo que el comando, sin PIN: lo usa también el panel (que ya pidió
 * contraseña). Desde WhatsApp el puente manda el aviso al huésped en ese
 * momento; desde el panel no hay puente a la mano, así que se ENCOLA y sale
 * en su siguiente ronda (≤ 1 min).
 */
export async function aplicar(
  accion: Accion,
  objetivo: string,
  { encolar = false }: { encolar?: boolean } = {},
): Promise<ResultadoAdmin> {
  await ensureDb();
  switch (accion) {
    case "confirmar": {
      const r = await confirmarCotizacion(objetivo);
      if (!r.ok) return { respuesta: `❌ ${r.error}`, mensajesHuesped: [] };
      if (r.yaEstaba) return { respuesta: `${r.cotizacion.folio} ya estaba confirmada.`, mensajesHuesped: [] };
      // Correos de siempre: confirmación al huésped (si dio correo) y aviso al dueño.
      await Promise.allSettled(
        r.reservas.map(async (b) => {
          await enviarCorreosReserva(b);
          await marcarEmailsEnviados(b.id);
        }),
      );
      const texto = textoConfirmacion(r.cotizacion);
      // Se cuentan los cuartos de la cotización (las del probador no tienen reservas).
      const cuartos = Array.isArray(r.cotizacion.habitaciones) ? r.cotizacion.habitaciones.length : r.reservas.length;
      await registrarSalida(r.cotizacion.chatId, texto, "confirmacion", !encolar);
      return {
        respuesta: `✅ ${r.cotizacion.folio} confirmada (${cuartos} ${cuartos === 1 ? "cuarto" : "cuartos"}, ${r.cotizacion.nombre}). ${encolar ? "El aviso al huésped sale por WhatsApp en menos de un minuto." : "Ya le avisé al huésped."}`,
        mensajesHuesped: encolar ? [] : [{ chatId: r.cotizacion.chatId, texto }],
      };
    }
    case "cancelar": {
      const r = await cancelarCotizacion(objetivo);
      return {
        respuesta: r.ok ? `🗑️ ${objetivo} cancelada; los cuartos quedaron libres.` : `❌ ${r.error}`,
        mensajesHuesped: [],
      };
    }
    case "pausar":
    case "continuar": {
      const chats = await chatsDe(objetivo);
      if (chats.length === 0) return { respuesta: `No encuentro ningún chat de ${objetivo}.`, mensajesHuesped: [] };
      for (const c of chats) await pausar(c.chatId, accion === "pausar" ? PAUSA_HUMANA_HORAS * 60 : 0);
      return {
        respuesta:
          accion === "pausar"
            ? `⏸️ El bot no le contestará a ${objetivo} por ${PAUSA_HUMANA_HORAS} h.`
            : `▶️ El bot vuelve a contestarle a ${objetivo}.`,
        mensajesHuesped: [],
      };
    }
  }
}

async function chatsDe(objetivo: string): Promise<BotChat[]> {
  if (FOLIO_RE.test(objetivo)) {
    const [c] = await db
      .select({ chatId: botCotizaciones.chatId })
      .from(botCotizaciones)
      .where(eq(botCotizaciones.folio, objetivo.toUpperCase()))
      .limit(1);
    if (!c) return [];
    return db.select().from(botChats).where(eq(botChats.chatId, c.chatId));
  }
  const d = diezDigitos(objetivo);
  if (!d) return [];
  return db.select().from(botChats).where(sql`right(${botChats.telefono}, 10) = ${d}`);
}

/**
 * Pausa (minutos > 0) o reanuda (0) el bot en un chat. Al reanudar se abre
 * sesión nueva: lo que habló una persona no está en el historial del bot.
 */
export async function pausar(chatId: string, minutos: number): Promise<boolean> {
  await ensureDb();
  const [fila] = await db.select().from(botChats).where(eq(botChats.chatId, chatId)).limit(1);
  if (!fila) {
    if (minutos <= 0) return false;
    await db
      .insert(botChats)
      .values({
        chatId,
        pausadoHasta: new Date(Date.now() + minutos * 60_000),
        ultimoMensajeEn: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    return true;
  }
  await db
    .update(botChats)
    .set(
      minutos > 0
        ? { pausadoHasta: new Date(Date.now() + minutos * 60_000) }
        : { pausadoHasta: null, sesion: fila.sesion + 1 },
    )
    .where(eq(botChats.chatId, chatId));
  return true;
}

// ── Mensajes que salen sin que el huésped escriba ─────────────

export async function registrarSalida(chatId: string, texto: string, motivo: string, yaEnviado: boolean) {
  const ahora = new Date();
  await db.insert(botSalida).values({
    chatId,
    texto,
    motivo,
    enviarDespues: ahora,
    createdAt: ahora,
    ...(yaEnviado ? { enviadoEn: ahora } : {}),
  });
}

/** Encola un mensaje para el huésped (lo manda el puente en su próxima ronda). */
export async function encolarMensaje(chatId: string, texto: string, motivo: string): Promise<void> {
  await ensureDb();
  await registrarSalida(chatId, texto, motivo, false);
}

/**
 * Lo que el puente debe mandar ahora: recordatorios de apartados por vencer,
 * avisos de apartados vencidos y lo encolado desde el panel. Se marca como
 * enviado al entregarlo (una sola vez aunque el puente pregunte dos veces).
 */
export async function tomarPendientes(): Promise<{ chatId: string; texto: string }[]> {
  await ensureDb();
  const ahora = new Date();
  const enUnaHora = new Date(ahora.getTime() + 60 * 60_000);

  // 1) Recordatorio una hora antes de que venza el apartado (una sola vez).
  const porVencer = await db
    .update(botCotizaciones)
    .set({ recordatorioEn: ahora })
    .where(
      and(
        eq(botCotizaciones.estado, "vigente"),
        notLike(botCotizaciones.chatId, `${PREFIJO_PRUEBA}%`),
        isNull(botCotizaciones.recordatorioEn),
        gt(botCotizaciones.apartadoHasta, new Date(ahora.getTime() + 5 * 60_000)),
        lte(botCotizaciones.apartadoHasta, enUnaHora),
      ),
    )
    .returning();
  for (const c of porVencer)
    await registrarSalida(
      c.chatId,
      `⏰ Te recuerdo que tu apartado ${c.folio} vence ${cuandoVence(c.apartadoHasta, ahora)} 🙂 Si ya transferiste, mándame aquí la foto del comprobante.`,
      "recordatorio",
      false,
    );

  // 2) Apartado vencido sin comprobante (solo los recientes: no se despierta
  //    a nadie por una cotización de hace días).
  const vencidas = await db
    .update(botCotizaciones)
    .set({ estado: "vencida" })
    .where(
      and(
        eq(botCotizaciones.estado, "vigente"),
        notLike(botCotizaciones.chatId, `${PREFIJO_PRUEBA}%`),
        lt(botCotizaciones.apartadoHasta, ahora),
        gt(botCotizaciones.apartadoHasta, new Date(ahora.getTime() - 6 * 3_600_000)),
      ),
    )
    .returning();
  for (const c of vencidas)
    await registrarSalida(
      c.chatId,
      `Se liberó el apartado de tu cotización ${c.folio} porque no nos llegó el comprobante a tiempo. Si todavía te interesa, dime y reviso otra vez la disponibilidad 🙂`,
      "vencida",
      false,
    );

  // 3) Todo lo que esté listo para salir, salvo chats que atiende una persona.
  const pausados = new Set(
    (
      await db
        .select({ chatId: botChats.chatId })
        .from(botChats)
        .where(gt(botChats.pausadoHasta, ahora))
    ).map((c) => c.chatId),
  );
  const listos = await db
    .select()
    .from(botSalida)
    // Con la hora de ESTE momento: los recordatorios recién creados arriba
    // llevan una hora unos milisegundos posterior a `ahora`.
    .where(and(isNull(botSalida.enviadoEn), lte(botSalida.enviarDespues, new Date())));
  // Un recordatorio que esperó horas (chat en pausa) ya no sirve: se descarta.
  // Las pláticas del probador nunca salen por WhatsApp: se descartan igual.
  const viejo = (m: { createdAt: Date; motivo: string; chatId: string }) =>
    esChatDePrueba(m.chatId) ||
    (m.motivo !== "confirmacion" && ahora.getTime() - m.createdAt.getTime() > 6 * 3_600_000);
  for (const m of listos.filter(viejo))
    await db.update(botSalida).set({ enviadoEn: ahora, motivo: `${m.motivo}:descartado` }).where(eq(botSalida.id, m.id));
  const salen = listos.filter((m) => !viejo(m) && (!pausados.has(m.chatId) || m.motivo === "confirmacion"));
  const entregados: { chatId: string; texto: string }[] = [];
  for (const m of salen) {
    const [tomado] = await db
      .update(botSalida)
      .set({ enviadoEn: ahora })
      .where(and(eq(botSalida.id, m.id), isNull(botSalida.enviadoEn)))
      .returning();
    if (tomado) entregados.push({ chatId: tomado.chatId, texto: tomado.texto });
  }
  return entregados;
}
