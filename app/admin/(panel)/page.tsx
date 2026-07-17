import type { Metadata } from "next";
import { listBookings, getRoomTypes, todayISO } from "@/lib/booking/engine";
import { ReservasClient } from "@/components/admin/ReservasClient";

export const metadata: Metadata = { title: "Reservas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const [reservas, tipos] = await Promise.all([
    listBookings(),
    // includeHidden: el panel sí ve los tipos internos (p. ej. el cuarto de prueba)
    getRoomTypes({ includeHidden: true }),
  ]);
  const tiposOpc = tipos.map((t) => ({
    slug: t.slug,
    nombre: t.nombre,
    capacidad: t.capacidad,
  }));
  return <ReservasClient initial={reservas} tipos={tiposOpc} today={todayISO()} />;
}
