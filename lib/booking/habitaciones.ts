// ============================================================
// HABITACIONES DESDE EL PANEL — fotos y precios por persona
//
// Gersay cambia aquí lo que antes solo se cambiaba con `npm run db:tarifas`:
// el precio de la noche según cuánta gente entra y las fotos de cada tipo.
//
//   · Los precios van por persona (posición 0 = 1 persona), igual que
//     `room_types.precios`. Cuántos precios hay = cuánta gente cabe, así que
//     guardar también fija `capacidad`. `tarifaBase` (el "desde" de portada y
//     /habitaciones) pasa a ser el más barato de la lista.
//   · Las fotos subidas viven en la tabla `fotos_subidas` y se sirven en
//     `/fotos/<id>.jpg`. Las de siempre (`/imagenes/…`) siguen en public/.
//   · Lo ya reservado no cambia: el total se congela en `bookings.total`.
// ============================================================
import { eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { fotosSubidas, roomTypes } from "@/lib/db/schema";
import { HIDDEN_SLUGS } from "./engine";

export const MAX_FOTOS = 12;
export const MAX_PERSONAS = 10;
const PRECIO_MIN = 100;
const PRECIO_MAX = 50_000;
// El navegador ya reduce la foto a ~300 KB antes de subirla; esto solo frena
// una subida sin reducir (Vercel corta las peticiones de más de 4.5 MB).
const MAX_BYTES = 3 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const RE_ESTATICA = /^\/imagenes\/[a-z0-9._-]+\.(jpe?g|png|webp)$/i;
const RE_SUBIDA = /^\/fotos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i;

type Resultado = { ok: true } | { ok: false; error: string };

/** Tipo real del archivo por sus primeros bytes (no por lo que diga el navegador). */
function tipoPorFirma(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

function urlDeFoto(id: string, tipo: string): string {
  return `/fotos/${id}.${EXTENSION[tipo] ?? "jpg"}`;
}

/** Id de una foto subida a partir de su URL; null si es de public/ o no es nuestra. */
function idDeUrl(url: string): string | null {
  return RE_SUBIDA.exec(url)?.[1]?.toLowerCase() ?? null;
}

// ── Fotos ───────────────────────────────────────────────────
export async function guardarFoto(
  buf: Buffer,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const tipo = tipoPorFirma(buf);
  if (!tipo) return { ok: false, error: "Ese archivo no es una foto JPG, PNG o WebP." };
  if (buf.length > MAX_BYTES)
    return { ok: false, error: "La foto pesa demasiado (máximo 3 MB)." };
  await ensureDb();
  const [fila] = await db
    .insert(fotosSubidas)
    .values({ tipo, datos: buf.toString("base64"), bytes: buf.length })
    .returning({ id: fotosSubidas.id });
  return { ok: true, url: urlDeFoto(fila.id, tipo) };
}

/** Lee una foto subida por su nombre de archivo (`<id>.jpg`). */
export async function leerFoto(
  archivo: string,
): Promise<{ tipo: string; datos: Buffer } | null> {
  const id = idDeUrl(`/fotos/${archivo}`);
  if (!id) return null;
  await ensureDb();
  const [fila] = await db
    .select({ tipo: fotosSubidas.tipo, datos: fotosSubidas.datos })
    .from(fotosSubidas)
    .where(eq(fotosSubidas.id, id))
    .limit(1);
  if (!fila) return null;
  return { tipo: fila.tipo, datos: Buffer.from(fila.datos, "base64") };
}

/**
 * Borra las fotos subidas que ya no usa ninguna habitación. Solo las de más de
 * un día: una foto recién subida todavía no está guardada en su habitación
 * (Gersay puede estar a media edición) y no hay que borrársela.
 */
async function limpiarFotosHuerfanas(): Promise<void> {
  const viejas = await db
    .select({ id: fotosSubidas.id })
    .from(fotosSubidas)
    .where(lt(fotosSubidas.createdAt, sql`now() - interval '1 day'`));
  if (viejas.length === 0) return;
  const tipos = await db.select({ fotos: roomTypes.fotos }).from(roomTypes);
  const usadas = new Set(tipos.flatMap((t) => t.fotos.map(idDeUrl)));
  const huerfanas = viejas.map((f) => f.id).filter((id) => !usadas.has(id));
  if (huerfanas.length > 0)
    await db.delete(fotosSubidas).where(inArray(fotosSubidas.id, huerfanas));
}

// ── Precios y fotos de un tipo ──────────────────────────────
function validarPrecios(precios: unknown): number[] | string {
  if (!Array.isArray(precios) || precios.length === 0)
    return "Pon al menos el precio para 1 persona.";
  if (precios.length > MAX_PERSONAS)
    return `El máximo es de ${MAX_PERSONAS} personas por habitación.`;
  const salida: number[] = [];
  for (const [i, p] of precios.entries()) {
    const n = Number(p);
    const quien = i === 0 ? "1 persona" : `${i + 1} personas`;
    if (!Number.isInteger(n) || n < PRECIO_MIN || n > PRECIO_MAX)
      return `El precio para ${quien} debe ser un número entero entre $${PRECIO_MIN} y $${PRECIO_MAX.toLocaleString("es-MX")}.`;
    salida.push(n);
  }
  return salida;
}

async function validarFotos(fotos: unknown, actuales: string[]): Promise<string[] | string> {
  if (!Array.isArray(fotos) || fotos.length === 0)
    return "Deja al menos una foto: la primera es la portada en el sitio.";
  if (fotos.length > MAX_FOTOS) return `Máximo ${MAX_FOTOS} fotos por habitación.`;
  const lista = fotos.map(String);
  if (new Set(lista).size !== lista.length) return "Hay una foto repetida.";

  const ids: string[] = [];
  for (const url of lista) {
    const id = idDeUrl(url);
    if (id) ids.push(id);
    // Las de public/ solo pueden ser las que la habitación ya tenía: el panel
    // no tiene forma de elegir otras, así que cualquier otra ruta es basura.
    else if (!RE_ESTATICA.test(url) || !actuales.includes(url))
      return "Una de las fotos no es válida. Recarga la página e inténtalo de nuevo.";
  }
  if (ids.length > 0) {
    const existen = await db
      .select({ id: fotosSubidas.id })
      .from(fotosSubidas)
      .where(inArray(fotosSubidas.id, ids));
    if (existen.length !== new Set(ids).size)
      return "Una de las fotos ya no existe. Súbela otra vez.";
  }
  return lista;
}

export async function actualizarHabitacion(
  id: string,
  input: { precios: unknown; fotos: unknown },
): Promise<Resultado> {
  await ensureDb();
  const [actual] = await db.select().from(roomTypes).where(eq(roomTypes.id, id)).limit(1);
  if (!actual) return { ok: false, error: "Esa habitación ya no existe." };
  if (HIDDEN_SLUGS.has(actual.slug))
    return { ok: false, error: "Esa habitación no se edita desde aquí." };

  const precios = validarPrecios(input.precios);
  if (typeof precios === "string") return { ok: false, error: precios };
  const fotos = await validarFotos(input.fotos, actual.fotos);
  if (typeof fotos === "string") return { ok: false, error: fotos };

  await db
    .update(roomTypes)
    .set({
      precios,
      capacidad: precios.length,
      tarifaBase: Math.min(...precios),
      fotos,
    })
    .where(eq(roomTypes.id, id));

  await limpiarFotosHuerfanas();
  return { ok: true };
}
