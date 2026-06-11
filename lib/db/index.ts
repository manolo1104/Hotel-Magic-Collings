// ============================================================
// CLIENTE DRIZZLE — driver doble, instancia PEREZOSA
//   · Producción: Postgres real si existe DATABASE_URL (Railway/Neon/Supabase)
//   · Desarrollo: PGlite embebido (Postgres en WASM), persiste en ./.pglite
// La instancia se crea en la PRIMERA consulta (no al importar): así el `next
// build` no abre PGlite en varios workers a la vez al recolectar datos.
// ============================================================
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const DATA_DIR = process.env.PGLITE_DIR ?? "./.pglite";

type Holder = { db: DB; close: () => Promise<void> };

function create(): Holder {
  const url = process.env.DATABASE_URL;
  if (url && url.trim().length > 0) {
    const client = postgres(url, { max: 1, prepare: false });
    return { db: drizzlePg(client, { schema }), close: () => client.end() };
  }
  // Sin DATABASE_URL → Postgres embebido local (cero configuración)
  const client = new PGlite(DATA_DIR);
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
