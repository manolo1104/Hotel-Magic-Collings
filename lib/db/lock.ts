// ============================================================
// CANDADO DE TAREAS — dos capas
//   1. En memoria: el reloj interno vs. el botón "Sincronizar" del panel
//      viven en el MISMO proceso, y ahí el advisory lock de Postgres no
//      sirve (es reentrante dentro de una sesión: la pediría dos veces y
//      las dos veces diría que sí).
//   2. Advisory lock de Postgres: para cuando Railway corre más de una
//      réplica, que son procesos distintos y no comparten memoria.
// Importa porque la sincronización de canales BORRA y vuelve a insertar
// los bloqueos: si dos corridas se enciman hay un instante sin bloqueos
// = riesgo de sobreventa.
// ============================================================
import { sql } from "drizzle-orm";
import { db } from "./index";

// En globalThis para sobrevivir el hot-reload de desarrollo.
const global_ = globalThis as unknown as { __mcLocks?: Set<string> };
const enCurso = (global_.__mcLocks ??= new Set<string>());

/** Nombre de tarea → entero estable de 32 bits (lo que pide pg_advisory_lock). */
function keyOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return h;
}

/** Normaliza el resultado: postgres-js devuelve un arreglo, PGlite un {rows}. */
function firstRow(res: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(res)) return res[0] as Record<string, unknown> | undefined;
  const rows = (res as { rows?: unknown[] } | null)?.rows;
  if (Array.isArray(rows)) return rows[0] as Record<string, unknown> | undefined;
  return undefined;
}

function esVerdadero(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1;
}

/**
 * Corre `fn` solo si nadie más tiene el candado.
 * Devuelve `null` si otro proceso ya lo estaba corriendo (no es un error).
 */
export async function conCandado<T>(
  nombre: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  // Capa 1 — mismo proceso.
  if (enCurso.has(nombre)) {
    console.warn(`[cron] "${nombre}" ya está corriendo en este proceso; se omite`);
    return null;
  }
  enCurso.add(nombre);

  const key = keyOf(nombre);
  let tomado = false;
  try {
    // Capa 2 — otras réplicas.
    try {
      const row = firstRow(await db.execute(sql`select pg_try_advisory_lock(${key}) as ok`));
      tomado = esVerdadero(row?.ok);
      if (!tomado) {
        console.warn(`[cron] "${nombre}" ya está corriendo en otra réplica; se omite`);
        return null;
      }
    } catch (e) {
      // Driver sin advisory locks (o BD caída). Se corre igual: la capa 1
      // ya cubre el caso común de un solo proceso.
      console.warn(`[cron] no se pudo tomar el candado de "${nombre}", se corre igual:`, e);
    }

    return await fn();
  } finally {
    if (tomado) {
      try {
        await db.execute(sql`select pg_advisory_unlock(${key})`);
      } catch (e) {
        console.warn(`[cron] no se pudo liberar el candado de "${nombre}":`, e);
      }
    }
    enCurso.delete(nombre);
  }
}
