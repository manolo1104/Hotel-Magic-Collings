// ============================================================
// TELÉFONOS DE WHATSAPP — de cualquier formato a uno solo
// WhatsApp da el número como "5214811009939@c.us", a veces sin el 1 de
// celular, y en cuentas nuevas como "…@lid": un id interno que NO es el
// teléfono. Copiado de la lógica de Camila (mi-hotel/agentes/whatsapp-agent).
// ============================================================

export function soloDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** ¿El chat es @lid? Su número NO es el teléfono del huésped. */
export function esLid(chatId: string): boolean {
  return /@lid$/i.test(chatId.trim());
}

/**
 * Teléfono mexicano en formato `52` + 10 dígitos (sirve para wa.me), o "" si
 * no parece un teléfono de México. Acepta 10 dígitos, 52…, 521… y +52 1 ….
 */
export function telefonoMx(v: unknown): string {
  const d = soloDigitos(v);
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length === 13 && d.startsWith("521")) return `52${d.slice(3)}`;
  return "";
}

/**
 * El teléfono que se puede deducir de un chat: el de un `@c.us`, nunca el de
 * un `@lid` (ahí los dígitos son un id interno y darían un wa.me a nadie).
 */
export function telefonoDeChat(chatId: string): string {
  if (esLid(chatId)) return "";
  return telefonoMx(chatId.split("@")[0]);
}

/** Últimos 10 dígitos, para comparar números escritos de formas distintas. */
export function diezDigitos(v: unknown): string {
  const d = soloDigitos(v);
  return d.length >= 10 ? d.slice(-10) : "";
}

/** "524811009939" → "481 100 9939" (como lo escribe la gente en México). */
export function telefonoLegible(tel: string): string {
  const d = diezDigitos(tel);
  if (!d) return tel;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Enlace para abrir el chat con el huésped desde otro teléfono. */
export function waMe(tel: string): string {
  const t = telefonoMx(tel);
  return t ? `https://wa.me/${t}` : "";
}
