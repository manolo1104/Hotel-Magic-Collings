import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Para migraciones de PRODUCCIÓN (Postgres real con DATABASE_URL).
// En desarrollo no hace falta: lib/db/ensure.ts crea/siembra PGlite solo.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
