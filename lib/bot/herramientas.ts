// ============================================================
// HERRAMIENTAS DEL BOT — lo único que la IA puede HACER
// Cuatro, a propósito: con menos opciones Haiku se equivoca menos. Cada una
// llama al motor de reservas del sitio; ninguna calcula precios por su lado.
// ============================================================
import type Anthropic from "@anthropic-ai/sdk";
import type { BotCotizacion } from "../db/schema";
import { formatMXN } from "../booking/engine";
import { alertaCotizacion, alertaPersona, type Alerta } from "./alertas";
import {
  cotizacionPorFolio,
  cotizacionesDelChat,
  crearCotizacion,
  type HabitacionCotizada,
} from "./cotizacion";
import { consultarDisponibilidad } from "./disponibilidad";
import { cuandoVence, esIso } from "./fechas";
import { diezDigitos, telefonoMx } from "./telefono";

export const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "consultar_disponibilidad",
    description:
      "Revisa EN TIEMPO REAL qué habitaciones hay libres y cuánto cuesta la estancia completa para unas fechas y un número de personas (ya con temporadas). Úsala SIEMPRE antes de dar un precio o de decir que hay lugar. Para 5 o más personas también propone combinaciones de varios cuartos. Si no hay lugar, trae fechas alternativas.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        checkin: { type: "string", description: "Fecha de llegada, AAAA-MM-DD." },
        checkout: { type: "string", description: "Fecha de salida (el día que se van), AAAA-MM-DD." },
        huespedes: { type: "integer", description: "Total de personas, contando menores." },
      },
      required: ["checkin", "checkout", "huespedes"],
      additionalProperties: false,
    },
  },
  {
    name: "crear_cotizacion",
    description:
      "Aparta los cuartos y genera la cotización con folio, total, anticipo y datos para transferir. El resumen se le envía al huésped automáticamente. Úsala solo después de consultar_disponibilidad, cuando el huésped ya eligió y te dio su nombre. Si ya tenía una cotización sin pagar, esta la reemplaza.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del huésped." },
        checkin: { type: "string", description: "AAAA-MM-DD" },
        checkout: { type: "string", description: "AAAA-MM-DD" },
        habitaciones: {
          type: "array",
          description: "Un elemento por cuarto, con el slug que dio consultar_disponibilidad y cuántas personas duermen en él.",
          items: {
            type: "object",
            properties: {
              slug: { type: "string" },
              huespedes: { type: "integer" },
            },
            required: ["slug", "huespedes"],
            additionalProperties: false,
          },
        },
        telefono: {
          type: "string",
          description: "Solo si el contexto dice que su teléfono no se ve: el que te dio el huésped. Si no aplica, cadena vacía.",
        },
        email: { type: "string", description: "Correo del huésped si lo dio; si no, cadena vacía." },
      },
      required: ["nombre", "checkin", "checkout", "habitaciones", "telefono", "email"],
      additionalProperties: false,
    },
  },
  {
    name: "ver_mi_reserva",
    description:
      "Consulta las cotizaciones y reservas de ESTE huésped: si ya quedó confirmada, cuánto le falta pagar, hasta cuándo está apartada. Úsala cuando pregunte por su reserva o su folio.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        folio: { type: "string", description: "Folio MC-XXXX si lo mencionó; si no, cadena vacía." },
      },
      required: ["folio"],
      additionalProperties: false,
    },
  },
  {
    name: "pasar_con_persona",
    description:
      "Avisa al equipo del hotel para que una persona atienda este chat. Úsala si pide hablar con alguien, está molesto, quiere cancelar o cambiar una reserva pagada, o pregunta algo que no está en tu información.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "En pocas palabras: por qué necesita a una persona." },
        resumen: { type: "string", description: "Lo que el equipo debe saber de la plática (fechas, personas, dudas)." },
      },
      required: ["motivo", "resumen"],
      additionalProperties: false,
    },
  },
];

export type ContextoHerramientas = {
  chatId: string;
  telefono: string; // 52… si se conoce
  nombrePerfil: string;
};

/** Lo que una herramienta deja además de su respuesta para el modelo. */
export type Efectos = {
  mensajesFijos: string[]; // se mandan al huésped TAL CUAL (los arma el código)
  alertas: Alerta[];
  cotizacion?: BotCotizacion; // la recién creada (para limpiar ecos del modelo)
};

type Salida = { contenido: string; esError?: boolean };

const json = (v: unknown): Salida => ({ contenido: JSON.stringify(v) });
const error = (mensaje: string): Salida => ({ contenido: JSON.stringify({ ok: false, error: mensaje }), esError: true });

export async function ejecutarHerramienta(
  nombre: string,
  entrada: unknown,
  ctx: ContextoHerramientas,
  efectos: Efectos,
): Promise<Salida> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  try {
    switch (nombre) {
      case "consultar_disponibilidad": {
        if (!esIso(e.checkin) || !esIso(e.checkout))
          return error("Usa fechas en formato AAAA-MM-DD.");
        const huespedes = Math.floor(Number(e.huespedes));
        if (!(huespedes >= 1)) return error("Indica cuántas personas son (al menos 1).");
        if (huespedes > 30) return error("Para grupos de más de 30 personas pasa con una persona.");
        return json(await consultarDisponibilidad({ checkin: e.checkin, checkout: e.checkout, huespedes }));
      }

      case "crear_cotizacion": {
        if (!esIso(e.checkin) || !esIso(e.checkout)) return error("Usa fechas en formato AAAA-MM-DD.");
        const habitaciones = Array.isArray(e.habitaciones)
          ? (e.habitaciones as { slug?: unknown; huespedes?: unknown }[]).map((h) => ({
              slug: String(h?.slug ?? ""),
              huespedes: Number(h?.huespedes),
            }))
          : [];
        const telefono = ctx.telefono || telefonoMx(e.telefono);
        const r = await crearCotizacion({
          chatId: ctx.chatId,
          telefono,
          nombre: String(e.nombre ?? ""),
          email: typeof e.email === "string" ? e.email : null,
          checkin: e.checkin,
          checkout: e.checkout,
          habitaciones,
        });
        if (!r.ok) return error(r.error);
        efectos.mensajesFijos.push(r.resumen);
        efectos.alertas.push(alertaCotizacion(r.cotizacion, r.reemplazo));
        efectos.cotizacion = r.cotizacion;
        return json({
          ok: true,
          folio: r.cotizacion.folio,
          resumen_ya_enviado: true,
          apartado_vence: cuandoVence(r.cotizacion.apartadoHasta),
          ...(r.reemplazo ? { reemplazo_a: r.reemplazo } : {}),
          nota: "El huésped YA recibió el resumen con folio, montos y datos para transferir. No los repitas: agrega solo una línea breve.",
        });
      }

      case "ver_mi_reserva": {
        const folio = String(e.folio ?? "").trim();
        let lista = await cotizacionesDelChat(ctx.chatId);
        if (folio) {
          const c = await cotizacionPorFolio(folio);
          // Un folio ajeno no se enseña: solo si es de este chat o de su teléfono.
          const suyo =
            c &&
            (c.chatId === ctx.chatId ||
              (diezDigitos(c.telefono) !== "" && diezDigitos(c.telefono) === diezDigitos(ctx.telefono)));
          lista = suyo ? [c, ...lista.filter((x) => x.folio !== c.folio)] : lista;
          if (!suyo && lista.length === 0)
            return json({ ok: true, encontradas: [], nota: `No encontré el folio ${folio.toUpperCase()} en esta conversación.` });
        }
        return json({
          ok: true,
          encontradas: lista.slice(0, 3).map((c) => ({
            folio: c.folio,
            estado: ESTADOS[c.estado] ?? c.estado,
            llegada: c.checkin,
            salida: c.checkout,
            personas: c.huespedes,
            cuartos: (c.habitaciones as HabitacionCotizada[]).map((h) => `${h.nombre} (${h.huespedes}p)`),
            total: formatMXN(c.total),
            anticipo: formatMXN(c.anticipo),
            resta_al_llegar: formatMXN(c.saldo),
            ...(c.estado === "vigente" ? { apartado_vence: cuandoVence(c.apartadoHasta) } : {}),
          })),
        });
      }

      case "pasar_con_persona": {
        efectos.alertas.push(
          alertaPersona({
            nombre: ctx.nombrePerfil || "Huésped",
            telefono: ctx.telefono,
            motivo: String(e.motivo ?? "").slice(0, 200),
            resumen: String(e.resumen ?? "").slice(0, 600),
          }),
        );
        return json({
          ok: true,
          nota: "Ya avisaste al equipo. Dile que una persona del hotel le escribe por aquí en cuanto pueda; no prometas un tiempo exacto.",
        });
      }

      default:
        return error(`No existe la acción ${nombre}.`);
    }
  } catch (err) {
    console.error(`[bot] la herramienta ${nombre} falló:`, err);
    return error("No se pudo completar en este momento. Intenta de nuevo o pasa con una persona.");
  }
}

const ESTADOS: Record<string, string> = {
  vigente: "apartada, esperando el comprobante de transferencia",
  comprobante: "comprobante recibido, el equipo lo está revisando",
  confirmada: "CONFIRMADA",
  reemplazada: "reemplazada por una cotización más nueva",
  vencida: "venció sin pago (los cuartos ya no están apartados)",
  cancelada: "cancelada",
};
