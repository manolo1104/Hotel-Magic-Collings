// ============================================================
// CONFIGURACIÓN DEL BOT DE WHATSAPP
// Todo lo que cambia sin tocar código vive en variables de entorno (Vercel).
// ============================================================
import { eq } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { appState } from "../db/schema";

// Haiku 5.5: $0.10 / $0.50 por millón de tokens y caché desde 512 tokens.
export const MODELO = process.env.BOT_MODEL?.trim() || "claude-haiku-5-5";

type Esfuerzo = "low" | "medium" | "high";
export function esfuerzo(): Esfuerzo {
  const v = process.env.BOT_EFFORT?.trim();
  return v === "low" || v === "high" ? v : "medium";
}

/** Horas que se aparta un cuarto cotizado mientras el huésped transfiere. */
export const APARTADO_MIN = 180;
/** Con comprobante recibido se alarga para que Gersay alcance a revisarlo. */
export const APARTADO_CON_COMPROBANTE_MIN = 24 * 60;
/** Si Gersay escribe a mano en un chat, el bot se calla ahí estas horas. */
export const PAUSA_HUMANA_HORAS = 12;
/** Sin mensajes durante este tiempo, la plática empieza una sesión nueva. */
export const SESION_INACTIVA_HORAS = 24;
/** Rondas máximas de herramientas por turno (Camila usa 6). */
export const MAX_RONDAS = 6;
/** Cuartos máximos en una sola cotización (el hotel tiene 7). */
export const MAX_CUARTOS = 7;

// ── Cierre de temporada ───────────────────────────────────────
// Decisión de Manolo (20 oct 2026): el hotel está CERRADO hasta el 31 dic y
// los bloqueos se quedan. El aviso caduca solo: desde el 1 ene ya no se dice.
export const CIERRE = {
  hasta: "2026-12-31", // última noche cerrada
  reabre: "2027-01-01",
};

export function cierreVigente(hoyISO: string): boolean {
  return hoyISO <= CIERRE.hasta;
}

// ── Datos para transferir ─────────────────────────────────────
export type DatosBancarios = { banco: string; clabe: string; titular: string; cuenta: string };

export function datosBancarios(): DatosBancarios | null {
  const banco = process.env.BANK_BANCO?.trim() ?? "";
  const clabe = (process.env.BANK_CLABE ?? "").replace(/\D/g, "");
  const titular = process.env.BANK_TITULAR?.trim() ?? "";
  const cuenta = (process.env.BANK_CUENTA ?? "").replace(/\D/g, "");
  if (!banco || !titular) return null;
  // Un dígito mal tecleado mandaría el dinero de los huéspedes a otra cuenta
  // (o a ninguna): mejor no dar datos y que Gersay los mande a mano.
  if (!clabeValida(clabe)) {
    console.error("[bot] BANK_CLABE no es una CLABE válida (18 dígitos con dígito verificador).");
    return null;
  }
  return { banco, clabe, titular, cuenta };
}

/** CLABE de 18 dígitos cuyo último dígito cuadra con el algoritmo de Banxico (pesos 3,7,1). */
export function clabeValida(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  const pesos = [3, 7, 1];
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += (Number(clabe[i]) * pesos[i % 3]) % 10;
  return (10 - (suma % 10)) % 10 === Number(clabe[17]);
}

// ── Interruptor general ───────────────────────────────────────
// Se guarda como TEXTO en app_state y se compara como texto. (El de Paraíso
// comparaba 'false' contra un booleano de Google Sheets y nunca apagó nada.)
const CLAVE_ACTIVO = "bot_activo";

export async function botActivo(): Promise<boolean> {
  if (process.env.BOT_ENABLED?.trim() === "0") return false;
  await ensureDb();
  const [fila] = await db
    .select({ valor: appState.valor })
    .from(appState)
    .where(eq(appState.clave, CLAVE_ACTIVO))
    .limit(1);
  return interpretarInterruptor(fila?.valor);
}

/** Sin fila = encendido. Solo "apagado" lo apaga. */
export function interpretarInterruptor(valor: string | undefined | null): boolean {
  return (valor ?? "").trim().toLowerCase() !== "apagado";
}

export async function ponerBotActivo(activo: boolean): Promise<void> {
  await ensureDb();
  const valor = activo ? "encendido" : "apagado";
  await db
    .insert(appState)
    .values({ clave: CLAVE_ACTIVO, valor })
    .onConflictDoUpdate({ target: appState.clave, set: { valor, updatedAt: new Date() } });
}

// ── ¿El puente de WhatsApp está vivo? ─────────────────────────
// El puente pregunta por pendientes cada minuto; cada pregunta se anota aquí.
// Así el panel distingue "encendido" de "conectado de verdad".
const CLAVE_PUENTE = "bot_puente_visto";

export async function anotarPuenteVivo(): Promise<void> {
  const valor = new Date().toISOString();
  await db
    .insert(appState)
    .values({ clave: CLAVE_PUENTE, valor })
    .onConflictDoUpdate({ target: appState.clave, set: { valor, updatedAt: new Date() } });
}

/** Última vez que el puente se reportó, o null si nunca. */
export async function puenteVisto(): Promise<Date | null> {
  await ensureDb();
  const [fila] = await db.select({ valor: appState.valor }).from(appState).where(eq(appState.clave, CLAVE_PUENTE)).limit(1);
  const d = fila ? new Date(fila.valor) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

// ── Autenticación del puente ──────────────────────────────────
/** Compara sin filtrar información por el tiempo que tarda. */
export function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * ¿La petición viene del puente de WhatsApp? `null` = el bot no está
 * configurado (la ruta debe responder 404, como si no existiera).
 */
export function autorizadoPuente(authorization: string | null): boolean | null {
  const secreto = process.env.BOT_SECRET?.trim();
  if (!secreto) return null;
  const recibido = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  return igualSeguro(recibido, secreto);
}
