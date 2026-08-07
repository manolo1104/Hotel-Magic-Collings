// ============================================================
// CLIENTE DRIZZLE — driver doble, instancia PEREZOSA
//   · Producción: Postgres real (DATABASE_URL o DATABASE_PUBLIC_URL)
//   · Desarrollo: PGlite embebido (Postgres en WASM), persiste en ./.pglite
// La instancia se crea en la PRIMERA consulta (no al importar): así el `next
// build` no abre PGlite en varios workers a la vez al recolectar datos.
//
// ⚠️ POR QUÉ ESTO FALLA RUIDOSO EN PRODUCCIÓN (incidente del 18 jul 2026)
// El servicio de Railway tenía `DATABASE_PUBLIC_URL` pero NO `DATABASE_URL`,
// que era la única que se leía. El respaldo a PGlite entró en silencio y el
// sitio estuvo ~3 semanas guardando las reservas en un disco EFÍMERO que se
// borra en cada redeploy, mientras el Postgres real no recibía una sola
// escritura. Nadie se enteró porque desde fuera todo respondía 200.
// Dos defensas para que no se repita:
//   1. se aceptan AMBOS nombres de variable (Railway expone el segundo);
//   2. en producción, quedarse sin Postgres real revienta con un mensaje
//      claro en vez de degradarse a una base que se evapora.
// ============================================================
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const DATA_DIR = process.env.PGLITE_DIR ?? "./.pglite";

type Holder = { db: DB; close: () => Promise<void> };

/**
 * URL del Postgres real. Railway inyecta `DATABASE_PUBLIC_URL` al referenciar
 * el servicio de Postgres, así que se acepta como alias de `DATABASE_URL`.
 */
function postgresUrl(): string | undefined {
  for (const v of [process.env.DATABASE_URL, process.env.DATABASE_PUBLIC_URL]) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function create(): Holder {
  const url = postgresUrl();
  if (url) {
    const client = postgres(url, { max: 1, prepare: false });
    return { db: drizzlePg(client, { schema }), close: () => client.end() };
  }

  // Sin Postgres real. En producción esto significa perder reservas en
  // silencio, así que se detiene aquí salvo que se pida explícitamente.
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EPHEMERAL_DB) {
    throw new Error(
      "No hay base de datos: falta DATABASE_URL (o DATABASE_PUBLIC_URL). " +
        "Sin ella las reservas se guardarían en una base temporal que se borra " +
        "en cada despliegue. Configura la variable en el hosting. " +
        "Si de verdad quieres una base efímera, define ALLOW_EPHEMERAL_DB=1.",
    );
  }

  // Postgres embebido (PGlite) para desarrollo.
  //  · En Vercel el sistema de archivos es de solo lectura → usar EN MEMORIA.
  //  · En local → archivo persistente en ./.pglite.
  const client = process.env.VERCEL ? new PGlite() : new PGlite(DATA_DIR);
  return {
    // Los drivers comparten la API de query-builder; el cast unifica el tipo.
    db: drizzlePglite(client, { schema }) as unknown as DB,
    close: () => client.close(),
  };
}

// Singleton perezoso, cacheado en globalThis para sobrevivir el hot-reload.
const globalForDb = globalThis as unknown as { __mcHolder?: Holder };

function getHolder(): Holder {
  if (!globalForDb.__mcHolder) globalForDb.__mcHolder = create();
  return globalForDb.__mcHolder;
}

// Proxy que instancia el cliente real en el primer acceso (primera consulta).
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getHolder().db as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Cierra la conexión (útil en scripts como el seed). */
export function closeDb(): Promise<void> {
  return getHolder().close();
}

export { schema };
