// ============================================================
// SEED INDEPENDIENTE — reinicia y vuelve a sembrar la base de datos.
//   npm run db:seed
// En dev usa PGlite (./.pglite). En prod usa DATABASE_URL (.env).
// ============================================================
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, closeDb } from "./index";
import { ensureDb } from "./ensure";

async function main() {
  // Borra en orden de llaves foráneas
  await db.execute(sql.raw("DROP TABLE IF EXISTS bookings CASCADE"));
  await db.execute(sql.raw("DROP TABLE IF EXISTS rooms CASCADE"));
  await db.execute(sql.raw("DROP TABLE IF EXISTS room_types CASCADE"));

  // Recrea tablas y siembra (2 tipos + 6 cuartos)
  await ensureDb();

  console.log("✅ Seed completo: 2 tipos de habitación + 6 cuartos físicos.");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
