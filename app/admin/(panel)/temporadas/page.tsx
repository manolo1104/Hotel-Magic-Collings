import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/db/ensure";
import { roomTypes } from "@/lib/db/schema";
import { HIDDEN_SLUGS, precioPorNoche } from "@/lib/booking/engine";
import { listarTemporadas } from "@/lib/booking/temporadas";
import { TemporadasClient } from "@/components/admin/TemporadasClient";

export const metadata: Metadata = { title: "Temporadas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TemporadasPage() {
  await ensureDb();
  const [temporadas, tipos] = await Promise.all([
    listarTemporadas(),
    db.select().from(roomTypes),
  ]);

  // El precio de ejemplo se calcula AQUÍ, en el servidor, con la misma función
  // que cobra el motor: así la vista previa del panel no necesita importar el
  // motor (ni la base) dentro del navegador.
  const tiposEjemplo = tipos
    .filter((t) => !HIDDEN_SLUGS.has(t.slug))
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      precioEjemplo: precioPorNoche(t, 2),
    }));

  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-7">
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">Temporadas</h1>
        <p className="k-subtitle">
          Sube o baja el precio de ciertas fechas sin tocar la tarifa de siempre
        </p>
      </header>
      <TemporadasClient temporadas={temporadas} tipos={tiposEjemplo} />
    </div>
  );
}
