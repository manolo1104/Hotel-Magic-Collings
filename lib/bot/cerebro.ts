// ============================================================
// CEREBRO DEL BOT — una vuelta de conversación con Haiku 5.5
//
// El puente de WhatsApp junta la ráfaga de mensajes del huésped y llama a
// procesarTurno(). Aquí: se carga el historial, se agrega el turno, se deja
// a Haiku usar sus herramientas y se devuelven los textos a mandar.
//
// Tres decisiones que no hay que deshacer:
//  1. HISTORIAL SOLO-AGREGAR. Haiku 5.5 invalida (o rechaza con 400) los
//     bloques de razonamiento si algo ANTERIOR a ellos cambia. Por eso nunca
//     se recorta ni se edita lo guardado: tras 24 h de silencio se abre una
//     sesión nueva.
//  2. EL CONTEXTO (fecha, etapa, cotización) VA DENTRO DEL TURNO del huésped,
//     en un bloque <contexto_del_hotel>, y no como mensaje de sistema: así no
//     hay reglas de orden que romper si un turno falla a la mitad.
//  3. UN TURNO VACÍO no se guarda (envenena la plática: medido en el bot de
//     Tours con Haiku 4.5). Se agrega un aviso y se reintenta una vez.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, gt, notLike } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { botChats, botMensajes, botSalida, type BotChat } from "../db/schema";
import { todayISO } from "../booking/engine";
import { alertaFalla, type Alerta } from "./alertas";
import {
  MAX_RONDAS,
  MODELO,
  SESION_INACTIVA_HORAS,
  botActivo,
  esfuerzo,
} from "./config";
import { promptFijo } from "./conocimiento";
import { cotizacionesDelChat, etapaDe, limpiarEco } from "./cotizacion";
import { ahoraEnElHotel } from "./fechas";
import { HERRAMIENTAS, ejecutarHerramienta, type Efectos } from "./herramientas";
import { esChatDePrueba } from "./prueba";
import { esLid, telefonoDeChat, telefonoLegible, telefonoMx } from "./telefono";

export type EntradaTurno = {
  chatId: string;
  telefono?: string;
  nombre?: string;
  mensajes: string[];
};

/** Lo que hizo el bot en el turno (lo enseña el probador del panel). */
export type AccionTurno = { herramienta: string; entrada: unknown; ok: boolean };

export type ResultadoTurno = {
  respuestas: string[];
  alertas: Alerta[];
  silencio?: "apagado" | "pausado" | "vacio";
  acciones?: AccionTurno[];
};

export const DISCULPA =
  "Disculpa, tuve un problema para contestarte. En un momento te escribe alguien del equipo del hotel 🙏";

let cliente: Anthropic | null = null;
function anthropic(): Anthropic {
  // 2 reintentos del SDK para 429/5xx; 40 s por intento cabe en los 60 s de la ruta.
  return (cliente ??= new Anthropic({ maxRetries: 2, timeout: 40_000 }));
}

// ── Limpieza de lo que escribe el huésped ─────────────────────
/** Nadie de fuera puede fingir un bloque del hotel. */
export function sanearTextoHuesped(t: string): string {
  return t
    .replace(/<\/?\s*(contexto_del_hotel|aviso_interno)[^>]*>/gi, "")
    .trim()
    .slice(0, 2000);
}

// ── Persistencia ──────────────────────────────────────────────

async function obtenerChat(e: EntradaTurno): Promise<BotChat> {
  // En el probador el "teléfono" lo decide la prueba, no el id del chat.
  const telefono = telefonoMx(e.telefono) || (esChatDePrueba(e.chatId) ? "" : telefonoDeChat(e.chatId));
  const nombre = (e.nombre ?? "").trim().slice(0, 80);
  const [fila] = await db
    .insert(botChats)
    .values({ chatId: e.chatId, telefono, nombre, ultimoMensajeEn: new Date(), createdAt: new Date() })
    .onConflictDoNothing()
    .returning();
  if (fila) return fila;
  const [actual] = await db.select().from(botChats).where(eq(botChats.chatId, e.chatId)).limit(1);
  // El teléfono y el nombre del perfil se completan cuando aparecen.
  const cambios: Partial<BotChat> = {};
  if (telefono && telefono !== actual.telefono) cambios.telefono = telefono;
  if (nombre && nombre !== actual.nombre) cambios.nombre = nombre;
  if (Object.keys(cambios).length === 0) return actual;
  const [nuevo] = await db.update(botChats).set(cambios).where(eq(botChats.chatId, e.chatId)).returning();
  return nuevo;
}

async function cargarHistorial(chatId: string, sesion: number): Promise<Anthropic.MessageParam[]> {
  const filas = await db
    .select({ rol: botMensajes.rol, contenido: botMensajes.contenido })
    .from(botMensajes)
    .where(and(eq(botMensajes.chatId, chatId), eq(botMensajes.sesion, sesion)))
    .orderBy(asc(botMensajes.orden));
  return filas.map((f) => ({
    role: f.rol === "assistant" ? "assistant" : "user",
    content: f.contenido as Anthropic.MessageParam["content"],
  }));
}

async function guardar(chatId: string, sesion: number, m: Anthropic.MessageParam): Promise<void> {
  // Las horas se ponen desde aquí y no con el now() de la base: así no dependen
  // de la zona horaria de su sesión (PGlite en la Mac usa la local; Neon, UTC).
  await db.insert(botMensajes).values({ chatId, sesion, rol: m.role, contenido: m.content, createdAt: new Date() });
}

/**
 * Si un turno anterior murió entre la llamada a una herramienta y su
 * resultado, el historial termina en un `tool_use` sin respuesta y la API
 * rechazaría TODA la plática. Se le agrega (nunca se edita) el resultado.
 */
export function reparacionDeCola(historial: Anthropic.MessageParam[]): Anthropic.MessageParam | null {
  const ultimo = historial[historial.length - 1];
  if (!ultimo || ultimo.role !== "assistant" || typeof ultimo.content === "string") return null;
  const pendientes = ultimo.content.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use");
  if (pendientes.length === 0) return null;
  return {
    role: "user",
    content: pendientes.map((b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      content: JSON.stringify({ ok: false, error: "Interrumpido. Si hace falta, vuelve a intentarlo." }),
      is_error: true,
    })),
  };
}

// ── Contexto de cada turno ────────────────────────────────────

async function contextoDelTurno(chat: BotChat, primera: boolean, desde: Date | null): Promise<string> {
  const cotizaciones = await cotizacionesDelChat(chat.chatId);
  const enJuego =
    cotizaciones.find((c) => c.estado === "vigente" || c.estado === "comprobante") ?? cotizaciones[0] ?? null;
  // Lo que el hotel le mandó por su cuenta (confirmación, recordatorio) desde
  // la última respuesta del bot: el modelo debe saberlo sin tocar el historial.
  const enviados = desde
    ? await db
        .select({ texto: botSalida.texto })
        .from(botSalida)
        .where(
          and(
            eq(botSalida.chatId, chat.chatId),
            gt(botSalida.enviadoEn, desde),
            notLike(botSalida.motivo, "%:descartado"),
          ),
        )
    : [];
  const telefono = chat.telefono
    ? `se ve: ${telefonoLegible(chat.telefono)}`
    : esLid(chat.chatId)
      ? "NO se ve: si va a cotizar, pídeselo junto con su nombre"
      : "desconocido";
  return [
    "<contexto_del_hotel>",
    `Hoy en el hotel: ${ahoraEnElHotel()}.`,
    `Primera respuesta de esta conversación: ${primera ? "SÍ (preséntate como asistente virtual)" : "no"}.`,
    `Nombre en su perfil de WhatsApp: ${chat.nombre || "(sin nombre)"}.`,
    `Teléfono del huésped: ${telefono}.`,
    `Etapa: ${etapaDe(enJuego)}.`,
    ...(enviados.length > 0
      ? [`Mensajes que el hotel le mandó aparte desde tu última respuesta (ya los vio): ${enviados.map((m) => `«${m.texto.slice(0, 400)}»`).join(" ")}`]
      : []),
    "</contexto_del_hotel>",
  ].join("\n");
}

// ── La vuelta ─────────────────────────────────────────────────

function textosDe(contenido: Anthropic.ContentBlock[]): string {
  return contenido
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Lo que nunca debe llegar al huésped aunque el modelo lo escriba. */
export function pulirRespuesta(t: string): string {
  return t
    .replace(/<\/?\s*(contexto_del_hotel|aviso_interno)[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function procesarTurno(e: EntradaTurno): Promise<ResultadoTurno> {
  const texto = e.mensajes.map(sanearTextoHuesped).filter(Boolean).join("\n");
  if (!texto) return { respuestas: [], alertas: [], silencio: "vacio" };

  await ensureDb();
  // El probador funciona aunque el bot esté apagado: es para probar ANTES de encenderlo.
  const prueba = esChatDePrueba(e.chatId);
  if (!prueba && !(await botActivo())) return { respuestas: [], alertas: [], silencio: "apagado" };

  let chat = await obtenerChat(e);
  const ahora = new Date();
  if (!prueba && chat.pausadoHasta && chat.pausadoHasta.getTime() > ahora.getTime())
    return { respuestas: [], alertas: [], silencio: "pausado" };

  // Sesión nueva tras 24 h de silencio: el historial viejo no se recorta.
  const inactivo = ahora.getTime() - chat.ultimoMensajeEn.getTime() > SESION_INACTIVA_HORAS * 3_600_000;
  const desde = chat.ultimoMensajeEn;
  [chat] = await db
    .update(botChats)
    .set({ ultimoMensajeEn: ahora, ...(inactivo ? { sesion: chat.sesion + 1 } : {}) })
    .where(eq(botChats.chatId, chat.chatId))
    .returning();

  const mensajes = await cargarHistorial(chat.chatId, chat.sesion);
  const reparacion = reparacionDeCola(mensajes);
  if (reparacion) {
    await guardar(chat.chatId, chat.sesion, reparacion);
    mensajes.push(reparacion);
  }

  const turno: Anthropic.MessageParam = {
    role: "user",
    content: [
      { type: "text", text: texto },
      { type: "text", text: await contextoDelTurno(chat, mensajes.length === 0, desde) },
    ],
  };
  await guardar(chat.chatId, chat.sesion, turno);
  mensajes.push(turno);

  const efectos: Efectos = { mensajesFijos: [], alertas: [] };
  const acciones: AccionTurno[] = [];
  const salida: string[] = [];
  const ctx = { chatId: chat.chatId, telefono: chat.telefono, nombrePerfil: chat.nombre };

  try {
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: await promptFijo(todayISO()), cache_control: { type: "ephemeral" } },
    ];
    let reintentoVacio = false;

    for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
      const r = await anthropic().messages.create({
        model: MODELO,
        max_tokens: 4000,
        system,
        tools: HERRAMIENTAS,
        messages: mensajes,
        thinking: { type: "adaptive" },
        output_config: { effort: esfuerzo() },
        // Además del prompt fijo, se cachea la plática hasta el último bloque.
        cache_control: { type: "ephemeral" },
      });
      registrar(chat.chatId, ronda, r);

      const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      let dicho = textosDe(r.content);

      if (!dicho && usos.length === 0) {
        // Turno vacío (o solo razonamiento): no se guarda. Un aviso y otra vez.
        if (reintentoVacio || r.stop_reason === "refusal") break;
        reintentoVacio = true;
        const aviso: Anthropic.MessageParam = {
          role: "user",
          content: [
            {
              type: "text",
              text: "<aviso_interno>Te quedaste sin responder. Responde ahora al huésped con un mensaje de texto. No menciones este aviso.</aviso_interno>",
            },
          ],
        };
        await guardar(chat.chatId, chat.sesion, aviso);
        mensajes.push(aviso);
        continue;
      }

      const respuesta: Anthropic.MessageParam = { role: "assistant", content: r.content };
      await guardar(chat.chatId, chat.sesion, respuesta);
      mensajes.push(respuesta);

      if (efectos.cotizacion) dicho = limpiarEco(dicho, efectos.cotizacion);
      dicho = pulirRespuesta(dicho);
      if (dicho) salida.push(dicho);

      if (usos.length === 0 || r.stop_reason !== "tool_use") break;

      const fijosAntes = efectos.mensajesFijos.length;
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const uso of usos) {
        const res = await ejecutarHerramienta(uso.name, uso.input, ctx, efectos);
        acciones.push({ herramienta: uso.name, entrada: uso.input, ok: !res.esError });
        resultados.push({
          type: "tool_result",
          tool_use_id: uso.id,
          content: res.contenido,
          ...(res.esError ? { is_error: true } : {}),
        });
      }
      const devolucion: Anthropic.MessageParam = { role: "user", content: resultados };
      await guardar(chat.chatId, chat.sesion, devolucion);
      mensajes.push(devolucion);
      salida.push(...efectos.mensajesFijos.slice(fijosAntes));
    }
  } catch (err) {
    console.error(
      `[bot] turno de ${chat.chatId} falló:`,
      err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err,
    );
    efectos.alertas.push(
      alertaFalla({
        nombre: chat.nombre || "Huésped",
        telefono: chat.telefono,
        detalle: err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err),
      }),
    );
  }

  // El resumen de la cotización lo arma el código y no entra al historial (la
  // plática no puede terminar en un mensaje del hotel: sería un "prefill" y la
  // API lo rechaza). Se anota como enviado: el siguiente turno lo ve en el
  // contexto y el panel lo muestra en la plática.
  for (const fijo of efectos.mensajesFijos)
    await db.insert(botSalida).values({
      chatId: chat.chatId,
      texto: fijo,
      motivo: "cotizacion",
      enviadoEn: new Date(),
      createdAt: new Date(),
    });

  if (salida.length === 0) {
    salida.push(DISCULPA);
    if (!efectos.alertas.some((a) => a.tipo === "falla"))
      efectos.alertas.push(
        alertaFalla({ nombre: chat.nombre || "Huésped", telefono: chat.telefono, detalle: "respuesta vacía" }),
      );
  }
  return { respuestas: salida, alertas: efectos.alertas, acciones };
}

/**
 * Anota en la plática algo que pasó fuera de la vuelta normal (llegó un
 * comprobante y el código contestó). Se AGREGA al historial, como todo, para
 * que en el siguiente mensaje el modelo sepa qué se dijo.
 */
export async function agregarIntercambio(
  e: { chatId: string; telefono?: string; nombre?: string },
  delHuesped: string,
  delHotel: string,
): Promise<{ chat: BotChat; pausado: boolean }> {
  await ensureDb();
  let chat = await obtenerChat({ ...e, mensajes: [] });
  const ahora = new Date();
  const pausado = Boolean(chat.pausadoHasta && chat.pausadoHasta.getTime() > ahora.getTime());
  const inactivo = ahora.getTime() - chat.ultimoMensajeEn.getTime() > SESION_INACTIVA_HORAS * 3_600_000;
  [chat] = await db
    .update(botChats)
    .set({ ultimoMensajeEn: ahora, ...(inactivo ? { sesion: chat.sesion + 1 } : {}) })
    .where(eq(botChats.chatId, chat.chatId))
    .returning();
  const historial = await cargarHistorial(chat.chatId, chat.sesion);
  const reparacion = reparacionDeCola(historial);
  if (reparacion) await guardar(chat.chatId, chat.sesion, reparacion);
  await guardar(chat.chatId, chat.sesion, { role: "user", content: [{ type: "text", text: delHuesped }] });
  if (delHotel)
    await guardar(chat.chatId, chat.sesion, { role: "assistant", content: [{ type: "text", text: delHotel }] });
  return { chat, pausado };
}

/** Una línea por llamada: sin esto, un turno vacío o la caché rota son invisibles. */
function registrar(chatId: string, ronda: number, r: Anthropic.Message): void {
  const u = r.usage;
  console.log(
    JSON.stringify({
      bot: "turno",
      chat: chatId.slice(-6),
      ronda,
      stop: r.stop_reason,
      bloques: r.content.map((b) => b.type).join(","),
      entrada: u.input_tokens,
      cache_lee: u.cache_read_input_tokens ?? 0,
      cache_escribe: u.cache_creation_input_tokens ?? 0,
      salida: u.output_tokens,
    }),
  );
}
