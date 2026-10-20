// ============================================================
// COMPROBANTES DE TRANSFERENCIA — imagen o PDF que manda el huésped
// Haiku LEE el monto, la fecha y el banco solo para que Gersay compare de un
// vistazo. Nunca confirma nada: la reserva se confirma cuando Gersay ve el
// dinero en su cuenta (comando con PIN o botón del panel).
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { formatMXN } from "../booking/engine";
import { alertaComprobante, type Alerta } from "./alertas";
import { agregarIntercambio } from "./cerebro";
import { MODELO, botActivo } from "./config";
import { cotizacionVigente, registrarComprobante } from "./cotizacion";
import { esChatDePrueba } from "./prueba";

export type Lectura = {
  esComprobante: boolean;
  monto: number | null;
  fecha: string;
  banco: string;
};

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type TipoImagen = (typeof TIPOS_IMAGEN)[number];

export function tipoAceptado(mime: string): "imagen" | "pdf" | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if ((TIPOS_IMAGEN as readonly string[]).includes(m)) return "imagen";
  if (m === "application/pdf") return "pdf";
  return null;
}

/** Saca el JSON de la respuesta aunque venga con texto alrededor. */
export function interpretarLectura(texto: string): Lectura | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const monto = Number(String(o.monto ?? "").replace(/[^\d.]/g, ""));
    return {
      esComprobante: o.es_comprobante === true,
      monto: Number.isFinite(monto) && monto > 0 ? Math.round(monto) : null,
      fecha: String(o.fecha ?? "").slice(0, 40),
      banco: String(o.banco ?? "").slice(0, 60),
    };
  } catch {
    return null;
  }
}

async function leer(mime: string, base64: string): Promise<Lectura | null> {
  const tipo = tipoAceptado(mime);
  if (!tipo) return null;
  const archivo: Anthropic.ContentBlockParam =
    tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mime.split(";")[0].trim() as TipoImagen, data: base64 } };
  try {
    const r = await new Anthropic({ maxRetries: 1, timeout: 30_000 }).messages.create({
      model: MODELO,
      max_tokens: 400,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            archivo,
            {
              type: "text",
              text: 'Este archivo lo mandó un huésped de un hotel por WhatsApp. Responde SOLO un JSON en una línea: {"es_comprobante": true|false (¿es un comprobante de transferencia o depósito bancario?), "monto": número en pesos o null, "fecha": "fecha de la operación tal como aparece" o "", "banco": "banco emisor" o ""}',
            },
          ],
        },
      ],
    });
    const texto = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return interpretarLectura(texto);
  } catch (err) {
    console.error("[bot] no se pudo leer el comprobante:", err);
    return null;
  }
}

export function describirLectura(l: Lectura | null, esperado?: number): string {
  if (!l || !l.esComprobante) return "";
  const partes = [
    l.monto != null ? formatMXN(l.monto) : "monto ilegible",
    l.fecha && `fecha ${l.fecha}`,
    l.banco && `banco ${l.banco}`,
  ].filter(Boolean);
  const cuadra =
    esperado != null && l.monto != null
      ? l.monto === esperado
        ? " ✓ coincide con el anticipo"
        : ` ⚠️ NO coincide con lo esperado (${formatMXN(esperado)})`
      : "";
  return partes.join(", ") + cuadra;
}

export type ResultadoComprobante = { respuestas: string[]; alertas: Alerta[]; silencio?: "apagado" | "pausado" };

export async function procesarComprobante(e: {
  chatId: string;
  telefono?: string;
  nombre?: string;
  mime: string;
  base64: string;
}): Promise<ResultadoComprobante> {
  if (!esChatDePrueba(e.chatId) && !(await botActivo()))
    return { respuestas: [], alertas: [], silencio: "apagado" };

  const [lectura, vigente] = await Promise.all([leer(e.mime, e.base64), cotizacionVigente(e.chatId)]);

  // Sin cotización y sin pinta de comprobante: es otra cosa (una foto, un meme).
  if (!vigente && lectura && !lectura.esComprobante) {
    const respuesta =
      "¡Gracias! Por aquí solo puedo revisar comprobantes de pago. Cuéntame por escrito en qué te ayudo y con gusto lo vemos 🙂";
    const { pausado } = await agregarIntercambio(e, "[El huésped mandó una imagen que no es un comprobante de pago]", respuesta);
    return pausado ? { respuestas: [], alertas: [], silencio: "pausado" } : { respuestas: [respuesta], alertas: [] };
  }

  const r = await registrarComprobante(e.chatId, describirLectura(lectura));
  const c = r.cotizacion;
  const lecturaTexto = describirLectura(lectura, c?.anticipo);
  const nombre = (c?.nombre || e.nombre || "").split(" ")[0];
  const respuesta = !c
    ? "¡Gracias! Recibí tu comprobante 🙌 Se lo paso al equipo del hotel para revisarlo y te escriben por aquí."
    : r.cuartoOcupado
      ? `¡Gracias${nombre ? `, ${nombre}` : ""}! Recibí tu comprobante 🙌 Lo reviso con el equipo y te escribimos en breve por aquí.`
      : `¡Gracias${nombre ? `, ${nombre}` : ""}! Recibí tu comprobante del folio ${c.folio} 🙌 El equipo lo revisa y, en cuanto se refleje el pago, te mando la confirmación por aquí. Tu lugar queda apartado mientras tanto.`;

  const alerta = alertaComprobante({
    cotizacion: c,
    nombre: e.nombre || "Huésped",
    telefono: c?.telefono || e.telefono || "",
    lectura: lecturaTexto,
    apartadoVencido: r.apartadoVencido,
    cuartoOcupado: r.cuartoOcupado,
  });
  const { pausado } = await agregarIntercambio(
    e,
    `[El huésped mandó su comprobante de pago${c ? ` del folio ${c.folio}` : ""}${lecturaTexto ? `: ${lecturaTexto}` : ""}]`,
    respuesta,
  );
  // Con una persona atendiendo el chat, el bot no contesta, pero Gersay
  // igual recibe el aviso: el comprobante es dinero.
  return pausado
    ? { respuestas: [], alertas: [alerta], silencio: "pausado" }
    : { respuestas: [respuesta], alertas: [alerta] };
}
