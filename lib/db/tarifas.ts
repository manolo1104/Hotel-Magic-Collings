// ============================================================
// APLICAR LA ESTRUCTURA Y TARIFAS REALES A UNA BASE YA EXISTENTE
//
//   npm run db:tarifas -- matrimonial=2 king-size=1 doble-queen=2 depa-queen=1 depa-matrimonial=1
//
// El sembrado normal (`ensureDb`) solo corre con la base VACÍA, así que para
// producción hace falta esto. El script:
//   · crea o actualiza cada tipo de `seed-data.ts` (nombre, precios, capacidad…)
//   · ajusta el número de cuartos físicos de cada tipo al que se le indique
//   · NUNCA borra un cuarto que tenga reservas o bloqueos: lo desactiva
//     (`activa = false`), que deja de venderse pero conserva el historial
//   · avisa de los tipos viejos que se quedan sin usar, sin tocarlos
//
// Es idempotente: correrlo dos veces no cambia nada la segunda.
// Sin argumentos solo actualiza precios y textos, sin tocar la estructura.
//
// ⚠️ Usa la DATABASE_URL del entorno. `.env.local` apunta a PRODUCCIÓN.
// ============================================================
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { ensureDb } from "./ensure";
import { roomTypes, rooms, bookings, blocks } from "./schema";
import { roomTypeSeed } from "./seed-data";

/** "matrimonial=2" → { slug: "matrimonial", unidades: 2 } */
function leerArgumentos(): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const arg of process.argv.slice(2)) {
    const [slug, valor] = arg.split("=");
    const n = Number(valor);
    if (!slug || !Number.isInteger(n) || n < 0) {
      console.error(`Argumento inválido: "${arg}". Formato: slug=cantidad`);
      process.exit(1);
    }
    if (!roomTypeSeed.some((t) => t.slug === slug)) {
      console.error(
        `El tipo "${slug}" no existe en seed-data.ts. Tipos válidos: ${roomTypeSeed
          .map((t) => t.slug)
          .join(", ")}`,
      );
      process.exit(1);
    }
    mapa.set(slug, n);
  }
  return mapa;
}

/**
 * Prefijo de numeración para cada tipo, garantizando que dos tipos NUNCA
 * compartan prefijo. "depa-queen" y "depa-matrimonial" empiezan igual, y sin
 * esto los dos generaban cuartos "DEP-01": el panel mostraría dos cuartos con
 * el mismo número y nadie sabría cuál es cuál.
 * Se prueban candidatos de más corto a más largo hasta encontrar uno libre.
 */
function prefijosPorSlug(): Map<string, string> {
  const salida = new Map<string, string>();
  const usados = new Set<string>();
  for (const t of roomTypeSeed) {
    const partes = t.slug.split("-").filter(Boolean);
    const candidatos = [
      partes.map((p) => p[0]).join(""), // king-size → KS
      t.slug.replace(/-/g, "").slice(0, 3), // depa-queen → DEP
      t.slug.replace(/-/g, "").slice(0, 4), // depa-queen → DEPA
      t.slug.replace(/-/g, "").slice(0, 6),
    ].map((c) => c.toUpperCase());
    const elegido = candidatos.find((c) => c.length > 0 && !usados.has(c)) ?? t.slug.toUpperCase();
    usados.add(elegido);
    salida.set(t.slug, elegido);
  }
  return salida;
}

/** Cuartos que ya no se pueden borrar porque tienen historial. */
async function cuartosConHistorial(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [conReserva, conBloqueo] = await Promise.all([
    db.select({ roomId: bookings.roomId }).from(bookings).where(inArray(bookings.roomId, ids)),
    db.select({ roomId: blocks.roomId }).from(blocks).where(inArray(blocks.roomId, ids)),
  ]);
  return new Set([...conReserva, ...conBloqueo].map((r) => r.roomId));
}

async function main() {
  const unidades = leerArgumentos();
  const soloPrecios = unidades.size === 0;

  await ensureDb();
  const existentes = await db.select().from(roomTypes);
  const porSlug = new Map(existentes.map((t) => [t.slug, t]));
  const prefijos = prefijosPorSlug();

  console.log(soloPrecios ? "\nModo: solo precios y textos\n" : "\nModo: estructura + precios\n");

  for (const semilla of roomTypeSeed) {
    const previo = porSlug.get(semilla.slug);
    const campos = {
      nombre: semilla.nombre,
      descripcion: semilla.descripcion,
      capacidad: semilla.capacidad,
      tarifaBase: semilla.tarifaBase,
      precios: [...semilla.precios],
      amenidades: [...semilla.amenidades],
      fotos: [...semilla.fotos],
    };

    let tipoId: string;
    if (previo) {
      await db.update(roomTypes).set(campos).where(eq(roomTypes.id, previo.id));
      tipoId = previo.id;
      console.log(`  ✓ ${semilla.nombre} — precios ${JSON.stringify(semilla.precios)}`);
    } else {
      if (soloPrecios) {
        console.log(`  · ${semilla.nombre} — no existe todavía (dale unidades para crearlo)`);
        continue;
      }
      const [creado] = await db
        .insert(roomTypes)
        .values({ slug: semilla.slug, ...campos })
        .returning({ id: roomTypes.id });
      tipoId = creado.id;
      console.log(`  + ${semilla.nombre} — CREADO, precios ${JSON.stringify(semilla.precios)}`);
    }

    // ── Cuartos físicos ─────────────────────────────────────
    const objetivo = unidades.get(semilla.slug);
    if (objetivo === undefined) continue;

    const actuales = await db.select().from(rooms).where(eq(rooms.roomTypeId, tipoId));
    const activos = actuales.filter((r) => r.activa);

    if (activos.length < objetivo) {
      // Primero reactiva los que estén apagados, y solo crea los que falten.
      const apagados = actuales.filter((r) => !r.activa).slice(0, objetivo - activos.length);
      if (apagados.length > 0) {
        await db
          .update(rooms)
          .set({ activa: true })
          .where(inArray(rooms.id, apagados.map((r) => r.id)));
        console.log(`      ↑ reactivados ${apagados.length} cuarto(s)`);
      }
      const faltan = objetivo - activos.length - apagados.length;
      if (faltan > 0) {
        // Numeración estable: prefijo propio del tipo + consecutivo. Se
        // comprueba contra TODOS los cuartos del hotel, no solo los de este
        // tipo, para que no haya dos cuartos con el mismo número.
        const prefijo = prefijos.get(semilla.slug) ?? semilla.slug.slice(0, 3).toUpperCase();
        const usados = new Set((await db.select({ n: rooms.numero }).from(rooms)).map((r) => r.n));
        const nuevos: { roomTypeId: string; numero: string }[] = [];
        for (let i = 1; nuevos.length < faltan; i++) {
          const numero = `${prefijo}-${String(i).padStart(2, "0")}`;
          if (!usados.has(numero)) nuevos.push({ roomTypeId: tipoId, numero });
        }
        await db.insert(rooms).values(nuevos);
        console.log(`      + creados ${nuevos.map((n) => n.numero).join(", ")}`);
      }
    } else if (activos.length > objetivo) {
      // Sobran: se apagan los más nuevos primero para conservar los históricos.
      const sobran = activos.slice(objetivo);
      const conHistorial = await cuartosConHistorial(sobran.map((r) => r.id));
      await db
        .update(rooms)
        .set({ activa: false })
        .where(inArray(rooms.id, sobran.map((r) => r.id)));
      console.log(
        `      ↓ desactivados ${sobran.map((r) => r.numero).join(", ")}` +
          (conHistorial.size > 0
            ? ` (${conHistorial.size} con reservas: se conservan, solo dejan de venderse)`
            : ""),
      );
    }
  }

  // ── Tipos viejos que ya no están en seed-data ─────────────
  const slugsNuevos = new Set(roomTypeSeed.map((t) => t.slug));
  const huerfanos = existentes.filter((t) => !slugsNuevos.has(t.slug));
  if (huerfanos.length > 0) {
    console.log("\n⚠️  Tipos que ya no aparecen en seed-data (NO se tocaron):");
    for (const h of huerfanos) {
      const suyos = await db.select().from(rooms).where(eq(rooms.roomTypeId, h.id));
      const activos = suyos.filter((r) => r.activa).length;
      console.log(`   · ${h.nombre} (${h.slug}) — ${activos} cuarto(s) activo(s)`);
    }
    console.log(
      "   Si ya no existen, apágalos con:  npm run db:tarifas -- <slug>=0\n" +
        "   (solo funciona con slugs de seed-data; para estos hazlo a mano y con cuidado)",
    );
  }

  // ── Resumen de lo que quedó a la venta ────────────────────
  const finales = await db.select().from(roomTypes);
  const todosLosCuartos = await db.select().from(rooms).where(eq(rooms.activa, true));
  console.log("\nInventario a la venta:");
  for (const t of finales) {
    const n = todosLosCuartos.filter((r) => r.roomTypeId === t.id).length;
    if (n > 0) console.log(`   ${String(n).padStart(2)} × ${t.nombre}`);
  }
  console.log(
    `   ${String(todosLosCuartos.length).padStart(2)} cuartos en total\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n❌ Falló:", e);
    process.exit(1);
  });
